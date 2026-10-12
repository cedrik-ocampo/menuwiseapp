import type { CollectionName, Ingredient, MenuItem, Purchase, Usage, Batch, Sale, WasteLog, RecipeLine } from "./types";
import { clearCollections, putMany } from "./store";

const DATA_COLLECTIONS: CollectionName[] = ["ingredients", "purchases", "usages", "menuItems", "batches", "sales", "wasteLogs", "insightResponses"];

const day = (offset: number) => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Deterministic pseudo-random so the demo looks the same every load.
let seed = 42;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

const ING: [string, string, string, string, number, number][] = [
  // id, name, category, unit, unitCost, stock
  ["ING-001", "Espresso Beans", "Coffee", "g", 0.65, 4000],
  ["ING-002", "Whole Milk", "Dairy", "ml", 0.095, 12000],
  ["ING-003", "Oat Milk", "Dairy", "ml", 0.18, 4000],
  ["ING-004", "Condensed Milk", "Dairy", "ml", 0.12, 3000],
  ["ING-005", "Vanilla Syrup", "Syrups", "ml", 0.45, 1500],
  ["ING-006", "Caramel Sauce", "Syrups", "ml", 0.5, 1200],
  ["ING-007", "Matcha Powder", "Tea", "g", 3.2, 400],
  ["ING-008", "Herbal Citrus Tea", "Tea", "g", 2.5, 300],
  ["ING-009", "Bread Flour", "Dry Goods", "g", 0.06, 10000],
  ["ING-010", "Butter", "Dairy", "g", 0.55, 3000],
  ["ING-011", "Dark Chocolate", "Dry Goods", "g", 0.9, 1500],
  ["ING-012", "Heavy Cream", "Dairy", "ml", 0.28, 2000],
  ["ING-013", "16oz Cup & Lid", "Packaging", "pc", 6, 400],
];

type ItemDef = { id: string; name: string; cat: string; sub: string; type: MenuItem["type"]; price: number; recipe: [string, number][]; yieldN?: number; purchase?: number; daily: number; shelf: number };
const ITEMS: ItemDef[] = [
  { id: "MI-001-DEMO", name: "Iced Spanish Latte", cat: "Beverages", sub: "", type: "Made-to-order", price: 160, recipe: [["ING-001", 18], ["ING-002", 150], ["ING-004", 25], ["ING-013", 1]], daily: 22, shelf: 0 },
  { id: "MI-002-DEMO", name: "Caramel Cold Foam Latte", cat: "Beverages", sub: "", type: "Made-to-order", price: 175, recipe: [["ING-001", 18], ["ING-002", 140], ["ING-006", 15], ["ING-012", 30], ["ING-013", 1]], daily: 18, shelf: 0 },
  { id: "MI-003-DEMO", name: "Classic Americano", cat: "Beverages", sub: "", type: "Made-to-order", price: 95, recipe: [["ING-001", 36], ["ING-013", 1]], daily: 24, shelf: 0 },
  { id: "MI-004-DEMO", name: "Ceremonial Matcha Einspänner", cat: "Beverages", sub: "", type: "Made-to-order", price: 195, recipe: [["ING-007", 4], ["ING-003", 150], ["ING-012", 40], ["ING-013", 1]], daily: 5, shelf: 0 },
  { id: "MI-005-DEMO", name: "Herbal Citrus Tea", cat: "Beverages", sub: "", type: "Made-to-order", price: 110, recipe: [["ING-008", 12], ["ING-005", 10], ["ING-013", 1]], daily: 3, shelf: 0 },
  { id: "MI-006-DEMO", name: "Butter Croissant", cat: "Pastries", sub: "", type: "In-house", price: 85, recipe: [["ING-009", 1000], ["ING-010", 600], ["ING-002", 300]], yieldN: 16, daily: 16, shelf: 2 },
  { id: "MI-007-DEMO", name: "Chocolate Truffle Danish", cat: "Pastries", sub: "", type: "In-house", price: 145, recipe: [["ING-009", 600], ["ING-010", 350], ["ING-011", 300]], yieldN: 12, daily: 4, shelf: 2 },
  { id: "MI-008-DEMO", name: "Basque Burnt Cheesecake Slice", cat: "Pastries", sub: "", type: "Outsourced", price: 180, recipe: [], purchase: 960, yieldN: 12, daily: 6, shelf: 3 },
];

const ingCost = (id: string) => ING.find((i) => i[0] === id)![4];
const ingUnit = (id: string) => ING.find((i) => i[0] === id)![3];
const unitCostOf = (it: ItemDef) =>
  it.type === "Outsourced" ? it.purchase! / it.yieldN! : it.recipe.reduce((s, [id, q]) => s + q * ingCost(id), 0) / (it.yieldN ?? 1);

export function clearCafeData() {
  clearCollections(DATA_COLLECTIONS);
}

export function loadSampleData() {
  seed = 42;
  clearCafeData();
  const out: { collection: CollectionName; item: { id: string } }[] = [];
  const add = <T extends { id: string }>(collection: CollectionName, item: T) => out.push({ collection, item });

  for (const [id, name, category, unit, unitCost, stock] of ING) {
    add("ingredients", { id, name, category, storage: category === "Dairy" ? "Fridge" : "Dry storage", unit, unitCost, supplier: "Metro Café Supply" } satisfies Ingredient);
    const shelf = category === "Dairy" ? 6 : 120;
    add("purchases", { id: `${id}-L1`, ingredientId: id, purchaseDate: ymd(day(-3)), expiryDate: ymd(day(shelf - 3)), quantity: stock, remaining: stock, unitCost } satisfies Purchase);
  }
  // A lot about to expire, to drive expiry insights.
  add("purchases", { id: "ING-002-L0", ingredientId: "ING-002", purchaseDate: ymd(day(-5)), expiryDate: ymd(day(1)), quantity: 4000, remaining: 1500, unitCost: 0.095 } satisfies Purchase);

  for (const it of ITEMS) {
    const recipe: RecipeLine[] = it.recipe.map(([ingredientId, quantity]) => ({ ingredientId, quantity, unit: ingUnit(ingredientId), allocation: "Recipe-based" }));
    const batchCost = it.type === "In-house" ? it.recipe.reduce((s, [id, q]) => s + q * ingCost(id), 0) : 0;
    add("menuItems", {
      id: it.id, name: it.name, category: it.cat, subcategory: it.sub, description: "", available: true, tags: [],
      type: it.type, batchCost: Math.round(batchCost * 100) / 100, yield: it.yieldN ?? 1, purchaseCost: it.purchase ?? 0,
      unit: "pc", retailPrice: it.price, supplier: it.type === "Outsourced" ? "Sweet Spot Bakery" : "",
      shelfLifeDays: it.shelf, expiryRule: it.shelf ? "After the shelf life" : "Made to order — no expiry tracking",
      defaultBatchSize: it.yieldN ?? 1, batchUnit: "pc", defaultExpiryDays: it.shelf,
      defaultWasteStage: it.shelf ? "Finished Product" : "WIP", defaultWasteType: it.shelf ? "Unsold" : "Prep Error",
      allowQuickAdd: true, recipe,
    } satisfies MenuItem);
  }

  // 6 weeks of daily sales with gentle growth and weekend bumps.
  for (let d = -42; d <= 0; d++) {
    const date = day(d);
    const wk = date.getDay() === 0 || date.getDay() === 6 ? 1.3 : 1;
    const growth = 0.85 + ((d + 42) / 42) * 0.25;
    for (const it of ITEMS) {
      const qty = Math.max(0, Math.round(it.daily * wk * growth * (0.8 + rnd() * 0.4)));
      if (!qty) continue;
      add("sales", { id: `S-${it.id}-${ymd(date)}`, menuItemId: it.id, date: ymd(date), quantity: qty, unitPrice: it.price, revenue: qty * it.price } satisfies Sale);
    }
  }

  // Production batches for pastries every other day, with ingredient usage.
  for (let d = -40; d <= 0; d += 2) {
    const date = day(d);
    for (const it of ITEMS.filter((i) => i.type !== "Made-to-order")) {
      const qty = it.yieldN! * (it.daily > 10 ? 2 : 1);
      const bid = `B-${it.id}-${ymd(date)}`;
      add("batches", { id: bid, menuItemId: it.id, producedAt: date.toISOString(), quantity: qty, expiryDate: ymd(day(d + it.shelf)) } satisfies Batch);
      for (const [ingredientId, q] of it.recipe) {
        add("usages", { id: `U-${bid}-${ingredientId}`, ingredientId, date: ymd(date), quantity: Math.round((q / it.yieldN!) * qty * 100) / 100, menuItemId: it.id } satisfies Usage);
      }
    }
  }

  // Waste across all three stages (~3% of sales).
  for (let d = -41; d <= 0; d += 1) {
    const date = day(d);
    const r = rnd();
    let w: Omit<WasteLog, "id" | "at" | "value"> | null = null;
    if (r < 0.35) w = { stage: "Ingredient", ingredientId: "ING-002", wasteType: r < 0.15 ? "Spill" : "Expiry", quantity: 200 + Math.round(rnd() * 400), unit: "ml", unitCost: 0.095, allocation: "Direct" };
    else if (r < 0.6) { const it = ITEMS[Math.floor(rnd() * 5)]; w = { stage: "WIP", menuItemId: it.id, wasteType: "Prep Error", quantity: 1 + Math.floor(rnd() * 3), unit: "pc", unitCost: unitCostOf(it), allocation: "Direct" }; }
    else { const it = ITEMS[5 + Math.floor(rnd() * 3)]; w = { stage: "Finished Product", menuItemId: it.id, wasteType: "Unsold", quantity: 2 + Math.floor(rnd() * 4), unit: "pc", unitCost: unitCostOf(it), allocation: "Direct", retailValue: 0 }; }
    const value = Math.round(w.quantity * w.unitCost * 100) / 100;
    add("wasteLogs", { ...w, id: `W-${ymd(date)}`, at: new Date(date.getTime() + 8 * 3600e3).toISOString(), value, attributedMenuItemId: w.menuItemId } satisfies WasteLog);
  }

  putMany(out);
}
