import { decodeId } from '@openimis/fe-core';

// eslint-disable-next-line import/prefer-default-export
export function isBase64Encoded(str) {
  const base64RegExp = /^[A-Za-z0-9+/=]+$/;
  return base64RegExp.test(str);
}

export function resolveBenefitPlanFromPaymentPlan(paymentPlan) {
  if (!paymentPlan) return null;

  const raw = paymentPlan.benefitPlan ?? paymentPlan.benefit_plan;
  if (raw == null || raw === '') {
    const fallbackId = paymentPlan.benefitPlanId
      ?? paymentPlan.benefitPlanUuid
      ?? paymentPlan.benefit_plan_uuid;
    return fallbackId ? { id: fallbackId } : null;
  }

  if (typeof raw === 'object') {
    return Object.keys(raw).length === 0 ? null : raw;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw.trim());
      if (typeof parsed === 'string') {
        return JSON.parse(parsed);
      }
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function getBenefitPlanUuid(benefitPlan) {
  if (!benefitPlan) return null;
  const id = benefitPlan.id ?? benefitPlan.uuid;
  if (id == null || id === '') return null;

  const asString = String(id);
  if (/^\d+$/.test(asString)) return asString;
  if (isBase64Encoded(asString)) {
    try {
      return decodeId(asString);
    } catch {
      return asString;
    }
  }
  return asString;
}
