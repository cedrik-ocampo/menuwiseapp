import { STAGES, WASTE_TYPES, ALLOCATIONS } from "./types";
import type { DBView } from "./store";
import type { Ingredient, Purchase, MenuItem, RecipeLine, Sale, Batch, WasteLog, Stage, WasteType } from "./types";
import type { ParsedRow } from "@/components/mw/ImportButton";
import { normDate, normalizeCategory, num, num as toNum, type Row } from "./import";
import { sourceLine } from "./import-review";
import { uid, todayISO, addDays } from "./format";
import { ingredientAmountCost, itemTypeFromLabel } from "./menu-costing";
import { recipeCost } from "./calc";

export const EXPIRY_OPTIONS = ["After the shelf life", "At the end of the same day", "Made to order — no expiry tracking"];
export const CATS: Record<string, string[]> = { Pastry: ["Croissants & Danishes", "Bread", "Tart", "Cake", "Cookie"], Drinks: ["Espresso", "Non-coffee", "Tea", "Cold drinks"] };
function internalId(index: number) { return `MI-${index + 1}-${uid().slice(-4)}`; }
export function parseMenuRows(rows: Row[], db: DBView): ParsedRow<MenuItem>[] {
  const groups = new Map<string, { name: string; rows: { row: Row; line: number }[] }>();
  rows.forEach((row, index) => {
    const name = (row.menuitemname || row.name || "").trim();
    const key = name.toLowerCase().replace(/\s+/g, " ");
    const group = groups.get(key) ?? { name, rows: [] };
    group.rows.push({ row, line: sourceLine(row, index) });
    groups.set(key, group);
  });

  const knownCategories = [...new Set([...Object.keys(CATS), ...db.menuItems.map((item) => item.category)])];
  return [...groups.values()].map((group, groupIndex) => {
    const first = group.rows[0];
    const row = first.row;
    const base = { line: first.line, label: `${group.name || "Unnamed item"} · ${group.rows.length} recipe row${group.rows.length === 1 ? "" : "s"}` };
    if (!group.name) return { ...base, error: "Menu Item Name is required" };
    const existing = db.menuItems.find((item) => item.name.trim().toLowerCase() === group.name.toLowerCase());

    const type = itemTypeFromLabel(row.type || "");
    if (!type) return { ...base, error: `Unknown item type "${row.type || ""}"` };
    const category = normalizeCategory(row.category || "", knownCategories);
    if (!category.value) return { ...base, error: "Category is required" };
    const sellingPrice = toNum(row.sellingprice || row.retailprice);
    if (!(Number.isFinite(sellingPrice) && sellingPrice > 0)) return { ...base, error: "Selling Price must be more than 0" };

    const repeated = ["category", "subcategory", "type", "sellingprice", "batchyield", "batchpurchaseprice", "piecesperbatch", "shelflifedays", "expireswhen", "description", "tags", "supplier", "available"];
    const inconsistent = repeated.find((key) => group.rows.some(({ row: current }) => String(current[key] || "").trim().toLowerCase() !== String(row[key] || "").trim().toLowerCase()));
    if (inconsistent) return { ...base, error: `Repeated item details do not match in ${inconsistent}` };

    if (row.available && !["true", "false", "yes", "no", "1", "0"].includes(row.available.toLowerCase())) return { ...base, error: "Available must be true or false" };
    if (row.description?.length > 300) return { ...base, error: "Description must be 300 characters or fewer" };
    const shelfLife = toNum(row.shelflifedays || "");
    if (!(Number.isFinite(shelfLife) && shelfLife >= 0)) return { ...base, error: "Shelf Life Days must be 0 or more" };
    const expiryRule = EXPIRY_OPTIONS.find((option) => option.toLowerCase() === (row.expireswhen || "").toLowerCase());
    if (!expiryRule) return { ...base, error: "Choose a valid Expires When option" };
    const yieldAmount = type === "Made-to-order" ? 1 : toNum(row.batchyield || "0");
    let purchaseCost = 0;
    let recipe: RecipeLine[] = [];

    if (type === "Outsourced") {
      const batchPrice = toNum(row.batchpurchaseprice || "0");
      const pieces = toNum(row.piecesperbatch || "0");
      if (!(Number.isFinite(batchPrice) && batchPrice > 0)) return { ...base, error: "Batch Purchase Price must be more than 0 for an outsourced item" };
      if (!(Number.isFinite(pieces) && pieces > 0)) return { ...base, error: "Pieces Per Batch must be more than 0 for an outsourced item" };
      purchaseCost = batchPrice / pieces;
    } else {
      if (type === "In-house" && !(Number.isFinite(yieldAmount) && yieldAmount > 0)) return { ...base, error: "Batch Yield must be more than 0" };
      const used = new Set<string>();
      for (const entry of group.rows) {
        const ingredientName = (entry.row.ingredientname || "").trim();
        const matches = db.ingredients.filter((ingredient) => ingredient.name.trim().toLowerCase() === ingredientName.toLowerCase());
        if (!ingredientName) return { ...base, line: entry.line, error: "Ingredient Name is required for every recipe row" };
        if (matches.length === 0) return { ...base, line: entry.line, error: `Ingredient "${ingredientName}" was not found in Ingredient Inventory` };
        if (matches.length > 1) return { ...base, line: entry.line, error: `Ingredient name "${ingredientName}" is ambiguous` };
        const ingredient = matches[0];
        if (used.has(ingredient.id)) return { ...base, line: entry.line, error: `${ingredient.name} appears more than once in this recipe` };
        const amount = toNum(entry.row.amount || "0");
        const unit = (entry.row.unit || "").trim();
        if (!(Number.isFinite(amount) && amount > 0)) return { ...base, line: entry.line, error: "Amount must be more than 0" };
        if (!unit) return { ...base, line: entry.line, error: "Unit is required for every recipe row" };
        const ingredientCost = ingredientAmountCost(ingredient, amount, unit);
        if (!Number.isFinite(ingredientCost)) return { ...base, line: entry.line, error: `${unit} cannot be converted to ${ingredient.unit} for ${ingredient.name}` };
        used.add(ingredient.id);
        recipe.push({ ingredientId: ingredient.id, quantity: amount, unit, allocation: "Recipe-based" });
      }
      if (!recipe.length) return { ...base, error: "A complete recipe is required" };
    }

    const subcategories = CATS[category.value] ?? [];
    const subcategory = row.subcategory?.trim() ? normalizeCategory(row.subcategory, subcategories).value : "";
    const item: MenuItem = {
      id: existing?.id ?? internalId(db.menuItems.length + groupIndex), name: existing?.name ?? group.name, category: category.value, subcategory,
      description: (row.description || "").trim(), available: !["false", "no", "0"].includes((row.available || "true").toLowerCase()), tags: (row.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean), type, batchCost: 0, yield: type === "Outsourced" ? toNum(row.piecesperbatch) : yieldAmount,
      purchaseCost, unit: "piece", retailPrice: sellingPrice, supplier: (row.supplier || "").trim(), shelfLifeDays: shelfLife, expiryRule,
      defaultBatchSize: type === "In-house" ? yieldAmount : 1, batchUnit: "pieces", defaultExpiryDays: expiryRule === EXPIRY_OPTIONS[1] ? 0 : shelfLife,
      defaultWasteStage: "Finished Product", defaultWasteType: "Unsold", allowQuickAdd: true, recipe,
    };
    item.batchCost = type === "Outsourced" ? 0 : recipeCost(db, item);
    if (existing) return { ...base, duplicate: true, flag: `Already in your menu — choose "Update existing item" to replace its type, prices and recipe. Its sales and waste history stay linked.`, item };
    return { ...base, flag: category.known ? undefined : `New category: "${category.value}"`, item };
  });
}

export function parseSales(rows: Row[], db: DBView): ParsedRow<Sale>[] {
  const t = todayISO(), oldest = addDays(t, -365);
  const existing = new Set(db.sales.map((s) => `${s.date}|${s.menuItemId}`));
  return rows.map((r, k) => {
    const mid = (r.menuitemid || r.menuitemname || "").trim();
    const m = db.menuItems.find((x) => x.id.toLowerCase() === mid.toLowerCase() || x.name.toLowerCase() === mid.toLowerCase());
    const date = normDate(r.saledate ?? "");
    const q = num(r.quantity ?? "");
    const hasPrice = (r.unitprice ?? "") !== "";
    const p = hasPrice ? num(r.unitprice) : m?.retailPrice ?? 0;
    const base = { line: sourceLine(r, k), label: `${date || r.saledate || "?"} · ${m?.name ?? mid} · ${r.quantity ?? ""}` };
    const err = !date ? "Invalid sale_date (use YYYY-MM-DD or MM/DD/YYYY)"
      : date > t ? "sale_date is in the future"
      : date < oldest ? "sale_date is more than 1 year old"
      : !mid ? "Missing menu_item_id"
      : !m ? `Unknown menu_item_id "${mid}"`
      : !(Number.isInteger(q) && q > 0) ? "quantity must be a whole number more than 0"
      : hasPrice && !(Number.isFinite(p) && p >= 0) ? "unit_price must be 0 or more"
      : "";
    if (err) return { ...base, error: err };
    if (!m) return { ...base, error: "Choose a menu item" };
    const duplicate = existing.has(`${date}|${m.id}`);
    existing.add(`${date}|${m.id}`);
    return {
      ...base,
      duplicate,
      item: { id: uid("S-"), menuItemId: m.id, date, quantity: q, unitPrice: p, revenue: q * p, notes: (r.notes ?? "").trim() || undefined },
    };
  });
}

  export function parseProductionRows(rows: Row[], db: DBView): ParsedRow<Batch>[] {
    const used = new Set(db.batches.map((b) => b.id));
    return rows.map((r, k) => {
      const mid = r.menuitemid || r.menuitemname || r.menuitem || "";
      const m = db.menuItems.find((x) => x.id.toLowerCase() === mid.toLowerCase() || x.name.toLowerCase() === mid.toLowerCase());
      const q = toNum(r.quantity), produced = normDate(r.producedat || r.productiondate || r.date), exp = normDate(r.expirydate);
      const id = (r.batchid || `${(m?.id ?? "B").split("-")[0]}-${produced.replace(/-/g, "").slice(4)}-I${k}`).trim();
      const base = { line: sourceLine(r, k), label: `${m?.name ?? mid} · ${r.quantity ?? ""}` };
      const err = !m ? `Unknown menu item "${mid}"` : !(Number.isFinite(q) && q > 0) ? "Quantity must be more than 0" : !produced ? "Invalid producedAt" : !exp ? "Invalid expiryDate" : exp < produced ? "Expiry is before production date" : used.has(id) ? `Batch ID ${id} already used` : "";
      if (err) return { ...base, error: err };
      if (!m) return { ...base, error: "Choose a menu item" };
      used.add(id);
      return { ...base, item: { id, menuItemId: m.id, producedAt: new Date(`${produced}T08:00`).toISOString(), quantity: q, expiryDate: exp, note: r.note || r.notes || undefined } };
    });
  }

export const INGREDIENT_UNITS = ["L", "ml", "kg", "g", "pc", "pack", "box"];
export const INGREDIENT_STORAGE = ["Refrigerated", "Frozen", "Pantry"];
export function parseIngredientRows(rows: Row[], db: DBView): ParsedRow<{ ing: Ingredient; purchase: Purchase }>[] {
  const known = [...new Set(["Dairy", "Produce", "Dry goods", "Beverage", "Packaging", "Other", ...db.ingredients.map((i) => i.category)])];
  const ids = new Map(db.ingredients.map((i) => [i.id.toLowerCase(), i]));
  const seen = new Set(db.purchases.map((p) => `${p.ingredientId.toLowerCase()}|${p.purchaseDate}|${p.expiryDate}|${p.quantity}|${p.unitCost}`));
  return rows.map((r, index) => {
    const name = (r.ingredientname || r.name || "").trim();
    const id = (r.ingredientid || r.id || "").trim() || (name ? (db.ingredients.find((i) => i.name.toLowerCase() === name.toLowerCase())?.id ?? `ING-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 16)}`) : "");
    const unit = r.unit || "", quantity = num(r.quantity), unitCost = num(r.unitcost);
    const purchaseDate = normDate(r.purchasedate), expiryDate = (r.expirydate || "").trim() ? normDate(r.expirydate) : purchaseDate ? addDays(purchaseDate, 30) : "";
    const expiryDefaulted = !(r.expirydate || "").trim();
    const category = normalizeCategory(r.category || "", known);
    const base = { line: sourceLine(r, index), label: name || id || "Unnamed ingredient" };
    const existing = ids.get(id.toLowerCase());
    const error = !id || id.length > 20 ? "Ingredient ID is required (maximum 20 characters)"
      : !name || name.length > 80 ? "Ingredient name is required (maximum 80 characters)"
      : !category.value ? "Category is required"
      : !INGREDIENT_UNITS.includes(unit) ? "Choose a valid unit"
      : r.storage && !INGREDIENT_STORAGE.includes(r.storage) ? "Choose a valid storage option"
      : !(Number.isFinite(quantity) && quantity > 0) ? "Quantity must be more than 0"
      : !(Number.isFinite(unitCost) && unitCost >= 0) ? "Unit cost must be 0 or more"
      : !purchaseDate ? "Invalid purchase date" : !expiryDate ? "Invalid expiry date"
      : expiryDate < purchaseDate ? "Expiry is before purchase date"
      : (r.supplier || "").length > 80 ? "Supplier must be 80 characters or fewer"
      : (r.notes || "").length > 300 ? "Notes must be 300 characters or fewer"
      : existing && (existing.name.toLowerCase() !== name.toLowerCase() || existing.unit !== unit) ? "This ingredient ID belongs to a different name or unit. Match it or use a new ID."
      : "";
    if (error) return { ...base, error };
    const ing: Ingredient = existing ?? { id, name, unit, unitCost, category: category.value, storage: r.storage || "", supplier: r.supplier || undefined, notes: r.notes || undefined };
    ids.set(id.toLowerCase(), ing);
    const key = `${ing.id.toLowerCase()}|${purchaseDate}|${expiryDate}|${quantity}|${unitCost}`;
    const duplicate = seen.has(key); seen.add(key);
    return { ...base, duplicate, flag: !category.known ? `New category: "${category.value}" — choose Add to approve` : expiryDefaulted ? "No expiry date — set to 30 days after purchase; edit it later on the ingredient page" : existing ? "Existing ingredient — adds a stock purchase, not another ingredient" : undefined,
      item: { ing, purchase: { id: uid("P-"), ingredientId: ing.id, purchaseDate, expiryDate, quantity, remaining: quantity, unitCost } } };
  });
}

  export function parseWasteRows(rows: Row[], db: DBView): ParsedRow<WasteLog>[] {
    const seen = new Set(db.wasteLogs.map((w) => `${w.at}|${w.stage}|${w.ingredientId ?? w.menuItemId ?? ""}|${w.quantity}`));
    return rows.map((r, k) => {
      const line = sourceLine(r, k);
      const stage = STAGES.find((s) => s.toLowerCase().replace(/\s/g, "") === (r.stage ?? "").toLowerCase().replace(/[\s_-]/g, "")) as Stage | undefined;
      const date = normDate(r.date ?? "");
      const time = /^([01]?\d|2[0-3]):[0-5]\d$/.test(r.time ?? "") ? r.time.padStart(5, "0") : "";
      const wt = WASTE_TYPES.find((t) => t.toLowerCase() === (r.wastetype ?? "").toLowerCase()) as WasteType | undefined;
      const q = num(r.quantity ?? ""), c = num(r.unitcost ?? ""), unit = (r.unit ?? "").trim();
      const ingRaw = r.ingredientid ?? "", menuRaw = r.menuitemid ?? "", batchId = (r.batchid ?? "").trim();
      const ing = db.ingredients.find((i) => (i.id.toLowerCase() === ingRaw.toLowerCase() || i.name.toLowerCase() === ingRaw.toLowerCase()));
      const menu = db.menuItems.find((m) => (m.id.toLowerCase() === menuRaw.toLowerCase() || m.name.toLowerCase() === menuRaw.toLowerCase()));
      const batch = batchId ? db.batches.find((b) => b.id === batchId) : undefined;
      const attributedRaw = r.attributedmenuitemid || "";
      const attributed = db.menuItems.find((m) => m.id.toLowerCase() === attributedRaw.toLowerCase() || m.name.toLowerCase() === attributedRaw.toLowerCase());
      const allocation = ALLOCATIONS.find((value) => value.toLowerCase() === (r.allocationmethod || "").toLowerCase()) ?? (r.allocationmethod ? undefined : stage === "WIP" ? "Batch-linked" : "Direct");
      const label = `${stage ?? r.stage ?? "?"} · ${ing?.name ?? menu?.name ?? ingRaw ?? menuRaw} · ${r.quantity ?? ""}`;
      const err =
        !stage ? `Unknown stage "${r.stage ?? ""}" (use Ingredient, WIP or Finished Product)`
        : !date ? "Invalid date"
        : !time ? "Invalid time (use HH:MM)"
        : !wt ? `Unknown waste type "${r.wastetype ?? ""}"`
        : !(Number.isFinite(q) && q > 0) ? "Quantity must be more than 0"
        : !unit ? "Unit is required"
        : !(Number.isFinite(c) && c >= 0) ? "Unit cost must be 0 or more"
        : stage === "Ingredient" && !ing ? `Unknown Ingredient_ID "${ingRaw}"`
        : stage === "Finished Product" && !menu ? `Unknown Menu_Item_ID "${menuRaw}"`
        : stage === "WIP" && menuRaw && !menu ? `Unknown Menu_Item_ID "${menuRaw}"`
        : stage === "WIP" && !menu && !batchId ? "WIP needs a Menu_Item_ID or Batch_ID"
        : batchId && !batch ? `Unknown Batch_ID "${batchId}"`
        : batch && menu && batch.menuItemId !== menu.id ? "Batch_ID belongs to a different menu item"
        : attributedRaw && !attributed ? "Choose a known attributed menu item"
        : !allocation ? "Choose a valid allocation method"
        : "";
      if (err) return { line, label, error: err };
      if (!stage || !wt || !allocation || (stage === "Ingredient" && !ing)) return { line, label, error: "Complete the required fields" };
      const at = new Date(`${date}T${time}`).toISOString();
      const linkId = stage === "Ingredient" ? ing?.id : menu?.id ?? batch?.menuItemId;
      const key = `${at}|${stage}|${linkId ?? ""}|${q}`;
      const duplicate = seen.has(key);
      seen.add(key);
      const item: WasteLog = {
        id: uid("W-"), at, stage, wasteType: wt, quantity: q, unit, unitCost: c, value: +(q * c).toFixed(2),
        ingredientId: stage === "Ingredient" ? ing?.id : undefined,
        menuItemId: stage !== "Ingredient" ? linkId : undefined,
        batchId: batchId || undefined,
        allocation, attributedMenuItemId: attributed?.id,
        retailValue: stage === "Finished Product" && menu ? q * menu.retailPrice : undefined,
      };
      return { line, label, item, duplicate };
    });
  }

