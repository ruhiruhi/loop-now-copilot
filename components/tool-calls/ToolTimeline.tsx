import type { TimelineStep } from "@/lib/types";

const toneText: Record<TimelineStep["tone"], string> = {
  running: "In progress",
  complete: "Complete",
  warning: "Warning",
  error: "Error",
};

const toneMark: Record<TimelineStep["tone"], string> = {
  running: "●",
  complete: "✓",
  warning: "⚠",
  error: "!",
};

export function ToolTimeline({ steps }: { steps: TimelineStep[] }) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <ol aria-label="Agent activity" className="space-y-1.5">
      {steps.map((step) => (
        <li key={step.id} className="flex items-start gap-2 text-sm text-zinc-300">
          <span aria-hidden="true" className={markClass(step.tone)}>
            {toneMark[step.tone]}
          </span>
          <span className="sr-only">{toneText[step.tone]}: </span>
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function markClass(tone: TimelineStep["tone"]): string {
  if (tone === "warning") {
    return "mt-0.5 w-3 shrink-0 text-amber-300";
  }
  if (tone === "error") {
    return "mt-0.5 w-3 shrink-0 text-red-300";
  }
  if (tone === "running") {
    return "mt-0.5 w-3 shrink-0 text-zinc-100";
  }
  return "mt-0.5 w-3 shrink-0 text-emerald-300";
}
