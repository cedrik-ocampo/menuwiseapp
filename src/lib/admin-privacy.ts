import { addDays, daysBetween } from "./format";
import { costPerUnit } from "./calc";
import {
  datesBetween, expectedOperatingDates, manilaToday, monthEnd, monthStart, addMonths, mondayOf,
  reportingWeeks, resolvePeriod, type PeriodSelection, type PeriodWindow,
} from "./admin-periods";
import type { Batch, ChangeLog, DailyCheck, Ingredient, MenuItem, Purchase, Sale, Stage, Usage, WasteLog } from "./types";

export interface CafeRecordInput {
  ingredients?: Ingredient[];
  menuItems?: MenuItem[];
  sales?: Sale[];
  batches?: Batch[];
  wasteLogs?: WasteLog[];
  purchases?: Purchase[];
  usages?: Usage[];
  dailyChecks?: DailyCheck[];
  changeLogs?: ChangeLog[];
  recordMeta?: { id: string; collection: string; updated_at: string }[];
}
export interface CafeConfiguration {
  operatingDays: number[];
  researchConsent: boolean;
}
export type ComparisonStatus = "Improved" | "Increased" | "Decreased" | "No Significant Change" | "Insufficient Data";
export interface MetricComparison {
  current: number | null;
  previous: number | null;
  difference: number | null;
  changePct: number | null;
  changeUnit: "percentage-points" | "percent" | "units" | "days" | "records";
  status: ComparisonStatus;
}
export interface UnitMetric {
  key: string;
  label: string;
  comparison: MetricComparison;
  recordCount: number;
  suppressed: boolean;
  note: string | null;
}
export interface ShareMetric { key: string; label: string; sharePct: number; records: number }
export interface TrendPoint {
  key: string;
  label: string;
  current: number | null;
  previous: number | null;
  currentFrom: string;
  currentTo: string;
  previousFrom: string;
  previousTo: string;
  partial: boolean;
}
export interface ResearchFinding {
  metric: string;
  statement: string;
  period: string;
  comparisonPeriod: string;
  difference: string;
  completeness: string;
  limitation: string;
}

const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;
const sum = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + value(row), 0);
const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
const eventDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso.slice(0, 10) : manilaToday(date);
};
const saleDate = (sale: Sale) => sale.date.slice(0, 10);
const batchDate = (batch: Batch) => eventDate(batch.producedAt);
const wasteDate = (waste: WasteLog) => eventDate(waste.at);
const salePrice = (sale: Sale, items: MenuItem[]) => sale.unitPrice ?? items.find((item) => item.id === sale.menuItemId)?.retailPrice;
const saleValue = (sale: Sale, items: MenuItem[]) => {
  const price = salePrice(sale, items);
  return price !== undefined && Number.isFinite(price) && Number.isFinite(sale.quantity) ? sale.quantity * price : null;
};
const wasteValue = (waste: WasteLog) => Number.isFinite(waste.value) && waste.value >= 0 ? waste.value : null;

/** One-way pseudonym (FNV-1a 64-bit) so admins can reference rows without seeing names. */
export function pseudonym(prefix: string, value: string) {
  let h = 0xcbf29ce484222325n;
  for (const ch of `menuwise:${prefix}:${value}`) h = BigInt.asUintN(64, (h ^ BigInt(ch.codePointAt(0)!)) * 0x100000001b3n);
  return `${prefix}_${h.toString(16).padStart(16, "0").slice(0, 10)}`;
}

function compare(current: number | null, previous: number | null, mode: "percentage" | "number", direction: "lower" | "higher" | "neutral", unit: MetricComparison["changeUnit"] = mode === "percentage" ? "percentage-points" : "units"): MetricComparison {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { current, previous, difference: null, changePct: null, changeUnit: unit, status: "Insufficient Data" };
  }
  const difference = round1(current - previous);
  const changePct = mode === "number" && previous !== 0 ? round1(difference / Math.abs(previous) * 100) : null;
  let status: ComparisonStatus = "No Significant Change";
  if (Math.abs(difference) >= 0.05) {
    if (direction === "neutral") status = difference > 0 ? "Increased" : "Decreased";
    else if (direction === "lower") status = difference < 0 ? "Improved" : "Increased";
    else status = difference > 0 ? "Improved" : "Decreased";
  }
  return { current: round1(current), previous: round1(previous), difference, changePct, changeUnit: unit, status };
}

const UNIT_GROUPS = [
  { key: "mass", label: "Mass", base: "g", units: { g: 1, gram: 1, grams: 1, kg: 1000, kilogram: 1000, kilograms: 1000 } as Record<string, number> },
  { key: "volume", label: "Volume", base: "ml", units: { ml: 1, milliliter: 1, milliliters: 1, l: 1000, liter: 1000, liters: 1000 } as Record<string, number> },
  { key: "count", label: "Pieces", base: "pc", units: { pc: 1, pcs: 1, piece: 1, pieces: 1, unit: 1, units: 1, serving: 1, servings: 1 } as Record<string, number> },
  { key: "pack", label: "Packs", base: "pack", units: { pack: 1, packs: 1 } as Record<string, number> },
  { key: "box", label: "Boxes", base: "box", units: { box: 1, boxes: 1 } as Record<string, number> },
];
function unitGroup(unit: string) {
  const normalized = unit.trim().toLowerCase();
  return UNIT_GROUPS.find((group) => normalized in group.units) ?? { key: `other-${normalized || "missing"}`, label: unit || "Missing unit", base: unit, units: { [normalized]: 1 } as Record<string, number> };
}
function convert(quantity: number, from: string, to: string) {
  if (from === to) return quantity;
  const source = unitGroup(from);
  const target = unitGroup(to);
  if (source.key !== target.key) return null;
  const sourceFactor = source.units[from.trim().toLowerCase()] ?? 1;
  const targetFactor = target.units[to.trim().toLowerCase()] ?? 1;
  return quantity * sourceFactor / targetFactor;
}
function periodLabel(period: PeriodWindow) {
  return `${period.from} to ${period.to}`;
}
function previousLabel(period: PeriodWindow) {
  return `${period.previousFrom} to ${period.previousTo}`;
}

interface FlowResult {
  available: number;
  wasted: number;
  sold: number;
  closing: number;
  records: number;
  valid: boolean;
}
interface FlowGroup {
  key: string;
  label: string;
  baseUnit: string;
  current: FlowResult;
  previous: FlowResult;
  weeklyClosing: (number | null)[];
  stockoutItems: number;
  eligibleItems: number;
  reconciliation: { eligible: number; balanced: number; discrepancies: number };
}
const emptyFlow = (): FlowResult => ({ available: 0, wasted: 0, sold: 0, closing: 0, records: 0, valid: true });

/** Reconstructs unit-compatible flows per ingredient/item; no incompatible units are added. */
function inventoryFlows(records: Required<Pick<CafeRecordInput, "ingredients" | "menuItems" | "sales" | "batches" | "wasteLogs" | "purchases" | "usages">>, period: PeriodWindow, today: string) {
  const groups = new Map<string, FlowGroup>();
  const limitations = new Set<string>();
  const weeks = reportingWeeks(period);
  const getGroup = (stage: "Ingredient" | "Finished Product", unit: string): FlowGroup => {
    const group = unitGroup(unit);
    const key = `${stage === "Ingredient" ? "ingredient" : "finished"}-${group.key}`;
    const label = `${stage} · ${group.label}${group.base ? ` (${group.base})` : ""}`;
    if (!groups.has(key)) groups.set(key, {
      key, label, baseUnit: group.base, current: emptyFlow(), previous: emptyFlow(), weeklyClosing: weeks.map(() => null), stockoutItems: 0, eligibleItems: 0,
      reconciliation: { eligible: 0, balanced: 0, discrepancies: 0 },
    });
    return groups.get(key)!;
  };
  const add = (target: FlowResult, values: Partial<FlowResult>) => {
    target.available += values.available ?? 0;
    target.wasted += values.wasted ?? 0;
    target.sold += values.sold ?? 0;
    target.closing += values.closing ?? 0;
    target.records += values.records ?? 0;
    if (values.valid === false) target.valid = false;
  };

  for (const ingredient of records.ingredients) {
    const lots = records.purchases.filter((purchase) => purchase.ingredientId === ingredient.id);
    const usages = records.usages.filter((usage) => usage.ingredientId === ingredient.id);
    const wastes = records.wasteLogs.filter((waste) => waste.stage === "Ingredient" && waste.ingredientId === ingredient.id);
    const flow = (from: string, to: string): FlowResult => {
      const beforePurchases = lots.filter((purchase) => purchase.purchaseDate < from);
      const received = lots.filter((purchase) => inRange(purchase.purchaseDate, from, to));
      const beforeUsages = usages.filter((usage) => usage.date < from);
      const beforeWaste = wastes.filter((waste) => wasteDate(waste) < from);
      const currentWaste = wastes.filter((waste) => inRange(wasteDate(waste), from, to));
      const wasteBefore = sum(beforeWaste, (waste) => convert(waste.quantity, waste.unit, ingredient.unit) ?? 0);
      const wasteNow = sum(currentWaste, (waste) => convert(waste.quantity, waste.unit, ingredient.unit) ?? 0);
      const incompatible = [...beforeWaste, ...currentWaste].some((waste) => convert(waste.quantity, waste.unit, ingredient.unit) === null);
      const opening = sum(beforePurchases, (purchase) => purchase.quantity) - sum(beforeUsages, (usage) => usage.quantity) - wasteBefore;
      const available = opening + sum(received, (purchase) => purchase.quantity);
      const sold = sum(usages.filter((usage) => inRange(usage.date, from, to)), (usage) => usage.quantity);
      const closing = available - sold - wasteNow;
      const valid = !incompatible && opening >= -0.01 && available > 0;
      if (incompatible) limitations.add("Some waste units are incompatible with their ingredient's saved unit and were excluded from unit-rate calculations.");
      if (opening < -0.01) limitations.add("Some reconstructed opening balances are negative, indicating incomplete historical stock events.");
      return { available, wasted: wasteNow, sold, closing, records: currentWaste.length, valid };
    };
    const current = flow(period.from, period.to);
    const previous = flow(period.previousFrom, period.previousTo);
    const group = getGroup("Ingredient", ingredient.unit);
    if (current.valid) add(group.current, current);
    if (previous.valid) add(group.previous, previous);
    weeks.forEach((week, index) => {
      const result = flow(week.from, week.to);
      if (result.valid) group.weeklyClosing[index] = (group.weeklyClosing[index] ?? 0) + result.closing;
    });
    if (current.valid) {
      group.eligibleItems += 1;
      if (current.closing <= 0.01) group.stockoutItems += 1;
    }
    if (period.to === today) {
      const actualClosing = sum(lots, (purchase) => purchase.remaining);
      group.reconciliation.eligible += 1;
      if (Math.abs(current.closing - actualClosing) <= 0.01) group.reconciliation.balanced += 1;
      else group.reconciliation.discrepancies += 1;
    }
  }

  for (const item of records.menuItems.filter((menuItem) => menuItem.type !== "Made-to-order")) {
    const batches = records.batches.filter((batch) => batch.menuItemId === item.id);
    const sales = records.sales.filter((sale) => sale.menuItemId === item.id);
    const wastes = records.wasteLogs.filter((waste) => waste.stage === "Finished Product" && waste.menuItemId === item.id);
    const flow = (from: string, to: string): FlowResult => {
      const beforeBatches = batches.filter((batch) => batchDate(batch) < from);
      const beforeSales = sales.filter((sale) => saleDate(sale) < from);
      const beforeWaste = wastes.filter((waste) => wasteDate(waste) < from);
      const received = batches.filter((batch) => inRange(batchDate(batch), from, to));
      const currentSales = sales.filter((sale) => inRange(saleDate(sale), from, to));
      const currentWaste = wastes.filter((waste) => inRange(wasteDate(waste), from, to));
      const convertedBeforeWaste = beforeWaste.map((waste) => convert(waste.quantity, waste.unit, item.unit));
      const convertedCurrentWaste = currentWaste.map((waste) => convert(waste.quantity, waste.unit, item.unit));
      const incompatible = [...convertedBeforeWaste, ...convertedCurrentWaste].some((quantity) => quantity === null);
      const opening = sum(beforeBatches, (batch) => batch.quantity) - sum(beforeSales, (sale) => sale.quantity) - sum(convertedBeforeWaste, (quantity) => quantity ?? 0);
      const available = opening + sum(received, (batch) => batch.quantity);
      const sold = sum(currentSales, (sale) => sale.quantity);
      const wasted = sum(convertedCurrentWaste, (quantity) => quantity ?? 0);
      const closing = available - sold - wasted;
      const valid = !incompatible && opening >= -0.01 && available > 0;
      if (incompatible) limitations.add("Some finished-product waste units are incompatible with their menu item's unit and were excluded.");
      if (opening < -0.01) limitations.add("Some menu items have sales or waste exceeding reconstructed stock; historical production may be incomplete.");
      return { available, wasted, sold, closing, records: currentWaste.length, valid };
    };
    const current = flow(period.from, period.to);
    const previous = flow(period.previousFrom, period.previousTo);
    const group = getGroup("Finished Product", item.unit);
    if (current.valid) add(group.current, current);
    if (previous.valid) add(group.previous, previous);
    weeks.forEach((week, index) => {
      const result = flow(week.from, week.to);
      if (result.valid) group.weeklyClosing[index] = (group.weeklyClosing[index] ?? 0) + result.closing;
    });
    if (current.valid) {
      group.eligibleItems += 1;
      if (current.closing <= 0.01) group.stockoutItems += 1;
    }
  }

  return {
    groups: [...groups.values()].map((group) => ({
      ...group,
      reconciliation: period.to === today ? group.reconciliation : { eligible: 0, balanced: 0, discrepancies: 0 },
    })),
    weeks,
    limitations: [...limitations],
  };
}

function ratioForRange(records: Required<Pick<CafeRecordInput, "menuItems" | "sales" | "wasteLogs" | "dailyChecks">>, from: string, to: string) {
  const sales = records.sales.filter((sale) => inRange(saleDate(sale), from, to));
  const wastes = records.wasteLogs.filter((waste) => inRange(wasteDate(waste), from, to));
  const values = sales.map((sale) => saleValue(sale, records.menuItems));
  const wasteValues = wastes.map(wasteValue);
  const revenue = values.every((value) => value !== null) ? sum(values, (value) => value ?? 0) : null;
  const cost = wasteValues.every((value) => value !== null) ? sum(wasteValues, (value) => value ?? 0) : null;
  const noWasteConfirmed = records.dailyChecks.some((check) => check.noWaste && inRange(check.date, from, to));
  const wasteKnown = wastes.length > 0 || noWasteConfirmed;
  return revenue !== null && revenue > 0 && cost !== null && wasteKnown ? cost / revenue * 100 : null;
}

function salesVolumeTrend(records: { sales: Sale[] }, period: PeriodWindow): TrendPoint[] {
  const selectedWeek = mondayOf(period.to);
  return Array.from({ length: 8 }, (_, index) => {
    const start = addDays(selectedWeek, -7 * (7 - index));
    const scheduledEnd = addDays(start, 6);
    const end = start === selectedWeek && period.to < scheduledEnd ? period.to : scheduledEnd;
    const previousFrom = addDays(start, -7);
    const previousTo = addDays(end, -7);
    const units = (from: string, to: string) => {
      const rows = records.sales.filter((sale) => inRange(saleDate(sale), from, to));
      return rows.length ? round1(sum(rows, (sale) => sale.quantity)) : null;
    };
    return { key: start, label: start.slice(5), currentFrom: start, currentTo: end, previousFrom, previousTo, partial: end < scheduledEnd, current: units(start, end), previous: units(previousFrom, previousTo) };
  });
}

function wasteTrend(records: Required<Pick<CafeRecordInput, "menuItems" | "sales" | "wasteLogs" | "dailyChecks">>, period: PeriodWindow) {
  const make = (key: string, label: string, currentFrom: string, currentTo: string, previousFrom: string, previousTo: string, partial = false): TrendPoint => ({
    key, label, currentFrom, currentTo, previousFrom, previousTo, partial,
    current: ratioForRange(records, currentFrom, currentTo) === null ? null : round1(ratioForRange(records, currentFrom, currentTo)!),
    previous: ratioForRange(records, previousFrom, previousTo) === null ? null : round1(ratioForRange(records, previousFrom, previousTo)!),
  });
  const daily = period.days <= 62 ? datesBetween(period.from, period.to).map((date) => make(date, date.slice(5), date, date, addDays(date, -7), addDays(date, -7))) : [];
  const selectedWeek = mondayOf(period.to);
  const weekly = Array.from({ length: 8 }, (_, index) => {
    const start = addDays(selectedWeek, -7 * (7 - index));
    const scheduledEnd = addDays(start, 6);
    const end = start === mondayOf(period.to) && period.to < scheduledEnd ? period.to : scheduledEnd;
    return make(start, start.slice(5), start, end, addDays(start, -7), addDays(end, -7), end < scheduledEnd);
  });
  const selectedMonth = monthStart(period.to);
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const start = addMonths(selectedMonth, index - 5);
    const scheduledEnd = monthEnd(start);
    const end = start === selectedMonth && period.to < scheduledEnd ? period.to : scheduledEnd;
    const previousStart = addMonths(start, -1);
    const previousEnd = addDays(start, -1);
    return make(start, start.slice(0, 7), start, end, previousStart, previousEnd, end < scheduledEnd);
  });
  return { daily, weekly, monthly };
}

function shares(wastes: WasteLog[], keyOf: (waste: WasteLog) => string) {
  const costed = wastes.filter((waste) => wasteValue(waste) !== null);
  const total = sum(costed, (waste) => waste.value);
  const groups = new Map<string, { value: number; records: number }>();
  for (const waste of costed) {
    const key = keyOf(waste);
    const current = groups.get(key) ?? { value: 0, records: 0 };
    current.value += waste.value;
    current.records += 1;
    groups.set(key, current);
  }
  const visible = [...groups.entries()].filter(([, group]) => group.records >= 3);
  return {
    available: costed.length > 0 && total > 0,
    missingCosting: wastes.length - costed.length,
    suppressedGroups: groups.size - visible.length,
    shares: total > 0 ? visible.map(([key, group]) => ({ key, label: key, sharePct: round1(group.value / total * 100), records: group.records })).sort((a, b) => b.sharePct - a.sharePct || a.key.localeCompare(b.key)) : [],
  };
}
function reasonCategory(waste: WasteLog): string {
  if (waste.wasteType === "Expiry") return "Expired / Past Sell-by Date";
  if (waste.wasteType === "Unsold" || waste.wasteType === "Day-old") return "Unsold at Closing";
  if (waste.wasteType === "Spill" || waste.wasteType === "Prep Error") return "Damaged Product";
  if (waste.wasteType === "Spoilage") return "Quality Concern";
  return "Other";
}

function duplicateCount(records: { sales: Sale[]; batches: Batch[]; wasteLogs: WasteLog[]; purchases: Purchase[]; usages: Usage[] }, period: PeriodWindow) {
  const keys: string[] = [];
  for (const sale of records.sales.filter((row) => inRange(saleDate(row), period.from, period.to))) keys.push(`sale|${saleDate(sale)}|${sale.menuItemId}|${sale.quantity}|${sale.unitPrice ?? "current"}`);
  for (const batch of records.batches.filter((row) => inRange(batchDate(row), period.from, period.to))) keys.push(`batch|${batchDate(batch)}|${batch.menuItemId}|${batch.quantity}`);
  for (const waste of records.wasteLogs.filter((row) => inRange(wasteDate(row), period.from, period.to))) keys.push(`waste|${waste.at}|${waste.stage}|${waste.ingredientId ?? waste.menuItemId ?? waste.customName}|${waste.quantity}|${waste.unit}|${waste.wasteType}`);
  for (const purchase of records.purchases.filter((row) => inRange(row.purchaseDate, period.from, period.to))) keys.push(`purchase|${purchase.purchaseDate}|${purchase.ingredientId}|${purchase.quantity}|${purchase.unitCost}`);
  for (const usage of records.usages.filter((row) => inRange(row.date, period.from, period.to))) keys.push(`usage|${usage.date}|${usage.ingredientId}|${usage.menuItemId ?? ""}|${usage.quantity}`);
  const seen = new Set<string>();
  let duplicates = 0;
  for (const key of keys) {
    if (seen.has(key)) duplicates += 1;
    else seen.add(key);
  }
  return { duplicates, total: keys.length };
}

function invalidReferenceCount(records: Required<Pick<CafeRecordInput, "ingredients" | "menuItems" | "sales" | "batches" | "wasteLogs" | "purchases" | "usages">>, period: PeriodWindow) {
  const ingredients = new Set(records.ingredients.map((row) => row.id));
  const items = new Set(records.menuItems.map((row) => row.id));
  const batches = new Set(records.batches.map((row) => row.id));
  let invalid = 0;
  invalid += records.sales.filter((row) => inRange(saleDate(row), period.from, period.to) && !items.has(row.menuItemId)).length;
  invalid += records.batches.filter((row) => inRange(batchDate(row), period.from, period.to) && !items.has(row.menuItemId)).length;
  invalid += records.purchases.filter((row) => inRange(row.purchaseDate, period.from, period.to) && !ingredients.has(row.ingredientId)).length;
  invalid += records.usages.filter((row) => inRange(row.date, period.from, period.to) && (!ingredients.has(row.ingredientId) || (!!row.menuItemId && !items.has(row.menuItemId)))).length;
  invalid += records.wasteLogs.filter((row) => inRange(wasteDate(row), period.from, period.to) && ((!!row.ingredientId && !ingredients.has(row.ingredientId)) || (!!row.menuItemId && !items.has(row.menuItemId)) || (!!row.batchId && !batches.has(row.batchId)))).length;
  invalid += records.menuItems.filter((item) => item.recipe?.some((line) => !ingredients.has(line.ingredientId))).length;
  return invalid;
}

function completeness(records: Required<Pick<CafeRecordInput, "ingredients" | "menuItems" | "sales" | "batches" | "wasteLogs" | "purchases" | "usages" | "dailyChecks">>, period: PeriodWindow) {
  const checks: boolean[] = [];
  for (const sale of records.sales.filter((row) => inRange(saleDate(row), period.from, period.to))) checks.push(!!sale.id && !!sale.menuItemId && !!sale.date && Number.isFinite(sale.quantity) && sale.quantity > 0);
  for (const batch of records.batches.filter((row) => inRange(batchDate(row), period.from, period.to))) checks.push(!!batch.id && !!batch.menuItemId && !!batch.producedAt && Number.isFinite(batch.quantity) && batch.quantity > 0);
  for (const waste of records.wasteLogs.filter((row) => inRange(wasteDate(row), period.from, period.to))) checks.push(!!waste.id && !!waste.at && !!waste.stage && !!waste.wasteType && Number.isFinite(waste.quantity) && waste.quantity > 0 && !!waste.unit && (!!waste.ingredientId || !!waste.menuItemId || !!waste.customName));
  for (const purchase of records.purchases.filter((row) => inRange(row.purchaseDate, period.from, period.to))) checks.push(!!purchase.id && !!purchase.ingredientId && !!purchase.purchaseDate && Number.isFinite(purchase.quantity) && purchase.quantity > 0 && Number.isFinite(purchase.unitCost) && purchase.unitCost >= 0);
  for (const usage of records.usages.filter((row) => inRange(row.date, period.from, period.to))) checks.push(!!usage.id && !!usage.ingredientId && !!usage.date && Number.isFinite(usage.quantity) && usage.quantity > 0);
  for (const check of records.dailyChecks.filter((row) => inRange(row.date, period.from, period.to))) checks.push(!!check.id && !!check.date && (check.noWaste || check.closeout));
  return { complete: checks.filter(Boolean).length, total: checks.length };
}

function coverage(records: Required<Pick<CafeRecordInput, "sales" | "batches" | "wasteLogs" | "purchases" | "usages" | "dailyChecks">>, from: string, to: string, operatingDays: number[]) {
  const expected = expectedOperatingDates(from, to, operatingDays);
  const sales = new Set(records.sales.map(saleDate).filter((date) => inRange(date, from, to)));
  const inventory = new Set([
    ...records.batches.map(batchDate), ...records.purchases.map((row) => row.purchaseDate), ...records.usages.map((row) => row.date),
  ].filter((date) => inRange(date, from, to)));
  const waste = new Set(records.wasteLogs.map(wasteDate).filter((date) => inRange(date, from, to)));
  const closeout = new Set(records.dailyChecks.filter((row) => row.closeout && inRange(row.date, from, to)).map((row) => row.date));
  for (const check of records.dailyChecks) if (check.noWaste && inRange(check.date, from, to)) waste.add(check.date);
  const active = new Set([...sales, ...inventory, ...waste, ...closeout]);
  const count = (set: Set<string>) => expected.filter((date) => set.has(date)).length;
  const completed = expected.filter((date) => sales.has(date) && inventory.has(date) && waste.has(date)).length;
  const result = (days: number): MetricComparison["current"] => expected.length ? round1(days / expected.length * 100) : null;
  return {
    expectedDays: expected.length,
    activeDays: count(active),
    salesDays: count(sales), inventoryDays: count(inventory), wasteDays: count(waste), closeoutDays: count(closeout), completedDays: completed,
    salesPct: result(count(sales)), inventoryPct: result(count(inventory)), wastePct: result(count(waste)), closeoutPct: result(count(closeout)), activePct: result(count(active)), completedPct: result(completed),
  };
}

function menuMapCounts(records: Required<Pick<CafeRecordInput, "menuItems" | "sales">>, period: PeriodWindow) {
  const rows = records.menuItems.map((item) => {
    const popularity = sum(records.sales.filter((sale) => sale.menuItemId === item.id && inRange(saleDate(sale), period.from, period.to)), (sale) => sale.quantity);
    const profit = item.retailPrice - costPerUnit(item);
    const validCost = item.retailPrice > 0 && costPerUnit(item) > 0 && Number.isFinite(profit);
    return { popularity, profit, validCost };
  }).filter((row) => row.popularity > 0);
  const eligible = rows.filter((row) => row.validCost);
  if (eligible.length < 2) return { sufficient: false, reason: "At least two sold items with valid selling prices and unit costs are required.", counts: { Stars: 0, Plowhorses: 0, Puzzles: 0, Dogs: 0 }, excludedItems: rows.length - eligible.length };
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  };
  const medianPopularity = median(eligible.map((row) => row.popularity));
  const medianProfit = median(eligible.map((row) => row.profit));
  const counts = { Stars: 0, Plowhorses: 0, Puzzles: 0, Dogs: 0 };
  for (const row of eligible) {
    const quadrant = row.popularity >= medianPopularity ? row.profit >= medianProfit ? "Stars" : "Plowhorses" : row.profit >= medianProfit ? "Puzzles" : "Dogs";
    counts[quadrant] += 1;
  }
  return { sufficient: true, reason: null, counts, excludedItems: rows.length - eligible.length };
}

function comparisonText(metric: MetricComparison, suffix: string) {
  if (metric.current === null || metric.previous === null || metric.difference === null) return "Insufficient equivalent-period data";
  return `${metric.current.toFixed(1)}${suffix} vs ${metric.previous.toFixed(1)}${suffix}; ${metric.difference > 0 ? "+" : ""}${metric.difference.toFixed(1)} ${metric.changeUnit === "percentage-points" ? "percentage points" : suffix || "units"}`;
}

/**
 * Computes the only café metrics an admin may receive. Raw prices, costs,
 * revenue, recipes, names, and transactions stay inside the server handler.
 */
export function summarizeCafe(input: CafeRecordInput, selection: PeriodSelection, today: string, configuration: CafeConfiguration) {
  const period = resolvePeriod(selection, today);
  const records = {
    ingredients: input.ingredients ?? [], menuItems: input.menuItems ?? [], sales: input.sales ?? [], batches: input.batches ?? [],
    wasteLogs: input.wasteLogs ?? [], purchases: input.purchases ?? [], usages: input.usages ?? [], dailyChecks: input.dailyChecks ?? [], changeLogs: input.changeLogs ?? [],
  };
  const currentWaste = records.wasteLogs.filter((waste) => inRange(wasteDate(waste), period.from, period.to));
  const currentSales = records.sales.filter((sale) => inRange(saleDate(sale), period.from, period.to));
  const previousSales = records.sales.filter((sale) => inRange(saleDate(sale), period.previousFrom, period.previousTo));
  const salesUnits = currentSales.length ? sum(currentSales, (sale) => Number.isFinite(sale.quantity) ? sale.quantity : 0) : null;
  const previousSalesUnits = previousSales.length ? sum(previousSales, (sale) => Number.isFinite(sale.quantity) ? sale.quantity : 0) : null;
  const wasteRatio = compare(ratioForRange(records, period.from, period.to), ratioForRange(records, period.previousFrom, period.previousTo), "percentage", "lower");
  const salesVolume = compare(salesUnits, previousSalesUnits, "number", "neutral", "units");
  const loggingCurrent = coverage(records, period.from, period.to, configuration.operatingDays);
  const loggingPrevious = coverage(records, period.previousFrom, period.previousTo, configuration.operatingDays);
  const flows = inventoryFlows(records, period, today);
  const unitMetrics: UnitMetric[] = flows.groups.map((group) => {
    const current = group.current.valid && group.current.available > 0 ? group.current.wasted / group.current.available * 100 : null;
    const previous = group.previous.valid && group.previous.available > 0 ? group.previous.wasted / group.previous.available * 100 : null;
    const suppressed = group.current.records > 0 && group.current.records < 3;
    return {
      key: group.key, label: group.label, comparison: compare(current, previous, "percentage", "lower"), recordCount: group.current.records, suppressed,
      note: suppressed ? "Suppressed because this group contains fewer than three waste records." : group.current.records === 0 ? "No recorded waste in this unit group." : null,
    };
  });
  const sellThrough: UnitMetric[] = flows.groups.filter((group) => group.key.startsWith("finished-")).map((group) => ({
    key: group.key, label: group.label,
    comparison: compare(group.current.available > 0 ? group.current.sold / group.current.available * 100 : null, group.previous.available > 0 ? group.previous.sold / group.previous.available * 100 : null, "percentage", "higher"),
    recordCount: group.eligibleItems, suppressed: false, note: group.eligibleItems === 0 ? "No eligible finished-product stock flow." : null,
  }));
  const reconciliationEligible = sum(flows.groups, (group) => group.reconciliation.eligible);
  const reconciliationBalanced = sum(flows.groups, (group) => group.reconciliation.balanced);
  const reconciliationPct = reconciliationEligible ? reconciliationBalanced / reconciliationEligible * 100 : null;
  const reconciliation = compare(reconciliationPct, null, "percentage", "higher");
  const stages = shares(currentWaste, (waste) => waste.stage);
  const reasons = shares(currentWaste, reasonCategory);
  const map = menuMapCounts(records, period);
  const duplicates = duplicateCount(records, period);
  const invalidReferences = invalidReferenceCount(records, period);
  const complete = completeness(records, period);
  const wipRecords = currentWaste.filter((waste) => waste.stage === "WIP").length;
  const latestOperationalDate = [
    ...records.sales.map(saleDate), ...records.batches.map(batchDate), ...records.wasteLogs.map(wasteDate),
    ...records.purchases.map((row) => row.purchaseDate), ...records.usages.map((row) => row.date), ...records.dailyChecks.map((row) => row.date),
  ].filter((date) => date <= today).sort().pop() ?? null;
  const latestRecordUpdatedAt = (input.recordMeta ?? []).map((row) => row.updated_at).sort().pop() ?? null;
  const missingDays = Math.max(0, loggingCurrent.expectedDays - loggingCurrent.completedDays);
  const limitations = new Set<string>(flows.limitations);
  if (period.partialLabel) limitations.add(period.partialLabel);
  if (missingDays > 0) limitations.add(`${missingDays} expected operating day${missingDays === 1 ? " is" : "s are"} missing at least one required sales, inventory/production, or waste check.`);
  if (stages.missingCosting > 0) limitations.add(`${stages.missingCosting} waste record${stages.missingCosting === 1 ? " is" : "s are"} missing valid computed costing.`);
  if (map.excludedItems > 0) limitations.add(`${map.excludedItems} sold menu item${map.excludedItems === 1 ? " was" : "s were"} excluded from Menu Map classification because costing is incomplete.`);
  if (wipRecords > 0) limitations.add("WIP waste is included in value distributions but excluded from unit waste rates when no compatible WIP available-unit baseline exists.");
  if (invalidReferences > 0) limitations.add(`${invalidReferences} record${invalidReferences === 1 ? " has" : "s have"} invalid catalog or inventory references.`);
  if (duplicates.duplicates > 0) limitations.add(`${duplicates.duplicates} exact duplicate operational record${duplicates.duplicates === 1 ? " was" : "s were"} detected; sync retries with the same record ID are not counted.`);
  if (period.to !== today) limitations.add("Inventory reconciliation needs an independent closing-stock snapshot, which is only available as the current lot balance for ingredients.");
  limitations.add("Pending sync, failed sync, and conflict counts are device-local events and are not currently transmitted to the admin backend.");

  const findings: ResearchFinding[] = [];
  if (configuration.researchConsent) {
    const completenessText = `${loggingCurrent.completedDays}/${loggingCurrent.expectedDays} expected operating days have all three daily record types.`;
    if (wasteRatio.current !== null && wasteRatio.previous !== null && wasteRatio.status !== "No Significant Change") {
      findings.push({
        metric: "Waste-to-sales ratio",
        statement: `The recorded waste-to-sales ratio ${wasteRatio.difference! < 0 ? "decreased" : "increased"} compared with the equivalent previous reporting period. This change occurred during MenuWise usage; the available data does not independently establish causation.`,
        period: periodLabel(period), comparisonPeriod: previousLabel(period), difference: comparisonText(wasteRatio, "%"), completeness: completenessText,
        limitation: period.partial ? "The current period is partial and is compared only with equivalent elapsed days." : "Missing logs may affect the observed change.",
      });
    }
    const salesCoverage = compare(loggingCurrent.salesPct, loggingPrevious.salesPct, "percentage", "higher");
    if (salesCoverage.current !== null && salesCoverage.previous !== null && salesCoverage.status !== "No Significant Change") {
      findings.push({
        metric: "Sales logging coverage", statement: `Sales logging became ${salesCoverage.difference! > 0 ? "more" : "less"} consistent across expected café operating days.`,
        period: periodLabel(period), comparisonPeriod: previousLabel(period), difference: comparisonText(salesCoverage, "%"), completeness: completenessText,
        limitation: "Coverage measures recorded days, not whether every individual transaction was captured.",
      });
    }
    if (stages.shares.length && currentWaste.length >= 3) {
      const largest = stages.shares[0]!;
      findings.push({
        metric: "Waste stage distribution", statement: `${largest.label} waste accounts for the largest reported share of calculated waste value among categories meeting the privacy threshold.`,
        period: periodLabel(period), comparisonPeriod: previousLabel(period), difference: `${largest.sharePct.toFixed(1)}% of costed waste value`, completeness: `${currentWaste.length} waste records; ${stages.missingCosting} missing costing`,
        limitation: stages.suppressedGroups ? `${stages.suppressedGroups} small stage group(s) were suppressed.` : "Stage shares describe records, not causation.",
      });
    }
    if (!findings.length) findings.push({
      metric: "Equivalent-period comparison", statement: "Insufficient operational records prevent a reliable research comparison for this period.",
      period: periodLabel(period), comparisonPeriod: previousLabel(period), difference: "Not computable", completeness: completenessText,
      limitation: "Missing data is not interpreted as zero activity.",
    });
  }

  const incomingSupplierDeliveries = records.purchases.filter((row) => inRange(row.purchaseDate, period.from, period.to)).length + records.batches.filter((row) => records.menuItems.find((item) => item.id === row.menuItemId)?.type === "Outsourced" && inRange(batchDate(row), period.from, period.to)).length;
  const inHouseProduction = records.batches.filter((row) => records.menuItems.find((item) => item.id === row.menuItemId)?.type === "In-house" && inRange(batchDate(row), period.from, period.to)).length;
  const featureDays = (dates: string[]) => new Set(dates.filter((date) => inRange(date, period.from, period.to))).size;

  return {
    period,
    comparisonPeriod: { from: period.previousFrom, to: period.previousTo, equivalentDays: period.previousDays },
    sales: {
      volume: salesVolume,
      weekly: salesVolumeTrend(records, period),
    },
    kpis: {
      wasteToSales: wasteRatio,
      salesVolume,
      logging: {
        expectedDays: loggingCurrent.expectedDays,
        activeDays: loggingCurrent.activeDays,
        active: compare(loggingCurrent.activePct, loggingPrevious.activePct, "percentage", "higher"),
        sales: compare(loggingCurrent.salesPct, loggingPrevious.salesPct, "percentage", "higher"),
        inventory: compare(loggingCurrent.inventoryPct, loggingPrevious.inventoryPct, "percentage", "higher"),
        waste: compare(loggingCurrent.wastePct, loggingPrevious.wastePct, "percentage", "higher"),
        overall: compare(loggingCurrent.completedPct, loggingPrevious.completedPct, "percentage", "higher"),
        closeout: compare(loggingCurrent.closeoutPct, loggingPrevious.closeoutPct, "percentage", "higher"),
        days: { sales: loggingCurrent.salesDays, inventory: loggingCurrent.inventoryDays, waste: loggingCurrent.wasteDays, closeout: loggingCurrent.closeoutDays, completed: loggingCurrent.completedDays },
      },
      reconciliation,
    },
    waste: {
      ratio: wasteRatio,
      incidents: currentWaste.length,
      rates: unitMetrics,
      trend: wasteTrend(records, period),
      stages,
      reasons,
    },
    inventory: {
      sellThrough,
      closing: {
        groups: flows.groups.map((group) => ({ key: group.key, label: group.label, unit: group.baseUnit })),
        weeks: flows.weeks.map((week, weekIndex) => ({
          ...week,
          values: Object.fromEntries(flows.groups.map((group) => [group.key, group.weeklyClosing[weekIndex] ?? null])),
        })),
      },
      stockouts: { items: sum(flows.groups, (group) => group.stockoutItems), eligibleItems: sum(flows.groups, (group) => group.eligibleItems) },
      reconciliation: { percentage: reconciliationPct, eligible: reconciliationEligible, balanced: reconciliationBalanced, discrepancies: sum(flows.groups, (group) => group.reconciliation.discrepancies), available: reconciliationEligible > 0 },
      incomingSupplierDeliveries,
      inHouseProduction,
      movement: {
        purchases: records.purchases.filter((row) => inRange(row.purchaseDate, period.from, period.to)).length,
        production: records.batches.filter((row) => inRange(batchDate(row), period.from, period.to)).length,
        usages: records.usages.filter((row) => inRange(row.date, period.from, period.to)).length,
        sales: currentSales.length,
        waste: currentWaste.length,
      },
    },
    menuMap: map,
    quality: {
      completeness: { percentage: complete.total ? round1(complete.complete / complete.total * 100) : null, complete: complete.complete, total: complete.total },
      duplicates: { count: duplicates.duplicates, ratePct: duplicates.total ? round1(duplicates.duplicates / duplicates.total * 100) : null, checked: duplicates.total },
      invalidReferences,
      reconciliation: { percentage: reconciliationPct, eligible: reconciliationEligible, discrepancies: sum(flows.groups, (group) => group.reconciliation.discrepancies) },
      sync: {
        lastSuccessfulSync: null, latestRecordUpdatedAt, pending: null, failures: null, conflicts: null,
        note: "Device-local pending, failure, and conflict events are not transmitted. Latest synced record update is shown separately from event dates.",
      },
      latestOperationalDate,
    },
    usage: {
      activeDays: loggingCurrent.activeDays,
      expectedDays: loggingCurrent.expectedDays,
      closeoutCompletionPct: loggingCurrent.closeoutPct,
      features: [
        { key: "sales", label: "Sales", days: featureDays(records.sales.map(saleDate)) },
        { key: "production", label: "Production", days: featureDays(records.batches.map(batchDate)) },
        { key: "waste", label: "Waste", days: featureDays(records.wasteLogs.map(wasteDate)) },
        { key: "inventory", label: "Inventory", days: featureDays([...records.purchases.map((row) => row.purchaseDate), ...records.usages.map((row) => row.date)]) },
        { key: "closeout", label: "Daily closeout", days: featureDays(records.dailyChecks.filter((row) => row.closeout).map((row) => row.date)) },
      ],
    },
    research: { allowed: configuration.researchConsent, findings, limitations: [...limitations] },
    catalog: {
      menuItems: records.menuItems.length,
      recipeReady: records.menuItems.filter((item) => item.type === "Outsourced" || (item.recipe?.length ?? 0) > 0).length,
      ingredients: records.ingredients.length,
      pricedIngredients: records.ingredients.filter((ingredient) => ingredient.unitCost > 0).length,
      productionBatches: records.batches.length,
      productionBatchesPeriod: records.batches.filter((batch) => inRange(batchDate(batch), period.from, period.to)).length,
    },
    menuItems: records.menuItems.map((item) => ({
      id: pseudonym("item", item.id), category: item.category, type: item.type,
      recipeStatus: item.type === "Outsourced" ? "Outsourced" : (item.recipe?.length ?? 0) > 0 ? "Recipe linked" : "No recipe",
    })),
    ingredients: records.ingredients.map((ingredient) => ({ id: pseudonym("ing", ingredient.id), unit: ingredient.unit, costStatus: ingredient.unitCost > 0 ? "Priced" : "Missing cost" })),
  };
}

export type CafeSummary = ReturnType<typeof summarizeCafe>;
