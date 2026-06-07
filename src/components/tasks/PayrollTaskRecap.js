import React from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/styles';
import { useModulesManager, useTranslations } from '@openimis/fe-core';
import { MODULE_NAME } from '../../constants';
import { parseTaskPayrollBusinessData } from '../../utils/parseTaskPayrollBusinessData';
import { asArray, hasDisplayValue } from '../../utils/taskBusinessDataUtils';
import TaskTruncatedListAlert from './TaskTruncatedListAlert';

const useStyles = makeStyles(() => ({
  row: {
    display: 'flex',
    padding: '6px 0',
    borderBottom: '1px solid #eee',
  },
  rowLabel: {
    flex: '0 0 40%',
    color: '#666',
    paddingRight: 12,
  },
  rowValue: {
    flex: 1,
    fontWeight: 500,
    wordBreak: 'break-word',
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: 8,
    marginTop: 8,
  },
  tableScrollContainer: {
    maxHeight: 320,
    overflowY: 'auto',
  },
}));

const FIELDS = [
  ['type_operation', 'tasks.payroll.field.typeOperation'],
  ['nom_paie', 'tasks.payroll.field.name'],
  ['plan_paiement', 'tasks.payroll.field.paymentPlan'],
  ['cycle_paiement', 'tasks.payroll.field.paymentCycle'],
  ['regime_prestations', 'tasks.payroll.field.benefitPlan'],
  ['criteres_filtrage', 'tasks.payroll.field.filters'],
  ['payment_method', 'tasks.payroll.field.paymentMethod'],
  ['date_debut', 'tasks.payroll.field.dateFrom'],
  ['date_fin', 'tasks.payroll.field.dateTo'],
];

function BeneficiariesTable({ rows, formatMessage }) {
  const classes = useStyles();
  const list = asArray(rows);

  return (
    <Box mt={2}>
      <Typography className={classes.sectionTitle}>
        {formatMessage('tasks.payroll.beneficiariesDetails')}
      </Typography>
      <TableContainer
        component={Paper}
        elevation={1}
        className={classes.tableScrollContainer}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{formatMessage('tasks.payroll.table.invoiceCode')}</TableCell>
              <TableCell align="right">{formatMessage('tasks.payroll.table.amount')}</TableCell>
              <TableCell>{formatMessage('tasks.payroll.table.lastName')}</TableCell>
              <TableCell>{formatMessage('tasks.payroll.table.firstName')}</TableCell>
              <TableCell>{formatMessage('tasks.payroll.table.householdCode')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {formatMessage('tasks.payroll.noBeneficiaries')}
                </TableCell>
              </TableRow>
            ) : (
              list.map((row, index) => (
                <TableRow key={`${row.code_facture || row.code || index}-${index}`}>
                  <TableCell>
                    {row.code_facture ?? row.facture ?? row.code ?? '—'}
                  </TableCell>
                  <TableCell align="right">{row.montant ?? row.amount ?? '—'}</TableCell>
                  <TableCell>{row.nom ?? row.last_name ?? row.lastName ?? '—'}</TableCell>
                  <TableCell>{row.prenom ?? row.first_name ?? row.firstName ?? '—'}</TableCell>
                  <TableCell>{row.code_menage ?? row.household_code ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function PayrollTaskRecap({ incomingData }) {
  const classes = useStyles();
  const modulesManager = useModulesManager();
  const { formatMessage } = useTranslations(MODULE_NAME, modulesManager);
  const { incoming } = parseTaskPayrollBusinessData(incomingData);

  const rows = FIELDS
    .map(([key, labelKey]) => ({ key, labelKey, value: incoming[key] }))
    .filter(({ value }) => hasDisplayValue(value));

  const beneficiaryRows = incoming.detail_beneficiaires
    ?? incoming.detail_beneficiaires_apercu
    ?? [];

  return (
    <Box>
      <Typography className={classes.sectionTitle}>
        {formatMessage('tasks.payroll.recapTitle')}
      </Typography>

      {rows.length === 0 && asArray(beneficiaryRows).length === 0 ? (
        <Typography variant="body2" color="textSecondary">
          {formatMessage('tasks.payroll.noData')}
        </Typography>
      ) : (
        rows.map(({ key, labelKey, value }) => (
          <div key={key} className={classes.row}>
            <Typography className={classes.rowLabel} variant="body2">
              {formatMessage(labelKey)}
            </Typography>
            <Typography className={classes.rowValue} variant="body2">
              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
            </Typography>
          </div>
        ))
      )}

      <TaskTruncatedListAlert incoming={incoming} />

      <BeneficiariesTable rows={beneficiaryRows} formatMessage={formatMessage} />
    </Box>
  );
}

export default PayrollTaskRecap;
