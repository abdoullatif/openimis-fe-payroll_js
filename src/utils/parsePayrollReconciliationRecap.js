import { parsePaymentApprovedModalSummary } from './parsePaymentApprovedModalSummary';

/**
 * Totaux réconciliation paie — ne jamais utiliser benefitConsumption.length (max 100 lignes).
 */
export function parsePayrollReconciliationRecap(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Totaux en-tête — ne jamais utiliser benefitConsumption.length (aperçu limité ~100). */
export function getPayrollBenefitTotalCount(payroll) {
  const n = toNumber(payroll?.beneficesTrouves ?? payroll?.benefitConsumptionTotalCount);
  return n ?? 0;
}

export function getPayrollSelectedBeneficiaryCount(payroll) {
  const n = toNumber(payroll?.beneficiairesSelectionnes);
  if (n !== null) return n;
  return getPayrollBenefitTotalCount(payroll);
}

function getSummaryFromPayroll(payroll) {
  const raw = payroll?.paymentApprovedModalSummary
    ?? payroll?.paymentReconciledModalSummary;
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  return parsePaymentApprovedModalSummary(raw);
}

export function getPayrollReconciliationSummaryCounts(payroll, options = {}) {
  const { forApprovedModal = false } = options;
  const recap = parsePayrollReconciliationRecap(payroll?.reconciliationRecap);
  const modalSummary = getSummaryFromPayroll(payroll);

  const beneficesTrouves = toNumber(
    payroll?.beneficesTrouves
    ?? recap.nombre_benefices_trouves
    ?? payroll?.benefitConsumptionTotalCount,
  );

  const totalInvoicesFromSummary = toNumber(modalSummary?.totalInvoices);

  const beneficiairesSelectionnes = forApprovedModal
    ? toNumber(
      payroll?.beneficiairesSelectionnes
      ?? recap.nombre_beneficiaires_selectionnes
      ?? totalInvoicesFromSummary,
    )
    : toNumber(
      payroll?.beneficiairesSelectionnes
      ?? recap.nombre_beneficiaires_selectionnes
      ?? beneficesTrouves,
    );

  const reconciled = toNumber(
    modalSummary?.reconciledCount
    ?? payroll?.reconciledBenefitCount
    ?? recap.nombre_factures_reconciliees
    ?? recap.counts?.reconciled,
  );

  const ratioText = recap.texte_reconciliees_sur_total
    ?? (reconciled !== null && beneficiairesSelectionnes !== null
      ? `${reconciled} sur ${beneficiairesSelectionnes}`
      : null);

  const benefitConsumptionTruncated = payroll?.benefitConsumptionTruncated === true
    || payroll?.benefitConsumptionTruncated === 'true'
    || recap.benefits_truncated === true
    || recap.benefits_truncated === 'true';

  const totalBillAmount = toNumber(
    modalSummary?.montantTotalFactures
    ?? recap.montant_total
    ?? recap.montant_total_factures,
  );

  const totalReconciledBillAmount = toNumber(
    modalSummary?.montantLivreReconciliation
    ?? recap.montant_reconcilie
    ?? recap.montant_reconcilie_factures,
  );

  const totalInvoices = totalInvoicesFromSummary;

  const nonReconciledCount = toNumber(modalSummary?.nonReconciledCount)
    ?? (totalInvoices !== null && reconciled !== null
      ? Math.max(0, totalInvoices - reconciled)
      : null);

  const nonReconciledAmount = toNumber(modalSummary?.montantFacturesNonReconciliees)
    ?? (totalBillAmount !== null && totalReconciledBillAmount !== null
      ? Math.max(0, totalBillAmount - totalReconciledBillAmount)
      : null);

  return {
    beneficesTrouves,
    beneficiairesSelectionnes,
    reconciled,
    ratioText,
    benefitConsumptionTruncated,
    totalBillAmount,
    totalReconciledBillAmount,
    totalInvoices,
    nonReconciledCount,
    nonReconciledAmount,
    recap,
    modalSummary,
  };
}

/** Montants depuis l'aperçu (max 100 lignes) — secours uniquement. */
export function computeAmountsFromBenefitPreview(benefits, reconciledStatus) {
  let totalAmount = 0;
  let reconciledAmount = 0;
  (benefits || []).forEach((benefit) => {
    (benefit.benefitAttachment || []).forEach((attachment) => {
      if (attachment.bill?.amountTotal) {
        const amount = parseFloat(attachment.bill.amountTotal);
        totalAmount += amount;
        if (benefit.status === reconciledStatus) {
          reconciledAmount += amount;
        }
      }
    });
  });
  return { totalAmount, reconciledAmount };
}

/** Données KPI modale approuvée — sans aperçu benefitConsumption ni beneficesTrouves. */
export function buildApprovedModalStatsPayroll(payrollDetail, modalPayroll, payroll) {
  return {
    id: payrollDetail?.id ?? modalPayroll?.id ?? payroll?.id,
    reconciliationRecap: modalPayroll?.reconciliationRecap ?? payroll?.reconciliationRecap,
    paymentApprovedModalSummary:
      modalPayroll?.paymentApprovedModalSummary ?? payroll?.paymentApprovedModalSummary,
    beneficiairesSelectionnes:
      modalPayroll?.beneficiairesSelectionnes
      ?? payroll?.beneficiairesSelectionnes
      ?? payrollDetail?.beneficiairesSelectionnes,
    reconciledBenefitCount:
      modalPayroll?.reconciledBenefitCount ?? payroll?.reconciledBenefitCount,
  };
}
