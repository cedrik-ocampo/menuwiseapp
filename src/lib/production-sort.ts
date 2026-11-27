export type ProductionSortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "qty-desc" | "qty-asc" | "exp-asc" | "exp-desc";
export type ExpiryFilter = "all" | "fresh" | "today" | "expired";

export const PRODUCTION_SORT_OPTIONS: { key: ProductionSortKey; label: string }[] = [
  { key: "date-desc", label: "Newest first" },
  { key: "date-asc", label: "Oldest first" },
  { key: "name-asc", label: "Item A to Z" },
  { key: "name-desc", label: "Item Z to A" },
  { key: "qty-desc", label: "Quantity: high to low" },
  { key: "qty-asc", label: "Quantity: low to high" },
  { key: "exp-asc", label: "Expiry: soonest first" },
  { key: "exp-desc", label: "Expiry: latest first" },
];

export const EXPIRY_FILTER_OPTIONS: { key: ExpiryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fresh", label: "Not expired" },
  { key: "today", label: "Expiring today" },
  { key: "expired", label: "Expired" },
];

export interface SortableBatch { producedAt: string; expiryDate: string; quantity: number; menuItemId: string }

const day = (d: string) => (d ?? "").slice(0, 10);

/** Sorts production entries; ties fall back to newest first. Entries without expiry sort last for expiry orders. */
export function sortBatches<T extends SortableBatch>(rows: T[], key: ProductionSortKey, nameOf: (b: T) => string): T[] {
  const newest = (a: T, b: T) => b.producedAt.localeCompare(a.producedAt);
  const exp = (a: T, b: T, dir: 1 | -1) => {
    const x = day(a.expiryDate), y = day(b.expiryDate);
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return x.localeCompare(y) * dir;
  };
  const cmp: Record<ProductionSortKey, (a: T, b: T) => number> = {
    "date-desc": () => 0,
    "date-asc": (a, b) => a.producedAt.localeCompare(b.producedAt),
    "name-asc": (a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" }),
    "name-desc": (a, b) => nameOf(b).localeCompare(nameOf(a), undefined, { sensitivity: "base" }),
    "qty-desc": (a, b) => b.quantity - a.quantity,
    "qty-asc": (a, b) => a.quantity - b.quantity,
    "exp-asc": (a, b) => exp(a, b, 1),
    "exp-desc": (a, b) => exp(a, b, -1),
  };
  return [...rows].sort((a, b) => cmp[key](a, b) || newest(a, b));
}

/** Filters by menu item ("all" keeps every item) and expiry status relative to `today` (YYYY-MM-DD). */
export function filterBatches<T extends SortableBatch>(rows: T[], itemId: string, expiry: ExpiryFilter, today: string): T[] {
  return rows.filter((b) => {
    if (itemId !== "all" && b.menuItemId !== itemId) return false;
    const e = day(b.expiryDate);
    if (expiry === "fresh") return !e || e > today;
    if (expiry === "today") return e === today;
    if (expiry === "expired") return !!e && e < today;
    return true;
  });
}
