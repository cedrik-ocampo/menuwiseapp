import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, X, ExternalLink, Snowflake, Refrigerator, Package } from "lucide-react";
import { toast } from "sonner";
import { put, type DBView } from "@/lib/store";
import { deleteIngredient } from "@/lib/deletes";
import { daysFromToday, formatPeso, fmtQty, shortDate } from "@/lib/format";
import { fileToDataUrl } from "@/lib/image";
import type { Ingredient, Purchase } from "@/lib/types";
import { AuditCaption } from "@/components/mw/Audit";
import { Field, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

export interface IngRow {
  i: Ingredient;
  lot?: Purchase;
  stock: number;
  lastPurchase?: string;
  lastUsed?: string;
}

const STORAGE_ICON: Record<string, typeof Package> = { Refrigerated: Refrigerator, Frozen: Snowflake, Pantry: Package };

/** Border/accent color by expiry urgency. */
function expiryTone(days: number | null, threshold: number) {
  if (days === null) return { ring: "var(--border)", badge: "bg-secondary text-muted-foreground", label: "No expiry" };
  if (days <= 0) return { ring: "var(--destructive)", badge: "bg-destructive text-destructive-foreground", label: days === 0 ? "Expires today" : "Expired" };
  if (days <= threshold) return { ring: "var(--warning)", badge: "bg-warning text-warning-foreground", label: days === 1 ? "1 day left" : `${days} days left` };
  return { ring: "var(--success, var(--primary))", badge: "bg-primary text-primary-foreground", label: `${days} days left` };
}

export function IngredientInventory({ db, rows, threshold }: { db: DBView; rows: IngRow[]; threshold: number }) {
  const [selected, setSelected] = useState<IngRow | null>(null);
  const [editing, setEditing] = useState(false);

  // Keep the open card in sync with live data after edits.
  const live = selected
    ? (() => {
        const i = db.ingredients.find((x) => x.id === selected.i.id);
        return i ? { ...selected, i } : null;
      })()
    : null;

  return (
    <>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No ingredients yet. Add your first ingredient to fill the inventory.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((r) => {
            const d = r.lot ? daysFromToday(r.lot.expiryDate) : null;
            const tone = expiryTone(d, threshold);
            const Icon = STORAGE_ICON[r.i.storage] ?? Package;
            return (
              <button
                key={r.i.id}
                type="button"
                onClick={() => { setSelected(r); setEditing(false); }}
                className="group relative flex flex-col items-center gap-1.5 rounded-xl border-2 bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderColor: tone.ring }}
              >
                <span className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>{tone.label}</span>
                {r.i.image ? (
                  <img src={r.i.image} alt="" className="mt-5 h-14 w-14 rounded-lg border border-border object-cover" />
                ) : (
                  <span className="mt-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-secondary text-xl font-bold text-primary">
                    {r.i.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="line-clamp-2 text-sm font-bold text-primary">{r.i.name}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3 w-3" /> {[r.i.category, r.i.storage].filter(Boolean).join(" · ")}</span>
                <span className="text-sm font-semibold text-primary">{fmtQty(r.stock)} {r.i.unit}</span>
                <span className="text-xs text-muted-foreground">{formatPeso(r.i.unitCost)} / {r.i.unit}</span>
                <span className="text-[11px] text-muted-foreground">Expiry {shortDate(r.lot?.expiryDate)}</span>
              </button>
            );
          })}
        </div>
      )}

      {live && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 bg-card p-5 shadow-xl"
            style={{ borderColor: expiryTone(live.lot ? daysFromToday(live.lot.expiryDate) : null, threshold).ring }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                {live.i.image && <img src={live.i.image} alt="" className="h-14 w-14 rounded-lg border border-border object-cover" />}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-accent">{live.i.id} · {live.i.category}</p>
                  <h3 className="text-xl font-bold text-primary">{live.i.name}</h3>
                </div>
              </div>
              <button type="button" aria-label="Close" className="text-muted-foreground hover:text-primary" onClick={() => setSelected(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {editing ? (
              <EditForm item={live.i} onDone={() => setEditing(false)} onDeleted={() => setSelected(null)} />
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Stock on hand</p>
                    <p className="font-bold text-primary">{fmtQty(live.stock)} {live.i.unit}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Stock value</p>
                    <p className="font-bold text-primary">{formatPeso(live.stock * live.i.unitCost)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Next expiry</p>
                    <p className="font-bold text-primary">{shortDate(live.lot?.expiryDate)}</p>
                    {live.lot && <p className="text-xs font-semibold text-muted-foreground">{expiryTone(daysFromToday(live.lot.expiryDate), threshold).label}</p>}
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Unit cost</p>
                    <p className="font-bold text-primary">{formatPeso(live.i.unitCost)} / {live.i.unit}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {live.i.storage ? `${live.i.storage} storage` : "Storage not set"}{live.i.supplier ? ` · Supplier: ${live.i.supplier}` : ""} · Purchased {shortDate(live.lastPurchase)} · Last used {shortDate(live.lastUsed)}
                </p>
                {live.i.notes && <p className="mt-2 text-sm text-muted-foreground">{live.i.notes}</p>}
                <AuditCaption collection="ingredients" record={live.i} />

                <div className="mt-5 flex flex-col gap-2">
                  <button type="button" className={btnPrimary} onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Modify ingredient
                  </button>
                  <Link to="/ingredients/$id" params={{ id: live.i.id }} className={btnSecondary}>
                    <ExternalLink className="h-4 w-4" /> Open full view
                  </Link>
                  <DeleteButton item={live.i} onDeleted={() => setSelected(null)} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DeleteButton({ item, onDeleted }: { item: Ingredient; onDeleted: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-destructive px-5 text-sm font-semibold text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (!window.confirm(`Delete ${item.name}? Its purchases, usages and waste history will also be removed.`)) return;
        deleteIngredient(item.id);
        toast.success("Ingredient deleted");
        onDeleted();
      }}
    >
      <Trash2 className="h-4 w-4" /> Delete ingredient
    </button>
  );
}

function EditForm({ item, onDone, onDeleted }: { item: Ingredient; onDone: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [storage, setStorage] = useState(item.storage);
  const [unit, setUnit] = useState(item.unit);
  const [unitCost, setUnitCost] = useState(String(item.unitCost));
  const [supplier, setSupplier] = useState(item.supplier ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [image, setImage] = useState(item.image ?? "");

  function save() {
    const cost = parseFloat(unitCost);
    if (!name.trim()) { toast.error("Name is required"); return; }
    if (!unit.trim()) { toast.error("Unit is required"); return; }
    if (!Number.isFinite(cost) || cost < 0) { toast.error("Unit cost must be 0 or more"); return; }
    put("ingredients", {
      ...item,
      name: name.trim(),
      category: category.trim() || item.category,
      storage,
      unit: unit.trim(),
      unitCost: cost,
      supplier: supplier.trim() || undefined,
      notes: notes.trim() || undefined,
      image: image || undefined,
    });
    toast.success("Ingredient updated");
    onDone();
  }

  return (
    <div className="mt-4 space-y-3">
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
        <Field label="Storage">
          <select className={inputCls} value={storage} onChange={(e) => setStorage(e.target.value)}>
            {["Refrigerated", "Frozen", "Pantry"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit"><input className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)} /></Field>
        <Field label="Unit cost (₱)"><input inputMode="decimal" className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></Field>
      </div>
      <Field label="Supplier"><input className={inputCls} value={supplier} onChange={(e) => setSupplier(e.target.value)} /></Field>
      <Field label="Notes"><textarea className={`${inputCls} h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Field label="Image">
        <div className="flex items-center gap-3">
          {image && <img src={image} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />}
          <input type="file" accept="image/*" className={`${inputCls} py-2`} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try { setImage(await fileToDataUrl(file)); } catch { toast.error("Couldn't read that image"); }
          }} />
        </div>
      </Field>
      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnPrimary} flex-1`} onClick={save}>Save changes</button>
        <button type="button" className={btnSecondary} onClick={onDone}>Cancel</button>
      </div>
      <DeleteButton item={item} onDeleted={onDeleted} />
    </div>
  );
}
