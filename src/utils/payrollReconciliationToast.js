function isJsonExtFlagTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function parseReconciliationLastSummary(raw) {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getReconciliationInProgress(payroll) {
  if (payroll?.reconciliationInProgress !== undefined && payroll?.reconciliationInProgress !== null) {
    return isJsonExtFlagTrue(payroll.reconciliationInProgress);
  }
  return false;
}

const CLOSE_BLOCKER_KEYS = {
  no_reconciled_benefit: 'payroll.workflow.blocker.noReconciledBenefit',
  missing_payment_report: 'payroll.reconciliation.close.error',
  reconciliation_locked: 'payroll.workflow.error.reconciliationLocked',
  reconciliation_in_progress: 'payroll.workflow.error.reconciliationInProgress',
};

export function formatClosePayrollBlockers(payroll, formatMessage) {
  let blockers = payroll?.closePayrollBlockers;
  if (!blockers) return '';
  if (typeof blockers === 'string') {
    try {
      blockers = JSON.parse(blockers);
    } catch {
      blockers = [blockers];
    }
  }
  const list = Array.isArray(blockers) ? blockers : [blockers];
  if (list.length === 0) return '';
  return list
    .map((code) => formatMessage(CLOSE_BLOCKER_KEYS[code] || code))
    .join(' · ');
}

export function getCanClosePayroll(payroll, clientFallback) {
  if (payroll?.canClosePayroll !== undefined && payroll?.canClosePayroll !== null) {
    return payroll.canClosePayroll === true || payroll.canClosePayroll === 'true';
  }
  return clientFallback;
}

export function notifyReconciliationCompleted(payroll, toast, formatMessage, formatMessageWithValues) {
  const summary = parseReconciliationLastSummary(payroll?.reconciliationLastSummary);
  const successCount = summary?.success_count
    ?? summary?.successCount
    ?? payroll?.reconciledBenefitCount
    ?? 0;
  const failureCount = summary?.failure_count ?? summary?.failureCount ?? 0;

  if (successCount > 0) {
    toast.showSuccess(
      formatMessageWithValues('payroll.workflow.toast.reconciliationCompleted', { count: successCount }),
    );
  } else if (failureCount > 0) {
    toast.showWarning(
      formatMessageWithValues('payroll.workflow.toast.reconciliationCompletedWithFailures', {
        failures: failureCount,
      }),
    );
  } else {
    toast.showWarning(formatMessage('payroll.workflow.toast.reconciliationCompletedNone'));
  }
}
