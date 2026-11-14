import { describe, expect, it } from "vitest";
import { summarizeCafe } from "./admin-privacy";
import type { CafeRecordInput } from "./admin-privacy";

const records: CafeRecordInput = {
  menuItems: [
    { id: "m1", name: "Latte", category: "Coffee", type: "In-house", retailPrice: 100, recipe: [{ ingredientId: "i1", quantity: 1, unit: "ml", allocation: "Direct" }] },
    { id: "m2", name: "Cookie", category: "Pastry", type: "Outsourced", retailPrice: 80, recipe: [] },
  ] as CafeRecordInput["menuItems"],
  ingredients: [{ id: "i1", name: "Milk", unit: "ml", unitCost: 0.25 }, { id: "i2", name: "Mystery", unit: "g", unitCost: 0 }] as CafeRecordInput["ingredients"],
  sales: [
    { id: "s1", menuItemId: "m1", date: "2026-11-14", quantity: 4, unitPrice: 100 },
    { id: "s2", menuItemId: "m2", date: "2026-11-14", quantity: 6, unitPrice: 100 },
    { id: "s3", menuItemId: "m1", date: "2026-11-07", quantity: 5, unitPrice: 100 },
  ],
  batches: [{ id: "b1", menuItemId: "m1", producedAt: "2026-11-14", quantity: 20, expiryDate: "2026-11-15" }],
  wasteLogs: [
    { id: "w1", at: "2026-11-14", stage: "Finished Product", menuItemId: "m1", wasteType: "Unsold", quantity: 3, unit: "piece", unitCost: 10, value: 30, allocation: "Direct" },
    { id: "w2", at: "2026-11-13", stage: "WIP", menuItemId: "m1", wasteType: "Prep Error", quantity: 2, unit: "piece", unitCost: 10, value: 20, allocation: "Direct" },
    { id: "w3", at: "2026-10-10", stage: "Ingredient", ingredientId: "i1", wasteType: "Spoilage", quantity: 1, unit: "ml", unitCost: 25, value: 25, allocation: "Direct" },
  ],
};

describe("privacy-safe café summaries", () => {
  it("computes waste ratio and month-over-month waste trend without returning either peso total", () => {
    const result = summarizeCafe(records, "2026-11-14");
    expect(result.waste.ratioPct).toBe(3.3);
    expect(result.waste.trendPct).toBe(100);
    expect(result.waste).not.toHaveProperty("value");
    expect(result.waste).not.toHaveProperty("revenue");
  });

  it("compares this week's unit volume with the same weekdays last week", () => {
    const result = summarizeCafe(records, "2026-11-14");
    expect(result.sales.unitsThisWeek).toBe(10);
    expect(result.sales.volumeTrendPct).toBe(100);
    expect(result.sales.weekly.at(-1)?.units).toBe(10);
  });

  it("returns stage percentages and incident counts, not wasted quantities or values", () => {
    const result = summarizeCafe(records, "2026-11-14");
    expect(result.waste.stageShares).toEqual({ Ingredient: 0, WIP: 40, "Finished Product": 60 });
    expect(result.waste.reasons).toEqual([{ reason: "Prep Error", count: 1 }, { reason: "Unsold", count: 1 }]);
    expect(result.waste.incidents30).toBe(2);
  });

  it("exposes catalog readiness while redacting every item price and ingredient cost", () => {
    const result = summarizeCafe(records, "2026-11-14");
    expect(result.catalog).toEqual({ menuItems: 2, recipeReady: 2, ingredients: 2, pricedIngredients: 1, productionBatches: 1 });
    expect(result.menuItems[0]).toEqual({ id: "m1", name: "Latte", category: "Coffee", type: "In-house", recipeStatus: "Recipe linked" });
    expect(result.menuItems[0]).not.toHaveProperty("retailPrice");
    expect(result.menuItems[0]).not.toHaveProperty("recipe");
    expect(result.ingredients[0]).toEqual({ id: "i1", name: "Milk", unit: "ml", costStatus: "Priced" });
    expect(result.ingredients[0]).not.toHaveProperty("unitCost");
  });

  it("uses null for unavailable ratios and trends instead of infinity", () => {
    const result = summarizeCafe({}, "2026-11-14");
    expect(result.waste.ratioPct).toBeNull();
    expect(result.waste.trendPct).toBeNull();
    expect(result.sales.volumeTrendPct).toBeNull();
    expect(result.logging.activeDays30).toBe(0);
  });
});
