import React from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../../constants';
import { formatOperationProgressMessage } from '../../../utils/payrollModalPollStop';
import { parsePayrollProgress } from '../../../utils/payrollOperationProgress';

const useStyles = makeStyles(() => ({
  content: {
    minWidth: 420,
    paddingTop: 8,
  },
  progressBar: {
    marginTop: 16,
    marginBottom: 8,
    height: 8,
    borderRadius: 4,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 8,
  },
  spinner: {
    marginRight: 12,
  },
  fileName: {
    color: '#666',
    marginTop: 4,
  },
  error: {
    color: '#c62828',
    marginTop: 8,
  },
}));

function getReconciliationPercent(progress) {
  const parsed = parsePayrollProgress(progress);
  if (!parsed) return null;
  if (parsed.percent != null) return Math.min(100, Math.max(0, Number(parsed.percent)));
  const processed = parsed.processedBeneficiaries;
  const total = parsed.totalBeneficiaries;
  if (processed != null && total != null && total > 0) {
    return Math.min(100, Math.round((processed / total) * 100));
  }
  return null;
}

function PayrollReconciliationFileProcessingDialog({
  open,
  phase = 'uploading',
  fileName = '',
  progressPayroll = null,
  errorMessage = null,
  onClose,
}) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const reconciliationProgress = progressPayroll?.reconciliationProgress
    ?? parsePayrollProgress(progressPayroll?.reconciliationProgress);
  const percent = getReconciliationPercent(reconciliationProgress);
  const isError = phase === 'error';
  const isUploading = phase === 'uploading';
  const progressMessage = formatOperationProgressMessage(
    reconciliationProgress,
    formatMessage,
    formatMessageWithValues,
  );

  const title = isError
    ? formatMessage('payroll.reconciliationFile.processing.errorTitle')
    : formatMessage('payroll.reconciliationFile.processing.title');

  const statusMessage = (() => {
    if (isError) return null;
    if (isUploading) {
      return formatMessage('payroll.reconciliationFile.processing.uploading');
    }
    return progressMessage
      || formatMessage('payroll.operation.reconciliation.title');
  })();

  return (
    <Dialog
      open={open}
      onClose={isError ? onClose : undefined}
      disableBackdropClick={!isError}
      disableEscapeKeyDown={!isError}
      PaperProps={{ style: { minWidth: 480 } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent className={classes.content}>
        {fileName ? (
          <Typography variant="body2" className={classes.fileName}>
            {formatMessageWithValues('payroll.reconciliationFile.processing.file', { fileName })}
          </Typography>
        ) : null}
        {!isError && (
          <>
            <div className={classes.statusRow}>
              <CircularProgress size={22} className={classes.spinner} />
              <Typography variant="body2">{statusMessage}</Typography>
            </div>
            {!isUploading && percent != null && (
              <LinearProgress
                className={classes.progressBar}
                variant="determinate"
                value={percent}
              />
            )}
            {isUploading && (
              <LinearProgress className={classes.progressBar} />
            )}
          </>
        )}
        {isError && (
          <Typography variant="body2" className={classes.error}>
            {errorMessage || formatMessage('payroll.reconciliationFile.processing.errorGeneric')}
          </Typography>
        )}
      </DialogContent>
      {isError && (
        <DialogActions>
          <Button onClick={onClose} color="primary" variant="contained">
            {formatMessage('payroll.summary.close')}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

export default PayrollReconciliationFileProcessingDialog;
