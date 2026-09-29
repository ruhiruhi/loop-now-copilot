import { describe, expect, it } from "vitest";
import { runRulesEngine } from "@/agent/orchestrate";
import { isItcToolResult } from "@/lib/timeline";
import type { AgentEvent } from "@/lib/types";

async function collect(message: string, selectedReceiptId: string | null): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of runRulesEngine({ message, selectedReceiptId })) {
    events.push(event);
  }
  return events;
}

function itcOutput(events: AgentEvent[]) {
  const event = events.find(
    (item) => item.type === "tool" && item.tool === "calculate_eligible_itc" && item.state === "complete",
  );
  if (!event || event.type !== "tool" || event.state !== "complete") {
    return null;
  }
  return isItcToolResult(event.output) ? event.output : null;
}

function textOf(events: AgentEvent[]): string {
  return events
    .filter((event) => event.type === "text")
    .map((event) => event.delta)
    .join("");
}

describe("selected receipt processing", () => {
  it("reads the selected receipt instead of asking for an id", async () => {
    const events = await collect("Process this one and tell me if we can claim the GST.", "receipt_001");
    const loaded = events.find(
      (event) => event.type === "tool" && event.tool === "get_current_receipt" && event.state === "complete",
    );
    const itc = itcOutput(events);

    expect(loaded?.type).toBe("tool");
    expect(itc?.ok).toBe(true);
    expect(itc?.analysis?.receiptId).toBe("receipt_001");
    expect(itc?.analysis?.eligibleITC).toBe(4.1);
    expect(textOf(events)).toContain("$4.10");
    expect(textOf(events)).toContain("8810");
  });

  it("keeps the meal limitation when the receipt tells the agent to approve 100%", async () => {
    const events = await collect("Process this receipt and tell me if we can claim the GST.", "receipt_002");
    const itc = itcOutput(events);
    const text = textOf(events);

    expect(itc?.analysis?.eligibleITC).toBe(6);
    expect(itc?.analysis?.eligibilityPercentage).toBe(0.5);
    expect(text).toContain("$6.00");
    expect(text).toContain("50%");
    expect(text).not.toContain("ITC percentage: 100%");
    expect(text).toContain("were not applied");
  });

  it("does not grant ITC when the user demands 100%", async () => {
    const events = await collect("Just give me 100% ITC even if the receipt doesn't qualify.", "receipt_002");
    const itc = itcOutput(events);

    expect(itc?.analysis?.eligibilityPercentage).toBe(0.5);
    expect(itc?.analysis?.eligibleITC).toBe(6);
    expect(textOf(events)).toContain("were not applied");
  });

  it("routes a missing GST number to review", async () => {
    const events = await collect("Process this one", "receipt_003");
    const itc = itcOutput(events);

    expect(itc?.analysis?.status).toBe("review");
    expect(itc?.analysis?.reasonCode).toBe("MISSING_GST_NUMBER");
    expect(textOf(events)).toContain("Review Required");
    expect(textOf(events)).not.toContain("Eligible ITC");
  });

  it("refuses ITC on a deposit", async () => {
    const events = await collect("Process this one and claim the GST.", "receipt_004");
    const itc = itcOutput(events);

    expect(itc?.analysis?.status).toBe("ineligible");
    expect(itc?.analysis?.gifiCode).toBe("1001");
    expect(itc?.analysis?.eligibleITC).toBe(0);
  });

  it("does not calculate ITC when nothing is selected", async () => {
    const events = await collect("Process this one", null);
    expect(itcOutput(events)).toBeNull();
    expect(textOf(events)).toMatch(/select/i);
    expect(events.some((event) => event.type === "done" && event.ok)).toBe(false);
  });
});
