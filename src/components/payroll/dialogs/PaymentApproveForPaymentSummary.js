/* eslint-disable max-len */
import React, { useEffect, useState } from 'react';
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
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MODULE_NAME, BENEFIT_CONSUMPTION_STATUS } from '../../../constants';
import {
  closePayroll, fetchPayroll, makePaymentForPayroll, rejectPayroll,
} from '../../../actions';
import { mutationLabel } from '../../../utils/string-utils';
import BenefitConsumptionSearcherModal from '../BenefitConsumptionSearcherModal';
import downloadPayroll from '../../../utils/export';
import { listPaymentReports } from '../../../services/paymentReportService';

function PaymentApproveForPaymentDialog({
  classes,
  payroll,
  closePayroll,
  rejectPayroll,
  payrollDetail,
  fetchPayroll,
  makePaymentForPayroll,
  submittingMutation,
  mutation,
}) {
  const modulesManager = useModulesManager();
  const [payrollUuid] = useState(payrollDetail?.id ?? null);
  const [isOpen, setIsOpen] = useState(false);
  const [totalBeneficiaries, setTotalBeneficiaries] = useState(0);
  const [selectedBeneficiaries, setSelectedBeneficiaries] = useState(0);
  const [approvedBeneficiaries, setApprovedBeneficiaries] = useState(0);
  const [totalBillAmount, setTotalBillAmount] = useState(0);
  const [totalReconciledBillAmount, setTotalReconciledBillAmount] = useState(0);
  const [paymentReports, setPaymentReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const toast = useToast();

  const handleOpen = async () => {
    if (payrollUuid) {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      // Load payment reports
      setLoadingReports(true);
      try {
        const reports = await listPaymentReports(payrollUuid);
        setPaymentReports(reports || []);
      } catch (error) {
        console.error('Error loading payment reports:', error);
        setPaymentReports([]);
      } finally {
        setLoadingReports(false);
      }
    }
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  // Handle backend error for payment_report.required_before_closing
  useEffect(() => {
    if (!submittingMutation && mutation?.error) {
      const errorMessage = mutation.error?.detail || mutation.error?.message || '';
      if (errorMessage.includes('payment_report.required_before_closing')) {
        toast.showError(formatMessage('payroll.reconciliation.close.error'));
        // Focus on Payment Reports tab - this would need to be passed as prop or handled differently
        // For now, we just show the error toast
      }
    }
  }, [submittingMutation, mutation]);

  useEffect(() => {
    if (isOpen && Object.keys(payroll).length > 0) {
      // Calculate total benefits and reconciled benefits
      const total = payroll.benefitConsumption.length;
      const selected = payroll.benefitConsumption.filter(
        (benefit) => benefit.status === BENEFIT_CONSUMPTION_STATUS.RECONCILED,
      ).length;
      const approved = payroll.benefitConsumption.filter(
        (benefit) => benefit.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT,
      ).length;

      setTotalBeneficiaries(total);
      setSelectedBeneficiaries(selected);
      setApprovedBeneficiaries(approved);

      let totalAmount = 0;
      let reconciledAmount = 0;
      if (payroll && payroll.benefitConsumption) {
        payroll.benefitConsumption.forEach((benefit) => {
          if (benefit.benefitAttachment && benefit.benefitAttachment.length > 0) {
            benefit.benefitAttachment.forEach((attachment) => {
              if (attachment.bill && attachment.bill.amountTotal) {
                totalAmount += parseFloat(attachment.bill.amountTotal);
                if (benefit.status === BENEFIT_CONSUMPTION_STATUS.RECONCILED) {
                  reconciledAmount += parseFloat(attachment.bill.amountTotal);
                }
              }
            });
          }
        });
      }
      setTotalBillAmount(totalAmount);
      setTotalReconciledBillAmount(reconciledAmount);
    }
  }, [isOpen, payroll]);

  const closePayrollCallback = () => {
    // Check if payment reports are loaded and available
    if (loadingReports || paymentReports.length === 0) {
      toast.showError(formatMessage('payroll.reconciliation.close.disabled'));
      return;
    }
    handleClose();
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
    handleClose();
    makePaymentForPayroll(
      payrollDetail,
      formatMessageWithValues('payroll.mutation.closeLabel', mutationLabel(payrollDetail)),
    );
  };

  const downloadPayrollData = async (payrollUuid, payrollName) => {
    setDownloading(true);
    try {
      await downloadPayroll(payrollUuid, payrollName);
      toast.showSuccess(formatMessage('payroll.summary.download.success') || 'Téléchargement réussi');
    } catch (error) {
      console.error('Error downloading reconciliation data:', error);
      toast.showError(
        error?.message || formatMessage('payroll.summary.download.error') || 'Erreur lors du téléchargement',
      );
    } finally {
      setDownloading(false);
    }
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
            width: '75%',
            maxWidth: '75%',
          },
        }}
      >
        <DialogTitle
          style={{
            marginTop: '10px',
          }}
        >
          {formatMessageWithValues('payroll.reconciliationSummary', { payrollName: payrollDetail.name })}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.selectedBeneficiaries')}
                </Typography>
                <Typography variant="body1">
                  {formatMessageWithValues('payroll.summary.beneficiariesCount', { selectedBeneficiaries, totalBeneficiaries })}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.totalAmountForInvoice')}
                </Typography>
                <Typography variant="body1">
                  {totalBillAmount}
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={4}>
              <Paper elevation={3} style={{ padding: '20px' }}>
                <Typography variant="h6" gutterBottom>
                  {formatMessage('payroll.summary.deliveredReconciliation')}
                </Typography>
                <Typography variant="body1">
                  {totalReconciledBillAmount}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
          <div
            style={{ backgroundColor: '#DFEDEF' }}
          >
            <BenefitConsumptionSearcherModal payrollUuid={payrollDetail.id} payrollDetail={payrollDetail} />
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
          <div style={{ maxWidth: '3000px' }}>
            <div style={{ float: 'left' }}>
              <Button
                onClick={() => closePayrollCallback(payrollDetail)}
                variant="contained"
                color="primary"
                disabled={
                  loadingReports ||
                  paymentReports.length === 0 ||
                  (payrollDetail.paymentMethod === 'StrategyOnlinePayment'
                    ? approvedBeneficiaries === 0
                    : selectedBeneficiaries === 0)
                }
                title={
                  loadingReports || paymentReports.length === 0
                    ? formatMessage('payroll.reconciliation.close.disabled')
                    : ''
                }
                style={{
                  margin: '0 16px',
                  marginBottom: '15px',
                }}
              >
                {formatMessage('payroll.summary.approveAndClose')}
              </Button>
              <Button
                onClick={() => downloadPayrollData(payrollDetail.id, payrollDetail.name)}
                variant="contained"
                color="primary"
                disabled={downloading}
                style={{
                  margin: '0 16px',
                  marginBottom: '15px',
                }}
              >
                {downloading ? (formatMessage('payroll.summary.downloading') || 'Téléchargement...') : formatMessage('payroll.summary.download')}
              </Button>
              <Button
                onClick={() => rejectPayrollCallback(payrollDetail)}
                variant="contained"
                color="primary"
                style={{
                  margin: '0 16px',
                  marginBottom: '15px',
                }}
              >
                {formatMessage('payroll.summary.reject')}
              </Button>
            </div>
            <div style={{
              float: 'right',
              paddingRight: '16px',
            }}
            >
              {payrollDetail.paymentMethod === 'StrategyOnlinePayment' && (
                <Button
                  onClick={() => makePaymentForPayrollCallback(payrollDetail)}
                  variant="contained"
                  color="primary"
                  style={{
                    margin: '0 16px',
                  }}
                >
                  {formatMessage('payroll.summary.makePayment')}
                </Button>
              )}
              <Button
                onClick={handleClose}
                variant="outlined"
                autoFocus
                style={{ margin: '0 16px' }}
              >
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
  rights: !!state.core && !!state.core.user && !!state.core.user.i_user ? state.core.user.i_user.rights : [],
  confirmed: state.core.confirmed,
  payroll: state.payroll.payroll,
  submittingMutation: state.payroll.submittingMutation,
  mutation: state.payroll.mutation,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  closePayroll,
  rejectPayroll,
  fetchPayroll,
  makePaymentForPayroll,
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(PaymentApproveForPaymentDialog);
