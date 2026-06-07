import {
  formatPageQuery,
  graphql,
  parseData,
  shouldStopMutationPolling,
} from '@openimis/fe-core';

/**
 * Priorité 2 — mutationLogs (barre de tâches verticale).
 */
export function fetchMutationLogsPollThunk(clientMutationId) {
  const payload = formatPageQuery(
    'mutationLogs',
    [`clientMutationId: "${clientMutationId}"`, 'orderBy: ["-requestDateTime"]', 'first: 1'],
    ['status', 'taskBarStatus', 'shouldStopPolling', 'taskBarMessage', 'clientMutationId'],
  );

  return (dispatch) => graphql(payload, 'PAYROLL_MUTATION_LOGS_POLL')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      const connection = action?.payload?.data?.mutationLogs;
      const node = parseData(connection)?.[0] ?? null;
      return {
        totalCount: connection?.totalCount ?? 0,
        node,
        shouldStopPolling: node ? shouldStopMutationPolling(node) : false,
      };
    },
    () => null,
  );
}

/**
 * Priorité 3 — mutation introuvable / arrêt polling fantôme.
 */
export function fetchPayrollMutationPollStatusThunk(clientMutationId, payrollId) {
  const payrollArg = payrollId ? `, payrollId: "${payrollId}"` : '';
  const payload = `{
    payrollMutationPollStatus(clientMutationId: "${clientMutationId}"${payrollArg}) {
      found
      shouldStopPolling
      taskBarStatus
      taskBarMessage
    }
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_MUTATION_POLL_STATUS')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      return action?.payload?.data?.payrollMutationPollStatus ?? null;
    },
    () => null,
  );
}
