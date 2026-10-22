/** Spreadsheet import helpers (Excel .xlsx/.xls and CSV), parsed on the device. */

export type Row = Record<string, string>;

/** "Ingredient_ID" / "ingredient id" -> "ingredientid" */
export const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function readSheet(file: File): Promise<Row[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = /\.csv$/i.test(file.name) ? XLSX.read(new TextDecoder().decode(buf), { type: "string", cellDates: true }) : XLSX.read(buf, { type: "array", cellDates: true });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: true });
  return rows.map((r) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(r)) {
      out[keyOf(k)] = v instanceof Date ? isoDate(v) : String(v ?? "").trim();
    }
    return out;
  });
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
