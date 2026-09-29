import { calculateEligibleITC } from "@/domain/cra/itc-rules";
import { assignGifi } from "@/domain/gifi/assign";
import type { ExpenseAnalysis, ItcStatus, Receipt } from "@/lib/types";

function combineStatus(itcStatus: ItcStatus, gifiStatus: "accepted" | "REVIEW_REQUIRED"): ItcStatus {
  if (itcStatus === "ineligible") {
    return "ineligible";
  }
  if (itcStatus === "review" || gifiStatus === "REVIEW_REQUIRED") {
    return "review";
  }
  return itcStatus;
}

export function analyzeReceipt(receipt: Receipt): ExpenseAnalysis {
  const itc = calculateEligibleITC(receipt);
  const gifi = assignGifi(receipt);
  const status = combineStatus(itc.status, gifi.status);

  let reason = itc.reason;
  if (gifi.status === "REVIEW_REQUIRED" && itc.reasonCode !== "MISSING_GST_NUMBER" && itc.status !== "ineligible") {
    reason = `${itc.reason} The GIFI code is not in the controlled catalogue, so the classification needs review.`;
  }

  return {
    receiptId: receipt.id,
    classification: gifi.classification,
    gifiCode: gifi.code,
    gifiDescription: gifi.description,
    gifiStatus: gifi.status,
    grossTax: itc.grossTax,
    eligibilityPercentage: itc.eligibilityPercentage,
    eligibleITC: itc.eligibleITC,
    status,
    reasonCode: itc.reasonCode,
    reason,
    source: "CRA_RULE_ENGINE",
  };
}
