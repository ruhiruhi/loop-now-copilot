import { formatCad, formatPercent } from "@/lib/format";
import type {
  AgentEvent,
  CurrentReceiptToolResult,
  ExpenseAnalysis,
  ItcToolResult,
  TimelineStep,
  ToolName,
} from "@/lib/types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isCurrentReceiptToolResult(value: unknown): value is CurrentReceiptToolResult {
  if (!isRecord(value) || typeof value.found !== "boolean" || typeof value.message !== "string") {
    return false;
  }
  if (value.receipt === null) {
    return true;
  }
  return isRecord(value.receipt) && typeof value.receipt.id === "string" && typeof value.receipt.vendor === "string";
}

export function isExpenseAnalysis(value: unknown): value is ExpenseAnalysis {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.receiptId === "string" &&
    typeof value.classification === "string" &&
    typeof value.grossTax === "number" &&
    typeof value.eligibilityPercentage === "number" &&
    typeof value.eligibleITC === "number" &&
    (value.status === "eligible" ||
      value.status === "partial" ||
      value.status === "ineligible" ||
      value.status === "review") &&
    typeof value.reasonCode === "string" &&
    typeof value.reason === "string" &&
    value.source === "CRA_RULE_ENGINE"
  );
}

export function isItcToolResult(value: unknown): value is ItcToolResult {
  if (!isRecord(value) || typeof value.ok !== "boolean" || typeof value.message !== "string") {
    return false;
  }
  if (value.analysis === null) {
    return true;
  }
  return isExpenseAnalysis(value.analysis);
}

function runningLabel(tool: ToolName): string {
  switch (tool) {
    case "get_current_receipt":
      return "Reading selected receipt";
    case "get_receipt_details":
      return "Loading receipt details";
    case "calculate_eligible_itc":
      return "Calculating eligible ITC";
  }
}

function stepsForReceipt(tool: ToolName, output: unknown): TimelineStep[] {
  if (!isCurrentReceiptToolResult(output)) {
    return [{ id: `${tool}-invalid`, tone: "error", label: "Receipt tool returned an unexpected result" }];
  }
  if (!output.found) {
    return [{ id: `${tool}-missing`, tone: "error", label: output.message }];
  }
  return [{ id: `${tool}-loaded`, tone: "complete", label: "Receipt loaded" }];
}

function stepsForItc(output: unknown): TimelineStep[] {
  if (!isItcToolResult(output) || !output.ok || !output.analysis) {
    const message = isItcToolResult(output) ? output.message : "ITC tool returned an unexpected result";
    return [{ id: "itc-failed", tone: "error", label: message }];
  }

  const analysis = output.analysis;
  if (analysis.reasonCode === "MISSING_GST_NUMBER") {
    return [
      { id: "itc-missing-number", tone: "warning", label: "GST/HST number missing" },
      { id: "itc-review", tone: "warning", label: "Review required" },
    ];
  }

  if (analysis.reasonCode === "NOT_AN_EXPENSE") {
    const steps: TimelineStep[] = [
      { id: "itc-deposit", tone: "complete", label: "Classified as a cash deposit" },
      { id: "itc-ineligible", tone: "complete", label: "ITC ineligible" },
    ];
    return appendGifi(steps, analysis);
  }

  const steps: TimelineStep[] = [];
  if (analysis.reasonCode === "MEAL_ENTERTAINMENT_50") {
    steps.push({
      id: "itc-meal",
      tone: "complete",
      label: `${formatPercent(analysis.eligibilityPercentage)} meal limitation applied`,
    });
  }
  steps.push({
    id: "itc-amount",
    tone: "complete",
    label: `Eligible ITC: ${formatCad(analysis.eligibleITC)}`,
  });
  return appendGifi(steps, analysis);
}

function appendGifi(steps: TimelineStep[], analysis: ExpenseAnalysis): TimelineStep[] {
  if (analysis.gifiStatus === "accepted" && analysis.gifiCode) {
    steps.push({
      id: "gifi-accepted",
      tone: "complete",
      label: `GIFI ${analysis.gifiCode} — ${analysis.gifiDescription ?? ""}`,
    });
    return steps;
  }
  steps.push({ id: "gifi-review", tone: "warning", label: "GIFI review required" });
  return steps;
}

export function applyToolEvent(steps: TimelineStep[], event: Extract<AgentEvent, { type: "tool" }>): TimelineStep[] {
  const withoutRunning = steps.filter((step) => step.id !== `${event.tool}-running`);

  if (event.state === "running") {
    return [
      ...withoutRunning,
      { id: `${event.tool}-running`, tone: "running", label: runningLabel(event.tool) },
    ];
  }

  if (event.state === "error") {
    return [...withoutRunning, { id: `${event.tool}-error`, tone: "error", label: event.message }];
  }

  if (event.tool === "calculate_eligible_itc") {
    return [...withoutRunning, ...stepsForItc(event.output)];
  }

  return [...withoutRunning, ...stepsForReceipt(event.tool, event.output)];
}
