import type { Batch } from "@/lib/types";

type AuditedBatch = Batch & { createdByName?: string };

/** Batches of the same menu item already logged on the same production date. */
export function sameDayBatches(batches: Batch[], menuItemId: string, date: string): AuditedBatch[] {
  if (!menuItemId || !date) return [];
  return (batches as AuditedBatch[])
    .filter((b) => b.menuItemId === menuItemId && b.producedAt.slice(0, 10) === date)
    .sort((a, b) => a.producedAt.localeCompare(b.producedAt));
}

/** Earlier same-day batches whose quantity matches exactly (likely duplicates). */
export function matchingQuantity(earlier: Batch[], quantity: number): Batch[] {
  if (!Number.isFinite(quantity)) return [];
  return earlier.filter((b) => b.quantity === quantity);
}

/** Next free batch letter suffix: PREFIX-A, PREFIX-B, ... skipping used IDs and IDs in `reserved`. */
export function nextBatchId(prefix: string, used: Set<string>, reserved: string[] = []): string {
  const taken = new Set([...used, ...reserved]);
  for (let i = 0; i < 26; i++) {
    const id = `${prefix}-${String.fromCharCode(65 + i)}`;
    if (!taken.has(id)) return id;
  }
  let n = 27;
  while (taken.has(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
