import React from 'react';
import { Grid, Paper, Typography, Box } from '@material-ui/core';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { formatApprovedModalAmount } from '../../utils/parsePaymentApprovedModalSummary';

function KpiStat({ title, value, subtitle }) {
  return (
    <Paper elevation={2} style={{ padding: 16, height: '100%' }}>
      <Typography variant="subtitle2" color="textSecondary" gutterBottom>
        {title}
      </Typography>
      <Typography variant="h6" component="p">
        {value}
      </Typography>
      {subtitle ? (
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
          {subtitle}
        </Typography>
      ) : null}
    </Paper>
  );
}

function PayrollApprovedPaymentModalKpi({
  summary,
  operationInProgress,
  compact = false,
}) {
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);

  const montantTotalFactures = summary?.montantTotalFactures ?? 0;
  const totalInvoices = summary?.totalInvoices ?? 0;
  const montantLivreReconciliation = summary?.montantLivreReconciliation ?? 0;
  const reconciledCount = summary?.reconciledCount ?? 0;
  const gatewayApprovedCount = summary?.gatewayApprovedCount ?? 0;
  const gatewayRejectedCount = summary?.gatewayRejectedCount ?? 0;

  const executionRatePercent = totalInvoices > 0
    ? (summary?.reconciledPercent
      ?? Math.round((reconciledCount / totalInvoices) * 1000) / 10)
    : (summary?.reconciledPercent ?? 0);

  const gatewayText = summary?.textePaiementsPasserelle
    || formatMessageWithValues('payroll.approvedModal.kpi.gateway', {
      approved: gatewayApprovedCount,
      rejected: gatewayRejectedCount,
    });

  const reconciledPercentText = summary?.texteFacturesReconciliees
    || formatMessageWithValues('payroll.approvedModal.kpi.executionRateValue', {
      percent: executionRatePercent,
    });

  if (compact) {
    return (
      <Box style={{ marginBottom: 16 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <KpiStat
              title={formatMessage('payroll.approvedModal.kpi.gatewayTitle')}
              value={operationInProgress
                ? formatMessage('payroll.approvedModal.kpi.gatewayPending')
                : gatewayText}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <KpiStat
              title={formatMessage('payroll.approvedModal.kpi.executionRate')}
              value={reconciledPercentText}
              subtitle={formatMessageWithValues('payroll.approvedModal.kpi.executionRateDetail', {
                reconciled: reconciledCount,
                total: totalInvoices,
              })}
            />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box style={{ marginBottom: 16 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <KpiStat
            title={formatMessage('payroll.approvedModal.kpi.totalInvoicesAmount')}
            value={formatApprovedModalAmount(montantTotalFactures)}
            subtitle={formatMessageWithValues('payroll.approvedModal.kpi.totalInvoicesCount', {
              count: totalInvoices,
            })}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <KpiStat
            title={formatMessage('payroll.approvedModal.kpi.reconciledAmount')}
            value={formatApprovedModalAmount(montantLivreReconciliation)}
            subtitle={formatMessageWithValues('payroll.approvedModal.kpi.reconciledCount', {
              count: reconciledCount,
            })}
          />
        </Grid>
        <Grid item xs={12} sm={12} md={4}>
          <KpiStat
            title={formatMessage('payroll.approvedModal.kpi.executionRate')}
            value={formatMessageWithValues('payroll.approvedModal.kpi.executionRateValue', {
              percent: executionRatePercent,
            })}
            subtitle={formatMessageWithValues('payroll.approvedModal.kpi.executionRateDetail', {
              reconciled: reconciledCount,
              total: totalInvoices,
            })}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2} style={{ marginTop: 8 }}>
        <Grid item xs={12}>
          <Paper elevation={2} style={{ padding: 16 }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              {formatMessage('payroll.approvedModal.kpi.gatewayTitle')}
            </Typography>
            <Typography variant="body1" color={operationInProgress ? 'textSecondary' : 'textPrimary'}>
              {operationInProgress
                ? formatMessage('payroll.approvedModal.kpi.gatewayPending')
                : gatewayText}
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default PayrollApprovedPaymentModalKpi;
