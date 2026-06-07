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

  const rawIncoming = data.incoming_data && typeof data.incoming_data === 'object'
    ? data.incoming_data
    : data;
  const recap = data.reconciliation_recap
    ?? rawIncoming.reconciliation_recap
    ?? {};

  const incoming = {
    ...rawIncoming,
    payroll: rawIncoming.payroll ?? rawIncoming.payroll_name ?? recap.payroll_name,
    statut_paie: rawIncoming.statut_paie ?? rawIncoming.payroll_status,
    recapitulatif_reconciliation: rawIncoming.recapitulatif_reconciliation
      ?? rawIncoming.recapitulatif_plan_paiement,
    note_liste_tronquee: rawIncoming.note_liste_tronquee ?? recap.note_liste_tronquee,
    benefices_truncated: rawIncoming.benefices_truncated ?? recap.benefices_truncated,
    factures_truncated: rawIncoming.factures_truncated ?? recap.factures_truncated,
    detail_factures_reconciliees: rawIncoming.detail_factures_reconciliees
      ?? recap.detail_factures_reconciliees,
    detail_factures_en_attente: rawIncoming.detail_factures_en_attente
      ?? recap.detail_factures_en_attente,
  };

  return { incoming, recap };
}
