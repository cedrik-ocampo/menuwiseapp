
import { parseIngredientRows as _pir } from "./import-parsers";
import { test as _t, expect as _e } from "vitest";
_t("ingredient import without expiry defaults to 30 days after purchase", () => {
  const db = { ingredients: [], purchases: [], menuItems: [] } as never;
  const [r] = _pir([{ __line: "2", ingredientname: "Cups 16oz", unit: "pc", quantity: "100", unitcost: "5", purchasedate: "2026-11-11", category: "Dairy" } as never], db);
  _e(r.error).toBeUndefined();
  _e(r.item?.purchase.expiryDate).toBe("2026-12-11");
});

import { test as _t2, expect as _x2 } from "vitest";
_t2("packaging with blank expiry is non-perishable", () => {
  const db = { ingredients: [], purchases: [], menuItems: [], batches: [], usages: [], sales: [], wasteLogs: [] } as any;
  const [r] = _pir([{ ingredientname: "Kraft Bag", category: "Packaging", unit: "pc", quantity: "10", unitcost: "2", purchasedate: "2026-11-09", expirydate: "" }], db);
  _x2(r?.error).toBeFalsy();
  _x2(r?.item?.purchase.expiryDate).toBe("");
  const [m] = _pir([{ ingredientname: "Milk", category: "Dairy", unit: "ml", quantity: "10", unitcost: "2", purchasedate: "2026-11-09", expirydate: "" }], db);
  _x2(m?.item?.purchase.expiryDate).toBe("2026-12-09");
  const [n] = _pir([{ ingredientname: "Salt", category: "Dry goods", unit: "g", quantity: "10", unitcost: "2", purchasedate: "2026-11-09", expirydate: "N/A" }], db);
  _x2(n?.item?.purchase.expiryDate).toBe("");
});
