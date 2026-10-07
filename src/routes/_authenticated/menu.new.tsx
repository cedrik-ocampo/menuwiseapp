import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useDB, put } from "@/lib/store";
import { costPerUnit, foodCostPct, margin, recipeCost } from "@/lib/calc";
import { ALLOCATIONS, ITEM_TYPES, STAGES, WASTE_TYPES, type Allocation, type MenuItem, type RecipeLine } from "@/lib/types";
import { formatPeso } from "@/lib/format";
import { Field, Panel, Segmented, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";
import { IngredientForm } from "@/components/mw/IngredientForm";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/menu/new")({
  head: () => ({
    meta: [
      { title: "Add New Menu Item — MenuWise" },
      { name: "description", content: "Set up a menu item, map its recipe and set production and waste defaults." },
      { property: "og:title", content: "Add New Menu Item — MenuWise" },
      { property: "og:description", content: "Set up a menu item, map its recipe and set production and waste defaults." },
    ],
  }),
  component: AddMenuItem,
});

const CATS: Record<string, string[]> = {
  Pastry: ["Viennoiserie", "Bread", "Tart", "Cake", "Cookie"],
  Drinks: ["Espresso", "Non-coffee", "Tea", "Cold drinks"],
};
const STEPS = ["Basic Info", "Type & Cost", "Recipe", "Production & Waste Defaults", "Review"];

type Draft = Omit<MenuItem, "recipe"> & { recipe: (RecipeLine & { key: number })[]; tagsText: string };

function blank(nextId: string): Draft {
  return {
    id: nextId, name: "", category: "Pastry", subcategory: "Viennoiserie", description: "", available: true, tags: [], tagsText: "",
    type: "In-house", batchCost: 0, yield: 1, purchaseCost: 0, unit: "pieces", retailPrice: 0, supplier: "", shelfLifeDays: 2,
    expiryRule: "Expires after shelf life", defaultBatchSize: 12, batchUnit: "pieces", defaultExpiryDays: 2,
    defaultWasteStage: "Finished Product", defaultWasteType: "Unsold", allowQuickAdd: true, recipe: [],
  };
}

function AddMenuItem() {
  const db = useDB();
  const navigate = useNavigate();
  const nextId = `MI-${String(db.menuItems.length + 1).padStart(3, "0")}`;
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>(() => blank(nextId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [drawerRow, setDrawerRow] = useState<number | null>(null);
  const [batchTouched, setBatchTouched] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const outsourced = d.type === "Outsourced";

  const recipeTotal = recipeCost(db, d);
  const effective: Draft = { ...d, batchCost: !outsourced && !batchTouched && d.recipe.length ? +recipeTotal.toFixed(2) : d.batchCost };
  const cpu = costPerUnit(effective);

  function validate(upTo: number) {
    const e: Record<string, string> = {};
    if (upTo >= 0) {
      if (!d.id.trim()) e.id = "Menu Item ID is required";
      else if (db.menuItems.some((m) => m.id.toLowerCase() === d.id.trim().toLowerCase())) e.id = "This Menu Item ID is already used";
      if (!d.name.trim()) e.name = "Menu item name is required";
      else if (d.name.length > 80) e.name = "Keep the name under 80 characters";
      if (!d.category) e.category = "Choose a category";
    }
    if (upTo >= 1) {
      if (!(d.retailPrice >= 0) || !d.retailPrice) e.retailPrice = "Retail price is required (0 or more)";
      if (outsourced) {
        if (!(d.purchaseCost > 0)) e.purchaseCost = "Purchase cost per unit must be more than 0";
        if (!d.unit.trim()) e.unit = "Unit is required";
      } else {
        if (!(effective.batchCost >= 0)) e.batchCost = "Batch cost can't be negative";
        if (!(d.yield > 0)) e.yield = "Yield must be more than 0";
      }
      if (!(d.shelfLifeDays >= 0) || Number.isNaN(d.shelfLifeDays)) e.shelfLifeDays = "Shelf life is required";
    }
    if (upTo >= 2 && !outsourced) {
      d.recipe.forEach((r, i) => {
        if (!r.ingredientId) e[`r${i}`] = "Choose an ingredient";
        else if (!(r.quantity > 0)) e[`r${i}`] = "Quantity must be more than 0";
      });
    }
    if (upTo >= 3) {
      if (!(d.defaultBatchSize > 0)) e.defaultBatchSize = "Default batch size must be more than 0";
      if (!d.batchUnit.trim()) e.batchUnit = "Batch unit is required";
    }
    setErrors(e);
    return e;
  }

  function next() {
    const e = validate(step);
    if (Object.keys(e).length) return;
    setStep((s) => Math.min(4, s === 1 && outsourced ? 3 : s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s === 3 && outsourced ? 1 : s - 1));
  }

  function save(addAnother: boolean) {
    const e = validate(3);
    if (Object.keys(e).length) {
      const first = Object.keys(e)[0];
      setStep(["id", "name", "category"].includes(first) ? 0 : first.startsWith("r") ? 2 : ["defaultBatchSize", "batchUnit"].includes(first) ? 3 : 1);
      return;
    }
    const { tagsText, recipe, ...rest } = effective;
    const item: MenuItem = {
      ...rest,
      id: d.id.trim(),
      name: d.name.trim(),
      tags: tagsText.split(",").map((t) => t.trim()).filter(Boolean),
      recipe: outsourced ? [] : recipe.map(({ key: _k, ...r }) => r),
      batchCost: outsourced ? 0 : effective.batchCost,
    };
    put("menuItems", item);
    toast.success(`${item.name} saved`);
    if (addAnother) {
      setD(blank(`MI-${String(db.menuItems.length + 2).padStart(3, "0")}`));
      setBatchTouched(false);
      setStep(0);
    } else navigate({ to: "/menu/$id", params: { id: item.id } });
  }

  const num = (v: string) => (v === "" ? 0 : parseFloat(v));

  const Summary = (
    <Panel className="space-y-2 text-sm">
      <p className="font-bold text-primary">Menu item summary</p>
      {[
        ["Menu Item ID", d.id || "—"],
        ["Name", d.name || "—"],
        ["Type", d.type],
        ["Cost per Unit", formatPeso(cpu)],
        ["Retail Price", formatPeso(d.retailPrice)],
        ["Margin", formatPeso(margin(effective))],
        ["Food Cost %", `${foodCostPct(effective).toFixed(1)}%`],
        ["Ingredients Count", outsourced ? "Not tracked" : String(d.recipe.length)],
        ["Expiry Rule", `${d.shelfLifeDays} day${d.shelfLifeDays === 1 ? "" : "s"} · ${d.expiryRule}`],
        ["Waste Defaults", `${d.defaultWasteStage} · ${d.defaultWasteType}`],
      ].map(([k, v]) => (
        <p key={k} className="flex justify-between gap-2 border-b border-border pb-1"><span className="text-muted-foreground">{k}</span><b className="text-right text-primary">{v}</b></p>
      ))}
    </Panel>
  );

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-2 text-sm text-accent">
        <Link to="/menu" className="font-medium hover:underline">Menu Overview</Link> <span className="text-muted-foreground">&gt;</span> <span className="text-muted-foreground">Add New Menu Item</span>
      </nav>
      <h2 className="text-2xl font-bold text-primary md:text-3xl">Add New Menu Item</h2>
      <ol className="my-5 flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              disabled={i > step}
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"} ${outsourced && i === 2 ? "line-through opacity-60" : ""}`}
            >
              {i < 4 ? `${i + 1} ` : ""}{s}
            </button>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {step === 0 && (
            <Panel className="grid gap-4 sm:grid-cols-2">
              <Field label="Menu Item ID *" hint="Auto-filled; you can type your own." error={errors.id}><input className={inputCls} value={d.id} onChange={(e) => set("id", e.target.value)} /></Field>
              <Field label="Menu Item Name *" error={errors.name}><input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Custard Bun" /></Field>
              <Field label="Category *" error={errors.category}>
                <select className={inputCls} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value, subcategory: CATS[e.target.value][0] })}>
                  {Object.keys(CATS).map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Subcategory">
                <select className={inputCls} value={d.subcategory} onChange={(e) => set("subcategory", e.target.value)}>
                  {CATS[d.category].map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <div className="sm:col-span-2"><Field label="Description"><textarea className={`${inputCls} h-20 py-2`} maxLength={300} value={d.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
              <Field label="Image · optional" hint="Stored on this device only for now."><input type="file" accept="image/*" className={`${inputCls} py-2`} /></Field>
              <Field label="Tags" hint="Separate with commas"><input className={inputCls} value={d.tagsText} onChange={(e) => set("tagsText", e.target.value)} placeholder="bestseller, breakfast" /></Field>
              <label className="flex items-center gap-3 text-sm font-semibold text-primary"><Switch checked={d.available} onCheckedChange={(v) => set("available", v)} /> Available for Sale</label>
            </Panel>
          )}

          {step === 1 && (
            <Panel className="space-y-4">
              <Segmented value={d.type} options={ITEM_TYPES} onChange={(v) => set("type", v)} />
              {outsourced ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Purchase Cost per Unit *" error={errors.purchaseCost}><input inputMode="decimal" className={inputCls} value={d.purchaseCost || ""} onChange={(e) => set("purchaseCost", num(e.target.value))} /></Field>
                  <Field label="Unit *" error={errors.unit}><input className={inputCls} value={d.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
                  <Field label="Retail Price *" error={errors.retailPrice}><input inputMode="decimal" className={inputCls} value={d.retailPrice || ""} onChange={(e) => set("retailPrice", num(e.target.value))} /></Field>
                  <Field label="Supplier"><input className={inputCls} value={d.supplier} onChange={(e) => set("supplier", e.target.value)} /></Field>
                  <Field label="Shelf Life (days) *" error={errors.shelfLifeDays}><input inputMode="numeric" className={inputCls} value={d.shelfLifeDays} onChange={(e) => set("shelfLifeDays", num(e.target.value))} /></Field>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Batch Cost" hint={d.recipe.length && !batchTouched ? "Taken from the recipe total. Type to override." : "Total cost to make one batch."} error={errors.batchCost}>
                    <input inputMode="decimal" className={inputCls} value={effective.batchCost || ""} onChange={(e) => { setBatchTouched(true); set("batchCost", num(e.target.value)); }} />
                  </Field>
                  <Field label="Yield *" hint="Units per batch" error={errors.yield}><input inputMode="numeric" className={inputCls} value={d.yield || ""} onChange={(e) => set("yield", num(e.target.value))} /></Field>
                  <Field label="Cost per Unit · computed"><input className={inputCls} disabled value={formatPeso(cpu)} /></Field>
                  <Field label="Standard Recipe Cost · computed"><input className={inputCls} disabled value={formatPeso(recipeTotal)} /></Field>
                  <Field label="Retail Price *" error={errors.retailPrice}><input inputMode="decimal" className={inputCls} value={d.retailPrice || ""} onChange={(e) => set("retailPrice", num(e.target.value))} /></Field>
                  <Field label="Margin · computed"><input className={inputCls} disabled value={formatPeso(margin(effective))} /></Field>
                  <Field label="Food Cost % · computed"><input className={inputCls} disabled value={`${foodCostPct(effective).toFixed(1)}%`} /></Field>
                  <Field label="Shelf Life (days) *" error={errors.shelfLifeDays}><input inputMode="numeric" className={inputCls} value={d.shelfLifeDays} onChange={(e) => set("shelfLifeDays", num(e.target.value))} /></Field>
                  <div className="sm:col-span-2">
                    <Field label="Default Expiry Rule">
                      <select className={inputCls} value={d.expiryRule} onChange={(e) => set("expiryRule", e.target.value)}>
                        <option>Expires after shelf life</option><option>Same day (end of day)</option><option>Made to order (no shelf life)</option>
                      </select>
                    </Field>
                  </div>
                </div>
              )}
            </Panel>
          )}

          {step === 2 && (
            <Panel className="space-y-4">
              {outsourced ? (
                <p className="text-sm text-muted-foreground">Outsourced items don't track raw ingredients. Waste is logged as finished-product waste under the menu item.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-secondary text-xs uppercase text-primary">
                        <tr>{["Ingredient ID", "Ingredient Name", "Quantity", "Unit", "Unit Cost", "Line Cost", "% of Recipe Cost", "Allocation Method", ""].map((h) => <th key={h} className="p-2">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {d.recipe.map((r, i) => {
                          const ing = db.ingredients.find((x) => x.id === r.ingredientId);
                          const line = r.quantity * (ing?.unitCost ?? 0);
                          return (
                            <tr key={r.key} className="border-t border-border align-top">
                              <td className="p-2">
                                <select className={`${inputCls} h-9`} value={r.ingredientId} onChange={(e) => {
                                  if (e.target.value === "__new") return setDrawerRow(i);
                                  const ni = db.ingredients.find((x) => x.id === e.target.value);
                                  set("recipe", d.recipe.map((x, j) => (j === i ? { ...x, ingredientId: e.target.value, unit: ni?.unit ?? x.unit } : x)));
                                }}>
                                  <option value="">Search ingredient…</option>
                                  {db.ingredients.map((x) => <option key={x.id} value={x.id}>{x.id}</option>)}
                                  <option value="__new">+ Create new ingredient</option>
                                </select>
                                {errors[`r${i}`] && <p className="mt-1 text-xs text-destructive">{errors[`r${i}`]}</p>}
                              </td>
                              <td className="p-2 pt-4 font-semibold text-primary">{ing?.name ?? "—"}</td>
                              <td className="p-2"><input inputMode="decimal" className={`${inputCls} h-9 w-20`} value={r.quantity || ""} onChange={(e) => set("recipe", d.recipe.map((x, j) => (j === i ? { ...x, quantity: num(e.target.value) } : x)))} /></td>
                              <td className="p-2 pt-4">{r.unit || ing?.unit || "—"}</td>
                              <td className="p-2 pt-4">{formatPeso(ing?.unitCost ?? 0)}</td>
                              <td className="p-2 pt-4 font-semibold">{formatPeso(line)}</td>
                              <td className="p-2 pt-4">{recipeTotal ? ((line / recipeTotal) * 100).toFixed(0) : 0}%</td>
                              <td className="p-2">
                                <select className={`${inputCls} h-9`} value={r.allocation} onChange={(e) => set("recipe", d.recipe.map((x, j) => (j === i ? { ...x, allocation: e.target.value as Allocation } : x)))}>
                                  {ALLOCATIONS.map((a) => <option key={a}>{a}</option>)}
                                </select>
                              </td>
                              <td className="p-2 pt-3"><button aria-label="Remove row" onClick={() => set("recipe", d.recipe.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-destructive" /></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={btnSecondary} onClick={() => set("recipe", [...d.recipe, { key: Date.now(), ingredientId: "", quantity: 0, unit: "", allocation: "Recipe-based" }])}><Plus className="h-4 w-4" /> Add Ingredient Row</button>
                    <button type="button" className={btnSecondary} onClick={() => { set("recipe", [...d.recipe, { key: Date.now(), ingredientId: "", quantity: 0, unit: "", allocation: "Recipe-based" }]); setDrawerRow(d.recipe.length); }}><Plus className="h-4 w-4" /> Create new ingredient</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-info-soft p-4 text-sm md:grid-cols-4">
                    <p><span className="block text-xs text-muted-foreground">Total Recipe Cost</span><b className="text-primary">{formatPeso(recipeTotal)}</b></p>
                    <p><span className="block text-xs text-muted-foreground">Batch Cost</span><b className="text-primary">{formatPeso(effective.batchCost)}</b></p>
                    <p><span className="block text-xs text-muted-foreground">Cost per Unit</span><b className="text-primary">{formatPeso(cpu)}</b></p>
                    <p><span className="block text-xs text-muted-foreground">Yield</span><b className="text-primary">{d.yield} {d.batchUnit}</b></p>
                  </div>
                </>
              )}
            </Panel>
          )}

          {step === 3 && (
            <Panel className="grid gap-4 sm:grid-cols-2">
              <Field label="Default Batch Size *" error={errors.defaultBatchSize}><input inputMode="numeric" className={inputCls} value={d.defaultBatchSize || ""} onChange={(e) => set("defaultBatchSize", num(e.target.value))} /></Field>
              <Field label="Batch Unit *" error={errors.batchUnit}><input className={inputCls} value={d.batchUnit} onChange={(e) => set("batchUnit", e.target.value)} /></Field>
              <Field label="Default Expiry After Production (days)"><input inputMode="numeric" className={inputCls} value={d.defaultExpiryDays} onChange={(e) => set("defaultExpiryDays", num(e.target.value))} /></Field>
              <Field label="Default Waste Stage">
                <select className={inputCls} value={d.defaultWasteStage} onChange={(e) => set("defaultWasteStage", e.target.value as never)}>{STAGES.filter((s) => s !== "Ingredient").map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <Field label="Default Waste Type">
                <select className={inputCls} value={d.defaultWasteType} onChange={(e) => set("defaultWasteType", e.target.value as never)}>{WASTE_TYPES.map((s) => <option key={s}>{s}</option>)}</select>
              </Field>
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-semibold text-primary"><Switch checked={d.allowQuickAdd} onCheckedChange={(v) => set("allowQuickAdd", v)} /> Allow Quick Add Batch</label>
              <div className="rounded-xl bg-muted p-4 text-sm sm:col-span-2">
                <p className="font-semibold text-primary">Initial metrics</p>
                <p className="text-muted-foreground">Amt. Produced for the Week: 0 · Average Weekly Production: 0 · Average Weekly Sales: 0. These update as you log production and sales.</p>
              </div>
            </Panel>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Everything looks ready? Saving creates this menu item and opens its page.</p>
              {Summary}
            </div>
          )}

          <div className="sticky bottom-20 z-30 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3 shadow-lg md:bottom-4">
            <button type="button" className={btnSecondary} onClick={() => navigate({ to: "/menu" })}>Cancel</button>
            <button type="button" className={btnSecondary} disabled={step === 0} onClick={back}>Back</button>
            <button type="button" className={btnSecondary} disabled={step === 4} onClick={next}>Next</button>
            <button type="button" className={`${btnSecondary} ml-auto`} onClick={() => save(true)}>Save & Add Another</button>
            <button type="button" className={btnPrimary} onClick={() => save(false)}><Check className="h-4 w-4" /> Save</button>
          </div>
        </div>
        {step !== 4 && <aside className="lg:sticky lg:top-6 lg:self-start">{Summary}</aside>}
      </div>

      <Sheet open={drawerRow !== null} onOpenChange={(o) => !o && setDrawerRow(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <p className="text-xs text-accent">Ingredient Inventory &gt; Manual Input</p>
            <SheetTitle>Add Ingredient</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <IngredientForm
              compact
              onCancel={() => setDrawerRow(null)}
              onSaved={(ing) => {
                set("recipe", d.recipe.map((x, j) => (j === drawerRow ? { ...x, ingredientId: ing.id, unit: ing.unit } : x)));
                setDrawerRow(null);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
