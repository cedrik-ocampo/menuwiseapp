import { getView, put, canManageInventory } from "./store";
import type { MenuItem } from "./types";

const GROUPS: Record<string, number>[] = [{ g: 1, kg: 1000 }, { ml: 1, L: 1000 }];

/** Converts a recipe amount into the ingredient's saved unit; NaN when incompatible. */
function toIngredientUnit(amount: number, from: string, to: string) {
  if (from === to) return amount;
  const g = GROUPS.find((x) => from in x && to in x);
  return g ? (amount * g[from]) / g[to] : Number.NaN;
}

/**
 * Deducts recipe ingredients for a produced batch (soonest-expiring lots first)
 * and records a usage entry per ingredient so "Last used" updates.
 */
export function consumeForProduction(menu: MenuItem, piecesMade: number, date: string, batchId: string) {
  // Employee inventory effects are calculated by Cloud, never accepted as direct stock edits.
  if (!canManageInventory()) return;
  if (menu.type === "Outsourced" || !menu.recipe?.length || !(piecesMade > 0)) return;
  const factor = piecesMade / (menu.type === "In-house" ? menu.yield || 1 : 1);
  const db = getView();
  menu.recipe.forEach((line, i) => {
    const ing = db.ingredients.find((x) => x.id === line.ingredientId);
    if (!ing) return;
    const need = +toIngredientUnit(line.quantity * factor, line.unit, ing.unit).toFixed(3);
    if (!(need > 0)) return;
    let left = need;
    for (const lot of db.purchases.filter((p) => p.ingredientId === ing.id && p.remaining > 0).sort((a, b) => (a.expiryDate || "9999-12-31").localeCompare(b.expiryDate || "9999-12-31"))) {
      if (left <= 0) break;
      const take = Math.min(lot.remaining, left);
      put("purchases", { ...lot, remaining: +(lot.remaining - take).toFixed(3) });
      left -= take;
    }
    put("usages", { id: `U-${batchId}-${i}`, ingredientId: ing.id, date, quantity: need, menuItemId: menu.id });
  });
}
