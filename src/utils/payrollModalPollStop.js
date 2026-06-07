import { shouldStopMutationPolling } from '@openimis/fe-core';
import {
  enrichPayrollProgressFromJsonExt,
  isPaymentActivelyRunning,
  isReconciliationActivelyRunning,
  isSessionStaleTerminalProgress,
  canAcceptPaymentSessionTerminal,
  mergePaymentProgressCounters,
  isJsonExtPaymentJobActive,
  getJsonExtPaymentProgress,
  isJsonExtPaymentTerminal,
  parsePayrollProgress,
} from './payrollOperationProgress';

/** Nombre de cycles avant d’interpréter mutationLogs.totalCount === 0 comme échec silencieux. */
export const GHOST_MUTATION_MIN_POLLS = 2;

/**
 * Agrège les signaux d’arrêt (progression Celery, mutationLogs, payrollMutationPollStatus).
 */
function isFlagTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isStaleWhilePayrollFlagActive(progressRow) {
  const row = enrichPayrollProgressFromJsonExt(progressRow);
  const paymentProgress = row?.paymentProgress;
  const reconciliationProgress = row?.reconciliationProgress;
  if (paymentProgress?.status === 'STALE' && isFlagTrue(progressRow?.paymentInProgress)) {
    return true;
  }
  if (reconciliationProgress?.status === 'STALE' && isFlagTrue(progressRow?.reconciliationInProgress)) {
    return true;
  }
  return false;
}

export function evaluatePayrollModalPollStop({
  progressRow,
  /** Payroll modale (jsonExt) pour ignorer un scalar CANCELLED obsolète. */
  contextPayroll = null,
  paymentSessionStartedAtMs = null,
  paymentSessionBackendConfirmed = true,
  paymentSessionMutationAccepted = false,
  activeClientMutationId = null,
  operation = 'payment',
  mutationLogs,
  pollStatus,
  pollsAfterMutationStart = 0,
  /** true si un clientMutationId a été fourni après succès mutation (détecter journal fantôme). */
  trackMutationLog = false,
}) {
  const row = enrichPayrollProgressFromJsonExt(
    { ...contextPayroll, ...progressRow },
    paymentSessionStartedAtMs ?? undefined,
  );
  const sessionMs = paymentSessionStartedAtMs ?? contextPayroll?.paymentSessionStartedAtMs ?? null;
  const trackedPaymentSession = operation === 'payment'
    && trackMutationLog
    && Boolean(sessionMs)
    && Boolean(activeClientMutationId);

  if (sessionMs && isSessionStaleTerminalProgress(row?.paymentProgress, sessionMs)) {
    return { stop: false };
  }
  if (trackedPaymentSession && isJsonExtPaymentJobActive(row)) {
    return { stop: false };
  }
  const jobStillActive = isPaymentActivelyRunning(row) || isReconciliationActivelyRunning(row);
  if (jobStillActive) {
    return { stop: false };
  }

  if (trackedPaymentSession && !paymentSessionBackendConfirmed && !paymentSessionMutationAccepted) {
    return { stop: false };
  }

  if (trackedPaymentSession) {
    if (!isJsonExtPaymentTerminal(row, sessionMs)) {
      return { stop: false };
    }
    const extProgress = getJsonExtPaymentProgress(row);
    if (row?.shouldStopPolling && !isStaleWhilePayrollFlagActive(row)) {
      if (!canAcceptPaymentSessionTerminal({
        progress: extProgress ?? row.paymentProgress,
        payroll: row,
        sessionStartedAtMs: sessionMs,
        clientMutationId: activeClientMutationId,
        backendConfirmed: paymentSessionBackendConfirmed,
        mutationAccepted: paymentSessionMutationAccepted,
      })) {
        return { stop: false };
      }
      return { stop: true, reason: 'progress' };
    }
    return { stop: false };
  }

  if (row?.shouldStopPolling && !isStaleWhilePayrollFlagActive(row)) {
    return { stop: true, reason: 'progress' };
  }

  if (pollStatus?.shouldStopPolling === true) {
    return {
      stop: true,
      reason: 'pollStatus',
      message: pollStatus.taskBarMessage,
    };
  }

  const node = mutationLogs?.node;
  if (node && shouldStopMutationPolling(node)) {
    return { stop: true, reason: 'mutationLog', message: node.taskBarMessage };
  }

  const totalCount = mutationLogs?.totalCount;
  if (
    trackMutationLog
    && pollsAfterMutationStart >= GHOST_MUTATION_MIN_POLLS
    && totalCount === 0
    && (pollStatus == null || pollStatus.found === false || pollStatus.shouldStopPolling === true)
    && !isJsonExtPaymentJobActive(row)
  ) {
    return { stop: true, reason: 'ghost' };
  }

  return { stop: false };
}

export function formatOperationProgressMessage(progress, formatMessage, formatMessageWithValues) {
  if (!progress) return null;
  const processed = progress.processedBeneficiaries;
  const total = progress.totalBeneficiaries;
  if (processed != null && total != null) {
    const sub = formatMessageWithValues('payroll.operation.progressSubtext', {
      processed,
      total,
      successCount: progress.successCount ?? 0,
      rejectedCount: progress.rejectedCount ?? 0,
    });
    const title = progress.message;
    if (title && title !== sub) return `${title} — ${sub}`;
    return sub;
  }
  if (progress.percent != null && progress.message) {
    return `${progress.message} (${progress.percent}%)`;
  }
  return progress.message || null;
}
