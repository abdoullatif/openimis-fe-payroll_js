import React, { useState } from 'react';
import {
  Box,
  Collapse,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import { makeStyles } from '@material-ui/styles';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { parseTaskReconciliationBusinessData } from '../../utils/parseTaskReconciliationBusinessData';
import { asArray, hasDisplayValue } from '../../utils/taskBusinessDataUtils';
import TaskTruncatedListAlert from './TaskTruncatedListAlert';

const useStyles = makeStyles(() => ({
  paper: {
    padding: 16,
    marginBottom: 16,
  },
  statLabel: {
    color: '#666',
    fontSize: '0.85rem',
  },
  statValue: {
    fontWeight: 600,
    fontSize: '1.1rem',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: 600,
  },
  tableScrollContainer: {
    maxHeight: 320,
    overflowY: 'auto',
  },
  textRecap: {
    whiteSpace: 'pre-wrap',
    margin: 0,
    fontFamily: 'inherit',
    fontSize: '0.875rem',
  },
  expandHeader: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    userSelect: 'none',
  },
}));

function StatCard({ label, value }) {
  const classes = useStyles();
  return (
    <Paper className={classes.paper} elevation={1}>
      <Typography className={classes.statLabel}>{label}</Typography>
      <Typography className={classes.statValue}>{value ?? '—'}</Typography>
    </Paper>
  );
}

function InvoiceTable({ title, rows, emptyLabel }) {
  const classes = useStyles();
  const { formatMessage } = useTranslations(MODULE_NAME, useModulesManager());

  const list = asArray(rows);

  return (
    <Box mt={2}>
      <Typography className={classes.sectionTitle}>{title}</Typography>
      <TableContainer
        component={Paper}
        elevation={1}
        className={classes.tableScrollContainer}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{formatMessage('payroll.tasks.reconciliation.table.invoice')}</TableCell>
              <TableCell align="right">{formatMessage('payroll.tasks.reconciliation.table.amount')}</TableCell>
              <TableCell>{formatMessage('payroll.tasks.reconciliation.table.receipt')}</TableCell>
              <TableCell>{formatMessage('payroll.tasks.reconciliation.table.source')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">{emptyLabel}</TableCell>
              </TableRow>
            ) : (
              list.map((row, index) => (
                <TableRow key={`${row.code_facture || row.facture || row.code || index}-${index}`}>
                  <TableCell>
                    {row.code_facture ?? row.facture ?? row.code ?? row.invoice ?? '—'}
                  </TableCell>
                  <TableCell align="right">{row.montant ?? row.amount ?? '—'}</TableCell>
                  <TableCell>{row.recu ?? row.receipt ?? row.receipt_number ?? '—'}</TableCell>
                  <TableCell>{row.source ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function PayrollReconciliationTaskRecap({ incomingData }) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage, formatMessageWithValues } = useTranslations(MODULE_NAME, modulesManager);
  const [recapExpanded, setRecapExpanded] = useState(false);
  const { incoming, recap } = parseTaskReconciliationBusinessData(incomingData);

  const payrollName = incoming.payroll ?? recap.payroll_name ?? incoming.payroll_name ?? '—';
  const textRecap = incoming.recapitulatif_reconciliation;
  const payrollId = incoming.payroll_id ?? recap.payroll_id ?? incoming.id;

  const totalInvoices = incoming.total_factures ?? recap.total_invoices ?? recap.total_factures;
  const reconciledCount = incoming.factures_reconciliees ?? recap.reconciled_count
    ?? recap.success_count;
  const pendingCount = incoming.factures_en_attente ?? recap.pending_count
    ?? recap.rejected_count;
  const totalAmount = incoming.montant_total ?? recap.total_amount;
  const reconciledAmount = incoming.montant_reconcilie ?? recap.reconciled_amount;
  const pendingAmount = incoming.montant_en_attente ?? recap.pending_amount;
  const lastReconciliation = incoming.derniere_reconciliation
    ?? recap.last_reconciliation_at
    ?? recap.derniere_reconciliation;

  const paymentReports = asArray(
    incoming.rapports_paiement ?? recap.payment_reports ?? recap.rapports_paiement,
  );
  const paymentReportsLabel = paymentReports.length > 0
    ? paymentReports.map((r) => (typeof r === 'string' ? r : r.file_name ?? r.name ?? JSON.stringify(r))).join(', ')
    : formatMessage('payroll.tasks.reconciliation.noPaymentReports');

  const reconciledRows = incoming.detail_factures_reconciliees
    ?? recap.reconciled_invoices
    ?? recap.detail_factures_reconciliees
    ?? [];
  const pendingRows = incoming.detail_factures_en_attente
    ?? recap.pending_invoices
    ?? recap.detail_factures_en_attente
    ?? [];

  const lastRun = recap.last_celery_run ?? incoming.dernier_run_celery ?? recap.dernier_run_celery;
  const lastRunLabel = lastRun
    ? formatMessageWithValues('payroll.tasks.reconciliation.lastRun', {
      success: lastRun.success_count ?? lastRun.success ?? '0',
      rejected: lastRun.rejected_count ?? lastRun.rejected ?? '0',
    })
    : null;

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        {formatMessage('payroll.tasks.reconciliation.recapTitle')}
      </Typography>
      {payrollId && (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {formatMessageWithValues('payroll.tasks.reconciliation.payrollId', { id: payrollId })}
        </Typography>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.payroll')} value={payrollName} />
        </Grid>
        <Grid item xs={6} md={2}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.totalInvoices')} value={totalInvoices} />
        </Grid>
        <Grid item xs={6} md={2}>
          <StatCard
            label={formatMessage('payroll.tasks.reconciliation.reconciledInvoices')}
            value={reconciledCount}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <StatCard
            label={formatMessage('payroll.tasks.reconciliation.pendingInvoices')}
            value={pendingCount}
          />
        </Grid>
        <Grid item xs={6} md={2}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.lastReconciliation')} value={lastReconciliation} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.totalAmount')} value={totalAmount} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.reconciledAmount')} value={reconciledAmount} />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.pendingAmount')} value={pendingAmount} />
        </Grid>
        <Grid item xs={12} md={3}>
          <StatCard label={formatMessage('payroll.tasks.reconciliation.paymentReports')} value={paymentReportsLabel} />
        </Grid>
      </Grid>

      {lastRunLabel && (
        <Typography variant="body2" className={classes.sectionTitle}>
          {lastRunLabel}
        </Typography>
      )}

      <TaskTruncatedListAlert incoming={incoming} />

      <InvoiceTable
        title={formatMessage('payroll.tasks.reconciliation.reconciledDetails')}
        rows={reconciledRows}
        emptyLabel={formatMessage('payroll.tasks.reconciliation.noReconciledInvoices')}
      />

      <InvoiceTable
        title={formatMessage('payroll.tasks.reconciliation.pendingDetails')}
        rows={pendingRows}
        emptyLabel={formatMessage('payroll.tasks.reconciliation.noPendingInvoices')}
      />

      {hasDisplayValue(textRecap) && (
        <Box mt={2}>
          <div
            className={classes.expandHeader}
            onClick={() => setRecapExpanded((prev) => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setRecapExpanded((prev) => !prev);
              }
            }}
          >
            <Typography className={classes.sectionTitle}>
              {formatMessage('payroll.tasks.reconciliation.textRecap')}
            </Typography>
            <IconButton size="small" aria-label="toggle recap">
              {recapExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </div>
          <Collapse in={recapExpanded}>
            <Paper elevation={1} style={{ padding: 12 }}>
              <pre className={classes.textRecap}>{textRecap}</pre>
            </Paper>
          </Collapse>
        </Box>
      )}
    </Box>
  );
}

export default PayrollReconciliationTaskRecap;
