import { weekStart, menuMap, saleRevenue, type Quadrant } from "./calc";
import { addDays } from "./format";
import type { DBView } from "./store";
import type { Ingredient, MenuItem, Sale, Batch, WasteLog, Stage } from "./types";

export interface CafeRecordInput {
  ingredients?: Ingredient[];
  menuItems?: MenuItem[];
  sales?: Sale[];
  batches?: Batch[];
  wasteLogs?: WasteLog[];
}

const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
const trend = (current: number, previous: number) => previous > 0 ? round1((current - previous) / previous * 100) : null;
const sum = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);

/**
 * Computes the only café metrics an admin may receive. Raw prices, costs,
 * revenue, transaction quantities and recipes stay inside the server handler.
 */
/** One-way pseudonym (FNV-1a 64-bit) so admins can reference rows without seeing names. */
export function pseudonym(prefix: string, value: string) {
  let h = 0xcbf29ce484222325n;
  for (const ch of `menuwise:${prefix}:${value}`) h = BigInt.asUintN(64, (h ^ BigInt(ch.codePointAt(0)!)) * 0x100000001b3n);
  return `${prefix}_${h.toString(16).padStart(16, "0").slice(0, 10)}`;
}

export function summarizeCafe(records: CafeRecordInput, today: string) {
  const ingredients = records.ingredients ?? [];
  const menuItems = records.menuItems ?? [];
  const sales = records.sales ?? [];
  const batches = records.batches ?? [];
  const wasteLogs = records.wasteLogs ?? [];
  const db = {
    ready: true, online: true, ingredients, menuItems, sales, batches, wasteLogs,
    purchases: [], usages: [], changeLogs: [], insightResponses: [], pendingCollections: new Set(),
  } as DBView;

  const from = addDays(today, -29);
  const previousFrom = addDays(today, -59);
  const previousTo = addDays(today, -30);
  const currentWaste = wasteLogs.filter((w) => w.at.slice(0, 10) >= from && w.at.slice(0, 10) <= today);
  const previousWaste = wasteLogs.filter((w) => w.at.slice(0, 10) >= previousFrom && w.at.slice(0, 10) <= previousTo);
  const currentSales = sales.filter((s) => s.date >= from && s.date <= today);
  const salesValue = sum(currentSales, (s) => saleRevenue(db, s));
  const wasteValue = sum(currentWaste, (w) => w.value || 0);
  const previousWasteValue = sum(previousWaste, (w) => w.value || 0);

  const startOfWeek = weekStart(today);
  const previousWeekStart = addDays(startOfWeek, -7);
  const previousWeekEnd = addDays(today, -7);
  const unitsThisWeek = sum(sales.filter((s) => s.date >= startOfWeek && s.date <= today), (s) => s.quantity);
  const unitsPreviousWeek = sum(sales.filter((s) => s.date >= previousWeekStart && s.date <= previousWeekEnd), (s) => s.quantity);
  const weeklySales = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(startOfWeek, -7 * (7 - index));
    const end = index === 7 ? today : addDays(start, 6);
    return { weekStart: start, units: round1(sum(sales.filter((s) => s.date >= start && s.date <= end), (s) => s.quantity)) };
  });

  const stageShares = {} as Record<Stage, number>;
  for (const stage of ["Ingredient", "WIP", "Finished Product"] as Stage[]) {
    const value = sum(currentWaste.filter((w) => w.stage === stage), (w) => w.value || 0);
    stageShares[stage] = wasteValue > 0 ? round1(value / wasteValue * 100) : 0;
  }
  const reasonCounts = new Map<string, number>();
  currentWaste.forEach((w) => reasonCounts.set(w.wasteType, (reasonCounts.get(w.wasteType) ?? 0) + 1));

  const loggedDates = new Set([
    ...sales.map((s) => s.date),
    ...batches.map((b) => b.producedAt.slice(0, 10)),
    ...wasteLogs.map((w) => w.at.slice(0, 10)),
  ]);
  const activeDays30 = Array.from({ length: 30 }, (_, i) => addDays(from, i)).filter((date) => loggedDates.has(date)).length;
  const quadrants = { Stars: 0, Plowhorses: 0, Puzzles: 0, Dogs: 0 } as Record<Quadrant, number>;
  menuMap(db, false).plottedRows.forEach((row) => { quadrants[row.quadrant] += 1; });

  return {
    period: { from, to: today },
    sales: {
      unitsThisWeek: round1(unitsThisWeek),
      volumeTrendPct: trend(unitsThisWeek, unitsPreviousWeek),
      weekly: weeklySales,
    },
    waste: {
      ratioPct: salesValue > 0 && currentWaste.length > 0 ? round1(wasteValue / salesValue * 100) : null,
      trendPct: trend(wasteValue, previousWasteValue),
      incidents30: currentWaste.length,
      stageShares,
      reasons: [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    },
    logging: { activeDays30 },
    menuMap: quadrants,
    catalog: {
      menuItems: menuItems.length,
      recipeReady: menuItems.filter((m) => m.type === "Outsourced" || (m.recipe?.length ?? 0) > 0).length,
      ingredients: ingredients.length,
      pricedIngredients: ingredients.filter((i) => i.unitCost > 0).length,
      productionBatches: batches.length,
    },
    menuItems: menuItems.map((m) => ({
      id: pseudonym("item", m.id),
      category: m.category,
      type: m.type,
      recipeStatus: m.type === "Outsourced" ? "Outsourced" : (m.recipe?.length ?? 0) > 0 ? "Recipe linked" : "No recipe",
    })),
    ingredients: ingredients.map((i) => ({
      id: pseudonym("ing", i.id),
      unit: i.unit,
      costStatus: i.unitCost > 0 ? "Priced" : "Missing cost",
    })),
  };
}
