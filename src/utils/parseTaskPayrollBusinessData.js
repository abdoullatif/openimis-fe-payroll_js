/**
 * Normalise task.businessData for payroll maker-checker (source: payroll).
 */
export function parseTaskPayrollBusinessData(raw) {
  let data = raw;
  if (!data) {
    return { incoming: {} };
  }
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { incoming: {} };
    }
  }

  const incoming = data.incoming_data && typeof data.incoming_data === 'object'
    ? data.incoming_data
    : data;

  return {
    incoming: {
      ...incoming,
      nom_paie: incoming.nom_paie ?? incoming.payroll_name ?? incoming.payroll ?? incoming.name,
      plan_paiement: incoming.plan_paiement ?? incoming.payment_plan ?? incoming.paymentPlan,
      cycle_paiement: incoming.cycle_paiement ?? incoming.payment_cycle ?? incoming.paymentCycle,
      criteres_filtrage: incoming.criteres_filtrage
        ?? incoming.criteres_filtrage_beneficiaires
        ?? incoming.filter_criteria,
      detail_beneficiaires: incoming.detail_beneficiaires
        ?? incoming.detail_beneficiaires_apercu
        ?? incoming.beneficiaries_detail,
      benefices_truncated: incoming.benefices_truncated ?? incoming.beneficiaries_truncated,
      note_liste_tronquee: incoming.note_liste_tronquee,
    },
  };
}
