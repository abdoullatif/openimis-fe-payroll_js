export const PAYROLL_PROGRESS_TERMINAL = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'STALE',
];

export const PAYROLL_OPERATION = {
  CREATION: 'creation',
  PAYMENT: 'payment',
  RECONCILIATION: 'reconciliation',
};

export function parsePayrollProgress(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object') return null;

  return {
    status: data.status,
    phase: data.phase,
    percent: data.percent != null ? Number(data.percent) : undefined,
    totalBeneficiaries: toNumber(data.totalBeneficiaries ?? data.total_beneficiaries),
    processedBeneficiaries: toNumber(data.processedBeneficiaries ?? data.processed_beneficiaries),
    successCount: toNumber(data.successCount ?? data.success_count),
    rejectedCount: toNumber(data.rejectedCount ?? data.rejected_count),
    startedAt: data.startedAt ?? data.started_at,
    updatedAt: data.updatedAt ?? data.updated_at,
    completedAt: data.completedAt ?? data.completed_at,
    error: data.error ?? null,
    message: data.message ?? data.status_message ?? data.phase_message ?? null,
    shouldStopPolling: data.shouldStopPolling === true
      || data.should_stop_polling === true
      || data.should_stop_polling === 'true',
    remainingApproveForPayment: toNumber(
      data.remainingApproveForPayment ?? data.remaining_approve_for_payment,
    ),
    payrollId: data.payrollId ?? data.payroll_id,
    clientMutationId: data.clientMutationId ?? data.client_mutation_id,
    mutationInProgress: data.mutationInProgress ?? data.mutation_in_progress,
    opensearchIndexingPending: isFlagTrue(
      data.opensearchIndexingPending ?? data.opensearch_indexing_pending,
    ),
    taskbarMessage: data.taskbarMessage ?? data.taskbar_message ?? data.taskBarMessage ?? null,
    keepTaskbarPolling: parseKeepTaskbarPolling(
      data.keepTaskbarPolling ?? data.keep_taskbar_polling,
    ),
  };
}

function parseKeepTaskbarPolling(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return undefined;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isFlagTrue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function isProgressActive(status) {
  return status === 'IN_PROGRESS' || status === 'FINALIZING';
}

function parsePayrollJsonExt(jsonExt) {
  if (!jsonExt) return {};
  if (typeof jsonExt === 'object' && !Array.isArray(jsonExt)) return jsonExt;
  try {
    return JSON.parse(jsonExt);
  } catch {
    return {};
  }
}

function progressSortTimestamp(progress) {
  if (!progress) return 0;
  const candidates = [progress.updatedAt, progress.completedAt, progress.startedAt];
  for (const ts of candidates) {
    const parsed = Date.parse(ts);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

/**
 * Scalar GraphQL (paymentProgress) peut être CANCELLED alors que jsonExt.payment_progress
 * est encore IN_PROGRESS (progression Celery live). On garde la source la plus récente / active.
 */
export function pickActivePayrollProgress(scalarProgress, extProgress) {
  if (!extProgress) return scalarProgress;
  if (!scalarProgress) return extProgress;
  const extStaleWhileActive = isProgressActive(extProgress.status)
    && isParsedProgressHeartbeatStale(extProgress);
  if (extStaleWhileActive) {
    if (scalarProgress?.status) {
      return scalarProgress;
    }
    return {
      ...extProgress,
      status: 'STALE',
      shouldStopPolling: true,
      message: extProgress.message ?? extProgress.error ?? null,
    };
  }
  const extActive = isProgressActive(extProgress.status);
  const scalarActive = isProgressActive(scalarProgress.status);
  const scalarTerminal = scalarProgress?.status
    && PAYROLL_PROGRESS_TERMINAL.includes(scalarProgress.status);
  if (extActive && scalarTerminal) {
    return extProgress;
  }
  if (extActive && !scalarActive) return extProgress;
  if (scalarActive && !extActive) return scalarProgress;
  if (extActive && scalarActive) {
    return progressSortTimestamp(extProgress) >= progressSortTimestamp(scalarProgress)
      ? extProgress
      : scalarProgress;
  }
  return progressSortTimestamp(extProgress) > progressSortTimestamp(scalarProgress)
    ? extProgress
    : scalarProgress;
}

export function getEffectivePaymentProgress(payroll, sessionStartedAtMs = null) {
  const scalar = parsePayrollProgress(payroll?.paymentProgress);
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  const sessionMs = sessionStartedAtMs ?? payroll?.paymentSessionStartedAtMs ?? null;
  const effectiveScalar = sessionMs && isSessionStaleTerminalProgress(scalar, sessionMs)
    ? null
    : scalar;
  return pickActivePayrollProgress(effectiveScalar, parsePayrollProgress(ext.payment_progress));
}

export function getEffectiveReconciliationProgress(payroll) {
  const scalar = parsePayrollProgress(payroll?.reconciliationProgress);
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  return pickActivePayrollProgress(scalar, parsePayrollProgress(ext.reconciliation_progress));
}

/** Job Celery live dans jsonExt — prioritaire sur le scalar GraphQL. */
export function isJsonExtPaymentJobActive(payroll) {
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  if (isFlagTrue(ext.payment_in_progress)) return true;
  const extProgress = parsePayrollProgress(ext.payment_progress);
  if (isProgressActive(extProgress?.status)) {
    return !isParsedProgressHeartbeatStale(extProgress);
  }
  return false;
}

export function getJsonExtPaymentProgress(payroll) {
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  return parsePayrollProgress(ext.payment_progress);
}

/** Terminal confirmé dans jsonExt (seule source fiable pour toast / arrêt). */
export function isJsonExtPaymentTerminal(payroll, sessionStartedAtMs = null) {
  const ext = parsePayrollJsonExt(payroll?.jsonExt);
  if (isFlagTrue(ext.payment_in_progress)) return false;
  const extProgress = parsePayrollProgress(ext.payment_progress);
  if (!extProgress?.status) return false;
  if (!PAYROLL_PROGRESS_TERMINAL.includes(extProgress.status)) return false;
  const sessionMs = sessionStartedAtMs ?? payroll?.paymentSessionStartedAtMs ?? null;
  if (sessionMs && isSessionStaleTerminalProgress(extProgress, sessionMs)) return false;
  return true;
}

/** Y fiable depuis jsonExt Celery (lot restant à envoyer à la passerelle). */
export function derivePaymentBatchTotalFromExtProgress(extProgress) {
  if (!extProgress) return null;
  const processed = extProgress.processedBeneficiaries ?? 0;
  if (extProgress.remainingApproveForPayment != null && extProgress.remainingApproveForPayment >= 0) {
    return extProgress.remainingApproveForPayment + processed;
  }
  if (extProgress.totalBeneficiaries != null && extProgress.totalBeneficiaries > 0) {
    return extProgress.totalBeneficiaries;
  }
  return null;
}

/**
 * Compteur X/Y spinner — Y = lot restant à envoyer (figé au clic si batchTotal fourni).
 * X = processedBeneficiaries depuis jsonExt Celery.
 */
export function normalizePaymentProgressDisplay(progress, { batchTotal = null } = {}) {
  if (!progress) return progress;
  const processed = progress.processedBeneficiaries ?? 0;
  let total;
  if (batchTotal != null && batchTotal > 0) {
    total = batchTotal;
  } else if (progress.totalBeneficiaries === 0 && processed === 0) {
    total = 0;
  } else if (progress.remainingApproveForPayment != null && progress.remainingApproveForPayment >= 0) {
    total = progress.remainingApproveForPayment + processed;
  } else {
    total = progress.totalBeneficiaries;
  }
  return {
    ...progress,
    processedBeneficiaries: processed,
    totalBeneficiaries: total,
  };
}

/** Progression paiement fusionnée — jsonExt Celery prioritaire pour statut et compteurs. */
export function resolvePaymentProgressFromFusion(payroll, sessionOpts = {}) {
  const { sessionStartedAtMs = null, batchTotal = null } = sessionOpts;
  if (!payroll) return null;
  const extProgress = getJsonExtPaymentProgress(payroll);
  const sessionMs = sessionStartedAtMs ?? payroll?.paymentSessionStartedAtMs ?? null;
  let progress;
  if (isJsonExtPaymentJobActive(payroll) && extProgress) {
    progress = { ...extProgress };
  } else if (isJsonExtPaymentTerminal(payroll) && extProgress) {
    progress = { ...extProgress };
  } else {
    progress = getEffectivePaymentProgress(payroll, sessionMs);
  }
  return normalizePaymentProgressDisplay(progress, { batchTotal });
}

/** Terminal en cache antérieur au clic « Effectuer le paiement » (ex. COMPLETED d'un ancien run). */
export function isSessionStaleTerminalProgress(terminalProgress, sessionStartedAtMs) {
  if (!sessionStartedAtMs || !terminalProgress?.status) return false;
  if (!PAYROLL_PROGRESS_TERMINAL.includes(terminalProgress.status)) return false;
  const ts = terminalProgress.completedAt ?? terminalProgress.updatedAt ?? terminalProgress.startedAt;
  if (!ts) return true;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return true;
  return parsed < sessionStartedAtMs;
}

/** Conserve processed/total entre deux ticks de poll (évite flash 0/0). */
export function mergePaymentProgressCounters(prevProgress, nextProgress) {
  if (!nextProgress) return prevProgress ?? null;
  if (!prevProgress) return nextProgress;
  const pickTotal = (nextVal, prevVal) => {
    if (nextVal != null && nextVal > 0) return nextVal;
    if (prevVal != null && prevVal > 0) return prevVal;
    return nextVal ?? prevVal;
  };
  return {
    ...nextProgress,
    processedBeneficiaries: nextProgress.processedBeneficiaries
      ?? prevProgress.processedBeneficiaries
      ?? 0,
    totalBeneficiaries: pickTotal(
      nextProgress.totalBeneficiaries,
      prevProgress.totalBeneficiaries,
    ),
    successCount: nextProgress.successCount ?? prevProgress.successCount,
    rejectedCount: nextProgress.rejectedCount ?? prevProgress.rejectedCount,
  };
}

/**
 * Toast / arrêt poll paiement — exige qu’un job Celery ait été confirmé pour la session en cours.
 */
export function canAcceptPaymentSessionTerminal({
  progress,
  payroll,
  sessionStartedAtMs = null,
  clientMutationId = null,
  backendConfirmed = true,
  mutationAccepted = false,
}) {
  if (isBenignTerminalOperationMessage(progress)) return false;
  if (isJsonExtPaymentJobActive(payroll)) return false;
  if (isPaymentActivelyRunning(payroll)) return false;

  const extProgress = getJsonExtPaymentProgress(payroll);
  const terminalProgress = extProgress?.status
    && PAYROLL_PROGRESS_TERMINAL.includes(extProgress.status)
    ? extProgress
    : progress;

  if (!terminalProgress?.status || !PAYROLL_PROGRESS_TERMINAL.includes(terminalProgress.status)) {
    return false;
  }

  if (!sessionStartedAtMs || !clientMutationId) {
    if (payroll?.jsonExt) return isJsonExtPaymentTerminal(payroll, sessionStartedAtMs);
    return true;
  }

  if (!isJsonExtPaymentTerminal(payroll, sessionStartedAtMs)) return false;
  if (isSessionStaleTerminalProgress(extProgress, sessionStartedAtMs)) return false;
  if (extProgress?.clientMutationId && extProgress.clientMutationId !== clientMutationId) {
    return false;
  }
  // Session suivie : terminal accepté seulement après IN_PROGRESS Celery confirmé dans cette session.
  return backendConfirmed === true;
}

/** Ignore un terminal dédié payrollPaymentProgress pendant qu’aucun job n’a été confirmé. */
export function shouldIgnoreDedicatedPaymentProgress(dedicatedProgress, modalRow, sessionOpts = {}) {
  if (!dedicatedProgress?.status) return false;
  const {
    sessionStartedAtMs = null,
    backendConfirmed = true,
    clientMutationId = null,
  } = sessionOpts;
  if (isObsoletedTerminalOperationProgress(
    PAYROLL_OPERATION.PAYMENT,
    dedicatedProgress,
    modalRow,
  )) {
    return true;
  }
  if (!sessionStartedAtMs) return false;
  if (isJsonExtPaymentJobActive(modalRow)) return true;
  if (!backendConfirmed && PAYROLL_PROGRESS_TERMINAL.includes(dedicatedProgress.status)) {
    return true;
  }
  if (isSessionStaleTerminalProgress(dedicatedProgress, sessionStartedAtMs)) {
    return true;
  }
  if (
    clientMutationId
    && dedicatedProgress.clientMutationId
    && dedicatedProgress.clientMutationId !== clientMutationId
  ) {
    return true;
  }
  return false;
}

/** Messages techniques du poll dédié — pas utiles en toast (ex. « No payment in progress »). */
export function isBenignTerminalOperationMessage(progress) {
  const text = `${progress?.message || ''} ${progress?.error || ''}`.toLowerCase();
  return text.includes('no payment in progress')
    || text.includes('no reconciliation in progress');
}

/** Scalar terminal (ex. CANCELLED) alors que jsonExt indique encore un job actif. */
export function isObsoletedTerminalOperationProgress(operation, terminalProgress, payroll) {
  if (!terminalProgress?.status || !PAYROLL_PROGRESS_TERMINAL.includes(terminalProgress.status)) {
    return false;
  }
  if (operation === PAYROLL_OPERATION.PAYMENT) {
    if (isJsonExtPaymentJobActive(payroll)) return true;
    return isProgressActive(getEffectivePaymentProgress(payroll)?.status);
  }
  if (operation === PAYROLL_OPERATION.RECONCILIATION) {
    return isProgressActive(getEffectiveReconciliationProgress(payroll)?.status);
  }
  return false;
}

/** Fusionne jsonExt.*_progress quand les champs scalaires GraphQL sont en retard. */
export function enrichPayrollProgressFromJsonExt(payroll, sessionStartedAtMs = null) {
  if (!payroll) return payroll;
  const sessionMs = sessionStartedAtMs ?? payroll?.paymentSessionStartedAtMs ?? null;
  const paymentProgress = getEffectivePaymentProgress(payroll, sessionMs);
  const reconciliationProgress = getEffectiveReconciliationProgress(payroll);
  const ext = parsePayrollJsonExt(payroll.jsonExt);
  return {
    ...payroll,
    paymentProgress,
    reconciliationProgress,
    paymentInProgress: isFlagTrue(payroll.paymentInProgress)
      || isFlagTrue(ext.payment_in_progress)
      || isProgressActive(paymentProgress?.status),
    reconciliationInProgress: isFlagTrue(payroll.reconciliationInProgress)
      || isFlagTrue(ext.reconciliation_in_progress)
      || isProgressActive(reconciliationProgress?.status),
  };
}

function isParsedProgressHeartbeatStale(progress, maxAgeMs = 3 * 60 * 1000) {
  if (!progress) return false;
  const ts = progress.updatedAt ?? progress.startedAt ?? progress.completedAt;
  if (!ts) return false;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed > maxAgeMs;
}

/**
 * Retourne true seulement si un timestamp valide existe ET qu'il est trop ancien.
 * Sans timestamp, on ne coupe pas le spinner pour éviter les faux négatifs.
 */
function isProgressHeartbeatStale(rawProgress, maxAgeMs = 3 * 60 * 1000) {
  if (!rawProgress) return false;
  let data = rawProgress;
  if (typeof rawProgress === 'string') {
    try {
      data = JSON.parse(rawProgress);
    } catch {
      return false;
    }
  }
  const ts = data?.updated_at ?? data?.updatedAt ?? data?.started_at ?? data?.startedAt;
  if (!ts) return false;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return false;
  return Date.now() - parsed > maxAgeMs;
}

export function getProgressList(payroll) {
  const row = enrichPayrollProgressFromJsonExt(payroll);
  return [
    row?.paymentProgress,
    row?.reconciliationProgress,
    parsePayrollProgress(payroll?.creationProgress),
  ].filter(Boolean);
}

/**
 * Règle unique d'arrêt du polling (backend Celery).
 */
export function shouldStopPollingPayroll(payroll) {
  if (!payroll) return true;
  if (isPaymentActivelyRunning(payroll) || isReconciliationActivelyRunning(payroll)) {
    return false;
  }

  const checks = [
    getEffectivePaymentProgress(payroll),
    getEffectiveReconciliationProgress(payroll),
    parsePayrollProgress(payroll?.creationProgress),
  ].filter(Boolean);

  for (const prog of checks) {
    if (prog.shouldStopPolling) return true;
    if (PAYROLL_PROGRESS_TERMINAL.includes(prog.status)) return true;
  }

  return true;
}

export function shouldStartPollingPayment(payroll) {
  const row = enrichPayrollProgressFromJsonExt(payroll);
  const paymentProgress = row.paymentProgress;
  const status = paymentProgress?.status;
  if (isProgressActive(status)) {
    return !isParsedProgressHeartbeatStale(paymentProgress);
  }
  if (isFlagTrue(row.paymentInProgress)) {
    if (status === 'STALE') {
      return !isParsedProgressHeartbeatStale(paymentProgress);
    }
    if (status && PAYROLL_PROGRESS_TERMINAL.includes(status)) {
      return false;
    }
    return !isParsedProgressHeartbeatStale(paymentProgress);
  }
  if (isParsedProgressHeartbeatStale(paymentProgress)) return false;
  if (status && PAYROLL_PROGRESS_TERMINAL.includes(status)) {
    return false;
  }
  return false;
}

export function shouldStartPollingReconciliation(payroll) {
  const row = enrichPayrollProgressFromJsonExt(payroll);
  const reconciliationProgress = row.reconciliationProgress;
  if (isProgressActive(reconciliationProgress?.status)) {
    return !isParsedProgressHeartbeatStale(reconciliationProgress);
  }
  if (
    reconciliationProgress?.status
    && PAYROLL_PROGRESS_TERMINAL.includes(reconciliationProgress.status)
  ) {
    return false;
  }
  return isFlagTrue(row.reconciliationInProgress);
}

/** Paiement en cours (pas un statut terminal type COMPLETED). */
export function isPaymentActivelyRunning(payroll) {
  if (isJsonExtPaymentJobActive(payroll)) return true;
  const row = enrichPayrollProgressFromJsonExt(payroll);
  const paymentProgress = row.paymentProgress;
  const status = paymentProgress?.status;
  if (isProgressActive(status)) {
    return !isParsedProgressHeartbeatStale(paymentProgress);
  }
  if (isFlagTrue(row.paymentInProgress)) {
    if (status === 'STALE') {
      return !isParsedProgressHeartbeatStale(paymentProgress);
    }
    if (status && PAYROLL_PROGRESS_TERMINAL.includes(status)) {
      return false;
    }
    return !isParsedProgressHeartbeatStale(paymentProgress);
  }
  if (isParsedProgressHeartbeatStale(paymentProgress)) return false;
  return false;
}

/**
 * Réconciliation en cours — ignore flags/jsonExt obsolètes si progress est terminal
 * (ex. CANCELLED + PARTIAL_COMPLETED).
 */
export function isReconciliationActivelyRunning(payroll) {
  const row = enrichPayrollProgressFromJsonExt(payroll);
  const reconciliationProgress = row.reconciliationProgress;
  if (isProgressActive(reconciliationProgress?.status)) {
    return !isParsedProgressHeartbeatStale(reconciliationProgress);
  }
  if (!isFlagTrue(row.reconciliationInProgress)) return false;
  if (
    reconciliationProgress?.status
    && PAYROLL_PROGRESS_TERMINAL.includes(reconciliationProgress.status)
  ) {
    return false;
  }
  return true;
}

export function shouldStartPollingCreation(payroll) {
  const creationProgress = parsePayrollProgress(payroll?.creationProgress);
  return creationProgress?.status === 'IN_PROGRESS'
    || creationProgress?.status === 'FINALIZING';
}

export function shouldPollPayrollOperations(payroll, forcedOperation = null) {
  if (!payroll) return false;
  if (forcedOperation === PAYROLL_OPERATION.PAYMENT) return !shouldStopPollingPayroll(payroll);
  if (forcedOperation === PAYROLL_OPERATION.RECONCILIATION) return !shouldStopPollingPayroll(payroll);
  if (shouldStopPollingPayroll(payroll)) return false;
  return shouldStartPollingPayment(payroll) || shouldStartPollingReconciliation(payroll);
}

/**
 * Une seule opération active : paiement > réconciliation > création.
 */
export function resolveActiveOperation(payroll, forcedOperation = null) {
  const enriched = enrichPayrollProgressFromJsonExt(payroll);
  const paymentProgress = enriched?.paymentProgress;
  const reconciliationProgress = enriched?.reconciliationProgress;
  const creationProgress = parsePayrollProgress(payroll?.creationProgress);

  if (
    forcedOperation === PAYROLL_OPERATION.PAYMENT
    || shouldStartPollingPayment(payroll)
  ) {
    return { operation: PAYROLL_OPERATION.PAYMENT, progress: paymentProgress };
  }

  if (
    forcedOperation === PAYROLL_OPERATION.RECONCILIATION
    || shouldStartPollingReconciliation(payroll)
  ) {
    return { operation: PAYROLL_OPERATION.RECONCILIATION, progress: reconciliationProgress };
  }

  if (
    forcedOperation === PAYROLL_OPERATION.CREATION
    || shouldStartPollingCreation(payroll)
  ) {
    return { operation: PAYROLL_OPERATION.CREATION, progress: creationProgress };
  }

  return { operation: null, progress: null };
}
