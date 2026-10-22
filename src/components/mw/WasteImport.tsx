import { ImportButton } from "./ImportButton";
import { put, useDB } from "@/lib/store";
import { parseWasteRows } from "@/lib/import-parsers";
import { STAGES, WASTE_TYPES, ALLOCATIONS } from "@/lib/types";
import { todayISO } from "@/lib/format";

const COLS = "stage, date, time, wasteType, quantity, unit, unitCost (Ingredient_ID for Ingredient stage; Menu_Item_ID for Finished Product; Batch_ID optional)";

/** Log Waste import: validates each row against its stage and skips likely duplicates. */
export function WasteImport() {
  const db = useDB();


  return (
    <ImportButton
      what="waste logs"
      columns={COLS}
      className="h-9 px-3"
      parse={(rows) => parseWasteRows(rows, db)}
      fields={{ unit: { options: ["L", "ml", "kg", "g", "pc", "piece", "pieces", "pack", "box", "batch", "shots", "cups"], allowCustom: true }, stage: { options: STAGES }, wastetype: { options: WASTE_TYPES }, ingredientid: { options: db.ingredients.map((i) => i.id), labels: Object.fromEntries(db.ingredients.map((i) => [i.id, i.name])) }, menuitemid: { options: db.menuItems.map((m) => m.id), labels: Object.fromEntries(db.menuItems.map((m) => [m.id, m.name])) }, attributedmenuitemid: { options: db.menuItems.map((m) => m.id), labels: Object.fromEntries(db.menuItems.map((m) => [m.id, m.name])) }, batchid: { options: db.batches.map((b) => b.id) }, allocationmethod: { options: ALLOCATIONS }, date: { type: "date" }, time: { type: "time" }, quantity: { type: "number" }, unitcost: { type: "number" } }}
      commit={(items) => items.forEach((w) => put("wasteLogs", w))}
      template={{
        filename: "waste-logs-template.csv",
        header: ["stage", "date", "time", "wasteType", "quantity", "unit", "unitCost", "Ingredient_ID", "Menu_Item_ID", "Batch_ID", "Attributed_Menu_Item_ID", "Allocation_Method"],
        rows: [["Ingredient", todayISO(), "08:00", "Spoilage", "1", db.ingredients[0]?.unit ?? "L", String(db.ingredients[0]?.unitCost ?? 80), db.ingredients[0]?.id ?? "Fresh milk", "", "", "", "Direct"]],
      }}
    />
  );
}
