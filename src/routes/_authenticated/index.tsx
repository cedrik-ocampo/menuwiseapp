import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp, Trash2, PackagePlus, ChevronRight, Plus, Check } from "lucide-react";
import { InsightActions } from "@/components/mw/InsightActions";
import { useDB } from "@/lib/store";
import { compareWeeks, expiringWithin, menuMap, totalSales, totalWaste, QUADRANTS, wasteColor, WEEK_OPTIONS, weekName } from "@/lib/calc";
import { addDays, daysFromToday, formatPeso, fmtQty, shortDate, todayISO } from "@/lib/format";
import { THRESHOLD_OPTIONS, thresholdLabel, useThreshold } from "@/lib/settings";
import { Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

import { suggestionFor } from "@/lib/suggest";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Dashboard — MenuWise" },
      { name: "description", content: "Today's waste value, expiring ingredients and menu performance at a glance." },
      { property: "og:title", content: "Dashboard — MenuWise" },
      { property: "og:description", content: "Today's waste value, expiring ingredients and menu performance at a glance." },
    ],
  }),
  component: Dashboard,
});

function WeekSelect({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <select className={`${inputCls} h-9 w-auto`} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label}>
      {WEEK_OPTIONS.map((o, i) => <option key={o} value={i}>{o}</option>)}
    </select>
  );
}

function Trend({ pct, offset, prev, hidden, upIsGood }: { pct: number | null; offset: number; prev: number; hidden?: boolean; upIsGood?: boolean }) {
  if (hidden) return null;
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const vs = `vs ${weekName(offset + 1)}`;
  const tip = offset === 0 ? `Compares Monday–${weekday} of each period.` : undefined;
  if (pct === null) return <p title={tip} className="mt-1 text-sm font-semibold text-muted-foreground">— {vs} · No data for comparison period</p>;
  const up = upIsGood ? "text-success" : "text-destructive", down = upIsGood ? "text-destructive" : "text-success";
  const cls = pct > 0 ? up : pct < 0 ? down : "text-muted-foreground";
  return (
    <p title={tip} className={`mt-1 flex items-center gap-1 text-sm font-semibold ${cls}`}>
      {pct > 0 ? <>▲ +{pct.toFixed(0)}%</> : pct < 0 ? <>▼ {Math.abs(pct).toFixed(0)}% decrease</> : "No change"} {vs} ({formatPeso(prev)})
    </p>
  );
}

function Dashboard() {
  const db = useDB();
  const navigate = useNavigate();
  const [wasteWeek, setWasteWeek] = useState(0);
  const [salesWeek, setSalesWeek] = useState(0);
  const [showStages, setShowStages] = useState(false);
  const [threshold, setThreshold] = useThreshold();
  const t = todayISO();

  const wc = compareWeeks((f, to) => totalWaste(db, f, to).total, wasteWeek, t);
  const cur = totalWaste(db, wc.window.from, wc.window.to);
  const sc = compareWeeks((f, to) => totalSales(db, f, to), salesWeek, t);
  const expiring = expiringWithin(db, threshold);
  const nowIso = new Date().toISOString();
  const resp = new Map(db.insightResponses.map((r) => [r.id, r]));
  const visible = expiring.filter(({ lot }) => {
    const r = resp.get(`exp:${lot.id}`);
    return !r || (r.status === "snoozed" && (r.until ?? "") <= nowIso);
  });
  const actioned = db.insightResponses.filter((r) => r.status === "accepted").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);
  const map = useMemo(() => menuMap(db, false), [db]);
  const salesTotal = sc.cur;
  const samePeriod = wasteWeek === salesWeek;
  const wastePct = samePeriod && salesTotal > 0 ? (cur.total / salesTotal) * 100 : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">Total Waste Value</p>
          <WeekSelect value={wasteWeek} onChange={setWasteWeek} label="Waste period" />
        </div>
        <p className="mt-2 text-4xl font-bold text-primary">{formatPeso(cur.total)}</p>
        <Trend pct={wc.pct} offset={wasteWeek} prev={wc.prev} hidden={db.wasteLogs.length === 0} />
        <button className="mt-3 text-sm font-semibold text-accent" onClick={() => setShowStages(!showStages)}>
          {showStages ? "Hide" : "Show"} breakdown by stage
        </button>
        {showStages && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Object.entries(cur.byStage).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="font-bold text-primary">{formatPeso(v)}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-primary">Total Sales Value</p>
            <WeekSelect value={salesWeek} onChange={setSalesWeek} label="Sales period" />
          </div>
          <p className="mt-2 text-4xl font-bold text-primary">{formatPeso(salesTotal)}</p>
          <Trend pct={sc.pct} offset={salesWeek} prev={sc.prev} hidden={db.sales.length === 0} upIsGood />
          <p title={samePeriod ? undefined : "Set both cards to the same period to see this ratio."} className={`mt-2 text-sm font-semibold ${wastePct === null ? "text-muted-foreground" : wastePct < 3 ? "text-success" : wastePct <= 5 ? "text-warning" : "text-destructive"}`}>
            Waste as % of Sales: {wastePct === null ? "—" : `${wastePct.toFixed(1)}%`}
          </p>
          <p className="text-xs text-muted-foreground">Benchmark 2–5%. Green under 3%, amber 3–5%, red over 5%.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ongoing Insights */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <SectionTitle
            right={
              <select className={`${inputCls} h-9 w-auto`} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Expiry threshold">
                {THRESHOLD_OPTIONS.map((o) => <option key={o.days} value={o.days}>Within {o.label}</option>)}
              </select>
            }
          >
            <Link to="/ingredients" className="inline-flex items-center gap-1 hover:underline">Ongoing Insights <ChevronRight className="h-4 w-4 text-muted-foreground" /></Link>
          </SectionTitle>
          <p className="-mt-2 mb-3 text-xs text-muted-foreground">Time-sensitive stock and waste actions based on your selected expiry threshold.</p>
          {visible.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{db.ingredients.length > 0 && expiring.length === 0 ? `No ingredients expiring in ${thresholdLabel(threshold)}.` : "No ongoing insights."}</p>
          ) : (
            <ul className="space-y-2">
              {visible.map(({ ingredient, lot }) => {
                const d = daysFromToday(lot.expiryDate);
                const red = d <= 1;
                const key = `exp:${lot.id}`;
                const label = `${ingredient.name} · expiry ${shortDate(lot.expiryDate)}`;
                return (
                  <li key={lot.id} className={`rounded-xl border ${red ? "border-destructive/30 bg-destructive/5" : "border-warning-border bg-warning-soft"}`}>
                    <Link to="/ingredients/$id" params={{ id: ingredient.id }} className="flex items-center justify-between p-3 pb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{ingredient.name}</p>
                        <p className="text-xs font-medium text-accent">{suggestionFor(ingredient)}</p>
                        <p className="text-xs text-muted-foreground">{fmtQty(lot.remaining)} {ingredient.unit} · Expiry {shortDate(lot.expiryDate)}</p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold ${red ? "text-destructive" : "text-warning"}`}>
                        {d <= 0 ? "Expires today" : d === 1 ? "1 day left" : `${d} days left`}
                      </span>
                    </Link>
                    <InsightActions id={key} label={label} />
                  </li>
                );
              })}
            </ul>
          )}
          {actioned.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Actioned insights ({actioned.length})</summary>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {actioned.map((r) => <li key={r.id}><Check className="mr-1 inline h-3 w-3 text-success" />{r.label} — accepted by {r.byName} on {shortDate(r.at)}</li>)}
              </ul>
            </details>
          )}
        </div>

        {/* Menu Distribution Overview */}
        <div
          role="link"
          tabIndex={0}
          onClick={() => navigate({ to: "/menu" })}
          onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/menu" })}
          className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
        >
          <SectionTitle right={<ChevronRight className="h-5 w-5 text-muted-foreground" />}>Menu Distribution Overview</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {QUADRANTS.map((q) => {
              const items = map.plottedRows.filter((r) => r.quadrant === q).sort((a, b) => b.waste - a.waste);
              return (
                <div key={q} className="rounded-xl bg-muted p-3">
                  <p className="text-xs font-bold uppercase text-primary">{q}</p>
                  {items.length === 0 && <p className="mt-1 text-xs text-muted-foreground">None</p>}
                  <ul className="mt-1 space-y-1">
                    {items.map((r) => (
                      <li key={r.item.id}>
                        <Link
                          to="/menu/$id"
                          params={{ id: r.item.id }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 text-sm text-primary hover:underline"
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: wasteColor(r.intensity) }} />
                          <span className="truncate">{r.item.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="sticky bottom-20 z-40 md:bottom-4">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/log-waste" className={`${btnPrimary} h-12`}><Trash2 className="h-4 w-4" /> Log Waste</Link>
            <Link to="/log-production" search={{ item: undefined }} className={`${btnPrimary} h-12`}><PackagePlus className="h-4 w-4" /> Log Production</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/menu/new" className={`${btnSecondary} h-11 rounded-xl border border-border text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}><Plus className="h-3.5 w-3.5" /> Add Menu Item</Link>
            <Link to="/ingredients/new" className={`${btnSecondary} h-11 rounded-xl border border-border text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}><Plus className="h-3.5 w-3.5" /> Add Ingredient</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
