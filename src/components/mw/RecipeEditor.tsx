import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { put, useDB } from "@/lib/store";
import type { MenuItem } from "@/lib/types";
import { compatibleRecipeUnits, ingredientAmountCost, validateRecipeDraft, type RecipeDraftLine } from "@/lib/menu-costing";
import { formatPeso } from "@/lib/format";
import { btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

export function RecipeEditor({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const db = useDB();
  const [lines, setLines] = useState<RecipeDraftLine[]>(item.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit })));
  const [yieldN, setYieldN] = useState(String(item.yield || 1));
  const [purchaseCost, setPurchaseCost] = useState(String(item.purchaseCost || 0));
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ingredients = [...db.ingredients].sort((a, b) => a.name.localeCompare(b.name));
  const costs = lines.map((l) => { const c = ingredientAmountCost(db.ingredients.find((i) => i.id === l.ingredientId), l.quantity, l.unit); return Number.isFinite(c) ? c : 0; });
  const total = costs.reduce((a, c) => a + c, 0);
  const update = (i: number, patch: Partial<RecipeDraftLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  if (item.type === "Outsourced") {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-semibold">Purchase cost per piece (₱)
          <input aria-label="Purchase cost per piece" type="number" min="0" step="0.01" className={inputCls} value={purchaseCost} onChange={(e) => setPurchaseCost(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={() => {
            const v = Number(purchaseCost);
            if (!Number.isFinite(v) || v < 0) { setErrors(["Cost must be 0 or more."]); return; }
            put("menuItems", { ...item, purchaseCost: v });
            toast.success("Cost updated"); onClose();
          }}>Save</button>
        </div>
        {errors.map((e) => <p key={e} className="text-sm text-destructive">{e}</p>)}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr><th className="py-2">Ingredient</th><th>Amount</th><th>Unit</th><th className="text-right">Ingredient Cost</th><th className="text-right">Recipe Share</th><th /></tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const ing = db.ingredients.find((x) => x.id === l.ingredientId);
              const units = compatibleRecipeUnits(ing?.unit);
              return (
                <tr key={i} className="border-t border-border">
                  <td className="py-2 pr-2">
                    <select aria-label={`Ingredient row ${i + 1}`} className={inputCls} value={l.ingredientId} onChange={(e) => {
                      const next = db.ingredients.find((x) => x.id === e.target.value);
                      update(i, { ingredientId: e.target.value, unit: next ? next.unit : l.unit });
                    }}>
                      <option value="">Choose ingredient…</option>
                      {ingredients.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    {ing && <Link to="/ingredients/$id" params={{ id: ing.id }} className="text-xs text-accent hover:underline">Change cost on ingredient page</Link>}
                  </td>
                  <td className="pr-2"><input aria-label={`Amount row ${i + 1}`} type="number" min="0" step="any" className={`${inputCls} w-24`} value={Number.isFinite(l.quantity) ? l.quantity : ""} onChange={(e) => update(i, { quantity: e.target.value === "" ? Number.NaN : Number(e.target.value) })} /></td>
                  <td className="pr-2"><select aria-label={`Unit row ${i + 1}`} className={`${inputCls} w-24`} value={l.unit} onChange={(e) => update(i, { unit: e.target.value })}>{units.map((u) => <option key={u} value={u}>{u}</option>)}</select></td>
                  <td className="text-right">{formatPeso(costs[i])}</td>
                  <td className="text-right">{total > 0 ? ((costs[i] / total) * 100).toFixed(1) : "0.0"}%</td>
                  <td className="pl-2 text-right"><button type="button" aria-label={`Remove row ${i + 1}`} className="text-muted-foreground hover:text-destructive" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="border-t border-border font-bold text-primary"><td className="py-2" colSpan={3}>Total ingredient cost</td><td className="text-right">{formatPeso(total)}</td><td className="text-right">100%</td><td /></tr></tfoot>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <button type="button" className={btnSecondary} onClick={() => setLines((ls) => [...ls, { ingredientId: "", quantity: 1, unit: "g" }])}><Plus className="mr-1 inline h-4 w-4" />Add ingredient</button>
        {item.type === "In-house" && (
          <label className="text-sm font-semibold">Batch makes ({item.batchUnit})
            <input aria-label="Batch yield" type="number" min="1" step="1" className={`${inputCls} w-28`} value={yieldN} onChange={(e) => setYieldN(e.target.value)} />
          </label>
        )}
        <div className="ml-auto flex gap-2">
          <button type="button" className={btnSecondary} onClick={onClose}>Cancel</button>
          <button type="button" className={btnPrimary} onClick={() => {
            const errs = validateRecipeDraft(lines, db.ingredients);
            const y = item.type === "In-house" ? Number(yieldN) : 1;
            if (!(y > 0)) errs.push("Batch yield must be more than 0.");
            setErrors(errs);
            if (errs.length) return;
            put("menuItems", { ...item, recipe: lines.map((l) => ({ allocation: item.recipe.find((r) => r.ingredientId === l.ingredientId)?.allocation ?? "Recipe-based", ...l })), batchCost: total, yield: y });
            toast.success("Recipe saved"); onClose();
          }}>Save recipe</button>
        </div>
      </div>
      {errors.length > 0 && <ul className="mt-2 text-sm text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}
