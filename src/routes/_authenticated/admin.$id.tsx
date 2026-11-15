import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { getCafe } from "@/lib/admin.functions";
import { InventoryAccessToggle } from "@/components/mw/InventoryAccessToggle";
import { PageTitle } from "@/components/mw/AppShell";
import { Callout, Panel, SectionTitle, Segmented, Stat } from "@/components/mw/ui";
import { fmtQty, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  head: () => ({
    meta: [
      { title: "Café Insights — MenuWise Admin" },
      { name: "description", content: "Privacy-safe café computation outputs, operational health, members and invitations." },
      { property: "og:title", content: "Café Insights — MenuWise Admin" },
      { property: "og:description", content: "Privacy-safe café computation outputs, operational health, members and invitations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCafe,
});

const TABS = ["Overview", "Menu Items", "Ingredients", "Sales", "Waste", "Members"] as const;
const pct = (value: number | null) => value === null ? "—" : `${value.toFixed(1)}%`;
const trend = (value: number | null) => value === null ? "No comparison baseline" : `${value > 0 ? "+" : ""}${value.toFixed(1)}% vs previous period`;

function AdminCafe() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCafe);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "cafe", id], queryFn: () => fn({ data: { id } }), retry: false });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");

  if (q.isLoading) return <p className="py-20 text-center text-muted-foreground">Loading café summary…</p>;
  if (q.error || !q.data) return <p className="py-20 text-center text-destructive">Café unavailable or you don’t have admin access.</p>;
  const { summary: s } = q.data;
  const maxWeeklyUnits = Math.max(1, ...s.sales.weekly.map((w) => w.units));

  return (
    <div>
      <Callout tone="info" title="Privacy-safe café monitoring">
        Only computation outputs and operational status are shown. Sales values, menu prices, ingredient costs, recipes, transaction quantities and stock levels remain confidential to the café.
      </Callout>
      <div className="mt-4">
        <PageTitle back={{ to: "/admin", label: "Café Monitoring" }} title={q.data.cafe.name} subtitle={`Created ${shortDate(q.data.cafe.created_at)} · Summary for ${shortDate(s.period.from)}–${shortDate(s.period.to)}`} />
      </div>
      <div className="mb-4 overflow-x-auto"><Segmented value={tab} options={TABS} onChange={setTab} /></div>

      {tab === "Overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Waste-to-sales ratio · 30 days" value={pct(s.waste.ratioPct)} sub="Computed privately; no peso totals shared" />
            <Stat label="Waste trend · 30 days" value={pct(s.waste.trendPct)} sub={`${trend(s.waste.trendPct)} · lower is better`} />
            <Stat label="Logging consistency" value={`${s.logging.activeDays30} / 30 days`} sub="Days with sales, production or waste logs" />
            <Stat label="Sales volume · this week" value={`${fmtQty(s.sales.unitsThisWeek)} units`} sub={trend(s.sales.volumeTrendPct)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <SectionTitle>Waste stage breakdown</SectionTitle>
              <StageBars shares={s.waste.stageShares} />
              <p className="mt-3 text-xs text-muted-foreground">Share of computed waste value in the last 30 days. Underlying amounts are hidden.</p>
            </Panel>
            <Panel>
              <SectionTitle>Menu Map health</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(s.menuMap).map(([name, count]) => <div key={name} className="rounded-lg bg-secondary p-3"><p className="text-xs font-semibold text-muted-foreground">{name}</p><p className="mt-1 text-2xl font-bold text-primary">{count} <span className="text-sm font-normal">items</span></p></div>)}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Quadrant counts only; item popularity, margins and waste values are hidden.</p>
            </Panel>
          </div>
          <Panel>
            <SectionTitle>Operational health & data readiness</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Status label="Menu setup" value={`${s.catalog.recipeReady} / ${s.catalog.menuItems}`} detail="items with recipes or outsourced costing" />
              <Status label="Ingredient costing" value={`${s.catalog.pricedIngredients} / ${s.catalog.ingredients}`} detail="ingredients marked priced" />
              <Status label="Production history" value={String(s.catalog.productionBatches)} detail="recorded batches" />
              <Status label="Team & invitations" value={`${q.data.members.length} / ${q.data.invites.length}`} detail="members / pending invites" />
            </div>
          </Panel>
        </div>
      )}

      {tab === "Menu Items" && (
        <Panel>
          <SectionTitle>Catalog setup status</SectionTitle>
          <Table head={["Hashed ID", "Category", "Type", "Costing setup"]} rows={s.menuItems.map((m) => [m.id, m.category, m.type, m.recipeStatus])} empty="No menu items yet." />
          <PrivacyNote />
        </Panel>
      )}

      {tab === "Ingredients" && (
        <Panel>
          <SectionTitle>Ingredient readiness</SectionTitle>
          <Table head={["Hashed ID", "Unit", "Cost status"]} rows={s.ingredients.map((i) => [i.id, i.unit, i.costStatus])} empty="No ingredients yet." />
          <PrivacyNote />
        </Panel>
      )}

      {tab === "Sales" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Units sold · this week" value={fmtQty(s.sales.unitsThisWeek)} sub={trend(s.sales.volumeTrendPct)} />
            <Stat label="Revenue" value="Confidential" sub="Sales values never leave the café's authorized workspace" />
          </div>
          <Panel>
            <SectionTitle>Eight-week sales volume</SectionTitle>
            <div className="space-y-3">
              {s.sales.weekly.map((week) => (
                <div key={week.weekStart} className="grid grid-cols-[82px_1fr_64px] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{shortDate(week.weekStart)}</span>
                  <div className="h-3 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${week.units / maxWeeklyUnits * 100}%` }} /></div>
                  <span className="text-right font-semibold text-primary">{fmtQty(week.units)} units</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Volume is aggregated by week. Individual transactions, prices and revenue are not available to MenuWise Admin.</p>
          </Panel>
        </div>
      )}

      {tab === "Waste" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Waste-to-sales ratio" value={pct(s.waste.ratioPct)} sub="Last 30 days" />
            <Stat label="Waste incidents" value={String(s.waste.incidents30)} sub="Last 30 days" />
            <Stat label="Waste value" value="Confidential" sub="Only ratios and trends are shared" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel><SectionTitle>Stage breakdown</SectionTitle><StageBars shares={s.waste.stageShares} /></Panel>
            <Panel>
              <SectionTitle>Reason categories</SectionTitle>
              {s.waste.reasons.length === 0 ? <p className="text-sm text-muted-foreground">No waste incidents in this period.</p> : <ul className="divide-y divide-border text-sm">{s.waste.reasons.map((r) => <li key={r.reason} className="flex justify-between py-2"><span>{r.reason}</span><span className="font-semibold text-primary">{r.count} incidents</span></li>)}</ul>}
            </Panel>
          </div>
        </div>
      )}

      {tab === "Members" && (
        <div className="space-y-4">
          <Panel><SectionTitle>Members</SectionTitle>
            <ul className="divide-y divide-border text-sm">{q.data.members.map((m) => (
              <li key={m.user_id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">{m.display_name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.email ?? "—"} · joined {shortDate(m.joined_at)}</p>
                  {m.role === "staff" && <InventoryAccessToggle workspaceId={id} userId={m.user_id} name={m.display_name || m.email?.split("@")[0] || "This member"} initial={m.inventory_access} onChanged={() => void qc.invalidateQueries()} />}
                </div>
                <span className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner" : "Staff"}</span>
              </li>
            ))}</ul>
          </Panel>
          <Panel><SectionTitle>Pending invitations</SectionTitle>
            {q.data.invites.length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p>
              : <ul className="text-sm">{q.data.invites.map((i) => <li key={i.id} className="border-t border-border py-2">{i.email} · invited {shortDate(i.created_at)}</li>)}</ul>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Status({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}

function StageBars({ shares }: { shares: Record<"Ingredient" | "WIP" | "Finished Product", number> }) {
  return <div className="space-y-3">{Object.entries(shares).map(([stage, share]) => <div key={stage}><div className="mb-1 flex justify-between text-sm"><span>{stage}</span><span className="font-semibold text-primary">{share.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} /></div></div>)}</div>;
}

function PrivacyNote() {
  return <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Item and ingredient names are one-way hashed on the server and cannot be reversed. Prices, costs, recipes and edit values are confidential.</p>;
}

function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2.5 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0"><thead className="text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i} className="border-t border-border">{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
