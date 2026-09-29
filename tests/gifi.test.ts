import { describe, expect, it } from "vitest";
import { getReceiptById } from "@/data/receipts";
import { assignGifi, resolveGifiCode } from "@/domain/gifi/assign";
import type { Receipt } from "@/lib/types";

function requireReceipt(id: string): Receipt {
  const receipt = getReceiptById(id);
  if (!receipt) {
    throw new Error(`Missing fixture ${id}`);
  }
  return receipt;
}

describe("GIFI catalogue", () => {
  it("maps the mock receipts onto controlled codes", () => {
    expect(assignGifi(requireReceipt("receipt_001"))).toMatchObject({
      code: "8810",
      status: "accepted",
      classification: "Office Expenses",
      confidence: "high",
    });
    expect(assignGifi(requireReceipt("receipt_002"))).toMatchObject({
      code: "8523",
      status: "accepted",
      classification: "Meals & Entertainment",
    });
    expect(assignGifi(requireReceipt("receipt_004"))).toMatchObject({
      code: "1001",
      status: "accepted",
      classification: "Cash",
    });
  });

  it("rejects a code that is not in the catalogue", () => {
    expect(resolveGifiCode("999999")).toMatchObject({
      code: null,
      status: "REVIEW_REQUIRED",
      confidence: "low",
    });
  });

  it("does not invent a code for an unknown vendor", () => {
    expect(assignGifi(requireReceipt("receipt_003")).status).toBe("REVIEW_REQUIRED");
  });
});
