/**
 * Café operating calendar: weekly open days plus one-off closures.
 * Dates are yyyy-mm-dd strings; weekday numbers follow JS (0 = Sunday).
 */
export interface Closure { date: string; note?: string }
export interface OperatingCalendar {
  weekdays: number[];
  closures: Closure[];
  /** False while the pattern is inferred from activity and not confirmed by the owner. */
  confirmed: boolean;
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function shiftDate(iso: string, n: number): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + n));
  return date.toISOString().slice(0, 10);
}
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay();
}
export function calendarDaysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb!, mb! - 1, db!) - Date.UTC(ya!, ma! - 1, da!)) / 86400000);
}

export function isOpen(cal: OperatingCalendar, date: string): boolean {
  return cal.weekdays.includes(weekdayOf(date)) && !cal.closures.some((c) => c.date === date);
}

/** Open days from `from` to `to`, both inclusive. */
export function openDatesBetween(cal: OperatingCalendar, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) if (isOpen(cal, d)) out.push(d);
  return out;
}
export function openDaysBetween(cal: OperatingCalendar, from: string, to: string): number {
  return openDatesBetween(cal, from, to).length;
}

/** The n-th open day after `from` (n = 0 returns `from` when open, else the next open day). */
export function addOpenDays(cal: OperatingCalendar, from: string, n: number): string {
  if (!cal.weekdays.length) return shiftDate(from, n);
  let d = from;
  if (n <= 0) { while (!isOpen(cal, d)) d = shiftDate(d, 1); return d; }
  let left = n;
  while (left > 0) { d = shiftDate(d, 1); if (isOpen(cal, d)) left--; }
  return d;
}
/** The n-th open day before `from`. */
export function subtractOpenDays(cal: OperatingCalendar, from: string, n: number): string {
  if (!cal.weekdays.length) return shiftDate(from, -n);
  let d = from, left = n;
  while (left > 0) { d = shiftDate(d, -1); if (isOpen(cal, d)) left--; }
  return d;
}

/**
 * Guess open weekdays from activity: a weekday counts as open when the café logged
 * anything on that weekday in the window. Under 7 active days → assume every day.
 */
export function inferWeekdays(activityDates: string[], from: string, to: string): number[] {
  const active = new Set(activityDates.map((d) => d.slice(0, 10)).filter((d) => d >= from && d <= to));
  if (active.size < 7) return [...ALL_WEEKDAYS];
  const hit = new Set([...active].map(weekdayOf));
  return ALL_WEEKDAYS.filter((w) => hit.has(w));
}

/** Effective calendar: the owner's confirmed pattern, otherwise an inferred one. */
export function resolveCalendar(saved: { weekdays?: number[]; closures?: Closure[]; confirmed?: boolean } | undefined, activityDates: string[], today: string): OperatingCalendar {
  const closures = saved?.closures ?? [];
  if (saved?.confirmed && saved.weekdays?.length) return { weekdays: saved.weekdays, closures, confirmed: true };
  return { weekdays: inferWeekdays(activityDates, shiftDate(today, -28), shiftDate(today, -1)), closures, confirmed: false };
}

export function describeClosedDays(weekdays: number[]): string {
  const closed = ALL_WEEKDAYS.filter((w) => !weekdays.includes(w));
  if (!closed.length) return "open every day";
  return `closed ${closed.map((w) => `${WEEKDAY_NAMES[w]}s`).join(" and ")}`;
}
