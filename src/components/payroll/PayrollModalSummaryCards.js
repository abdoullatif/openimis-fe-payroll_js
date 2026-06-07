import React from 'react';
import { Grid, Paper, Typography } from '@material-ui/core';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { formatApprovedModalAmount } from '../../utils/parsePaymentApprovedModalSummary';
import { getPayrollReconciliationSummaryCounts } from '../../utils/parsePayrollReconciliationRecap';

/**
 * Trois cartes récap modales attente / réconciliés — totaux backend uniquement.
 */
function PayrollModalSummaryCards({ payroll }) {
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const {
    beneficiairesSelectionnes,
    beneficesTrouves,
    reconciled,
    ratioText,
    totalBillAmount,
    totalReconciledBillAmount,
  } = getPayrollReconciliationSummaryCounts(payroll);

  let selectedBeneficiaries = reconciled;
  let totalBeneficiaries = beneficiairesSelectionnes ?? beneficesTrouves;
  if (ratioText && (selectedBeneficiaries == null || totalBeneficiaries == null)) {
    const match = String(ratioText).match(/^(\d+)\s+sur\s+(\d+)/i)
      || String(ratioText).match(/^(\d+)\s+of\s+(\d+)/i);
    if (match) {
      selectedBeneficiaries = Number(match[1]);
      totalBeneficiaries = Number(match[2]);
    }
  }

  const displayTotalAmount = totalBillAmount != null
    ? formatApprovedModalAmount(totalBillAmount)
    : '—';
  const displayReconciledAmount = totalReconciledBillAmount != null
    ? formatApprovedModalAmount(totalReconciledBillAmount)
    : '—';

  return (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Paper elevation={3} style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            {formatMessage('payroll.summary.selectedBeneficiaries')}
          </Typography>
          <Typography variant="body1">
            {formatMessageWithValues('payroll.summary.beneficiariesCount', {
              selectedBeneficiaries: selectedBeneficiaries ?? 0,
              totalBeneficiaries: totalBeneficiaries ?? 0,
            })}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper elevation={3} style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            {formatMessage('payroll.summary.totalAmountForInvoice')}
          </Typography>
          <Typography variant="body1">
            {displayTotalAmount}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper elevation={3} style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            {formatMessage('payroll.summary.deliveredReconciliation')}
          </Typography>
          <Typography variant="body1">
            {displayReconciledAmount}
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default PayrollModalSummaryCards;
