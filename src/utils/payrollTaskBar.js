import { shouldStopMutationPolling } from '@openimis/fe-core';

const PAYROLL_TASKBAR_LABEL_HINTS = [
  'paiement',
  'payment',
  'réconciliation',
  'reconciliation',
  'payroll',
  'paie',
];

/**
 * Mutation suivie dans la barre verticale (mutationLogs), pas la modale création.
 */
export function isPayrollTaskBarMutation(clientMutationLabel) {
  if (!clientMutationLabel || typeof clientMutationLabel !== 'string') return false;
  const lower = clientMutationLabel.toLowerCase();
  return PAYROLL_TASKBAR_LABEL_HINTS.some((hint) => lower.includes(hint));
}

export function shouldRefetchPayrollOnTaskBarComplete(mutation) {
  return isPayrollTaskBarMutation(mutation?.clientMutationLabel)
    && shouldStopMutationPolling(mutation);
}
