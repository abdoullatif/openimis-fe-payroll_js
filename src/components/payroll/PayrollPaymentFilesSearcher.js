import React, { useState } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import { IconButton, Tooltip, CircularProgress } from '@material-ui/core';
import DownloadIcon from '@material-ui/icons/CloudDownload';

import {
  Searcher,
  useModulesManager,
  useTranslations,
  useToast,
} from '@openimis/fe-core';
import {
  DEFAULT_PAGE_SIZE, MODULE_NAME,
  ROWS_PER_PAGE_OPTIONS, PAYROLL_PAYMENT_FILE_STATUS,
} from '../../constants';
import { fetchPayrollPaymentFiles } from '../../actions';
import downloadPayroll from '../../utils/export';
import AdditionalFieldsDialog from './dialogs/AdditionalFieldsDialog';

function PayrollPaymentFilesSearcher({
  fetchingPayrollFiles,
  fetchedPayrollFiles,
  errorPayrollFiles,
  files,
  pageInfo,
  totalCount,
  fetchPayrollPaymentFiles,
  payrollUuid,
}) {
  const modulesManager = useModulesManager();
  const toast = useToast();
  const [downloadingFile, setDownloadingFile] = useState(null);
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const headers = () => [
    'payrollPaymentFile.fileName',
    'payrollPaymentFile.status',
    'payrollPaymentFile.error',
    'payrollPaymentFile.download',
    '',
  ];

  const defaultFilters = () => {
    const filters = {
      isDeleted: {
        value: false,
        filter: 'isDeleted: false',
      },
    };
    if (payrollUuid) {
      filters.payrollId = {
        value: payrollUuid,
        filter: `payroll_Id: "${payrollUuid}"`,
      };
    }
    return filters;
  };

  const download = async (payrollId, fileName) => {
    setDownloadingFile(fileName);
    try {
      await downloadPayroll(payrollId, fileName, false);
      toast.showSuccess(formatMessage('payroll.summary.download.success') || 'Téléchargement réussi');
    } catch (error) {
      console.error('Error downloading reconciliation data:', error);
      toast.showError(
        error?.message || formatMessage('payroll.summary.download.error') || 'Erreur lors du téléchargement',
      );
    } finally {
      setDownloadingFile(null);
    }
  };

  const fetchFiles = (params) => fetchPayrollPaymentFiles(modulesManager, params);

  const rowIdentifier = (file) => file.fileName;

  const itemFormatters = () => [
    (file) => file.fileName,
    (file) => file.status,
    (file) => file.error,
    (file) => {
      const isDownloading = downloadingFile === file.fileName;
      return (
        <Tooltip title={formatMessage(isDownloading ? 'payroll.summary.downloading' : 'tooltip.download')}>
          <span>
            <IconButton
              onClick={() => download(payrollUuid, file.fileName)}
              disabled={
                isDownloading
                || ![PAYROLL_PAYMENT_FILE_STATUS.SUCCESS,
                  PAYROLL_PAYMENT_FILE_STATUS.PARTIAL_SUCCESS].includes(file.status)
              }
            >
              {isDownloading ? <CircularProgress size={24} /> : <DownloadIcon />}
            </IconButton>
          </span>
        </Tooltip>
      );
    },
    (file) => (
      <AdditionalFieldsDialog
        jsonExt={file?.jsonExt}
        buttonLabel="payroll.summaryUpload"
        title="payroll.summaryUpload"
      />
    ),
  ];

  return (
    <Searcher
      module="payroll"
      FilterPane={null}
      fetch={fetchFiles}
      items={files}
      itemsPageInfo={pageInfo}
      fetchedItems={fetchedPayrollFiles}
      fetchingItems={fetchingPayrollFiles}
      errorItems={errorPayrollFiles}
      tableTitle={formatMessageWithValues('payrollPaymentFilesSearcher.results', { totalCount })}
      headers={headers}
      itemFormatters={itemFormatters}
      rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
      defaultPageSize={DEFAULT_PAGE_SIZE}
      rowIdentifier={rowIdentifier}
      defaultFilters={defaultFilters()}
    />
  );
}
const mapStateToProps = (state) => ({
  fetchingPayrollFiles: state.payroll.fetchingPayrollFiles,
  fetchedPayrollFiles: state.payroll.fetchedPayrollFiles,
  errorPayrollFiles: state.payroll.errorPayrollFiles,
  files: state.payroll.payrollFiles,
  pageInfo: state.payroll.payrollFilesPageInfo,
  totalCount: state.payroll.payrollFilesTotalCount,
});

const mapDispatchToProps = (dispatch) => bindActionCreators({
  fetchPayrollPaymentFiles,
}, dispatch);

export default connect(mapStateToProps, mapDispatchToProps)(PayrollPaymentFilesSearcher);
