import {
  fetchPayrollModalPollThunk,
  fetchPayrollPaymentProgressThunk,
  fetchPayrollReconciliationProgressThunk,
} from './payrollApprovedPaymentModalService';
import {
  fetchMutationLogsPollThunk,
  fetchPayrollMutationPollStatusThunk,
} from './payrollMutationPollService';
import { evaluatePayrollModalPollStop } from '../utils/payrollModalPollStop';
import {
  PAYROLL_OPERATION,
  enrichPayrollProgressFromJsonExt,
  isObsoletedTerminalOperationProgress,
  shouldIgnoreDedicatedPaymentProgress,
} from '../utils/payrollOperationProgress';

export const PAYROLL_MODAL_POLL_INTERVAL_MS = 2500;

/**
 * Fusionne la réponse légère payroll*Progress avec la ligne modale (jsonExt).
 */
function mergeModalPollRows(modalRow, dedicatedRow, operation, sessionOpts = {}) {
  if (!modalRow && !dedicatedRow) return null;
  if (!dedicatedRow) return modalRow;
  if (!modalRow) return dedicatedRow;
  const payrollOperation = operation === 'reconciliation'
    ? PAYROLL_OPERATION.RECONCILIATION
    : PAYROLL_OPERATION.PAYMENT;
  const dedicatedProgress = operation === 'reconciliation'
    ? dedicatedRow.reconciliationProgress
    : dedicatedRow.paymentProgress;
  if (operation === 'payment' && shouldIgnoreDedicatedPaymentProgress(
    dedicatedProgress,
    modalRow,
    sessionOpts,
  )) {
    return modalRow;
  }
  if (isObsoletedTerminalOperationProgress(payrollOperation, dedicatedProgress, modalRow)) {
    return modalRow;
  }
  const patch = operation === 'reconciliation'
    ? { reconciliationProgress: dedicatedRow.reconciliationProgress }
    : { paymentProgress: dedicatedRow.paymentProgress };
  return enrichPayrollProgressFromJsonExt({
    ...modalRow,
    ...patch,
    jsonExt: modalRow.jsonExt ?? dedicatedRow.jsonExt,
  }, sessionOpts.sessionStartedAtMs ?? undefined);
}

/**
 * Poll modale : priorité payroll connection (jsonExt), puis payroll*Progress si mutation suivie.
 * @returns cleanup
 */
export function startPayrollModalProgressPolling(dispatch, payrollId, callbacks = {}) {
  let stopped = false;
  let pollsAfterMutationStart = 0;
  const operation = callbacks.operation ?? 'payment';
  const clientMutationId = callbacks.clientMutationId ?? null;
  const trackMutationLog = Boolean(clientMutationId);

  const stop = () => {
    stopped = true;
  };

  const fetchPollRow = () => {
    const modalPromise = dispatch(fetchPayrollModalPollThunk(payrollId));
    if (!trackMutationLog) {
      return modalPromise;
    }
    const dedicatedPromise = operation === 'reconciliation'
      ? dispatch(fetchPayrollReconciliationProgressThunk(payrollId))
      : dispatch(fetchPayrollPaymentProgressThunk(payrollId));
    return Promise.all([modalPromise, dedicatedPromise]).then(
      ([modalRow, dedicatedRow]) => mergeModalPollRows(
        modalRow,
        dedicatedRow,
        operation,
        typeof callbacks.getPaymentSessionOptions === 'function'
          ? callbacks.getPaymentSessionOptions()
          : {},
      ),
    );
  };

  const poll = () => {
    if (stopped) return;

    if (trackMutationLog) {
      pollsAfterMutationStart += 1;
    }

    fetchPollRow()
      .then((progressRow) => {
        if (stopped) return { progressRow, mutationLogs: null, pollStatus: null };
        const secondary = [];
        if (clientMutationId) {
          secondary.push(dispatch(fetchMutationLogsPollThunk(clientMutationId)));
          secondary.push(
            dispatch(fetchPayrollMutationPollStatusThunk(clientMutationId, payrollId)),
          );
        }
        return Promise.all(secondary).then(([mutationLogs, pollStatus]) => ({
          progressRow,
          mutationLogs: mutationLogs ?? null,
          pollStatus: pollStatus ?? null,
        }));
      })
      .then((bundle) => {
        if (stopped || !bundle) return null;
        const { progressRow, mutationLogs, pollStatus } = bundle;
        if (!progressRow) return null;
        return { ...progressRow, mutationLogs, pollStatus };
      })
      .then((payroll) => {
        if (stopped || !payroll) return;

        callbacks.onProgress?.(payroll);

        const sessionOpts = typeof callbacks.getPaymentSessionOptions === 'function'
          ? callbacks.getPaymentSessionOptions()
          : {};
        const stopDecision = evaluatePayrollModalPollStop({
          progressRow: payroll,
          contextPayroll: typeof callbacks.getContextPayroll === 'function'
            ? callbacks.getContextPayroll()
            : null,
          paymentSessionStartedAtMs: sessionOpts.sessionStartedAtMs ?? (
            typeof callbacks.getPaymentSessionStartedAt === 'function'
              ? callbacks.getPaymentSessionStartedAt()
              : null
          ),
          paymentSessionBackendConfirmed: sessionOpts.backendConfirmed !== false,
          paymentSessionMutationAccepted: sessionOpts.mutationAccepted === true,
          activeClientMutationId: sessionOpts.clientMutationId ?? clientMutationId,
          operation,
          mutationLogs: payroll.mutationLogs,
          pollStatus: payroll.pollStatus,
          pollsAfterMutationStart,
          trackMutationLog,
        });

        if (stopDecision.stop) {
          if (typeof callbacks.shouldDeferTerminalStop === 'function' && callbacks.shouldDeferTerminalStop()) {
            return;
          }
          if (stopDecision.reason === 'ghost') {
            callbacks.onGhostMutation?.();
          }
          callbacks.onTerminal?.(payroll, stopDecision);
          stop();
          callbacks.onStop?.();
        }
      })
      .catch(() => {});
  };

  poll();
  const intervalId = setInterval(poll, callbacks.pollIntervalMs ?? PAYROLL_MODAL_POLL_INTERVAL_MS);

  return () => {
    stop();
    clearInterval(intervalId);
  };
}
