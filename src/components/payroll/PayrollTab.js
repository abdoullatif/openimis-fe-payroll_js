/* eslint-disable max-len */
import React, { useState } from 'react';
import { Paper, Grid, CircularProgress } from '@material-ui/core';
import {
  Contributions,
  useModulesManager,
  useTranslations,
  useToast,
} from '@openimis/fe-core';
import { makeStyles } from '@material-ui/styles';
import Button from '@material-ui/core/Button';
import {
  BENEFIT_CONSUMPTION_LIST_TAB_VALUE,
  PAYROLL_TABS_LABEL_CONTRIBUTION_KEY,
  PAYROLL_TABS_PANEL_CONTRIBUTION_KEY,
  PAYROLL_STATUS,
  MODULE_NAME,
  PAYMENT_METHOD_OFFLINE,
} from '../../constants';
import PayrollPaymentDataUploadDialog from './dialogs/PayrollPaymentDataUploadDialog';
import downloadPayroll from '../../utils/export';

const useStyles = makeStyles((theme) => ({
  paper: theme.paper.paper,
  tableTitle: theme.table.title,
  tabs: {
    display: 'flex',
    alignItems: 'center',
  },
  selectedTab: {
    borderBottom: '4px solid white',
  },
  unselectedTab: {
    borderBottom: '4px solid transparent',
  },
  button: {
    marginLeft: 'auto',
    padding: theme.spacing(1),
    fontSize: '0.875rem',
    textTransform: 'none',
  },
}));

function PayrollTab({
  rights, setConfirmedAction, payrollUuid, isInTask, payroll, isPayrollFromFailedInvoices,
}) {
  const classes = useStyles();

  const [activeTab, setActiveTab] = useState(BENEFIT_CONSUMPTION_LIST_TAB_VALUE);
  const [downloading, setDownloading] = useState(false);

  const isSelected = (tab) => tab === activeTab;

  const tabStyle = (tab) => (isSelected(tab) ? classes.selectedTab : classes.unselectedTab);

  const handleChange = (_, tab) => setActiveTab(tab);

  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);
  const toast = useToast();

  const downloadPayrollData = async () => {
    setDownloading(true);
    try {
      await downloadPayroll(payrollUuid, payroll?.name);
      toast.showSuccess(formatMessage('payroll.summary.download.success') || 'Téléchargement réussi');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error downloading reconciliation data:', error);
      toast.showError(
        error?.message || formatMessage('payroll.summary.download.error') || 'Erreur lors du téléchargement',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Paper className={classes.paper}>
      <Grid container className={`${classes.tableTitle} ${classes.tabs}`}>
        <div style={{ width: '100%' }}>
          <div style={{ float: 'left' }}>
            <Contributions
              contributionKey={PAYROLL_TABS_LABEL_CONTRIBUTION_KEY}
              rights={rights}
              value={activeTab}
              onChange={handleChange}
              isSelected={isSelected}
              tabStyle={tabStyle}
              payrollUuid={payrollUuid}
              isInTask={isInTask}
              isPayrollFromFailedInvoices={isPayrollFromFailedInvoices}
            />
          </div>
          <div style={{ float: 'right', paddingRight: '16px' }}>
            {payrollUuid && !isPayrollFromFailedInvoices && (
              <Button
                onClick={downloadPayrollData}
                color="#DFEDEF"
                className={classes.button}
                disabled={downloading}
                style={{
                  border: '0px',
                  marginTop: '6px',
                  textTransform: 'uppercase',
                }}
              >
                {downloading && (
                  <CircularProgress size={16} style={{ marginRight: 8 }} />
                )}
                {downloading
                  ? formatMessage('payroll.summary.downloading')
                  : formatMessage('payroll.summary.download')}
              </Button>
            )}
            {payrollUuid && payroll?.status === PAYROLL_STATUS.APPROVE_FOR_PAYMENT && payroll.paymentMethod === PAYMENT_METHOD_OFFLINE
                && (
                <PayrollPaymentDataUploadDialog
                  payrollUuid={payrollUuid}
                />
                )}
          </div>
        </div>
      </Grid>
      <Contributions
        contributionKey={PAYROLL_TABS_PANEL_CONTRIBUTION_KEY}
        rights={rights}
        value={activeTab}
        setConfirmedAction={setConfirmedAction}
        payrollUuid={payrollUuid}
        isInTask={isInTask}
        isPayrollFromFailedInvoices={isPayrollFromFailedInvoices}
      />
    </Paper>
  );
}

export default PayrollTab;
