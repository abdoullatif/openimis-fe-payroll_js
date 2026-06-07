import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@material-ui/core';
function ApprovedPaymentsPaginatedList({
  items,
  totalCount,
  hasNextPage,
  loading,
  loadingMore,
  onLoadMore,
  listTitleKey = 'payroll.approvedModal.list.title',
  badgeCount,
  formatMessage,
  formatMessageWithValues,
}) {

  if (loading && items.length === 0) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {formatMessageWithValues(listTitleKey, {
          shown: items.length,
          total: totalCount,
          badge: badgeCount ?? totalCount,
        })}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{formatMessage('payroll.benefitConsumption.code')}</TableCell>
            <TableCell align="right">{formatMessage('payroll.benefitConsumption.amount')}</TableCell>
            <TableCell>{formatMessage('payroll.benefitConsumption.individual')}</TableCell>
            <TableCell>{formatMessage('payroll.benefitConsumption.receipt')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.code ?? '—'}</TableCell>
              <TableCell align="right">{row.amount ?? '—'}</TableCell>
              <TableCell>
                {[row.individual?.firstName, row.individual?.lastName].filter(Boolean).join(' ') || '—'}
              </TableCell>
              <TableCell>{row.receipt ?? '—'}</TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                {formatMessage('payroll.approvedModal.list.empty')}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {hasNextPage && (
        <Box mt={2} display="flex" justifyContent="center">
          <Button
            variant="outlined"
            color="primary"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore
              ? formatMessage('payroll.approvedModal.list.loadingMore')
              : formatMessage('payroll.approvedModal.list.loadMore')}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default ApprovedPaymentsPaginatedList;
