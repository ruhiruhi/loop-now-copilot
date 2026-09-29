import { describe, expect, it } from "vitest";
import { getReceiptById, listReceipts } from "@/data/receipts";
import { mealRate, calculateEligibleITC } from "@/domain/cra/itc-rules";
import { toCents } from "@/domain/money";
import type { Receipt } from "@/lib/types";

function requireReceipt(id: string): Receipt {
  const receipt = getReceiptById(id);
  if (!receipt) {
    throw new Error(`Missing fixture ${id}`);
  }
  return receipt;
}

describe("calculateEligibleITC", () => {
  it("gives Staples the full GST amount as eligible ITC", () => {
    const staples = requireReceipt("receipt_001");
    const result = calculateEligibleITC(staples);

    expect(toCents(staples.tax)).toBe(410);
    expect(toCents(result.grossTax)).toBe(410);
    expect(toCents(result.eligibleITC)).toBe(410);
    expect(result.eligibilityPercentage).toBe(1);
    expect(result.status).toBe("eligible");
    expect(result.reasonCode).toBe("STANDARD_ITC");
  });

  it("limits the restaurant meal to 50% of GST", () => {
    const meal = requireReceipt("receipt_002");
    const result = calculateEligibleITC(meal);

    expect(meal.notes).toContain("100% ITC");
    expect(toCents(meal.tax)).toBe(1200);
    expect(toCents(result.eligibleITC)).toBe(600);
    expect(result.eligibilityPercentage).toBe(0.5);
    expect(result.status).toBe("partial");
    expect(result.reasonCode).toBe("MEAL_ENTERTAINMENT_50");
  });

  it("sends a missing GST/HST number to review", () => {
    const result = calculateEligibleITC(requireReceipt("receipt_003"));

    expect(result.status).toBe("review");
    expect(result.reasonCode).toBe("MISSING_GST_NUMBER");
    expect(result.eligibleITC).toBe(0);
  });

  it("treats a cash deposit as ineligible", () => {
    const result = calculateEligibleITC(requireReceipt("receipt_004"));

    expect(result.status).toBe("ineligible");
    expect(result.reasonCode).toBe("NOT_AN_EXPENSE");
    expect(result.eligibleITC).toBe(0);
    expect(result.eligibilityPercentage).toBe(0);
  });

  it("never lets eligible ITC exceed gross tax or drop below zero", () => {
    for (const receipt of listReceipts()) {
      const result = calculateEligibleITC(receipt);
      expect(toCents(result.eligibleITC)).toBeGreaterThanOrEqual(0);
      expect(toCents(result.eligibleITC)).toBeLessThanOrEqual(toCents(result.grossTax));
    }
  });

  it("keeps meal exception rates in the policy without using them by default", () => {
    expect(mealRate("none")).toBe(0.5);
    expect(mealRate("charityOrPublicInstitution")).toBe(1);
    expect(mealRate("longHaulTruckDriver")).toBe(0.8);
  });
});
