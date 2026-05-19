/* eslint-disable max-len */
import React, { useEffect, useState, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import {
  useModulesManager,
  useTranslations,
  useToast,
} from '@openimis/fe-core';
import {
  Paper,
  Grid,
  Typography,
  Box,
  CircularProgress,
} from '@material-ui/core';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  MODULE_NAME,
  BENEFIT_CONSUMPTION_STATUS,
  PAYROLL_STATUS,
  PAYROLL_WORKFLOW_POLL_INTERVAL_MS,
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
import downloadPayroll from '../../../utils/export';
import { listPaymentReports, uploadPaymentReport } from '../../../services/paymentReportService';
import { fetchPayrollReconciliationTasksThunk } from '../../../services/payrollTaskService';
import {
  computeOnlineWorkflowButtons,
  getBenefitsFromPayroll,
  getPayrollWorkflowFlags,
} from '../../../utils/payrollWorkflow';
import { getPayrollBackendErrorMessage } from '../../../utils/payrollBackendErrors';
import {
  getReconciliationInProgress,
  notifyReconciliationCompleted,
} from '../../../utils/payrollReconciliationToast';

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
}) {
  const modulesManager = useModulesManager();
  const toast = useToast();
  const [payrollUuid] = useState(payrollDetail?.id ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [totalBeneficiaries, setTotalBeneficiaries] = useState(0);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState(0);
  const [totalBillAmount, setTotalBillAmount] = useState(0);
  const [totalReconciledBillAmount, setTotalReconciledBillAmount] = useState(0);
  const [paymentReports, setPaymentReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [reconciliationTasks, setReconciliationTasks] = useState([]);
  const [awaitingBenefitsAfterPayment, setAwaitingBenefitsAfterPayment] = useState(false);
  const [awaitingReconciliationEnd, setAwaitingReconciliationEnd] = useState(false);
  const prevSubmittingMutationRef = useRef();
  const reconciliationPollRef = useRef({
    inProgress: false,
    completedAt: null,
    completionToastShownFor: null,
  });

  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const benefitsFromPayroll = getBenefitsFromPayroll(payroll);
  const benefits = (benefitConsumptions?.length > 0 ? benefitConsumptions : benefitsFromPayroll);
  const mergedPayroll = { ...payrollDetail, ...payroll, benefitConsumption: benefits };
  const workflow = computeOnlineWorkflowButtons({
    payroll: mergedPayroll,
    tasks: reconciliationTasks,
    paymentReportsCount: paymentReports.length,
    benefits,
    formatMessage,
  });

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

  const refreshWorkflowState = () => {
    if (payrollUuid) {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      loadBenefitConsumptions();
      loadPaymentReports();
      loadReconciliationTasks();
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    refreshWorkflowState();
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  useEffect(() => {
    if (workflow.hasApproveForPayment && awaitingBenefitsAfterPayment) {
      setAwaitingBenefitsAfterPayment(false);
    }
  }, [workflow.hasApproveForPayment, awaitingBenefitsAfterPayment]);

  useEffect(() => {
    if (!workflow.reconciliationBusy && awaitingReconciliationEnd) {
      setAwaitingReconciliationEnd(false);
    }
  }, [workflow.reconciliationBusy, awaitingReconciliationEnd]);

  useEffect(() => {
    if (!isOpen || !payroll?.id) return;
    const inProgress = getReconciliationInProgress(mergedPayroll)
      || getPayrollWorkflowFlags(mergedPayroll).reconciliationInProgress;
    const completedAt = mergedPayroll.reconciliationLastCompletedAt ?? null;
    const prev = reconciliationPollRef.current;

    const reconciliationJustFinished = (
      (prev.inProgress && !inProgress)
      || (awaitingReconciliationEnd && !inProgress)
    ) && completedAt && completedAt !== prev.completedAt;

    if (
      reconciliationJustFinished
      && reconciliationPollRef.current.completionToastShownFor !== completedAt
    ) {
      notifyReconciliationCompleted(mergedPayroll, toast, formatMessage, formatMessageWithValues);
      reconciliationPollRef.current.completionToastShownFor = completedAt;
      loadBenefitConsumptions();
    }

    reconciliationPollRef.current = {
      ...reconciliationPollRef.current,
      inProgress,
      completedAt: completedAt ?? prev.completedAt,
    };
  }, [
    isOpen,
    payroll?.id,
    payroll?.reconciliationInProgress,
    payroll?.reconciliationLastCompletedAt,
    payroll?.reconciliationLastSummary,
    payroll?.reconciledBenefitCount,
    payroll?.canClosePayroll,
  ]);

  useEffect(() => {
    if (!isOpen || !payrollUuid) return undefined;
    const { paymentInProgress } = getPayrollWorkflowFlags(payroll);
    const shouldPoll = paymentInProgress
      || workflow.reconciliationBusy
      || awaitingBenefitsAfterPayment
      || awaitingReconciliationEnd;
    if (!shouldPoll) return undefined;
    const interval = setInterval(() => {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      loadBenefitConsumptions();
      loadReconciliationTasks();
    }, PAYROLL_WORKFLOW_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [
    isOpen,
    payrollUuid,
    payroll?.jsonExt,
    awaitingBenefitsAfterPayment,
    awaitingReconciliationEnd,
    workflow.reconciliationBusy,
  ]);

  useEffect(() => {
    if (!isOpen || Object.keys(payroll).length === 0) return;
    const total = benefits.length;
    const selected = benefits.filter(
      (benefit) => benefit.status === BENEFIT_CONSUMPTION_STATUS.RECONCILED,
    ).length;
    setTotalBeneficiaries(total);
    setSelectedBeneficiaries(selected);

    let totalAmount = 0;
    let reconciledAmount = 0;
    benefits.forEach((benefit) => {
      if (benefit.benefitAttachment?.length > 0) {
        benefit.benefitAttachment.forEach((attachment) => {
          if (attachment.bill?.amountTotal) {
            totalAmount += parseFloat(attachment.bill.amountTotal);
            if (benefit.status === BENEFIT_CONSUMPTION_STATUS.RECONCILED) {
              reconciledAmount += parseFloat(attachment.bill.amountTotal);
            }
          }
        });
      }
    });
    setTotalBillAmount(totalAmount);
    setTotalReconciledBillAmount(reconciledAmount);
  }, [isOpen, payroll, benefits.length]);

  useEffect(() => {
    if (prevSubmittingMutationRef.current && !submittingMutation) {
      if (mutation?.error) {
        toast.showError(getPayrollBackendErrorMessage(mutation.error, formatMessage));
      } else if (mutation?.actionType === ACTION_TYPE.MAKE_PAYMENT_PAYROLL) {
        toast.showSuccess(formatMessage('payroll.workflow.success.paymentSent'));
        setAwaitingBenefitsAfterPayment(true);
        refreshWorkflowState();
      } else if (mutation?.actionType === ACTION_TYPE.TRIGGER_PAYROLL_RECONCILIATION) {
        setAwaitingReconciliationEnd(true);
        reconciliationPollRef.current.inProgress = true;
        refreshWorkflowState();
      } else if (mutation?.actionType === ACTION_TYPE.CLOSE_PAYROLL) {
        toast.showSuccess(formatMessage('payroll.workflow.success.approveAndClose'));
        refreshWorkflowState();
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
    makePaymentForPayroll(
      payrollDetail,
      formatMessageWithValues('payroll.mutation.makePaymentLabel', mutationLabel(payrollDetail)),
    );
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
    toast.showInfo(formatMessage('payroll.workflow.toast.reconciliationInProgress'));
    reconciliationPollRef.current.inProgress = true;
    triggerPayrollReconciliation(
      payrollDetail,
      formatMessageWithValues('payroll.mutation.triggerReconciliationLabel', mutationLabel(payrollDetail)),
    );
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
    if (workflow.reconciliationBusy) {
      return formatMessage('payroll.workflow.error.reconciliationInProgress');
    }
    if (!workflow.hasPendingReconciliation && !workflow.hasReconciliationFailure) {
      if (awaitingBenefitsAfterPayment || workflow.paymentInProgress) {
        return formatMessage('payroll.workflow.hint.waitingForApproveForPayment');
      }
      return formatMessage('payroll.workflow.hint.noApproveForPaymentBenefits');
    }
    return '';
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
          {(workflow.paymentInProgress || workflow.reconciliationBusy) && (
            <Box display="flex" alignItems="center" mb={2} p={1} style={{ backgroundColor: '#fff8e1' }}>
              <CircularProgress size={20} style={{ marginRight: 12 }} />
              <Typography variant="body2">
                {workflow.paymentInProgress
                  ? formatMessage('payroll.workflow.status.paymentInProgress')
                  : formatMessage('payroll.workflow.status.reconciliationInProgress')}
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
          {awaitingBenefitsAfterPayment && !workflow.hasApproveForPayment && (
            <Box mb={2} p={1} style={{ backgroundColor: '#e8f5e9' }}>
              <Typography variant="body2">
                {formatMessage('payroll.workflow.hint.waitingForApproveForPayment')}
              </Typography>
            </Box>
          )}
          {!workflow.canApproveAndClose && workflow.closePayrollBlockersMessage && (
            <Box mb={2} p={1} style={{ backgroundColor: '#fff3e0' }}>
              <Typography variant="body2">
                {workflow.closePayrollBlockersMessage}
              </Typography>
            </Box>
          )}
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.selectedBeneficiaries')}
                </Typography>
                <Typography variant="body1">
                  {formatMessageWithValues('payroll.summary.beneficiariesCount', {
                    selectedBeneficiaries,
                    totalBeneficiaries,
                  })}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.totalAmountForInvoice')}
                </Typography>
                <Typography variant="body1">{totalBillAmount}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.deliveredReconciliation')}
                </Typography>
                <Typography variant="body1">{totalReconciledBillAmount}</Typography>
              </Paper>
            </Grid>
          </Grid>
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
                    disabled={!workflow.canMakePayment || submittingMutation}
                    style={{ margin: '0 16px', marginBottom: '15px' }}
                  >
                    {formatMessage('payroll.summary.makePayment')}
                  </Button>
                  <Button
                    onClick={triggerReconciliationCallback}
                    variant="contained"
                    color="primary"
                    disabled={!workflow.canTriggerReconciliation || submittingMutation}
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
}, dispatch);

export default connect(mapStateToProps, (dispatch) => ({
  ...mapDispatchToProps(dispatch),
  dispatch,
}))(PaymentApproveForPaymentDialog);
