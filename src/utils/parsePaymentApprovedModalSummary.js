function toNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @returns {import('./parsePaymentApprovedModalSummary').PaymentApprovedModalSummary | null}
 */
export function parsePaymentApprovedModalSummary(raw) {
  if (!raw) return null;
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof data !== 'object') return null;

  const amounts = data.amounts && typeof data.amounts === 'object' ? data.amounts : {};
  const counts = data.counts && typeof data.counts === 'object' ? data.counts : {};

  const montantTotalFactures = toNumber(
    data.montantTotalFactures
    ?? data.montant_total_factures
    ?? amounts.total
    ?? amounts.montant_total_factures,
  );
  const totalInvoices = toNumber(
    data.totalInvoices
    ?? data.total_invoices
    ?? counts.total
    ?? counts.total_invoices,
  );
  const montantLivreReconciliation = toNumber(
    data.montantLivreReconciliation
    ?? data.montant_livre_reconciliation
    ?? amounts.reconciled
    ?? amounts.montant_reconcilie
    ?? amounts.montant_livre_reconciliation,
  );
  const reconciledCount = toNumber(
    data.reconciledCount
    ?? data.reconciled_count
    ?? counts.reconciled,
  );
  const montantApprouvePasserelle = toNumber(
    data.montantApprouvePasserelle
    ?? data.montant_approuve_passerelle
    ?? amounts.gatewayApproved
    ?? amounts.gateway_approved
    ?? amounts.montant_approuve_passerelle,
  );
  const gatewayApprovedCount = toNumber(
    data.gatewayApprovedCount
    ?? data.gateway_approved_count
    ?? counts.gatewayApproved
    ?? counts.gateway_approved,
  );
  const gatewayRejectedCount = toNumber(
    data.gatewayRejectedCount
    ?? data.gateway_rejected_count
    ?? counts.gatewayRejected
    ?? counts.gateway_rejected,
  );

  const nonReconciledCount = toNumber(
    data.nonReconciledCount
    ?? data.non_reconciled_count
    ?? data.nombreFacturesNonReconciliees
    ?? data.nombre_factures_non_reconciliees
    ?? counts.nonReconciled
    ?? counts.non_reconciled,
  ) || Math.max(0, totalInvoices - reconciledCount);

  const montantFacturesNonReconciliees = toNumber(
    data.montantFacturesNonReconciliees
    ?? data.montant_factures_non_reconciliees
    ?? amounts.nonReconciled
    ?? amounts.non_reconciled
    ?? amounts.montant_non_reconcilie,
  ) || Math.max(0, montantTotalFactures - montantLivreReconciliation);

  let reconciledPercent = toNumber(data.reconciledPercent ?? data.reconciled_percent);
  if (!reconciledPercent && totalInvoices > 0) {
    reconciledPercent = Math.round((reconciledCount / totalInvoices) * 1000) / 10;
  }

  return {
    montantTotalFactures,
    totalInvoices,
    montantLivreReconciliation,
    reconciledCount,
    nonReconciledCount,
    montantFacturesNonReconciliees,
    montantApprouvePasserelle,
    gatewayApprovedCount,
    gatewayRejectedCount,
    reconciledPercent,
    textePaiementsPasserelle: data.textePaiementsPasserelle
      ?? data.texte_paiements_passerelle
      ?? null,
    texteFacturesReconciliees: data.texteFacturesReconciliees
      ?? data.texte_factures_reconciliees
      ?? null,
  };
}

export function parseBenefitConsumptionStatusCounts(raw) {
  if (!raw) return {};
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (typeof data !== 'object') return {};
  const out = {};
  Object.keys(data).forEach((key) => {
    out[key] = toNumber(data[key]);
  });
  return out;
}

/** KPI modale : toujours depuis paymentApprovedModalSummary (stable en DB), jamais paymentProgress. */
export function getGatewayKpiDisplay(summary) {
  const base = summary ?? {
    gatewayApprovedCount: 0,
    gatewayRejectedCount: 0,
    montantApprouvePasserelle: 0,
  };

  return {
    gatewayApprovedCount: base.gatewayApprovedCount,
    gatewayRejectedCount: base.gatewayRejectedCount,
    montantApprouvePasserelle: base.montantApprouvePasserelle,
  };
}

export function formatApprovedModalAmount(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
