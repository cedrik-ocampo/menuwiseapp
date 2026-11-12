import { describe, it, expect } from "vitest";
import { guessMapping, applyMapping, matchesTemplate } from "./column-mapper";

describe("column mapper", () => {
  it("guesses POS-style headers", () => {
    const m = guessMapping(["ingredientname", "quantity", "unitcost", "expirydate"], ["Item Name", "Qty", "Cost", "Expiration"]);
    expect(m.ingredientname.column).toBe("Item Name");
    expect(m.quantity.column).toBe("Qty");
    expect(m.unitcost.column).toBe("Cost");
    expect(m.expirydate.column).toBe("Expiration");
  });
  it("uses fixed values for blanks and cleans peso amounts", () => {
    const rows = applyMapping([{ __line: "2", "Item Name": "Milk", Cost: "₱1,250.50" }], { ingredientname: { column: "Item Name" }, unitcost: { column: "Cost" }, unit: { fixed: "L" } }, ["unitcost"]);
    expect(rows[0]).toMatchObject({ ingredientname: "Milk", unitcost: "1250.50", unit: "L" });
  });
  it("skips mapping when template headers already match", () => {
    expect(matchesTemplate(["ingredientname", "unit"], ["Ingredient_Name", "Unit"])).toBe(true);
    expect(matchesTemplate(["ingredientname", "unit"], ["Item", "Unit"])).toBe(false);
  });
});
