const CENTS = 100;

export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error("Amount must be a finite number");
  }
  return Math.round(amount * CENTS);
}

export function fromCents(cents: number): number {
  return cents / CENTS;
}

/** Apply a 0–1 rate to a cent amount and round to the nearest cent. */
export function applyRateToCents(cents: number, rate: number): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error("Rate must be between 0 and 1");
  }
  return Math.round(cents * rate);
}
