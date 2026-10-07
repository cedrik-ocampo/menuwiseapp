import { useState } from "react";
import { z } from "zod";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useDB, put } from "@/lib/store";
import type { Ingredient } from "@/lib/types";
import { addDays, formatPeso, todayISO } from "@/lib/format";
import { Field, Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "./ui";

const UNITS = ["L", "ml", "kg", "g", "pc", "pack", "box"];
const CATEGORIES = ["Dairy", "Produce", "Dry goods", "Beverage", "Packaging", "Other"];
const STORAGE = ["Refrigerated", "Frozen", "Pantry"];

export function IngredientForm({ onSaved, onCancel, compact }: { onSaved: (i: Ingredient) => void; onCancel: () => void; compact?: boolean }) {
  const db = useDB();
  const nextId = `ING-${String(db.ingredients.length + 1).padStart(3, "0")}`;
  const [f, setF] = useState({
    id: nextId, name: "", category: "Dairy", storage: "Refrigerated", unit: "kg", supplier: "",
    purchaseDate: todayISO(), expiryDate: addDays(todayISO(), 7), quantity: "", unitCost: "", notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const schema = z
    .object({
      id: z.string().trim().min(1, "Ingredient ID is required").max(20)
        .refine((v) => !db.ingredients.some((i) => i.id.toLowerCase() === v.toLowerCase()), "This Ingredient ID is already used"),
      name: z.string().trim().min(1, "Name is required").max(80),
      unit: z.string().trim().min(1, "Unit is required"),
      quantity: z.number({ invalid_type_error: "Enter a quantity" }).positive("Quantity must be more than 0"),
      unitCost: z.number({ invalid_type_error: "Enter a unit cost" }).min(0, "Unit cost can't be negative"),
      purchaseDate: z.string().min(1, "Purchase date is required"),
      expiryDate: z.string().min(1, "Expiry date is required"),
      supplier: z.string().max(80),
      notes: z.string().max(300),
    })
    .refine((v) => v.expiryDate >= v.purchaseDate, { path: ["expiryDate"], message: "Expiry must be on or after the purchase date" });

  const qty = parseFloat(f.quantity);
  const cost = parseFloat(f.unitCost);

  function save() {
    const r = schema.safeParse({ ...f, quantity: qty, unitCost: cost });
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      setErrors(errs);
      return;
    }
    const ing: Ingredient = { id: f.id.trim(), name: f.name.trim(), category: f.category, storage: f.storage, unit: f.unit, unitCost: cost, supplier: f.supplier.trim() || undefined, notes: f.notes.trim() || undefined };
    put("ingredients", ing);
    put("purchases", { id: `${ing.id}-P1`, ingredientId: ing.id, purchaseDate: f.purchaseDate, expiryDate: f.expiryDate, quantity: qty, remaining: qty, unitCost: cost });
    toast.success(`${ing.name} added`);
    onSaved(ing);
  }

  const Wrap = compact ? "div" : Panel;
  return (
    <div className="space-y-5">
      <Wrap className="space-y-4">
        <SectionTitle>Basic info</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ingredient ID" error={errors.id}><input className={inputCls} value={f.id} onChange={set("id")} /></Field>
          <Field label="Ingredient name" error={errors.name}><input className={inputCls} value={f.name} onChange={set("name")} placeholder="Fresh milk" /></Field>
          <Field label="Category"><select className={inputCls} value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Storage"><select className={inputCls} value={f.storage} onChange={set("storage")}>{STORAGE.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Unit" error={errors.unit}><select className={inputCls} value={f.unit} onChange={set("unit")}>{UNITS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Supplier · optional"><input className={inputCls} value={f.supplier} onChange={set("supplier")} /></Field>
        </div>
      </Wrap>
      <Wrap className="space-y-4">
        <SectionTitle>Purchase & stock</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchase date" error={errors.purchaseDate}><input type="date" className={inputCls} value={f.purchaseDate} onChange={set("purchaseDate")} /></Field>
          <Field label="Expiry date" error={errors.expiryDate}><input type="date" className={inputCls} value={f.expiryDate} onChange={set("expiryDate")} /></Field>
          <Field label={`Quantity purchased (${f.unit})`} error={errors.quantity}><input inputMode="decimal" className={inputCls} value={f.quantity} onChange={set("quantity")} placeholder="0" /></Field>
          <Field label={`Unit cost (per ${f.unit})`} error={errors.unitCost}><input inputMode="decimal" className={inputCls} value={f.unitCost} onChange={set("unitCost")} placeholder="P0.00" /></Field>
        </div>
        <div className="rounded-xl bg-info-soft p-4">
          <p className="text-xs font-semibold text-primary">Current stock value · calculated</p>
          <p className="text-2xl font-bold text-primary">{formatPeso((qty || 0) * (cost || 0))}</p>
        </div>
        <Field label="Notes · optional"><textarea className={`${inputCls} h-20 py-2`} value={f.notes} onChange={set("notes")} /></Field>
      </Wrap>
      <div className="flex gap-3">
        <button type="button" className={`${btnSecondary} flex-1`} onClick={onCancel}>Cancel</button>
        <button type="button" className={`${btnPrimary} flex-1`} onClick={save}><Check className="h-4 w-4" /> Save ingredient</button>
      </div>
    </div>
  );
}
