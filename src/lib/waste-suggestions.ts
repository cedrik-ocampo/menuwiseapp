import type { Ingredient, MenuItem, WasteLog } from "./types";

export const normName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export interface WasteSuggestion { name: string; kind: "Menu item" | "Ingredient" | "Previously logged"; id?: string; unit?: string; unitCost?: number }

interface DBLike { ingredients: Ingredient[]; menuItems: MenuItem[]; wasteLogs: WasteLog[] }

/** Latest custom (free-text) waste entry per normalized name. */
export function customHistory(logs: WasteLog[]): Map<string, WasteLog> {
  const out = new Map<string, WasteLog>();
  for (const w of [...logs].sort((a, b) => a.at.localeCompare(b.at))) {
    if (w.customName && !w.ingredientId && !w.menuItemId) out.set(normName(w.customName), w);
  }
  return out;
}

/** Suggestions for the waste item box: catalog for the stage, then previously typed custom names not in the catalog. */
export function wasteSuggestions(db: DBLike, stage: "Ingredient" | "WIP" | "Finished Product"): WasteSuggestion[] {
  const catalog: WasteSuggestion[] = stage === "Ingredient"
    ? db.ingredients.map((i) => ({ name: i.name, kind: "Ingredient" as const, id: i.id }))
    : db.menuItems.map((m) => ({ name: m.name, kind: "Menu item" as const, id: m.id }));
  const known = new Set(catalog.map((c) => normName(c.name)));
  const custom = [...customHistory(db.wasteLogs.filter((w) => w.stage === stage)).values()]
    .filter((w) => !known.has(normName(w.customName!)))
    .map((w) => ({ name: w.customName!.trim(), kind: "Previously logged" as const, unit: w.unit, unitCost: w.unitCost }));
  return [...catalog, ...custom];
}

/** Resolve typed text to a catalog link or a custom suggestion (case/space-insensitive). */
export function resolveWasteName(text: string, suggestions: WasteSuggestion[]): WasteSuggestion | undefined {
  const n = normName(text);
  return n ? suggestions.find((s) => normName(s.name) === n) : undefined;
}

export function wasteItemLabel(w: WasteLog, db: { ingredients: Ingredient[]; menuItems: MenuItem[] }): string {
  if (w.ingredientId) return db.ingredients.find((i) => i.id === w.ingredientId)?.name ?? w.ingredientId;
  if (w.menuItemId) return db.menuItems.find((m) => m.id === w.menuItemId)?.name ?? w.menuItemId;
  return w.customName ?? "Unlinked";
}
