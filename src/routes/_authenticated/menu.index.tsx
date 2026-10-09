import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, PackagePlus } from "lucide-react";
import { useDB } from "@/lib/store";
import { menuMap, QUADRANTS, wasteColor } from "@/lib/calc";
import { formatPeso } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { ProductionHistory } from "@/components/mw/History";
import { Panel, SectionTitle, Segmented, btnPrimary, btnSecondary } from "@/components/mw/ui";
import { MenuMapChart } from "@/components/mw/MenuMapChart";
import { MenuInventory } from "@/components/mw/MenuInventory";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/menu/")({
  head: () => ({
    meta: [
      { title: "Menu Map — MenuWise" },
      { name: "description", content: "Menu engineering quadrants ranked by finished-product waste." },
      { property: "og:title", content: "Menu Map — MenuWise" },
      { property: "og:description", content: "Menu engineering quadrants ranked by finished-product waste." },
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
  const [view, setView] = useState<"Bubble Chart" | "Table" | "Inventory">("Bubble Chart");
  const [withWip, setWithWip] = useState(false);
  const map = useMemo(() => menuMap(db, withWip), [db, withWip]);

  return (
    <div>
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Menu Overview / Summary Map" subtitle="Where each menu item sits, coloured by waste.">
        <div className="flex gap-2">
          <Link to="/log-production" search={{ item: undefined }} className={btnSecondary}><PackagePlus className="h-4 w-4" /> Quick add batch</Link>
          <Link to="/menu/new" className={btnPrimary}><Plus className="h-4 w-4" /> Add Menu Item</Link>
        </div>
      </PageTitle>

      <div className="mb-3 w-full max-w-sm"><Segmented value={view} options={["Bubble Chart", "Table", "Inventory"] as const} onChange={setView} /></div>
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

        {view === "Inventory" ? (
          <MenuInventory db={db} rows={map.rows} />
        ) : view === "Bubble Chart" ? (
          <>
            <MenuMapChart map={map} height={420} />
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {QUADRANTS.map((q) => {
              const items = map.rows.filter((r) => r.quadrant === q).sort((a, b) => b.waste - a.waste);
              return (
                <div key={q} className="overflow-hidden rounded-xl border border-border">
                  <div className="bg-secondary px-3 py-2">
                    <p className="font-bold text-primary">{q}</p>
                    <p className="text-xs text-muted-foreground">{DESC[q]}</p>
                  </div>
                  <p className="px-3 pt-2 text-[10px] font-bold uppercase text-muted-foreground">Highest waste</p>
                  <ul>
                    {items.map((r) => (
                      <li key={r.item.id}>
                        <Link
                          to="/menu/$id"
                          params={{ id: r.item.id }}
                          className="m-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold"
                          style={{ background: `color-mix(in oklab, ${wasteColor(r.intensity)} 22%, var(--card))` }}
                        >
                          <span className="text-primary">{r.item.name}</span>
                          <span className="text-xs text-primary">{formatPeso(r.waste)}</span>
                        </Link>
                      </li>
                    ))}
                    {items.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No items</li>}
                  </ul>
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase text-muted-foreground">Lowest waste</p>
                </div>
              );
            })}
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
