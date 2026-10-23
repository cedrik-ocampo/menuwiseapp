import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { deleteMenuItem } from "@/lib/deletes";
import { useState } from "react";
import { Plus, ChevronDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDB, put, remove } from "@/lib/store";
import { attributedWaste, avgWeeklyProduction, avgWeeklySales, costPerUnit, directWaste, producedThisWeek, sumValue, weekStart } from "@/lib/calc";
import { addDays, daysFromToday, formatPeso, fmtQty, shortDate, timeOf, todayISO, uid } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { Callout, Field, Panel, SectionTitle, Stat, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";
import { WasteList, WasteLogForm } from "@/components/mw/WasteLogForm";
import { EditButton } from "@/components/mw/History";
import { AuditCaption } from "@/components/mw/Audit";
import { MenuSalesHistory } from "@/components/mw/SalesTab";
import { SaleDialog } from "@/components/mw/SaleDialog";
import { EditBatchDialog } from "@/components/mw/EditDialogs";
import type { Batch } from "@/lib/types";
import { ingredientAmountCost, ITEM_TYPE_LABELS } from "@/lib/menu-costing";

export const Route = createFileRoute("/_authenticated/menu/$id")({
  head: () => ({
    meta: [
      { title: "Menu Item — MenuWise" },
      { name: "description", content: "Production, sales, batches and waste history for one menu item." },
      { property: "og:title", content: "Menu Item — MenuWise" },
      { property: "og:description", content: "Production, sales, batches and waste history for one menu item." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuItemView,
});

function MenuItemView() {
  const { id } = Route.useParams();
  const db = useDB();
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const navigate = useNavigate();
  const m = db.menuItems.find((x) => x.id === id);
  if (!m) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-primary">Menu item not found.</p>
        <Link to="/menu-items" search={{ item: undefined }} className="mt-3 inline-block text-accent">← Back to Menu Items</Link>
      </div>
    );
  }
  const ws = weekStart();
  const active = db.batches
    .filter((b) => b.menuItemId === m.id && b.expiryDate >= todayISO())
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
  const direct = directWaste(db, m.id);
  const attributed = attributedWaste(db, m.id);
  const isDrink = m.category.toLowerCase().includes("drink");

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle back={{ to: "/menu-items", label: "Menu Items" }} title="Individual Menu Item View" subtitle="Track production, review batches and record losses at the right stage.">
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10" onClick={() => {
          if (!window.confirm(`Delete ${m.name}? Its batches, sales and waste history will also be removed.`)) return;
          deleteMenuItem(m.id);
          toast.success("Menu item deleted");
          navigate({ to: "/menu-items", search: { item: undefined } });
        }}><Trash2 className="h-4 w-4" /> Delete menu item</button>
      </PageTitle>
      <h3 className="text-2xl font-bold text-primary">{m.name}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{m.category} · {ITEM_TYPE_LABELS[m.type]} · Cost per piece {formatPeso(costPerUnit(m))} · Selling price {formatPeso(m.retailPrice)}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Amt. Produced for the Week" value={<>{fmtQty(producedThisWeek(db, m.id))} <span className="text-sm font-normal">{m.batchUnit}</span></>} sub={`${shortDate(ws)}–${shortDate(addDays(ws, 6))} · Week to date`} />
        <Stat label="Average Weekly Production" value={fmtQty(Math.round(avgWeeklyProduction(db, m.id)))} sub={`${m.batchUnit} / week · last 4 complete weeks`} />
        <Stat label="Average Weekly Sales" value={fmtQty(Math.round(avgWeeklySales(db, m.id)))} sub={`${m.batchUnit} / week · last 4 complete weeks`} />
      </div>

      <Panel className="mt-6">
        <SectionTitle>Recipe</SectionTitle>
        {m.recipe.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.type === "Outsourced" ? "Outsourced item — no recipe tracked." : "No recipe ingredients recorded yet."}</p>
        ) : (() => {
          const lines = m.recipe.map((r) => {
            const ing = db.ingredients.find((i) => i.id === r.ingredientId);
            const amountCost = ingredientAmountCost(ing, r.quantity, r.unit);
            return { r, ing, cost: Number.isFinite(amountCost) ? amountCost : 0 };
          });
          const total = lines.reduce((a, l) => a + l.cost, 0) || 1;
          return (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr><th className="py-2">Ingredient</th><th className="text-right">Amount</th><th>Unit</th><th className="text-right">Ingredient Cost</th><th className="text-right">Recipe Share</th></tr>
                </thead>
                <tbody>
                  {lines.map(({ r, ing, cost }) => (
                    <tr key={r.ingredientId} className="border-t border-border">
                      <td className="py-2">{ing ? <Link to="/ingredients/$id" params={{ id: ing.id }} className="font-semibold text-accent hover:underline">{ing.name}</Link> : <span className="text-muted-foreground">{r.ingredientId} (removed)</span>}</td>
                      <td className="text-right">{fmtQty(r.quantity)}</td>
                      <td className="pl-2">{r.unit}</td>
                      <td className="text-right">{formatPeso(cost)}</td>
                      <td className="text-right">{((cost / total) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr className="border-t border-border font-bold text-primary"><td className="py-2" colSpan={3}>{m.type === "Made-to-order" ? "Total ingredient cost" : `Total batch ingredient cost (makes ${m.yield})`}</td><td className="text-right">{formatPeso(lines.reduce((a, l) => a + l.cost, 0))}</td><td className="text-right">100%</td></tr></tfoot>
              </table>
            </div>
          );
        })()}
      </Panel>

      <Panel className="mt-6">
        {editBatch && <EditBatchDialog batch={editBatch} unit={m.batchUnit} onClose={() => setEditBatch(null)} />}
        <SectionTitle>Batches & expiry dates</SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">{active.length} active batches · {fmtQty(active.reduce((a, b) => a + b.quantity, 0))} {m.batchUnit} made. Use the earliest-expiring batch first.</p>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active batches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {active.slice(0, 8).map((b) => {
              const d = daysFromToday(b.expiryDate);
              return (
                <li key={b.id} className="py-3 text-sm"><div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-primary">{b.id}</p>
                    <p className="text-muted-foreground">Made {shortDate(b.producedAt)} · {b.quantity} {m.batchUnit} produced</p>
                  </div>
                  <div className="flex items-center gap-3"><div className="text-right">
                    <p className="text-muted-foreground">Expiry {shortDate(b.expiryDate)}</p>
                    <p className={`text-xs font-bold ${d <= 0 ? "text-destructive" : "text-warning"}`}>{d <= 0 ? "Expires today" : d === 1 ? "Expires tomorrow" : `${d} days left`}</p>
                  </div>
                  {perm.isOwner && <button type="button" aria-label="Delete batch" className="text-muted-foreground hover:text-destructive" onClick={() => {
                    if (!window.confirm(`Delete batch ${b.id}?`)) return;
                    remove("batches", b.id);
                    toast.success("Batch deleted");
                  }}><Trash2 className="h-4 w-4" /></button>}
                  {perm.canEdit("batches", b.id) && <EditButton label="Edit batch" onClick={() => setEditBatch(b)} />}</div></div>
                  <AuditCaption collection="batches" record={b} />
                </li>
              );
            })}
          </ul>
        )}
        <Link to="/log-production" search={{ item: m.id }} className={`${btnPrimary} mt-4 w-full`}><Plus className="h-4 w-4" /> Quick Add Batch</Link>
      </Panel>


      <div className="mt-8">
        <SectionTitle>Waste History & Logging</SectionTitle>
        <details className="group rounded-2xl border border-border bg-card p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold text-primary">
            Waste Log Form <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-4"><WasteLogForm menuItemId={m.id} /></div>
        </details>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Callout tone="warning" title="Avoid Double Counting">
            Log each loss at one stage only. Attributed ingredient/WIP waste is an allocation of the original loss, not a second waste event.
          </Callout>
          <Callout tone="info" title={isDrink ? "For drinks" : "For pastries"}>
            <ul className="list-disc space-y-1 pl-5">
              {isDrink ? (
                <>
                  <li>Finished-product waste = spilled finished drink, wrong finished drink, unsold if applicable.</li>
                  <li>Ingredient waste goes to Ingredient View.</li>
                  <li>WIP/prep waste goes here if linked.</li>
                </>
              ) : (
                <>
                  <li>Finished-product waste = unsold, day-old, near-expiry.</li>
                  <li>Ingredient waste goes to Ingredient View.</li>
                  <li>WIP/prep waste goes here if batch/menu item is linked.</li>
                </>
              )}
            </ul>
          </Callout>
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <SectionTitle>Waste occurrences</SectionTitle>
            {direct[0] || attributed[0] ? (
              (() => {
                const l = [...direct, ...attributed].sort((a, b) => b.at.localeCompare(a.at))[0];
                return (
                  <div className="rounded-xl bg-info-soft p-4 text-sm">
                    <p className="text-xs font-bold uppercase text-accent">Last occurrence · {shortDate(l.at)}</p>
                    <p className="font-bold text-primary">{l.wasteType} · {fmtQty(l.quantity)} {l.unit} · {formatPeso(l.value)}</p>
                    <p className="text-muted-foreground">{timeOf(l.at)} · {l.stage}</p>
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-muted-foreground">No waste history yet.</p>
            )}
          </div>
          <div>
            <SectionTitle>Direct finished-product waste</SectionTitle>
            <p className="-mt-2 mb-2 text-xs text-muted-foreground">Primary · {direct.length} occurrences · {formatPeso(sumValue(direct))}</p>
            <WasteList logs={direct} />
          </div>
          <div>
            <SectionTitle>Attributed ingredient/WIP waste</SectionTitle>
            <p className="-mt-2 mb-2 text-xs text-muted-foreground">Losses before the finished-product stage, allocated to {m.name} · {attributed.length} occurrences · {formatPeso(sumValue(attributed))}</p>
            <WasteList logs={attributed} />
          </div>
          <Panel>
            <p className="text-xs font-bold uppercase text-muted-foreground">Total waste · includes attributed waste</p>
            <div className="mt-2 space-y-1 text-sm">
              <p className="flex justify-between"><span>Direct finished-product waste</span><b>{formatPeso(sumValue(direct))}</b></p>
              <p className="flex justify-between"><span>Attributed ingredient/WIP waste</span><b>{formatPeso(sumValue(attributed))}</b></p>
            </div>
            <p className="mt-2 text-3xl font-bold text-primary">{formatPeso(sumValue(direct) + sumValue(attributed))}</p>
            <p className="text-xs text-muted-foreground">Direct + attributed cost, each loss counted once. Retail value lost is excluded.</p>
          </Panel>
        </div>
      </div>
      <Panel className="mt-8">
        <SectionTitle right={<button type="button" className={btnPrimary} onClick={() => setSaleOpen(true)}><Plus className="h-4 w-4" /> Add Sale</button>}>Sales History</SectionTitle>
        <MenuSalesHistory menuItemId={m.id} />
      </Panel>
      {saleOpen && <SaleDialog menuItemId={m.id} onClose={() => setSaleOpen(false)} />}
    </div>
  );
}
