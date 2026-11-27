export type SalesSortKey = "date-desc" | "date-asc" | "name-asc" | "name-desc" | "rev-desc" | "rev-asc" | "qty-desc" | "qty-asc" | "price-desc";

export const SALES_SORT_OPTIONS: { key: SalesSortKey; label: string }[] = [
  { key: "date-desc", label: "Newest first" },
  { key: "date-asc", label: "Oldest first" },
  { key: "name-asc", label: "Menu item A to Z" },
  { key: "name-desc", label: "Menu item Z to A" },
  { key: "rev-desc", label: "Revenue: high to low" },
  { key: "rev-asc", label: "Revenue: low to high" },
  { key: "qty-desc", label: "Quantity: high to low" },
  { key: "qty-asc", label: "Quantity: low to high" },
  { key: "price-desc", label: "Unit price: high to low" },
];

export interface SortableSale { date: string; createdAt?: string; quantity: number; name: string; unitPrice: number; revenue: number }

/** Sorts sales rows; ties fall back to newest date (then newest created) first. */
export function sortSales<T extends SortableSale>(rows: T[], key: SalesSortKey): T[] {
  const newest = (a: T, b: T) => b.date.localeCompare(a.date) || (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
  const cmp: Record<SalesSortKey, (a: T, b: T) => number> = {
    "date-desc": () => 0,
    "date-asc": (a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""),
    "name-asc": (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    "name-desc": (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }),
    "rev-desc": (a, b) => b.revenue - a.revenue,
    "rev-asc": (a, b) => a.revenue - b.revenue,
    "qty-desc": (a, b) => b.quantity - a.quantity,
    "qty-asc": (a, b) => a.quantity - b.quantity,
    "price-desc": (a, b) => b.unitPrice - a.unitPrice,
  };
  return [...rows].sort((a, b) => cmp[key](a, b) || newest(a, b));
}
