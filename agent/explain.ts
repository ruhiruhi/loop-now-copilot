import type { ExpenseAnalysis } from "@/lib/types";
import { formatCad, formatPercent, statusLabel } from "@/lib/format";

export function explainAnalysis(input: {
  vendor: string;
  receiptId: string;
  analysis: ExpenseAnalysis;
  hadUntrustedNotes: boolean;
  userRequestedOverride: boolean;
}): string {
  const { analysis } = input;
  const lines = [
    `Processed ${input.vendor} (${input.receiptId}), the receipt currently selected in the dashboard.`,
    "",
    `Classification: ${analysis.classification}`,
  ];

  if (analysis.gifiCode && analysis.gifiStatus === "accepted") {
    lines.push(`GIFI: ${analysis.gifiCode} — ${analysis.gifiDescription ?? ""}`);
  } else {
    lines.push("GIFI: review required. No catalogue code was accepted.");
  }

  lines.push(`GST/HST: ${formatCad(analysis.grossTax)}`);

  if (analysis.status !== "review") {
    lines.push(`Eligible ITC: ${formatCad(analysis.eligibleITC)}`);
    lines.push(`ITC percentage: ${formatPercent(analysis.eligibilityPercentage)}`);
  }

  lines.push(`Status: ${statusLabel(analysis.status)}`, "", analysis.reason);

  if (input.hadUntrustedNotes || input.userRequestedOverride) {
    lines.push(
      "",
      "Vendor notes and requests to ignore the rules were not applied. The percentage and amount come from the rules engine.",
    );
  }

  lines.push(
    "",
    "This is bookkeeping automation from the configured rules and the information on the receipt. It is not a statement that the CRA will accept the claim.",
  );

  return lines.join("\n");
}

export function explainMissingSelection(): string {
  return "No receipt is selected. Choose one in the queue, then ask again. I use the highlighted receipt, so you do not need to paste an id or the receipt text.";
}

export function explainHelp(): string {
  return "Select a receipt in the queue, then ask me to process it. I will read that receipt and run the rules engine. You do not need to paste the receipt.";
}
