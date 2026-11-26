/**
 * Pure reorder and batch-suggestion engine. No UI or storage here:
 * callers pass plain numbers already converted to the ingredient's stock unit.
 */
import { addOpenDays, isOpen, openDatesBetween, shiftDate, subtractOpenDays, weekdayOf, WEEKDAY_NAMES, type OperatingCalendar } from "./operating-calendar";

export type Confidence = "Low" | "Medium" | "High";

export interface SuggestionSettings {
  wasteCapPct: number;
  borderlinePct: number;
  eligibilityDays: number;
  categoryMin: number;
  safetyBufferDays: number;
  historyWeeks: number;
}
export const DEFAULT_SETTINGS: SuggestionSettings = { wasteCapPct: 30, borderlinePct: 10, eligibilityDays: 28, categoryMin: 5, safetyBufferDays: 1, historyWeeks: 4 };
export const CAP_OPTIONS = [0, 15, 30, 50];

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const UNIT_GROUPS: Record<string, number>[] = [{ g: 1, kg: 1000 }, { ml: 1, L: 1000 }];
/** Convert between compatible units (kg ↔ g, L ↔ ml); NaN when incompatible. */
export function toStockUnit(qty: number, from: string, stockUnit: string): number {
  if (from === stockUnit) return qty;
  const g = UNIT_GROUPS.find((x) => from in x && stockUnit in x);
  return g ? (qty * g[from]!) / g[stockUnit]! : Number.NaN;
}

/** Waste that better ordering can prevent. Trim, spills and prep errors are not. */
export const AVOIDABLE_WASTE = new Set(["Expiry", "Spoilage", "Unsold", "Day-old"]);

export function confidenceFor(dataDays: number, sameWeekdaySamples: number, calendarConfirmed: boolean): Confidence {
  if (!calendarConfirmed || dataDays < 7) return "Low";
  if (dataDays >= 28 && sameWeekdaySamples >= 4) return "High";
  return "Medium";
}

/* ---------------- Daily use ---------------- */
export interface DatedQty { date: string; qty: number }

/** Median use per weekday over the history window, counting only open days (closed days never dilute it). */
export function weekdayDemand(cal: OperatingCalendar, usage: DatedQty[], today: string, weeks = 4) {
  const from = shiftDate(today, -7 * weeks), to = shiftDate(today, -1);
  const totals = new Map<string, number>();
  usage.forEach((u) => { if (u.date >= from && u.date <= to) totals.set(u.date, (totals.get(u.date) ?? 0) + u.qty); });
  const dates = openDatesBetween(cal, from, to);
  const byWeekday = new Map<number, number[]>();
  dates.forEach((d) => { const w = weekdayOf(d); byWeekday.set(w, [...(byWeekday.get(w) ?? []), totals.get(d) ?? 0]); });
  const perWeekday = new Map<number, number>();
  byWeekday.forEach((v, w) => perWeekday.set(w, median(v)));
  const total = dates.reduce((a, d) => a + (totals.get(d) ?? 0), 0);
  const average = dates.length ? [...perWeekday.entries()].reduce((a, [w, m]) => a + m * (byWeekday.get(w)!.length), 0) / dates.length : 0;
  const samples = Math.min(...[...byWeekday.values()].map((v) => v.length), Infinity);
  return { perWeekday, average, total, openDays: dates.length, samples: Number.isFinite(samples) ? samples : 0 };
}

/* ---------------- Lots (earliest-expiry first) ---------------- */
export interface Lot { id: string; qty: number; received: string; expiry: string | null; estimated: boolean }
export interface LotRisk { id: string; received: string; expiry: string | null; estimated: boolean; qty: number; atRisk: number }

export interface Projection { stockoutDate: string | null; usableAt: (date: string) => number; risks: LotRisk[]; wastedTotal: number }

/** Day-by-day: write off expired lots (calendar days), then consume demand on open days only, earliest expiry first. */
export function projectLots(cal: OperatingCalendar, lots: Lot[], demandOn: (date: string) => number, today: string, horizonDays = 120): Projection {
  const live = lots.filter((l) => l.qty > 0).map((l) => ({ ...l, left: l.qty, wasted: 0 }));
  const snapshots = new Map<string, number>();
  let stockoutDate: string | null = null;
  for (let i = 0; i <= horizonDays; i++) {
    const d = shiftDate(today, i);
    live.forEach((l) => { if (l.received <= d && l.expiry !== null && l.expiry < d && l.left > 0) { l.wasted += l.left; l.left = 0; } });
    snapshots.set(d, live.filter((l) => l.received <= d).reduce((a, l) => a + l.left, 0));
    if (!isOpen(cal, d)) continue;
    let need = demandOn(d);
    const order = live.filter((l) => l.received <= d && l.left > 0).sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999") || a.received.localeCompare(b.received));
    for (const l of order) { if (need <= 1e-9) break; const take = Math.min(l.left, need); l.left -= take; need -= take; }
    if (need > 1e-9 && stockoutDate === null) stockoutDate = d;
  }
  const last = shiftDate(today, horizonDays);
  return {
    stockoutDate,
    usableAt: (date) => snapshots.get(date) ?? (date > last ? 0 : snapshots.get(today) ?? 0),
    risks: live.map((l) => ({ id: l.id, received: l.received, expiry: l.expiry, estimated: l.estimated, qty: l.qty, atRisk: round3(l.wasted) })),
    wastedTotal: round3(live.reduce((a, l) => a + l.wasted, 0)),
  };
}

/* ---------------- Reorder ---------------- */
export type ReorderStatus = "Order now" | "Order by" | "OK" | "No recent use";
export interface ReorderInput {
  today: string;
  calendar: OperatingCalendar;
  lots: Lot[];
  /** Placed but not received; arrival defaults to today + lead time. */
  onOrder: { qty: number; arrival?: string }[];
  usage: DatedQty[];
  waste: (DatedQty & { avoidable: boolean })[];
  leadTimeDays: number;
  /** Weekdays the supplier delivers; when empty, assume one order a week. */
  deliveryWeekdays?: number[];
  packSize?: number;
  supplierMinimum?: number;
  /** Shelf life of a newly bought lot in calendar days; null = does not expire. */
  shelfLifeDays: number | null;
  /** Calendar days with any usage/purchase history (caps at the history window). */
  dataDays: number;
  settings: SuggestionSettings;
}
export interface ReorderResult {
  status: ReorderStatus;
  orderBy: string | null;
  stockoutDate: string | null;
  arrival: string;
  dailyUse: number;
  usableStock: number;
  onOrder: number;
  target: number;
  order: number;
  beforeAdjustments: number;
  shelfCap: number | null;
  wasteReductionPct: number;
  confidence: Confidence;
  risks: LotRisk[];
  notes: string[];
  explanation: string;
}

function nextDeliveryAfter(cal: OperatingCalendar, from: string, weekdays: number[] | undefined): string {
  if (!weekdays?.length) return shiftDate(from, 7);
  for (let i = 1; i <= 14; i++) { const d = shiftDate(from, i); if (weekdays.includes(weekdayOf(d))) return d; }
  return shiftDate(from, 7);
}

/** Avoidable waste share of what was bought-and-gone, capped at the café's waste cap. */
export function wasteReduction(usageTotal: number, waste: (DatedQty & { avoidable: boolean })[], capPct: number) {
  const avoidable = waste.filter((w) => w.avoidable).reduce((a, w) => a + w.qty, 0);
  const base = usageTotal + avoidable;
  const share = base > 0 ? (avoidable / base) * 100 : 0;
  return { pct: Math.max(0, Math.min(capPct, share)), rawPct: share, avoidable };
}

export function suggestReorder(input: ReorderInput): ReorderResult {
  const { today, calendar: cal, settings } = input;
  const historyFrom = shiftDate(today, -7 * settings.historyWeeks);
  const demand = weekdayDemand(cal, input.usage, today, settings.historyWeeks);
  const demandOn = (d: string) => (isOpen(cal, d) ? demand.perWeekday.get(weekdayOf(d)) ?? demand.average : 0);
  const arrival = addOpenDays(cal, today, Math.max(0, input.leadTimeDays));
  const onOrderLots: Lot[] = input.onOrder.map((o, i) => ({ id: `on-order-${i}`, qty: o.qty, received: o.arrival ?? arrival, expiry: input.shelfLifeDays === null ? null : shiftDate(o.arrival ?? arrival, input.shelfLifeDays), estimated: true }));
  const onOrder = input.onOrder.reduce((a, o) => a + o.qty, 0);
  const proj = projectLots(cal, [...input.lots, ...onOrderLots], demandOn, today);
  const existing = projectLots(cal, input.lots, demandOn, today);
  const stockNow = input.lots.filter((l) => l.expiry === null || l.expiry >= today).reduce((a, l) => a + l.qty, 0);
  const usableStock = round3(Math.max(0, stockNow - existing.wastedTotal));
  const confidence = confidenceFor(Math.min(input.dataDays, 7 * settings.historyWeeks), demand.samples, cal.confirmed);
  const notes: string[] = [];
  if (!cal.confirmed) notes.push("Open days estimated");
  input.lots.filter((l) => l.estimated).length && notes.push("Expiry estimated");

  const base = { arrival, dailyUse: round3(demand.average), usableStock, onOrder, confidence, risks: existing.risks.filter((r) => r.atRisk > 0), notes };
  if (demand.total <= 0) {
    return { ...base, status: "No recent use", orderBy: null, stockoutDate: null, target: 0, order: 0, beforeAdjustments: 0, shelfCap: null, wasteReductionPct: 0, explanation: `No use recorded since ${historyFrom}.` };
  }

  const following = nextDeliveryAfter(cal, arrival, input.deliveryWeekdays);
  const coverageDays = input.leadTimeDays + Math.max(1, openDatesBetween(cal, shiftDate(arrival, 1), following).length) + settings.safetyBufferDays;
  const target = round3(demand.average * coverageDays);
  const raw = Math.max(0, target - (usableStock + onOrder));
  const reduction = wasteReduction(demand.total, input.waste.filter((w) => w.date >= historyFrom && w.date < today), settings.wasteCapPct);
  let order = raw * (1 - reduction.pct / 100);

  // Shelf-life cap: never buy more than can be used before the new lot expires.
  let shelfCap: number | null = null;
  if (input.shelfLifeDays !== null) {
    const expiry = shiftDate(arrival, input.shelfLifeDays);
    const usable = openDatesBetween(cal, arrival, expiry).reduce((a, d) => a + demandOn(d), 0);
    shelfCap = round3(Math.max(0, usable - proj.usableAt(arrival)));
    if (order > shelfCap) { order = shelfCap; notes.push("Limited by shelf life"); }
  }
  const pack = input.packSize && input.packSize > 0 ? input.packSize : 0;
  if (pack && order > 0) {
    const up = Math.ceil(order / pack - 1e-9) * pack;
    order = shelfCap === null || up <= shelfCap + 1e-9 ? up : Math.floor(order / pack + 1e-9) * pack;
  }
  if (input.supplierMinimum && order > 0 && order < input.supplierMinimum) {
    if (shelfCap === null || input.supplierMinimum <= shelfCap) order = input.supplierMinimum;
    else notes.push(`Below supplier minimum (${input.supplierMinimum}) to avoid expiry`);
  }
  order = round3(order);

  const stockoutDate = proj.stockoutDate;
  const orderBy = stockoutDate ? subtractOpenDays(cal, stockoutDate, input.leadTimeDays) : null;
  const status: ReorderStatus = orderBy === null ? "OK" : orderBy <= today ? "Order now" : orderBy <= shiftDate(today, 14) ? "Order by" : "OK";
  const finalOrder = status === "OK" ? 0 : order;

  const parts = [`Uses about ${round3(demand.average)} per open day over ${demand.openDays} open days`];
  if (stockoutDate) parts.push(`runs out ${WEEKDAY_NAMES[weekdayOf(stockoutDate)]} ${stockoutDate}`);
  if (reduction.pct > 0) parts.push(`ordering ${Math.round(reduction.pct)}% less for avoidable waste${reduction.rawPct > reduction.pct ? ` (capped at ${settings.wasteCapPct}%)` : ""}`);
  if (base.risks.length) parts.push(`${round3(existing.wastedTotal)} on hand will likely expire unused`);
  return { ...base, status, orderBy, stockoutDate, target, order: finalOrder, beforeAdjustments: round3(raw), shelfCap, wasteReductionPct: Math.round(reduction.pct * 10) / 10, explanation: `${parts.join("; ")}.` };
}

/** Same scenario at several waste caps, for owners comparing options. */
export function compareCaps(input: ReorderInput, caps = CAP_OPTIONS) {
  return caps.map((cap) => ({ cap, result: suggestReorder({ ...input, settings: { ...input.settings, wasteCapPct: cap } }) }));
}

/* ---------------- Tomorrow's batch ---------------- */
export interface BatchInput {
  targetDate: string;
  calendar: OperatingCalendar;
  sales: DatedQty[];
  waste: DatedQty[];
  soldOutDates: string[];
  carryover: number;
  margin: number;
  unitCost: number;
  bufferPct?: number;
  dataDays: number;
}
export interface BatchResult { batch: number; median: number; samples: number; soldOutExcluded: number; leftoverMedian: number; confidence: Confidence; rounding: "up" | "down" | "nearest"; explanation: string; notes: string[] }

export function suggestBatch(input: BatchInput): BatchResult {
  const { calendar: cal, targetDate } = input;
  const weekday = weekdayOf(targetDate);
  const soldOut = new Set(input.soldOutDates);
  const candidates: string[] = [];
  for (let d = shiftDate(targetDate, -7); candidates.length < 4 && d >= shiftDate(targetDate, -56); d = shiftDate(d, -7)) if (isOpen(cal, d)) candidates.push(d);
  const samplesDates = candidates.filter((d) => !soldOut.has(d));
  const sum = (rows: DatedQty[], d: string) => rows.filter((r) => r.date === d).reduce((a, r) => a + r.qty, 0);
  const sold = samplesDates.map((d) => sum(input.sales, d));
  const left = samplesDates.map((d) => sum(input.waste, d));
  const med = median(sold), leftMed = median(left);
  const notes: string[] = [];
  let bufferPct = input.bufferPct ?? 10;
  if (med > 0 && leftMed >= med * 0.2) { bufferPct = 0; notes.push("High leftovers on this weekday — no extra buffer"); }
  const raw = Math.max(0, med * (1 + bufferPct / 100) - input.carryover);
  const ratio = input.margin + input.unitCost > 0 ? input.margin / (input.margin + input.unitCost) : 0.5;
  const rounding = ratio >= 0.6 ? "up" : ratio <= 0.4 ? "down" : "nearest";
  const batch = rounding === "up" ? Math.ceil(raw - 1e-9) : rounding === "down" ? Math.floor(raw + 1e-9) : Math.round(raw);
  const soldOutExcluded = candidates.length - samplesDates.length;
  let confidence = confidenceFor(input.dataDays, samplesDates.length, cal.confirmed);
  if (samplesDates.length < 3) confidence = "Low";
  if (!cal.confirmed) notes.push("Open days estimated");
  const day = WEEKDAY_NAMES[weekday];
  return { batch, median: med, samples: samplesDates.length, soldOutExcluded, leftoverMedian: leftMed, confidence, rounding, notes,
    explanation: `Based on ${samplesDates.length} ${day}${samplesDates.length === 1 ? "" : "s"}: median ${med} sold, ${soldOutExcluded} sold out, ${leftMed} left over${input.carryover ? `; ${input.carryover} carried over` : ""}.` };
}
