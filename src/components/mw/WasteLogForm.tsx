import { QuickAddItem } from "./QuickAddItem";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Check, Calculator, Trash2, Pencil } from "lucide-react";
import { AuditCaption } from "./Audit";
import { EditWasteDialog } from "./EditDialogs";
import { toast } from "sonner";
import { useDB, put, remove, usePermissions } from "@/lib/store";
import { costPerUnit } from "@/lib/calc";
import { ALLOCATIONS, STAGES, WASTE_TYPES, type Allocation, type Stage, type WasteLog, type WasteType } from "@/lib/types";
import { formatPeso, fmtQty, shortDate, todayISO, uid } from "@/lib/format";
import { normName, resolveWasteName, wasteItemLabel, wasteSuggestions } from "@/lib/waste-suggestions";
import { Field, Segmented, btnPrimary, inputCls } from "./ui";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  quantity: z.number({ invalid_type_error: "Enter a quantity" }).positive("Quantity must be more than 0"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  unitCost: z.number({ invalid_type_error: "Enter a unit cost" }).min(0, "Unit cost can't be negative"),
});

export const STAGE_DESC: Record<Stage, string> = {
  Ingredient: "Raw, individual ingredient. Example: spillage while preparing ingredients for a batch of pastries, burnt butter while browning it before adding to cookies, or spoilage of an ingredient before it is used.",
  WIP: "Work in progress. The total ingredient cost for a product. Example: a batch of croissants accidentally burnt during prep.",
  "Finished Product": "Spillage or spoilage after the item was ready for sale. Example: dropped on the floor or returned by a customer for finding a hair in it.",
};

interface Props {
  fixedStage?: Stage;
  ingredientId?: string;
  menuItemId?: string;
  onSaved?: (w: WasteLog) => void;
}

export function WasteLogForm({ fixedStage, ingredientId: ingFixed, menuItemId: menuFixed, onSaved }: Props) {
  const db = useDB();
  const now = new Date();
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(`${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  const [stage, setStage] = useState<Stage>(fixedStage ?? "Ingredient");
  const [ingredientId, setIngredientId] = useState(ingFixed ?? "");
  const [menuItemId, setMenuItemId] = useState(menuFixed ?? "");
  const [batchId, setBatchId] = useState("");
  const [itemText, setItemText] = useState("");
  const [wasteType, setWasteType] = useState<WasteType>("Spoilage");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [attributed, setAttributed] = useState("");
  const [allocation, setAllocation] = useState<Allocation>("Direct");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestions = useMemo(() => wasteSuggestions(db, stage), [db, stage]);
  const customName = !ingFixed && !menuFixed && itemText.trim() && !(stage === "Ingredient" ? ingredientId : menuItemId) ? itemText.trim().replace(/\s+/g, " ") : "";
  function pickItem(text: string) {
    setItemText(text);
    const hit = resolveWasteName(text, suggestions);
    if (stage === "Ingredient") setIngredientId(hit?.kind === "Ingredient" ? hit.id! : "");
    else { setMenuItemId(hit?.kind === "Menu item" ? hit.id! : ""); setBatchId(""); }
    if (hit?.kind === "Previously logged") { setUnit(hit.unit ?? ""); setUnitCost(String(hit.unitCost ?? "")); }
  }
  useEffect(() => { if (!ingFixed && !menuFixed) pickItem(""); }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const ing = db.ingredients.find((i) => i.id === ingredientId);
  const menu = db.menuItems.find((m) => m.id === menuItemId);
  const batches = useMemo(
    () => db.batches.filter((b) => b.menuItemId === menuItemId).sort((a, b) => b.producedAt.localeCompare(a.producedAt)).slice(0, 10),
    [db.batches, menuItemId],
  );

  // Auto-fill unit & unit cost from the linked item
  useEffect(() => {
    if (stage === "Ingredient" && ing) {
      setUnit(ing.unit);
      setUnitCost(String(ing.unitCost));
    } else if (stage !== "Ingredient" && menu) {
      setUnit(stage === "WIP" ? menu.batchUnit === "cups" ? "shots" : "batch" : menu.unit);
      setUnitCost(String(+(stage === "WIP" ? costPerUnit(menu) * (menu.type === "Outsourced" ? 1 : menu.yield) : costPerUnit(menu)).toFixed(2)));
    }
  }, [stage, ingredientId, menuItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage === "Ingredient") setWasteType("Spoilage");
    else if (stage === "WIP") setWasteType("Prep Error");
    else setWasteType(menu?.defaultWasteType ?? "Unsold");
    setAllocation(stage === "WIP" ? "Batch-linked" : "Direct");
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = parseFloat(quantity);
  const c = parseFloat(unitCost);
  const value = Number.isFinite(q) && Number.isFinite(c) ? q * c : 0;
  const retail = stage === "Finished Product" && menu && Number.isFinite(q) ? q * menu.retailPrice : undefined;

  function save() {
    const errs: Record<string, string> = {};
    const r = schema.safeParse({ date, time, quantity: q, unit, unitCost: c });
    if (!r.success) r.error.issues.forEach((i) => (errs[String(i.path[0])] = i.message));
    if (customName.length > 80) errs.link = "Keep the item name under 80 characters";
    if (stage === "Ingredient" && !ingredientId && !customName) errs.link = "Pick or type the ingredient that was lost";
    if (stage === "Finished Product" && !menuItemId && !customName) errs.link = "Pick or type the item that was lost";
    if (stage === "WIP" && !menuItemId && !batchId && !customName) errs.link = "Type the item, or link a batch";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const log: WasteLog = {
      id: uid("W-"),
      at: new Date(`${date}T${time}`).toISOString(),
      stage,
      ingredientId: stage === "Ingredient" ? ingredientId : undefined,
      menuItemId: stage !== "Ingredient" ? menuItemId || undefined : undefined,
      customName: customName || undefined,
      batchId: batchId || undefined,
      wasteType,
      quantity: q,
      unit: unit.trim(),
      unitCost: c,
      value: +value.toFixed(2),
      attributedMenuItemId: attributed || undefined,
      allocation,
      retailValue: retail,
    };
    put("wasteLogs", log);
    // Ingredient waste reduces stock from the soonest-expiring lot first
    if (stage === "Ingredient" && ingredientId) {
      let left = q;
      for (const lot of db.purchases.filter((p) => p.ingredientId === ingredientId && p.remaining > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))) {
        if (left <= 0) break;
        const take = Math.min(lot.remaining, left);
        put("purchases", { ...lot, remaining: +(lot.remaining - take).toFixed(3) });
        left -= take;
      }
    }
    toast.success(`Waste logged: ${formatPeso(log.value)}`);
    setQuantity("");
    if (customName) pickItem("");
    onSaved?.(log);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.date}>
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Time" error={errors.time}>
          <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      {fixedStage ? (
        <p className="text-sm font-semibold text-primary">Stage: <span className="font-normal">{fixedStage}</span></p>
      ) : (
        <Field label="Stage" hint={STAGE_DESC[stage]}>
          <Segmented value={stage} options={STAGES} onChange={setStage} />
        </Field>
      )}

      {stage === "Ingredient" ? (
        ingFixed ? (
          <p className="text-sm font-semibold text-primary">Ingredient: <span className="font-normal">{ing?.name ?? ingFixed}</span></p>
        ) : <ItemBox label="Ingredient" value={itemText} onChange={pickItem} suggestions={suggestions} custom={!!customName} error={errors.link} />
      ) : (
        <>
          {menuFixed ? (
            <p className="text-sm font-semibold text-primary">Menu item: <span className="font-normal">{menu?.name ?? menuFixed}</span></p>
          ) : <ItemBox label={stage === "WIP" ? "Item · if known" : "Item"} value={itemText} onChange={pickItem} suggestions={suggestions} custom={!!customName} error={errors.link} />}
          <Field label="Batch ID · optional" hint={stage === "WIP" ? "For WIP, select the batch it came from." : "For Finished Product, select the batch, if any."}>
            <select className={inputCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
              <option value="">Not linked</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>{b.id} · made {shortDate(b.producedAt)} · {b.quantity} {menu?.batchUnit}</option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Field label="Waste type">
        <select className={inputCls} value={wasteType} onChange={(e) => setWasteType(e.target.value as WasteType)}>
          {WASTE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" error={errors.quantity}>
          <input inputMode="decimal" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Unit" error={errors.unit}>
          <input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="pcs, L, kg" />
        </Field>
      </div>

      <Field label="Unit cost" error={errors.unitCost} hint={stage === "Ingredient" ? "Purchase unit cost." : menu?.type === "Outsourced" ? "Purchase cost per unit." : "Standard recipe cost or batch cost ÷ yield."}>
        <input inputMode="decimal" className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} placeholder="₱0.00" />
      </Field>

      <div className="rounded-xl bg-info-soft p-4">
        <div className="flex items-center justify-between text-xs font-semibold text-primary">
          <span>Waste value</span><span className="text-muted-foreground">Read-only · calculated</span>
        </div>
        <p className="mt-1 text-3xl font-bold text-primary">{formatPeso(value)}</p>
        <p className="text-xs text-muted-foreground">Cost-based loss, not selling price.</p>
      </div>

      <Field label="Attributed menu item ID · optional">
        <select className={inputCls} value={attributed} onChange={(e) => setAttributed(e.target.value)}>
          <option value="">{stage === "Finished Product" ? "Not needed · direct finished-product loss" : "Unattributed · optional"}</option>
          {db.menuItems.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}
        </select>
      </Field>

      <Field label="Allocation method">
        <select className={inputCls} value={allocation} onChange={(e) => setAllocation(e.target.value as Allocation)}>
          {ALLOCATIONS.map((a) => <option key={a}>{a}</option>)}
        </select>
      </Field>

      <div className="rounded-xl border border-info-border bg-info-soft p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-primary"><Calculator className="h-4 w-4" /> Value Calculation</p>
        <p className="mt-1 text-muted-foreground">
          Quantity × unit cost = waste value.{" "}
          {Number.isFinite(q) && Number.isFinite(c) && `${fmtQty(q)} ${unit} × ${formatPeso(c)} = ${formatPeso(value)}.`} Record this loss once.
        </p>
      </div>

      {stage === "Finished Product" && (
        <Field label="Retail value lost · optional" hint="Shown separately; never added to cost-based waste value.">
          <input className={inputCls} disabled value={retail !== undefined && Number.isFinite(retail) ? formatPeso(retail) : "Not applicable"} />
        </Field>
      )}

      <button type="button" onClick={save} className={`${btnPrimary} w-full`}>
        <Check className="h-4 w-4" /> Save waste log
      </button>
    </div>
  );
}

function ItemBox({ label, value, onChange, suggestions, custom, error }: { label: string; value: string; onChange: (v: string) => void; suggestions: ReturnType<typeof wasteSuggestions>; custom: boolean; error?: string }) {
  const listId = `waste-items-${label.replace(/\W/g, "")}`;
  return (
    <Field label={label} error={error} hint={custom ? "Not in your list yet — it will be saved as a custom item and suggested next time." : "Pick from the list or type any name."}>
      <input className={inputCls} list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Start typing, e.g. Ube cake" />
      <datalist id={listId}>
        {suggestions.map((s) => <option key={`${s.kind}-${s.name}`} value={s.name}>{s.kind}</option>)}
      </datalist>
    </Field>
  );
}

export function WasteList({ logs, empty = "No waste history yet." }: { logs: WasteLog[]; empty?: string }) {
  const perm = usePermissions();
  const db = useDB();
  const [editing, setEditing] = useState<WasteLog | null>(null);
  if (!logs.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {editing && <EditWasteDialog log={editing} onClose={() => setEditing(null)} />}
      <div className="grid grid-cols-[1fr_1fr_4rem] bg-secondary px-4 py-2 text-xs font-bold uppercase text-primary">
        <span>Date / Waste type</span><span className="text-right">Quantity / Value</span><span />
      </div>
      {logs.map((w) => (
        <div key={w.id} className="grid grid-cols-[1fr_1fr_4rem] items-center border-t border-border px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-primary">{wasteItemLabel(w, db)}{isCustom(w) && <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Custom</span>}</p>
            <p className="text-muted-foreground">{shortDate(w.at)} · {w.wasteType}</p>
            {isCustom(w) && w.stage !== "Ingredient" && perm.isOwner && (
              <QuickAddItem label="Add to Menu" defaultName={w.customName!} defaultCost={w.unitCost} onCreated={(id) => linkCustom(db.wasteLogs, w.customName!, id)} />
            )}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{fmtQty(w.quantity)} {w.unit}</p>
            <p className="font-bold text-primary">{formatPeso(w.value)}</p>
          </div>
          <div className="flex justify-end gap-2">
          {perm.canEdit("wasteLogs", w.id) && <button type="button" aria-label="Edit waste entry" className="text-muted-foreground hover:text-primary" onClick={() => setEditing(w)}>
            <Pencil className="h-4 w-4" />
          </button>}
          {perm.isOwner && <button
            type="button"
            aria-label="Delete waste entry"
            className=" text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!window.confirm("Delete this waste entry?")) return;
              remove("wasteLogs", w.id);
              toast.success("Waste entry deleted");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>}
          </div>
          <div className="col-span-3"><AuditCaption collection="wasteLogs" record={w} /></div>
        </div>
      ))}
    </div>
  );
}

const isCustom = (w: WasteLog) => !!w.customName && !w.ingredientId && !w.menuItemId;

/** Link every past custom waste entry with this name to the newly created menu item. */
function linkCustom(logs: WasteLog[], name: string, menuItemId: string) {
  const n = normName(name);
  for (const w of logs) if (isCustom(w) && w.stage !== "Ingredient" && normName(w.customName!) === n) put("wasteLogs", { ...w, menuItemId });
}
