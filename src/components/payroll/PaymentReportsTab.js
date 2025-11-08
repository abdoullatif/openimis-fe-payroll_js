import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  CircularProgress,
  Box,
  Typography,
} from '@material-ui/core';
import {
  CloudUpload as CloudUploadIcon,
  GetApp as GetAppIcon,
} from '@material-ui/icons';
import { PublishedComponent, useTranslations, useToast, useModulesManager } from '@openimis/fe-core';
import {
  MODULE_NAME,
  PAYROLL_PAYMENT_REPORTS_TAB_VALUE,
  PAYROLL_STATUS,
} from '../../constants';
import {
  listPaymentReports,
  downloadPaymentReport,
  uploadPaymentReport,
} from '../../services/paymentReportService';

function PaymentReportsTabLabel({
  onChange, tabStyle, isSelected, modulesManager, payrollUuid, isInTask, isPayrollFromFailedInvoices,
}) {
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);
  if (!payrollUuid || isInTask || isPayrollFromFailedInvoices) {
    return null;
  }
  return (
    <Tab
      onChange={onChange}
      className={tabStyle(PAYROLL_PAYMENT_REPORTS_TAB_VALUE)}
      selected={isSelected(PAYROLL_PAYMENT_REPORTS_TAB_VALUE)}
      value={PAYROLL_PAYMENT_REPORTS_TAB_VALUE}
      label={formatMessage('PayrollPaymentReportsTab.label')}
    />
  );
}

function PaymentReportsTabPanel({ value, payrollUuid, isInTask, payroll }) {
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);
  const toast = useToast();
  const rights = useSelector((store) => store?.core?.user?.i_user?.rights ?? []);

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileInput, setFileInput] = useState(null);

  useEffect(() => {
    if (value === PAYROLL_PAYMENT_REPORTS_TAB_VALUE && payrollUuid && !isInTask) {
      loadReports();
    }
  }, [value, payrollUuid, isInTask]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await listPaymentReports(payrollUuid);
      const normalized = Array.isArray(data)
        ? data
        : (data?.results || data?.items || data?.data || []);
      setReports(normalized);
    } catch (error) {
      toast.showError(formatMessage('PayrollPaymentReportsTab.error.loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileName) => {
    try {
      await downloadPaymentReport(payrollUuid, fileName);
      toast.showSuccess(formatMessage('PayrollPaymentReportsTab.success.download'));
    } catch (error) {
      toast.showError(error.message || formatMessage('PayrollPaymentReportsTab.error.download'));
    }
  };

  // Removed inline view action per request; keep only download

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleUpload(file);
    }
    // Reset input
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      await uploadPaymentReport(payrollUuid, file);
      toast.showSuccess(formatMessage('PayrollPaymentReportsTab.success.upload'));
      await loadReports(); // Reload list
    } catch (error) {
      toast.showError(error.message || formatMessage('PayrollPaymentReportsTab.error.upload'));
    } finally {
      setUploading(false);
    }
  };

  if (isInTask || value !== PAYROLL_PAYMENT_REPORTS_TAB_VALUE) return null;

  return (
    <PublishedComponent
      pubRef="policyHolder.TabPanel"
      module="payroll"
      index={PAYROLL_PAYMENT_REPORTS_TAB_VALUE}
      value={value}
    >
      {payrollUuid && (
        <Paper style={{ padding: 16 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">
              {formatMessage('PayrollPaymentReportsTab.title')}
            </Typography>
            <Box>
              <input
                accept=".pdf"
                style={{ display: 'none' }}
                id="upload-payment-report"
                type="file"
                onChange={handleFileSelect}
                ref={(input) => setFileInput(input)}
              />
              <label htmlFor="upload-payment-report">
                <Button
                  variant="contained"
                  color="primary"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={uploading}
                >
                  {uploading ? formatMessage('PayrollPaymentReportsTab.uploading') : formatMessage('PayrollPaymentReportsTab.upload')}
                </Button>
              </label>
            </Box>
          </Box>

          {loading ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{formatMessage('PayrollPaymentReportsTab.table.fileName')}</TableCell>
                    <TableCell>{formatMessage('PayrollPaymentReportsTab.table.dateCreated')}</TableCell>
                    <TableCell align="right">{formatMessage('PayrollPaymentReportsTab.table.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {reports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        {formatMessage('PayrollPaymentReportsTab.noReports')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    reports.map((report) => (
                      <TableRow key={report.file_name}>
                        <TableCell>{report.file_name}</TableCell>
                        <TableCell>{report.date_created}</TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => handleDownload(report.file_name)}
                            title={formatMessage('PayrollPaymentReportsTab.download')}
                          >
                            <GetAppIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </PublishedComponent>
  );
}

export { PaymentReportsTabLabel, PaymentReportsTabPanel };

