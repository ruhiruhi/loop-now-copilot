import { ResultCard } from "@/components/receipt/ResultCard";
import { formatCad } from "@/lib/format";
import type { ProcessingStage, ReceiptRecord } from "@/lib/types";

const stageCopy: Partial<Record<ProcessingStage, string>> = {
  reading: "Reading selected receipt",
  calculating: "Calculating eligible ITC",
  error: "The last run did not finish",
};

export function ReceiptPanel({
  receipt,
  stage,
}: {
  receipt: ReceiptRecord | null;
  stage: ProcessingStage;
}) {
  if (!receipt) {
    return (
      <section aria-label="Selected receipt" className="flex h-full items-center justify-center px-6">
        <p className="max-w-sm text-center text-sm leading-6 text-zinc-400">
          Select a receipt from the queue. The copilot uses that selection when you ask it to process this one.
        </p>
      </section>
    );
  }

  const live = stageCopy[stage];

  return (
    <section aria-label="Selected receipt" className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-6">
      <div>
        <p className="text-xs tracking-wide text-zinc-500">{receipt.id.replace("receipt_", "Receipt ")}</p>
        <h2 className="mt-1 text-2xl font-medium tracking-tight text-zinc-50">{receipt.vendor}</h2>
        <p className="mt-1 text-sm text-zinc-400">{receipt.date}</p>
      </div>

      <div>
        <p className="text-3xl font-medium tracking-tight text-zinc-50">{formatCad(receipt.total)}</p>
        <dl className="mt-3 grid max-w-sm grid-cols-2 gap-y-1 text-sm">
          <dt className="text-zinc-500">Subtotal</dt>
          <dd className="text-right text-zinc-200">{formatCad(receipt.subtotal)}</dd>
          <dt className="text-zinc-500">{receipt.taxType === "NONE" ? "Tax" : receipt.taxType}</dt>
          <dd className="text-right text-zinc-200">{formatCad(receipt.tax)}</dd>
        </dl>
      </div>

      <dl className="grid grid-cols-1 gap-3 border-y border-zinc-800 py-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">GST/HST number</dt>
          <dd className="mt-1 font-mono text-zinc-100">{receipt.gstNumber ?? "Missing"}</dd>
          <dd className="mt-1 text-xs text-zinc-500">Format is not verified with the CRA.</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Commercial use</dt>
          <dd className="mt-1 text-zinc-100">{receipt.commercialUsePercentage}%</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Category</dt>
          <dd className="mt-1 text-zinc-100">{receipt.analysis?.classification ?? receipt.category}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Type</dt>
          <dd className="mt-1 text-zinc-100">{receipt.type === "deposit" ? "Deposit" : "Expense"}</dd>
        </div>
      </dl>

      {receipt.notes ? (
        <div className="border border-zinc-800 px-4 py-3">
          <h3 className="text-xs font-medium text-zinc-400">Vendor-supplied note</h3>
          <p className="mt-1 text-xs text-zinc-500">Untrusted data. Not used for tax calculations.</p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{receipt.notes}</p>
        </div>
      ) : null}

      <div aria-live="polite">
        {live ? <p className="text-sm text-zinc-300">{live}</p> : null}
        {receipt.analysis ? (
          <div className={live ? "mt-4" : undefined}>
            <ResultCard analysis={receipt.analysis} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
