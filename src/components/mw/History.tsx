import { useState } from "react";
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
              {perm.isOwner && <EditButton label="Edit ingredient entry" onClick={() => setEdit(p)} />}
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
  const all = db.batches.slice().sort((a, b) => b.producedAt.localeCompare(a.producedAt));
  const item = (id: string) => db.menuItems.find((m) => m.id === id);
  if (!all.length) return <p className="py-4 text-center text-sm text-muted-foreground">No production logged yet.</p>;
  return (
    <>
      {edit && <EditBatchDialog batch={edit} unit={item(edit.menuItemId)?.batchUnit} onClose={() => setEdit(null)} />}
      <ul className="divide-y divide-border rounded-xl border border-border">
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
      </ul>
      {all.length > limit && <button className="mt-2 w-full text-sm font-semibold text-accent" onClick={() => setLimit(limit + 15)}>Show more</button>}
    </>
  );
}
