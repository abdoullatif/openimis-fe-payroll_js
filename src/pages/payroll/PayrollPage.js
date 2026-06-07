import React, { useState, useRef, useEffect } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';

import { makeStyles } from '@material-ui/styles';

import {
  Form,
  decodeId,
  useHistory,
  useModulesManager,
  useTranslations,
  useToast,
  coreConfirm,
  clearConfirm,
  journalize,
  fetchMutation,
} from '@openimis/fe-core';
import {
  fetchPayroll,
  fetchBenefitConsumptions,
  clearPayroll,
  clearPayrollBills,
  createPayroll,
} from '../../actions';
import {
  MODULE_NAME, PAYROLL_FROM_FAILED_INVOICES_URL_PARAM,
  RIGHT_PAYROLL_CREATE,
} from '../../constants';
import { ACTION_TYPE } from '../../reducer';
import { mutationLabel, pageTitle } from '../../utils/string-utils';
import PayrollHeadPanel from '../../components/payroll/PayrollHeadPanel';
import PayrollTab from '../../components/payroll/PayrollTab';
import PayrollCreationProgressDialog from '../../components/payroll/PayrollCreationProgressDialog';
import { startPayrollCreationPolling } from '../../services/payrollCreationService';
import { startPayrollCreationTaskBarAssist } from '../../services/payrollCreationTaskBarService';
import {
  canCloseCreationAfterMutationFallback,
  canCloseCreationUI,
  generateClientMutationId,
  getCreationPayrollId,
  getCreationTaskBarHint,
} from '../../utils/payrollCreationProgress';
import { journalizePayrollCreationTaskBarPending } from '../../utils/payrollAsyncMutation';

const useStyles = makeStyles((theme) => ({
  page: theme.page,
}));

function PayrollPage({
  statePayrollUuid,
  taskPayrollUuid,
  rights,
  confirmed,
  submittingMutation,
  mutation,
  payroll,
  fetchPayroll,
  createPayroll,
  clearPayroll,
  clearConfirm,
  createPayrollFromFailedInvoices,
  journalize,
  fetchMutation,
  benefitPlanId,
  dispatch,
}) {
  const modulesManager = useModulesManager();
  const classes = useStyles();
  const history = useHistory();
  const toast = useToast();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const [editedPayroll, setEditedPayroll] = useState({});
  const [payrollUuid, setPayrollUuid] = useState(null);
  const [isInTask, setIsInTask] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [isPayrollFromFailedInvoices, setIsPayrollFromFailedInvoices] = useState(false);
  const [confirmedAction, setConfirmedAction] = useState(() => null);
  const [creationOpen, setCreationOpen] = useState(false);
  const [creationInProgress, setCreationInProgress] = useState(false);
  const [creationProgress, setCreationProgress] = useState(null);
  const [creationClientMutationId, setCreationClientMutationId] = useState(null);
  const prevSubmittingMutationRef = useRef();
  const stopCreationPollRef = useRef(null);
  const stopTaskBarAssistRef = useRef(null);
  const creationModalClosedRef = useRef(false);
  const creationAbortedRef = useRef(false);
  const creationTaskBarJournalizedRef = useRef(false);
  const creationMutationSucceededRef = useRef(false);
  const pendingNavigationPayrollIdRef = useRef(null);
  const creationProgressRef = useRef(null);
  const submittingMutationRef = useRef(submittingMutation);
  const mutationRef = useRef(mutation);
  const terminalPayrollIdRef = useRef(null);

  const updateCreationProgress = (progress) => {
    creationProgressRef.current = progress;
    setCreationProgress(progress);
  };

  const back = () => history.goBack();

  const stopCreationPolling = () => {
    if (stopCreationPollRef.current) {
      stopCreationPollRef.current();
      stopCreationPollRef.current = null;
    }
  };

  const stopTaskBarAssist = () => {
    if (stopTaskBarAssistRef.current) {
      stopTaskBarAssistRef.current();
      stopTaskBarAssistRef.current = null;
    }
  };

  const normalizePayrollId = (id) => {
    if (!id) return id;
    if (/^\d+$/.test(id)) return id;
    try {
      return decodeId(id);
    } catch {
      return id;
    }
  };

  const navigateToPayroll = (payrollId) => {
    const normalizedId = normalizePayrollId(payrollId);
    if (!normalizedId) return;
    const payrollRouteRef = modulesManager.getRef('payroll.route.payroll');
    history.replace(`/${payrollRouteRef}/${normalizedId}`);
  };

  const refreshPayrollData = (payrollId) => {
    const normalizedId = normalizePayrollId(payrollId);
    if (!normalizedId) return;
    setPayrollUuid(normalizedId);
    clearPayrollBills();
    fetchPayroll(modulesManager, [`id: "${normalizedId}"`]);
    fetchBenefitConsumptions(modulesManager, [`payrollUuid: "${normalizedId}"`]);
  };

  const registerCreationTaskBar = (progress) => {
    const meta = mutationRef.current;
    const clientMutationId = meta?.clientMutationId || creationClientMutationId;
    if (!clientMutationId) return;

    if (!creationTaskBarJournalizedRef.current) {
      creationTaskBarJournalizedRef.current = true;
      const label = meta?.clientMutationLabel
        || formatMessageWithValues('payroll.mutation.create', mutationLabel(payroll));
      journalizePayrollCreationTaskBarPending(
        journalize,
        {
          clientMutationId,
          clientMutationLabel: label,
          requestedDateTime: meta?.requestedDateTime,
        },
        { taskBarMessage: getCreationTaskBarHint(progress) },
      );
    }
    fetchMutation(clientMutationId);
    stopTaskBarAssist();
    const payrollIdForPoll = pendingNavigationPayrollIdRef.current
      || terminalPayrollIdRef.current
      || normalizePayrollId(getCreationPayrollId(progress));
    stopTaskBarAssistRef.current = startPayrollCreationTaskBarAssist(
      dispatch,
      clientMutationId,
      payrollIdForPoll,
      fetchMutation,
    );
  };

  const tryCompleteCreation = (payrollId) => {
    if (creationModalClosedRef.current || creationAbortedRef.current) return;

    const normalizedId = normalizePayrollId(payrollId || terminalPayrollIdRef.current);
    if (normalizedId) {
      terminalPayrollIdRef.current = normalizedId;
      pendingNavigationPayrollIdRef.current = normalizedId;
    }

    const progress = creationProgressRef.current;
    const mutationInFlight = submittingMutationRef.current;
    const mayClose = canCloseCreationUI(progress, mutationInFlight)
      || (normalizedId && canCloseCreationAfterMutationFallback(progress, mutationInFlight));
    if (!mayClose) {
      return;
    }

    creationModalClosedRef.current = true;
    stopCreationPolling();
    setCreationInProgress(false);
    setCreationOpen(false);
    toast.showSuccess(formatMessage('payroll.creation.success'));

    registerCreationTaskBar(progress);

    const resolvedId = pendingNavigationPayrollIdRef.current;
    pendingNavigationPayrollIdRef.current = null;
    terminalPayrollIdRef.current = null;

    if (!resolvedId) {
      if (creationClientMutationId) {
        fetchPayroll(modulesManager, [`clientMutationId: "${creationClientMutationId}"`]);
      }
      return;
    }

    navigateToPayroll(resolvedId);
    refreshPayrollData(resolvedId);
  };

  const handleCreationTerminal = (progress, ctx = {}) => {
    if (creationModalClosedRef.current || creationAbortedRef.current) return;

    const mutationInFlight = ctx.mutationInFlight ?? submittingMutationRef.current;
    const status = progress?.status;
    const progressPayrollId = getCreationPayrollId(progress);

    if (status === 'COMPLETED') {
      tryCompleteCreation(progressPayrollId);
      return;
    }
    if (status === 'FAILED' && (mutationInFlight || creationMutationSucceededRef.current)) {
      tryCompleteCreation(
        progressPayrollId
          ?? terminalPayrollIdRef.current
          ?? pendingNavigationPayrollIdRef.current
          ?? mutationRef.current?.id,
      );
      return;
    }
    if (status === 'CANCELLED') {
      creationAbortedRef.current = true;
      stopTaskBarAssist();
      stopCreationPolling();
      setCreationInProgress(false);
      setCreationOpen(false);
      toast.showWarning(formatMessage('payroll.creation.cancelled'));
      return;
    }
    if (status === 'STALE') {
      creationAbortedRef.current = true;
      stopTaskBarAssist();
      stopCreationPolling();
      setCreationInProgress(false);
      setCreationOpen(false);
      toast.showWarning(formatMessage('payroll.creation.stale'));
      return;
    }
    creationAbortedRef.current = true;
    stopTaskBarAssist();
    stopCreationPolling();
    setCreationInProgress(false);
    setCreationOpen(false);
    toast.showError(progress?.error || formatMessage('payroll.creation.failed'));
  };

  useEffect(() => {
    if (createPayrollFromFailedInvoices === PAYROLL_FROM_FAILED_INVOICES_URL_PARAM) {
      setIsPayrollFromFailedInvoices(true);
    }
  }, [createPayrollFromFailedInvoices, payrollUuid]);

  useEffect(() => {
    setPayrollUuid(statePayrollUuid ?? taskPayrollUuid);
    setIsInTask(!!taskPayrollUuid);
  }, [taskPayrollUuid, statePayrollUuid]);

  useEffect(() => {
    if (payrollUuid) {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
    }
  }, [payrollUuid]);

  useEffect(() => {
    if (confirmed && typeof confirmed === 'function') confirmedAction();
    return () => confirmed && clearConfirm(null);
  }, [confirmed]);

  useEffect(() => {
    if (prevSubmittingMutationRef.current && !submittingMutation) {
      if (mutation?.actionType !== ACTION_TYPE.CREATE_PAYROLL) {
        journalize(mutation);
      }
      if (mutation?.actionType === ACTION_TYPE.DELETE_PAYROLL) {
        back();
      }
      if (mutation?.actionType === ACTION_TYPE.CREATE_PAYROLL) {
        if (!mutation?.error && mutation?.id) {
          creationMutationSucceededRef.current = true;
          const createdId = normalizePayrollId(mutation.id);
          pendingNavigationPayrollIdRef.current = createdId;
          terminalPayrollIdRef.current = createdId;
        }
        if (creationInProgress && !creationModalClosedRef.current && !creationAbortedRef.current) {
          tryCompleteCreation(
            pendingNavigationPayrollIdRef.current
              || (mutation?.id ? normalizePayrollId(mutation.id) : null),
          );
        }
        if (!creationModalClosedRef.current && !creationAbortedRef.current && creationClientMutationId) {
          fetchPayroll(modulesManager, [`clientMutationId: "${creationClientMutationId}"`]);
        }
        setIsPayrollFromFailedInvoices(false);
      }
    }
  }, [submittingMutation]);

  useEffect(() => {
    submittingMutationRef.current = submittingMutation;
    prevSubmittingMutationRef.current = submittingMutation;
  }, [submittingMutation]);

  useEffect(() => {
    mutationRef.current = mutation;
  }, [mutation]);

  useEffect(() => {
    if (payroll) {
      setReadOnly(isPayrollFromFailedInvoices ? false : !!payroll?.id);
      if (isPayrollFromFailedInvoices) {
        setEditedPayroll({
          ...payroll, id: null, name: null, paymentCycle: null, status: null, fromFailedInvoicesPayrollId: payroll?.id,
        });
      } else {
        setEditedPayroll(payroll);
      }
      if (!payrollUuid && payroll?.id && !isPayrollFromFailedInvoices && !creationInProgress) {
        navigateToPayroll(payroll.id);
      }
      if (creationInProgress && creationClientMutationId && payroll?.id
        && !creationModalClosedRef.current && !creationAbortedRef.current) {
        const resolvedId = normalizePayrollId(payroll.id);
        pendingNavigationPayrollIdRef.current = resolvedId;
        terminalPayrollIdRef.current = resolvedId;
        tryCompleteCreation(resolvedId);
      }
    }
  }, [payroll]);

  useEffect(() => () => {
    stopCreationPolling();
    stopTaskBarAssist();
    clearPayroll();
  }, []);

  const mandatoryFieldsEmpty = () => {
    if (
      editedPayroll?.name
      && editedPayroll?.paymentPlan
      && editedPayroll?.paymentCycle
      && editedPayroll?.dateValidFrom
      && editedPayroll?.dateValidTo
      && editedPayroll?.paymentMethod
      && !editedPayroll?.isDeleted
    ) return false;
    return true;
  };

  const isNewPayrollSave = !payrollUuid || isPayrollFromFailedInvoices;

  const canSave = () => !mandatoryFieldsEmpty()
    && (!readOnly || isPayrollFromFailedInvoices)
    && !creationInProgress;

  const handleSave = () => {
    if (!isNewPayrollSave) {
      return;
    }

    const clientMutationId = generateClientMutationId();
    creationModalClosedRef.current = false;
    creationAbortedRef.current = false;
    creationTaskBarJournalizedRef.current = false;
    creationMutationSucceededRef.current = false;
    setCreationClientMutationId(clientMutationId);
    setCreationInProgress(true);
    setCreationOpen(true);
    updateCreationProgress({
      status: 'IN_PROGRESS',
      percent: 0,
      processedBeneficiaries: 0,
      totalBeneficiaries: 0,
    });
    terminalPayrollIdRef.current = null;
    pendingNavigationPayrollIdRef.current = null;

    stopCreationPollRef.current = startPayrollCreationPolling(
      dispatch,
      clientMutationId,
      {
        onProgress: (progress) => updateCreationProgress(progress),
        onTerminal: handleCreationTerminal,
        isMutationInFlight: () => submittingMutationRef.current,
      },
    );

    createPayroll(
      { ...editedPayroll, clientMutationId },
      formatMessageWithValues('payroll.mutation.create', mutationLabel(payroll)),
    ).catch(() => {
      // HTTP/GraphQL client error: backend may still be processing — keep polling.
      if (!creationModalClosedRef.current && !creationAbortedRef.current) {
        toast.showInfo(formatMessage('payroll.creation.tracking'));
      }
    });
  };

  const handleCreationCancel = () => {
    creationAbortedRef.current = true;
    stopTaskBarAssist();
    stopCreationPolling();
    setCreationInProgress(false);
    setCreationOpen(false);
    toast.showWarning(formatMessage('payroll.creation.cancelled'));
  };

  const actions = [];
  const paymentPlanName = editedPayroll?.paymentPlan?.name
    ?? editedPayroll?.paymentPlan?.code
    ?? '';

  return (
    rights.includes(RIGHT_PAYROLL_CREATE) && (
    <div className={classes.page}>
      <PayrollCreationProgressDialog
        open={creationOpen}
        progress={creationProgress}
        mutationInFlight={submittingMutation}
        payrollName={editedPayroll?.name}
        paymentPlanName={paymentPlanName}
        onCancel={handleCreationCancel}
      />
      <Form
        key={payrollUuid}
        module="payroll"
        title={formatMessageWithValues('payrollPage.title', pageTitle(payroll))}
        titleParams={pageTitle(payroll)}
        openDirty={isPayrollFromFailedInvoices ? true : !payrollUuid}
        benefitPlan={editedPayroll}
        edited={editedPayroll}
        onEditedChanged={setEditedPayroll}
        back={!isInTask && back}
        mandatoryFieldsEmpty={mandatoryFieldsEmpty}
        canSave={canSave}
        save={handleSave}
        HeadPanel={PayrollHeadPanel}
        Panels={[PayrollTab]}
        rights={rights}
        actions={actions}
        setConfirmedAction={setConfirmedAction}
        payrollUuid={payrollUuid}
        saveTooltip={formatMessage('tooltip.save')}
        isInTask={!!taskPayrollUuid}
        payroll={payroll}
        readOnly={readOnly || creationInProgress}
        isPayrollFromFailedInvoices={isPayrollFromFailedInvoices}
        benefitPlanId={benefitPlanId}
      />
    </div>
    )
  );
}

const mapDispatchToProps = (dispatch) => ({
  ...bindActionCreators({
    fetchPayroll,
    fetchBenefitConsumptions,
    createPayroll,
    clearPayroll,
    clearPayrollBills,
    coreConfirm,
    clearConfirm,
    journalize,
    fetchMutation,
  }, dispatch),
  dispatch,
});

const mapStateToProps = (state, props) => ({
  statePayrollUuid: props?.match?.params?.payroll_uuid === 'null' ? null : props?.match?.params.payroll_uuid,
  createPayrollFromFailedInvoices: props?.match?.params?.createPayrollFromFailedInvoices,
  benefitPlanId: props?.match?.params?.benefitPlanId,
  rights: state.core?.user?.i_user?.rights ?? [],
  confirmed: state.core.confirmed,
  submittingMutation: state.payroll.submittingMutation,
  mutation: state.payroll.mutation,
  payroll: state.payroll.payroll,
});

export default connect(mapStateToProps, mapDispatchToProps)(PayrollPage);
