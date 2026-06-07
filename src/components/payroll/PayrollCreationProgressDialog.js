import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import {
  getCreationPercent,
  getCreationPhaseLabel,
  getCreationProcessedCount,
  getCreationProgressMessage,
  getCreationTotalCount,
  isAwaitingMutationEnd,
  isCreationFinalizing,
  isCreationFinalizingStatus,
} from '../../utils/payrollCreationProgress';

const useStyles = makeStyles(() => ({
  progress: {
    marginTop: 16,
    marginBottom: 8,
    height: 10,
    borderRadius: 4,
  },
  subtext: {
    color: '#666',
    marginTop: 8,
  },
}));

function PayrollCreationProgressDialog({
  open,
  progress,
  payrollName,
  paymentPlanName,
  mutationInFlight,
  onCancel,
}) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const processed = getCreationProcessedCount(progress);
  const total = getCreationTotalCount(progress);
  const backendPercent = getCreationPercent(progress);
  const status = progress?.status ?? 'IN_PROGRESS';
  const awaitingMutation = isAwaitingMutationEnd(progress, mutationInFlight);
  const backendFinalizing = isCreationFinalizingStatus(progress);
  const legacyFinalizing = isCreationFinalizing(progress) && !backendFinalizing;
  const showFullBarWithMessage = backendFinalizing || awaitingMutation || legacyFinalizing;
  const derivedPercent = total > 0
    ? Math.min(100, Math.round((processed / total) * 100))
    : backendPercent;
  const rawPercent = total > 0
    ? Math.max(backendPercent, derivedPercent)
    : backendPercent;
  const displayPercent = showFullBarWithMessage ? 100 : rawPercent;
  const showIndeterminateBar = showFullBarWithMessage;
  const showError = progress?.error
    && (status === 'FAILED' || status === 'CANCELLED' || status === 'STALE');

  const statusLabel = (() => {
    if (awaitingMutation) {
      return formatMessage('payroll.creation.status.awaitingMutation');
    }
    const phaseLabel = getCreationPhaseLabel(progress, formatMessage);
    if (phaseLabel) return phaseLabel;
    if (backendFinalizing || legacyFinalizing) {
      return getCreationProgressMessage(progress)
        || formatMessage('payroll.creation.status.finalizing');
    }
    const labels = {
      IN_PROGRESS: formatMessage('payroll.creation.status.inProgress'),
      FINALIZING: getCreationProgressMessage(progress)
        || formatMessage('payroll.creation.status.finalizing'),
      COMPLETED: formatMessage('payroll.creation.status.completed'),
      FAILED: formatMessage('payroll.creation.status.failed'),
      CANCELLED: formatMessage('payroll.creation.status.cancelled'),
      STALE: formatMessage('payroll.creation.status.stale'),
    };
    return labels[status] ?? status;
  })();

  return (
    <Dialog open={open} maxWidth="sm" fullWidth disableEscapeKeyDown>
      <DialogTitle>{formatMessage('payroll.creation.dialog.title')}</DialogTitle>
      <DialogContent>
        {paymentPlanName && (
          <Typography variant="body2" color="textSecondary">
            {formatMessageWithValues('payroll.creation.dialog.plan', { plan: paymentPlanName })}
          </Typography>
        )}
        {payrollName && (
          <Typography variant="body2" gutterBottom>
            {formatMessageWithValues('payroll.creation.dialog.payroll', { name: payrollName })}
          </Typography>
        )}
        <LinearProgress
          className={classes.progress}
          variant={showIndeterminateBar ? 'indeterminate' : 'determinate'}
          value={showIndeterminateBar ? undefined : displayPercent}
        />
        <Typography variant="body2">
          {formatMessageWithValues('payroll.creation.dialog.progress', {
            percent: displayPercent,
            processed,
            total,
          })}
        </Typography>
        <Typography className={classes.subtext} variant="caption">
          {statusLabel}
        </Typography>
        {showError && (
          <Typography color="error" variant="body2" style={{ marginTop: 8 }}>
            {progress.error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          color="default"
          disabled={status === 'COMPLETED' || status === 'IN_PROGRESS' || status === 'FINALIZING'}
        >
          {formatMessage('payroll.creation.dialog.dismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default PayrollCreationProgressDialog;
