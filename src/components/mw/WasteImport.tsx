import { ImportButton, type ParsedRow } from "./ImportButton";
import { put, useDB } from "@/lib/store";
import { normDate, num, type Row } from "@/lib/import";
import { STAGES, WASTE_TYPES, type Stage, type WasteLog, type WasteType } from "@/lib/types";
import { uid } from "@/lib/format";

const COLS = "stage, date, time, wasteType, quantity, unit, unitCost (Ingredient_ID for Ingredient stage; Menu_Item_ID for Finished Product; Batch_ID optional)";

/** Log Waste import: validates each row against its stage and skips likely duplicates. */
export function WasteImport() {
  const db = useDB();

  function parse(rows: Row[]): ParsedRow<WasteLog>[] {
    const seen = new Set(db.wasteLogs.map((w) => `${w.at}|${w.stage}|${w.ingredientId ?? w.menuItemId ?? ""}|${w.quantity}`));
    return rows.map((r, k) => {
      const line = k + 2;
      const stage = STAGES.find((s) => s.toLowerCase().replace(/\s/g, "") === (r.stage ?? "").toLowerCase().replace(/[\s_-]/g, "")) as Stage | undefined;
      const date = normDate(r.date ?? "");
      const time = /^\d{1,2}:\d{2}/.test(r.time ?? "") ? r.time.slice(0, 5).padStart(5, "0") : "";
      const wt = WASTE_TYPES.find((t) => t.toLowerCase() === (r.wastetype ?? "").toLowerCase()) as WasteType | undefined;
      const q = num(r.quantity ?? ""), c = num(r.unitcost ?? ""), unit = (r.unit ?? "").trim();
      const ingRaw = r.ingredientid ?? "", menuRaw = r.menuitemid ?? "", batchId = (r.batchid ?? "").trim();
      const ing = db.ingredients.find((i) => i.id.toLowerCase() === ingRaw.toLowerCase());
      const menu = db.menuItems.find((m) => m.id.toLowerCase() === menuRaw.toLowerCase());
      const batch = batchId ? db.batches.find((b) => b.id === batchId) : undefined;
      const label = `${stage ?? r.stage ?? "?"} · ${ing?.name ?? menu?.name ?? ingRaw ?? menuRaw} · ${r.quantity ?? ""}`;
      const err =
        !stage ? `Unknown stage "${r.stage ?? ""}" (use Ingredient, WIP or Finished Product)`
        : !date ? "Invalid date"
        : !time ? "Invalid time (use HH:MM)"
        : !wt ? `Unknown waste type "${r.wastetype ?? ""}"`
        : !(q > 0) ? "Quantity must be more than 0"
        : !unit ? "Unit is required"
        : !(c >= 0) ? "Unit cost must be 0 or more"
        : stage === "Ingredient" && !ing ? `Unknown Ingredient_ID "${ingRaw}"`
        : stage === "Finished Product" && !menu ? `Unknown Menu_Item_ID "${menuRaw}"`
        : stage === "WIP" && menuRaw && !menu ? `Unknown Menu_Item_ID "${menuRaw}"`
        : stage === "WIP" && !menu && !batchId ? "WIP needs a Menu_Item_ID or Batch_ID"
        : batchId && !batch ? `Unknown Batch_ID "${batchId}"`
        : batch && menu && batch.menuItemId !== menu.id ? "Batch_ID belongs to a different menu item"
        : "";
      if (err) return { line, label, error: err };
      const at = new Date(`${date}T${time}`).toISOString();
      const linkId = stage === "Ingredient" ? ing!.id : menu?.id ?? batch?.menuItemId;
      const key = `${at}|${stage}|${linkId ?? ""}|${q}`;
      const duplicate = seen.has(key);
      seen.add(key);
      const item: WasteLog = {
        id: uid("W-"), at, stage: stage!, wasteType: wt!, quantity: q, unit, unitCost: c, value: +(q * c).toFixed(2),
        ingredientId: stage === "Ingredient" ? ing!.id : undefined,
        menuItemId: stage !== "Ingredient" ? linkId : undefined,
        batchId: batchId || undefined,
        allocation: stage === "WIP" ? "Batch-linked" : "Direct",
        retailValue: stage === "Finished Product" && menu ? q * menu.retailPrice : undefined,
      };
      return { line, label, item, duplicate };
    });
  }

  return (
    <ImportButton
      what="waste logs"
      columns={COLS}
      className="h-9 px-3"
      parse={parse}
      commit={(items) => items.forEach((w) => put("wasteLogs", w))}
      template={{
        filename: "waste-logs-template.csv",
        header: ["stage", "date", "time", "wasteType", "quantity", "unit", "unitCost", "Ingredient_ID", "Menu_Item_ID", "Batch_ID"],
        rows: [],
      }}
    />
  );
}
