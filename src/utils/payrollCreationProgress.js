import { parsePayrollProgress } from './payrollOperationProgress';

export const PAYROLL_CREATION_TERMINAL_STATUSES = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'STALE',
];

export function generateClientMutationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : ((r % 4) + 8);
    return v.toString(16);
  });
}

export function parseCreationProgress(raw) {
  return parsePayrollProgress(raw);
}

export function getCreationProcessedCount(progress) {
  if (!progress) return 0;
  const value = progress.processedBeneficiaries ?? progress.processed_beneficiaries;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getCreationTotalCount(progress) {
  if (!progress) return 0;
  const value = progress.totalBeneficiaries ?? progress.total_beneficiaries;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getCreationPercent(progress) {
  if (!progress) return 0;
  const n = Number(progress.percent);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function getCreationPayrollId(progress) {
  return progress?.payrollId ?? progress?.payroll_id ?? null;
}

/**
 * Bulk insert counters reached their target — backend may still finalize.
 */
export function isProgressMetricsSaturated(progress) {
  if (!progress) return false;
  const total = getCreationTotalCount(progress);
  const processed = getCreationProcessedCount(progress);
  const percent = getCreationPercent(progress);
  return (total > 0 && processed >= total) || percent >= 100;
}

export function isCreationProgressComplete(progress) {
  return progress?.status === 'COMPLETED';
}

/** Backend phase after bulk (98 %) — poll continues like IN_PROGRESS. */
export function isCreationFinalizingStatus(progress) {
  return progress?.status === 'FINALIZING';
}

export function isCreationActive(progress) {
  const status = progress?.status;
  return status === 'IN_PROGRESS' || status === 'FINALIZING';
}

export function isCreationFinalizing(progress) {
  if (!progress || progress.status === 'COMPLETED') return false;
  if (isCreationFinalizingStatus(progress)) return true;
  if (progress.status !== 'IN_PROGRESS') return false;
  return isProgressMetricsSaturated(progress);
}

/**
 * Cache says COMPLETED but createPayroll HTTP is still open.
 */
export function isAwaitingMutationEnd(progress, mutationInFlight) {
  if (!mutationInFlight) return false;
  return progress?.status === 'COMPLETED';
}

/**
 * Close modal only when backend says done AND the long mutation request has returned.
 */
export function canCloseCreationUI(progress, mutationInFlight) {
  if (mutationInFlight) return false;
  if (!progress) return false;
  if (progress.status === 'COMPLETED') return true;
  if (progress.status === 'FAILED' || progress.status === 'CANCELLED' || progress.status === 'STALE') {
    return true;
  }
  return false;
}

/** Mutation HTTP returned but cache never reached COMPLETED — allow closing if payroll exists. */
export function canCloseCreationAfterMutationFallback(progress, mutationInFlight) {
  if (mutationInFlight) return false;
  if (!progress || isCreationActive(progress)) return false;
  return canCloseCreationUI(progress, mutationInFlight);
}

function hasMeaningfulProgress(progress) {
  return getCreationTotalCount(progress) > 0
    || getCreationProcessedCount(progress) > 0
    || getCreationPercent(progress) > 0;
}

function isStopPollingFlag(progress) {
  return progress?.shouldStopPolling === true
    || progress?.should_stop_polling === true
    || progress?.should_stop_polling === 'true';
}

export function sanitizeCreationProgress(progress, hasSeenInProgress = false) {
  if (!progress) return null;

  const status = progress.status;

  if (
    !hasSeenInProgress
    && (status === 'CANCELLED' || status === 'FAILED' || status === 'STALE')
    && !isCreationProgressComplete(progress)
  ) {
    return {
      ...progress,
      status: 'IN_PROGRESS',
      error: null,
      shouldStopPolling: false,
    };
  }

  if ((status === 'CANCELLED' || status === 'STALE') && !isCreationProgressComplete(progress)) {
    return {
      ...progress,
      status: 'IN_PROGRESS',
      error: null,
      shouldStopPolling: false,
    };
  }

  if (status === 'IN_PROGRESS' || status === 'FINALIZING') {
    return { ...progress, error: null };
  }

  if (isCreationProgressComplete(progress)) {
    return { ...progress, error: null };
  }

  return progress;
}

export function shouldStopCreationPolling(progress, hasSeenInProgress = false, mutationInFlight = false) {
  if (!progress) return false;

  if (progress.shouldStopPolling) {
    if (progress.status === 'COMPLETED') return !mutationInFlight;
    return !mutationInFlight && hasSeenInProgress;
  }

  const status = progress.status;

  if (status === 'COMPLETED') {
    return !mutationInFlight;
  }

  if (status === 'FAILED') {
    return !mutationInFlight && hasSeenInProgress
      && (isStopPollingFlag(progress) || hasMeaningfulProgress(progress));
  }

  if (status === 'CANCELLED' || status === 'STALE') {
    return !mutationInFlight && hasSeenInProgress && isStopPollingFlag(progress);
  }

  return false;
}

export function markInProgressSeen(progress) {
  if (!progress) return false;
  if (isCreationActive(progress)) return true;
  return hasMeaningfulProgress(progress);
}

export function resolveTerminalCreationStatus(progress) {
  return progress;
}

/**
 * Prefer backend phase label when present (bulk vs finalize).
 */
export function getCreationProgressMessage(progress) {
  return progress?.message
    || progress?.status_message
    || progress?.phase_message
    || null;
}

export function isOpenSearchIndexingPending(progress) {
  return progress?.opensearchIndexingPending === true;
}

/** Message taskbar post-modale (indexation OS) — priorité sur le libellé succès. */
export function getCreationTaskBarHint(progress) {
  if (!isOpenSearchIndexingPending(progress)) return null;
  return progress?.taskbarMessage ?? progress?.taskBarMessage ?? null;
}

export function getCreationPhaseLabel(progress, formatMessage) {
  if (isCreationFinalizingStatus(progress)) {
    return getCreationProgressMessage(progress)
      || formatMessage('payroll.creation.status.finalizing');
  }
  const phase = progress?.phase;
  if (phase === 'finalize' || phase === 'finalization' || phase === 'FINALIZING') {
    return getCreationProgressMessage(progress)
      || formatMessage('payroll.creation.status.finalizing');
  }
  if (phase === 'beneficiaries' || phase === 'bulk') {
    return formatMessage('payroll.creation.status.inProgress');
  }
  return null;
}
