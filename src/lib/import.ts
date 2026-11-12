/** Spreadsheet import helpers (Excel .xlsx/.xls and CSV), parsed on the device. */

export type Row = Record<string, string>;

/** "Ingredient_ID" / "ingredient id" -> "ingredientid" */
export const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface SheetData { name: string; rows: Row[]; date: string }

/** Turn a raw 2D sheet into rows: skips title banners above the header and blank/footer rows. */
export function rowsFromGrid(grid: unknown[][]): Row[] {
  const cellText = (v: unknown) => v instanceof Date ? isoDate(v) : String(v ?? "").trim();
  const isText = (v: string) => v !== "" && isNaN(Number(v));
  const headerAt = grid.findIndex((r) => (r ?? []).map(cellText).filter(isText).length >= 2);
  if (headerAt < 0) return [];
  const header = (grid[headerAt] ?? []).map(cellText);
  const out: Row[] = [];
  for (const r of grid.slice(headerAt + 1)) {
    const cells = (r ?? []).map(cellText);
    const filled = cells.filter(Boolean);
    if (!filled.length) continue;
    if (filled.length <= 4 && filled.every((c) => /:$/.test(c))) continue; // footer like "Date:" "Verified By:"
    const row: Row = {};
    header.forEach((h, i) => { if (h) row[keyOf(h)] = cells[i] ?? ""; });
    out.push(row);
  }
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "Nov 11", "11 Nov", "November 11 2026", "2026-11-11" → ISO date, or "" if the tab name isn't a date. */
export function dateFromSheetName(name: string, today = new Date()): string {
  const t = name.trim().toLowerCase();
  const iso = normDate(t.match(/^\d{4}-\d{2}-\d{2}$/) || t.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/) ? t : "");
  if (iso) return iso;
  const m = t.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/) ?? t.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?(?:,?\s+(\d{4}))?$/);
  if (!m) return "";
  const [mon, day] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
  const mi = MONTHS.indexOf(mon);
  if (mi < 0) return "";
  let y = m[3] ? Number(m[3]) : today.getFullYear();
  const d = new Date(y, mi, Number(day), 12);
  if (d.getMonth() !== mi) return "";
  if (!m[3] && d.getTime() - today.getTime() > 7 * 86400000) { y -= 1; d.setFullYear(y); }
  return isoDate(d);
}

/** Read every tab of a workbook (CSV = one tab). Empty tabs are dropped. */
export async function readWorkbook(file: File): Promise<SheetData[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name) ? XLSX.read(new TextDecoder().decode(buf), { type: "string", cellDates: true }) : XLSX.read(buf, { type: "array", cellDates: true });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const grid = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true }) : [];
    return { name, rows: rowsFromGrid(grid), date: dateFromSheetName(name) };
  }).filter((s) => s.rows.length);
}

export async function readSheet(file: File): Promise<Row[]> {
  return (await readWorkbook(file))[0]?.rows ?? [];
}

function isoDate(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Accept yyyy-mm-dd, mm/dd/yyyy, or anything Date can parse. Returns "" if invalid. */
export function normDate(v: string): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const parsed = new Date(`${v}T12:00:00`);
    return !isNaN(parsed.getTime()) && isoDate(parsed) === v ? v : "";
  }
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return normDate(`${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`);
  const d = new Date(v);
  return isNaN(d.getTime()) ? "" : isoDate(d);
}

export function num(v: string): number {
  return parseFloat(String(v).replace(/[₱,\s]/g, ""));
}

/**
 * Trim, collapse spaces and match case-insensitively against known categories.
 * Returns the matched known name, or a tidied new name flagged as unknown.
 */
export function normalizeCategory(raw: string, known: string[]): { value: string; known: boolean } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return { value: "", known: false };
  const hit = known.find((k) => keyOf(k) === keyOf(t) || keyOf(k) === keyOf(t).replace(/s$/, "") || keyOf(k).replace(/s$/, "") === keyOf(t));
  if (hit) return { value: hit, known: true };
  return { value: t.replace(/\b\w/g, (c) => c.toUpperCase()), known: false };
}
