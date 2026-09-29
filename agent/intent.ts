export function wantsProcessing(message: string): boolean {
  return /\b(process|claim|itc|gst|hst|classif\w*|gifi|receipt|this one)\b/i.test(message);
}

export function resolveTargetReceiptId(message: string, selectedReceiptId: string | null): string | null {
  const mentioned = message.match(/\breceipt_\d{3}\b/i)?.[0]?.toLowerCase() ?? null;
  const refersToSelection = /\bthis\b/i.test(message);
  if (refersToSelection || !mentioned) {
    return selectedReceiptId;
  }
  return mentioned;
}

export function userRequestedOverride(message: string): boolean {
  return /\b(ignore|approve)\b|100\s*%/i.test(message);
}
