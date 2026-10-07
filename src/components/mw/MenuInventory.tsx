import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Pencil, Trash2, X, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { put, type DBView } from "@/lib/store";
import { deleteMenuItem } from "@/lib/deletes";
import { costPerUnit, margin, wasteColor, type Quadrant } from "@/lib/calc";
import { formatPeso } from "@/lib/format";
import { ITEM_TYPES, type ItemType, type MenuItem } from "@/lib/types";
import { Field, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

export interface InvRow {
  item: MenuItem;
  popularity: number;
  profit: number;
  waste: number;
  intensity: number;
  quadrant: Quadrant;
}

const RARITY: Record<Quadrant, { label: string; ring: string }> = {
  Stars: { label: "Star", ring: "oklch(0.75 0.16 95)" },
  Plowhorses: { label: "Plowhorse", ring: "oklch(0.65 0.12 230)" },
  Puzzles: { label: "Puzzle", ring: "oklch(0.7 0.14 300)" },
  Dogs: { label: "Dog", ring: "oklch(0.6 0.1 30)" },
};

export function MenuInventory({ db, rows }: { db: DBView; rows: InvRow[] }) {
  const [selected, setSelected] = useState<InvRow | null>(null);
  const [editing, setEditing] = useState(false);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.item.name.localeCompare(b.item.name)),
    [rows],
  );

  // Keep the open card in sync with live data after edits.
  const live = selected
    ? (() => {
        const item = db.menuItems.find((m) => m.id === selected.item.id);
        return item ? { ...selected, item } : null;
      })()
    : null;

  return (
    <>
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No menu items yet. Add your first item to fill the inventory.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((r) => {
            const rarity = RARITY[r.quadrant];
            return (
              <button
                key={r.item.id}
                type="button"
                onClick={() => {
                  setSelected(r);
                  setEditing(false);
                }}
                className="group relative flex flex-col items-center gap-2 rounded-xl border-2 bg-card p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                style={{ borderColor: rarity.ring, background: `color-mix(in oklab, ${wasteColor(r.intensity)} 10%, var(--card))` }}
              >
                <span
                  className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground"
                  style={{ background: rarity.ring }}
                >
                  {rarity.label}
                </span>
                {!r.item.available && (
                  <span className="absolute right-2 top-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    Hidden
                  </span>
                )}
                <span className="mt-5 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-secondary text-xl font-bold text-primary">
                  {r.item.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="line-clamp-2 text-sm font-bold text-primary">{r.item.name}</span>
                <span className="text-xs text-muted-foreground">{r.item.category}</span>
                <span className="text-xs font-semibold text-primary">{formatPeso(r.item.retailPrice)}</span>
                {r.waste > 0 && (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: wasteColor(r.intensity), color: "white" }}>
                    Waste {formatPeso(r.waste)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {live && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 bg-card p-5 shadow-xl"
            style={{ borderColor: RARITY[live.quadrant].ring }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: RARITY[live.quadrant].ring }}>
                  {RARITY[live.quadrant].label} · {live.item.category}
                </p>
                <h3 className="text-xl font-bold text-primary">{live.item.name}</h3>
              </div>
              <button type="button" aria-label="Close" className="text-muted-foreground hover:text-primary" onClick={() => setSelected(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {editing ? (
              <EditForm
                item={live.item}
                onDone={() => setEditing(false)}
                onDeleted={() => setSelected(null)}
              />
            ) : (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Retail price</p>
                    <p className="font-bold text-primary">{formatPeso(live.item.retailPrice)}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Cost per unit</p>
                    <p className="font-bold text-primary">{formatPeso(costPerUnit(live.item))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Margin</p>
                    <p className="font-bold text-primary">{formatPeso(margin(live.item))}</p>
                  </div>
                  <div className="rounded-lg bg-secondary p-3">
                    <p className="text-xs text-muted-foreground">Waste value</p>
                    <p className="font-bold" style={{ color: wasteColor(live.intensity) }}>{formatPeso(live.waste)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {live.item.type} · Batch unit: {live.item.batchUnit} · {live.item.available ? "Available on the menu" : "Hidden from the menu"}
                </p>
                {live.item.description && <p className="mt-2 text-sm text-muted-foreground">{live.item.description}</p>}

                <div className="mt-5 flex flex-col gap-2">
                  <button type="button" className={btnPrimary} onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4" /> Modify item
                  </button>
                  <Link to="/menu/$id" params={{ id: live.item.id }} className={btnSecondary}>
                    <ExternalLink className="h-4 w-4" /> Open full view
                  </Link>
                  <DeleteButton item={live.item} onDeleted={() => setSelected(null)} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function DeleteButton({ item, onDeleted }: { item: MenuItem; onDeleted: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-destructive px-5 text-sm font-semibold text-destructive hover:bg-destructive/10"
      onClick={() => {
        if (!window.confirm(`Delete ${item.name}? Its batches, sales and waste history will also be removed.`)) return;
        deleteMenuItem(item.id);
        toast.success("Menu item deleted");
        onDeleted();
      }}
    >
      <Trash2 className="h-4 w-4" /> Delete item
    </button>
  );
}

function EditForm({ item, onDone, onDeleted }: { item: MenuItem; onDone: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [type, setType] = useState<ItemType>(item.type);
  const [retail, setRetail] = useState(String(item.retailPrice));
  const [batchUnit, setBatchUnit] = useState(item.batchUnit);
  const [available, setAvailable] = useState(item.available);
  const [description, setDescription] = useState(item.description);

  function save() {
    const price = parseFloat(retail);
    if (!name.trim()) return toast.error("Name is required");
    if (!category.trim()) return toast.error("Category is required");
    if (!Number.isFinite(price) || price < 0) return toast.error("Retail price must be 0 or more");
    if (!batchUnit.trim()) return toast.error("Batch unit is required");
    put("menuItems", {
      ...item,
      name: name.trim(),
      category: category.trim(),
      type,
      retailPrice: price,
      batchUnit: batchUnit.trim(),
      available,
      description: description.trim(),
    });
    toast.success("Menu item updated");
    onDone();
  }

  return (
    <div className="mt-4 space-y-3">
      <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category"><input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} /></Field>
        <Field label="Type">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as ItemType)}>
            {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Retail price (₱)"><input inputMode="decimal" className={inputCls} value={retail} onChange={(e) => setRetail(e.target.value)} /></Field>
        <Field label="Batch unit"><input className={inputCls} value={batchUnit} onChange={(e) => setBatchUnit(e.target.value)} /></Field>
      </div>
      <Field label="Description"><textarea className={`${inputCls} h-20 py-2`} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
      <label className="flex items-center gap-2 text-sm font-semibold text-primary">
        <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} className="h-4 w-4" />
        Available on the menu
      </label>
      <div className="flex gap-2 pt-1">
        <button type="button" className={`${btnPrimary} flex-1`} onClick={save}>Save changes</button>
        <button type="button" className={btnSecondary} onClick={onDone}>Cancel</button>
      </div>
      <DeleteButton item={item} onDeleted={onDeleted} />
    </div>
  );
}
