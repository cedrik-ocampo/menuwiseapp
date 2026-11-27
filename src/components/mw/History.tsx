import { useEffect, useMemo, useState } from "react";
import { manilaToday } from "@/lib/admin-periods";
import { EXPIRY_FILTER_OPTIONS, PRODUCTION_SORT_OPTIONS, filterBatches, sortBatches, type ExpiryFilter, type ProductionSortKey } from "@/lib/production-sort";
import { Link } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { usePermissions, type DBView } from "@/lib/store";
import type { Batch, Purchase } from "@/lib/types";
import { fmtQty, formatPeso, shortDate, timeOf } from "@/lib/format";
import { AuditCaption } from "./Audit";
import { EditBatchDialog, EditPurchaseDialog } from "./EditDialogs";

export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} className="text-muted-foreground hover:text-primary" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}>
      <Pencil className="h-4 w-4" />
    </button>
  );
}

export function PurchaseEntries({ db, ingredientId }: { db: DBView; ingredientId: string }) {
  const perm = usePermissions();
  const [edit, setEdit] = useState<Purchase | null>(null);
  const ing = db.ingredients.find((i) => i.id === ingredientId);
  const lots = db.purchases.filter((p) => p.ingredientId === ingredientId).sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  if (!lots.length) return <p className="text-sm text-muted-foreground">No ingredient entries yet.</p>;
  return (
    <>
      {edit && <EditPurchaseDialog lot={edit} unit={ing?.unit} onClose={() => setEdit(null)} />}
      <ul className="divide-y divide-border">
        {lots.map((p) => (
          <li key={p.id} className="py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-primary">Bought {shortDate(p.purchaseDate)} · {fmtQty(p.quantity)} {ing?.unit}</p>
                <p className="text-muted-foreground">{fmtQty(p.remaining)} left · Expiry {shortDate(p.expiryDate)} · {formatPeso(p.unitCost)}/{ing?.unit}</p>
              </div>
              {perm.canInventory && <EditButton label="Edit ingredient entry" onClick={() => setEdit(p)} />}
            </div>
            <AuditCaption collection="purchases" record={p} />
          </li>
        ))}
      </ul>
    </>
  );
}

/** All production entries across the café, newest first. */
export function ProductionHistory({ db }: { db: DBView }) {
  const perm = usePermissions();
  const [edit, setEdit] = useState<Batch | null>(null);
  const [limit, setLimit] = useState(15);
  const [sortKey, setSortKeyState] = useState<ProductionSortKey>("date-desc");
  const [itemFilter, setItemFilter] = useState("all");
  const [expiry, setExpiry] = useState<ExpiryFilter>("all");
  useEffect(() => {
    const v = localStorage.getItem("menuwise:productionSort");
    if (v && PRODUCTION_SORT_OPTIONS.some((o) => o.key === v)) setSortKeyState(v as ProductionSortKey);
  }, []);
  const setSortKey = (k: ProductionSortKey) => { setSortKeyState(k); localStorage.setItem("menuwise:productionSort", k); setLimit(15); };
  const item = (id: string) => db.menuItems.find((m) => m.id === id);
  const nameOf = (b: Batch) => item(b.menuItemId)?.name ?? b.menuItemId;
  const itemOptions = useMemo(() => [...new Set(db.batches.map((b) => b.menuItemId))].map((id) => ({ id, name: db.menuItems.find((m) => m.id === id)?.name ?? id })).sort((a, b) => a.name.localeCompare(b.name)), [db]);
  const all = useMemo(() => sortBatches(filterBatches(db.batches, itemFilter, expiry, manilaToday()), sortKey, nameOf), [db, itemFilter, expiry, sortKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const filtered = itemFilter !== "all" || expiry !== "all";
  if (!db.batches.length) return <p className="py-4 text-center text-sm text-muted-foreground">No production logged yet.</p>;
  const selCls = "mt-1 block rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground";
  return (
    <>
      {edit && <EditBatchDialog batch={edit} unit={item(edit.menuItemId)?.batchUnit} onClose={() => setEdit(null)} />}
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-muted-foreground">Sort by
          <select className={selCls} value={sortKey} onChange={(e) => setSortKey(e.target.value as ProductionSortKey)}>
            {PRODUCTION_SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Menu item
          <select className={selCls} value={itemFilter} onChange={(e) => { setItemFilter(e.target.value); setLimit(15); }}>
            <option value="all">All items</option>
            {itemOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Expiry status
          <select className={selCls} value={expiry} onChange={(e) => { setExpiry(e.target.value as ExpiryFilter); setLimit(15); }}>
            {EXPIRY_FILTER_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <p className="ml-auto text-xs text-muted-foreground">
          Showing {Math.min(limit, all.length)} of {all.length} entr{all.length === 1 ? "y" : "ies"}
          {filtered && <button type="button" className="ml-2 font-semibold text-accent hover:underline" onClick={() => { setItemFilter("all"); setExpiry("all"); }}>Clear filters</button>}
        </p>
      </div>
      {all.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No production entries match these filters.</p>}
      {all.length > 0 && <ul className="divide-y divide-border rounded-xl border border-border">
        {all.slice(0, limit).map((b) => {
          const m = item(b.menuItemId);
          return (
            <li key={b.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to="/menu/$id" params={{ id: b.menuItemId }} className="font-semibold text-primary hover:underline">{m?.name ?? b.menuItemId}</Link>
                  <p className="text-muted-foreground">{fmtQty(b.quantity)} {m?.batchUnit} · {shortDate(b.producedAt)} {timeOf(b.producedAt)} · Expiry {shortDate(b.expiryDate)}</p>
                </div>
                {perm.canEdit("batches", b.id) && <EditButton label="Edit production entry" onClick={() => setEdit(b)} />}
              </div>
              <AuditCaption collection="batches" record={b} />
            </li>
          );
        })}
      </ul>}
      {all.length > limit && <button className="mt-2 w-full text-sm font-semibold text-accent" onClick={() => setLimit(limit + 15)}>Show more</button>}
    </>
  );
}
