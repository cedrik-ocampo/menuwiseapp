import { describe, expect, it } from "vitest";
import { expectedOperatingDates, manilaToday, resolvePeriod } from "./admin-periods";

describe("admin reporting periods", () => {
  it("uses a day-aligned Monday-to-Tuesday comparison for the current week", () => {
    const period = resolvePeriod({ key: "this-week" }, "2026-11-24");
    expect(period).toMatchObject({ from: "2026-11-23", to: "2026-11-24", previousFrom: "2026-11-16", previousTo: "2026-11-17", days: 2, partial: true });
  });

  it("compares a complete prior week with the preceding seven days", () => {
    const period = resolvePeriod({ key: "last-week" }, "2026-11-24");
    expect(period).toMatchObject({ from: "2026-11-16", to: "2026-11-22", previousFrom: "2026-11-09", previousTo: "2026-11-15", days: 7, partial: false });
  });

  it("compares Last 30 Days with the immediately preceding 30 days", () => {
    const period = resolvePeriod({ key: "last-30" }, "2026-11-24");
    expect(period).toMatchObject({ from: "2026-10-26", to: "2026-11-24", previousFrom: "2026-09-26", previousTo: "2026-10-25", days: 30 });
  });

  it("compares a custom range with an equal-duration preceding period", () => {
    const period = resolvePeriod({ key: "custom", customFrom: "2026-11-10", customTo: "2026-11-12" }, "2026-11-24");
    expect(period).toMatchObject({ from: "2026-11-10", to: "2026-11-12", previousFrom: "2026-11-07", previousTo: "2026-11-09", days: 3 });
  });

  it("marks future custom dates as excluded rather than treating them as zero activity", () => {
    const period = resolvePeriod({ key: "custom", customFrom: "2026-11-23", customTo: "2026-11-29" }, "2026-11-24");
    expect(period.to).toBe("2026-11-24");
    expect(period.partial).toBe(true);
    expect(period.partialLabel).toContain("future dates");
  });

  it("uses expected operating weekdays instead of every calendar day", () => {
    expect(expectedOperatingDates("2026-11-23", "2026-11-29", [1, 3, 5])).toEqual(["2026-11-23", "2026-11-25", "2026-11-27"]);
  });

  it("uses the Manila calendar date near UTC midnight", () => {
    expect(manilaToday(new Date("2026-11-24T16:30:00.000Z"))).toBe("2026-11-25");
  });
});
