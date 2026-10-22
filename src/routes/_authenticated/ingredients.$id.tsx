import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { deleteIngredient } from "@/lib/deletes";
import { useEffect, useState } from "react";
import { Bell, X, Lightbulb, Trash2 } from "lucide-react";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { useDB } from "@/lib/store";
import { avgRepurchaseDays, ingredientUsageShare, ingredientWaste, lastPurchase, nextLot, purchaseRecommendation, stockOf, stockValueOf } from "@/lib/calc";
import { daysFromToday, formatPeso, fmtQty, shortDate, timeOf, todayISO } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel, SectionTitle } from "@/components/mw/ui";
import { WasteList, WasteLogForm } from "@/components/mw/WasteLogForm";
import { PurchaseEntries } from "@/components/mw/History";

export const Route = createFileRoute("/_authenticated/ingredients/$id")({
  head: () => ({
    meta: [
      { title: "Ingredient — MenuWise" },
      { name: "description", content: "Stock, expiry, purchase planning and waste history for one ingredient." },
      { property: "og:title", content: "Ingredient — MenuWise" },
      { property: "og:description", content: "Stock, expiry, purchase planning and waste history for one ingredient." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: IngredientView,
});

const PIE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function IngredientView() {
  const { id } = Route.useParams();
  const db = useDB();
  const [popup, setPopup] = useState(false);
  const navigate = useNavigate();
  const ing = db.ingredients.find((i) => i.id === id);
  const rec = ing ? purchaseRecommendation(db, ing.id) : null;
  useEffect(() => {
    if (rec?.fire) setPopup(true);
  }, [rec?.fire]);

  if (!ing) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold text-primary">Ingredient not found.</p>
        <Link to="/ingredients" className="mt-3 inline-block text-accent">← Back to Ingredient Inventory</Link>
      </div>
    );
  }
  const lot = nextLot(db, ing.id);
  const last = lastPurchase(db, ing.id);
  const avg = avgRepurchaseDays(db, ing.id);
  const stock = stockOf(db, ing.id);
  const share = ingredientUsageShare(db, ing.id);
  const waste = ingredientWaste(db, ing.id);
  const daysLeft = lot ? daysFromToday(lot.expiryDate) : null;
  const largeNearExpiry = lot && daysLeft !== null && daysLeft <= 3 && lot.remaining >= lot.quantity * 0.3;
  const usedBy = share.map((s) => s.menuItem.name);

  return (
    <div className="mx-auto max-w-4xl">
      <PageTitle back={{ to: "/ingredients", label: "Ingredient Inventory List" }} title="Individual Ingredient View" subtitle="Track stock, plan the next purchase and record ingredient losses.">
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-destructive px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10" onClick={() => {
          if (!window.confirm(`Delete ${ing.name}? Its purchases and ingredient waste history will also be removed.`)) return;
          deleteIngredient(ing.id);
          toast.success("Ingredient deleted");
          navigate({ to: "/ingredients" });
        }}><Trash2 className="h-4 w-4" /> Delete ingredient</button>
      </PageTitle>
      <h3 className="text-2xl font-bold text-primary">{ing.name}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{[ing.id, ing.category, ing.storage].filter(Boolean).join(" · ")}</p>

      {popup && rec?.fire && (
        <div role="alertdialog" className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-md rounded-2xl border border-info-border bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-primary">Recommended next purchase · {shortDate(rec.recommendedDate)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                At the current rate, {ing.name.toLowerCase()} runs out around {shortDate(rec.runOut!)}, before your usual next order on {shortDate(rec.nextOrder)}.
              </p>
            </div>
            <button aria-label="Dismiss" onClick={() => setPopup(false)}><X className="h-5 w-5 text-muted-foreground" /></button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionTitle>Current stock</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Purchase date</p><p className="text-xl font-bold text-primary">{shortDate(lot?.purchaseDate ?? last?.purchaseDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Expiry</p><p className="text-xl font-bold text-primary">{shortDate(lot?.expiryDate)}</p></div>
            <div><p className="text-xs text-muted-foreground">Quantity on hand</p><p className="text-xl font-bold text-primary">{fmtQty(stock)} {ing.unit}</p></div>
            <div><p className="text-xs text-muted-foreground">Current stock value</p><p className="text-xl font-bold text-primary">{formatPeso(stockValueOf(db, ing.id))}</p></div>
          </div>
          <p className="mt-3 flex justify-between text-xs text-muted-foreground"><span>{daysLeft !== null && (daysLeft <= 0 ? "● Expires today" : `● ${daysLeft} days to expiry`)}</span><span>{formatPeso(ing.unitCost)} / {ing.unit}</span></p>
        </Panel>

        <div className="space-y-4">
          <div className="rounded-2xl border border-warning-border bg-warning-soft p-5">
            <p className="font-bold text-warning">Next expiry</p>
            <p className="mt-1 text-sm text-primary">
              {lot
                ? `Batch purchased on ${shortDate(lot.purchaseDate)} will expire ${daysLeft! <= 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"} from now`} (${shortDate(lot.expiryDate)}).`
                : "No stock on hand."}
            </p>
          </div>
          {largeNearExpiry && (
            <div className="rounded-2xl border border-info-border bg-info-soft p-5 text-sm">
              <p className="flex items-center gap-2 font-bold text-primary"><Lightbulb className="h-4 w-4" /> Repurpose before it spoils</p>
              <p className="mt-1 text-muted-foreground">
                {fmtQty(lot!.remaining)} {ing.unit} is close to expiring.{" "}
                {usedBy.length ? `Prioritize it in tomorrow's production of ${usedBy.slice(0, 3).join(", ")}` : "Use it in a daily special"}, or turn it into a staff meal or a quick-sale special.
              </p>
            </div>
          )}
        </div>
      </div>

      <Panel className="mt-4">
        <SectionTitle>Purchase planning</SectionTitle>
        <p className="font-bold text-primary">{last ? `Last purchased ${-daysFromToday(last.purchaseDate)} days ago (${shortDate(last.purchaseDate)})` : "No purchases yet"}</p>
        <p className="mt-1 text-sm text-muted-foreground">{avg ? `Average repurchasing time is ${avg} days after the last purchase.` : "Need at least two purchases to calculate the average repurchasing time."}</p>
        {rec && (
          <button onClick={() => setPopup(true)} className="mt-3 w-full rounded-xl border border-info-border bg-info-soft p-4 text-left">
            <p className="flex items-center gap-2 text-sm font-bold text-primary"><Bell className="h-4 w-4" /> Recommended next purchase</p>
            <p className="text-2xl font-bold text-primary">{shortDate(rec.recommendedDate)}</p>
            <p className="text-xs text-muted-foreground">
              {rec.fire ? "Stock will run out before your usual next order." : `Stock should last until your usual next order (${shortDate(rec.nextOrder)}).`}
            </p>
          </button>
        )}
      </Panel>

      <Panel className="mt-4">
        <SectionTitle>Ingredient entries</SectionTitle>
        <p className="-mt-2 mb-2 text-sm text-muted-foreground">Each purchase added to stock. Tap the pencil to fix a mistake.</p>
        <PurchaseEntries db={db} ingredientId={ing.id} />
      </Panel>

      <Panel className="mt-4">
        <SectionTitle>Menu item usage</SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">{share.length} menu item{share.length === 1 ? "" : "s"} use {ing.name.toLowerCase()}. Share of this ingredient used across recipes.</p>
        {share.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not used in any recipe yet.</p>
        ) : (
          <div className="grid items-center gap-4 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={share.map((s) => ({ name: s.menuItem.name, value: +s.pct.toFixed(1) }))} dataKey="value" nameKey="name" outerRadius="90%" stroke="var(--card)">
                    {share.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {share.map((s, i) => (
                <li key={s.menuItem.id}>
                  <Link to="/menu/$id" params={{ id: s.menuItem.id }} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-primary"><span className="h-3 w-3 rounded-full" style={{ background: PIE[i % PIE.length] }} /> {s.menuItem.name}</span>
                    <b className="text-primary">{s.pct.toFixed(0)}%</b>
                  </Link>
                </li>
              ))}
              <li className="text-xs text-muted-foreground">Total allocation 100% · Recipe-based usage</li>
            </ul>
          </div>
        )}
      </Panel>

      <div className="mt-8">
        <SectionTitle>Waste History & Logging</SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Log a new loss below. Ingredient-stage waste only; value = quantity × purchase unit cost.</p>
        <Panel>
          <p className="mb-4 font-bold text-primary">Waste Log Form</p>
          <WasteLogForm fixedStage="Ingredient" ingredientId={ing.id} />
        </Panel>
        <div className="mt-6">
          <SectionTitle>Waste occurrences</SectionTitle>
          {waste[0] && (
            <div className="mb-3 rounded-xl bg-info-soft p-4 text-sm">
              <p className="text-xs font-bold uppercase text-accent">Last occurrence · {shortDate(waste[0].at)}</p>
              <p className="font-bold text-primary">{waste[0].wasteType} · {fmtQty(waste[0].quantity)} {waste[0].unit} · {formatPeso(waste[0].value)}</p>
              <p className="text-muted-foreground">{timeOf(waste[0].at)} · Ingredient stage</p>
            </div>
          )}
          <WasteList logs={waste} />
          {waste.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Newest first · All {waste.length} occurrences shown · Updated {shortDate(todayISO())}</p>}
        </div>
      </div>
    </div>
  );
}
