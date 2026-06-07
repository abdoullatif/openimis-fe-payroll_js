import {
  decodeId,
  formatPageQueryWithCount,
  graphql,
  parseData,
} from '@openimis/fe-core';
import {
  enrichPayrollProgressFromJsonExt,
  parsePayrollProgress,
  shouldStopPollingPayroll,
} from '../utils/payrollOperationProgress';
import {
  parseBenefitConsumptionStatusCounts,
  parsePaymentApprovedModalSummary,
} from '../utils/parsePaymentApprovedModalSummary';

const BENEFIT_CONSUMPTION_LIST_PROJECTION = [
  'id',
  'code',
  'amount',
  'status',
  'receipt',
  'individual {firstName, lastName}',
];

/** Backend expose paymentProgress / reconciliationProgress en JSONString (pas de sous-champs GraphQL). */
const PAYROLL_PROGRESS_SCALAR_FIELDS = [
  'paymentProgress',
  'reconciliationProgress',
];

const PAYROLL_APPROVED_MODAL_PROJECTION = [
  'id',
  'name',
  'status',
  'paymentMethod',
  'paymentInProgress',
  'reconciliationInProgress',
  'reconciliationLocked',
  'hasPaymentReport',
  ...PAYROLL_PROGRESS_SCALAR_FIELDS,
  'paymentApprovedModalSummary',
  'reconciliationRecap',
  'beneficiairesSelectionnes',
  'reconciledBenefitCount',
  'canClosePayroll',
  'closePayrollBlockers',
  'jsonExt',
];

export const PAYROLL_SUMMARY_PROJECTION = [
  'id',
  'name',
  'beneficesTrouves',
  'beneficiairesSelectionnes',
  'benefitConsumptionTotalCount',
  'reconciliationRecap',
];

export const PAYROLL_RECONCILED_MODAL_PROJECTION = [
  ...PAYROLL_SUMMARY_PROJECTION,
  'paymentReconciledModalSummary',
];

export const PAYROLL_MODAL_POLL_PROJECTION = [
  'id',
  'paymentInProgress',
  'reconciliationInProgress',
  'reconciliationLocked',
  ...PAYROLL_PROGRESS_SCALAR_FIELDS,
  'paymentApprovedModalSummary',
  'reconciliationRecap',
  'canClosePayroll',
  'closePayrollBlockers',
  'hasPaymentReport',
  'reconciledBenefitCount',
  'jsonExt',
];

function normalizePayrollRow(row) {
  if (!row) return null;
  return enrichPayrollProgressFromJsonExt({
    ...row,
    id: row.id ? decodeId(row.id) : row.id,
    paymentApprovedModalSummary: parsePaymentApprovedModalSummary(
      row.paymentApprovedModalSummary,
    ),
  });
}

function fetchPayrollModalConnectionThunk(payrollId, projections, actionType) {
  const payload = formatPageQueryWithCount(
    'payroll',
    [`id: "${payrollId}"`, 'first: 1'],
    projections,
  );

  return (dispatch) => graphql(payload, actionType)(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      const rows = parseData(action?.payload?.data?.payroll);
      return normalizePayrollRow(rows?.[0]);
    },
    () => null,
  );
}

export function fetchBenefitConsumptionStatusCountsThunk(payrollUuid) {
  const payload = `{
    benefitConsumptionStatusCounts(payrollUuid: "${payrollUuid}")
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_BENEFIT_STATUS_COUNTS')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      return parseBenefitConsumptionStatusCounts(
        action?.payload?.data?.benefitConsumptionStatusCounts,
      );
    },
    () => null,
  );
}

/**
 * Chargement léger modale (KPI + flags, sans liste).
 * payroll est une Connection (edges/node), comme fetchPayroll.
 */
export function fetchPayrollApprovedPaymentModalThunk(payrollId) {
  return async (dispatch) => {
    const [row, statusCounts] = await Promise.all([
      fetchPayrollModalConnectionThunk(
        payrollId,
        PAYROLL_APPROVED_MODAL_PROJECTION,
        'PAYROLL_APPROVED_MODAL_FETCH',
      )(dispatch),
      fetchBenefitConsumptionStatusCountsThunk(payrollId)(dispatch),
    ]);
    if (!row) return null;
    return {
      ...row,
      benefitConsumptionStatusCounts: statusCounts ?? {},
    };
  };
}

/**
 * Progression Celery dédiée (prioritaire si exposée par le backend).
 */
export function fetchPayrollPaymentProgressThunk(payrollId) {
  const payload = `{
    payrollPaymentProgress(payrollId: "${payrollId}")
    payroll(first: 1, id: "${payrollId}") {
      edges {
        node {
          paymentInProgress
        }
      }
    }
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_PAYMENT_PROGRESS_POLL')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      const raw = action?.payload?.data?.payrollPaymentProgress;
      const paymentProgress = parsePayrollProgress(raw);
      if (!paymentProgress) return null;
      const payrollNode = parseData(action?.payload?.data?.payroll)?.[0];
      const payrollFlagActive = payrollNode?.paymentInProgress === true
        || payrollNode?.paymentInProgress === 'true'
        || payrollNode?.paymentInProgress === 1;
      const progressTerminal = ['COMPLETED', 'FAILED', 'CANCELLED', 'STALE'].includes(
        paymentProgress.status,
      );
      const staleWhileRunning = paymentProgress.status === 'STALE' && payrollFlagActive;
      return {
        id: payrollId,
        paymentProgress,
        paymentInProgress: payrollFlagActive
          || paymentProgress.status === 'IN_PROGRESS'
          || paymentProgress.status === 'FINALIZING',
        shouldStopPolling: (paymentProgress.shouldStopPolling || progressTerminal)
          && !staleWhileRunning,
      };
    },
    () => null,
  );
}

export function fetchPayrollReconciliationProgressThunk(payrollId) {
  const payload = `{
    payrollReconciliationProgress(payrollId: "${payrollId}")
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_RECONCILIATION_PROGRESS_POLL')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) return null;
      const raw = action?.payload?.data?.payrollReconciliationProgress;
      const reconciliationProgress = parsePayrollProgress(raw);
      if (!reconciliationProgress) return null;
      return {
        id: payrollId,
        reconciliationProgress,
        reconciliationInProgress: reconciliationProgress.status === 'IN_PROGRESS'
          || reconciliationProgress.status === 'FINALIZING',
        shouldStopPolling: reconciliationProgress.shouldStopPolling
          || ['COMPLETED', 'FAILED', 'CANCELLED', 'STALE'].includes(reconciliationProgress.status),
      };
    },
    () => null,
  );
}

export function fetchPayrollModalPollThunk(payrollId, { preferPaymentProgress = false } = {}) {
  return async (dispatch) => {
    if (preferPaymentProgress) {
      const paymentOnly = await fetchPayrollPaymentProgressThunk(payrollId)(dispatch);
      if (paymentOnly) return paymentOnly;
    }

    const row = await fetchPayrollModalConnectionThunk(
      payrollId,
      PAYROLL_MODAL_POLL_PROJECTION,
      'PAYROLL_APPROVED_MODAL_POLL',
    )(dispatch);

    if (!row) return null;
    return {
      ...row,
      shouldStopPolling: shouldStopPollingPayroll(row),
    };
  };
}

/**
 * Chargement léger en-tête modale (sans benefitConsumption en masse).
 */
export function fetchPayrollSummaryThunk(payrollId, projections = PAYROLL_SUMMARY_PROJECTION) {
  return fetchPayrollModalConnectionThunk(
    payrollId,
    projections,
    'PAYROLL_SUMMARY_FETCH',
  );
}

/**
 * Modale paiements réconciliés : KPI + reconciliationRecap.
 */
export function fetchPayrollReconciledModalThunk(payrollId) {
  return (dispatch) => fetchPayrollModalConnectionThunk(
    payrollId,
    PAYROLL_RECONCILED_MODAL_PROJECTION,
    'PAYROLL_RECONCILED_MODAL_FETCH',
  )(dispatch).then((row) => {
    if (!row) return null;
    return {
      ...row,
      paymentReconciledModalSummary: parsePaymentApprovedModalSummary(
        row.paymentReconciledModalSummary,
      ),
    };
  });
}

/**
 * Liste paginée benefitConsumptionByPayroll (+ compteurs par statut).
 */
export function fetchBenefitConsumptionByPayrollPageThunk(
  payrollUuid,
  { benefitStatus = null, first = 25, after = null } = {},
) {
  const afterPart = after ? `after: "${after}"` : '';
  const benefitStatusPart = benefitStatus ? `benefitStatus: "${benefitStatus}"` : '';
  const payload = `{
    benefitConsumptionStatusCounts(payrollUuid: "${payrollUuid}")
    benefitConsumptionByPayroll(
      payrollUuid: "${payrollUuid}"
      ${benefitStatusPart}
      first: ${first}
      ${afterPart}
      orderBy: ["code"]
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          ${BENEFIT_CONSUMPTION_LIST_PROJECTION.join('\n          ')}
        }
      }
    }
  }`;

  return (dispatch) => graphql(payload, 'PAYROLL_BENEFIT_CONSUMPTION_BY_PAYROLL_LIST')(
    dispatch,
  ).then(
    (action) => {
      if (action?.error || action?.payload?.errors) {
        return {
          items: [], statusCounts: {}, pageInfo: {}, totalCount: 0, error: true,
        };
      }
      const data = action?.payload?.data ?? {};
      const connection = data.benefitConsumptionByPayroll;
      const items = parseData(connection)?.map((node) => ({
        ...node,
        id: node.id ? decodeId(node.id) : node.id,
      })) ?? [];
      return {
        items,
        statusCounts: parseBenefitConsumptionStatusCounts(
          data.benefitConsumptionStatusCounts,
        ),
        pageInfo: connection?.pageInfo ?? {},
        totalCount: connection?.totalCount ?? 0,
        error: false,
      };
    },
    () => ({
      items: [], statusCounts: {}, pageInfo: {}, totalCount: 0, error: true,
    }),
  );
}

/** @deprecated Utiliser fetchBenefitConsumptionByPayrollPageThunk */
export function fetchApprovedPaymentsPageThunk(payrollUuid, options = {}) {
  return fetchBenefitConsumptionByPayrollPageThunk(payrollUuid, {
    ...options,
    benefitStatus: 'APPROVE_FOR_PAYMENT',
  });
}
