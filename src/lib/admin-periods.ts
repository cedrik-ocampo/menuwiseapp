import { addDays, daysBetween, parseDate } from "./format";

export const PERIOD_OPTIONS = [
  { value: "this-week", label: "This Week" },
  { value: "last-week", label: "Last Week" },
  { value: "2-weeks", label: "2 Weeks Ago" },
  { value: "3-weeks", label: "3 Weeks Ago" },
  { value: "4-weeks", label: "4 Weeks Ago" },
  { value: "5-weeks", label: "5 Weeks Ago" },
  { value: "6-weeks", label: "6 Weeks Ago" },
  { value: "7-weeks", label: "7 Weeks Ago" },
  { value: "last-30", label: "Last 30 Days" },
  { value: "custom", label: "Custom Date Range" },
] as const;

export type PeriodKey = (typeof PERIOD_OPTIONS)[number]["value"];
export interface PeriodSelection {
  key: PeriodKey;
  customFrom?: string;
  customTo?: string;
}
export interface PeriodWindow {
  key: PeriodKey;
  label: string;
  from: string;
  to: string;
  scheduledFrom: string;
  scheduledTo: string;
  previousFrom: string;
  previousTo: string;
  days: number;
  previousDays: number;
  partial: boolean;
  partialLabel: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function isPeriodKey(value: string): value is PeriodKey {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}
function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const date = parseDate(value);
  return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}
export function mondayOf(date: string) {
  const parsed = parseDate(date);
  return addDays(date, -((parsed.getDay() + 6) % 7));
}

/** Date-only reporting today in Asia/Manila, independent of the server location. */
export function manilaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function resolvePeriod(selection: PeriodSelection, today: string): PeriodWindow {
  let scheduledFrom: string;
  let scheduledTo: string;
  let to: string;
  let partial = false;
  let partialLabel: string | null = null;
  const label = PERIOD_OPTIONS.find((option) => option.value === selection.key)?.label ?? "This Week";

  if (selection.key === "custom") {
    scheduledFrom = selection.customFrom ?? "";
    scheduledTo = selection.customTo ?? "";
    if (!validDate(scheduledFrom) || !validDate(scheduledTo)) throw new Error("Choose a valid custom start and end date");
    if (scheduledFrom > scheduledTo) throw new Error("The custom start date must be on or before the end date");
    to = scheduledTo > today ? today : scheduledTo;
    if (to < scheduledFrom) throw new Error("The custom range must include today or an earlier date");
    partial = to !== scheduledTo;
    if (partial) partialLabel = `Partial custom period · future dates through ${scheduledTo} excluded`;
  } else if (selection.key === "last-30") {
    scheduledTo = today;
    scheduledFrom = addDays(today, -29);
    to = today;
  } else {
    const offset = selection.key === "this-week" ? 0 : selection.key === "last-week" ? 1 : Number(selection.key.split("-")[0]);
    scheduledFrom = addDays(mondayOf(today), -7 * offset);
    scheduledTo = addDays(scheduledFrom, 6);
    to = offset === 0 ? today : scheduledTo;
    partial = offset === 0 && to < scheduledTo;
    if (partial) partialLabel = `Partial current week · ${daysBetween(scheduledFrom, to) + 1} of 7 elapsed days`;
  }

  const days = daysBetween(scheduledFrom, to) + 1;
  const weekly = selection.key !== "custom" && selection.key !== "last-30";
  const previousFrom = addDays(scheduledFrom, weekly ? -7 : -days);
  const previousTo = addDays(to, weekly ? -7 : -days);
  return {
    key: selection.key, label, from: scheduledFrom, to, scheduledFrom, scheduledTo,
    previousFrom, previousTo, days, previousDays: days, partial, partialLabel,
  };
}

export function datesBetween(from: string, to: string) {
  const length = Math.max(0, daysBetween(from, to) + 1);
  return Array.from({ length }, (_, index) => addDays(from, index));
}

/** Monday–Sunday closing-stock buckets clipped to the global reporting period. */
export function reportingWeeks(period: PeriodWindow) {
  const firstMonday = mondayOf(period.from);
  const count = Math.floor(daysBetween(firstMonday, period.to) / 7) + 1;
  return Array.from({ length: count }, (_, index) => {
    const weekStart = addDays(firstMonday, index * 7);
    const scheduledTo = addDays(weekStart, 6);
    const from = weekStart < period.from ? period.from : weekStart;
    const to = scheduledTo > period.to ? period.to : scheduledTo;
    return {
      key: weekStart,
      label: count === 1 ? "Selected week" : `Week ${index + 1}`,
      from,
      to,
      partial: from !== weekStart || to !== scheduledTo,
    };
  });
}

/** JavaScript weekday numbering: Sunday=0, Monday=1, … Saturday=6. */
export function expectedOperatingDates(from: string, to: string, operatingDays: number[]) {
  const allowed = new Set(operatingDays);
  return datesBetween(from, to).filter((date) => allowed.has(parseDate(date).getDay()));
}

export function monthStart(date: string) {
  return `${date.slice(0, 7)}-01`;
}
export function addMonths(date: string, amount: number) {
  const parsed = parseDate(monthStart(date));
  parsed.setMonth(parsed.getMonth() + amount);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}
export function monthEnd(date: string) {
  return addDays(addMonths(date, 1), -1);
}
