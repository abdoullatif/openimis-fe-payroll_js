import { graphql } from '@openimis/fe-core';
import {
  isCreationProgressComplete,
  markInProgressSeen,
  parseCreationProgress,
  sanitizeCreationProgress,
  shouldStopCreationPolling,
} from '../utils/payrollCreationProgress';
import { PAYROLL_PROGRESS_TERMINAL } from '../utils/payrollOperationProgress';

/**
 * Polls payrollCreationProgress until terminal state.
 * Returns cleanup function (clear interval).
 */
export function startPayrollCreationPolling(dispatch, clientMutationId, callbacks, payrollId = null) {
  let hasSeenInProgress = false;
  let consecutiveCancelled = 0;
  let intervalId = null;
  let stopped = false;

  const stopPolling = () => {
    stopped = true;
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const poll = () => {
    if (stopped) return;
    const mutationInFlight = callbacks.isMutationInFlight?.() ?? false;

    dispatch(fetchPayrollCreationProgressThunk(clientMutationId, payrollId))
      .then((progress) => {
        if (!progress || stopped) return;

        const sanitized = sanitizeCreationProgress(progress, hasSeenInProgress);
        if (markInProgressSeen(sanitized)) {
          hasSeenInProgress = true;
        }

        if (sanitized?.shouldStopPolling && PAYROLL_PROGRESS_TERMINAL.includes(sanitized.status)) {
          const stop = shouldStopCreationPolling(sanitized, hasSeenInProgress, mutationInFlight);
          callbacks.onProgress?.(sanitized, { mutationInFlight });
          if (stop) {
            callbacks.onTerminal?.(sanitized, { mutationInFlight });
            stopPolling();
          }
          return;
        }

        if (progress.status === 'CANCELLED' && !isCreationProgressComplete(sanitized)) {
          consecutiveCancelled += 1;
        } else {
          consecutiveCancelled = 0;
        }

        callbacks.onProgress?.(sanitized, { mutationInFlight });

        const requireConfirmedCancel = sanitized?.status === 'CANCELLED'
          && !isCreationProgressComplete(sanitized);
        const stop = shouldStopCreationPolling(sanitized, hasSeenInProgress, mutationInFlight)
          && (!requireConfirmedCancel || consecutiveCancelled >= 3);

        if (stop) {
          callbacks.onTerminal?.(sanitized, { mutationInFlight });
          stopPolling();
        }
      })
      .catch(() => {});
  };

  poll();
  intervalId = setInterval(poll, callbacks.pollIntervalMs ?? 500);

  return stopPolling;
}

export function fetchPayrollCreationProgressThunk(clientMutationId, payrollId = null) {
  const args = [];
  if (clientMutationId) {
    args.push(`clientMutationId: "${clientMutationId}"`);
  }
  if (payrollId) {
    args.push(`payrollId: "${payrollId}"`);
  }
  const payload = `{
    payrollCreationProgress(${args.join(', ')})
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_CREATION_PROGRESS')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) {
        return null;
      }
      const raw = action?.payload?.data?.payrollCreationProgress;
      return parseCreationProgress(raw);
    },
    () => null,
  );
}
