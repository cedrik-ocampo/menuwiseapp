import { manilaToday } from "./admin-periods";
import type { Batch, DailyCheck, Ingredient, MenuItem, Purchase, Sale, Usage, WasteLog } from "./types";

/** Raw café records the server passes in; only the anonymized CSVs leave the server. */
export interface ExportRecords {
  ingredients: Ingredient[]; menuItems: MenuItem[]; sales: Sale[]; batches: Batch[];
  wasteLogs: WasteLog[]; purchases: Purchase[]; usages: Usage[]; dailyChecks: DailyCheck[];
}
export interface ExportFile { name: string; content: string }

const day = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : manilaToday(d); };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? "";
const weekStart = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : "");

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: unknown) => { const s = v === null || v === undefined ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Stable pseudonyms: same record → same token across every file in the bundle. */
function tokenizer(prefix: string, ids: string[]) {
  const map = new Map([...new Set(ids)].sort().map((id, i) => [id, `${prefix}-${String(i + 1).padStart(3, "0")}`]));
  return (id?: string) => (id ? map.get(id) ?? `${prefix}-UNKNOWN` : "");
}

/**
 * Builds the anonymized research bundle: full history, pseudonymous item/ingredient tokens,
 * quantities, units, dates, categories and reasons. Names, prices, costs, revenue, notes,
 * recipes and staff identities are never written.
 */
export function buildResearchExport(r: ExportRecords, cafeToken = "CAFE"): ExportFile[] {
  const item = tokenizer("ITEM", r.menuItems.map((m) => m.id));
  const ing = tokenizer("ING", r.ingredients.map((i) => i.id));
  const batch = tokenizer("BATCH", r.batches.map((b) => b.id));
  const items = new Map(r.menuItems.map((m) => [m.id, m]));
  const ings = new Map(r.ingredients.map((i) => [i.id, i]));
  const byDate = <T,>(rows: T[], d: (x: T) => string) => [...rows].sort((a, b) => d(a).localeCompare(d(b)));

  const files: ExportFile[] = [];
  files.push({ name: "menu_items.csv", content: toCsv(["item_token", "category", "subcategory", "type", "unit", "shelf_life_days", "available", "needs_review"],
    byDate(r.menuItems, (m) => item(m.id)).map((m) => [item(m.id), m.category, m.subcategory, m.type, m.unit, num(m.shelfLifeDays), m.available, (m.tags ?? []).includes("needs-review")])) });
  files.push({ name: "ingredients.csv", content: toCsv(["ingredient_token", "category", "storage", "unit", "lead_time_days", "default_shelf_life_days"],
    byDate(r.ingredients, (i) => ing(i.id)).map((i) => [ing(i.id), i.category, i.storage, i.unit, num(i.leadTimeDays), num(i.defaultShelfLifeDays)])) });
  files.push({ name: "sales.csv", content: toCsv(["date", "weekday", "week_start", "item_token", "category", "quantity"],
    byDate(r.sales, (s) => s.date).map((s) => { const d = s.date.slice(0, 10); return [d, weekday(d), weekStart(d), item(s.menuItemId), items.get(s.menuItemId)?.category ?? "", num(s.quantity)]; })) });
  files.push({ name: "production_batches.csv", content: toCsv(["date", "weekday", "batch_token", "item_token", "item_type", "quantity", "expiry_date", "shelf_days"],
    byDate(r.batches, (b) => b.producedAt).map((b) => { const d = day(b.producedAt); const e = b.expiryDate?.slice(0, 10) ?? "";
      const shelf = e ? Math.round((Date.parse(`${e}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000) : "";
      return [d, weekday(d), batch(b.id), item(b.menuItemId), items.get(b.menuItemId)?.type ?? "", num(b.quantity), e, shelf]; })) });
  files.push({ name: "waste_logs.csv", content: toCsv(["date", "weekday", "week_start", "stage", "reason", "subject", "subject_token", "category", "batch_token", "quantity", "unit"],
    byDate(r.wasteLogs, (w) => w.at).map((w) => { const d = day(w.at);
      const subject = w.ingredientId ? "ingredient" : w.menuItemId ? "menu_item" : "unlisted_item";
      const token = w.ingredientId ? ing(w.ingredientId) : w.menuItemId ? item(w.menuItemId) : "";
      const cat = w.ingredientId ? ings.get(w.ingredientId)?.category : w.menuItemId ? items.get(w.menuItemId)?.category : "";
      return [d, weekday(d), weekStart(d), w.stage, w.wasteType, subject, token, cat ?? "", batch(w.batchId), num(w.quantity), w.unit]; })) });
  files.push({ name: "ingredient_purchases.csv", content: toCsv(["purchase_date", "ingredient_token", "quantity", "remaining", "unit", "expiry_date", "status"],
    byDate(r.purchases, (p) => p.purchaseDate).map((p) => [p.purchaseDate, ing(p.ingredientId), num(p.quantity), num(p.remaining), ings.get(p.ingredientId)?.unit ?? "", p.expiryDate ?? "", p.ordered ? "ordered" : "received"])) });
  files.push({ name: "ingredient_usage.csv", content: toCsv(["date", "ingredient_token", "item_token", "quantity", "unit"],
    byDate(r.usages, (u) => u.date).map((u) => [u.date, ing(u.ingredientId), item(u.menuItemId), num(u.quantity), ings.get(u.ingredientId)?.unit ?? ""])) });

  // Daily compliance: one row per date with any activity or closeout.
  const dates = new Set<string>();
  const sets = { sales: new Set(r.sales.map((s) => s.date.slice(0, 10))), prod: new Set(r.batches.map((b) => day(b.producedAt))), waste: new Set(r.wasteLogs.map((w) => day(w.at))), inv: new Set([...r.purchases.map((p) => p.purchaseDate), ...r.usages.map((u) => u.date)]) };
  const checks = new Map(r.dailyChecks.map((c) => [c.date, c]));
  for (const s of Object.values(sets)) s.forEach((d) => dates.add(d));
  checks.forEach((_, d) => dates.add(d));
  files.push({ name: "daily_compliance.csv", content: toCsv(["date", "weekday", "sales_logged", "production_logged", "inventory_logged", "waste_logged", "no_waste_confirmed", "closeout_done", "sold_out_items"],
    [...dates].sort().map((d) => { const c = checks.get(d); return [d, weekday(d), sets.sales.has(d), sets.prod.has(d), sets.inv.has(d), sets.waste.has(d), c?.noWaste ?? false, c?.closeout ?? false, (c?.soldOut ?? []).map((id) => item(id)).join(" ")]; })) });

  // Weekly summary (Monday–Sunday, Asia/Manila).
  const weeks = new Map<string, { sold: number; produced: number; wasteLogs: number; wasted: Record<string, number>; days: Set<string> }>();
  const w = (d: string) => { const k = weekStart(d); if (!weeks.has(k)) weeks.set(k, { sold: 0, produced: 0, wasteLogs: 0, wasted: {}, days: new Set() }); return weeks.get(k)!; };
  r.sales.forEach((s) => { const d = s.date.slice(0, 10); const x = w(d); x.sold += Number(s.quantity) || 0; x.days.add(d); });
  r.batches.forEach((b) => { const d = day(b.producedAt); const x = w(d); x.produced += Number(b.quantity) || 0; x.days.add(d); });
  r.wasteLogs.forEach((l) => { const d = day(l.at); const x = w(d); x.wasteLogs++; x.wasted[l.unit || "unit"] = (x.wasted[l.unit || "unit"] ?? 0) + (Number(l.quantity) || 0); x.days.add(d); });
  files.push({ name: "weekly_summary.csv", content: toCsv(["week_start", "active_days", "units_sold", "units_produced", "waste_logs", "waste_quantity_by_unit"],
    [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, x.days.size, Math.round(x.sold * 100) / 100, Math.round(x.produced * 100) / 100, x.wasteLogs, Object.entries(x.wasted).map(([u, q]) => `${Math.round(q * 100) / 100} ${u}`).join("; ")])) });

  files.push({ name: "README_DataDictionary.txt", content: [
    `MenuWise research dataset — ${cafeToken}`, `Generated ${new Date().toISOString()} · dates in Asia/Manila · weeks run Monday–Sunday.`, "",
    "Privacy: item and ingredient names are replaced by stable tokens (ITEM-001, ING-001, BATCH-001) that match across files.",
    "Never included: names, prices, costs, revenue, peso values, recipes, notes, supplier names, staff identities.", "",
    "Files:", ...files.map((f) => `- ${f.name}`), "",
    "subject in waste_logs: ingredient | menu_item | unlisted_item (free-text entry; text withheld).",
    "reason = logged waste type; stage = where in the flow the waste happened.",
    "daily_compliance lists only dates with activity; a missing date means nothing was logged, not zero activity.",
  ].join("\r\n") });
  return files;
}
