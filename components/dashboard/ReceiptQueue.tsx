import type { ReceiptRecord } from "@/lib/types";
import { formatCad } from "@/lib/format";

const statusCopy: Record<ReceiptRecord["queueStatus"], string> = {
  pending: "Pending",
  processed: "Processed",
  review: "Review",
};

export function ReceiptQueue({
  receipts,
  selectedReceiptId,
  onSelect,
}: {
  receipts: ReceiptRecord[];
  selectedReceiptId: string | null;
  onSelect: (receiptId: string) => void;
}) {
  const pending = receipts.filter((receipt) => receipt.queueStatus === "pending").length;
  const processed = receipts.filter((receipt) => receipt.queueStatus === "processed").length;
  const review = receipts.filter((receipt) => receipt.queueStatus === "review").length;

  return (
    <section aria-label="Receipt queue" className="flex h-full flex-col">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-100">Queue</h2>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          <span>{pending} pending</span>
          <span>{processed} processed</span>
          <span>{review} review</span>
        </p>
      </div>
      <ul className="flex gap-2 overflow-x-auto p-2 lg:block lg:overflow-visible">
        {receipts.map((receipt) => {
          const selected = receipt.id === selectedReceiptId;
          return (
            <li key={receipt.id} className="min-w-[220px] lg:min-w-0">
              <button
                type="button"
                onClick={() => onSelect(receipt.id)}
                aria-current={selected ? "true" : undefined}
                className={`w-full border px-3 py-2.5 text-left ${
                  selected
                    ? "border-zinc-700 bg-zinc-900"
                    : "border-transparent hover:border-zinc-800 hover:bg-zinc-900/50"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-100">{receipt.vendor}</span>
                  <span className="text-xs text-zinc-500">{statusCopy[receipt.queueStatus]}</span>
                </span>
                <span className="mt-1 flex items-center justify-between gap-3 text-xs text-zinc-400">
                  <span>{receiptLabel(receipt.id)}</span>
                  <span>{formatCad(receipt.total)}</span>
                </span>
                {selected ? <span className="mt-1 block text-xs text-zinc-300">Selected</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function receiptLabel(id: string): string {
  return id.replace("receipt_", "Receipt ");
}
