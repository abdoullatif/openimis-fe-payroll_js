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
} from './payrollReconciliationToast';
import {
  isPaymentActivelyRunning,
  isReconciliationActivelyRunning,
  parsePayrollProgress,
  shouldStartPollingPayment,
  shouldStartPollingReconciliation,
} from './payrollOperationProgress';

function isFlagTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

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
  const reconciliationLocked = payroll?.reconciliationLocked !== undefined && payroll?.reconciliationLocked !== null
    ? isJsonExtFlagTrue(payroll.reconciliationLocked)
    : isJsonExtFlagTrue(ext.reconciliation_locked);
  return {
    paymentInProgress: isPaymentActivelyRunning(payroll)
      || (isFlagTrue(payroll?.paymentInProgress) && shouldStartPollingPayment(payroll)),
    reconciliationInProgress: isReconciliationActivelyRunning(payroll)
      || (isFlagTrue(payroll?.reconciliationInProgress) && shouldStartPollingReconciliation(payroll)),
    reconciliationLocked,
  };
}

export function getBenefitsFromPayroll(payroll) {
  return payroll?.benefitConsumption ?? [];
}

export function hasBenefitStatusCounts(statusCounts) {
  return statusCounts
    && typeof statusCounts === 'object'
    && Object.keys(statusCounts).length > 0;
}

export function computeBenefitWorkflowStateFromCounts(statusCounts) {
  if (!hasBenefitStatusCounts(statusCounts)) return null;
  const count = (key) => Number(statusCounts[key] ?? 0);
  const accepted = count('ACCEPTED');
  const approveForPayment = count('APPROVE_FOR_PAYMENT');
  const reconciled = count('RECONCILED');
  return {
    hasReconciledBenefit: reconciled > 0,
    hasAcceptedBenefit: accepted > 0,
    hasApproveForPayment: approveForPayment > 0,
    hasReconciliationFailure: false,
    hasPendingReconciliation: approveForPayment > 0,
    hasUnreconciledBenefits: approveForPayment > 0 || accepted > 0,
  };
}

/**
 * Nombre de lignes encore APPROVE_FOR_PAYMENT (source fiable pour le bouton réconciliation).
 */
export function getApproveForPaymentCount(payroll, statusCounts = null) {
  if (hasBenefitStatusCounts(statusCounts)) {
    const fromCounts = Number(statusCounts.APPROVE_FOR_PAYMENT ?? 0);
    if (Number.isFinite(fromCounts)) return fromCounts;
  }

  const reconciliationProgress = parsePayrollProgress(payroll?.reconciliationProgress);
  if (reconciliationProgress?.remainingApproveForPayment != null) {
    return reconciliationProgress.remainingApproveForPayment;
  }

  const summary = payroll?.paymentApprovedModalSummary
    ?? payroll?.paymentReconciledModalSummary;
  if (summary?.nonReconciledCount != null) {
    return summary.nonReconciledCount;
  }

  const list = getBenefitsFromPayroll(payroll);
  return list.filter(
    (b) => b.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT,
  ).length;
}

export function computeBenefitWorkflowState(benefits, statusCounts = null) {
  const fromCounts = computeBenefitWorkflowStateFromCounts(statusCounts);
  if (fromCounts) return fromCounts;

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
  const hasReconciliationFailure = list.some((b) => benefitHasGatewayReconciliationFailure(b));
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
  statusCounts,
  formatMessage,
}) {
  const { paymentInProgress, reconciliationInProgress, reconciliationLocked: lockedFromPayroll } = getPayrollWorkflowFlags(payroll);
  const reconciliationLocked = lockedFromPayroll || isReconciliationLocked(tasks);
  const approveForPaymentCount = getApproveForPaymentCount(payroll, statusCounts);

  const benefitState = computeBenefitWorkflowState(benefits, statusCounts);
  const hasReconciledBenefit = benefitState.hasReconciledBenefit
    || Number(payroll?.reconciledBenefitCount ?? 0) > 0
    || (hasBenefitStatusCounts(statusCounts) && Number(statusCounts.RECONCILED ?? 0) > 0);
  const hasPendingReconciliation = approveForPaymentCount > 0;
  const hasReconciliationFailure = benefitState.hasReconciliationFailure;
  const isOnline = isOnlinePayroll(payroll);
  const status = payroll?.status;

  const reconciliationBusy = reconciliationInProgress;

  const canMakePayment = isOnline
    && status === PAYROLL_STATUS.APPROVE_FOR_PAYMENT
    && !paymentInProgress
    && !reconciliationLocked
    && benefitState.hasAcceptedBenefit;

  const canTriggerReconciliation = isOnline
    && !reconciliationLocked
    && !paymentInProgress
    && !reconciliationBusy
    && approveForPaymentCount > 0;

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
    && benefitState.hasUnreconciledBenefits;

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
    approveForPaymentCount,
    hasReconciledBenefit,
    hasAcceptedBenefit: benefitState.hasAcceptedBenefit,
    hasApproveForPayment: hasPendingReconciliation,
    hasReconciliationFailure,
    hasPendingReconciliation,
    hasUnreconciledBenefits: benefitState.hasUnreconciledBenefits,
  };
}

export function benefitHasGatewayReconciliationFailure(benefit) {
  const ext = parseBenefitJsonExt(benefit?.jsonExt);
  const gatewayFailed = ext.gateway_reconciliation_success === false
    || ext.gateway_reconciliation_success === 'false';
  return benefit?.status === BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT && gatewayFailed;
}
