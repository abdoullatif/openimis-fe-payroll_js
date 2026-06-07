/* eslint-disable default-param-last */

import {
  dispatchMutationErr,
  dispatchMutationReq,
  dispatchMutationResp,
  formatGraphQLError,
  formatServerError,
  pageInfo,
  parseData,
  decodeId,
} from '@openimis/fe-core';
import {
  CLEAR, ERROR, REQUEST, SUCCESS,
} from './utils/action-type';

export const ACTION_TYPE = {
  MUTATION: 'PAYROLL_MUTATION',
  CREATE_PAYMENT_POINT: 'PAYROLL_MUTATION_CREATE_PAYMENT_POINT',
  DELETE_PAYMENT_POINT: 'PAYROLL_MUTATION_DELETE_PAYMENT_POINT',
  UPDATE_PAYMENT_POINT: 'PAYROLL_MUTATION_UPDATE_PAYMENT_POINT',
  SEARCH_PAYMENT_POINTS: 'PAYROLL_PAYMENT_POINTS',
  CREATE_PAYROLL: 'PAYROLL_MUTATION_CREATE_PAYROLL',
  DELETE_PAYROLL: 'PAYROLL_MUTATION_DELETE_PAYROLL',
  SEARCH_PAYROLLS: 'PAYROLL_PAYROLLS',
  GET_PAYMENT_POINT: 'PAYROLL_PAYMENT_POINT',
  GET_PAYROLL: 'PAYROLL_GET_PAYROLL',
  GET_BENEFIT_CONSUMPTION: 'PAYROLL_BENEFIT_CONSUMPTION',
  GET_PAYROLL_BENEFIT_CONSUMPTION: 'PAYROLL_PAYROLL_BENEFIT_CONSUMPTION',
  GET_BENEFIT_ATTACHMENT: 'PAYROLL_BENEFIT_ATTACHMENT',
  GET_PAYMENT_METHODS: 'PAYROLL_PAYMENT_METHODS',
  CLOSE_PAYROLL: 'PAYROLL_MUTATION_CLOSE_PAYROLL',
  REJECT_PAYROLL: 'PAYROLL_MUTATION_REJECT_PAYROLL',
  MAKE_PAYMENT_PAYROLL: 'PAYROLL_MUTATION_MAKE_PAYMENT_PAYROLL',
  TRIGGER_PAYROLL_RECONCILIATION: 'PAYROLL_MUTATION_TRIGGER_PAYROLL_RECONCILIATION',
  CANCEL_PAYROLL_PAYMENT: 'PAYROLL_MUTATION_CANCEL_PAYROLL_PAYMENT',
  CANCEL_PAYROLL_RECONCILIATION: 'PAYROLL_MUTATION_CANCEL_PAYROLL_RECONCILIATION',
  GET_PAYROLL_PAYMENT_FILES: 'GET_PAYROLL_PAYMENT_FILES',
  BENEFITS_SUMMARY: 'PAYROLL_BENEFITS_SUMMARY',
  DELETE_BENEFIT_CONSUMPTION: 'BENEFIT_CONSUMPTION_MUTATION_DELETE_BENEFIT_CONSUMPTION',
};

export const MUTATION_SERVICE = {
  PAYMENT_POINT: {
    CREATE: 'createPaymentPoint',
    DELETE: 'deletePaymentPoint',
    UPDATE: 'updatePaymentPoint',
  },
  PAYROLL: {
    CREATE: 'createPayroll',
    DELETE: 'deletePayroll',
    CLOSE: 'closePayroll',
    REJECT: 'rejectPayroll',
    MAKE_PAYMENT: 'makePaymentForPayroll',
    TRIGGER_RECONCILIATION: 'triggerPayrollReconciliation',
    CANCEL_PAYMENT: 'cancelPayrollPayment',
    CANCEL_RECONCILIATION: 'cancelPayrollReconciliation',
  },
  BENEFIT_CONSUMPTION: {
    DELETE: 'deleteBenefitConsumption',
  },
};

const STORE_STATE = {
  submittingMutation: false,
  mutation: {},
  fetchingPaymentPoints: false,
  fetchedPaymentPoints: false,
  errorPaymentPoints: null,
  paymentPoints: [],
  paymentPointsPageInfo: {},
  paymentPointsTotalCount: 0,
  fetchingPaymentPoint: false,
  fetchedPaymentPoint: false,
  paymentPoint: {},
  errorPaymentPoint: null,

  fetchingPayrolls: false,
  fetchedPayrolls: false,
  errorPayrolls: null,
  payrolls: [],
  payrollsPageInfo: {},
  payrollsTotalCount: 0,

  fetchingPayroll: false,
  fetchedPayroll: false,
  payroll: {},
  errorPayroll: null,

  fetchingBenefitConsumptions: true,
  benefitConsumption: [],
  benefitConsumptionTotalCount: 0,
  fetchedBenefitConsumption: false,
  errorBenefitConsumption: null,
  benefitConsumptionsPageInfo: {},

  fetchingBenefitAttachments: false,
  benefitAttachments: [],
  benefitAttachmentsTotalCount: 0,
  fetchedBenefitAttachments: false,
  errorBenefitAttachments: null,
  benefitAttachmentsPageInfo: {},

  fetchingPaymentMethods: true,
  paymentMethods: [],
  fetchedPaymentMethods: false,
  errorPaymentMethods: null,

  fetchingPayrollFiles: false,
  fetchedPayrollFiles: false,
  errorPayrollFiles: null,
  payrollFiles: [],
  payrollFilesPageInfo: {},
  payrollFilesTotalCount: 0,

  fetchingPayrollBenefitConsumptions: true,
  payrollBenefitConsumption: [],
  payrollBenefitConsumptionTotalCount: 0,
  fetchedPayrollBenefitConsumption: false,
  errorPayrollBenefitConsumption: null,
  payrollBenefitConsumptionsPageInfo: {},

  benefitsSummary: [],
  benefitsSummaryError: null,
  fetchingBenefitsSummary: true,
  fetchedBenefitsSummary: false,
};

function reducer(
  state = STORE_STATE,
  action,
) {
  switch (action.type) {
    case REQUEST(ACTION_TYPE.SEARCH_PAYMENT_POINTS):
      return {
        ...state,
        fetchingPaymentPoints: true,
        fetchedPaymentPoints: false,
        paymentPoints: [],
        errorPaymentPoints: null,
        paymentPointsPageInfo: {},
        paymentPointsTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PAYMENT_POINTS):
      return {
        ...state,
        paymentPoints: parseData(action.payload.data.paymentPoint)?.map((paymentPoint) => ({
          ...paymentPoint,
          id: decodeId(paymentPoint.id),
        })),
        fetchingPaymentPoints: false,
        fetchedPaymentPoints: true,
        errorPaymentPoints: formatGraphQLError(action.payload),
        paymentPointsPageInfo: pageInfo(action.payload.data.paymentPoint),
        paymentPointsTotalCount: action.payload.data.paymentPoint?.totalCount ?? 0,
      };
    case ERROR(ACTION_TYPE.SEARCH_PAYMENT_POINTS):
      return {
        ...state,
        fetchingPaymentPoints: false,
        errorPaymentPoints: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.SEARCH_PAYROLLS):
      return {
        ...state,
        fetchingPayrolls: true,
        fetchedPayrolls: false,
        payrolls: [],
        errorPayrolls: null,
        payrollsPageInfo: {},
        payrollsTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.SEARCH_PAYROLLS):
      return {
        ...state,
        payrolls: parseData(action.payload.data.payroll)?.map((payroll) => ({
          ...payroll,
          id: decodeId(payroll.id),
        })),
        fetchingPayrolls: false,
        fetchedPayrolls: true,
        errorPayrolls: formatGraphQLError(action.payload),
        payrollsPageInfo: pageInfo(action.payload.data.payroll),
        payrollsTotalCount: action.payload.data.payroll?.totalCount ?? 0,
      };
    case ERROR(ACTION_TYPE.SEARCH_PAYROLLS):
      return {
        ...state,
        fetchingPayrolls: false,
        errorPayrolls: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.GET_PAYMENT_POINT):
      return {
        ...state,
        fetchingPaymentPoint: true,
        fetchedPaymentPoint: false,
        paymentPoint: [],
        errorPaymentPoint: null,
      };
    case SUCCESS(ACTION_TYPE.GET_PAYMENT_POINT):
      return {
        ...state,
        fetchingPaymentPoint: false,
        fetchedPaymentPoint: true,
        paymentPoint: parseData(action.payload.data.paymentPoint)?.map((paymentPoint) => ({
          ...paymentPoint,
          id: decodeId(paymentPoint.id),
        }))?.[0],
        errorPaymentPoint: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_PAYMENT_POINT):
      return {
        ...state,
        fetchingPaymentPoint: false,
        errorPaymentPoint: formatServerError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_PAYMENT_POINT):
      return {
        ...state,
        fetchingPaymentPoint: false,
        fetchedPaymentPoint: false,
        paymentPoint: {},
        errorPaymentPoint: null,
      };
    case REQUEST(ACTION_TYPE.GET_PAYROLL):
      return {
        ...state,
        fetchingPayroll: true,
        fetchedPayroll: false,
        payroll: {},
        errorPayroll: null,
      };
    case SUCCESS(ACTION_TYPE.GET_PAYROLL):
      return {
        ...state,
        fetchingPayroll: false,
        fetchedPayroll: true,
        payroll: parseData(action.payload.data.payroll)?.map((payroll) => ({
          ...payroll,
          id: decodeId(payroll.id),
          dateValidTo: payroll?.dateValidTo ? payroll?.dateValidTo.split('T')[0] : null,
          dateValidFrom: payroll?.dateValidFrom ? payroll?.dateValidFrom.split('T')[0] : null,
        }))?.[0],
        errorPayroll: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_PAYROLL):
      return {
        ...state,
        fetchingPayroll: false,
        errorPayroll: formatServerError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_PAYROLL):
      return {
        ...state,
        fetchingPayroll: true,
        fetchedPayroll: false,
        payroll: null,
        errorPayroll: null,
        payrollBills: [],
      };
    case REQUEST(ACTION_TYPE.GET_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingBenefitConsumptions: true,
        fetchedBenefitConsumptions: false,
        benefitConsumptions: [],
        errorBenefitConsumptions: null,
        benefitConsumptionsPageInfo: {},
        benefitConsumptionsTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.GET_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingBenefitConsumptions: false,
        fetchedBenefitConsumptions: true,
        benefitConsumptions: parseData(action.payload.data.benefitConsumptionByPayroll)?.map((benefitConsumption) => ({
          ...benefitConsumption,
          id: decodeId(benefitConsumption.id),
        })),
        benefitConsumptionsPageInfo: pageInfo(action.payload.data.benefitConsumptionByPayroll),
        benefitConsumptionsTotalCount: action.payload.data.benefitConsumptionByPayroll?.totalCount ?? 0,
        errorBenefitConsumptions: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingBenefitConsumptions: false,
        errorPayroll: formatServerError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingBenefitConsumptions: false,
        fetchedBenefitConsumptions: false,
        errorBenefitConsumptions: null,
        benefitConsumptions: [],
      };
    case REQUEST(ACTION_TYPE.GET_BENEFIT_ATTACHMENT):
      return {
        ...state,
        fetchingBenefitAttachments: true,
        fetchedBenefitAttachments: false,
        benefitAttachments: [],
        errorBenefitAttachments: null,
        benefitAttachmentsPageInfo: {},
        benefitAttachmentsTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.GET_BENEFIT_ATTACHMENT):
      return {
        ...state,
        fetchingBenefitAttachments: false,
        fetchedBenefitAttachments: true,
        benefitAttachments: parseData(action.payload.data.benefitAttachmentByPayroll)?.map((benefitAttachment) => ({
          ...benefitAttachment,
        })),
        benefitAttachmentsPageInfo: pageInfo(action.payload.data.benefitAttachmentByPayroll),
        benefitAttachmentsTotalCount: action.payload.data.benefitAttachmentByPayroll?.totalCount ?? 0,
        errorBenefitAttachments: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_BENEFIT_ATTACHMENT):
      return {
        ...state,
        fetchingBenefitAttachments: false,
        errorBenefitAttachments: formatServerError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_BENEFIT_ATTACHMENT):
      return {
        ...state,
        fetchingBenefitAttachments: false,
        fetchedBenefitAttachments: false,
        errorBenefitAttachments: null,
        benefitAttachments: [],
      };

    case REQUEST(ACTION_TYPE.GET_PAYMENT_METHODS):
      return {
        ...state,
        fetchingPaymentMethods: true,
        fetchedPaymentMethods: false,
        paymentMethods: [],
        errorPaymentMethods: null,
      };
    case SUCCESS(ACTION_TYPE.GET_PAYMENT_METHODS):
      return {
        ...state,
        fetchingPaymentMethods: false,
        fetchedPaymentMethods: true,
        paymentMethods: action.payload.data.paymentMethods ? action.payload.data.paymentMethods.paymentMethods : [],
        errorPaymentMethods: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_PAYMENT_METHODS):
      return {
        ...state,
        fetchingPaymentMethods: false,
        errorPaymentMethods: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.GET_PAYROLL_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingPayrollBenefitConsumptions: true,
        fetchedPayrollBenefitConsumptions: false,
        payrollBenefitConsumptions: [],
        errorPayrollBenefitConsumptions: null,
        payrollBenefitConsumptionsPageInfo: {},
        payrollBenefitConsumptionsTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.GET_PAYROLL_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingPayrollBenefitConsumptions: false,
        fetchedPayrollBenefitConsumptions: true,
        // eslint-disable-next-line max-len
        payrollBenefitConsumptions: parseData(action.payload.data.payrollBenefitConsumption)?.map((payrollBenefitConsumption) => ({
          ...payrollBenefitConsumption,
          id: decodeId(payrollBenefitConsumption.id),
        })),
        payrollBenefitConsumptionsPageInfo: pageInfo(action.payload.data.payrollBenefitConsumption),
        payrollBenefitConsumptionsTotalCount: action.payload.data.payrollBenefitConsumption?.totalCount ?? 0,
        errorPayrollBenefitConsumptions: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.GET_PAYROLL_BENEFIT_CONSUMPTION):
      return {
        ...state,
        fetchingPayrollBenefitConsumptions: false,
        errorPayrollBenefitConsumptions: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.GET_PAYROLL_PAYMENT_FILES):
      return {
        ...state,
        fetchingPayrollFiles: true,
        fetchedPayrollFiles: false,
        errorPayrollFiles: null,
        payrollFiles: [],
        payrollFilesPageInfo: {},
        payrollFilesTotalCount: 0,
      };
    case SUCCESS(ACTION_TYPE.GET_PAYROLL_PAYMENT_FILES):
      return {
        ...state,
        fetchingPayrollFiles: false,
        fetchedPayrollFiles: true,
        errorPayrollFiles: formatGraphQLError(action.payload),
        payrollFiles: parseData(action.payload.data.csvReconciliationUpload)?.map((file) => ({
          ...file,
        })),
        payrollFilesPageInfo: pageInfo(action.payload.data.csvReconciliationUpload),
        payrollFilesTotalCount: action.payload.data.csvReconciliationUpload?.totalCount ?? 0,
      };
    case ERROR(ACTION_TYPE.GET_PAYROLL_PAYMENT_FILES):
      return {
        ...state,
        fetchingPayrollFiles: false,
        errorPayrollFiles: formatGraphQLError(action.payload),
      };
    case CLEAR(ACTION_TYPE.GET_PAYROLL_PAYMENT_FILES):
      return {
        ...state,
        fetchingPayrollFiles: false,
        fetchedPayrollFiles: false,
        errorPayrollFiles: null,
        payrollFiles: [],
        payrollFilesPageInfo: {},
        payrollFilesTotalCount: 0,
      };
    case REQUEST(ACTION_TYPE.BENEFITS_SUMMARY):
      return {
        ...state,
        fetchingBenefitsSummary: true,
        fetchedBenefitsSummary: false,
        benefitsSummary: {},
        benefitsSummaryError: null,
      };
    case SUCCESS(ACTION_TYPE.BENEFITS_SUMMARY):
      return {
        ...state,
        fetchingBenefitsSummary: false,
        fetchedBenefitsSummary: true,
        benefitsSummary: action.payload.data.benefitsSummary,
        benefitsSummaryError: formatGraphQLError(action.payload),
      };
    case ERROR(ACTION_TYPE.BENEFITS_SUMMARY):
      return {
        ...state,
        fetchingBenefitsSummary: false,
        benefitsSummaryError: formatServerError(action.payload),
      };
    case REQUEST(ACTION_TYPE.MUTATION):
      return dispatchMutationReq(state, action);
    case ERROR(ACTION_TYPE.MUTATION):
      return {
        ...state,
        submittingMutation: false,
        mutation: {
          ...state.mutation,
          error: formatGraphQLError(action.payload) || formatServerError(action.payload),
        },
      };
    case SUCCESS(ACTION_TYPE.CREATE_PAYMENT_POINT):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYMENT_POINT.CREATE, action);
    case SUCCESS(ACTION_TYPE.DELETE_PAYMENT_POINT):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYMENT_POINT.DELETE, action);
    case SUCCESS(ACTION_TYPE.UPDATE_PAYMENT_POINT):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYMENT_POINT.UPDATE, action);
    case SUCCESS(ACTION_TYPE.CREATE_PAYROLL):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.CREATE, action);
    case SUCCESS(ACTION_TYPE.DELETE_PAYROLL):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.DELETE, action);
    case SUCCESS(ACTION_TYPE.DELETE_BENEFIT_CONSUMPTION):
      return dispatchMutationResp(state, MUTATION_SERVICE.BENEFIT_CONSUMPTION.DELETE, action);
    case SUCCESS(ACTION_TYPE.MAKE_PAYMENT_PAYROLL):
      if (action.payload?.errors?.length
        || !action.payload?.data?.[MUTATION_SERVICE.PAYROLL.MAKE_PAYMENT]?.internalId) {
        return {
          ...state,
          submittingMutation: false,
          mutation: {
            ...state.mutation,
            error: formatGraphQLError(action.payload) || { message: 'makePaymentForPayroll failed' },
          },
        };
      }
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.MAKE_PAYMENT, action);
    case SUCCESS(ACTION_TYPE.TRIGGER_PAYROLL_RECONCILIATION):
      if (action.payload?.errors?.length
        || !action.payload?.data?.[MUTATION_SERVICE.PAYROLL.TRIGGER_RECONCILIATION]?.internalId) {
        return {
          ...state,
          submittingMutation: false,
          mutation: {
            ...state.mutation,
            error: formatGraphQLError(action.payload) || { message: 'triggerPayrollReconciliation failed' },
          },
        };
      }
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.TRIGGER_RECONCILIATION, action);
    case SUCCESS(ACTION_TYPE.CANCEL_PAYROLL_PAYMENT):
      if (action.payload?.errors?.length
        || !action.payload?.data?.[MUTATION_SERVICE.PAYROLL.CANCEL_PAYMENT]?.internalId) {
        return {
          ...state,
          submittingMutation: false,
          mutation: {
            ...state.mutation,
            error: formatGraphQLError(action.payload) || { message: 'cancelPayrollPayment failed' },
          },
        };
      }
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.CANCEL_PAYMENT, action);
    case SUCCESS(ACTION_TYPE.CANCEL_PAYROLL_RECONCILIATION):
      if (action.payload?.errors?.length
        || !action.payload?.data?.[MUTATION_SERVICE.PAYROLL.CANCEL_RECONCILIATION]?.internalId) {
        return {
          ...state,
          submittingMutation: false,
          mutation: {
            ...state.mutation,
            error: formatGraphQLError(action.payload) || { message: 'cancelPayrollReconciliation failed' },
          },
        };
      }
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.CANCEL_RECONCILIATION, action);
    case SUCCESS(ACTION_TYPE.CLOSE_PAYROLL):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.CLOSE, action);
    case SUCCESS(ACTION_TYPE.REJECT_PAYROLL):
      return dispatchMutationResp(state, MUTATION_SERVICE.PAYROLL.REJECT, action);
    default:
      return state;
  }
}

export default reducer;
