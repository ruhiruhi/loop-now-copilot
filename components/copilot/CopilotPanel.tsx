"use client";

import { useRef, useState } from "react";
import { ToolTimeline } from "@/components/tool-calls/ToolTimeline";
import { parseAgentEvent } from "@/lib/events";
import { applyToolEvent, isExpenseAnalysis, isItcToolResult, isRecord } from "@/lib/timeline";
import type { ExpenseAnalysis, ProcessingStage, TimelineStep } from "@/lib/types";

const SUGGESTED_PROMPT = "Process this receipt and tell me if we can claim the GST.";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  steps: TimelineStep[];
  failed: boolean;
}

export function CopilotPanel({
  selectedReceiptId,
  onAnalysis,
  onStageChange,
  onRunActiveChange,
}: {
  selectedReceiptId: string | null;
  onAnalysis: (analysis: ExpenseAnalysis) => void;
  onStageChange: (stage: ProcessingStage) => void;
  onRunActiveChange: (active: boolean) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [modeLabel, setModeLabel] = useState("Rules engine");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }

    const history = [
      ...messages
        .filter((message) => message.content.trim().length > 0)
        .map((message) => ({ role: message.role, content: message.content })),
      { role: "user" as const, content: trimmed },
    ];
    const assistantId = crypto.randomUUID();

    setBusy(true);
    onRunActiveChange(true);
    setInput("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmed, steps: [], failed: false },
      { id: assistantId, role: "assistant", content: "", steps: [], failed: false },
    ]);

    const patch = (update: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) => current.map((message) => (message.id === assistantId ? update(message) : message)));
    };

    let sawDone = false;
    let sawFailure = false;
    let usedTools = false;
    let businessStatus: ExpenseAnalysis["status"] | null = null;

    const fail = (message: string) => {
      sawFailure = true;
      onStageChange("error");
      patch((current) => ({
        ...current,
        failed: true,
        content: current.content ? `${current.content}\n\n${message}` : message,
      }));
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          selectedReceiptId,
        }),
      });

      if (!response.ok || !response.body) {
        const payload: unknown = await response.json().catch(() => null);
        const message =
          isRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "The copilot could not complete this request.";
        fail(message);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .map((item) => item.trim())
            .find((item) => item.startsWith("data:"));
          if (!line) {
            continue;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(line.slice(5).trim());
          } catch {
            fail("The copilot returned an unreadable update.");
            continue;
          }

          const event = parseAgentEvent(parsed);
          if (!event) {
            fail("The copilot returned an unexpected update.");
            continue;
          }

          if (event.type === "meta") {
            setModeLabel(event.mode === "model" && event.model ? `Model · ${event.model}` : "Rules engine");
            continue;
          }

          if (event.type === "text") {
            patch((current) => ({ ...current, content: current.content + event.delta }));
            continue;
          }

          if (event.type === "error") {
            fail(event.message);
            continue;
          }

          if (event.type === "tool") {
            usedTools = true;
            if (event.state === "running" && event.tool === "get_current_receipt") {
              onStageChange("reading");
            }
            if (event.state === "running" && event.tool === "get_receipt_details") {
              onStageChange("reading");
            }
            if (event.state === "running" && event.tool === "calculate_eligible_itc") {
              onStageChange("calculating");
            }
            if (event.state === "error") {
              sawFailure = true;
              onStageChange("error");
            }
            if (event.state === "complete" && event.tool === "calculate_eligible_itc") {
              if (!isItcToolResult(event.output) || !event.output.ok || !event.output.analysis) {
                sawFailure = true;
                onStageChange("error");
              } else if (isExpenseAnalysis(event.output.analysis)) {
                businessStatus = event.output.analysis.status;
                onAnalysis(event.output.analysis);
                onStageChange(event.output.analysis.status === "review" ? "review" : "calculating");
              }
            }
            patch((current) => ({
              ...current,
              steps: applyToolEvent(current.steps, event),
            }));
            continue;
          }

          if (event.type === "done") {
            sawDone = true;
            if (!event.ok || sawFailure) {
              onStageChange("error");
              patch((current) => ({ ...current, failed: true }));
            } else if (!usedTools) {
              onStageChange("idle");
            } else if (businessStatus === "review") {
              onStageChange("review");
            } else {
              onStageChange("complete");
              patch((current) => ({
                ...current,
                steps: [
                  ...current.steps,
                  { id: "processing-complete", tone: "complete", label: "Processing complete" },
                ],
              }));
            }
          }
        }
      }

      if (!sawDone && !sawFailure) {
        fail("Connection interrupted. Send the message again to retry.");
      }
    } catch {
      onStageChange("error");
      patch((current) => ({
        ...current,
        failed: true,
        content: current.content
          ? `${current.content}\n\nConnection interrupted. Send the message again to retry.`
          : "Connection interrupted. Send the message again to retry.",
      }));
    } finally {
      setBusy(false);
      onRunActiveChange(false);
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    }
  }

  const lastFailed = messages.length > 0 && messages[messages.length - 1]?.failed;

  return (
    <section aria-label="AI copilot" className="flex h-full min-h-[70vh] flex-col lg:min-h-0">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-100">AI Copilot</h2>
        <p className="text-xs text-zinc-500">{modeLabel}</p>
      </div>
      <div ref={threadRef} aria-live="polite" className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm leading-6 text-zinc-400">
            Ask the copilot to process the selected receipt. You do not need to paste the receipt.
          </p>
        ) : null}
        {messages.map((message) => (
          <article key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
            <p className="text-xs text-zinc-500">{message.role === "user" ? "You" : "Copilot"}</p>
            {message.role === "assistant" && message.steps.length > 0 ? (
              <div className="mt-2 border border-zinc-800 px-3 py-2">
                <ToolTimeline steps={message.steps} />
              </div>
            ) : null}
            {message.content ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-100">{message.content}</p>
            ) : null}
          </article>
        ))}
      </div>
      <form
        className="border-t border-zinc-800 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="mb-2">
          <button
            type="button"
            className="border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-600"
            onClick={() => {
              setInput(SUGGESTED_PROMPT);
              inputRef.current?.focus();
            }}
          >
            Process this receipt
          </button>
        </div>
        <label htmlFor="copilot-input" className="sr-only">
          Message the copilot
        </label>
        <textarea
          id="copilot-input"
          ref={inputRef}
          value={input}
          rows={3}
          maxLength={2000}
          placeholder="Process this receipt and tell me if we can claim the GST."
          className="w-full resize-none border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          {lastFailed ? (
            <button
              type="button"
              className="text-xs text-zinc-300 underline"
              onClick={() => {
                const lastUser = [...messages].reverse().find((message) => message.role === "user");
                if (lastUser) {
                  void send(lastUser.content);
                }
              }}
            >
              Retry
            </button>
          ) : (
            <span className="text-xs text-zinc-600">{busy ? "Working" : "Idle"}</span>
          )}
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            className="border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 disabled:text-zinc-600"
          >
            {busy ? "Sending" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}
