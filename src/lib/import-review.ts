import type { Row } from './import';
import type { Sale } from './types';

export type ImportDecision = 'add' | 'skip' | 'merge';
export interface ReviewEntry<T> { line: number; item?: T; error?: string; duplicate?: boolean }
export function resolveImport<T>(entries: ReviewEntry<T>[], decisions: Record<number, ImportDecision>) {
  const add: T[] = [], merge: T[] = [], skipped: ReviewEntry<T>[] = [];
  for (const entry of entries) {
    const decision = decisions[entry.line] ?? (entry.duplicate ? 'skip' : 'add');
    if (!entry.item || decision === 'skip') skipped.push(entry);
    else if (decision === 'merge') merge.push(entry.item);
    else add.push(entry.item);
  }
  return { add, merge, skipped };
}
export function mergeSales(existing: Sale[], additions: Sale[], merges: Sale[]): Sale[] {
  const result = [...existing, ...additions];
  for (const sale of merges) {
    const index = result.findIndex((s) => s.date === sale.date && s.menuItemId === sale.menuItemId && s.unitPrice === sale.unitPrice);
    const target = result[index];
    if (!target) { result.push(sale); continue; }
    const quantity = target.quantity + sale.quantity;
    result[index] = { ...target, quantity, revenue: (target.revenue ?? target.quantity * (target.unitPrice ?? 0)) + (sale.revenue ?? sale.quantity * (sale.unitPrice ?? 0)), notes: [target.notes, sale.notes].filter(Boolean).join('; ') || undefined };
  }
  return result;
}
export function sourceLine(row: Row, index: number) { return Number(row.__line) || index + 2; }
