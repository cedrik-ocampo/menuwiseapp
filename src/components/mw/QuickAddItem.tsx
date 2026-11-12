import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { put, useDB } from "@/lib/store";
import { uid } from "@/lib/format";
import { NEEDS_REVIEW_TAG } from "@/lib/permissions";
import type { MenuItem } from "@/lib/types";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";

const PRESETS = ["Coffee", "Non-Coffee", "Pastries", "Bread", "Cakes", "Hot Food", "Others"];

/** Shift shortcut: add a missing menu item with just a name, category and selling price. */
export function QuickAddItem({ onCreated }: { onCreated: (id: string, price: number) => void }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const cats = [...new Set([...PRESETS, ...db.menuItems.map((m) => m.category).filter(Boolean)])];

  function save() {
    const n = name.trim(), c = category.trim(), p = Number(price);
    const e: Record<string, string> = {};
    if (!n) e.name = "Enter the item name";
    else if (db.menuItems.some((m) => m.name.trim().toLowerCase() === n.toLowerCase())) e.name = "This item is already on the menu — pick it from the list";
    if (!c) e.category = "Choose a category";
    if (price === "" || !Number.isFinite(p) || p < 0) e.price = "Enter a price of ₱0 or more";
    setErr(e);
    if (Object.keys(e).length) return;
    const item = { id: uid("M-"), name: n, category: c, subcategory: "", description: "Added on shift — needs cost / recipe review", available: true, tags: [NEEDS_REVIEW_TAG], type: "Outsourced", batchCost: 0, yield: 1, purchaseCost: 0, unit: "piece", retailPrice: p, supplier: "", shelfLifeDays: 1, expiryRule: "After the shelf life", defaultBatchSize: 1, batchUnit: "pieces", defaultExpiryDays: 1, defaultWasteStage: "Finished Product", defaultWasteType: "Unsold", allowQuickAdd: true, recipe: [] } as MenuItem;
    try { put("menuItems", item); } catch (x) { toast.error((x as Error).message); return; }
    toast.success(`${n} added to the menu`);
    onCreated(item.id, p);
    setName(""); setCategory(""); setPrice(""); setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
        <Plus className="h-3.5 w-3.5" /> Item not listed? Add it
      </button>
      {open && (
        <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add a missing menu item</DialogTitle>
              <DialogDescription>The owner can add costs or a recipe later.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Field label="Item name" required error={err.name}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
              <Field label="Category" required error={err.category}>
                <input className={inputCls} list="quick-add-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Pastries" />
                <datalist id="quick-add-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Selling price (₱)" required error={err.price}><input type="number" min="0" step="any" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" className={btnSecondary} onClick={() => setOpen(false)}>Cancel</button>
                <button type="button" className={btnPrimary} onClick={save}>Add item</button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
