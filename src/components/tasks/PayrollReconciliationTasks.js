import React from 'react';
import PayrollReconciliationTaskRecap from './PayrollReconciliationTaskRecap';

const PayrollReconciliationTaskTableHeaders = () => [
  'Récapitulatif de réconciliation',
];

const PayrollReconciliationTaskItemFormatters = () => [
  (incomingData) => (
    <PayrollReconciliationTaskRecap incomingData={incomingData} />
  ),
];

export { PayrollReconciliationTaskTableHeaders, PayrollReconciliationTaskItemFormatters };
