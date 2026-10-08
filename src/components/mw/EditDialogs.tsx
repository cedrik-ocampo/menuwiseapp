import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { put } from "@/lib/store";
import { WASTE_TYPES, type Batch, type Purchase, type WasteLog, type WasteType } from "@/lib/types";
import { formatPeso } from "@/lib/format";
import { Field, btnPrimary, btnSecondary, inputCls } from "./ui";

function Shell({ title, onClose, onSave, children }: { title: string; onClose: () => void; onSave: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">{children}</div>
        <p className="text-xs text-muted-foreground">Your name and the time will be saved in the change log.</p>
        <div className="flex gap-3">
          <button className={`${btnSecondary} flex-1`} onClick={onClose}>Cancel</button>
          <button className={`${btnPrimary} flex-1`} onClick={onSave}>Save changes</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (iso: string) => {
  const d = new Date(iso);
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

export function EditWasteDialog({ log, onClose }: { log: WasteLog; onClose: () => void }) {
  const p = localParts(log.at);
  const [date, setDate] = useState(p.date);
  const [time, setTime] = useState(p.time);
  const [wasteType, setWasteType] = useState<WasteType>(log.wasteType);
  const [quantity, setQuantity] = useState(String(log.quantity));
  const [unit, setUnit] = useState(log.unit);
  const [unitCost, setUnitCost] = useState(String(log.unitCost));
  const q = parseFloat(quantity), c = parseFloat(unitCost);
  function save() {
    if (!(q > 0)) { toast.error("Quantity must be more than 0"); return; }
    if (!(c >= 0)) { toast.error("Enter a valid unit cost"); return; }
    if (!unit.trim()) { toast.error("Unit is required"); return; }
    put("wasteLogs", { ...log, at: new Date(`${date}T${time}`).toISOString(), wasteType, quantity: q, unit: unit.trim(), unitCost: c, value: +(q * c).toFixed(2) });
    toast.success("Waste entry updated");
    onClose();
  }
  return (
    <Shell title="Edit waste entry" onClose={onClose} onSave={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <Field label="Waste type">
        <select className={inputCls} value={wasteType} onChange={(e) => setWasteType(e.target.value as WasteType)}>{WASTE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity"><input inputMode="decimal" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Unit"><input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
      </div>
      <Field label="Unit cost" hint={`Waste value: ${formatPeso(Number.isFinite(q * c) ? q * c : 0)}`}>
        <input inputMode="decimal" className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
      </Field>
    </Shell>
  );
}

export function EditBatchDialog({ batch, unit, onClose }: { batch: Batch; unit?: string; onClose: () => void }) {
  const p = localParts(batch.producedAt);
  const [date, setDate] = useState(p.date);
  const [time, setTime] = useState(p.time);
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [expiryDate, setExpiry] = useState(batch.expiryDate);
  const [note, setNote] = useState(batch.note ?? "");
  function save() {
    const q = parseFloat(quantity);
    if (!(q > 0)) { toast.error("Quantity must be more than 0"); return; }
    if (expiryDate < date) { toast.error("Expiry must be on or after the production date"); return; }
    put("batches", { ...batch, producedAt: new Date(`${date}T${time}`).toISOString(), quantity: q, expiryDate, note: note.trim() || undefined });
    toast.success("Production entry updated");
    onClose();
  }
  return (
    <Shell title="Edit production entry" onClose={onClose} onSave={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Produced on"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Time"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantity${unit ? ` (${unit})` : ""}`}><input inputMode="decimal" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Expiry date"><input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiry(e.target.value)} /></Field>
      </div>
      <Field label="Note · optional"><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Shell>
  );
}

export function EditPurchaseDialog({ lot, unit, onClose }: { lot: Purchase; unit?: string; onClose: () => void }) {
  const [purchaseDate, setPD] = useState(lot.purchaseDate);
  const [expiryDate, setED] = useState(lot.expiryDate);
  const [quantity, setQuantity] = useState(String(lot.quantity));
  const [remaining, setRemaining] = useState(String(lot.remaining));
  const [unitCost, setUnitCost] = useState(String(lot.unitCost));
  function save() {
    const q = parseFloat(quantity), r = parseFloat(remaining), c = parseFloat(unitCost);
    if (!(q > 0)) { toast.error("Quantity must be more than 0"); return; }
    if (!(r >= 0) || r > q) { toast.error("Remaining must be between 0 and the quantity bought"); return; }
    if (!(c >= 0)) { toast.error("Enter a valid unit cost"); return; }
    if (expiryDate < purchaseDate) { toast.error("Expiry must be on or after the purchase date"); return; }
    put("purchases", { ...lot, purchaseDate, expiryDate, quantity: q, remaining: r, unitCost: c });
    toast.success("Ingredient entry updated");
    onClose();
  }
  return (
    <Shell title="Edit ingredient entry" onClose={onClose} onSave={save}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchase date"><input type="date" className={inputCls} value={purchaseDate} onChange={(e) => setPD(e.target.value)} /></Field>
        <Field label="Expiry date"><input type="date" className={inputCls} value={expiryDate} onChange={(e) => setED(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Bought${unit ? ` (${unit})` : ""}`}><input inputMode="decimal" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label={`Remaining${unit ? ` (${unit})` : ""}`}><input inputMode="decimal" className={inputCls} value={remaining} onChange={(e) => setRemaining(e.target.value)} /></Field>
      </div>
      <Field label="Unit cost"><input inputMode="decimal" className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
    </Shell>
  );
}
