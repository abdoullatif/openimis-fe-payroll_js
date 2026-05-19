/**
 * Normalise task.businessData / businessData.incoming_data for payroll reconciliation tasks.
 */
export function parseTaskReconciliationBusinessData(raw) {
  let data = raw;
  if (!data) {
    return { incoming: {}, recap: {} };
  }
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { incoming: {}, recap: {} };
    }
  }

  const incoming = data.incoming_data && typeof data.incoming_data === 'object'
    ? data.incoming_data
    : data;
  const recap = data.reconciliation_recap
    ?? incoming.reconciliation_recap
    ?? {};

  return { incoming, recap };
}

export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}
