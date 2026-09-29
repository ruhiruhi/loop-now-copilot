import { isRecord } from "@/lib/timeline";
import type { AgentEvent, ToolName } from "@/lib/types";

const TOOLS: readonly ToolName[] = ["get_current_receipt", "get_receipt_details", "calculate_eligible_itc"];

function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOLS.some((tool) => tool === value);
}

export function parseAgentEvent(value: unknown): AgentEvent | null {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null;
  }

  switch (value.type) {
    case "meta":
      if ((value.mode === "rules" || value.mode === "model") && (typeof value.model === "string" || value.model === null)) {
        return { type: "meta", mode: value.mode, model: value.model };
      }
      return null;
    case "text":
      if (typeof value.delta === "string") {
        return { type: "text", delta: value.delta };
      }
      return null;
    case "error":
      if (typeof value.message === "string") {
        return { type: "error", message: value.message };
      }
      return null;
    case "done":
      if (typeof value.ok === "boolean") {
        return { type: "done", ok: value.ok };
      }
      return null;
    case "tool": {
      if (!isToolName(value.tool)) {
        return null;
      }
      if (value.state === "running") {
        return { type: "tool", tool: value.tool, state: "running" };
      }
      if (value.state === "error" && typeof value.message === "string") {
        return { type: "tool", tool: value.tool, state: "error", message: value.message };
      }
      if (value.state === "complete" && "output" in value) {
        return { type: "tool", tool: value.tool, state: "complete", output: value.output };
      }
      return null;
    }
    default:
      return null;
  }
}
