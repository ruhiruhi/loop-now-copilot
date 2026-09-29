import type { GifiEntry } from "@/lib/types";

/**
 * Controlled GIFI catalogue. Codes outside this map are rejected.
 * Descriptions follow CRA GIFI labels used on corporate returns.
 */
export const GIFI_CATALOGUE: Record<string, GifiEntry> = {
  "8810": {
    code: "8810",
    description: "Office expenses",
    category: "Operating expenses",
    parentCategory: "Expenses",
    applicableExpenseTypes: ["office", "supplies"],
    source: "CRA GIFI",
  },
  "8523": {
    code: "8523",
    description: "Meals and entertainment",
    category: "Operating expenses",
    parentCategory: "Expenses",
    applicableExpenseTypes: ["meals", "entertainment"],
    source: "CRA GIFI",
  },
  "1001": {
    code: "1001",
    description: "Cash",
    category: "Current assets",
    parentCategory: "Assets",
    applicableExpenseTypes: ["deposit", "cash"],
    source: "CRA GIFI",
  },
};

export function getGifiEntry(code: string): GifiEntry | null {
  return GIFI_CATALOGUE[code] ?? null;
}
