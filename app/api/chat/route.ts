import "server-only";
import { buildSystemPrompt } from "@/agent/prompts/system";
import { runRulesEngine } from "@/agent/orchestrate";
import { createBookkeepingTools } from "@/agent/tools/definitions";
import { wantsProcessing } from "@/agent/intent";
import { isCurrentReceiptToolResult, isItcToolResult } from "@/lib/timeline";
import { getLanguageModel } from "@/lib/model";
import type { AgentEvent, ToolName } from "@/lib/types";
import { stepCountIs, streamText, type ModelMessage } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOOLS = ["get_current_receipt", "get_receipt_details", "calculate_eligible_itc"] as const;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
  selectedReceiptId: z.string().regex(/^receipt_\d{3}$/).nullable(),
});

function isToolName(value: string): value is ToolName {
  return TOOLS.some((tool) => tool === value);
}

function sseResponse(run: (send: (event: AgentEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await run(send);
      } catch {
        send({ type: "error", message: "The copilot could not complete this request." });
        send({ type: "done", ok: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function streamRules(
  send: (event: AgentEvent) => void,
  input: { message: string; selectedReceiptId: string | null; preface?: string },
) {
  if (input.preface) {
    send({ type: "text", delta: input.preface });
  }
  for await (const event of runRulesEngine({
    message: input.message,
    selectedReceiptId: input.selectedReceiptId,
  })) {
    send(event);
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 100_000) {
    return Response.json({ error: "Request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { messages, selectedReceiptId } = parsed.data;
  const latest = messages[messages.length - 1];
  if (!latest || latest.role !== "user") {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  let modelError: string | null = null;
  let model: ReturnType<typeof getLanguageModel> = null;
  try {
    model = getLanguageModel();
  } catch (error) {
    modelError = error instanceof Error ? error.message : "The model provider is not configured.";
  }

  if (!model) {
    return sseResponse(async (send) => {
      send({ type: "meta", mode: "rules", model: null });
      await streamRules(send, {
        message: latest.content,
        selectedReceiptId,
        preface: modelError ? `${modelError}\n\n` : undefined,
      });
    });
  }

  const modelName = process.env.MODEL_NAME?.trim() || "gpt-4o-mini";
  const tools = createBookkeepingTools(selectedReceiptId);
  const modelMessages: ModelMessage[] = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return sseResponse(async (send) => {
    send({ type: "meta", mode: "model", model: modelName });
    let failed = false;
    let started = false;
    let calculationCompleted = false;

    try {
      const result = streamText({
        model,
        system: buildSystemPrompt(selectedReceiptId),
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
        prepareStep: ({ stepNumber, steps }) => {
          if (!wantsProcessing(latest.content)) {
            return undefined;
          }
          if (stepNumber === 0) {
            return { toolChoice: { type: "tool", toolName: "get_current_receipt" } };
          }
          const loaded = steps.some((step) =>
            step.toolResults.some(
              (toolResult) =>
                toolResult.toolName === "get_current_receipt" &&
                isCurrentReceiptToolResult(toolResult.output) &&
                toolResult.output.found,
            ),
          );
          if (stepNumber === 1 && loaded) {
            return { toolChoice: { type: "tool", toolName: "calculate_eligible_itc" } };
          }
          return { toolChoice: "none" };
        },
      });

      for await (const part of result.fullStream) {
        started = true;
        if (part.type === "text-delta") {
          send({ type: "text", delta: part.text });
          continue;
        }
        if (part.type === "tool-input-start" || part.type === "tool-call") {
          if (isToolName(part.toolName)) {
            send({ type: "tool", tool: part.toolName, state: "running" });
          }
          continue;
        }
        if (part.type === "tool-result" && isToolName(part.toolName)) {
          if (
            part.toolName === "calculate_eligible_itc" &&
            isItcToolResult(part.output) &&
            part.output.ok &&
            part.output.analysis
          ) {
            calculationCompleted = true;
          }
          send({ type: "tool", tool: part.toolName, state: "complete", output: part.output });
          continue;
        }
        if (part.type === "tool-error" || part.type === "error") {
          failed = true;
        }
      }
    } catch {
      if (!started || (wantsProcessing(latest.content) && !calculationCompleted)) {
        send({
          type: "text",
          delta: "The language model is unavailable. The rules engine processed the receipt instead.\n\n",
        });
        await streamRules(send, { message: latest.content, selectedReceiptId });
        return;
      }
      failed = true;
    }

    if (wantsProcessing(latest.content) && !calculationCompleted) {
      send({
        type: "text",
        delta: "\n\nThe model did not finish the calculation, so the rules engine ran it.\n\n",
      });
      await streamRules(send, { message: latest.content, selectedReceiptId });
      return;
    }

    const ok = calculationCompleted || !failed;
    if (!ok) {
      send({
        type: "error",
        message: "The language model failed during this run.",
      });
    }
    send({ type: "done", ok });
  });
}
