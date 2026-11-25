import { describe, expect, it } from "vitest";
import { summarizeCafe } from "@/lib/admin-privacy";

const today = "2026-11-25";
const input = {
  ingredients: [{ id: "ing-1", name: "Test ingredient", category: "Dry goods", storage: "Shelf", unit: "pc", unitCost: 1 }],
  purchases: [
    { id: "purchase-opening", ingredientId: "ing-1", purchaseDate: "2026-09-01", expiryDate: "2027-09-01", quantity: 100, remaining: 15, unitCost: 1 },
    { id: "purchase-week-2", ingredientId: "ing-1", purchaseDate: "2026-11-09", expiryDate: "2027-09-01", quantity: 50, remaining: 0, unitCost: 1 },
  ],
  usages: [
    { id: "usage-week-2", ingredientId: "ing-1", date: "2026-11-10", quantity: 10 },
    { id: "usage-week-3", ingredientId: "ing-1", date: "2026-11-16", quantity: 20 },
    { id: "usage-current", ingredientId: "ing-1", date: "2026-11-23", quantity: 5 },
  ],
};
const configuration = { operatingDays: [0, 1, 2, 3, 4, 5, 6], researchConsent: false };
const closing = (key: "this-week" | "last-week" | "2-weeks" | "last-30" | "custom", customFrom?: string, customTo?: string) =>
  summarizeCafe(input, { key, ...(customFrom ? { customFrom } : {}), ...(customTo ? { customTo } : {}) }, today, configuration).inventory.closing;

describe("admin closing stock reporting period", () => {
  it("shows only the current week, clipped through the Manila reporting date", () => {
    const result = closing("this-week");
    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ from: "2026-11-23", to: "2026-11-25", partial: true });
    expect(result.weeks[0]?.values["ingredient-count"]).toBe(115);
  });

  it("shows only the selected historical week and its closing quantity", () => {
    const result = closing("last-week");
    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ from: "2026-11-16", to: "2026-11-22", partial: false });
    expect(result.weeks[0]?.values["ingredient-count"]).toBe(120);
  });

  it("recalculates the quantity for an earlier selected week", () => {
    const result = closing("2-weeks");
    expect(result.weeks).toHaveLength(1);
    expect(result.weeks[0]).toMatchObject({ from: "2026-11-09", to: "2026-11-15", partial: false });
    expect(result.weeks[0]?.values["ingredient-count"]).toBe(140);
  });

  it("breaks Last 30 Days into reporting weeks without leaving the selected dates", () => {
    const result = closing("last-30");
    expect(result.weeks.map((week) => [week.from, week.to, week.values["ingredient-count"]])).toEqual([
      ["2026-10-27", "2026-11-01", 100],
      ["2026-11-02", "2026-11-08", 100],
      ["2026-11-09", "2026-11-15", 140],
      ["2026-11-16", "2026-11-22", 120],
      ["2026-11-23", "2026-11-25", 115],
    ]);
    expect(result.weeks.map((week) => week.partial)).toEqual([true, false, false, false, true]);
  });

  it("clips custom-range weeks at both ends of the range", () => {
    const result = closing("custom", "2026-11-10", "2026-11-18");
    expect(result.weeks.map((week) => [week.from, week.to, week.values["ingredient-count"]])).toEqual([
      ["2026-11-10", "2026-11-15", 140],
      ["2026-11-16", "2026-11-18", 120],
    ]);
    expect(result.weeks.every((week) => week.partial)).toBe(true);
  });
});
