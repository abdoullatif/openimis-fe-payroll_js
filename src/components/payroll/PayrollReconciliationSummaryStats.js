import React, { useEffect, useRef } from 'react';
import { Grid, Paper, Typography } from '@material-ui/core';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { formatApprovedModalAmount } from '../../utils/parsePaymentApprovedModalSummary';
import { getPayrollReconciliationSummaryCounts } from '../../utils/parsePayrollReconciliationRecap';

function pickStableNumber(current, previous) {
  if (current !== null && current !== undefined && Number.isFinite(current)) {
    return current;
  }
  return previous;
}

function PayrollReconciliationSummaryStats({ payroll, forApprovedModal = false }) {
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const stableRef = useRef({
    selectedBeneficiaries: null,
    totalBeneficiaries: null,
    nonReconciledCount: null,
    nonReconciledAmount: null,
  });

  const counts = getPayrollReconciliationSummaryCounts(payroll, { forApprovedModal });
  const {
    beneficesTrouves,
    beneficiairesSelectionnes,
    reconciled,
    ratioText,
    nonReconciledCount,
    nonReconciledAmount,
    totalInvoices,
  } = counts;

  let selectedBeneficiaries = reconciled;
  let totalBeneficiaries = forApprovedModal
    ? (beneficiairesSelectionnes ?? totalInvoices)
    : (beneficiairesSelectionnes ?? beneficesTrouves);

  if (ratioText && (selectedBeneficiaries === null || totalBeneficiaries === null)) {
    const match = String(ratioText).match(/^(\d+)\s+sur\s+(\d+)/i)
      || String(ratioText).match(/^(\d+)\s+of\s+(\d+)/i);
    if (match) {
      selectedBeneficiaries = Number(match[1]);
      totalBeneficiaries = Number(match[2]);
    }
  }

  let displayNonReconciledCount = nonReconciledCount;
  let displayNonReconciledAmount = nonReconciledAmount;

  if (forApprovedModal) {
    stableRef.current.selectedBeneficiaries = pickStableNumber(
      selectedBeneficiaries,
      stableRef.current.selectedBeneficiaries,
    );
    stableRef.current.totalBeneficiaries = pickStableNumber(
      totalBeneficiaries,
      stableRef.current.totalBeneficiaries,
    );
    stableRef.current.nonReconciledCount = pickStableNumber(
      nonReconciledCount,
      stableRef.current.nonReconciledCount,
    );
    stableRef.current.nonReconciledAmount = pickStableNumber(
      nonReconciledAmount,
      stableRef.current.nonReconciledAmount,
    );
    selectedBeneficiaries = stableRef.current.selectedBeneficiaries;
    totalBeneficiaries = stableRef.current.totalBeneficiaries;
    displayNonReconciledCount = stableRef.current.nonReconciledCount;
    displayNonReconciledAmount = stableRef.current.nonReconciledAmount;
  }

  useEffect(() => {
    if (!forApprovedModal) {
      stableRef.current = {
        selectedBeneficiaries: null,
        totalBeneficiaries: null,
        nonReconciledCount: null,
        nonReconciledAmount: null,
      };
    }
  }, [forApprovedModal, payroll?.id]);

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
            {formatMessage('payroll.summary.nonReconciledInvoices')}
          </Typography>
          <Typography variant="body1">
            {displayNonReconciledCount !== null ? displayNonReconciledCount : '—'}
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper elevation={3} style={{ padding: '20px' }}>
          <Typography variant="h6" gutterBottom>
            {formatMessage('payroll.summary.nonReconciledAmount')}
          </Typography>
          <Typography variant="body1">
            {displayNonReconciledAmount !== null
              ? formatApprovedModalAmount(displayNonReconciledAmount)
              : '—'}
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default PayrollReconciliationSummaryStats;
