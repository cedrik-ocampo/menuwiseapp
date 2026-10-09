import { describe, expect, it } from "vitest";
import { weeklyRevenue } from "@/lib/calc";

describe("weeklyRevenue", () => {
  // 2026-10-07 is a Wednesday
  const sales = [
    { date: "2026-10-05", r: 100 }, // Mon this week
    { date: "2026-10-07", r: 50 },  // today
    { date: "2026-10-08", r: 999 }, // future → ignored
    { date: "2026-10-04", r: 30 },  // Sun last week
    { date: "2026-09-28", r: 20 },  // Mon last week
  ];
  const w = weeklyRevenue(sales, (s) => s.r, "2026-10-07");
  it("buckets Monday–Sunday, newest first", () => {
    expect(w).toHaveLength(8);
    expect(w[0]).toMatchObject({ label: "This Week", start: "2026-10-05", end: "2026-10-07", revenue: 150, current: true });
    expect(w[1]).toMatchObject({ start: "2026-09-28", end: "2026-10-04", revenue: 50 });
    expect(w[2].revenue).toBe(0);
  });
});

import { compareWeeks, weekWindows } from "@/lib/calc";
describe("week comparison", () => {
  it("has 8 unique week keys", () => {
    const w = weeklyRevenue([], () => 0, "2026-10-07");
    expect(new Set(w.map((x) => x.key)).size).toBe(8);
  });
  it("aligns This Week by weekday", () => {
    expect(weekWindows(0, "2026-10-07")).toEqual({ cur: { from: "2026-10-05", to: "2026-10-07" }, prev: { from: "2026-09-28", to: "2026-09-30" } });
  });
  it("compares full weeks otherwise, incl. 7 Weeks Ago vs 8", () => {
    expect(weekWindows(7, "2026-10-07").prev).toEqual({ from: "2026-08-10", to: "2026-08-16" });
  });
  it("handles zero baselines", () => {
    const sales = [{ date: "2026-09-29", r: 100 }];
    const tot = (f: string, t: string) => sales.filter((s) => s.date >= f && s.date <= t).reduce((a, s) => a + s.r, 0);
    expect(compareWeeks(tot, 0, "2026-10-07").pct).toBe(-100);
    expect(compareWeeks(tot, 1, "2026-10-07").pct).toBeNull();
  });
});
