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
