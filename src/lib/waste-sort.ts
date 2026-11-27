export type WasteSortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "value-desc" | "value-asc" | "qty-desc" | "qty-asc";

export const WASTE_SORT_OPTIONS: { key: WasteSortKey; label: string }[] = [
  { key: "date-desc", label: "Newest first" },
  { key: "date-asc", label: "Oldest first" },
  { key: "name-asc", label: "Item A to Z" },
  { key: "name-desc", label: "Item Z to A" },
  { key: "value-desc", label: "Value: high to low" },
  { key: "value-asc", label: "Value: low to high" },
  { key: "qty-desc", label: "Quantity: high to low" },
  { key: "qty-asc", label: "Quantity: low to high" },
];

export interface SortableWaste { at: string; quantity: number; value: number }

/** Sorts waste logs; ties fall back to newest first. */
export function sortWaste<T extends SortableWaste>(rows: T[], key: WasteSortKey, nameOf: (w: T) => string): T[] {
  const newest = (a: T, b: T) => b.at.localeCompare(a.at);
  const cmp: Record<WasteSortKey, (a: T, b: T) => number> = {
    "date-desc": () => 0,
    "date-asc": (a, b) => a.at.localeCompare(b.at),
    "name-asc": (a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" }),
    "name-desc": (a, b) => nameOf(b).localeCompare(nameOf(a), undefined, { sensitivity: "base" }),
    "value-desc": (a, b) => b.value - a.value,
    "value-asc": (a, b) => a.value - b.value,
    "qty-desc": (a, b) => b.quantity - a.quantity,
    "qty-asc": (a, b) => a.quantity - b.quantity,
  };
  return [...rows].sort((a, b) => cmp[key](a, b) || newest(a, b));
}
