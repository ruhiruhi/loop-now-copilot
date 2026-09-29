"use client";

import { useState } from "react";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { ReceiptQueue } from "@/components/dashboard/ReceiptQueue";
import { ReceiptPanel } from "@/components/receipt/ReceiptPanel";
import { listReceipts } from "@/data/receipts";
import type { ExpenseAnalysis, ProcessingStage, ReceiptRecord } from "@/lib/types";

function initialReceipts(): ReceiptRecord[] {
  return listReceipts().map((receipt) => ({
    ...receipt,
    queueStatus: "pending",
    analysis: null,
  }));
}

export function DashboardShell() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>(initialReceipts);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [liveStage, setLiveStage] = useState<ProcessingStage>("idle");
  const [runActive, setRunActive] = useState(false);

  const selected = receipts.find((receipt) => receipt.id === selectedReceiptId) ?? null;
  const stage: ProcessingStage = runActive
    ? liveStage
    : selected?.analysis
      ? selected.analysis.status === "review"
        ? "review"
        : "complete"
      : liveStage === "error"
        ? "error"
        : "idle";

  function applyAnalysis(analysis: ExpenseAnalysis) {
    setReceipts((current) =>
      current.map((receipt) => {
        if (receipt.id !== analysis.receiptId) {
          return receipt;
        }
        return {
          ...receipt,
          category: analysis.classification,
          analysis,
          queueStatus: analysis.status === "review" ? "review" : "processed",
        };
      }),
    );
  }

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh lg:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div className="flex items-baseline gap-3">
          <p className="text-sm font-medium tracking-tight text-zinc-50">Loopnow CPA Copilot</p>
          <p className="hidden text-xs text-zinc-500 sm:block">GST/HST bookkeeping</p>
        </div>
        <p className="text-xs text-zinc-400">Sample Co.</p>
      </header>
      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        <div className="border-b border-zinc-800 lg:min-h-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
          <ReceiptQueue
            receipts={receipts}
            selectedReceiptId={selectedReceiptId}
            onSelect={(receiptId) => {
              setSelectedReceiptId(receiptId);
              if (!runActive) {
                setLiveStage("idle");
              }
            }}
          />
        </div>
        <main className="lg:min-h-0 lg:overflow-y-auto">
          <ReceiptPanel receipt={selected} stage={stage} />
        </main>
        <div className="border-t border-zinc-800 lg:min-h-0 lg:border-t-0 lg:border-l">
          <CopilotPanel
            selectedReceiptId={selectedReceiptId}
            onAnalysis={applyAnalysis}
            onStageChange={setLiveStage}
            onRunActiveChange={setRunActive}
          />
        </div>
      </div>
    </div>
  );
}
