/* eslint-disable max-len */
/* eslint-disable no-param-reassign */
import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import PrintIcon from '@material-ui/icons/Print';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import Typography from '@material-ui/core/Typography';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {
  Searcher, useModulesManager, useTranslations,
} from '@openimis/fe-core';
import PhotoCameraOutlinedIcon from '@material-ui/icons/PhotoCameraOutlined';
import { fetchBenefitAttachments, deleteBenefitConsumption } from '../../actions';
import {
  DEFAULT_PAGE_SIZE, ROWS_PER_PAGE_OPTIONS, PAYROLL_STATUS,
} from '../../constants';
import BenefitConsumptionFilterModal from './BenefitConsumptionFilterModal';
import ErrorSummaryModal from './dialogs/ErrorSummaryModal';
import { mutationLabel } from '../../utils/string-utils';
import AdditionalFieldsDialog from './dialogs/AdditionalFieldsDialog';
import PayrollBenefitPrintTemplate from '../PayrollBenefitPrintTemplate';

function BenefitConsumptionSearcherModal({
  fetchBenefitAttachments,
  fetchingBenefitAttachments,
  fetchedBenefitAttachments,
  errorBenefitAttachments,
  benefitAttachments,
  benefitAttachmentsPageInfo,
  benefitAttachmentsTotalCount,
  payrollUuid,
  reconciledMode,
  payrollDetail,
  deleteBenefitConsumption,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations('payroll', modulesManager);
  const [selectedBenefitAttachment, setSelectedBenefitAttachment] = useState(null);
  const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
  const [benefitToDelete, setBenefitToDelete] = useState(null);
  const payrollPrintTemplateRef = useRef(null);

  const handlePrint = useReactToPrint({
    documentTitle: `${payrollUuid}`,
  });

  const fetch = (params) => {
    fetchBenefitAttachments(modulesManager, params);
  };

  const defaultFilters = () => {
    const filters = {
      isDeleted: {
        value: false,
        filter: 'isDeleted: false',
      },
      payrollUuid: {
        value: payrollUuid,
        filter: `payrollUuid: "${payrollUuid}"`,
      },
    };
    if (reconciledMode && payrollDetail.paymentMethod !== 'StrategyOnlinePayment') {
      filters.benefit_Status = {
        value: 'RECONCILED',
        filter: `benefit_Status: ${PAYROLL_STATUS.RECONCILED}`,
      };
    }
    return filters;
  };

  const defaultFiltersArray = () => {
    const filters = [
      'isDeleted: false',
      `first: ${DEFAULT_PAGE_SIZE}`,
      `payrollUuid: "${payrollUuid}"`,
    ];
    if (reconciledMode && payrollDetail.paymentMethod !== 'StrategyOnlinePayment') {
      filters.push(`benefit_Status: ${PAYROLL_STATUS.RECONCILED}`);
    }
    return filters;
  };

  const headers = () => [
    'benefitConsumption.photo',
    'benefitConsumption.individual.firstName',
    'benefitConsumption.individual.lastName',
    'benefitConsumption.amount',
    'benefitConsumption.receipt',
    'benefitConsumption.dateDue',
    'benefitConsumption.payedOnTime',
    'benefitConsumption.paymentDate',
    'benefitConsumption.status',
    '',
    '',
  ];

  const confirmDeleteBenefitConsumption = (benefit) => {
    setBenefitToDelete(benefit);
    setOpenConfirmDialog(true);
  };

  const handleDeleteBenefitConsumption = () => {
    deleteBenefitConsumption(
      benefitToDelete.benefit,
      formatMessageWithValues('payroll.mutation.deleteLabel', mutationLabel(benefitToDelete.benefit.code)),
    );
    setOpenConfirmDialog(false);
    setBenefitToDelete(null);
    const filters = defaultFiltersArray();
    fetchBenefitAttachments(modulesManager, filters); // Refresh the searcher after deletion
  };

  const checkBenefitDueDate = (benefitAttachment) => {
    if (!benefitAttachment.benefit.receipt) {
      return ''; // return empty string if datePayed is null
    }

    return (
      benefitAttachment.benefit && benefitAttachment.benefit.dateDue >= benefitAttachment.bill.datePayed
    ) ? 'True' : 'False';
  };

  const itemFormatters = () => [
    (benefitAttachment) => (
      benefitAttachment.benefit.receipt ? (
        <PhotoCameraOutlinedIcon style={{ fontSize: 150 }} />
      ) : null
    ),
    (benefitAttachment) => benefitAttachment?.benefit?.individual?.firstName,
    (benefitAttachment) => benefitAttachment?.benefit?.individual?.lastName,
    (benefitAttachment) => benefitAttachment?.bill?.amountTotal,
    (benefitAttachment) => benefitAttachment?.benefit?.receipt,
    (benefitAttachment) => benefitAttachment?.benefit?.dateDue,
    (benefitAttachment) => checkBenefitDueDate(benefitAttachment),
    (benefitAttachment) => (
      !benefitAttachment.benefit.receipt
        ? ''
        : benefitAttachment?.bill?.datePayed
    ),
    (benefitAttachment) => benefitAttachment?.benefit?.status,
    (benefitAttachment) => (
      <AdditionalFieldsDialog
        jsonExt={benefitAttachment?.benefit?.jsonExt}
        buttonLabel="payroll.additonalFields.showAdditionalFields"
        title="payroll.additonalFields.label"
      />
    ),
    (benefitAttachment) => (
      <Button
        onClick={() => {}}
        variant="contained"
        color="primary"
        disabled={!!benefitAttachment.benefit.receipt}
      >
        {formatMessage('payroll.summary.confirm')}
      </Button>
    ),
    (benefitAttachment) => (
      payrollDetail.paymentMethod === 'StrategyOnlinePayment' && payrollDetail.status === PAYROLL_STATUS.RECONCILED
        && benefitAttachment.benefit.status !== 'RECONCILED' && (
          <Button
            onClick={() => setSelectedBenefitAttachment(benefitAttachment)}
            variant="contained"
            style={{ backgroundColor: '#b80000', color: 'white' }}
          >
            {formatMessage('payroll.summary.benefit_error')}
          </Button>
      )
    ),
    (benefitAttachment) => (
      payrollDetail.status === PAYROLL_STATUS.PENDING_APPROVAL
      && benefitAttachment.benefit.status !== 'PENDING_DELETION' && (
        <Button
          onClick={() => confirmDeleteBenefitConsumption(benefitAttachment)}
          variant="contained"
          style={{ backgroundColor: '#b80000', color: 'white' }}
        >
          {formatMessage('payroll.summary.benefit_delete')}
        </Button>
      )
    ),
  ];

  const rowIdentifier = (benefitAttachment) => benefitAttachment.id;

  const sorts = () => [
    ['benefit_photo', false],
    ['benefit_individual_FirstName', true],
    ['benefit_individual_LastName', true],
    ['bill_amountTotal', true],
    ['benefit_receipt', true],
    ['benefit_dateDue', true],
  ];

  const benefitConsumptionFilterModal = ({ filters, onChangeFilters }) => (
    <BenefitConsumptionFilterModal filters={filters} onChangeFilters={onChangeFilters} />
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
          FilterPane={benefitConsumptionFilterModal}
          fetch={fetch}
          items={benefitAttachments}
          itemsPageInfo={benefitAttachmentsPageInfo}
          fetchingItems={fetchingBenefitAttachments}
          fetchedItems={fetchedBenefitAttachments}
          errorItems={errorBenefitAttachments}
          tableTitle={formatMessageWithValues('benefitAttachment.searcherResultsTitle', { benefitAttachmentsTotalCount })}
          headers={headers}
          itemFormatters={itemFormatters}
          sorts={sorts}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          defaultPageSize={DEFAULT_PAGE_SIZE}
          rowIdentifier={rowIdentifier}
          defaultFilters={defaultFilters()}
        />
        {selectedBenefitAttachment && (
        <ErrorSummaryModal
          open={!!selectedBenefitAttachment}
          onClose={() => setSelectedBenefitAttachment(null)}
          benefitAttachment={selectedBenefitAttachment}
        />
        )}
        <Dialog
          open={openConfirmDialog}
          onClose={() => setOpenConfirmDialog(false)}
        >
          <DialogTitle>{formatMessage('benefitConsumption.delete.confirm.title')}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {formatMessage('benefitConsumption.delete.confirm.message')}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenConfirmDialog(false)} color="primary">
              {formatMessage('benefitConsumption.cancel')}
            </Button>
            <Button onClick={handleDeleteBenefitConsumption} color="primary" autoFocus>
              {formatMessage('benefitConsumption.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
        <div style={{ display: 'none' }}>
          <PayrollBenefitPrintTemplate
            ref={payrollPrintTemplateRef}
            benefitAttachments={benefitAttachments}
          />
        </div>
      </div>
    </>
  );
}

const mapStateToProps = (state) => ({
  fetchingBenefitAttachments: state.payroll.fetchingBenefitAttachments,
  fetchedBenefitAttachments: state.payroll.fetchedBenefitAttachments,
  errorBenefitAttachments: state.payroll.errorBenefitAttachments,
  benefitAttachments: state.payroll.benefitAttachments,
  benefitAttachmentsPageInfo: state.payroll.benefitAttachmentsPageInfo,
  benefitAttachmentsTotalCount: state.payroll.benefitAttachmentsTotalCount,
});

const mapDispatchToProps = (dispatch) => bindActionCreators(
  { fetchBenefitAttachments, deleteBenefitConsumption },
  dispatch,
);

export default connect(mapStateToProps, mapDispatchToProps)(BenefitConsumptionSearcherModal);
