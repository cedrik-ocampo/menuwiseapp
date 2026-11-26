import { useEffect, useState } from "react";
import { toast } from "sonner";
import { put, usePermissions } from "@/lib/store";
import type { Ingredient } from "@/lib/types";
import { Field, Panel, SectionTitle, btnPrimary, inputCls } from "./ui";

const DAYS = [{ v: 1, l: "Mon" }, { v: 2, l: "Tue" }, { v: 3, l: "Wed" }, { v: 4, l: "Thu" }, { v: 5, l: "Fri" }, { v: 6, l: "Sat" }, { v: 0, l: "Sun" }];

/** Lead time, pack size and delivery days used by the reorder suggestions. */
export function OrderingDetails({ ingredient }: { ingredient: Ingredient }) {
  const perm = usePermissions();
  const can = perm.canInventory;
  const init = () => ({ lead: String(ingredient.leadTimeDays ?? 2), pack: ingredient.packSize ? String(ingredient.packSize) : "", min: ingredient.supplierMinimum ? String(ingredient.supplierMinimum) : "", shelf: ingredient.defaultShelfLifeDays ? String(ingredient.defaultShelfLifeDays) : "", days: ingredient.deliveryDays ?? [] });
  const [f, setF] = useState(init);
  useEffect(() => setF(init()), [ingredient.id]); // eslint-disable-line react-hooks/exhaustive-deps
  function save() {
    const lead = Number(f.lead);
    if (!Number.isInteger(lead) || lead < 0 || lead > 30) return void toast.error("Lead time must be 0–30 days");
    const opt = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const pack = opt(f.pack), min = opt(f.min), shelf = opt(f.shelf);
    if ([pack, min, shelf].some((v) => v !== undefined && !(v > 0))) return void toast.error("Pack size, minimum and shelf life must be above 0");
    const next: Ingredient = { ...ingredient, leadTimeDays: lead };
    delete next.packSize; delete next.supplierMinimum; delete next.defaultShelfLifeDays; delete next.deliveryDays;
    put("ingredients", { ...next, ...(pack ? { packSize: pack } : {}), ...(min ? { supplierMinimum: min } : {}), ...(shelf ? { defaultShelfLifeDays: shelf } : {}), ...(f.days.length ? { deliveryDays: f.days } : {}) });
    toast.success("Ordering details saved");
  }
  return (
    <Panel className="mt-4">
      <SectionTitle>Ordering details</SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">Used by Suggested orders on Home. All optional except lead time.</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Lead time (open days)"><input type="number" min={0} className={inputCls} disabled={!can} value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value })} /></Field>
        <Field label={`Pack size (${ingredient.unit})`}><input type="number" min={0} step="any" className={inputCls} disabled={!can} value={f.pack} onChange={(e) => setF({ ...f, pack: e.target.value })} /></Field>
        <Field label={`Supplier minimum (${ingredient.unit})`}><input type="number" min={0} step="any" className={inputCls} disabled={!can} value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></Field>
        <Field label="Shelf life (days)" hint="When a purchase has no expiry"><input type="number" min={0} className={inputCls} disabled={!can} value={f.shelf} onChange={(e) => setF({ ...f, shelf: e.target.value })} /></Field>
      </div>
      <p className="mt-3 text-sm font-semibold text-primary">Supplier delivery days</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Supplier delivery days">
        {DAYS.map((d) => { const on = f.days.includes(d.v); return <button key={d.v} type="button" disabled={!can} aria-pressed={on} onClick={() => setF({ ...f, days: on ? f.days.filter((x) => x !== d.v) : [...f.days, d.v] })} className={`h-9 min-w-12 rounded-lg px-3 text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{d.l}</button>; })}
      </div>
      {can && <button type="button" className={`${btnPrimary} mt-4`} onClick={save}>Save ordering details</button>}
    </Panel>
  );
}
