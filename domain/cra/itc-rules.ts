import { applyRateToCents, fromCents, toCents } from "@/domain/money";
import type { ItcResult, MealException, Receipt } from "@/lib/types";

/**
 * Deterministic ITC policy. Ordinary meals use 50%.
 * Exception rates live here so they can be selected by future receipt
 * attributes without putting the percentage in a model prompt.
 */
export const ITC_POLICY = {
  standard: 1,
  mealEntertainment: {
    standard: 0.5,
    charityOrPublicInstitution: 1,
    longHaulTruckDriver: 0.8,
  },
} as const;

export function mealRate(exception: MealException = "none"): number {
  switch (exception) {
    case "charityOrPublicInstitution":
      return ITC_POLICY.mealEntertainment.charityOrPublicInstitution;
    case "longHaulTruckDriver":
      return ITC_POLICY.mealEntertainment.longHaulTruckDriver;
    case "none":
      return ITC_POLICY.mealEntertainment.standard;
  }
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, rate));
  return Math.round(clamped * 10000) / 10000;
}

function commercialFraction(percentage: number): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  return Math.min(1, Math.max(0, percentage / 100));
}

/**
 * Calculates the eligible GST/HST input tax credit from structured receipt
 * fields. Vendor notes are intentionally ignored.
 */
export function calculateEligibleITC(receipt: Receipt): ItcResult {
  if (!Number.isFinite(receipt.tax) || receipt.tax < 0) {
    return {
      grossTax: 0,
      eligibilityPercentage: 0,
      eligibleITC: 0,
      status: "review",
      reasonCode: "INVALID_TAX_AMOUNT",
      reason: "The tax amount is invalid and needs review.",
    };
  }

  const grossCents = toCents(receipt.tax);
  const grossTax = fromCents(grossCents);

  if (receipt.type === "deposit") {
    return {
      grossTax,
      eligibilityPercentage: 0,
      eligibleITC: 0,
      status: "ineligible",
      reasonCode: "NOT_AN_EXPENSE",
      reason: "This is a cash deposit, not an expense. No input tax credit applies.",
    };
  }

  if (!receipt.gstNumber) {
    return {
      grossTax,
      eligibilityPercentage: 0,
      eligibleITC: 0,
      status: "review",
      reasonCode: "MISSING_GST_NUMBER",
      reason:
        "GST/HST number is missing and additional documentation or verification is required.",
    };
  }

  const baseRate = receipt.mealEntertainment ? mealRate("none") : ITC_POLICY.standard;
  const eligibilityPercentage = clampRate(baseRate * commercialFraction(receipt.commercialUsePercentage));

  if (eligibilityPercentage === 0) {
    return {
      grossTax,
      eligibilityPercentage: 0,
      eligibleITC: 0,
      status: "ineligible",
      reasonCode: "ZERO_COMMERCIAL_USE",
      reason: "Commercial use is 0%, so no input tax credit is available.",
    };
  }

  const eligibleCents = Math.min(
    grossCents,
    Math.max(0, applyRateToCents(grossCents, eligibilityPercentage)),
  );
  const eligibleITC = fromCents(eligibleCents);
  const status = eligibilityPercentage >= 1 ? "eligible" : "partial";

  if (receipt.mealEntertainment) {
    return {
      grossTax,
      eligibilityPercentage,
      eligibleITC,
      status,
      reasonCode: "MEAL_ENTERTAINMENT_50",
      reason: "Business meals are subject to the configured 50% ITC limitation.",
    };
  }

  return {
    grossTax,
    eligibilityPercentage,
    eligibleITC,
    status,
    reasonCode: "STANDARD_ITC",
    reason: "Commercial office expense.",
  };
}
