import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
const PREVIEW = 5;
import { PackagePlus } from "lucide-react";
import { useDB } from "@/lib/store";
import { menuMap, QUADRANTS, wasteColor } from "@/lib/calc";
import { formatPeso } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { ProductionHistory } from "@/components/mw/History";
import { Panel, SectionTitle, Segmented, btnPrimary, btnSecondary } from "@/components/mw/ui";
import { MenuMapChart } from "@/components/mw/MenuMapChart";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/menu/")({
  head: () => ({
    meta: [
      { title: "Menu Map — MenuWise" },
      { name: "description", content: "Menu engineering quadrants ranked by finished-product waste." },
      { property: "og:title", content: "Menu Map — MenuWise" },
      { property: "og:description", content: "Menu engineering quadrants ranked by finished-product waste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MenuMap,
});

const DESC: Record<string, string> = {
  Stars: "Popular & profitable",
  Plowhorses: "Popular, lower margin",
  Puzzles: "Profitable, less popular",
  Dogs: "Less popular & lower margin",
};

function MenuMap() {
  const db = useDB();
  const [view, setView] = useState<"Bubble Chart" | "Analysis">("Bubble Chart");
  const [withWip, setWithWip] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const map = useMemo(() => menuMap(db, withWip), [db, withWip]);

  useEffect(() => {
    if (view !== "Analysis" || !highlight) return;
    const t = setTimeout(() => document.getElementById(`row-${highlight}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    const clear = setTimeout(() => setHighlight(null), 4000);
    return () => { clearTimeout(t); clearTimeout(clear); };
  }, [view, highlight]);

  function selectBubble(id: string) {
    const row = map.plottedRows.find((r) => r.item.id === id);
    if (!row) return;
    const items = map.plottedRows.filter((r) => r.quadrant === row.quadrant).sort((a, b) => b.waste - a.waste);
    if (items.findIndex((r) => r.item.id === id) >= PREVIEW) setExpanded((e) => ({ ...e, [row.quadrant]: true }));
    setHighlight(id);
    setView("Analysis");
  }

  return (
    <div>
      <PageTitle back={{ to: "/", label: "Home" }} title="Menu Map" subtitle="Compare popularity, profitability, and waste across the menu.">
        <div className="flex gap-2">
          <Link to="/log-production" search={{ item: undefined }} className={btnSecondary}><PackagePlus className="h-4 w-4" /> Quick add batch</Link>
          <Link to="/menu-items" search={{ item: undefined }} className={btnPrimary}>View Menu Items</Link>
        </div>
      </PageTitle>

      <div className="mb-3 w-full max-w-sm"><Segmented value={view} options={["Bubble Chart", "Analysis"] as const} onChange={setView} /></div>
      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="flex items-center gap-2 text-sm text-primary">
            <Switch checked={withWip} onCheckedChange={setWithWip} />
            Include attributed prep/WIP waste
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Primary metric: direct finished-product waste per menu item{withWip ? " + attributed prep/WIP waste" : ""}. Unallocated ingredient waste is not included.
        </p>

        {view === "Bubble Chart" ? (
          <MenuMapChart map={map} onSelect={selectBubble} />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {QUADRANTS.map((q) => {
              const items = map.plottedRows.filter((r) => r.quadrant === q).sort((a, b) => b.waste - a.waste);
              const open = !!expanded[q];
              const shown = open ? items : items.slice(0, PREVIEW);
              const hi = items[0], lo = items[items.length - 1];
              return (
                <div key={q} className="overflow-hidden rounded-xl border border-border">
                  <div className="bg-secondary px-3 py-2">
                    <p className="font-bold text-primary">{q} ({items.length})</p>
                    <p className="text-xs text-muted-foreground">{DESC[q]}</p>
                    {items.length > 0 && (
                      <div className="mt-1 space-y-0.5 text-xs text-primary">
                        <p>Highest Waste: <b>{hi.item.name}</b> ({formatPeso(hi.waste)})</p>
                        {items.length > 1 && <p>Lowest Waste: <b>{lo.item.name}</b> ({formatPeso(lo.waste)})</p>}
                      </div>
                    )}
                  </div>
                  {items.length > 0 && (
                    <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 px-4 pt-2 text-[10px] font-bold uppercase text-muted-foreground">
                      <span>Item</span><span className="text-right">Sales volume</span><span className="text-right">Margin %</span><span className="text-right">Waste</span>
                    </div>
                  )}
                  <ul>
                    {shown.map((r) => (
                      <li key={r.item.id} id={`row-${r.item.id}`}
                        className={`m-2 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-3 rounded-lg px-3 py-2 text-sm transition-shadow ${highlight === r.item.id ? "ring-2 ring-primary" : ""}`}
                        style={{ background: `color-mix(in oklab, ${wasteColor(r.intensity)} 22%, var(--card))` }}>
                        <Link to="/menu-items" search={{ item: r.item.id }} className="truncate text-left font-semibold text-primary underline-offset-2 hover:underline">{r.item.name}</Link>
                        <span className="text-right text-xs text-primary">{r.popularity}</span>
                        <span className="text-right text-xs text-primary">{r.marginPct.toFixed(1)}%</span>
                        <span className="text-right text-xs text-primary">{formatPeso(r.waste)}</span>
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No items</li>}
                  </ul>
                  {items.length > PREVIEW && (
                    <button type="button" className="w-full border-t border-border px-3 py-2 text-xs font-semibold text-primary hover:bg-muted"
                      onClick={() => setExpanded((e) => ({ ...e, [q]: !open }))}>
                      {open ? "Show less" : `View all ${items.length} items`}
                    </button>
                  )}
                </div>
              );
            })}
            {map.rows.some((r) => r.popularity === 0) && (
              <div className="overflow-hidden rounded-xl border border-border lg:col-span-2">
                <div className="bg-muted px-3 py-2">
                  <p className="font-bold text-primary">Not yet classified</p>
                  <p className="text-xs text-muted-foreground">No sales logged yet</p>
                </div>
                <ul className="grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-4">
                  {map.rows.filter((r) => r.popularity === 0).sort((a, b) => a.item.name.localeCompare(b.item.name)).map((r) => (
                    <li key={r.item.id}>
                      <Link to="/menu/$id" params={{ id: r.item.id }} className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm font-semibold hover:bg-muted">
                        <span className="truncate text-primary">{r.item.name}</span>
                        <span className="ml-2 shrink-0 text-xs text-muted-foreground">No sales</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel className="mt-6">
        <SectionTitle>Production History</SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-muted-foreground">Every batch logged, newest first — who added it and any edits.</p>
        <ProductionHistory db={db} />
      </Panel>
    </div>
  );
}
