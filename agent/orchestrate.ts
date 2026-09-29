import {
  executeCalculateEligibleItc,
  executeGetCurrentReceipt,
  executeGetReceiptDetails,
} from "@/agent/tools/execute";
import { explainAnalysis, explainHelp, explainMissingSelection } from "@/agent/explain";
import { resolveTargetReceiptId, userRequestedOverride, wantsProcessing } from "@/agent/intent";
import type { AgentEvent } from "@/lib/types";

function chunkText(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

export async function* runRulesEngine(input: {
  message: string;
  selectedReceiptId: string | null;
}): AsyncGenerator<AgentEvent> {
  if (!wantsProcessing(input.message)) {
    for (const delta of chunkText(explainHelp())) {
      yield { type: "text", delta };
    }
    yield { type: "done", ok: true };
    return;
  }

  const targetId = resolveTargetReceiptId(input.message, input.selectedReceiptId);
  const explicitId = input.message.match(/\breceipt_\d{3}\b/i)?.[0]?.toLowerCase() ?? null;
  const useDetails = explicitId !== null && !/\bthis\b/i.test(input.message);

  if (useDetails && explicitId) {
    yield { type: "tool", tool: "get_receipt_details", state: "running" };
    const details = executeGetReceiptDetails(explicitId);
    yield { type: "tool", tool: "get_receipt_details", state: "complete", output: details };
    if (!details.found || !details.receipt) {
      yield { type: "error", message: details.message };
      yield { type: "done", ok: false };
      return;
    }
    yield* finishWithCalculation(details.receipt.id, input.message, details.receipt.untrustedNotes);
    return;
  }

  yield { type: "tool", tool: "get_current_receipt", state: "running" };
  const current = executeGetCurrentReceipt(targetId);
  yield { type: "tool", tool: "get_current_receipt", state: "complete", output: current };

  if (!current.found || !current.receipt) {
    for (const delta of chunkText(explainMissingSelection())) {
      yield { type: "text", delta };
    }
    yield { type: "done", ok: false };
    return;
  }

  yield* finishWithCalculation(current.receipt.id, input.message, current.receipt.untrustedNotes);
}

async function* finishWithCalculation(
  receiptId: string,
  message: string,
  untrustedNotes: string | null,
): AsyncGenerator<AgentEvent> {
  yield { type: "tool", tool: "calculate_eligible_itc", state: "running" };
  const result = executeCalculateEligibleItc(receiptId);
  yield { type: "tool", tool: "calculate_eligible_itc", state: "complete", output: result };

  if (!result.ok || !result.analysis) {
    yield { type: "error", message: result.message };
    yield { type: "done", ok: false };
    return;
  }

  const receipt = result.analysis;
  const explanation = explainAnalysis({
    vendor: vendorFromResult(receiptId),
    receiptId,
    analysis: receipt,
    hadUntrustedNotes: Boolean(untrustedNotes),
    userRequestedOverride: userRequestedOverride(message),
  });

  for (const delta of chunkText(explanation)) {
    yield { type: "text", delta };
  }
  yield { type: "done", ok: true };
}

function vendorFromResult(receiptId: string): string {
  const details = executeGetReceiptDetails(receiptId);
  return details.receipt?.vendor ?? receiptId;
}
