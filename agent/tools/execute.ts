import { getReceiptById } from "@/data/receipts";
import { analyzeReceipt } from "@/domain/cra/analyze";
import type { CurrentReceiptToolResult, ItcToolResult, Receipt, ReceiptSnapshot } from "@/lib/types";

const RECEIPT_ID = /^receipt_\d{3}$/;

function snapshot(receipt: Receipt): ReceiptSnapshot {
  return {
    id: receipt.id,
    vendor: receipt.vendor,
    date: receipt.date,
    subtotal: receipt.subtotal,
    tax: receipt.tax,
    total: receipt.total,
    taxType: receipt.taxType,
    gstNumber: receipt.gstNumber,
    commercialUsePercentage: receipt.commercialUsePercentage,
    category: receipt.category,
    mealEntertainment: receipt.mealEntertainment === true,
    type: receipt.type,
    untrustedNotes: receipt.notes ?? null,
  };
}

export function executeGetCurrentReceipt(selectedReceiptId: string | null): CurrentReceiptToolResult {
  if (!selectedReceiptId) {
    return {
      found: false,
      receipt: null,
      message: "No receipt is selected.",
    };
  }
  return executeGetReceiptDetails(selectedReceiptId);
}

export function executeGetReceiptDetails(receiptId: string): CurrentReceiptToolResult {
  if (!RECEIPT_ID.test(receiptId)) {
    return {
      found: false,
      receipt: null,
      message: "Receipt id is not valid.",
    };
  }

  const receipt = getReceiptById(receiptId);
  if (!receipt) {
    return {
      found: false,
      receipt: null,
      message: "Receipt not found.",
    };
  }

  return {
    found: true,
    receipt: snapshot(receipt),
    message: "Receipt loaded.",
  };
}

export function executeCalculateEligibleItc(receiptId: string): ItcToolResult {
  if (!RECEIPT_ID.test(receiptId)) {
    return {
      ok: false,
      analysis: null,
      message: "Receipt id is not valid.",
    };
  }

  const receipt = getReceiptById(receiptId);
  if (!receipt) {
    return {
      ok: false,
      analysis: null,
      message: "Receipt not found.",
    };
  }

  const analysis = analyzeReceipt(receipt);
  return {
    ok: true,
    analysis,
    message: "Rules engine completed. Use analysis.status as the business outcome.",
  };
}
