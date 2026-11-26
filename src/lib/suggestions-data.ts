/** Turns the local café store into plain inputs for the suggestion engines. */
import type { DBView } from "./store";
import type { CafeSettings, Ingredient, MenuItem } from "./types";
import { costPerUnit, recipeCost, saleUnitPrice } from "./calc";
import { calendarDaysBetween, resolveCalendar, shiftDate, type OperatingCalendar } from "./operating-calendar";
import { AVOIDABLE_WASTE, DEFAULT_SETTINGS, median, suggestBatch, suggestReorder, toStockUnit, type Lot, type ReorderInput, type SuggestionSettings } from "./reorder";
import { classifyMenu, type MEItem } from "./menuEngineering";

export const SETTINGS_ID = "settings";

export function cafeSettingsOf(db: DBView): CafeSettings | undefined {
  return db.cafeSettings.find((s) => s.id === SETTINGS_ID);
}
export function suggestionSettings(db: DBView): SuggestionSettings {
  const s = cafeSettingsOf(db);
  return s ? { wasteCapPct: s.wasteCapPct, borderlinePct: s.borderlinePct, eligibilityDays: s.eligibilityDays, categoryMin: s.categoryMin, safetyBufferDays: s.safetyBufferDays, historyWeeks: s.historyWeeks } : DEFAULT_SETTINGS;
}

export function activityDates(db: DBView): string[] {
  return [...db.sales.map((s) => s.date), ...db.batches.map((b) => b.producedAt.slice(0, 10)), ...db.wasteLogs.map((w) => w.at.slice(0, 10)), ...db.usages.map((u) => u.date), ...db.dailyChecks.map((c) => c.date)];
}
export function calendarOf(db: DBView, today: string): OperatingCalendar {
  const s = cafeSettingsOf(db);
  return resolveCalendar(s ? { weekdays: s.weekdays, closures: s.closures, confirmed: s.calendarConfirmed } : undefined, activityDates(db), today);
}

function shelfLifeOf(db: DBView, ing: Ingredient): number | null {
  if (ing.defaultShelfLifeDays && ing.defaultShelfLifeDays > 0) return ing.defaultShelfLifeDays;
  const spans = db.purchases.filter((p) => p.ingredientId === ing.id && p.expiryDate && !p.ordered).map((p) => calendarDaysBetween(p.purchaseDate, p.expiryDate)).filter((d) => d > 0);
  if (spans.length) return Math.round(median(spans));
  return null;
}

export function reorderInputFor(db: DBView, ing: Ingredient, today: string, settings = suggestionSettings(db), calendar = calendarOf(db, today)): ReorderInput {
  const shelf = shelfLifeOf(db, ing);
  const purchases = db.purchases.filter((p) => p.ingredientId === ing.id);
  const lots: Lot[] = purchases.filter((p) => !p.ordered && p.remaining > 0).map((p) => ({
    id: p.id, qty: p.remaining, received: p.purchaseDate,
    expiry: p.expiryDate || (shelf === null ? null : shiftDate(p.purchaseDate, shelf)),
    estimated: !p.expiryDate && shelf !== null,
  }));
  const onOrder = purchases.filter((p) => p.ordered).map((p) => ({ qty: p.quantity, ...(p.expectedDate ? { arrival: p.expectedDate } : {}) }));
  const usage = db.usages.filter((u) => u.ingredientId === ing.id).map((u) => ({ date: u.date, qty: u.quantity }));
  const waste = db.wasteLogs.filter((w) => w.ingredientId === ing.id && w.stage === "Ingredient").map((w) => ({ date: w.at.slice(0, 10), qty: toStockUnit(w.quantity, w.unit, ing.unit), avoidable: AVOIDABLE_WASTE.has(w.wasteType) })).filter((w) => Number.isFinite(w.qty));
  const firstSeen = [...usage.map((u) => u.date), ...purchases.map((p) => p.purchaseDate)].sort()[0];
  return {
    today, calendar, lots, onOrder, usage, waste,
    leadTimeDays: ing.leadTimeDays ?? 2,
    ...(ing.deliveryDays ? { deliveryWeekdays: ing.deliveryDays } : {}),
    ...(ing.packSize ? { packSize: ing.packSize } : {}),
    ...(ing.supplierMinimum ? { supplierMinimum: ing.supplierMinimum } : {}),
    shelfLifeDays: shelf,
    dataDays: firstSeen ? Math.max(0, calendarDaysBetween(firstSeen, today)) : 0,
    settings,
  };
}

export function reorderList(db: DBView, today: string) {
  const settings = suggestionSettings(db), calendar = calendarOf(db, today);
  const rank = { "Order now": 0, "Order by": 1, OK: 2, "No recent use": 3 } as const;
  return db.ingredients.map((ing) => {
    const input = reorderInputFor(db, ing, today, settings, calendar);
    return { ingredient: ing, input, result: suggestReorder(input) };
  }).sort((a, b) => rank[a.result.status] - rank[b.result.status] || (a.result.orderBy ?? "9").localeCompare(b.result.orderBy ?? "9"));
}

function soldOutDates(db: DBView, itemId: string) {
  return [...new Set(db.dailyChecks.filter((c) => c.soldOut?.includes(itemId)).map((c) => c.date))];
}
export function unitCostOf(db: DBView, m: MenuItem) {
  return m.type === "Outsourced" ? costPerUnit(m) : m.recipe?.length ? recipeCost(db, m) / (m.type === "In-house" ? m.yield || 1 : 1) : costPerUnit(m);
}

/** Sellable pieces still on hand for the target day. */
export function carryoverOf(db: DBView, m: MenuItem, targetDate: string, today: string) {
  const live = db.batches.filter((b) => b.menuItemId === m.id && b.producedAt.slice(0, 10) <= today && (!b.expiryDate || b.expiryDate >= targetDate));
  if (!live.length) return 0;
  const since = live.map((b) => b.producedAt.slice(0, 10)).sort()[0]!;
  const made = live.reduce((a, b) => a + b.quantity, 0);
  const sold = db.sales.filter((s) => s.menuItemId === m.id && s.date >= since && s.date <= today).reduce((a, s) => a + s.quantity, 0);
  const wasted = db.wasteLogs.filter((w) => w.menuItemId === m.id && w.at.slice(0, 10) >= since).reduce((a, w) => a + w.quantity, 0);
  return Math.max(0, made - sold - wasted);
}

export function batchList(db: DBView, today: string) {
  const calendar = calendarOf(db, today);
  let target = shiftDate(today, 1);
  for (let i = 0; i < 14 && !(calendar.weekdays.includes(new Date(`${target}T00:00:00Z`).getUTCDay()) && !calendar.closures.some((c) => c.date === target)); i++) target = shiftDate(target, 1);
  return {
    targetDate: target,
    rows: db.menuItems.filter((m) => m.type !== "Made-to-order" && m.available !== false).map((m) => {
      const sales = db.sales.filter((s) => s.menuItemId === m.id && s.date < today).map((s) => ({ date: s.date, qty: s.quantity }));
      const waste = db.wasteLogs.filter((w) => w.menuItemId === m.id).map((w) => ({ date: w.at.slice(0, 10), qty: w.quantity }));
      const first = sales.map((s) => s.date).sort()[0];
      const unitCost = unitCostOf(db, m);
      const result = suggestBatch({ targetDate: target, calendar, sales, waste, soldOutDates: soldOutDates(db, m.id), carryover: carryoverOf(db, m, target, today), margin: m.retailPrice - unitCost, unitCost, dataDays: first ? calendarDaysBetween(first, today) : 0 });
      return { item: m, result };
    }).filter((r) => r.result.median > 0 || r.result.batch > 0).sort((a, b) => b.result.batch - a.result.batch),
  };
}

export function menuSuggestions(db: DBView, today: string) {
  const settings = suggestionSettings(db), calendar = calendarOf(db, today);
  const from = shiftDate(today, -7 * Math.max(settings.historyWeeks, 4));
  const perishableIds = new Set(db.ingredients.filter((i) => !i.category.toLowerCase().includes("packag")).map((i) => i.id));
  const items: MEItem[] = db.menuItems.map((m) => {
    const sales = db.sales.filter((s) => s.menuItemId === m.id && s.date <= today);
    const firstSale = sales.map((s) => s.date).sort()[0];
    const listedFrom = [firstSale, (m as { createdAt?: string }).createdAt?.slice(0, 10)].filter((d): d is string => !!d).sort()[0];
    const windowStart = listedFrom && listedFrom > from ? listedFrom : from;
    const openDays = (() => { let n = 0; for (let d = windowStart; d < today; d = shiftDate(d, 1)) if (calendar.weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && !calendar.closures.some((c) => c.date === d)) n++; return n; })();
    const inWindow = sales.filter((s) => s.date >= from && s.date < today);
    const units = inWindow.reduce((a, s) => a + s.quantity, 0);
    const price = inWindow.length ? inWindow.reduce((a, s) => a + saleUnitPrice(db, s) * s.quantity, 0) / Math.max(1, units) : m.retailPrice;
    const wasteCost = db.wasteLogs.filter((w) => (w.menuItemId === m.id || w.attributedMenuItemId === m.id) && w.at.slice(0, 10) >= from && w.at.slice(0, 10) < today).reduce((a, w) => a + w.value, 0);
    return {
      id: m.id, name: m.name, category: m.category || "Uncategorized", price: price || m.retailPrice, unitCost: unitCostOf(db, m) || 0, wasteCost, unitsSold: units,
      openDaysAvailable: openDays, soldOutDays: soldOutDates(db, m.id).filter((d) => d >= windowStart && d < today).length,
      daysListed: listedFrom ? calendarDaysBetween(listedFrom, today) : 0,
      perishables: (m.recipe ?? []).map((r) => r.ingredientId).filter((id) => perishableIds.has(id)),
    };
  });
  const perishables = db.ingredients.filter((i) => perishableIds.has(i.id)).map((i) => {
    const bought = db.purchases.filter((p) => p.ingredientId === i.id && !p.ordered && p.purchaseDate >= from).reduce((a, p) => a + p.quantity, 0);
    const expired = db.wasteLogs.filter((w) => w.ingredientId === i.id && AVOIDABLE_WASTE.has(w.wasteType) && w.at.slice(0, 10) >= from).reduce((a, w) => a + (toStockUnit(w.quantity, w.unit, i.unit) || 0), 0);
    return { id: i.id, name: i.name, expiryRatePct: bought > 0 ? (expired / bought) * 100 : 0 };
  });
  return classifyMenu(items, settings, perishables, calendar.confirmed);
}
