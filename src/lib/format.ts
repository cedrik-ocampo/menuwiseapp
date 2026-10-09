import { getPrefs } from "./prefs";

/** Philippine pesos, e.g. ₱75.00 (symbol follows the currency preference). */
export function formatPeso(n: number | undefined | null): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0;
  return `${getPrefs().currency}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(iso: string, n: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}
/** 10/6/26 style */
export function shortDate(iso: string | undefined): string {
  if (!iso) return "—";
  const d = parseDate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
}
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}
export function daysFromToday(iso: string): number {
  return daysBetween(todayISO(), iso);
}
export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}
export function uid(prefix = ""): string {
  return prefix + Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-3).toUpperCase();
}
