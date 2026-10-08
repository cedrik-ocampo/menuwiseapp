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
import { EditBatchDialog } from "@/components/mw/EditDialogs";
import type { Batch } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/menu/$id")({
  head: () => ({
    meta: [
      { title: "Menu Item — MenuWise" },
      { name: "description", content: "Production, sales, batches and waste history for one menu item." },
      { property: "og:title", content: "Menu Item — MenuWise" },
      { property: "og:description", content: "Production, sales, batches and waste history for one menu item." },
    ],
  }),
  component: MenuItemView,
});

function MenuItemView() {
  const { id } = Route.useParams();
  const db = useDB();
  const [editBatch, setEditBatch] = useState<Batch | null>(null);
  const [sold, setSold] = useState("");
  const [soldDate, setSoldDate] = useState(todayISO());
  const navigate = useNavigate();
  const m = db.menuItems.find((x) => x.id === id);
  if (!m) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-primary">Menu item not found.</p>
        <Link to="/menu" className="mt-3 inline-block text-accent">← Back to Menu Map</Link>
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

  function addSale() {
    const q = parseFloat(sold);
    if (!Number.isFinite(q) || q < 0) {
      toast.error("Enter units sold (0 or more)");
      return;
    }
    put("sales", { id: uid("S-"), menuItemId: m!.id, date: soldDate, quantity: q });
    setSold("");
    toast.success("Sales recorded");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle back={{ to: "/menu", label: "Menu Overview / Summary Map" }} title="Individual Menu Item View" subtitle="Track production, review batches and record losses at the right stage.">
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10" onClick={() => {
          if (!window.confirm(`Delete ${m.name}? Its batches, sales and waste history will also be removed.`)) return;
          deleteMenuItem(m.id);
          toast.success("Menu item deleted");
          navigate({ to: "/menu" });
        }}><Trash2 className="h-4 w-4" /> Delete menu item</button>
      </PageTitle>
      <h3 className="text-2xl font-bold text-primary">{m.name}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{m.id} · {m.category} · {m.type} · Cost/unit {formatPeso(costPerUnit(m))} · Retail {formatPeso(m.retailPrice)}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Amt. Produced for the Week" value={<>{fmtQty(producedThisWeek(db, m.id))} <span className="text-sm font-normal">{m.batchUnit}</span></>} sub={`${shortDate(ws)}–${shortDate(addDays(ws, 6))} · Week to date`} />
        <Stat label="Average Weekly Production" value={fmtQty(Math.round(avgWeeklyProduction(db, m.id)))} sub={`${m.batchUnit} / week · last 4 complete weeks`} />
        <Stat label="Average Weekly Sales" value={fmtQty(Math.round(avgWeeklySales(db, m.id)))} sub={`${m.batchUnit} / week · last 4 complete weeks`} />
      </div>

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
                  <button type="button" aria-label="Delete batch" className="text-muted-foreground hover:text-destructive" onClick={() => {
                    if (!window.confirm(`Delete batch ${b.id}?`)) return;
                    remove("batches", b.id);
                    toast.success("Batch deleted");
                  }}><Trash2 className="h-4 w-4" /></button>
                  <EditButton label="Edit batch" onClick={() => setEditBatch(b)} /></div></div>
                  <AuditCaption collection="batches" record={b} />
                </li>
              );
            })}
          </ul>
        )}
        <Link to="/log-production" search={{ item: m.id }} className={`${btnPrimary} mt-4 w-full`}><Plus className="h-4 w-4" /> Quick Add Batch</Link>
      </Panel>

      <Panel className="mt-6">
        <SectionTitle>Record sales</SectionTitle>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <Field label="Date"><input type="date" className={inputCls} value={soldDate} onChange={(e) => setSoldDate(e.target.value)} /></Field>
          <Field label={`Units sold (${m.batchUnit})`}><input inputMode="decimal" className={inputCls} value={sold} onChange={(e) => setSold(e.target.value)} /></Field>
          <button className={btnSecondary} onClick={addSale}>Add</button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Used for Average Weekly Sales. Enter daily totals.</p>
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
    </div>
  );
}
