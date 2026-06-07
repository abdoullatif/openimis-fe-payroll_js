/* eslint-disable max-len */
import {
  decodeId,
  formatGQLString,
  formatMutation,
  formatPageQuery,
  formatPageQueryWithCount,
  formatQuery,
  graphql,
} from '@openimis/fe-core';

import { ACTION_TYPE, MUTATION_SERVICE } from './reducer';
import {
  CLEAR, ERROR, REQUEST, SUCCESS,
} from './utils/action-type';
import { isBase64Encoded } from './utils/advanced-filters-utils';
import { generateClientMutationId } from './utils/payrollCreationProgress';
import { PAYROLL_STATUS } from './constants';

export const PAYMENT_POINT_PROJECTION = (modulesManager) => [
  'id',
  'name',
  'isDeleted',
  `location ${modulesManager.getProjection('location.Location.FlatProjection')}`,
  `ppm ${modulesManager.getProjection('admin.UserPicker.projection')}`,
];

const BENEFIT_CONSUMPTION_PROJECTION = () => [
  'id',
  'isDeleted',
  'jsonExt',
  'dateCreated',
  'dateUpdated',
  'dateValidFrom',
  'dateValidTo',
  'id',
  'code',
  'individual {firstName, lastName}',
  'benefitAttachment {bill {id, code, terms, datePayed}}',
  'receipt',
  'photo',
  'amount',
  'type',
  'status',
  'dateDue',
];

const PAYROLL_BENEFIT_CONSUMPTION_PROJECTION = () => [
  'id',
  // eslint-disable-next-line max-len
  'benefit{id,isDeleted,jsonExt,dateCreated,dateUpdated,dateValidFrom,dateValidTo,id,code,individual {firstName, lastName},benefitAttachment {bill {id, code, terms, datePayed}},receipt,photo,amount,type,status,dateDue}',
  'payroll {id, name, status, paymentCycle {code, startDate, endDate}, paymentMethod, benefitPlanNameCode}',
];

const BENEFIT_CONSUMPTION_SUMMARY_PROJECTION = () => [
  'totalAmountReceived', 'totalAmountDue',
];

const BENEFIT_ATTACHMENT_PROJECTION = () => [
  'benefit{id, status, code, dateDue, receipt, individual {firstName, lastName}, jsonExt, type, status, amount, receipt}',
  'bill{id, code, terms, amountTotal, datePayed}',
];

const PAYROLL_PROJECTION = (modulesManager) => [
  'id',
  'name',
  'paymentMethod',
  'paymentPlan { code, id, name, benefitPlan }',
  `paymentPoint { ${PAYMENT_POINT_PROJECTION(modulesManager).join(' ')} }`,
  'paymentCycle { code, startDate, endDate }',
  // eslint-disable-next-line max-len
  'benefitConsumption{id, status, code, dateDue, receipt, jsonExt, individual {firstName, lastName}, benefitAttachment{bill{id, code, terms, amountTotal}}}',
  'jsonExt',
  'status',
  'dateValidFrom',
  'dateValidTo',
  'isDeleted',
  'reconciliationInProgress',
  'paymentInProgress',
  'reconciliationLocked',
  'hasPaymentReport',
  'reconciliationLastCompletedAt',
  'reconciliationLastSummary',
  'reconciledBenefitCount',
  'beneficesTrouves',
  'beneficiairesSelectionnes',
  'benefitConsumptionTotalCount',
  'benefitConsumptionTruncated',
  'reconciliationRecap',
  'canClosePayroll',
  'closePayrollBlockers',
  'creationProgress',
  'paymentProgress',
  'reconciliationProgress',
  'paymentApprovedModalSummary',
];

/** Champs légers pour le polling opérations (même liste — pas de grosses listes). */
export const PAYROLL_PROGRESS_PROJECTION = (modulesManager) => PAYROLL_PROJECTION(modulesManager);

const PAYROLL_SEARCHER_PROJECTION = (modulesManager) => [
  'id',
  'name',
  'paymentMethod',
  'paymentPlan { code, id, name, benefitPlan }',
  `paymentPoint { ${PAYMENT_POINT_PROJECTION(modulesManager).join(' ')} }`,
  'paymentCycle { code, startDate, endDate }',
  'jsonExt',
  'status',
  'dateValidFrom',
  'dateValidTo',
  'isDeleted',
];

const CSV_RECONCILIATION_PROJECTION = () => [
  'fileName',
  'status',
  'error',
  'jsonExt',
];

const PAYMENT_METHOD_PROJECTION = () => [
  'paymentMethods {name}',
];

const formatPaymentPointGQL = (paymentPoint) => `
  ${paymentPoint?.id ? `id: "${paymentPoint.id}"` : ''}
  ${paymentPoint?.name ? `name: "${formatGQLString(paymentPoint.name)}"` : ''}
  ${paymentPoint?.location ? `locationId: ${decodeId(paymentPoint.location.id)}` : ''}
  ${paymentPoint?.ppm ? `ppmId: "${decodeId(paymentPoint.ppm.id)}"` : ''}
  `;

const formatPayrollGQL = (payroll) => `
  ${payroll?.id ? `id: "${payroll.id}"` : ''}
  ${payroll?.name ? `name: "${formatGQLString(payroll.name)}"` : ''}
  ${payroll?.paymentPoint ? `paymentPointId: "${decodeId(payroll.paymentPoint.id)}"` : ''}
  ${payroll?.paymentPlan ? `paymentPlanId: "${decodeId(payroll.paymentPlan.id)}"` : ''}
  ${payroll?.paymentCycle ? `paymentCycleId: "${decodeId(payroll.paymentCycle.id)}"` : ''}
  ${payroll?.paymentMethod ? `paymentMethod: "${payroll.paymentMethod}"` : ''}
  ${`status: ${PAYROLL_STATUS.PENDING_APPROVAL}`}
  ${
  payroll?.jsonExt
    ? `jsonExt: ${JSON.stringify(payroll.jsonExt)}`
    : ''
}
  ${
  payroll?.dateValidFrom
    ? `dateValidFrom: "${payroll.dateValidFrom}"`
    : ''
}
  ${
  payroll?.dateValidTo
    ? `dateValidTo: "${payroll.dateValidTo}"`
    : ''
}
  ${
  payroll?.fromFailedInvoicesPayrollId
    ? `fromFailedInvoicesPayrollId: "${payroll.fromFailedInvoicesPayrollId}"`
    : ''
}
  `;

/**
 * Same as fe-core formatMutation but allows a fixed clientMutationId (for payroll creation progress).
 */
function formatMutationWithClientMutationId(
  operationName,
  input,
  clientMutationLabel,
  clientMutationId,
) {
  const id = clientMutationId || generateClientMutationId();
  const payload = `
    mutation {
      ${operationName}(
        input: {
          clientMutationId: "${id}"
          clientMutationLabel: "${clientMutationLabel}"
          ${input.trim()}
        }
      ) {
        clientMutationId
        internalId
      }
    }`;
  return { clientMutationId: id, payload };
}

const PERFORM_MUTATION = (
  mutationType,
  mutationInput,
  ACTION,
  clientMutationLabel,
  fixedClientMutationId = null,
) => {
  const mutation = fixedClientMutationId
    ? formatMutationWithClientMutationId(
      mutationType,
      mutationInput,
      clientMutationLabel,
      fixedClientMutationId,
    )
    : formatMutation(mutationType, mutationInput, clientMutationLabel);
  const requestedDateTime = new Date();
  return graphql(
    mutation.payload,
    [REQUEST(ACTION_TYPE.MUTATION), SUCCESS(ACTION), ERROR(ACTION_TYPE.MUTATION)],
    {
      actionType: ACTION,
      clientMutationId: mutation.clientMutationId,
      clientMutationLabel,
      requestedDateTime,
    },
  );
};

export function fetchPaymentPoints(modulesManager, params) {
  const payload = formatPageQueryWithCount('paymentPoint', params, PAYMENT_POINT_PROJECTION(modulesManager));
  return graphql(payload, ACTION_TYPE.SEARCH_PAYMENT_POINTS);
}

export function fetchPaymentPoint(modulesManager, params) {
  const payload = formatPageQueryWithCount('paymentPoint', params, PAYMENT_POINT_PROJECTION(modulesManager));
  return graphql(payload, ACTION_TYPE.GET_PAYMENT_POINT);
}

export function fetchPayrollPaymentFiles(modulesManager, params) {
  const payload = formatPageQueryWithCount('csvReconciliationUpload', params, CSV_RECONCILIATION_PROJECTION());
  return graphql(payload, ACTION_TYPE.GET_PAYROLL_PAYMENT_FILES);
}

export const clearPaymentPoint = () => (dispatch) => {
  dispatch({
    type: CLEAR(ACTION_TYPE.GET_PAYMENT_POINT),
  });
};

export function deletePaymentPoint(paymentPoint, clientMutationLabel) {
  const paymentPointUuids = `ids: ["${paymentPoint?.id}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYMENT_POINT.DELETE,
    paymentPointUuids,
    ACTION_TYPE.DELETE_PAYMENT_POINT,
    clientMutationLabel,
  );
}

export function createPaymentPoint(paymentPoint, clientMutationLabel) {
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYMENT_POINT.CREATE,
    formatPaymentPointGQL(paymentPoint),
    ACTION_TYPE.CREATE_PAYMENT_POINT,
    clientMutationLabel,
  );
}

export function updatePaymentPoint(paymentPoint, clientMutationLabel) {
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYMENT_POINT.UPDATE,
    formatPaymentPointGQL(paymentPoint),
    ACTION_TYPE.UPDATE_PAYMENT_POINT,
    clientMutationLabel,
  );
}

export function fetchPayrolls(modulesManager, params) {
  const payload = formatPageQueryWithCount('payroll', params, PAYROLL_SEARCHER_PROJECTION(modulesManager));
  return graphql(payload, ACTION_TYPE.SEARCH_PAYROLLS);
}

export function fetchPayroll(modulesManager, params) {
  const payload = formatPageQueryWithCount('payroll', params, PAYROLL_PROJECTION(modulesManager));
  return graphql(payload, ACTION_TYPE.GET_PAYROLL);
}

export function deletePayrolls(payroll, clientMutationLabel) {
  const uuid = isBase64Encoded(payroll.id) ? decodeId(payroll?.id) : payroll?.id;
  const payrollUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.DELETE,
    payrollUuids,
    ACTION_TYPE.DELETE_PAYROLL,
    clientMutationLabel,
  );
}

export function deleteBenefitConsumption(benefit, clientMutationLabel) {
  const uuid = isBase64Encoded(benefit.id) ? decodeId(benefit?.id) : benefit?.id;
  const benefitUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.BENEFIT_CONSUMPTION.DELETE,
    benefitUuids,
    ACTION_TYPE.DELETE_BENEFIT_CONSUMPTION,
    clientMutationLabel,
  );
}

export function createPayroll(payroll, clientMutationLabel) {
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.CREATE,
    formatPayrollGQL(payroll),
    ACTION_TYPE.CREATE_PAYROLL,
    clientMutationLabel,
    payroll?.clientMutationId ?? null,
  );
}

export function fetchBenefitConsumptions(modulesManager, params) {
  const payload = formatPageQueryWithCount('benefitConsumptionByPayroll', params, BENEFIT_CONSUMPTION_PROJECTION());
  return graphql(payload, ACTION_TYPE.GET_BENEFIT_CONSUMPTION);
}

export function fetchBenefitAttachments(modulesManager, params) {
  const payload = formatPageQueryWithCount('benefitAttachmentByPayroll', params, BENEFIT_ATTACHMENT_PROJECTION());
  return graphql(payload, ACTION_TYPE.GET_BENEFIT_ATTACHMENT);
}

export function fetchPayrollBenefitConsumptions(modulesManager, params) {
  // eslint-disable-next-line max-len
  const payload = formatPageQueryWithCount('payrollBenefitConsumption', params, PAYROLL_BENEFIT_CONSUMPTION_PROJECTION());
  return graphql(payload, ACTION_TYPE.GET_PAYROLL_BENEFIT_CONSUMPTION);
}

export function fetchBenefitsSummary(params) {
  const payload = formatQuery(
    'benefitsSummary',
    params,
    BENEFIT_CONSUMPTION_SUMMARY_PROJECTION(),
  );
  return graphql(payload, ACTION_TYPE.BENEFITS_SUMMARY);
}

export const clearPayrollBills = () => (dispatch) => {
  dispatch({
    type: CLEAR(ACTION_TYPE.GET_BENEFIT_CONSUMPTION),
  });
};

export const clearPayroll = () => (dispatch) => {
  dispatch({
    type: CLEAR(ACTION_TYPE.GET_PAYROLL),
  });
};

export function fetchPaymentMethods(params) {
  const payload = formatQuery('paymentMethods', params, PAYMENT_METHOD_PROJECTION());
  return graphql(payload, ACTION_TYPE.GET_PAYMENT_METHODS);
}

export function closePayroll(payroll, clientMutationLabel) {
  const payrollUuids = `ids: ["${payroll?.id}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.CLOSE,
    payrollUuids,
    ACTION_TYPE.CLOSE_PAYROLL,
    clientMutationLabel,
  );
}

export function rejectPayroll(payroll, clientMutationLabel) {
  const payrollUuids = `ids: ["${payroll?.id}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.REJECT,
    payrollUuids,
    ACTION_TYPE.REJECT_PAYROLL,
    clientMutationLabel,
  );
}

export function makePaymentForPayroll(payroll, clientMutationLabel, clientMutationId = null) {
  const uuid = isBase64Encoded(payroll?.id) ? decodeId(payroll?.id) : payroll?.id;
  const payrollUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.MAKE_PAYMENT,
    payrollUuids,
    ACTION_TYPE.MAKE_PAYMENT_PAYROLL,
    clientMutationLabel,
    clientMutationId,
  );
}

export function triggerPayrollReconciliation(payroll, clientMutationLabel, clientMutationId = null) {
  const uuid = isBase64Encoded(payroll?.id) ? decodeId(payroll?.id) : payroll?.id;
  const payrollUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.TRIGGER_RECONCILIATION,
    payrollUuids,
    ACTION_TYPE.TRIGGER_PAYROLL_RECONCILIATION,
    clientMutationLabel,
    clientMutationId,
  );
}

export function cancelPayrollPayment(payroll, clientMutationLabel, reason = '', clientMutationId = null) {
  const uuid = isBase64Encoded(payroll?.id) ? decodeId(payroll?.id) : payroll?.id;
  const reasonPart = reason ? `reason: "${formatGQLString(reason)}"` : '';
  const payrollUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.CANCEL_PAYMENT,
    `${payrollUuids} ${reasonPart}`,
    ACTION_TYPE.CANCEL_PAYROLL_PAYMENT,
    clientMutationLabel,
    clientMutationId,
  );
}

export function fetchPayrollFilterSuggestions(search) {
  const payload = formatPageQuery(
    'payroll',
    [
      'first: 15',
      'isDeleted: false',
      `name_Icontains: "${formatGQLString(search)}"`,
    ],
    ['id', 'name', 'paymentPlan { code name }'],
  );
  return (dispatch) => graphql(payload, 'PAYROLL_FILTER_SUGGESTIONS')(
    dispatch,
  ).then((action) => {
    if (action?.error || action?.payload?.errors) return [];
    const edges = action?.payload?.data?.payroll?.edges ?? [];
    return edges.map(({ node }) => {
      const planCode = node?.paymentPlan?.code ?? '';
      const label = planCode ? `${node.name} (${planCode})` : node.name;
      return { label, value: node.name };
    });
  });
}

export function cancelPayrollReconciliation(payroll, clientMutationLabel, reason = '', clientMutationId = null) {
  const uuid = isBase64Encoded(payroll?.id) ? decodeId(payroll?.id) : payroll?.id;
  const reasonPart = reason ? `reason: "${formatGQLString(reason)}"` : '';
  const payrollUuids = `ids: ["${uuid}"]`;
  return PERFORM_MUTATION(
    MUTATION_SERVICE.PAYROLL.CANCEL_RECONCILIATION,
    `${payrollUuids} ${reasonPart}`,
    ACTION_TYPE.CANCEL_PAYROLL_RECONCILIATION,
    clientMutationLabel,
    clientMutationId,
  );
}
