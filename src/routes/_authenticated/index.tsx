import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp, Trash2, PackagePlus, ChevronRight } from "lucide-react";
import { useDB } from "@/lib/store";
import { expiringWithin, menuMap, totalWaste, QUADRANTS, wasteColor } from "@/lib/calc";
import { addDays, daysFromToday, formatPeso, fmtQty, shortDate, todayISO } from "@/lib/format";
import { THRESHOLD_OPTIONS, thresholdLabel, useThreshold } from "@/lib/settings";
import { Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

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

type Period = "today" | "week";

function Dashboard() {
  const db = useDB();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("today");
  const [compare, setCompare] = useState<"yesterday" | "lastweek">("yesterday");
  const [showStages, setShowStages] = useState(false);
  const [threshold, setThreshold] = useThreshold();
  const t = todayISO();

  const cur = period === "today" ? totalWaste(db, t, t) : totalWaste(db, addDays(t, -6), t);
  const prev =
    period === "today"
      ? compare === "yesterday" ? totalWaste(db, addDays(t, -1), addDays(t, -1)) : totalWaste(db, addDays(t, -7), addDays(t, -7))
      : totalWaste(db, addDays(t, -13), addDays(t, -7));
  const pct = prev.total > 0 ? ((cur.total - prev.total) / prev.total) * 100 : null;
  const expiring = expiringWithin(db, threshold);
  const map = useMemo(() => menuMap(db, false), [db]);

  return (
    <div className="space-y-6">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-primary">Total Waste Value</p>
          <div className="flex gap-2">
            <select className={`${inputCls} h-9 w-auto`} value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Period">
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
            </select>
            {period === "today" && (
              <select className={`${inputCls} h-9 w-auto`} value={compare} onChange={(e) => setCompare(e.target.value as never)} aria-label="Compare with">
                <option value="yesterday">vs yesterday</option>
                <option value="lastweek">vs same day last week</option>
              </select>
            )}
          </div>
        </div>
        <p className="mt-2 text-4xl font-bold text-primary">{formatPeso(cur.total)}</p>
        <p className={`mt-1 flex items-center gap-1 text-sm font-semibold ${pct === null ? "text-muted-foreground" : pct > 0 ? "text-destructive" : "text-success"}`}>
          {pct === null ? "No waste recorded in the comparison period" : (
            <>
              {pct > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {pct > 0 ? "+" : ""}{pct.toFixed(0)}% from {period === "week" ? "the previous 7 days" : compare === "yesterday" ? "yesterday" : "last week"} ({formatPeso(prev.total)})
            </>
          )}
        </p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ongoing Insights */}
        <div
          role="link"
          tabIndex={0}
          onClick={() => navigate({ to: "/ingredients" })}
          onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/ingredients" })}
          className="cursor-pointer rounded-2xl border border-border bg-card p-5 transition-colors hover:border-accent"
        >
          <SectionTitle
            right={
              <select
                className={`${inputCls} h-9 w-auto`}
                value={threshold}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setThreshold(Number(e.target.value))}
                aria-label="Expiry threshold"
              >
                {THRESHOLD_OPTIONS.map((o) => <option key={o.days} value={o.days}>Within {o.label}</option>)}
              </select>
            }
          >
            Ongoing Insights
          </SectionTitle>
          {expiring.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">{db.ingredients.length === 0 ? "No ongoing insights." : `No ingredients expiring in ${thresholdLabel(threshold)}.`}</p>
          ) : (
            <ul className="space-y-2">
              {expiring.map(({ ingredient, lot }) => {
                const d = daysFromToday(lot.expiryDate);
                const red = d <= 1;
                return (
                  <li key={ingredient.id}>
                    <Link
                      to="/ingredients/$id"
                      params={{ id: ingredient.id }}
                      onClick={(e) => e.stopPropagation()}
                      className={`flex items-center justify-between rounded-xl border p-3 ${red ? "border-destructive/30 bg-destructive/5" : "border-warning-border bg-warning-soft"}`}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{ingredient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtQty(lot.remaining)} {ingredient.unit} · Expiry {shortDate(lot.expiryDate)}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs font-bold ${red ? "text-destructive" : "text-warning"}`}>
                        {d <= 0 ? "Expires today" : d === 1 ? "1 day left" : `${d} days left`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
              const items = map.rows.filter((r) => r.quadrant === q).sort((a, b) => b.waste - a.waste);
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
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <Link to="/log-waste" className={btnPrimary}><Trash2 className="h-4 w-4" /> Log Waste</Link>
          <Link to="/log-production" className={btnSecondary}><PackagePlus className="h-4 w-4" /> Log Production</Link>
        </div>
      </div>
    </div>
  );
}
