import type { DBView } from "./store";
import type { Ingredient, MenuItem, WasteLog } from "./types";
import { addDays, daysBetween, parseDate, todayISO, toISODate } from "./format";

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
  return m.recipe.reduce((a, r) => a + r.quantity * (db.ingredients.find((i) => i.id === r.ingredientId)?.unitCost ?? 0), 0);
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
export function avgWeeklySales(db: DBView, menuItemId: string) {
  const { from, to } = last4Weeks();
  return db.sales.filter((s) => s.menuItemId === menuItemId && s.date >= from && s.date < to).reduce((a, s) => a + s.quantity, 0) / 4;
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

export function menuMap(db: DBView, includeAttributed: boolean) {
  const rows = db.menuItems.map((m) => {
    const popularity = avgWeeklySales(db, m.id);
    const profit = margin(m);
    const waste = sumValue(directWaste(db, m.id)) + (includeAttributed ? sumValue(attributedWaste(db, m.id)) : 0);
    return { item: m, popularity, profit, waste };
  });
  const avgPop = rows.reduce((a, r) => a + r.popularity, 0) / Math.max(1, rows.length);
  const avgProfit = rows.reduce((a, r) => a + r.profit, 0) / Math.max(1, rows.length);
  const maxWaste = Math.max(1, ...rows.map((r) => r.waste));
  return {
    avgPop,
    avgProfit,
    maxWaste,
    rows: rows.map((r) => ({
      ...r,
      intensity: r.waste / maxWaste,
      quadrant: (r.popularity >= avgPop ? (r.profit >= avgProfit ? "Stars" : "Plowhorses") : r.profit >= avgProfit ? "Puzzles" : "Dogs") as Quadrant,
    })),
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
  return { total: sumValue(ws), byStage };
}
export function expiringWithin(db: DBView, days: number) {
  const limit = addDays(todayISO(), days);
  return db.ingredients
    .map((i) => ({ ingredient: i, lot: nextLot(db, i.id) }))
    .filter((x): x is { ingredient: Ingredient; lot: NonNullable<typeof x.lot> } => !!x.lot && x.lot.expiryDate <= limit)
    .sort((a, b) => a.lot.expiryDate.localeCompare(b.lot.expiryDate));
}
