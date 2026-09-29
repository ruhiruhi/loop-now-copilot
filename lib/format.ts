import { toCents } from "@/domain/money";

export function formatCad(amount: number): string {
  const negative = amount < 0;
  const cents = Math.abs(toCents(amount));
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return `${negative ? "-" : ""}$${dollars.toLocaleString("en-CA")}.${remainder.toString().padStart(2, "0")}`;
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

export function statusLabel(status: "eligible" | "partial" | "ineligible" | "review"): string {
  switch (status) {
    case "eligible":
      return "Eligible";
    case "partial":
      return "Partial";
    case "ineligible":
      return "Ineligible";
    case "review":
      return "Review Required";
  }
}
