import { QuickAddItem } from "./QuickAddItem";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { put, useDB } from "@/lib/store";
import { formatPeso, todayISO, uid } from "@/lib/format";
import { saleUnitPrice } from "@/lib/calc";
import type { Sale } from "@/lib/types";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";

/** Manual sale entry / edit. Pass `sale` to edit, or `menuItemId` to pre-pick an item. */
export function SaleDialog({ sale, menuItemId, onClose }: { sale?: Sale; menuItemId?: string; onClose: () => void }) {
  const db = useDB();
  const [date, setDate] = useState(sale?.date ?? todayISO());
  const [itemId, setItemId] = useState(sale?.menuItemId ?? menuItemId ?? db.menuItems[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState(sale ? String(sale.quantity) : "");
  const item = db.menuItems.find((m) => m.id === itemId);
  const [price, setPrice] = useState(sale ? String(saleUnitPrice(db, sale)) : item ? String(item.retailPrice) : "");
  const [notes, setNotes] = useState(sale?.notes ?? "");
  const [err, setErr] = useState<Record<string, string>>({});

  const q = Number(qty), p = Number(price);
  const revenue = Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
  const s = search.trim().toLowerCase();
  const options = db.menuItems.filter((m) => !s || m.name.toLowerCase().includes(s) || m.id.toLowerCase().includes(s) || m.id === itemId);

  function pickItem(id: string) {
    setItemId(id);
    const m = db.menuItems.find((x) => x.id === id);
    if (m) setPrice(String(m.retailPrice));
  }

  function save() {
    const e: Record<string, string> = {};
    if (!item) e.item = "Choose a menu item";
    if (!date || date > todayISO()) e.date = "Pick a date that isn't in the future";
    if (!Number.isInteger(q) || q <= 0) e.qty = "Enter a whole number more than 0";
    if (price === "" || !Number.isFinite(p) || p < 0) e.price = "Enter a price of ₱0 or more";
    setErr(e);
    if (Object.keys(e).length) return;
    put("sales", { ...(sale ?? {}), id: sale?.id ?? uid("S-"), menuItemId: itemId, date, quantity: q, unitPrice: p, revenue: q * p, notes: notes.trim() || undefined });
    toast.success(sale ? "Sale updated" : "Sale saved");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sale ? "Edit sale" : "Manual sale entry"}</DialogTitle>
          <DialogDescription>Daily units sold for one menu item.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Date" required error={err.date}><input type="date" max={todayISO()} className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Menu item" required error={err.item}>
            <input className={`${inputCls} mb-2`} placeholder="Search menu items…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={inputCls} value={itemId} onChange={(e) => pickItem(e.target.value)}>
              {!db.menuItems.length && <option value="">No menu items yet</option>}
              {options.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}
            </select>
            {!sale && <QuickAddItem onCreated={(id, p) => { setItemId(id); setSearch(""); setPrice(String(p)); }} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity" required error={err.qty}><input inputMode="numeric" className={inputCls} value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
            <Field label="Unit price" required error={err.price} hint="From the menu price; you can change it."><input inputMode="decimal" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="₱0.00" /></Field>
          </div>
          <Field label="Revenue"><input className={inputCls} value={formatPeso(revenue)} disabled /></Field>
          <Field label="Notes · optional"><textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        </div>
        <div className="flex gap-3">
          <button className={`${btnSecondary} flex-1`} onClick={onClose}>Cancel</button>
          <button className={`${btnPrimary} flex-1`} onClick={save}>Save</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
