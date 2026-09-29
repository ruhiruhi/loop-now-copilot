export type TaxType = "GST" | "HST" | "NONE";

export type ReceiptType = "expense" | "deposit";

export type ProcessingStage =
  | "idle"
  | "reading"
  | "calculating"
  | "complete"
  | "review"
  | "error";

export type ItcStatus = "eligible" | "partial" | "ineligible" | "review";

export type QueueStatus = "pending" | "processed" | "review";

export type MealException = "none" | "charityOrPublicInstitution" | "longHaulTruckDriver";

/**
 * Bookkeeping receipt. `notes` is vendor-supplied text and is never an input
 * to tax calculations or GIFI assignment.
 */
export interface Receipt {
  id: string;
  vendor: string;
  date: string;
  subtotal: number;
  tax: number;
  total: number;
  taxType: TaxType;
  gstNumber: string | null;
  commercialUsePercentage: number;
  category: string;
  mealEntertainment?: boolean;
  type: ReceiptType;
  notes?: string;
}

export interface ItcResult {
  grossTax: number;
  eligibilityPercentage: number;
  eligibleITC: number;
  status: ItcStatus;
  reasonCode: string;
  reason: string;
}

export interface GifiEntry {
  code: string;
  description: string;
  category: string;
  parentCategory: string;
  applicableExpenseTypes: string[];
  source: string;
}

export interface GifiAssignment {
  code: string | null;
  description: string | null;
  category: string | null;
  parentCategory: string | null;
  status: "accepted" | "REVIEW_REQUIRED";
  classification: string;
  confidence: "high" | "low";
  source: string | null;
}

export interface ExpenseAnalysis {
  receiptId: string;
  classification: string;
  gifiCode: string | null;
  gifiDescription: string | null;
  gifiStatus: "accepted" | "REVIEW_REQUIRED";
  grossTax: number;
  eligibilityPercentage: number;
  eligibleITC: number;
  status: ItcStatus;
  reasonCode: string;
  reason: string;
  source: "CRA_RULE_ENGINE";
}

export interface ReceiptSnapshot {
  id: string;
  vendor: string;
  date: string;
  subtotal: number;
  tax: number;
  total: number;
  taxType: TaxType;
  gstNumber: string | null;
  commercialUsePercentage: number;
  category: string;
  mealEntertainment: boolean;
  type: ReceiptType;
  untrustedNotes: string | null;
}

export interface CurrentReceiptToolResult {
  found: boolean;
  receipt: ReceiptSnapshot | null;
  message: string;
}

export interface ItcToolResult {
  ok: boolean;
  analysis: ExpenseAnalysis | null;
  message: string;
}

export type ToolName = "get_current_receipt" | "get_receipt_details" | "calculate_eligible_itc";

export type AgentEvent =
  | { type: "meta"; mode: "rules" | "model"; model: string | null }
  | { type: "tool"; tool: ToolName; state: "running" }
  | { type: "tool"; tool: ToolName; state: "complete"; output: unknown }
  | { type: "tool"; tool: ToolName; state: "error"; message: string }
  | { type: "text"; delta: string }
  | { type: "error"; message: string }
  | { type: "done"; ok: boolean };

export interface TimelineStep {
  id: string;
  tone: "running" | "complete" | "warning" | "error";
  label: string;
}

export interface ReceiptRecord extends Receipt {
  queueStatus: QueueStatus;
  analysis: ExpenseAnalysis | null;
}
