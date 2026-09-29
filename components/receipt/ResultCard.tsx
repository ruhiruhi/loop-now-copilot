import type { ExpenseAnalysis } from "@/lib/types";
import { formatCad, formatPercent, statusLabel } from "@/lib/format";

export function ResultCard({ analysis }: { analysis: ExpenseAnalysis }) {
  const rows = rowsFor(analysis);

  return (
    <section aria-label="Processing result" className="border border-zinc-800 bg-zinc-900/40">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-medium text-zinc-100">Result</h2>
        <span className={statusClass(analysis.status)}>{statusLabel(analysis.status)}</span>
      </div>
      <dl className="grid grid-cols-1 gap-y-2 px-4 py-3 text-sm sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-x-4">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-zinc-500">{row.label}</dt>
            <dd className="text-zinc-100">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-zinc-800 px-4 py-3 text-sm leading-6 text-zinc-300">{analysis.reason}</p>
      <p className="px-4 pb-3 text-xs text-zinc-500">Source: configured rules engine. Not a CRA acceptance decision.</p>
    </section>
  );
}

function rowsFor(analysis: ExpenseAnalysis): Array<{ label: string; value: string }> {
  const rows = [{ label: "Classification", value: analysis.classification }];

  if (analysis.gifiStatus === "accepted" && analysis.gifiCode) {
    rows.push({
      label: "GIFI",
      value: `${analysis.gifiCode} — ${analysis.gifiDescription ?? ""}`,
    });
  } else {
    rows.push({ label: "GIFI", value: "Review required" });
  }

  rows.push({ label: "GST/HST", value: formatCad(analysis.grossTax) });

  if (analysis.status !== "review") {
    rows.push(
      { label: "Eligible ITC", value: formatCad(analysis.eligibleITC) },
      { label: "ITC percentage", value: formatPercent(analysis.eligibilityPercentage) },
    );
  }

  return rows;
}

function statusClass(status: ExpenseAnalysis["status"]): string {
  const base = "border px-2 py-0.5 text-xs";
  if (status === "review" || status === "partial") {
    return `${base} border-amber-800 text-amber-200`;
  }
  if (status === "ineligible") {
    return `${base} border-zinc-700 text-zinc-300`;
  }
  return `${base} border-emerald-900 text-emerald-200`;
}
