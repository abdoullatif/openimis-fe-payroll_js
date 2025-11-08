/* eslint-disable max-len */
/* eslint-disable no-return-assign */
/* eslint-disable no-param-reassign */
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import PrintIcon from '@material-ui/icons/Print';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import {
  Typography, Button,
} from '@material-ui/core';

import {
  Searcher, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import PhotoCameraOutlinedIcon from '@material-ui/icons/PhotoCameraOutlined';
import { fetchBenefitConsumptions } from '../../actions';
import { BENEFIT_CONSUMPTION_STATUS, DEFAULT_PAGE_SIZE, ROWS_PER_PAGE_OPTIONS } from '../../constants';
import BenefitConsumptionFilter from './BenefitConsumptionFilter';
import AdditionalFieldsDialog from './dialogs/AdditionalFieldsDialog';
import PayrollPrintTemplate from '../PayrollPrintTemplate';

function BenefitConsumptionSearcher({
  fetchBenefitConsumptions,
  fetchingBenefitConsumptions,
  fetchedBenefitConsumptions,
  errorBenefitConsumptions,
  benefitConsumptions,
  benefitConsumptionsPageInfo,
  benefitConsumptionsTotalCount,
  isPayrollFromFailedInvoices,
  payrollUuid,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations('payroll', modulesManager);
  const payrollPrintTemplateRef = useRef(null);

  const handlePrint = useReactToPrint({
    documentTitle: `${payrollUuid}`,
  });

  const fetch = (params) => fetchBenefitConsumptions(modulesManager, params);

  const headers = () => [
    'benefitConsumption.individual.firstName',
    'benefitConsumption.individual.lastName',
    'benefitConsumption.photo',
    'benefitConsumption.code',
    'benefitConsumption.dateDue',
    'benefitConsumption.receipt',
    'benefitConsumption.amount',
    'benefitConsumption.type',
    'benefitConsumption.status',
    'benefitConsumption.payedOnTime',
    'benefitConsumption.paymentDate',
    '',
  ];

  const checkBenefitDueDate = (benefitConsumption) => {
    if (!benefitConsumption.receipt) {
      return ''; // return empty string if datePayed is null
    }

    return (
      benefitConsumption
      && benefitConsumption.dateDue
      >= benefitConsumption.benefitAttachment[0].bill.datePayed)
      ? 'True' : 'False';
  };

  const itemFormatters = () => [
    (benefitConsumption) => benefitConsumption?.individual?.firstName,
    (benefitConsumption) => benefitConsumption?.individual?.lastName,
    (benefitConsumption) => (
      benefitConsumption.receipt ? (
        <PhotoCameraOutlinedIcon style={{ fontSize: 150 }} />
      ) : null
    ),
    (benefitConsumption) => benefitConsumption?.code,
    (benefitConsumption) => benefitConsumption?.dateDue,
    (benefitConsumption) => benefitConsumption?.receipt,
    (benefitConsumption) => benefitConsumption?.amount,
    (benefitConsumption) => benefitConsumption?.type,
    (benefitConsumption) => (isPayrollFromFailedInvoices
      ? BENEFIT_CONSUMPTION_STATUS.APPROVE_FOR_PAYMENT : benefitConsumption?.status),
    (benefitConsumption) => checkBenefitDueDate(benefitConsumption),
    (benefitConsumption) => (
      !benefitConsumption.receipt
        ? ''
        : benefitConsumption?.benefitAttachment[0]?.bill?.datePayed
    ),
    (benefitConsumption) => (
      <AdditionalFieldsDialog
        jsonExt={benefitConsumption?.jsonExt}
        buttonLabel="payroll.additonalFields.showAdditionalFields"
        title="payroll.additonalFields.label"
      />
    ),
  ];

  const rowIdentifier = (benefitConsumption) => benefitConsumption.id;

  const sorts = () => [
    ['individual_FirstName', true],
    ['individual_LastName', true],
    ['photo', true],
    ['code', true],
    ['dateDue', true],
    ['receipt', true],
    ['amount', true],
    ['type', true],
    ['status', true],
  ];

  const defaultFilters = () => {
    const filters = {
      isDeleted: {
        value: false,
        filter:
        'isDeleted: false',
      },
      payrollUuid: {
        value: payrollUuid,
        filter:
        `payrollUuid: "${payrollUuid}"`,
      },
    };
    if (isPayrollFromFailedInvoices) {
      filters.status = {
        value: true,
        filter:
        `filterOnlyUnpaid: ${true}`,
      };
    }
    return filters;
  };

  const benefitConsumptionFilter = ({ filters, onChangeFilters }) => (
    <BenefitConsumptionFilter filters={filters} onChangeFilters={onChangeFilters} />
  );

  return (
    <>
      <div>
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={(e) => {
            e.preventDefault();
            handlePrint(null, () => payrollPrintTemplateRef.current);
          }}
        >
          <Typography variant="subtitle1">{formatMessage('payroll.tooltip.print')}</Typography>
        </Button>
      </div>
      <div>
        <Searcher
          module="payroll"
          FilterPane={!isPayrollFromFailedInvoices && benefitConsumptionFilter}
          fetch={fetch}
          items={benefitConsumptions}
          itemsPageInfo={benefitConsumptionsPageInfo}
          fetchingItems={fetchingBenefitConsumptions}
          fetchedItems={fetchedBenefitConsumptions}
          errorItems={errorBenefitConsumptions}
          tableTitle={formatMessageWithValues('benefitConsumption.searcherResultsTitle', { benefitConsumptionsTotalCount })}
          headers={headers}
          itemFormatters={itemFormatters}
          sorts={sorts}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          rowIdentifier={rowIdentifier}
          defaultFilters={defaultFilters()}
        />
        <div style={{ display: 'none' }}>
          <PayrollPrintTemplate
            ref={payrollPrintTemplateRef}
            benefitConsumptions={benefitConsumptions}
          />
        </div>
      </div>
    </>
  );
}

const mapStateToProps = (state) => ({
  fetchingBenefitConsumptions: state.payroll.fetchingBenefitConsumptions,
  fetchedBenefitConsumptions: state.payroll.fetchedBenefitConsumptions,
  errorBenefitConsumptions: state.payroll.errorBenefitConsumptions,
  benefitConsumptions: state.payroll.benefitConsumptions,
  benefitConsumptionsPageInfo: state.payroll.benefitConsumptionsPageInfo,
  benefitConsumptionsTotalCount: state.payroll.benefitConsumptionsTotalCount,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  { fetchBenefitConsumptions },
  dispatch,
);

export default connect(mapStateToProps, mapDispatchToProps)(BenefitConsumptionSearcher);
