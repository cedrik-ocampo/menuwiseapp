import { useMemo, useState } from "react";
import { PackageCheck, Scale, Truck } from "lucide-react";
import { toast } from "sonner";
import { currentUser, put, useDB } from "@/lib/store";
import { manilaToday } from "@/lib/admin-periods";
import { fmtQty, shortDate, uid } from "@/lib/format";
import { CAP_OPTIONS, compareCaps, type Confidence } from "@/lib/reorder";
import { batchList, calendarOf, reorderList, suggestionSettings } from "@/lib/suggestions-data";
import { shiftDate } from "@/lib/operating-calendar";
import type { Ingredient, Purchase, SuggestionFeedback } from "@/lib/types";
import { Field, Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "./ui";

const confTone: Record<Confidence, string> = { High: "bg-success/15 text-success", Medium: "bg-warning-soft text-warning", Low: "bg-muted text-muted-foreground" };
export function ConfidenceBadge({ value }: { value: Confidence }) {
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${confTone[value]}`}>{value} confidence</span>;
}
const Tag = ({ children }: { children: string }) => <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">{children}</span>;

function logFeedback(entry: Omit<SuggestionFeedback, "id" | "date">) {
  put("suggestionFeedback", { ...entry, id: uid("SF-"), date: manilaToday() });
}

function OrderDialog({ ingredient, qty, arrival, onClose, onSaved }: { ingredient: Ingredient; qty: number; arrival: string; onClose: () => void; onSaved: (q: number) => void }) {
  const [amount, setAmount] = useState(String(qty));
  const [date, setDate] = useState(arrival);
  function save() {
    const q = Number(amount);
    if (!(q > 0)) return void toast.error("Enter an amount above 0");
    const today = manilaToday();
    const purchase: Purchase = { id: uid(`${ingredient.id}-O`), ingredientId: ingredient.id, purchaseDate: today, expiryDate: "", quantity: q, remaining: 0, unitCost: ingredient.unitCost, ordered: true, expectedDate: date };
    put("purchases", purchase);
    onSaved(q);
    toast.success(`${ingredient.name}: ${fmtQty(q)} ${ingredient.unit} marked as ordered`);
    onClose();
  }
  return (
    <div role="dialog" aria-label={`Order ${ingredient.name}`} className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <p className="font-bold text-primary">Mark {ingredient.name} as ordered</p>
        <Field label={`Amount (${ingredient.unit})`}><input type="number" min={0} step="any" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Expected delivery"><input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <p className="text-xs text-muted-foreground">It counts as "on order" until you tap Received; then it is added to stock.</p>
        <div className="flex justify-end gap-2"><button type="button" className={btnSecondary} onClick={onClose}>Cancel</button><button type="button" className={btnPrimary} onClick={save}>Save order</button></div>
      </div>
    </div>
  );
}

function receive(p: Purchase, shelf: number | undefined) {
  const today = manilaToday();
  put("purchases", { ...p, ordered: false, purchaseDate: today, remaining: p.quantity, expiryDate: shelf ? shiftDate(today, shelf) : "" });
  toast.success("Delivery added to stock");
}

/** "Suggested orders and batches" — reorder list for stock managers, batches for everyone who plans production. */
export function SuggestedOrders({ showBatches = true }: { showBatches?: boolean }) {
  const db = useDB();
  const today = manilaToday();
  const settings = suggestionSettings(db);
  const calendar = calendarOf(db, today);
  const reorders = useMemo(() => reorderList(db, today), [db, today]);
  const batches = useMemo(() => batchList(db, today), [db, today]);
  const [showAll, setShowAll] = useState(false);
  const [compare, setCompare] = useState(false);
  const [ordering, setOrdering] = useState<{ ing: Ingredient; qty: number; arrival: string; conf: Confidence } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const todaysFeedback = new Map(db.suggestionFeedback.filter((f) => f.date === today).map((f) => [`${f.kind}:${f.targetId}`, f]));
  const actionable = reorders.filter((r) => r.result.status === "Order now" || r.result.status === "Order by");
  const rows = (showAll ? reorders : actionable).filter((r) => showAll || todaysFeedback.get(`reorder:${r.ingredient.id}`)?.action !== "ignored");
  const byCap = CAP_OPTIONS.map((cap) => {
    const f = db.suggestionFeedback.filter((x) => x.kind === "reorder" && x.wasteCapPct === cap);
    return { cap, total: f.length, accepted: f.filter((x) => x.action === "accepted").length, edited: f.filter((x) => x.action === "edited").length };
  }).filter((x) => x.total > 0);

  return (
    <Panel>
      <SectionTitle right={<span className="text-xs text-muted-foreground">Waste cap {settings.wasteCapPct}%{calendar.confirmed ? "" : " · open days estimated"}</span>}>Suggested orders and batches</SectionTitle>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-bold text-primary"><Truck className="h-4 w-4" />Reorder list</p>
        <div className="flex gap-2">
          <button type="button" className="text-xs font-semibold text-accent hover:underline" aria-pressed={compare} onClick={() => setCompare(!compare)}><Scale className="mr-1 inline h-3.5 w-3.5" />{compare ? "Hide" : "Compare"} waste caps</button>
          <button type="button" className="text-xs font-semibold text-accent hover:underline" onClick={() => setShowAll(!showAll)}>{showAll ? "Only items to order" : `Show all ${reorders.length}`}</button>
        </div>
      </div>
      {rows.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing needs ordering right now.</p>}
      <ul className="mt-2 divide-y divide-border">
        {rows.map(({ ingredient: ing, input, result: r }) => {
          const fb = todaysFeedback.get(`reorder:${ing.id}`);
          const openOrders = db.purchases.filter((p) => p.ingredientId === ing.id && p.ordered);
          const key = `reorder:${ing.id}`;
          return (
            <li key={ing.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">{ing.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${r.status === "Order now" ? "bg-destructive/15 text-destructive" : r.status === "Order by" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"}`}>{r.status === "Order by" ? `Order by ${shortDate(r.orderBy!)}` : r.status}</span>
                    <ConfidenceBadge value={r.confidence} />
                    {r.notes.map((n) => <Tag key={n}>{n}</Tag>)}
                  </div>
                </div>
                {r.order > 0 && <p className="text-right text-lg font-bold text-primary">{fmtQty(r.order)} <span className="text-sm font-semibold text-muted-foreground">{ing.unit}</span></p>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.explanation}</p>
              {r.risks.map((k) => <p key={k.id} className="text-xs text-warning">{fmtQty(k.atRisk)} of {fmtQty(k.qty)} {ing.unit} in the {shortDate(k.received)} lot will likely expire unused.</p>)}
              {compare && r.status !== "No recent use" && (
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                  {compareCaps(input).map(({ cap, result }) => (
                    <div key={cap} className={`rounded border p-1.5 ${cap === settings.wasteCapPct ? "border-accent bg-info-soft" : "border-border"}`}>
                      <p className="text-muted-foreground">Cap {cap}%</p>
                      <p className="font-bold text-primary">{fmtQty(result.status === "OK" ? 0 : result.order)} {ing.unit}</p>
                      <p className="text-muted-foreground">−{result.wasteReductionPct}%</p>
                    </div>
                  ))}
                </div>
              )}
              {openOrders.map((p) => (
                <p key={p.id} className="mt-1 flex items-center gap-2 text-xs text-primary">On order: {fmtQty(p.quantity)} {ing.unit}{p.expectedDate ? ` · arrives ${shortDate(p.expectedDate)}` : ""}
                  <button type="button" className="font-semibold text-accent hover:underline" onClick={() => receive(p, ing.defaultShelfLifeDays)}><PackageCheck className="mr-0.5 inline h-3.5 w-3.5" />Received</button></p>
              ))}
              {r.order > 0 && (
                fb ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{fb.action === "ignored" ? "Ignored today" : `Ordered ${fmtQty(fb.editedValue ?? fb.suggested)} ${ing.unit}`}</p> :
                editing === key ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" aria-label="Edited amount" className={`${inputCls} h-9 w-28`} value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                    <button type="button" className={btnPrimary} onClick={() => { const v = Number(editValue); if (!(v > 0)) return void toast.error("Enter an amount above 0"); setEditing(null); setOrdering({ ing, qty: v, arrival: r.arrival, conf: r.confidence }); }}>Use amount</button>
                    <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} onClick={() => setOrdering({ ing, qty: r.order, arrival: r.arrival, conf: r.confidence })}>Mark as ordered</button>
                    <button type="button" className={btnSecondary} onClick={() => { setEditing(key); setEditValue(String(r.order)); }}>Edit</button>
                    <button type="button" className={btnSecondary} onClick={() => logFeedback({ kind: "reorder", targetId: ing.id, suggested: r.order, action: "ignored", wasteCapPct: settings.wasteCapPct, confidence: r.confidence })}>Ignore</button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
      {byCap.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">Your responses by waste cap: {byCap.map((c) => `${c.cap}% — ${c.accepted} accepted, ${c.edited} edited of ${c.total}`).join(" · ")}</p>
      )}

      {showBatches && (
        <div className="mt-6">
          <p className="text-sm font-bold text-primary">Batches for {shortDate(batches.targetDate)}</p>
          {batches.rows.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No recent sales on this weekday for batch-made or outsourced items.</p>}
          <ul className="mt-2 divide-y divide-border">
            {batches.rows.map(({ item, result: b }) => {
              const fb = todaysFeedback.get(`batch:${item.id}`);
              const key = `batch:${item.id}`;
              const record = (action: SuggestionFeedback["action"], editedValue?: number) => logFeedback({ kind: "batch", targetId: item.id, suggested: b.batch, action, ...(editedValue !== undefined ? { editedValue } : {}), wasteCapPct: settings.wasteCapPct, confidence: b.confidence });
              return (
                <li key={item.id} className="py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-primary">{item.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5"><ConfidenceBadge value={b.confidence} />{b.notes.map((n) => <Tag key={n}>{n}</Tag>)}</div>
                    </div>
                    <p className="text-lg font-bold text-primary">{b.batch} <span className="text-sm font-semibold text-muted-foreground">{item.batchUnit || "pcs"}</span></p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.explanation}</p>
                  {fb ? <p className="mt-1 text-xs font-semibold text-muted-foreground">{fb.action === "ignored" ? "Ignored" : `Planned ${fb.editedValue ?? fb.suggested}`}</p> : editing === key ? (
                    editing === key ? (
  <div className="mt-2 flex items-center gap-2">
    <input 
      type="number" 
      aria-label="Edited batch" 
      className={`${inputCls} h-9 w-24`} 
      value={editValue} 
      onChange={(e) => setEditValue(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Escape") setEditing(null); }}
    />
    <button 
      type="button" 
      className={btnPrimary} 
      onClick={() => { 
        const v = Number(editValue); 
        if (!(v >= 0)) return; 
        record("edited", v); 
        setEditing(null); 
      }}
    >
      Save
    </button>
    <button 
      type="button" 
      className={btnSecondary} 
      onClick={() => setEditing(null)}
    >
      Cancel
    </button>
  </div>
) : (

                    <div className="mt-2 flex gap-2">
                      <button type="button" className={btnPrimary} onClick={() => record("accepted")}>Accept</button>
                      <button type="button" className={btnSecondary} onClick={() => { setEditing(key); setEditValue(String(b.batch)); }}>Edit</button>
                      <button type="button" className={btnSecondary} onClick={() => record("ignored")}>Ignore</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {ordering && <OrderDialog ingredient={ordering.ing} qty={ordering.qty} arrival={ordering.arrival} onClose={() => setOrdering(null)} onSaved={(q) => logFeedback({ kind: "reorder", targetId: ordering.ing.id, suggested: reorders.find((x) => x.ingredient.id === ordering.ing.id)?.result.order ?? q, action: q === (reorders.find((x) => x.ingredient.id === ordering.ing.id)?.result.order) ? "accepted" : "edited", editedValue: q, wasteCapPct: settings.wasteCapPct, confidence: ordering.conf })} />}
      <p className="mt-3 text-[11px] text-muted-foreground">By {currentUser().name || "you"} · suggestions never change stock until you save an order or a delivery.</p>
    </Panel>
  );
}
