import { getView, remove } from "./store";

/** Removes an ingredient plus its purchases, usages and ingredient-stage waste logs. */
export function deleteIngredient(id: string) {
  const db = getView();
  db.purchases.filter((p) => p.ingredientId === id).forEach((p) => remove("purchases", p.id));
  db.usages.filter((u) => u.ingredientId === id).forEach((u) => remove("usages", u.id));
  db.wasteLogs.filter((w) => w.ingredientId === id && !w.menuItemId).forEach((w) => remove("wasteLogs", w.id));
  remove("ingredients", id);
}

/** Removes a menu item plus its batches, sales and linked waste logs. */
export function deleteMenuItem(id: string) {
  const db = getView();
  db.batches.filter((b) => b.menuItemId === id).forEach((b) => remove("batches", b.id));
  db.sales.filter((s) => s.menuItemId === id).forEach((s) => remove("sales", s.id));
  db.wasteLogs.filter((w) => w.menuItemId === id).forEach((w) => remove("wasteLogs", w.id));
  remove("menuItems", id);
}
