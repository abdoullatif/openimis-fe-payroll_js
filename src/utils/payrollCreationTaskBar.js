import { shouldStopMutationPolling, TASK_BAR_STATUS } from '@openimis/fe-core';

/**
 * Arrêt spinner / polling taskbar création paie.
 * Priorité : mutationLogs (SUCCESS ou shouldStopPolling) > pollStatus > keep_taskbar_polling.
 */
export function shouldStopCreationTaskBar({
  mutationLogNode = null,
  pollStatus = null,
  creationProgress = null,
} = {}) {
  if (mutationLogNode && shouldStopMutationPolling(mutationLogNode)) {
    return { stop: true, reason: 'mutationLog' };
  }

  if (pollStatus?.shouldStopPolling === true) {
    return { stop: true, reason: 'pollStatus' };
  }

  if (isCreationKeepTaskbarPollingFalse(creationProgress)) {
    return { stop: true, reason: 'creationProgress' };
  }

  return { stop: false };
}

/** keep_taskbar_polling === false → fin du suivi taskbar côté payrollCreationProgress. */
export function isCreationKeepTaskbarPollingFalse(progress) {
  if (!progress) return false;
  const keep = progress.keepTaskbarPolling ?? progress.keep_taskbar_polling;
  return keep === false || keep === 'false' || keep === 0 || keep === '0';
}

export function isCreationKeepTaskbarPollingTrue(progress) {
  if (!progress) return false;
  const keep = progress.keepTaskbarPolling ?? progress.keep_taskbar_polling;
  return keep === true || keep === 'true' || keep === 1 || keep === '1';
}

/** Spinner taskbar : mutationLogs en RECEIVED tant qu'aucun signal d'arrêt. */
export function isCreationTaskBarSpinnerActive(mutationLogNode) {
  if (!mutationLogNode) return true;
  if (shouldStopMutationPolling(mutationLogNode)) return false;
  const status = mutationLogNode.taskBarStatus;
  if (status === TASK_BAR_STATUS.SUCCESS) return false;
  if (status === TASK_BAR_STATUS.RECEIVED && mutationLogNode.shouldStopPolling !== true) {
    return true;
  }
  return mutationLogNode.shouldStopPolling !== true
    && (status == null && mutationLogNode.status === 0);
}
