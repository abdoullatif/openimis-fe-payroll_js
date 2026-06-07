import { shouldStopCreationTaskBar } from '../utils/payrollCreationTaskBar';
import { fetchPayrollCreationProgressThunk } from './payrollCreationService';
import {
  fetchMutationLogsPollThunk,
  fetchPayrollMutationPollStatusThunk,
} from './payrollMutationPollService';

/**
 * Polling taskbar post-modale : mutationLogs (priorité) + pollStatus + keep_taskbar_polling.
 */
export function startPayrollCreationTaskBarAssist(
  dispatch,
  clientMutationId,
  payrollId,
  fetchMutation,
) {
  if (!clientMutationId || !fetchMutation) {
    return () => {};
  }

  let stopped = false;

  const poll = () => {
    if (stopped) return;

    fetchMutation(clientMutationId);

    Promise.all([
      dispatch(fetchMutationLogsPollThunk(clientMutationId)),
      dispatch(fetchPayrollMutationPollStatusThunk(clientMutationId, payrollId)),
      dispatch(fetchPayrollCreationProgressThunk(clientMutationId, payrollId)),
    ]).then(([mutationLogs, pollStatus, creationProgress]) => {
      if (stopped) return;

      const { stop } = shouldStopCreationTaskBar({
        mutationLogNode: mutationLogs?.node,
        pollStatus,
        creationProgress,
      });

      if (stop) {
        stopped = true;
        fetchMutation(clientMutationId);
      }
    });
  };

  poll();
  const intervalId = setInterval(poll, 2500);

  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}
