/* eslint-disable max-len */
import React, { useCallback, useMemo, useState } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import CircularProgress from '@material-ui/core/CircularProgress';
import {
  useModulesManager,
  useTranslations,
  useHistory,
  useToast,
} from '@openimis/fe-core';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import {
  MODULE_NAME,
  PAYROLL_PAYROLL_ROUTE,
  PAYROLL_FROM_FAILED_INVOICES_URL_PARAM,
  PAYROLL_STATUS,
} from '../../../constants';
import {
  computeBenefitWorkflowState,
  getBenefitsFromPayroll,
} from '../../../utils/payrollWorkflow';
import downloadPayroll from '../../../utils/export';
import BenefitConsumptionSearcherModal from '../BenefitConsumptionSearcherModal';
import PayrollModalSummaryCards from '../PayrollModalSummaryCards';
import { fetchPayroll } from '../../../actions';
import { fetchPayrollReconciledModalThunk } from '../../../services/payrollApprovedPaymentModalService';

function PaymentReconcilationSummarytDialog({
  classes,
  payroll,
  payrollDetail,
  fetchPayroll,
  dispatch,
}) {
  const history = useHistory();
  const modulesManager = useModulesManager();
  const toast = useToast();
  const payrollUuid = payrollDetail?.id ?? null;
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const [isOpen, setIsOpen] = useState(false);
  const [modalSummary, setModalSummary] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const mergedPayroll = useMemo(
    () => ({ ...payroll, ...modalSummary }),
    [payroll, modalSummary],
  );

  const loadModalSummary = useCallback(() => {
    if (!payrollUuid) return Promise.resolve(null);
    return dispatch(fetchPayrollReconciledModalThunk(payrollUuid))
      .then((row) => {
        if (row) setModalSummary(row);
        return row;
      });
  }, [dispatch, payrollUuid]);

  const handleOpen = () => {
    setIsOpen(true);
    if (payrollUuid) {
      fetchPayroll(modulesManager, [`id: "${payrollUuid}"`]);
      loadModalSummary();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleCreatePaymentForFailedInvoice = () => {
    history.push(
      `/${modulesManager.getRef(PAYROLL_PAYROLL_ROUTE)}/${payrollDetail?.id}/${PAYROLL_FROM_FAILED_INVOICES_URL_PARAM}`,
    );
  };

  const benefits = getBenefitsFromPayroll(payroll);
  const { hasUnreconciledBenefits } = computeBenefitWorkflowState(benefits);
  const canCreateFailedInvoices = payrollDetail?.status === PAYROLL_STATUS.RECONCILED
    && hasUnreconciledBenefits;

  const downloadPayrollData = async (id, payrollName) => {
    setDownloading(true);
    try {
      await downloadPayroll(id, payrollName);
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
            width: '90%',
            maxWidth: '90%',
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
          <PayrollModalSummaryCards payroll={mergedPayroll} />
          <div
            style={{ backgroundColor: '#DFEDEF' }}
          >
            <BenefitConsumptionSearcherModal payrollUuid={payrollDetail.id} payrollDetail={payrollDetail} reconciledMode />
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
                onClick={handleCreatePaymentForFailedInvoice}
                variant="contained"
                color="primary"
                disabled={!canCreateFailedInvoices}
                title={
                  !canCreateFailedInvoices
                    ? formatMessage('payroll.summary.createPaymentForFailedInvoice.disabled')
                    : ''
                }
                style={{
                  margin: '0 16px',
                  marginBottom: '15px',
                }}
              >
                {formatMessage('payroll.summary.createPaymentForFailedInvoice')}
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
                {downloading && (
                  <CircularProgress size={16} style={{ marginRight: 8 }} />
                )}
                {downloading ? (formatMessage('payroll.summary.downloading') || 'Téléchargement...') : formatMessage('payroll.summary.download')}
              </Button>
            </div>
            <div style={{
              float: 'right',
              paddingRight: '16px',
            }}
            >
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
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  fetchPayroll,
}, dispatch);

export default connect(mapStateToProps, (dispatch) => ({
  ...mapDispatchToProps(dispatch),
  dispatch,
}))(PaymentReconcilationSummarytDialog);
