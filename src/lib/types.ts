export type Stage = "Ingredient" | "WIP" | "Finished Product";
export type WasteType = "Spoilage" | "Expiry" | "Spill" | "Prep Error" | "Unsold" | "Day-old";
export type Allocation = "Direct" | "Batch-linked" | "Recipe-based" | "Manual";
export type ItemType = "Made-to-order" | "In-house" | "Outsourced";

export const STAGES: Stage[] = ["Ingredient", "WIP", "Finished Product"];
export const WASTE_TYPES: WasteType[] = ["Spoilage", "Expiry", "Spill", "Prep Error", "Unsold", "Day-old"];
export const ALLOCATIONS: Allocation[] = ["Direct", "Batch-linked", "Recipe-based", "Manual"];
export const ITEM_TYPES: ItemType[] = ["Made-to-order", "In-house", "Outsourced"];

export interface Ingredient {
  id: string;
  name: string;
  category: string;
  storage: string;
  unit: string;
  unitCost: number;
  supplier?: string;
  notes?: string;
  image?: string; // data URL
}

/** A purchase lot of an ingredient. */
export interface Purchase {
  id: string;
  ingredientId: string;
  purchaseDate: string; // yyyy-mm-dd
  expiryDate: string;
  quantity: number;
  remaining: number;
  unitCost: number;
}

/** Ingredient taken out of stock for production. */
export interface Usage {
  id: string;
  ingredientId: string;
  date: string;
  quantity: number;
  menuItemId?: string;
}

export interface RecipeLine {
  ingredientId: string;
  quantity: number;
  unit: string;
  allocation: Allocation;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  description: string;
  available: boolean;
  tags: string[];
  type: ItemType;
  batchCost: number;
  yield: number;
  purchaseCost: number;
  unit: string;
  retailPrice: number;
  supplier: string;
  shelfLifeDays: number;
  expiryRule: string;
  defaultBatchSize: number;
  batchUnit: string;
  defaultExpiryDays: number;
  defaultWasteStage: Stage;
  defaultWasteType: WasteType;
  allowQuickAdd: boolean;
  recipe: RecipeLine[];
  image?: string; // data URL
}

export interface Batch {
  id: string;
  menuItemId: string;
  producedAt: string; // ISO
  quantity: number;
  expiryDate: string;
  note?: string;
}

export interface Sale {
  id: string;
  menuItemId: string;
  date: string;
  quantity: number;
  unitPrice?: number;
  revenue?: number;
  notes?: string;
}

export interface WasteLog {
  id: string;
  at: string; // ISO
  stage: Stage;
  ingredientId?: string;
  menuItemId?: string;
  /** Free-text item name when the item is not in the catalog. */
  customName?: string;
  batchId?: string;
  wasteType: WasteType;
  quantity: number;
  unit: string;
  unitCost: number;
  value: number;
  attributedMenuItemId?: string;
  allocation: Allocation;
  retailValue?: number;
}

/** Who created / last edited a record. Stored inside every record's data. */
export interface Audit {
  createdBy?: string;
  createdByName?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface ChangeLog {
  id: string;
  collection: string;
  recordId: string;
  action: "created" | "edited" | "deleted" | "viewed";
  at: string;
  by: string;
  byName: string;
  changes: FieldChange[];
  /** Set when a MenuWise admin made this change from Café Monitoring. */
  adminEdit?: boolean;
  note?: string;
}

export interface InsightResponse {
  id: string; // insight key, e.g. "exp:<lotId>"
  status: "accepted" | "rejected" | "snoozed";
  until?: string; // ISO, for snoozed
  at: string;
  byName: string;
  label: string;
}

/** Explicit daily confirmation; an empty day is never assumed to be waste-free. */
export interface DailyCheck {
  id: string;
  date: string; // yyyy-mm-dd in the café's reporting timezone
  noWaste: boolean;
  closeout: boolean;
  notes?: string;
}

export interface Collections {
  ingredients: Ingredient;
  purchases: Purchase;
  usages: Usage;
  menuItems: MenuItem;
  batches: Batch;
  sales: Sale;
  wasteLogs: WasteLog;
  dailyChecks: DailyCheck;
  changeLogs: ChangeLog;
  insightResponses: InsightResponse;
}
export type CollectionName = keyof Collections;
export const COLLECTIONS: CollectionName[] = ["ingredients", "purchases", "usages", "menuItems", "batches", "sales", "wasteLogs", "dailyChecks", "changeLogs", "insightResponses"];
