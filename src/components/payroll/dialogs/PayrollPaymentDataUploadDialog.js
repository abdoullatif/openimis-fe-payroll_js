import React, { useEffect, useRef, useState } from 'react';
import { Input, Grid } from '@material-ui/core';
import { injectIntl } from 'react-intl';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import {
  apiHeaders,
  baseApiUrl,
  formatMessage,
  formatMessageWithValues,
  useModulesManager,
  useToast,
} from '@openimis/fe-core';
import { withTheme, withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { MODULE_NAME } from '../../../constants';
import { fetchPayroll } from '../../../actions';
import { startPayrollModalProgressPolling } from '../../../services/payrollApprovedPaymentPollingService';
import { notifyReconciliationCompleted } from '../../../utils/payrollReconciliationToast';
import { getPayrollBackendErrorMessage } from '../../../utils/payrollBackendErrors';
import PayrollReconciliationFileProcessingDialog from './PayrollReconciliationFileProcessingDialog';

const styles = (theme) => ({
  item: theme.paper.item,
});

function PayrollPaymentDataUploadDialog({
  intl,
  classes,
  payrollUuid,
  dispatch,
  fetchPayroll: fetchPayrollAction,
}) {
  const modulesManager = useModulesManager();
  const toast = useToast();
  const stopPollRef = useRef(null);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [forms, setForms] = useState({});
  const [processingOpen, setProcessingOpen] = useState(false);
  const [processingPhase, setProcessingPhase] = useState('uploading');
  const [processingFileName, setProcessingFileName] = useState('');
  const [progressPayroll, setProgressPayroll] = useState(null);
  const [processingError, setProcessingError] = useState(null);

  useEffect(() => () => {
    stopPollRef.current?.();
  }, []);

  const stopPolling = () => {
    stopPollRef.current?.();
    stopPollRef.current = null;
  };

  const refreshPayroll = () => {
    if (!payrollUuid) return;
    fetchPayrollAction(modulesManager, [`id: "${payrollUuid}"`]);
  };

  const closeProcessing = () => {
    stopPolling();
    setProcessingOpen(false);
    setProcessingPhase('uploading');
    setProgressPayroll(null);
    setProcessingError(null);
    setProcessingFileName('');
  };

  const handleTerminal = (row, decision) => {
    const status = row?.reconciliationProgress?.status;
    if (status === 'FAILED') {
      toast.showError(
        row?.reconciliationProgress?.error
        || formatMessage(intl, MODULE_NAME, 'payroll.operation.failed'),
      );
    } else if (decision?.reason === 'ghost') {
      toast.showError(formatMessage(intl, MODULE_NAME, 'payroll.operation.failed'));
    } else {
      notifyReconciliationCompleted(
        row,
        toast,
        (id) => formatMessage(intl, MODULE_NAME, id),
        (id, values) => formatMessageWithValues(intl, MODULE_NAME, id, values),
      );
    }
    refreshPayroll();
    closeProcessing();
  };

  const startReconciliationPolling = () => {
    stopPolling();
    stopPollRef.current = startPayrollModalProgressPolling(dispatch, payrollUuid, {
      operation: 'reconciliation',
      onProgress: (row) => {
        setProcessingPhase('processing');
        setProgressPayroll(row);
      },
      onTerminal: handleTerminal,
      onStop: stopPolling,
    });
  };

  const finishAfterUpload = () => {
    setProcessingPhase('processing');
    startReconciliationPolling();
  };

  const handleOpen = () => {
    setIsUploadOpen(true);
  };

  const handleCloseUpload = () => {
    setForms({});
    setIsUploadOpen(false);
  };

  const handleFieldChange = (formName, fieldName, value) => {
    setForms({
      ...forms,
      [formName]: {
        ...(forms[formName] ?? {}),
        [fieldName]: value,
      },
    });
  };

  const onSubmit = async (values) => {
    if (!values?.file || !payrollUuid) return;

    const file = values.file;
    setProcessingFileName(file.name);
    setProcessingError(null);
    setProgressPayroll(null);
    setProcessingPhase('uploading');
    handleCloseUpload();
    setProcessingOpen(true);

    const formData = new FormData();
    formData.append('file', file);

    const urlImport = `${baseApiUrl}/payroll/csv_reconciliation/?payroll_id=${encodeURIComponent(payrollUuid)}`;

    try {
      const response = await fetch(urlImport, {
        headers: apiHeaders,
        body: formData,
        method: 'POST',
        credentials: 'same-origin',
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.status >= 400) {
        const message = payload?.error
          || payload?.detail
          || `${response.status} ${response.statusText}`;
        throw new Error(message);
      }

      finishAfterUpload();
    } catch (error) {
      setProcessingPhase('error');
      setProcessingError(
        getPayrollBackendErrorMessage(error, (id) => formatMessage(intl, MODULE_NAME, id))
        || error?.message
        || formatMessage(intl, MODULE_NAME, 'payroll.reconciliationFile.processing.errorGeneric'),
      );
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="outlined"
        color="#DFEDEF"
        className={classes.button}
        style={{
          border: '0px',
          marginTop: '6px',
        }}
        disabled={processingOpen}
      >
        {formatMessage(intl, MODULE_NAME, 'payroll.paymentData.upload.label')}
      </Button>
      <Dialog
        open={isUploadOpen}
        onClose={handleCloseUpload}
        PaperProps={{
          style: {
            width: 600,
            maxWidth: 1000,
          },
        }}
      >
        <form noValidate>
          <DialogTitle style={{ marginTop: '10px' }}>
            {formatMessage(intl, MODULE_NAME, 'payroll.paymentData.upload.label')}
          </DialogTitle>
          <DialogContent>
            <div style={{ backgroundColor: '#DFEDEF', paddingLeft: '10px', paddingBottom: '10px' }}>
              <Grid item>
                <Grid container spacing={4} direction="column">
                  <Grid item>
                    <Input
                      onChange={(event) => handleFieldChange('paymentData', 'file', event.target.files[0])}
                      required
                      id="import-button"
                      inputProps={{
                        accept: '.csv, application/csv, text/csv',
                      }}
                      type="file"
                    />
                  </Grid>
                </Grid>
              </Grid>
            </div>
          </DialogContent>
          <DialogActions
            style={{
              display: 'inline',
              paddingLeft: '10px',
              marginTop: '25px',
              marginBottom: '15px',
            }}
          >
            <div style={{ maxWidth: '1000px' }}>
              <div style={{ float: 'left' }}>
                <Button
                  onClick={handleCloseUpload}
                  variant="outlined"
                  autoFocus
                  style={{
                    margin: '0 16px',
                    marginBottom: '15px',
                  }}
                >
                  {formatMessage(intl, MODULE_NAME, 'payroll.benefitConsumption.cancel')}
                </Button>
              </div>
              <div style={{ float: 'right', paddingRight: '16px' }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onSubmit(forms.paymentData)}
                  disabled={!(forms.paymentData?.file && payrollUuid) || processingOpen}
                >
                  {formatMessage(intl, MODULE_NAME, 'payroll.paymentData.upload.label')}
                </Button>
              </div>
            </div>
          </DialogActions>
        </form>
      </Dialog>
      <PayrollReconciliationFileProcessingDialog
        open={processingOpen}
        phase={processingPhase}
        fileName={processingFileName}
        progressPayroll={progressPayroll}
        errorMessage={processingError}
        onClose={closeProcessing}
      />
    </>
  );
}

const mapStateToProps = (state) => ({
  rights: !!state.core && !!state.core.user && !!state.core.user.i_user ? state.core.user.i_user.rights : [],
  confirmed: state.core.confirmed,
});

const mapDispatchToProps = (dispatch) => ({
  dispatch,
  ...bindActionCreators({
    fetchPayroll,
  }, dispatch),
});

export default injectIntl(
  withTheme(
    withStyles(styles)(
      connect(mapStateToProps, mapDispatchToProps)(PayrollPaymentDataUploadDialog),
    ),
  ),
);
