import type { DBView } from "./store";
import type { Ingredient, MenuItem, WasteLog } from "./types";
import { addDays, daysBetween, parseDate, todayISO, toISODate } from "./format";
import { ingredientAmountCost } from "./menu-costing";

/* ---------- Ingredients ---------- */
export function lotsOf(db: DBView, ingredientId: string) {
  return db.purchases.filter((p) => p.ingredientId === ingredientId);
}
export function stockOf(db: DBView, ingredientId: string) {
  return lotsOf(db, ingredientId).reduce((a, p) => a + p.remaining, 0);
}
export function stockValueOf(db: DBView, ingredientId: string) {
  return lotsOf(db, ingredientId).reduce((a, p) => a + p.remaining * p.unitCost, 0);
}
/** Soonest-expiring lot that still has stock. */
export function nextLot(db: DBView, ingredientId: string) {
  return lotsOf(db, ingredientId)
    .filter((p) => p.remaining > 0)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))[0];
}
export function lastPurchase(db: DBView, ingredientId: string) {
  return lotsOf(db, ingredientId).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate))[0];
}
export function lastUsed(db: DBView, ingredientId: string): string | undefined {
  return db.usages.filter((u) => u.ingredientId === ingredientId).map((u) => u.date).sort().pop();
}
/** Average Repurchasing Time: mean days between consecutive purchases. */
export function avgRepurchaseDays(db: DBView, ingredientId: string): number | null {
  const dates = lotsOf(db, ingredientId).map((p) => p.purchaseDate).sort();
  if (dates.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < dates.length; i++) sum += daysBetween(dates[i - 1], dates[i]);
  return Math.round(sum / (dates.length - 1));
}
export function dailyUseRate(db: DBView, ingredientId: string): number {
  const from = addDays(todayISO(), -28);
  const total = db.usages.filter((u) => u.ingredientId === ingredientId && u.date >= from).reduce((a, u) => a + u.quantity, 0);
  return total / 28;
}
/**
 * Recommended next purchase: fires when stock is projected to run out
 * before the next usual order (last purchase + average repurchasing time).
 */
export function purchaseRecommendation(db: DBView, ingredientId: string) {
  const avg = avgRepurchaseDays(db, ingredientId);
  const last = lastPurchase(db, ingredientId);
  if (!avg || !last) return null;
  const nextOrder = addDays(last.purchaseDate, avg);
  const rate = dailyUseRate(db, ingredientId);
  const stock = stockOf(db, ingredientId);
  const daysLeft = rate > 0 ? stock / rate : Infinity;
  const runOut = Number.isFinite(daysLeft) ? addDays(todayISO(), Math.floor(daysLeft)) : null;
  const fire = runOut !== null && runOut < nextOrder;
  return { fire, nextOrder, runOut, daysLeft, recommendedDate: fire ? runOut! : nextOrder };
}
/** % of this ingredient each menu item uses, weighted by average weekly batches. */
export function ingredientUsageShare(db: DBView, ingredientId: string) {
  const rows = db.menuItems
    .map((m) => {
      const line = m.recipe.find((r) => r.ingredientId === ingredientId);
      if (!line) return null;
      const batchesPerWeek = avgWeeklyProduction(db, m.id) / Math.max(1, m.yield);
      return { menuItem: m, amount: line.quantity * batchesPerWeek };
    })
    .filter(Boolean) as { menuItem: MenuItem; amount: number }[];
  const total = rows.reduce((a, r) => a + r.amount, 0) || 1;
  return rows.map((r) => ({ ...r, pct: (r.amount / total) * 100 })).sort((a, b) => b.pct - a.pct);
}

/* ---------- Menu items ---------- */
export function recipeCost(db: DBView, m: Pick<MenuItem, "recipe">) {
  return m.recipe.reduce((total, line) => {
    const cost = ingredientAmountCost(db.ingredients.find((ingredient) => ingredient.id === line.ingredientId), line.quantity, line.unit);
    return total + (Number.isFinite(cost) ? cost : 0);
  }, 0);
}
export function costPerUnit(m: Pick<MenuItem, "type" | "batchCost" | "yield" | "purchaseCost">) {
  if (m.type === "Outsourced") return m.purchaseCost;
  return m.yield > 0 ? m.batchCost / m.yield : 0;
}
export function margin(m: Pick<MenuItem, "type" | "batchCost" | "yield" | "purchaseCost" | "retailPrice">) {
  return m.retailPrice - costPerUnit(m);
}
export function foodCostPct(m: Pick<MenuItem, "type" | "batchCost" | "yield" | "purchaseCost" | "retailPrice">) {
  return m.retailPrice > 0 ? (costPerUnit(m) / m.retailPrice) * 100 : 0;
}

export function weekStart(iso = todayISO()) {
  const d = parseDate(iso);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}
export function producedThisWeek(db: DBView, menuItemId: string) {
  const ws = weekStart();
  return db.batches.filter((b) => b.menuItemId === menuItemId && b.producedAt.slice(0, 10) >= ws).reduce((a, b) => a + b.quantity, 0);
}
/** Average over the last 4 completed weeks. */
function last4Weeks() {
  const ws = weekStart();
  return { from: addDays(ws, -28), to: ws };
}
export function avgWeeklyProduction(db: DBView, menuItemId: string) {
  const { from, to } = last4Weeks();
  return db.batches.filter((b) => b.menuItemId === menuItemId && b.producedAt.slice(0, 10) >= from && b.producedAt.slice(0, 10) < to).reduce((a, b) => a + b.quantity, 0) / 4;
}
/** Average units sold per week over the last 30 days (today included). */
export function avgWeeklySales(db: DBView, menuItemId: string) {
  const t = todayISO(), from = addDays(t, -29);
  return db.sales.filter((s) => s.menuItemId === menuItemId && s.date >= from && s.date <= t).reduce((a, s) => a + s.quantity, 0) / (30 / 7);
}
/** Popularity: all-time total units sold (future-dated sales excluded). */
export function totalUnitsSold(db: DBView, menuItemId: string) {
  const t = todayISO();
  return db.sales.filter((s) => s.menuItemId === menuItemId && s.date <= t).reduce((a, s) => a + s.quantity, 0);
}
/** Revenue of a sale; old entries without a price use the item's current retail price. */
export function saleRevenue(db: DBView, s: { menuItemId: string; quantity: number; unitPrice?: number }) {
  return s.quantity * saleUnitPrice(db, s);
}
export function saleUnitPrice(db: DBView, s: { menuItemId: string; unitPrice?: number }) {
  return s.unitPrice ?? db.menuItems.find((m) => m.id === s.menuItemId)?.retailPrice ?? 0;
}
export function totalSales(db: DBView, from: string, to: string) {
  return db.sales.filter((s) => s.date >= from && s.date <= to).reduce((a, s) => a + saleRevenue(db, s), 0);
}

export function directWaste(db: DBView, menuItemId: string) {
  return db.wasteLogs.filter((w) => w.stage === "Finished Product" && w.menuItemId === menuItemId).sort(byNewest);
}
export function attributedWaste(db: DBView, menuItemId: string) {
  return db.wasteLogs
    .filter((w) => (w.stage === "WIP" && (w.menuItemId === menuItemId || w.attributedMenuItemId === menuItemId)) || (w.stage === "Ingredient" && w.attributedMenuItemId === menuItemId))
    .sort(byNewest);
}
export function ingredientWaste(db: DBView, ingredientId: string) {
  return db.wasteLogs.filter((w) => w.stage === "Ingredient" && w.ingredientId === ingredientId).sort(byNewest);
}
export const byNewest = (a: WasteLog, b: WasteLog) => b.at.localeCompare(a.at);
export const sumValue = (ws: WasteLog[]) => ws.reduce((a, w) => a + w.value, 0);

export type Quadrant = "Stars" | "Plowhorses" | "Puzzles" | "Dogs";
export const QUADRANTS: Quadrant[] = ["Stars", "Plowhorses", "Puzzles", "Dogs"];

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function menuMap(db: DBView, includeAttributed: boolean) {
  const baseRows = db.menuItems.map((m) => {
    const popularity = totalUnitsSold(db, m.id);
    const profit = margin(m);
    const waste = sumValue(directWaste(db, m.id)) + (includeAttributed ? sumValue(attributedWaste(db, m.id)) : 0);
    const marginPct = m.retailPrice > 0 ? (profit / m.retailPrice) * 100 : 0;
    return { item: m, popularity, profit, marginPct, waste };
  });
  const plottedBaseRows = baseRows.filter((r) => r.popularity > 0);
  const medianPop = median(plottedBaseRows.map((r) => r.popularity));
  const medianProfit = median(plottedBaseRows.map((r) => r.profit));
  const maxWaste = Math.max(1, ...baseRows.map((r) => r.waste));
  const classify = (r: (typeof baseRows)[number]) =>
    (r.popularity >= medianPop
      ? r.profit >= medianProfit ? "Stars" : "Plowhorses"
      : r.profit >= medianProfit ? "Puzzles" : "Dogs") as Quadrant;
  const rows = baseRows.map((r) => ({ ...r, intensity: r.waste / maxWaste, quadrant: classify(r) }));
  return {
    medianPop,
    medianProfit,
    maxWaste,
    rows,
    plottedRows: rows.filter((r) => r.popularity > 0),
  };
}
/** Red (high waste) → green (low waste). */
export function wasteColor(intensity: number) {
  const hue = 145 - 120 * Math.min(1, Math.max(0, intensity));
  return `oklch(0.62 0.17 ${hue})`;
}

/* ---------- Dashboard ---------- */
export function totalWaste(db: DBView, from: string, to: string) {
  const ws = db.wasteLogs.filter((w) => w.at.slice(0, 10) >= from && w.at.slice(0, 10) <= to);
  const byStage = { Ingredient: 0, WIP: 0, "Finished Product": 0 } as Record<string, number>;
  ws.forEach((w) => (byStage[w.stage] += w.value));
  return { total: sumValue(ws), byStage, logs: ws };
}
export function expiringWithin(db: DBView, days: number) {
  const limit = addDays(todayISO(), days);
  return db.ingredients
    .map((i) => ({ ingredient: i, lot: nextLot(db, i.id) }))
    .filter((x): x is { ingredient: Ingredient; lot: NonNullable<typeof x.lot> } => !!x.lot && x.lot.expiryDate <= limit)
    .sort((a, b) => a.lot.expiryDate.localeCompare(b.lot.expiryDate));
}

export interface WeekBucket { key: string; label: string; start: string; end: string; revenue: number; current: boolean }
/** Last 8 Monday–Sunday weeks, newest first. This Week runs Monday→today; future-dated sales are ignored. */
export function weeklyRevenue(sales: { date: string }[], revenueOf: (s: any) => number, today = todayISO()): WeekBucket[] {
  const ws = weekStart(today);
  const labels = ["This Week", "Last Week", "2w", "3w", "4w", "5w", "6w", "7w"];
  return labels.map((label, i) => {
    const start = addDays(ws, -7 * i);
    const end = i === 0 ? today : addDays(start, 6);
    const revenue = sales.filter((s) => s.date >= start && s.date <= end).reduce((a, s) => a + revenueOf(s), 0);
    return { key: start, label, start, end, revenue, current: i === 0 };
  });
}

export const WEEK_OPTIONS = ["This Week", "Last Week", "2 Weeks Ago", "3 Weeks Ago", "4 Weeks Ago", "5 Weeks Ago", "6 Weeks Ago", "7 Weeks Ago"];
export const weekName = (offset: number) => WEEK_OPTIONS[offset] ?? `${offset} Weeks Ago`;

/** Selected week window and its comparison window. This Week is day-aligned (Mon→today vs same weekdays last week). */
export function weekWindows(offset: number, today = todayISO()) {
  const ws = weekStart(today);
  const start = addDays(ws, -7 * offset);
  const cur = { from: start, to: offset === 0 ? today : addDays(start, 6) };
  const prev = { from: addDays(cur.from, -7), to: addDays(cur.to, -7) };
  return { cur, prev };
}

export function compareWeeks(total: (from: string, to: string) => number, offset: number, today = todayISO()) {
  const { cur, prev } = weekWindows(offset, today);
  const c = total(cur.from, cur.to), p = total(prev.from, prev.to);
  return { cur: c, prev: p, pct: p > 0 ? ((c - p) / p) * 100 : null, window: cur };
}

export interface TrendPoint { key: string; label: string; start: string; end: string; revenue: number; rolling: number | null; current: boolean }
/**
 * Progressive weekly revenue line: starts at the first week with (non-future) sales,
 * grows one point per week, capped at the latest 6 weeks, oldest → newest.
 * `rolling` = flat average weekly revenue of all completed weeks before the current week (null if none).
 */
export function salesTrend(sales: { date: string }[], revenueOf: (s: any) => number, today = todayISO()): TrendPoint[] {
  const past = sales.filter((s) => s.date <= today);
  if (!past.length) return [];
  const first = weekStart(past.map((s) => s.date).sort()[0]);
  const ws = weekStart(today);
  const span = Math.round(daysBetween(first, ws) / 7) + 1;
  const count = Math.min(6, span);
  const revOf = (start: string, end: string) => past.filter((s) => s.date >= start && s.date <= end).reduce((a, s) => a + revenueOf(s), 0);
  const all: { start: string; end: string; revenue: number }[] = [];
  for (let i = Math.min(span, count + 3) - 1; i >= 0; i--) {
    const start = addDays(ws, -7 * i);
    const end = i === 0 ? today : addDays(start, 6);
    all.push({ start, end, revenue: start < first ? 0 : revOf(start, end) });
  }
  const completed: number[] = [];
  for (let i = span - 1; i >= 1; i--) { const st = addDays(ws, -7 * i); completed.push(revOf(st, addDays(st, 6))); }
  const flat = completed.length ? completed.reduce((a, x) => a + x, 0) / completed.length : null;
  const pts = all.map((w) => ({ ...w, rolling: flat }));
  return pts.slice(-count).map((p, i, arr) => {
    const back = arr.length - 1 - i;
    return { ...p, key: p.start, current: back === 0, label: back === 0 ? "This Week" : back === 1 ? "Last Week" : `${back}w ago` };
  });
}
