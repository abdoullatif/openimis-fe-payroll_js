export function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

export function hasDisplayValue(value) {
  return value !== undefined && value !== null && value !== '';
}

export function isTruthyFlag(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

/**
 * Returns true if the task recap lists are partial (backend truncation).
 */
export function isListTruncated(incoming = {}) {
  return isTruthyFlag(incoming.benefices_truncated)
    || isTruthyFlag(incoming.factures_truncated)
    || hasDisplayValue(incoming.note_liste_tronquee);
}

/**
 * Custom backend message or null to use the default translated notice.
 */
export function getTruncatedListCustomMessage(incoming = {}) {
  if (hasDisplayValue(incoming.note_liste_tronquee)) {
    return String(incoming.note_liste_tronquee);
  }
  if (hasDisplayValue(incoming.benefices_truncated) && !isTruthyFlag(incoming.benefices_truncated)) {
    return String(incoming.benefices_truncated);
  }
  if (hasDisplayValue(incoming.factures_truncated) && !isTruthyFlag(incoming.factures_truncated)) {
    return String(incoming.factures_truncated);
  }
  return null;
}
