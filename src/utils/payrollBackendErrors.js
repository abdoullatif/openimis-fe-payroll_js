const BACKEND_ERROR_MAP = [
  {
    match: 'Payment is already in progress for this payroll',
    key: 'payroll.workflow.error.paymentInProgress',
  },
  {
    match: 'Reconciliation is already in progress for this payroll',
    key: 'payroll.workflow.error.reconciliationInProgress',
  },
  {
    match: 'Reconciliation is locked: Accept and Close has already been triggered for this payroll',
    key: 'payroll.workflow.error.reconciliationLocked',
  },
  {
    match: 'At least one benefit must be reconciled before Accept and Close',
    key: 'payroll.workflow.error.noReconciledBenefit',
  },
  {
    match: 'payment_report.required_before_closing',
    key: 'payroll.reconciliation.close.error',
  },
  {
    match: 'At least one reconciliation close task already exists for this payroll',
    key: 'payroll.workflow.error.closeTaskExists',
  },
  {
    match: 'Payroll payment method must be StrategyOnlinePayment',
    key: 'payroll.workflow.error.onlineOnly',
  },
];

export function getPayrollBackendErrorTranslationKey(error) {
  const message = error?.detail || error?.message || (typeof error === 'string' ? error : '');
  if (!message) return null;
  const found = BACKEND_ERROR_MAP.find(({ match }) => message.includes(match));
  return found?.key ?? null;
}

export function getPayrollBackendErrorMessage(error, formatMessage) {
  const key = getPayrollBackendErrorTranslationKey(error);
  if (key) return formatMessage(key);
  return error?.detail || error?.message || formatMessage('payroll.workflow.error.generic');
}
