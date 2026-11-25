import { describe, expect, it } from "vitest";
import { pseudonym, summarizeCafe, type CafeRecordInput } from "./admin-privacy";
import type { DailyCheck, Ingredient, MenuItem, Sale, WasteLog } from "./types";

const items = [
  { id: "m1", name: "Latte", category: "Coffee", type: "Outsourced", retailPrice: 100, purchaseCost: 40, unit: "pc", batchUnit: "pc", recipe: [] },
  { id: "m2", name: "Cookie", category: "Pastry", type: "Outsourced", retailPrice: 80, purchaseCost: 30, unit: "pc", batchUnit: "pc", recipe: [] },
] as unknown as MenuItem[];
const sale = (id: string, date: string, quantity: number, menuItemId = "m1"): Sale => ({ id, date, quantity, menuItemId, unitPrice: menuItemId === "m1" ? 100 : 80 });
const waste = (id: string, at: string, value = 30, reason: WasteLog["wasteType"] = "Unsold"): WasteLog => ({ id, at: `${at}T08:00:00+08:00`, stage: "Finished Product", menuItemId: "m1", wasteType: reason, quantity: 1, unit: "pc", unitCost: value, value, allocation: "Direct" });
const check = (date: string): DailyCheck => ({ id: `DC-${date}`, date, noWaste: true, closeout: true });

const records: CafeRecordInput = {
  menuItems: items,
  ingredients: [{ id: "i1", name: "Milk", category: "Dairy", unit: "ml", unitCost: 0.25 }] as Ingredient[],
  sales: [sale("s1", "2026-11-23", 4), sale("s2", "2026-11-24", 6), sale("s3", "2026-11-16", 2), sale("s4", "2026-11-17", 3)],
  batches: [
    { id: "b1", menuItemId: "m1", producedAt: "2026-11-23T08:00:00+08:00", quantity: 20, expiryDate: "2026-11-25" },
    { id: "b2", menuItemId: "m1", producedAt: "2026-11-24T08:00:00+08:00", quantity: 20, expiryDate: "2026-11-26" },
  ],
  wasteLogs: [waste("w1", "2026-11-23"), waste("w2", "2026-11-23"), waste("w3", "2026-11-23"), waste("p1", "2026-11-16", 10), waste("p2", "2026-11-16", 10), waste("p3", "2026-11-16", 10)],
  dailyChecks: [check("2026-11-24")],
};
const config = { operatingDays: [1, 2, 3, 4, 5], researchConsent: true };
const summarize = (input: CafeRecordInput = records, researchConsent = true) => summarizeCafe(input, { key: "this-week" }, "2026-11-24", { ...config, researchConsent });

describe("privacy-safe admin analytics", () => {
  it("computes current and equivalent previous waste ratios without returning peso totals", () => {
    const result = summarize();
    expect(result.kpis.wasteToSales.current).toBe(9);
    expect(result.kpis.wasteToSales.previous).toBe(6);
    expect(result.kpis.wasteToSales.difference).toBe(3);
    expect(result.kpis.wasteToSales.changeUnit).toBe("percentage-points");
    expect(result.kpis.wasteToSales.status).toBe("Increased");
    expect(result.kpis).not.toHaveProperty("revenue");
    expect(result.waste).not.toHaveProperty("value");
  });

  it("returns sales volume and percentage change but never revenue", () => {
    const result = summarize();
    expect(result.kpis.salesVolume.current).toBe(10);
    expect(result.kpis.salesVolume.previous).toBe(5);
    expect(result.kpis.salesVolume.difference).toBe(5);
    expect(result.kpis.salesVolume.changePct).toBe(100);
    expect(result.kpis.salesVolume.status).toBe("Increased");
  });

  it("counts a waste-free day only after explicit confirmation", () => {
    const confirmed = summarize();
    expect(confirmed.kpis.logging.days.waste).toBe(2);
    expect(confirmed.kpis.logging.waste.current).toBe(100);
    expect(confirmed.kpis.logging.overall.current).toBe(100);
    const unconfirmed = summarize({ ...records, dailyChecks: [] });
    expect(unconfirmed.kpis.logging.days.waste).toBe(1);
    expect(unconfirmed.kpis.logging.waste.current).toBe(50);
    expect(unconfirmed.kpis.logging.overall.current).toBe(50);
  });

  it("suppresses breakdown groups with fewer than three records", () => {
    const result = summarize({ ...records, wasteLogs: records.wasteLogs?.slice(0, 2) });
    expect(result.waste.stages.shares).toEqual([]);
    expect(result.waste.stages.suppressedGroups).toBe(1);
  });

  it("uses actual waste reasons and calculated value shares", () => {
    const result = summarize({ ...records, wasteLogs: [
      waste("e1", "2026-11-23", 10, "Expiry"), waste("e2", "2026-11-23", 10, "Expiry"), waste("e3", "2026-11-23", 10, "Expiry"),
      waste("u1", "2026-11-23", 30, "Unsold"), waste("u2", "2026-11-23", 30, "Unsold"), waste("u3", "2026-11-23", 30, "Unsold"),
    ] });
    expect(result.waste.reasons.shares).toEqual([
      { key: "Unsold at Closing", label: "Unsold at Closing", sharePct: 75, records: 3 },
      { key: "Expired / Past Sell-by Date", label: "Expired / Past Sell-by Date", sharePct: 25, records: 3 },
    ]);
    expect(result.waste.reasons.suppressedGroups).toBe(0);
  });

  it("keeps mass and volume flows separate and reconciles current ingredient lots", () => {
    const input: CafeRecordInput = {
      ingredients: [
        { id: "milk", name: "Fresh Milk", unit: "ml", unitCost: 1 },
        { id: "flour", name: "Bread Flour", unit: "kg", unitCost: 100 },
      ] as Ingredient[],
      purchases: [
        { id: "p1", ingredientId: "milk", purchaseDate: "2026-11-23", expiryDate: "", quantity: 1000, remaining: 900, unitCost: 1 },
        { id: "p2", ingredientId: "flour", purchaseDate: "2026-11-23", expiryDate: "", quantity: 2, remaining: 1.5, unitCost: 100 },
      ],
      usages: [
        { id: "u1", ingredientId: "milk", date: "2026-11-23", quantity: 100 },
        { id: "u2", ingredientId: "flour", date: "2026-11-23", quantity: 0.5 },
      ],
    };
    const result = summarize(input);
    expect(result.waste.rates.map((row) => row.key).sort()).toEqual(["ingredient-mass", "ingredient-volume"]);
    expect(result.inventory.reconciliation).toMatchObject({ percentage: 100, eligible: 2, balanced: 2, discrepancies: 0, available: true });
  });

  it("marks missing ratios and classification as insufficient instead of zero", () => {
    const result = summarize({});
    expect(result.kpis.wasteToSales.current).toBeNull();
    expect(result.kpis.salesVolume.current).toBeNull();
    expect(result.kpis.reconciliation.current).toBeNull();
    expect(result.menuMap.sufficient).toBe(false);
    expect(result.quality.completeness.percentage).toBeNull();
  });

  it("counts exact duplicates and invalid references without double-counting sync IDs", () => {
    const result = summarize({ menuItems: items, sales: [sale("a", "2026-11-23", 2), sale("b", "2026-11-23", 2), sale("c", "2026-11-23", 1, "missing")] });
    expect(result.quality.duplicates.count).toBe(1);
    expect(result.quality.invalidReferences).toBe(1);
  });

  it("honors the owner's research opt-out while retaining operational monitoring", () => {
    const enabled = summarize(records, true);
    const disabled = summarize(records, false);
    expect(enabled.research.allowed).toBe(true);
    expect(enabled.research.findings.length).toBeGreaterThan(0);
    expect(disabled.research.allowed).toBe(false);
    expect(disabled.research.findings).toEqual([]);
    expect(disabled.kpis.salesVolume.current).toBe(10);
  });

  it("redacts names, recipes, prices, costs and individual transactions", () => {
    const result = summarize();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/Latte|Cookie|Fresh Milk/);
    expect(serialized).not.toMatch(/unitPrice|retailPrice|purchaseCost|unitCost|recipe\"|revenue/);
    expect(result.menuItems[0]).toEqual({ id: pseudonym("item", "m1"), category: "Coffee", type: "Outsourced", recipeStatus: "Outsourced" });
  });
});
