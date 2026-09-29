import { getGifiEntry } from "@/data/gifi";
import type { GifiAssignment, Receipt } from "@/lib/types";

const CLASSIFICATION_BY_CODE: Record<string, string> = {
  "8810": "Office Expenses",
  "8523": "Meals & Entertainment",
  "1001": "Cash",
};

function proposeGifiCode(receipt: Receipt): string | null {
  if (receipt.type === "deposit") {
    return "1001";
  }
  if (receipt.mealEntertainment) {
    return "8523";
  }
  if (receipt.vendor.toLowerCase().includes("staples")) {
    return "8810";
  }
  return null;
}

export function resolveGifiCode(proposedCode: string | null): GifiAssignment {
  if (!proposedCode) {
    return {
      code: null,
      description: null,
      category: null,
      parentCategory: null,
      status: "REVIEW_REQUIRED",
      classification: "Unknown",
      confidence: "low",
      source: null,
    };
  }

  const entry = getGifiEntry(proposedCode);
  if (!entry) {
    return {
      code: null,
      description: null,
      category: null,
      parentCategory: null,
      status: "REVIEW_REQUIRED",
      classification: "Unknown",
      confidence: "low",
      source: null,
    };
  }

  return {
    code: entry.code,
    description: entry.description,
    category: entry.category,
    parentCategory: entry.parentCategory,
    status: "accepted",
    classification: CLASSIFICATION_BY_CODE[entry.code] ?? entry.description,
    confidence: "high",
    source: entry.source,
  };
}

/** Proposes a catalogue code from structured fields, then verifies it exists. */
export function assignGifi(receipt: Receipt): GifiAssignment {
  return resolveGifiCode(proposeGifiCode(receipt));
}
