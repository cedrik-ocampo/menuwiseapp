import { describe, expect, it } from "vitest";
import { validateRecipeDraft } from "@/lib/menu-costing";

const ings = [{ id: "A", unit: "g" }, { id: "B", unit: "ml" }];
describe("validateRecipeDraft", () => {
  it("accepts a valid recipe with converted units", () => {
    expect(validateRecipeDraft([{ ingredientId: "A", quantity: 0.5, unit: "kg" }, { ingredientId: "B", quantity: 10, unit: "ml" }], ings)).toEqual([]);
  });
  it("rejects blank ingredient", () => expect(validateRecipeDraft([{ ingredientId: "", quantity: 1, unit: "g" }], ings)).toHaveLength(1));
  it("rejects zero amount", () => expect(validateRecipeDraft([{ ingredientId: "A", quantity: 0, unit: "g" }], ings)).toHaveLength(1));
  it("rejects duplicate ingredient", () => expect(validateRecipeDraft([{ ingredientId: "A", quantity: 1, unit: "g" }, { ingredientId: "A", quantity: 2, unit: "g" }], ings)).toHaveLength(1));
  it("rejects incompatible unit", () => expect(validateRecipeDraft([{ ingredientId: "A", quantity: 1, unit: "ml" }], ings)).toHaveLength(1));
});
