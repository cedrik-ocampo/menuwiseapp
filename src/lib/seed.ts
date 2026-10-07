import type { Batch, Collections, Ingredient, MenuItem, Purchase, Sale, Usage, WasteLog } from "./types";
import { addDays, todayISO } from "./format";

type Seed = { [K in keyof Collections]: Collections[K][] };

let s = 7;
const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);

export function buildSeed(): Seed {
  s = 7;
  const t = todayISO();
  const at = (dayOffset: number, h: number) => {
    const d = new Date(addDays(t, dayOffset) + "T00:00:00");
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  const ingredients: Ingredient[] = [
    { id: "ING-001", name: "Fresh milk", category: "Dairy", storage: "Refrigerated", unit: "L", unitCost: 85 },
    { id: "ING-002", name: "Whipping cream", category: "Dairy", storage: "Refrigerated", unit: "L", unitCost: 240 },
    { id: "ING-003", name: "Eggs", category: "Dairy", storage: "Refrigerated", unit: "pc", unitCost: 8 },
    { id: "ING-004", name: "Strawberries", category: "Produce", storage: "Refrigerated", unit: "kg", unitCost: 350 },
    { id: "ING-005", name: "Butter", category: "Dairy", storage: "Refrigerated", unit: "kg", unitCost: 450 },
    { id: "ING-006", name: "Dark chocolate", category: "Dry goods", storage: "Pantry", unit: "kg", unitCost: 520 },
    { id: "ING-007", name: "Bread flour", category: "Dry goods", storage: "Pantry", unit: "kg", unitCost: 65 },
    { id: "ING-008", name: "White sugar", category: "Dry goods", storage: "Pantry", unit: "kg", unitCost: 75 },
  ];
  // [ingredientId, purchase offsets (oldest..newest), current qty, expiry offset of newest lot, lot size]
  const lots: [string, number[], number, number, number][] = [
    ["ING-001", [-34, -24, -14, -4], 4, 0, 10],
    ["ING-002", [-30, -17, -3], 1, 1, 3],
    ["ING-003", [-26, -12, -5], 24, 2, 60],
    ["ING-004", [-20, -9, -3], 1.5, 3, 4],
    ["ING-005", [-38, -22, -8], 3, 9, 6],
    ["ING-006", [-45, -8], 2, 40, 4],
    ["ING-007", [-40, -25, -5], 12, 56, 25],
    ["ING-008", [-50, -8], 6, 86, 10],
  ];
  const purchases: Purchase[] = [];
  const usages: Usage[] = [];
  lots.forEach(([ing, offs, qty, exp, size]) => {
    const unitCost = ingredients.find((i) => i.id === ing)!.unitCost;
    offs.forEach((o, i) => {
      const newest = i === offs.length - 1;
      purchases.push({
        id: `${ing}-P${i + 1}`,
        ingredientId: ing,
        purchaseDate: addDays(t, o),
        expiryDate: newest ? addDays(t, exp) : addDays(t, o + (exp - offs[offs.length - 1]) + 1),
        quantity: size,
        remaining: newest ? qty : 0,
        unitCost,
      });
    });
    for (let d = -28; d <= -1; d += 2) {
      usages.push({ id: `${ing}-U${-d}`, ingredientId: ing, date: addDays(t, d), quantity: +(size / 8 * (0.6 + rnd() * 0.8)).toFixed(2) });
    }
  });

  const base = {
    available: true, tags: [], purchaseCost: 0, unit: "pieces", supplier: "", expiryRule: "Expires after shelf life",
    defaultExpiryDays: 2, defaultWasteStage: "Finished Product" as const, defaultWasteType: "Unsold" as const, allowQuickAdd: true,
    description: "",
  };
  const menuItems: MenuItem[] = [
    { ...base, id: "BC-001", name: "Butter Croissant", category: "Pastry", subcategory: "Viennoiserie", type: "In-house", batchCost: 1485, yield: 15, retailPrice: 150, shelfLifeDays: 2, defaultBatchSize: 15, batchUnit: "pieces",
      recipe: [{ ingredientId: "ING-007", quantity: 1, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-005", quantity: 0.6, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-001", quantity: 0.3, unit: "L", allocation: "Recipe-based" }, { ingredientId: "ING-008", quantity: 0.1, unit: "kg", allocation: "Recipe-based" }] },
    { ...base, id: "PC-002", name: "Pain au Chocolat", category: "Pastry", subcategory: "Viennoiserie", type: "In-house", batchCost: 1440, yield: 12, retailPrice: 165, shelfLifeDays: 2, defaultBatchSize: 12, batchUnit: "pieces",
      recipe: [{ ingredientId: "ING-007", quantity: 0.8, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-005", quantity: 0.5, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-006", quantity: 0.3, unit: "kg", allocation: "Recipe-based" }] },
    { ...base, id: "SBT-003", name: "Star Berry Tart", category: "Pastry", subcategory: "Tart", type: "In-house", batchCost: 1200, yield: 8, retailPrice: 210, shelfLifeDays: 2, defaultBatchSize: 8, batchUnit: "pieces",
      recipe: [{ ingredientId: "ING-004", quantity: 0.8, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-002", quantity: 0.5, unit: "L", allocation: "Recipe-based" }, { ingredientId: "ING-003", quantity: 6, unit: "pc", allocation: "Recipe-based" }, { ingredientId: "ING-007", quantity: 0.4, unit: "kg", allocation: "Recipe-based" }] },
    { ...base, id: "CB-004", name: "Custard Bun", category: "Pastry", subcategory: "Bread", type: "In-house", batchCost: 540, yield: 12, retailPrice: 85, shelfLifeDays: 2, defaultBatchSize: 12, batchUnit: "pieces",
      recipe: [{ ingredientId: "ING-007", quantity: 0.6, unit: "kg", allocation: "Recipe-based" }, { ingredientId: "ING-003", quantity: 6, unit: "pc", allocation: "Recipe-based" }, { ingredientId: "ING-001", quantity: 0.4, unit: "L", allocation: "Recipe-based" }] },
    { ...base, id: "CL-005", name: "Cafe Latte", category: "Drinks", subcategory: "Espresso", type: "Made-to-order", batchCost: 48, yield: 1, retailPrice: 160, shelfLifeDays: 0, defaultBatchSize: 1, batchUnit: "cups", unit: "cups", defaultExpiryDays: 0, defaultWasteType: "Spill",
      recipe: [{ ingredientId: "ING-001", quantity: 0.25, unit: "L", allocation: "Direct" }] },
    { ...base, id: "CP-006", name: "Cappuccino", category: "Drinks", subcategory: "Espresso", type: "Made-to-order", batchCost: 42, yield: 1, retailPrice: 150, shelfLifeDays: 0, defaultBatchSize: 1, batchUnit: "cups", unit: "cups", defaultExpiryDays: 0, defaultWasteType: "Spill",
      recipe: [{ ingredientId: "ING-001", quantity: 0.18, unit: "L", allocation: "Direct" }] },
    { ...base, id: "HC-007", name: "Hot Chocolate", category: "Drinks", subcategory: "Non-coffee", type: "Made-to-order", batchCost: 55, yield: 1, retailPrice: 140, shelfLifeDays: 0, defaultBatchSize: 1, batchUnit: "cups", unit: "cups", defaultExpiryDays: 0, defaultWasteType: "Spill",
      recipe: [{ ingredientId: "ING-001", quantity: 0.25, unit: "L", allocation: "Direct" }, { ingredientId: "ING-006", quantity: 0.03, unit: "kg", allocation: "Direct" }] },
    { ...base, id: "NYC-008", name: "NY Cheesecake Slice", category: "Pastry", subcategory: "Cake", type: "Outsourced", batchCost: 0, yield: 1, purchaseCost: 95, retailPrice: 180, supplier: "Sweet Layers Bakeshop", shelfLifeDays: 3, defaultBatchSize: 8, batchUnit: "slices", unit: "slices", recipe: [] },
  ];

  // production + sales per week for last 5 weeks
  const weekly: Record<string, [number, number]> = {
    "BC-001": [210, 180], "PC-002": [96, 88], "SBT-003": [40, 26], "CB-004": [60, 34],
    "CL-005": [260, 255], "CP-006": [180, 176], "HC-007": [50, 47], "NYC-008": [24, 15],
  };
  const batches: Batch[] = [];
  const sales: Sale[] = [];
  menuItems.forEach((m) => {
    const [prod, sold] = weekly[m.id];
    const perDay = prod / 7;
    for (let d = -34; d <= 0; d++) {
      const q = Math.max(1, Math.round(perDay * (0.75 + rnd() * 0.5)));
      if (m.type !== "Made-to-order" || d % 1 === 0) {
        batches.push({ id: `${m.id.split("-")[0]}-${1000 + 35 + d}`, menuItemId: m.id, producedAt: at(d, 7), quantity: q, expiryDate: addDays(t, d + m.shelfLifeDays) });
      }
      if (d < 0) sales.push({ id: `${m.id}-S${-d}`, menuItemId: m.id, date: addDays(t, d), quantity: Math.max(0, Math.round((sold / 7) * (0.8 + rnd() * 0.4))) });
    }
  });

  const unitCostOf = (id: string) => {
    const m = menuItems.find((x) => x.id === id)!;
    return m.type === "Outsourced" ? m.purchaseCost : m.batchCost / m.yield;
  };
  const w = (o: Partial<WasteLog> & Pick<WasteLog, "id" | "at" | "stage" | "wasteType" | "quantity" | "unit" | "unitCost">): WasteLog => ({
    allocation: "Direct", value: +(o.quantity * o.unitCost).toFixed(2), ...o,
  });
  const wasteLogs: WasteLog[] = [
    w({ id: "W-001", at: at(-4, 16), stage: "Ingredient", ingredientId: "ING-001", wasteType: "Spoilage", quantity: 0.35, unit: "L", unitCost: 85 }),
    w({ id: "W-002", at: at(-8, 15), stage: "Ingredient", ingredientId: "ING-001", wasteType: "Spill", quantity: 0.1, unit: "L", unitCost: 85 }),
    w({ id: "W-003", at: at(-14, 18), stage: "Ingredient", ingredientId: "ING-001", wasteType: "Expiry", quantity: 0.5, unit: "L", unitCost: 85 }),
    w({ id: "W-004", at: at(-6, 10), stage: "Ingredient", ingredientId: "ING-004", wasteType: "Spoilage", quantity: 0.4, unit: "kg", unitCost: 350 }),
    w({ id: "W-005", at: at(-2, 9), stage: "Ingredient", ingredientId: "ING-002", wasteType: "Expiry", quantity: 0.25, unit: "L", unitCost: 240 }),
    w({ id: "W-006", at: at(-1, 20), stage: "Finished Product", menuItemId: "BC-001", batchId: batches.find((b) => b.menuItemId === "BC-001" && b.producedAt.startsWith(addDays(t, -1)))?.id, wasteType: "Unsold", quantity: 1, unit: "pieces", unitCost: 99 }),
    w({ id: "W-007", at: at(-9, 18), stage: "Finished Product", menuItemId: "BC-001", wasteType: "Day-old", quantity: 2, unit: "pieces", unitCost: 99 }),
    w({ id: "W-008", at: at(-10, 15), stage: "Finished Product", menuItemId: "BC-001", wasteType: "Spill", quantity: 3, unit: "pieces", unitCost: 99 }),
    w({ id: "W-009", at: at(-8, 7), stage: "WIP", menuItemId: "BC-001", wasteType: "Prep Error", quantity: 1, unit: "batch", unitCost: 150, allocation: "Batch-linked" }),
    w({ id: "W-010", at: at(-12, 8), stage: "Ingredient", ingredientId: "ING-005", attributedMenuItemId: "BC-001", wasteType: "Spoilage", quantity: 0.1, unit: "kg", unitCost: 450, allocation: "Recipe-based" }),
    w({ id: "W-011", at: at(-3, 19), stage: "Finished Product", menuItemId: "SBT-003", wasteType: "Unsold", quantity: 5, unit: "pieces", unitCost: 150 }),
    w({ id: "W-012", at: at(-1, 19), stage: "Finished Product", menuItemId: "SBT-003", wasteType: "Day-old", quantity: 4, unit: "pieces", unitCost: 150 }),
    w({ id: "W-013", at: at(-2, 19), stage: "Finished Product", menuItemId: "CB-004", wasteType: "Unsold", quantity: 8, unit: "pieces", unitCost: 45 }),
    w({ id: "W-014", at: at(-5, 11), stage: "Finished Product", menuItemId: "CL-005", wasteType: "Spill", quantity: 2, unit: "cups", unitCost: 48 }),
    w({ id: "W-015", at: at(-3, 8), stage: "WIP", menuItemId: "CL-005", wasteType: "Prep Error", quantity: 3, unit: "shots", unitCost: 18, allocation: "Direct" }),
    w({ id: "W-016", at: at(-6, 19), stage: "Finished Product", menuItemId: "PC-002", wasteType: "Unsold", quantity: 3, unit: "pieces", unitCost: 120 }),
    w({ id: "W-017", at: at(-2, 18), stage: "Finished Product", menuItemId: "NYC-008", wasteType: "Expiry", quantity: 4, unit: "slices", unitCost: 95 }),
    w({ id: "W-018", at: at(0, 9), stage: "Finished Product", menuItemId: "BC-001", wasteType: "Day-old", quantity: 2, unit: "pieces", unitCost: 99 }),
    w({ id: "W-019", at: at(0, 8), stage: "Ingredient", ingredientId: "ING-003", wasteType: "Spoilage", quantity: 4, unit: "pc", unitCost: 8 }),
    w({ id: "W-020", at: at(-1, 12), stage: "Finished Product", menuItemId: "HC-007", wasteType: "Spill", quantity: 1, unit: "cups", unitCost: 55 }),
  ];

  return { ingredients, purchases, usages, menuItems, batches, sales, wasteLogs };
}
