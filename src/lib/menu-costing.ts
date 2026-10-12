import type { Ingredient, ItemType } from "./types";

export const RECIPE_UNITS = ["g", "kg", "ml", "L", "pc", "pack", "box"] as const;

const GROUPS: Record<string, Record<string, number>> = {
  mass: { g: 1, kg: 1000 },
  volume: { ml: 1, L: 1000 },
  count: { pc: 1 },
  pack: { pack: 1 },
  box: { box: 1 },
};

function groupOf(unit: string) {
  return Object.values(GROUPS).find((group) => unit in group);
}

export function compatibleRecipeUnits(ingredientUnit?: string) {
  if (!ingredientUnit) return [...RECIPE_UNITS];
  const group = groupOf(ingredientUnit);
  return group ? RECIPE_UNITS.filter((unit) => unit in group) : [ingredientUnit];
}

export function ingredientAmountCost(ingredient: Pick<Ingredient, "unit" | "unitCost"> | undefined, amount: number, recipeUnit: string) {
  if (!ingredient || !Number.isFinite(amount) || amount < 0) return 0;
  if (recipeUnit === ingredient.unit) return amount * ingredient.unitCost;
  const group = groupOf(ingredient.unit);
  if (!group || !(recipeUnit in group)) return Number.NaN;
  const amountInBase = amount * group[recipeUnit];
  const ingredientUnitInBase = group[ingredient.unit];
  return (amountInBase / ingredientUnitInBase) * ingredient.unitCost;
}

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  "Made-to-order": "Individual item",
  "In-house": "Batch-made item",
  Outsourced: "Outsourced item",
};

export function itemTypeFromLabel(value: string): ItemType | null {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  const match = (Object.entries(ITEM_TYPE_LABELS) as [ItemType, string][]).find(
    ([type, label]) => [type, label].some((candidate) => candidate.toLowerCase().replace(/[^a-z]/g, "") === normalized),
  );
  if (match) return match[0];
  if (normalized.includes("individual") || normalized.includes("order")) return "Made-to-order";
  if (normalized.includes("batch") || normalized.includes("house")) return "In-house";
  if (normalized.includes("outsource")) return "Outsourced";
  return null;
}