import React from 'react';
import PayrollTaskRecap from './PayrollTaskRecap';

const PayrollTaskTableHeaders = () => [
  'Récapitulatif de la paie',
];

const PayrollTaskItemFormatters = () => [
  (incomingData) => (
    <PayrollTaskRecap incomingData={incomingData} />
  ),
];

export { PayrollTaskTableHeaders, PayrollTaskItemFormatters };
