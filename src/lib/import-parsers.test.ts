
import { parseIngredientRows as _pir } from "./import-parsers";
import { test as _t, expect as _e } from "vitest";
_t("ingredient import without expiry defaults to 30 days after purchase", () => {
  const db = { ingredients: [], purchases: [], menuItems: [] } as never;
  const [r] = _pir([{ __line: "2", ingredientname: "Cups 16oz", unit: "pc", quantity: "100", unitcost: "5", purchasedate: "2026-11-11", category: "Packaging" } as never], db);
  _e(r.error).toBeUndefined();
  _e(r.item?.purchase.expiryDate).toBe("2026-12-11");
});
