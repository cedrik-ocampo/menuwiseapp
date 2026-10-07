import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Check, Calculator, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDB, put, remove } from "@/lib/store";
import { costPerUnit } from "@/lib/calc";
import { ALLOCATIONS, STAGES, WASTE_TYPES, type Allocation, type Stage, type WasteLog, type WasteType } from "@/lib/types";
import { formatPeso, fmtQty, shortDate, todayISO, uid } from "@/lib/format";
import { Field, Segmented, btnPrimary, inputCls } from "./ui";

const schema = z.object({
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  quantity: z.number({ invalid_type_error: "Enter a quantity" }).positive("Quantity must be more than 0"),
  unit: z.string().trim().min(1, "Unit is required").max(20),
  unitCost: z.number({ invalid_type_error: "Enter a unit cost" }).min(0, "Unit cost can't be negative"),
});

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
  const [wasteType, setWasteType] = useState<WasteType>("Spoilage");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [attributed, setAttributed] = useState("");
  const [allocation, setAllocation] = useState<Allocation>("Direct");
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    if (stage === "Ingredient" && !ingredientId) errs.link = "Choose the ingredient that was lost";
    if (stage === "Finished Product" && !menuItemId) errs.link = "Choose the menu item that was lost";
    if (stage === "WIP" && !menuItemId && !batchId) errs.link = "Link a batch or menu item if known";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const log: WasteLog = {
      id: uid("W-"),
      at: new Date(`${date}T${time}`).toISOString(),
      stage,
      ingredientId: stage === "Ingredient" ? ingredientId : undefined,
      menuItemId: stage !== "Ingredient" ? menuItemId || undefined : undefined,
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
    if (stage === "Ingredient") {
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

      <Field label="Stage" hint="Ingredient → Ingredient ID · WIP → Batch ID · Finished Product → Menu Item ID + batch, if any.">
        {fixedStage ? (
          <div className="rounded-lg bg-secondary p-1"><div className="rounded-md bg-primary py-2 text-center text-xs font-semibold text-primary-foreground">{fixedStage}</div></div>
        ) : (
          <Segmented value={stage} options={STAGES} onChange={setStage} />
        )}
      </Field>

      {stage === "Ingredient" ? (
        <Field label="Ingredient ID" error={errors.link}>
          <select className={inputCls} value={ingredientId} disabled={!!ingFixed} onChange={(e) => setIngredientId(e.target.value)}>
            <option value="">Select ingredient</option>
            {db.ingredients.map((i) => (
              <option key={i.id} value={i.id}>{i.id} · {i.name}</option>
            ))}
          </select>
        </Field>
      ) : (
        <>
          <Field label={stage === "WIP" ? "Menu Item ID · if known" : "Menu Item ID"} error={errors.link}>
            <select className={inputCls} value={menuItemId} disabled={!!menuFixed} onChange={(e) => { setMenuItemId(e.target.value); setBatchId(""); }}>
              <option value="">Select menu item</option>
              {db.menuItems.map((m) => (
                <option key={m.id} value={m.id}>{m.id} · {m.name}</option>
              ))}
            </select>
          </Field>
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

export function WasteList({ logs, empty = "No waste history yet." }: { logs: WasteLog[]; empty?: string }) {
  if (!logs.length) return <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[1fr_1fr_2rem] bg-secondary px-4 py-2 text-xs font-bold uppercase text-primary">
        <span>Date / Waste type</span><span className="text-right">Quantity / Value</span><span />
      </div>
      {logs.map((w) => (
        <div key={w.id} className="grid grid-cols-[1fr_1fr_2rem] items-center border-t border-border px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-primary">{shortDate(w.at)}</p>
            <p className="text-muted-foreground">{w.wasteType}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{fmtQty(w.quantity)} {w.unit}</p>
            <p className="font-bold text-primary">{formatPeso(w.value)}</p>
          </div>
          <button
            type="button"
            aria-label="Delete waste entry"
            className="justify-self-end text-muted-foreground hover:text-destructive"
            onClick={() => {
              if (!window.confirm("Delete this waste entry?")) return;
              remove("wasteLogs", w.id);
              toast.success("Waste entry deleted");
            }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
