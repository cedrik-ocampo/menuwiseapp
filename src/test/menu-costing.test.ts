import { describe, expect, it } from "vitest";
import { compatibleRecipeUnits, ingredientAmountCost, itemTypeFromLabel } from "@/lib/menu-costing";

describe("menu item recipe costing", () => {
  it("converts recipe amounts into the ingredient inventory unit", () => {
    expect(ingredientAmountCost({ unit: "kg", unitCost: 100 }, 500, "g")).toBe(50);
    expect(ingredientAmountCost({ unit: "L", unitCost: 80 }, 250, "ml")).toBe(20);
    expect(ingredientAmountCost({ unit: "pc", unitCost: 12 }, 2, "pc")).toBe(24);
  });

  it("rejects incompatible units", () => {
    expect(ingredientAmountCost({ unit: "kg", unitCost: 100 }, 2, "ml")).toBeNaN();
    expect(compatibleRecipeUnits("kg")).toEqual(["g", "kg"]);
    expect(compatibleRecipeUnits("L")).toEqual(["ml", "L"]);
  });

  it("maps owner-facing item type labels to existing saved values", () => {
    expect(itemTypeFromLabel("Individual item")).toBe("Made-to-order");
    expect(itemTypeFromLabel("Batch-made item")).toBe("In-house");
    expect(itemTypeFromLabel("Outsourced item")).toBe("Outsourced");
  });
});