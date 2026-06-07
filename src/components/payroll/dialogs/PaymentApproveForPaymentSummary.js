/* eslint-disable max-len */
import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import {
  fetchMutation,
  journalize,
  useModulesManager,
  useTranslations,
  useToast,
} from '@openimis/fe-core';
import {
  Typography,
  Box,
  CircularProgress,
} from '@material-ui/core';
import { connect, useSelector } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  MODULE_NAME,
  PAYROLL_STATUS,
} from '../../../constants';
import {
  closePayroll,
  fetchPayroll,
  fetchBenefitConsumptions,
  makePaymentForPayroll,
  rejectPayroll,
  triggerPayrollReconciliation,
} from '../../../actions';
import { ACTION_TYPE } from '../../../reducer';
import { mutationLabel } from '../../../utils/string-utils';
import BenefitConsumptionSearcherModal from '../BenefitConsumptionSearcherModal';
import PayrollReconciliationSummaryStats from '../PayrollReconciliationSummaryStats';
import PayrollApprovedPaymentModalKpi from '../PayrollApprovedPaymentModalKpi';
import {
  PAYROLL_OPERATION,
  enrichPayrollProgressFromJsonExt,
  isBenignTerminalOperationMessage,
  isObsoletedTerminalOperationProgress,
  isPaymentActivelyRunning,
  isReconciliationActivelyRunning,
  isSessionStaleTerminalProgress,
  isJsonExtPaymentJobActive,
  getJsonExtPaymentProgress,
  isJsonExtPaymentTerminal,
  normalizePaymentProgressDisplay,
  derivePaymentBatchTotalFromExtProgress,
  resolvePaymentProgressFromFusion,
  mergePaymentProgressCounters,
  canAcceptPaymentSessionTerminal,
  parsePayrollProgress,
  shouldStartPollingPayment,
  shouldStartPollingReconciliation,
} from '../../../utils/payrollOperationProgress';
import { generateClientMutationId } from '../../../utils/payrollCreationProgress';
import { journalizePayrollMutationAfterSuccess } from '../../../utils/payrollAsyncMutation';
import { shouldRefetchPayrollOnTaskBarComplete } from '../../../utils/payrollTaskBar';
import {
  computeOnlineWorkflowButtons,
  getBenefitsFromPayroll,
  getPayrollWorkflowFlags,
} from '../../../utils/payrollWorkflow';
import downloadPayroll from '../../../utils/export';
import { listPaymentReports, uploadPaymentReport } from '../../../services/paymentReportService';
import { fetchPayrollReconciliationTasksThunk } from '../../../services/payrollTaskService';
import { fetchPayrollApprovedPaymentModalThunk } from '../../../services/payrollApprovedPaymentModalService';
import { startPayrollModalProgressPolling } from '../../../services/payrollApprovedPaymentPollingService';
import { formatOperationProgressMessage } from '../../../utils/payrollModalPollStop';
import { getPayrollBackendErrorMessage } from '../../../utils/payrollBackendErrors';
import { notifyReconciliationCompleted } from '../../../utils/payrollReconciliationToast';
import { buildApprovedModalStatsPayroll } from '../../../utils/parsePayrollReconciliationRecap';

const TERMINAL_PROGRESS = ['COMPLETED', 'FAILED', 'CANCELLED', 'STALE'];
/** Garde le bouton/spinner grisé après clic si le backend met quelques secondes à répondre. */
const PENDING_OPERATION_GRACE_MS = 5000;

function isPayrollJobFlagActive(payrollRow, operation) {
  if (!payrollRow) return false;
  if (operation === PAYROLL_OPERATION.PAYMENT) {
    return payrollRow.paymentInProgress === true || payrollRow.paymentInProgress === 'true';
  }
  if (operation === PAYROLL_OPERATION.RECONCILIATION) {
    return payrollRow.reconciliationInProgress === true
      || payrollRow.reconciliationInProgress === 'true';
  }
  return false;
}

function showTerminalToast(
  operation,
  progress,
  toast,
  formatMessage,
  formatMessageWithValues,
  payroll,
  {
    paymentSessionStartedAtMs = null,
    activeClientMutationId = null,
    paymentSessionBackendConfirmed = true,
    paymentSessionMutationAccepted = false,
  } = {},
) {
  const enrichedPayroll = enrichPayrollProgressFromJsonExt(payroll, paymentSessionStartedAtMs);
  if (isObsoletedTerminalOperationProgress(operation, progress, enrichedPayroll)) {
    return;
  }
  const effectiveProgress = operation === PAYROLL_OPERATION.PAYMENT
    ? (getJsonExtPaymentProgress(enrichedPayroll) ?? enrichedPayroll?.paymentProgress)
    : enrichedPayroll?.reconciliationProgress;
  if (!effectiveProgress?.status || !TERMINAL_PROGRESS.includes(effectiveProgress.status)) {
    return;
  }
  if (
    operation === PAYROLL_OPERATION.PAYMENT
    && paymentSessionStartedAtMs
    && !isJsonExtPaymentTerminal(enrichedPayroll, paymentSessionStartedAtMs)
  ) {
    return;
  }
  if (
    operation === PAYROLL_OPERATION.PAYMENT
    && paymentSessionStartedAtMs
    && paymentSessionBackendConfirmed !== true
  ) {
    return;
  }
  if (
    operation === PAYROLL_OPERATION.PAYMENT
    && paymentSessionStartedAtMs
    && !canAcceptPaymentSessionTerminal({
      progress: effectiveProgress,
      payroll: enrichedPayroll,
      sessionStartedAtMs: paymentSessionStartedAtMs,
      clientMutationId: activeClientMutationId,
      backendConfirmed: paymentSessionBackendConfirmed !== false,
      mutationAccepted: paymentSessionMutationAccepted === true,
    })
  ) {
    return;
  }
  if (operation === PAYROLL_OPERATION.PAYMENT && isPaymentActivelyRunning(enrichedPayroll)) {
    return;
  }
  if (operation === PAYROLL_OPERATION.RECONCILIATION && isReconciliationActivelyRunning(enrichedPayroll)) {
    return;
  }
  const status = effectiveProgress.status;
  if (isBenignTerminalOperationMessage(effectiveProgress)) {
    return;
  }
  if (status === 'STALE' && isPayrollJobFlagActive(enrichedPayroll, operation)) {
    return;
  }
  if (operation === PAYROLL_OPERATION.PAYMENT) {
    if (status === 'COMPLETED') {
      if (isPaymentActivelyRunning(enrichedPayroll) || effectiveProgress.shouldStopPolling === false) {
        return;
      }
      toast.showSuccess(formatMessage('payroll.workflow.success.paymentSent'));
    } else if (status === 'FAILED') {
      toast.showError(effectiveProgress?.error || formatMessage('payroll.operation.failed'));
    } else if (status === 'CANCELLED') {
      toast.showInfo(effectiveProgress?.message || formatMessage('payroll.operation.cancelled'));
    } else if (status === 'STALE') {
      toast.showWarning(formatMessage('payroll.operation.stale'));
    }
  } else if (operation === PAYROLL_OPERATION.RECONCILIATION) {
    if (status === 'COMPLETED') {
      notifyReconciliationCompleted(enrichedPayroll, toast, formatMessage, formatMessageWithValues);
    } else if (status === 'FAILED') {
      toast.showError(effectiveProgress?.error || formatMessage('payroll.operation.failed'));
    } else if (status === 'CANCELLED') {
      toast.showInfo(effectiveProgress?.message || formatMessage('payroll.operation.cancelled'));
    } else if (status === 'STALE') {
      toast.showWarning(formatMessage('payroll.operation.stale'));
    }
  }
}

function shouldRunModalProgressPoll(payrollRow) {
  if (!payrollRow) return false;
  const flags = getPayrollWorkflowFlags(payrollRow);
  return flags.paymentInProgress
    || flags.reconciliationInProgress
    || shouldStartPollingPayment(payrollRow)
    || shouldStartPollingReconciliation(payrollRow);
}

function modalProgressPollOperation(payrollRow) {
  const flags = getPayrollWorkflowFlags(payrollRow);
  if (flags.reconciliationInProgress && !flags.paymentInProgress) {
    return 'reconciliation';
  }
  return 'payment';
}

function mergeInflightModalPayroll(prev, serverRow, sessionStartedAtMs, uiPendingOp, optimisticOp) {
  const sessionMs = sessionStartedAtMs
    ?? serverRow?.paymentSessionStartedAtMs
    ?? prev?.paymentSessionStartedAtMs
    ?? null;
  const loaded = enrichPayrollProgressFromJsonExt(serverRow, sessionMs);
  const inflightOp = uiPendingOp || optimisticOp;
  if (!prev || !inflightOp) {
    return loaded;
  }

  const merged = {
    ...loaded,
    beneficiairesSelectionnes: loaded.beneficiairesSelectionnes ?? prev.beneficiairesSelectionnes,
    paymentApprovedModalSummary:
      loaded.paymentApprovedModalSummary ?? prev.paymentApprovedModalSummary,
    reconciledBenefitCount: loaded.reconciledBenefitCount ?? prev.reconciledBenefitCount,
    paymentSessionStartedAtMs: sessionMs ?? undefined,
  };

  if (inflightOp === 'payment') {
    const loadedPayment = loaded.paymentProgress;
    const staleTerminal = sessionMs && isSessionStaleTerminalProgress(loadedPayment, sessionMs);
    const activeOnServer = isPaymentActivelyRunning(loaded)
      || isPayrollJobFlagActive(loaded, PAYROLL_OPERATION.PAYMENT);
    if (staleTerminal || !activeOnServer) {
      merged.paymentInProgress = true;
      const prevProgress = prev.paymentProgress;
      const keepProgress = prevProgress?.status === 'IN_PROGRESS'
        || prevProgress?.status === 'FINALIZING';
      merged.paymentProgress = mergePaymentProgressCounters(
        prevProgress,
        {
          ...(keepProgress ? prevProgress : {
            status: 'IN_PROGRESS',
            processedBeneficiaries: 0,
            totalBeneficiaries: 0,
          }),
        },
      );
    }
  } else if (inflightOp === 'reconciliation') {
    const activeOnServer = isReconciliationActivelyRunning(loaded)
      || isPayrollJobFlagActive(loaded, PAYROLL_OPERATION.RECONCILIATION);
    if (!activeOnServer) {
      merged.reconciliationInProgress = true;
      merged.reconciliationProgress = prev.reconciliationProgress?.status === 'IN_PROGRESS'
        ? prev.reconciliationProgress
        : { status: 'IN_PROGRESS' };
    }
  }

  return enrichPayrollProgressFromJsonExt(merged, sessionMs);
}

function PaymentApproveForPaymentDialog({
  classes,
  payroll,
  closePayroll,
  rejectPayroll,
  payrollDetail,
  fetchPayroll,
  makePaymentForPayroll,
  triggerPayrollReconciliation,
  fetchBenefitConsumptions,
  benefitConsumptions,
  submittingMutation,
  mutation,
  dispatch,
  journalize,
}) {
  const modulesManager = useModulesManager();
  const toast = useToast();
  const [payrollUuid] = useState(payrollDetail?.id ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [modalPayroll, setModalPayroll] = useState(null);
  const [paymentReports, setPaymentReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reconciliationTasks, setReconciliationTasks] = useState([]);
  const [optimisticOperation, setOptimisticOperation] = useState(null);
  const [uiPendingOperation, setUiPendingOperation] = useState(null);
  const uiPendingOperationRef = useRef(null);
  const optimisticOperationRef = useRef(null);
  const pendingGraceTimerRef = useRef(null);
  const pendingOperationStartedAtRef = useRef(0);
  const backendConfirmedForPendingRef = useRef(false);
  const workflowPayrollRef = useRef(null);
  /** Contexte modale (jsonExt) disponible avant le re-render React — évite toast/poll prématurés. */
  const modalPollContextRef = useRef(null);
  const paymentSessionStartedAtRef = useRef(null);
  const paymentSessionBackendConfirmedRef = useRef(false);
  const paymentSessionMutationAcceptedRef = useRef(false);
  const paymentSessionBatchTotalRef = useRef(null);
  const paymentSuccessToastMutationIdRef = useRef(null);
  const prevSubmittingMutationRef = useRef();
  const stopModalPollRef = useRef(null);
  const activeClientMutationIdRef = useRef(null);
  const taskBarRefetchedIdsRef = useRef(new Set());
  const terminalToastShownRef = useRef({ payment: null, reconciliation: null });
  const coreMutations = useSelector((state) => state.core?.mutations ?? []);

  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const benefitsFromPayroll = getBenefitsFromPayroll(payroll);
  const benefits = (benefitConsumptions?.length > 0 ? benefitConsumptions : benefitsFromPayroll);
  const payrollFromStore = useMemo(() => {
    if (!payroll?.id || !payrollDetail?.id) return null;
    return String(payroll.id) === String(payrollDetail.id) ? payroll : null;
  }, [payroll, payrollDetail?.id]);
  const mergedPayroll = useMemo(() => enrichPayrollProgressFromJsonExt({
    ...payrollDetail,
    ...(payrollFromStore ?? {}),
    ...modalPayroll,
    benefitConsumption: benefits,
  }), [payrollDetail, payrollFromStore, modalPayroll, benefits]);

  const workflowPayroll = useMemo(() => {
    if (!optimisticOperation) return mergedPayroll;
    if (optimisticOperation === 'payment') {
      return {
        ...mergedPayroll,
        paymentInProgress: true,
        paymentProgress: mergedPayroll.paymentProgress?.status
          ? mergedPayroll.paymentProgress
          : { status: 'IN_PROGRESS' },
      };
    }
    return {
      ...mergedPayroll,
      reconciliationInProgress: true,
      reconciliationProgress: mergedPayroll.reconciliationProgress?.status
        ? mergedPayroll.reconciliationProgress
        : { status: 'IN_PROGRESS' },
    };
  }, [mergedPayroll, optimisticOperation]);

  const statsPayroll = useMemo(
    () => buildApprovedModalStatsPayroll(payrollDetail, modalPayroll, payroll),
    [payrollDetail, modalPayroll, payroll],
  );

  const workflow = computeOnlineWorkflowButtons({
    payroll: workflowPayroll,
    tasks: reconciliationTasks,
    paymentReportsCount: paymentReports.length,
    benefits,
    statusCounts: modalPayroll?.benefitConsumptionStatusCounts,
    formatMessage,
  });

  const paymentActive = isPaymentActivelyRunning(workflowPayroll);
  const reconciliationActive = isReconciliationActivelyRunning(workflowPayroll);
  const operationBusy = paymentActive
    || reconciliationActive
    || optimisticOperation != null
    || uiPendingOperation != null;

  workflowPayrollRef.current = workflowPayroll;

  const paymentProgress = useMemo(
    () => resolvePaymentProgressFromFusion(workflowPayroll, {
      sessionStartedAtMs: paymentSessionStartedAtRef.current,
      batchTotal: modalPayroll?.paymentSessionBatchTotal
        ?? paymentSessionBatchTotalRef.current,
    }) ?? normalizePaymentProgressDisplay(
      mergePaymentProgressCounters(
        parsePayrollProgress(workflowPayroll?.paymentProgress),
        parsePayrollProgress(modalPayroll?.paymentProgress),
      ),
      {
        batchTotal: modalPayroll?.paymentSessionBatchTotal
          ?? paymentSessionBatchTotalRef.current,
      },
    ),
    [
      workflowPayroll,
      modalPayroll?.paymentProgress,
      modalPayroll?.jsonExt,
      modalPayroll?.paymentSessionBatchTotal,
      optimisticOperation,
    ],
  );
  const reconciliationProgress = workflowPayroll?.reconciliationProgress
    ?? modalPayroll?.reconciliationProgress;

  const loadPaymentReports = async () => {
    if (!payrollUuid) return;
    setLoadingReports(true);
    try {
      const reports = await listPaymentReports(payrollUuid);
      setPaymentReports(Array.isArray(reports) ? reports : []);
    } catch (error) {
      console.error('Error loading payment reports:', error);
      setPaymentReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadReconciliationTasks = () => {
    if (!payrollUuid || !dispatch) return;
    dispatch(fetchPayrollReconciliationTasksThunk(payrollUuid))
      .then((tasks) => setReconciliationTasks(tasks || []))
      .catch(() => setReconciliationTasks([]));
  };

  const loadBenefitConsumptions = () => {
    if (!payrollUuid) return;
    fetchBenefitConsumptions(modulesManager, [
      'isDeleted: false',
      `payrollUuid: "${payrollUuid}"`,
      'first: 500',
    ]);
  };

  const capturePaymentBatchTotalFromRow = (row) => {
    if (!paymentSessionStartedAtRef.current || paymentSessionBatchTotalRef.current) return;
    const extProgress = getJsonExtPaymentProgress(row);
    const fromCelery = derivePaymentBatchTotalFromExtProgress(extProgress);
    if (fromCelery != null && fromCelery > 0) {
      paymentSessionBatchTotalRef.current = fromCelery;
    }
  };

  const markPaymentSessionBackendConfirmed = () => {
    if (!paymentSessionStartedAtRef.current) return;
    paymentSessionBackendConfirmedRef.current = true;
  };

  const getPaymentSessionOptions = useCallback(() => ({
    sessionStartedAtMs: paymentSessionStartedAtRef.current,
    backendConfirmed: paymentSessionBackendConfirmedRef.current,
    mutationAccepted: paymentSessionMutationAcceptedRef.current,
    clientMutationId: activeClientMutationIdRef.current,
    batchTotal: paymentSessionBatchTotalRef.current,
  }), []);

  const getModalPollContext = useCallback(
    () => modalPollContextRef.current || workflowPayrollRef.current,
    [],
  );

  const loadModalPayroll = useCallback(() => {
    if (!payrollUuid) return Promise.resolve(null);
    return dispatch(fetchPayrollApprovedPaymentModalThunk(payrollUuid))
      .then((row) => {
        if (!row) return null;
        let next = null;
        setModalPayroll((prev) => {
          next = mergeInflightModalPayroll(
            prev,
            row,
            paymentSessionStartedAtRef.current,
            uiPendingOperationRef.current,
            optimisticOperationRef.current,
          );
          modalPollContextRef.current = next;
          return next;
        });
        return next;
      });
  }, [dispatch, payrollUuid]);

  const refreshWorkflowState = useCallback(({
    loadBenefits = false,
    refetchPayroll = false,
    reloadModal = true,
  } = {}) => {
    if (payrollUuid) {
      if (refetchPayroll) {
        fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      }
      if (reloadModal) {
        loadModalPayroll();
      }
      loadPaymentReports();
      loadReconciliationTasks();
      if (loadBenefits) {
        loadBenefitConsumptions();
      }
    }
  }, [payrollUuid, modulesManager, fetchPayroll, loadModalPayroll]);

  const stopModalPolling = () => {
    if (stopModalPollRef.current) {
      stopModalPollRef.current();
      stopModalPollRef.current = null;
    }
  };

  const startModalPolling = (operation = 'payment', clientMutationId = null) => {
    if (!payrollUuid || stopModalPollRef.current) return;
    const mutationId = clientMutationId ?? activeClientMutationIdRef.current;
    const polledOperation = operation;
    stopModalPollRef.current = startPayrollModalProgressPolling(
      dispatch,
      payrollUuid,
      {
        operation,
        clientMutationId: mutationId,
        getContextPayroll: getModalPollContext,
        getPaymentSessionOptions,
        getPaymentSessionStartedAt: () => paymentSessionStartedAtRef.current,
        shouldDeferTerminalStop: () => (
          uiPendingOperationRef.current != null
          || optimisticOperationRef.current != null
          || (
            paymentSessionStartedAtRef.current
            && activeClientMutationIdRef.current
            && (
              !paymentSessionMutationAcceptedRef.current
              || !paymentSessionBackendConfirmedRef.current
            )
          )
        ),
        onProgress: (row) => {
          const {
            mutationLogs,
            pollStatus,
            paymentApprovedModalSummary,
            benefitConsumptionStatusCounts,
            ...payrollPatch
          } = row;
          if (uiPendingOperationRef.current === 'payment') {
            confirmPendingOperationFromRow(row, 'payment');
          }
          capturePaymentBatchTotalFromRow(row);
          if (uiPendingOperationRef.current === 'reconciliation') {
            confirmPendingOperationFromRow(row, 'reconciliation');
          }
          setModalPayroll((prev) => {
            const rawPaymentProgress = parsePayrollProgress(
              row.paymentProgress ?? payrollPatch.paymentProgress,
            );
            const rawReconciliationProgress = parsePayrollProgress(
              row.reconciliationProgress ?? payrollPatch.reconciliationProgress,
            );
            const skipObsoletePayment = prev && (
              isObsoletedTerminalOperationProgress(
                PAYROLL_OPERATION.PAYMENT,
                rawPaymentProgress,
                prev,
              )
              || (paymentSessionStartedAtRef.current
                && isSessionStaleTerminalProgress(
                  rawPaymentProgress,
                  paymentSessionStartedAtRef.current,
                ))
            );
            const skipObsoleteReconciliation = prev
              && isObsoletedTerminalOperationProgress(
                PAYROLL_OPERATION.RECONCILIATION,
                rawReconciliationProgress,
                prev,
              );
            const enriched = enrichPayrollProgressFromJsonExt({
              ...prev,
              ...payrollPatch,
              paymentSessionStartedAtMs: paymentSessionStartedAtRef.current ?? prev?.paymentSessionStartedAtMs,
              paymentProgress: skipObsoletePayment
                ? prev.paymentProgress
                : (row.paymentProgress ?? payrollPatch.paymentProgress ?? prev?.paymentProgress),
              reconciliationProgress: skipObsoleteReconciliation
                ? prev.reconciliationProgress
                : (row.reconciliationProgress
                  ?? payrollPatch.reconciliationProgress
                  ?? prev?.reconciliationProgress),
              jsonExt: payrollPatch.jsonExt ?? row.jsonExt ?? prev?.jsonExt,
            }, paymentSessionStartedAtRef.current);
            const jsonExtJobActive = isJsonExtPaymentJobActive(enriched);
            capturePaymentBatchTotalFromRow(enriched);
            if (
              paymentSessionStartedAtRef.current
              && (isPaymentActivelyRunning(enriched) || jsonExtJobActive)
            ) {
              markPaymentSessionBackendConfirmed();
            }
            let pp = resolvePaymentProgressFromFusion(enriched, {
              sessionStartedAtMs: paymentSessionStartedAtRef.current,
              batchTotal: prev?.paymentSessionBatchTotal
                ?? paymentSessionBatchTotalRef.current,
            });
            if (!pp) {
              pp = normalizePaymentProgressDisplay(
                mergePaymentProgressCounters(
                  parsePayrollProgress(prev?.paymentProgress),
                  enriched.paymentProgress,
                ),
                {
                  batchTotal: prev?.paymentSessionBatchTotal
                    ?? paymentSessionBatchTotalRef.current,
                },
              );
            }
            const terminalPayment = pp?.status
              && ['COMPLETED', 'FAILED', 'CANCELLED', 'STALE'].includes(pp.status)
              && !isPaymentActivelyRunning({ ...enriched, paymentProgress: pp })
              && !jsonExtJobActive
              && !isJsonExtPaymentJobActive(enriched);
            if (
              terminalPayment
              && !isPayrollJobFlagActive({ ...enriched, paymentProgress: pp }, PAYROLL_OPERATION.PAYMENT)
              && uiPendingOperationRef.current == null
            ) {
              clearOptimisticOperation();
            }
            const next = {
              ...enriched,
              paymentProgress: pp,
              paymentSessionBatchTotal: paymentSessionBatchTotalRef.current ?? undefined,
              paymentInProgress: jsonExtJobActive || isJsonExtPaymentJobActive(enriched)
                ? true
                : (terminalPayment && pp?.status !== 'STALE'
                  ? false
                  : enriched.paymentInProgress),
              paymentApprovedModalSummary:
                paymentApprovedModalSummary ?? prev?.paymentApprovedModalSummary,
              benefitConsumptionStatusCounts:
                benefitConsumptionStatusCounts ?? prev?.benefitConsumptionStatusCounts,
            };
            modalPollContextRef.current = next;
            return next;
          });
        },
        onGhostMutation: () => {
          toast.showError(formatMessage('payroll.operation.mutationNotRegistered'));
        },
        onTerminal: (row) => {
          const enrichedRow = enrichPayrollProgressFromJsonExt({
            ...getModalPollContext(),
            ...row,
          }, paymentSessionStartedAtRef.current);
          if (
            isPaymentActivelyRunning(enrichedRow)
            || isReconciliationActivelyRunning(enrichedRow)
            || isJsonExtPaymentJobActive(enrichedRow)
            || uiPendingOperationRef.current != null
          ) {
            if (isJsonExtPaymentJobActive(enrichedRow) && !stopModalPollRef.current) {
              startOperationPolling('payment', activeClientMutationIdRef.current);
            }
            return;
          }
          const pp = getJsonExtPaymentProgress(enrichedRow) ?? enrichedRow.paymentProgress;
          const rp = enrichedRow.reconciliationProgress;
          if (
            polledOperation === 'payment'
            && paymentSessionStartedAtRef.current
            && activeClientMutationIdRef.current
            && !canAcceptPaymentSessionTerminal({
              progress: pp,
              payroll: enrichedRow,
              sessionStartedAtMs: paymentSessionStartedAtRef.current,
              clientMutationId: activeClientMutationIdRef.current,
              backendConfirmed: paymentSessionBackendConfirmedRef.current,
              mutationAccepted: paymentSessionMutationAcceptedRef.current,
            })
            && pp?.status
            && TERMINAL_PROGRESS.includes(pp.status)
          ) {
            startOperationPolling('payment', activeClientMutationIdRef.current);
            return;
          }
          const rawPaymentProgress = parsePayrollProgress(row.paymentProgress);
          const rawReconciliationProgress = parsePayrollProgress(row.reconciliationProgress);
          if (
            isObsoletedTerminalOperationProgress(
              PAYROLL_OPERATION.PAYMENT,
              rawPaymentProgress,
              enrichedRow,
            )
            || isObsoletedTerminalOperationProgress(
              PAYROLL_OPERATION.RECONCILIATION,
              rawReconciliationProgress,
              enrichedRow,
            )
          ) {
            return;
          }
          clearPendingUiState();
          clearOptimisticOperation();
          const { paymentApprovedModalSummary, ...payrollPatch } = row;
          setModalPayroll((prev) => enrichPayrollProgressFromJsonExt({
            ...prev,
            ...payrollPatch,
            paymentApprovedModalSummary:
              paymentApprovedModalSummary ?? prev?.paymentApprovedModalSummary,
          }, paymentSessionStartedAtRef.current));
          const rowWithFlags = enrichedRow;
          const paymentStaleWhileRunning = pp?.status === 'STALE'
            && isPayrollJobFlagActive(rowWithFlags, PAYROLL_OPERATION.PAYMENT);
          const reconciliationStaleWhileRunning = rp?.status === 'STALE'
            && isPayrollJobFlagActive(rowWithFlags, PAYROLL_OPERATION.RECONCILIATION);

          if (
            polledOperation === 'payment'
            && pp?.status
            && TERMINAL_PROGRESS.includes(pp.status)
            && !paymentStaleWhileRunning
            && isJsonExtPaymentTerminal(
              rowWithFlags,
              paymentSessionStartedAtRef.current,
            )
            && paymentSessionBackendConfirmedRef.current
            && canAcceptPaymentSessionTerminal({
              progress: pp,
              payroll: rowWithFlags,
              sessionStartedAtMs: paymentSessionStartedAtRef.current,
              clientMutationId: activeClientMutationIdRef.current,
              backendConfirmed: paymentSessionBackendConfirmedRef.current,
              mutationAccepted: paymentSessionMutationAcceptedRef.current,
            })
            && paymentSuccessToastMutationIdRef.current !== activeClientMutationIdRef.current
          ) {
            paymentSuccessToastMutationIdRef.current = activeClientMutationIdRef.current;
            showTerminalToast(
              PAYROLL_OPERATION.PAYMENT,
              pp,
              toast,
              formatMessage,
              formatMessageWithValues,
              rowWithFlags,
              {
                paymentSessionStartedAtMs: paymentSessionStartedAtRef.current,
                activeClientMutationId: activeClientMutationIdRef.current,
                paymentSessionBackendConfirmed: paymentSessionBackendConfirmedRef.current,
                paymentSessionMutationAccepted: paymentSessionMutationAcceptedRef.current,
              },
            );
            if (pp.status === 'COMPLETED') {
              paymentSessionStartedAtRef.current = null;
              paymentSessionBackendConfirmedRef.current = false;
              paymentSessionMutationAcceptedRef.current = false;
              paymentSessionBatchTotalRef.current = null;
            }
          }
          if (
            polledOperation === 'reconciliation'
            && rp?.status
            && TERMINAL_PROGRESS.includes(rp.status)
            && !reconciliationStaleWhileRunning
          ) {
            const reconciliationToastKey = `${rp.status}:${rp.message || rp.error || ''}`;
            if (terminalToastShownRef.current.reconciliation !== reconciliationToastKey) {
              terminalToastShownRef.current.reconciliation = reconciliationToastKey;
              showTerminalToast(
                PAYROLL_OPERATION.RECONCILIATION,
                rp,
                toast,
                formatMessage,
                formatMessageWithValues,
                rowWithFlags,
              );
            }
          }
          if (!paymentStaleWhileRunning && !reconciliationStaleWhileRunning) {
            refreshWorkflowState({
              loadBenefits: rp?.status === 'COMPLETED',
              refetchPayroll: true,
            });
          }
        },
        onStop: stopModalPolling,
      },
    );
  };

  const clearOptimisticOperation = () => {
    setOptimisticOperation(null);
  };

  const clearPendingGraceTimer = () => {
    if (pendingGraceTimerRef.current) {
      clearTimeout(pendingGraceTimerRef.current);
      pendingGraceTimerRef.current = null;
    }
  };

  const clearPendingUiState = () => {
    clearPendingGraceTimer();
    backendConfirmedForPendingRef.current = false;
    setUiPendingOperation(null);
    uiPendingOperationRef.current = null;
  };

  const releaseUiPendingOnly = () => {
    setUiPendingOperation(null);
    uiPendingOperationRef.current = null;
  };

  const scheduleGraceTimer = (delayMs, onFire) => {
    clearPendingGraceTimer();
    pendingGraceTimerRef.current = setTimeout(() => {
      pendingGraceTimerRef.current = null;
      onFire();
    }, delayMs);
  };

  const isBackendOperationActiveOnRow = (row, operation) => {
    if (operation === 'payment') {
      const pp = parsePayrollProgress(row.paymentProgress);
      return isPayrollJobFlagActive(row, PAYROLL_OPERATION.PAYMENT)
        || ['IN_PROGRESS', 'FINALIZING'].includes(pp?.status);
    }
    const rp = parsePayrollProgress(row.reconciliationProgress);
    return isPayrollJobFlagActive(row, PAYROLL_OPERATION.RECONCILIATION)
      || ['IN_PROGRESS', 'FINALIZING'].includes(rp?.status);
  };

  const onPendingBackendConfirmed = () => {
    if (!uiPendingOperationRef.current || backendConfirmedForPendingRef.current) return;
    backendConfirmedForPendingRef.current = true;
    if (uiPendingOperationRef.current === 'payment') {
      markPaymentSessionBackendConfirmed();
    }
    const remaining = PENDING_OPERATION_GRACE_MS
      - (Date.now() - pendingOperationStartedAtRef.current);
    scheduleGraceTimer(Math.max(0, remaining), releaseUiPendingOnly);
  };

  const schedulePendingGraceFailsafe = () => {
    scheduleGraceTimer(PENDING_OPERATION_GRACE_MS, () => {
      const op = uiPendingOperationRef.current;
      if (!op) return;
      if (backendConfirmedForPendingRef.current) {
        releaseUiPendingOnly();
        return;
      }
      const source = workflowPayrollRef.current;
      const confirmed = op === 'payment'
        ? (isPaymentActivelyRunning(source)
          || isPayrollJobFlagActive(source, PAYROLL_OPERATION.PAYMENT))
        : (isReconciliationActivelyRunning(source)
          || isPayrollJobFlagActive(source, PAYROLL_OPERATION.RECONCILIATION));
      if (!confirmed) {
        clearPendingUiState();
        clearOptimisticOperation();
      } else {
        onPendingBackendConfirmed();
      }
    });
  };

  const confirmPendingOperationFromRow = (row, operation) => {
    if (uiPendingOperationRef.current !== operation) return;
    if (isBackendOperationActiveOnRow(row, operation)) {
      onPendingBackendConfirmed();
    }
  };

  /** UI immédiate au clic — le polling démarre après succès mutation. */
  const beginOptimisticUi = (operation, clientMutationId) => {
    setOptimisticOperation(operation);
    optimisticOperationRef.current = operation;
    setUiPendingOperation(operation);
    uiPendingOperationRef.current = operation;
    backendConfirmedForPendingRef.current = false;
    pendingOperationStartedAtRef.current = Date.now();
    if (operation === 'payment') {
      paymentSessionStartedAtRef.current = pendingOperationStartedAtRef.current;
      paymentSessionBackendConfirmedRef.current = false;
      paymentSessionMutationAcceptedRef.current = false;
      paymentSessionBatchTotalRef.current = null;
      paymentSuccessToastMutationIdRef.current = null;
    }
    activeClientMutationIdRef.current = clientMutationId;
    schedulePendingGraceFailsafe();
    setModalPayroll((prev) => {
      const progressPatch = operation === 'payment'
        ? {
          paymentInProgress: true,
          paymentSessionStartedAtMs: paymentSessionStartedAtRef.current,
          paymentProgress: {
            status: 'IN_PROGRESS',
            processedBeneficiaries: 0,
            totalBeneficiaries: 0,
          },
        }
        : {
          reconciliationInProgress: true,
          reconciliationProgress: { status: 'IN_PROGRESS' },
        };
      const next = enrichPayrollProgressFromJsonExt(
        { ...prev, ...progressPatch },
        paymentSessionStartedAtRef.current,
      );
      modalPollContextRef.current = next;
      return next;
    });
  };

  const startOperationPolling = (operation, clientMutationId) => {
    stopModalPolling();
    startModalPolling(operation, clientMutationId);
  };

  const onAsyncMutationSuccess = (operation) => {
    if (!mutation?.clientMutationId || mutation?.error || mutation?.id == null) {
      return false;
    }
    journalizePayrollMutationAfterSuccess(journalize, mutation);
    if (mutation.clientMutationId) {
      activeClientMutationIdRef.current = mutation.clientMutationId;
      dispatch(fetchMutation(mutation.clientMutationId));
    }
    if (operation === 'payment') {
      paymentSessionMutationAcceptedRef.current = true;
    }
    refreshWorkflowState({
      loadBenefits: operation === 'reconciliation',
      refetchPayroll: false,
      reloadModal: false,
    });
    startOperationPolling(operation, mutation.clientMutationId);
    return true;
  };

  const handleOpen = () => {
    setIsOpen(true);
    clearPendingUiState();
    clearOptimisticOperation();
    if (modalPayroll?.id && String(modalPayroll.id) !== String(payrollDetail?.id)) {
      setModalPayroll(null);
      modalPollContextRef.current = null;
    }
    if (payrollUuid) {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      loadPaymentReports();
      loadReconciliationTasks();
    }
    loadModalPayroll().then((row) => {
      if (!row) return;
      if (!isPaymentActivelyRunning(row) && !isReconciliationActivelyRunning(row)) {
        clearOptimisticOperation();
        stopModalPolling();
      }
    });
  };

  const handleClose = () => {
    stopModalPolling();
    clearPendingUiState();
    clearOptimisticOperation();
    activeClientMutationIdRef.current = null;
    paymentSessionStartedAtRef.current = null;
    paymentSessionBackendConfirmedRef.current = false;
    paymentSessionMutationAcceptedRef.current = false;
    paymentSessionBatchTotalRef.current = null;
    paymentSuccessToastMutationIdRef.current = null;
    modalPollContextRef.current = null;
    setIsOpen(false);
  };

  useEffect(() => {
    uiPendingOperationRef.current = uiPendingOperation;
  }, [uiPendingOperation]);

  useEffect(() => {
    optimisticOperationRef.current = optimisticOperation;
  }, [optimisticOperation]);

  useEffect(() => {
    if (!isOpen) {
      stopModalPolling();
      clearPendingGraceTimer();
      return undefined;
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const pollSource = getModalPollContext();
    if (uiPendingOperationRef.current != null) return undefined;
    if (
      optimisticOperationRef.current === 'payment'
      && paymentSessionStartedAtRef.current
      && !paymentSessionBackendConfirmedRef.current
      && !isJsonExtPaymentJobActive(pollSource)
    ) {
      return undefined;
    }
    if (
      paymentSessionStartedAtRef.current
      && isJsonExtPaymentJobActive(pollSource)
      && !stopModalPollRef.current
    ) {
      startModalPolling('payment', activeClientMutationIdRef.current);
      return undefined;
    }
    if (!pollSource?.jsonExt) return undefined;
    if (!shouldRunModalProgressPoll(pollSource)) {
      stopModalPolling();
      return undefined;
    }
    if (!stopModalPollRef.current) {
      startModalPolling(modalProgressPollOperation(pollSource));
    }
    return undefined;
  }, [isOpen, modalPayroll?.id, modalPayroll?.jsonExt]);

  useEffect(() => {
    coreMutations.forEach((entry) => {
      if (!shouldRefetchPayrollOnTaskBarComplete(entry)) return;
      if (taskBarRefetchedIdsRef.current.has(entry.clientMutationId)) return;
      taskBarRefetchedIdsRef.current.add(entry.clientMutationId);
      if (payrollUuid && isOpen) {
        refreshWorkflowState({
          loadBenefits: true,
          refetchPayroll: true,
          reloadModal: !paymentSessionStartedAtRef.current,
        });
      }
    });
  }, [coreMutations, payrollUuid, isOpen]);

  useEffect(() => {
    if (prevSubmittingMutationRef.current && !submittingMutation) {
      if (mutation?.error) {
        clearPendingUiState();
        clearOptimisticOperation();
        stopModalPolling();
        setModalPayroll((prev) => (prev ? {
          ...prev,
          paymentInProgress: false,
          reconciliationInProgress: false,
        } : prev));
        toast.showError(getPayrollBackendErrorMessage(mutation.error, formatMessage));
      } else if (
        mutation?.actionType === ACTION_TYPE.MAKE_PAYMENT_PAYROLL
        || mutation?.actionType === ACTION_TYPE.TRIGGER_PAYROLL_RECONCILIATION
      ) {
        if (!onAsyncMutationSuccess(
          mutation?.actionType === ACTION_TYPE.MAKE_PAYMENT_PAYROLL ? 'payment' : 'reconciliation',
        )) {
          clearPendingUiState();
          clearOptimisticOperation();
          stopModalPolling();
          toast.showError(getPayrollBackendErrorMessage(mutation?.error, formatMessage)
            || formatMessage('payroll.operation.failed'));
        }
      } else if (mutation?.actionType === ACTION_TYPE.CLOSE_PAYROLL) {
        toast.showSuccess(formatMessage('payroll.workflow.success.approveAndClose'));
        refreshWorkflowState({ loadBenefits: true, refetchPayroll: true });
      }
    }
    prevSubmittingMutationRef.current = submittingMutation;
  }, [submittingMutation, mutation]);

  const closePayrollCallback = () => {
    if (!workflow.canApproveAndClose) {
      toast.showError(
        workflow.closePayrollBlockersMessage
        || formatMessage('payroll.reconciliation.close.disabled'),
      );
      return;
    }
    closePayroll(
      payrollDetail,
      formatMessageWithValues('payroll.mutation.closeLabel', mutationLabel(payrollDetail)),
    );
  };

  const rejectPayrollCallback = () => {
    handleClose();
    rejectPayroll(
      payrollDetail,
      formatMessageWithValues('payroll.mutation.closeLabel', mutationLabel(payrollDetail)),
    );
  };

  const makePaymentForPayrollCallback = () => {
    if (workflow.paymentInProgress) {
      toast.showError(formatMessage('payroll.workflow.error.paymentInProgress'));
      return;
    }
    const label = formatMessageWithValues('payroll.mutation.makePaymentLabel', mutationLabel(payrollDetail));
    const clientMutationId = generateClientMutationId();
    beginOptimisticUi('payment', clientMutationId);
    makePaymentForPayroll(payrollDetail, label, clientMutationId);
  };

  const triggerReconciliationCallback = () => {
    if (workflow.reconciliationInProgress) {
      toast.showError(formatMessage('payroll.workflow.error.reconciliationInProgress'));
      return;
    }
    if (workflow.reconciliationLocked) {
      toast.showError(formatMessage('payroll.workflow.error.reconciliationLocked'));
      return;
    }
    const label = formatMessageWithValues(
      'payroll.mutation.triggerReconciliationLabel',
      mutationLabel(payrollDetail),
    );
    const clientMutationId = generateClientMutationId();
    beginOptimisticUi('reconciliation', clientMutationId);
    triggerPayrollReconciliation(payrollDetail, label, clientMutationId);
  };

  const handleReportUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !payrollUuid) return;
    setUploadingReport(true);
    try {
      await uploadPaymentReport(payrollUuid, file);
      toast.showSuccess(formatMessage('PayrollPaymentReportsTab.success.upload'));
      await loadPaymentReports();
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      loadModalPayroll();
    } catch (error) {
      toast.showError(error.message || formatMessage('PayrollPaymentReportsTab.error.upload'));
    } finally {
      setUploadingReport(false);
      event.target.value = '';
    }
  };

  const downloadPayrollData = async () => {
    setDownloading(true);
    try {
      await downloadPayroll(payrollDetail.id, payrollDetail.name);
      toast.showSuccess(formatMessage('payroll.summary.download.success'));
    } catch (error) {
      toast.showError(error?.message || formatMessage('payroll.summary.download.error'));
    } finally {
      setDownloading(false);
    }
  };

  const showOnlineActions = payrollDetail.paymentMethod === 'StrategyOnlinePayment'
    && payrollDetail.status === PAYROLL_STATUS.APPROVE_FOR_PAYMENT;

  const getTriggerReconciliationDisabledReason = () => {
    if (workflow.canTriggerReconciliation) return '';
    if (workflow.reconciliationLocked) {
      return formatMessage('payroll.workflow.error.reconciliationLocked');
    }
    if (workflow.paymentInProgress) {
      return formatMessage('payroll.workflow.status.paymentInProgress');
    }
    if (workflow.reconciliationBusy) {
      return formatMessage('payroll.workflow.error.reconciliationInProgress');
    }
    if ((workflow.approveForPaymentCount ?? 0) === 0) {
      return formatMessage('payroll.workflow.hint.noApproveForPaymentBenefits');
    }
    return '';
  };

  const operationStatusMessage = () => {
    if (paymentActive) {
      const progressForDisplay = paymentProgress?.status === 'STALE'
        && isPayrollJobFlagActive(workflowPayroll, PAYROLL_OPERATION.PAYMENT)
        ? { ...paymentProgress, status: 'IN_PROGRESS' }
        : paymentProgress;
      return formatOperationProgressMessage(
        progressForDisplay,
        formatMessage,
        formatMessageWithValues,
      ) || formatMessage('payroll.workflow.status.paymentInProgress');
    }
    if (reconciliationActive) {
      return formatOperationProgressMessage(
        reconciliationProgress,
        formatMessage,
        formatMessageWithValues,
      ) || formatMessage('payroll.workflow.status.reconciliationInProgress');
    }
    return null;
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="contained"
        color="primary"
        className={classes.button}
      >
        {formatMessage('payroll.viewReconciliationSummary')}
      </Button>
      <Dialog
        open={isOpen}
        onClose={handleClose}
        PaperProps={{
          style: {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '90%',
            maxWidth: '90%',
          },
        }}
      >
        <DialogTitle style={{ marginTop: '10px' }}>
          {formatMessageWithValues('payroll.reconciliationSummary', { payrollName: payrollDetail.name })}
        </DialogTitle>
        <DialogContent>
          <PayrollApprovedPaymentModalKpi
            summary={modalPayroll?.paymentApprovedModalSummary}
            operationInProgress={operationBusy}
          />
          {operationBusy && (
            <Box
              mb={2}
              p={1.5}
              display="flex"
              alignItems="center"
              style={{ backgroundColor: '#fff8e1', borderRadius: 4 }}
            >
              <CircularProgress size={20} style={{ marginRight: 12 }} />
              <Typography variant="body2">
                {operationStatusMessage()}
              </Typography>
            </Box>
          )}
          {workflow.reconciliationLocked && (
            <Box mb={2} p={1} style={{ backgroundColor: '#e3f2fd' }}>
              <Typography variant="body2">
                {formatMessage('payroll.workflow.status.reconciliationLocked')}
              </Typography>
            </Box>
          )}
          {workflow.hasReconciliationFailure && (
            <Box mb={2} p={1} style={{ backgroundColor: '#ffebee' }}>
              <Typography variant="body2" color="error">
                {formatMessage('payroll.workflow.status.partialReconciliationFailures')}
              </Typography>
              {workflow.canTriggerReconciliation && (
                <Typography variant="body2" style={{ marginTop: 8 }}>
                  {formatMessage('payroll.workflow.hint.canRetryReconciliation')}
                </Typography>
              )}
            </Box>
          )}
          {!workflow.canApproveAndClose && workflow.closePayrollBlockersMessage && (
            <Box mb={2} p={1} style={{ backgroundColor: '#fff3e0' }}>
              <Typography variant="body2">
                {workflow.closePayrollBlockersMessage}
              </Typography>
            </Box>
          )}
          <PayrollReconciliationSummaryStats payroll={statsPayroll} forApprovedModal />
          <div style={{ backgroundColor: '#DFEDEF' }}>
            <BenefitConsumptionSearcherModal
              payrollUuid={payrollDetail.id}
              payrollDetail={payrollDetail}
            />
          </div>
        </DialogContent>
        <DialogActions
          style={{
            display: 'inline',
            paddingLeft: '10px',
            marginTop: '25px',
            marginBottom: '15px',
            width: '100%',
          }}
        >
          <div style={{ maxWidth: '3000px', width: '100%' }}>
            <div style={{ float: 'left' }}>
              {showOnlineActions && !workflow.reconciliationLocked && (
                <>
                  <Button
                    onClick={makePaymentForPayrollCallback}
                    variant="contained"
                    color="primary"
                    disabled={!workflow.canMakePayment || submittingMutation || operationBusy}
                    style={{ margin: '0 16px', marginBottom: '15px' }}
                  >
                    {formatMessage('payroll.summary.makePayment')}
                  </Button>
                  <Button
                    onClick={triggerReconciliationCallback}
                    variant="contained"
                    color="primary"
                    disabled={!workflow.canTriggerReconciliation || submittingMutation || operationBusy}
                    title={getTriggerReconciliationDisabledReason()}
                    style={{ margin: '0 16px', marginBottom: '15px' }}
                  >
                    {formatMessage('payroll.summary.triggerReconciliation')}
                  </Button>
                </>
              )}
              <Button
                onClick={closePayrollCallback}
                variant="contained"
                color="primary"
                disabled={!workflow.canApproveAndClose || submittingMutation || loadingReports}
                title={
                  !workflow.canApproveAndClose
                    ? (workflow.closePayrollBlockersMessage
                      || formatMessage('payroll.reconciliation.close.disabled'))
                    : ''
                }
                style={{ margin: '0 16px', marginBottom: '15px' }}
              >
                {formatMessage('payroll.summary.approveAndClose')}
              </Button>
              <input
                accept=".pdf"
                style={{ display: 'none' }}
                id={`upload-payment-report-${payrollUuid}`}
                type="file"
                onChange={handleReportUpload}
              />
              <label htmlFor={`upload-payment-report-${payrollUuid}`}>
                <Button
                  variant="contained"
                  component="span"
                  disabled={uploadingReport || workflow.reconciliationLocked}
                  style={{ margin: '0 16px', marginBottom: '15px' }}
                >
                  {uploadingReport
                    ? formatMessage('PayrollPaymentReportsTab.uploading')
                    : formatMessage('PayrollPaymentReportsTab.upload')}
                </Button>
              </label>
              <Button
                onClick={downloadPayrollData}
                variant="contained"
                color="primary"
                disabled={downloading}
                style={{ margin: '0 16px', marginBottom: '15px' }}
              >
                {downloading
                  ? formatMessage('payroll.summary.downloading')
                  : formatMessage('payroll.summary.download')}
              </Button>
              {!workflow.reconciliationLocked && (
                <Button
                  onClick={rejectPayrollCallback}
                  variant="contained"
                  color="primary"
                  style={{ margin: '0 16px', marginBottom: '15px' }}
                >
                  {formatMessage('payroll.summary.reject')}
                </Button>
              )}
            </div>
            <div style={{ float: 'right', paddingRight: '16px' }}>
              <Button onClick={handleClose} variant="outlined" autoFocus style={{ margin: '0 16px' }}>
                {formatMessage('payroll.summary.close')}
              </Button>
            </div>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
}

const mapStateToProps = (state) => ({
  rights: state.core?.user?.i_user?.rights ?? [],
  confirmed: state.core.confirmed,
  payroll: state.payroll.payroll,
  benefitConsumptions: state.payroll.benefitConsumptions,
  submittingMutation: state.payroll.submittingMutation,
  mutation: state.payroll.mutation,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  closePayroll,
  rejectPayroll,
  fetchPayroll,
  fetchBenefitConsumptions,
  makePaymentForPayroll,
  triggerPayrollReconciliation,
  journalize,
}, dispatch);

export default connect(mapStateToProps, (dispatch) => ({
  ...mapDispatchToProps(dispatch),
  dispatch,
}))(PaymentApproveForPaymentDialog);
