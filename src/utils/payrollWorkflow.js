import {
  BENEFIT_CONSUMPTION_STATUS,
  PAYROLL_RECONCILIATION_BUSINESS_EVENT,
  PAYROLL_STATUS,
  PAYMENT_METHOD_ONLINE,
  RECONCILIATION_LOCK_TASK_STATUSES,
} from '../constants';
import {
  formatClosePayrollBlockers,
  getCanClosePayroll,
  getReconciliationInProgress,
} from './payrollReconciliationToast';

export function parsePayrollJsonExt(jsonExt) {
  if (!jsonExt) return {};
  if (typeof jsonExt === 'object' && !Array.isArray(jsonExt)) return jsonExt;
  try {
    return JSON.parse(jsonExt);
  } catch {
    return {};
  }
}

export function parseBenefitJsonExt(jsonExt) {
  return parsePayrollJsonExt(jsonExt);
}

/** jsonExt flags may be boolean or string from the API */
export function isJsonExtFlagTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function getPayrollWorkflowFlags(payroll) {
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  const reconciliationInProgress = getReconciliationInProgress(payroll)
    || isJsonExtFlagTrue(ext.reconciliation_in_progress);
  return {
    paymentInProgress: isJsonExtFlagTrue(ext.payment_in_progress),
    reconciliationInProgress,
  };
}

export function getBenefitsFromPayroll(payroll) {
  return payroll?.benefitConsumption ?? [];
}

export function computeBenefitWorkflowState(benefits) {
  const list = Array.isArray(benefits) ? benefits : [];
  const hasReconciledBenefit = list.some(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.RECONCILED,
  );
  const hasAcceptedBenefit = list.some(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.ACCEPTED,
  );
  const hasApproveForPayment = list.some(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT,
  );
  const hasReconciliationFailure = list.some((b) => {
    const ext = parseBenefitJsonExt(b.jsonExt);
    const gatewayFailed = ext.gateway_reconciliation_success === false
      || ext.gateway_reconciliation_success === 'false';
    return b.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT && gatewayFailed;
  });
  /** Factures encore éligibles à une relance de réconciliation (pull) */
  const hasPendingReconciliation = list.some(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT,
  );
  const hasUnreconciledBenefits = list.some(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT
      || (b.status !== BENEFIT_CONSUMPTION_STATUS.RECONCILED
        && b.status !== BENEFIT_CONSUMPTION_STATUS.REJECTED
        && b.status !== BENEFIT_CONSUMPTION_STATUS.DUPLICATE),
  );
  return {
    hasReconciledBenefit,
    hasAcceptedBenefit,
    hasApproveForPayment,
    hasReconciliationFailure,
    hasPendingReconciliation,
    hasUnreconciledBenefits,
  };
}

export function isReconciliationLocked(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return false;
  return tasks.some(
    (t) => t.businessEvent === PAYROLL_RECONCILIATION_BUSINESS_EVENT
      && RECONCILIATION_LOCK_TASK_STATUSES.includes(t.status),
  );
}

export function isOnlinePayroll(payroll) {
  return payroll?.paymentMethod === PAYMENT_METHOD_ONLINE;
}

export function computeOnlineWorkflowButtons({
  payroll,
  tasks,
  paymentReportsCount,
  benefits,
  formatMessage,
}) {
  const { paymentInProgress, reconciliationInProgress } = getPayrollWorkflowFlags(payroll);
  const reconciliationLocked = isReconciliationLocked(tasks);
  const {
    hasReconciledBenefit,
    hasAcceptedBenefit,
    hasApproveForPayment,
    hasReconciliationFailure,
    hasPendingReconciliation,
    hasUnreconciledBenefits,
  } = computeBenefitWorkflowState(benefits);
  const isOnline = isOnlinePayroll(payroll);
  const status = payroll?.status;

  // Après une réconciliation partielle, le backend peut laisser reconciliation_in_progress
  // à true alors que des résultats sont déjà visibles → autoriser la relance.
  const partialReconciliationDone = hasReconciledBenefit
    && (hasPendingReconciliation || hasReconciliationFailure);
  const reconciliationBusy = reconciliationInProgress && !partialReconciliationDone;

  const canMakePayment = isOnline
    && status === PAYROLL_STATUS.APPROVE_FOR_PAYMENT
    && !paymentInProgress
    && !reconciliationLocked
    && hasAcceptedBenefit;

  const canTriggerReconciliation = isOnline
    && !reconciliationLocked
    && !reconciliationBusy
    && (hasPendingReconciliation || hasReconciliationFailure);

  const clientCanApproveAndClose = !reconciliationLocked
    && !reconciliationInProgress
    && hasReconciledBenefit
    && paymentReportsCount > 0
    && status !== PAYROLL_STATUS.RECONCILED;
  const canApproveAndClose = getCanClosePayroll(payroll, clientCanApproveAndClose);
  const closePayrollBlockersMessage = formatMessage
    ? formatClosePayrollBlockers(payroll, formatMessage)
    : '';

  const canCreateFailedInvoicesPayment = (status === PAYROLL_STATUS.RECONCILED || reconciliationLocked)
    && hasUnreconciledBenefits;

  const reconciledCountFromBackend = payroll?.reconciledBenefitCount;

  return {
    paymentInProgress,
    reconciliationInProgress,
    reconciliationBusy,
    reconciliationLocked,
    canMakePayment,
    canTriggerReconciliation,
    canApproveAndClose,
    closePayrollBlockersMessage,
    canCreateFailedInvoicesPayment,
    reconciledCountFromBackend,
    hasReconciledBenefit,
    hasAcceptedBenefit,
    hasApproveForPayment,
    hasReconciliationFailure,
    hasPendingReconciliation,
    hasUnreconciledBenefits,
  };
}

export function benefitHasGatewayReconciliationFailure(benefit) {
  const ext = parseBenefitJsonExt(benefit?.jsonExt);
  const gatewayFailed = ext.gateway_reconciliation_success === false
    || ext.gateway_reconciliation_success === 'false';
  return benefit?.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT && gatewayFailed;
}
