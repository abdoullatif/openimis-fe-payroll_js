/**
 * Cycle de vie mutations async payroll (paiement / réconciliation Celery).
 * Règle : journalize + polling uniquement après succès HTTP/GraphQL de la mutation.
 */

export function isPayrollMutationGraphqlSuccess(action, serviceName) {
  if (!action?.payload) return false;
  if (action.payload.errors?.length) return false;
  const node = action.payload.data?.[serviceName];
  return node != null && (node.internalId != null || node.clientMutationId != null);
}

export function buildTaskBarEntryFromMutationMeta(meta) {
  if (!meta?.clientMutationId) return null;
  return {
    clientMutationId: meta.clientMutationId,
    clientMutationLabel: meta.clientMutationLabel,
    status: 0,
    taskBarStatus: 'RECEIVED',
    requestDateTime: meta.requestedDateTime || new Date().toISOString(),
  };
}

/**
 * @param {Function} journalize — action creator (souvent déjà bindé via bindActionCreators).
 * Ne pas faire dispatch(journalize(...)) si journalize est déjà bindé : cela enverrait undefined au store.
 */
export function journalizePayrollMutationAfterSuccess(journalize, meta) {
  const entry = buildTaskBarEntryFromMutationMeta(meta);
  if (!entry) return false;
  journalize(entry);
  return true;
}

/**
 * createPayroll : la modale se ferme à COMPLETED mais la taskbar reste en RECEIVED
 * jusqu'à shouldStopPolling sur mutationLogs / payrollMutationPollStatus.
 */
export function journalizePayrollCreationTaskBarPending(journalize, meta, options = {}) {
  if (!meta?.clientMutationId) return false;
  const entry = {
    clientMutationId: meta.clientMutationId,
    clientMutationLabel: meta.clientMutationLabel,
    status: 0,
    taskBarStatus: 'RECEIVED',
    shouldStopPolling: false,
    requestDateTime: meta.requestedDateTime || new Date().toISOString(),
  };
  const hint = options.taskBarMessage;
  if (hint) {
    entry.taskBarMessage = hint;
  }
  journalize(entry);
  return true;
}
