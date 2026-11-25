import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { AlertTriangle, CheckCircle2, Info, LockKeyhole, ShieldCheck } from "lucide-react";
import { getCafe } from "@/lib/admin.functions";
import { isPeriodKey, PERIOD_OPTIONS, type PeriodKey } from "@/lib/admin-periods";
import type { CafeSummary, MetricComparison, ShareMetric, TrendPoint, UnitMetric } from "@/lib/admin-privacy";
import { InventoryAccessToggle } from "@/components/mw/InventoryAccessToggle";
import { PageTitle } from "@/components/mw/AppShell";
import { Callout, Panel, SectionTitle, Segmented, Stat, btnPrimary, inputCls } from "@/components/mw/ui";
import { fmtQty, shortDate } from "@/lib/format";

const searchSchema = z.object({
  period: fallback(z.string(), "this-week").default("this-week"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  compare: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_authenticated/admin/$id")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Café Insights — MenuWise Admin" },
      { name: "description", content: "Privacy-safe café performance analytics, operational quality and research monitoring." },
      { property: "og:title", content: "Café Insights — MenuWise Admin" },
      { property: "og:description", content: "Privacy-safe café performance analytics, operational quality and research monitoring." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCafe,
});

const TABS = ["Overview", "Sales", "Waste", "Inventory", "Data Quality", "Research", "Menu Items", "Ingredients", "Members"] as const;
const pct = (value: number | null | undefined) => value === null || value === undefined ? "Insufficient Data" : `${value.toFixed(1)}%`;
const qty = (value: number | null | undefined) => value === null || value === undefined ? "Insufficient Data" : `${fmtQty(value)} units`;
const range = (from: string, to: string) => `${shortDate(from)}–${shortDate(to)}`;

function AdminCafe() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const fn = useServerFn(getCafe);
  const qc = useQueryClient();
  const periodKey: PeriodKey = isPeriodKey(search.period) ? search.period : "this-week";
  const selection = useMemo(() => ({ key: periodKey, customFrom: search.from || undefined, customTo: search.to || undefined }), [periodKey, search.from, search.to]);
  const q = useQuery({
    queryKey: ["admin", "cafe", id, periodKey, search.from, search.to],
    queryFn: () => fn({ data: { id, period: selection } }),
    placeholderData: (previous) => previous,
    retry: false,
  });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [draftKey, setDraftKey] = useState<PeriodKey>(periodKey);
  const [customFrom, setCustomFrom] = useState(search.from);
  const [customTo, setCustomTo] = useState(search.to);
  useEffect(() => { setDraftKey(periodKey); setCustomFrom(search.from); setCustomTo(search.to); }, [periodKey, search.from, search.to]);

  function go(next: { period?: PeriodKey; from?: string; to?: string; compare?: boolean }) {
    void navigate({
      to: "/admin/$id", params: { id }, replace: true,
      search: {
        period: next.period ?? periodKey,
        from: next.from ?? search.from,
        to: next.to ?? search.to,
        compare: next.compare ?? search.compare,
      },
    });
  }
  function choosePeriod(key: PeriodKey) {
    setDraftKey(key);
    if (key === "custom") {
      if (!customFrom && q.data) setCustomFrom(q.data.summary.period.from);
      if (!customTo && q.data) setCustomTo(q.data.summary.period.to);
      return;
    }
    go({ period: key, from: "", to: "" });
  }

  if (q.isLoading) return <p className="py-20 text-center text-muted-foreground">Loading café analytics…</p>;
  if (q.error || !q.data) return <Panel className="py-12 text-center"><AlertTriangle className="mx-auto mb-3 h-7 w-7 text-destructive" /><p className="font-semibold text-destructive">Café analytics unavailable</p><p className="mt-2 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Check the selected dates or your admin access."}</p></Panel>;
  const { summary: s } = q.data;
  const compare = search.compare;
  const usableWasteRates = s.waste.rates.filter((metric) => !metric.suppressed && metric.comparison.current !== null);
  const usableSellThrough = s.inventory.sellThrough.filter((metric) => metric.comparison.current !== null);

  return (
    <div>
      <Callout tone="info" title="Privacy-safe café monitoring">
        Only approved computation outputs are returned by the server. Revenue, prices, costs, recipes, item names, transactions and employee-level activity remain confidential to the café.
      </Callout>
      <div className="mt-4">
        <PageTitle back={{ to: "/admin", label: "Café Monitoring" }} title={q.data.cafe.name} subtitle={`Created ${shortDate(q.data.cafe.created_at)} · Reporting in Asia/Manila`} />
      </div>

      <Panel className="mb-4 mt-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="reporting-period" className="mb-1.5 block text-sm font-semibold text-primary">Global reporting period</label>
            <select id="reporting-period" className={inputCls} value={draftKey} onChange={(event) => choosePeriod(event.target.value as PeriodKey)}>
              {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-primary">
            <input type="checkbox" checked={compare} onChange={(event) => go({ compare: event.target.checked })} /> Compare with Previous Period
          </label>
        </div>
        {draftKey === "custom" && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg bg-secondary p-3">
            <label className="text-xs font-semibold text-primary">Start date<input type="date" className={`${inputCls} mt-1 w-auto`} value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label>
            <label className="text-xs font-semibold text-primary">End date<input type="date" className={`${inputCls} mt-1 w-auto`} value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label>
            <button type="button" className={btnPrimary} disabled={!customFrom || !customTo} onClick={() => go({ period: "custom", from: customFrom, to: customTo })}>Apply custom range</button>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-semibold text-primary">{s.period.label}: {range(s.period.from, s.period.to)}</span>
          {s.period.partial && <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">{s.period.partialLabel}</span>}
          {q.isFetching && <span className="text-xs text-muted-foreground">Updating…</span>}
        </div>
        {compare && <p className="mt-1 text-xs text-muted-foreground">Compared with {range(s.comparisonPeriod.from, s.comparisonPeriod.to)} · {s.comparisonPeriod.equivalentDays} equivalent days. Missing data is never treated as zero.</p>}
      </Panel>

      <div className="mb-4 overflow-x-auto"><div className="min-w-[980px]"><Segmented value={tab} options={TABS} onChange={setTab} /></div></div>

      {tab === "Overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Waste-to-Sales Ratio" metric={s.kpis.wasteToSales} compare={compare} format={pct} formula="Calculated waste value ÷ sales revenue × 100. Peso amounts stay on the server." />
            <MetricCard label="Waste Rate" metric={usableWasteRates.length === 1 ? usableWasteRates[0]!.comparison : { ...s.kpis.wasteToSales, current: null, previous: null }} compare={compare} format={pct} formula="Wasted units ÷ (opening units + received/produced units) × 100, calculated separately for compatible unit groups." customValue={usableWasteRates.length > 1 ? `${usableWasteRates.length} unit groups` : undefined} emptyText="See Waste tab" />
            <MetricCard label="Sales Volume" metric={s.kpis.salesVolume} compare={compare} format={qty} formula="Aggregated units sold during the selected event dates. Revenue is not returned." />
            <MetricCard label="Overall Daily Record Completion" metric={s.kpis.logging.overall} compare={compare} format={pct} formula="Expected operating days with sales + inventory/production + waste checks ÷ expected operating days × 100." />
            <MetricCard label="Inventory Sell-through Rate" metric={usableSellThrough.length === 1 ? usableSellThrough[0]!.comparison : { ...s.kpis.salesVolume, current: null, previous: null }} compare={compare} format={pct} formula="Sold finished-product units ÷ available finished-product units × 100, by compatible unit group." customValue={usableSellThrough.length > 1 ? `${usableSellThrough.length} unit groups` : undefined} emptyText="See Inventory tab" />
            <MetricCard label="Inventory Reconciliation Rate" metric={s.kpis.reconciliation} compare={compare} format={pct} formula="Eligible current ingredient lots where opening + received − usage − waste equals recorded closing stock." />
          </div>

          <Panel>
            <SectionTitle>Logging consistency · expected café operating days</SectionTitle>
            <CoverageGrid summary={s} compare={compare} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <SectionTitle>Waste stage breakdown <InfoTip text="Each percentage is that stage's share of calculated waste value. No peso amounts are returned." /></SectionTitle>
              <ShareBars result={s.waste.stages} empty="Insufficient costed waste records for a privacy-safe breakdown." />
            </Panel>
            <Panel>
              <SectionTitle>Menu Map health</SectionTitle>
              {s.menuMap.sufficient ? <div className="grid grid-cols-2 gap-3">{Object.entries(s.menuMap.counts).map(([name, count]) => <div key={name} className="rounded-lg bg-secondary p-3"><p className="text-xs font-semibold text-muted-foreground">{name}</p><p className="mt-1 text-2xl font-bold text-primary">{count} <span className="text-sm font-normal">items</span></p></div>)}</div> : <Empty title="Insufficient Data for Classification" detail={s.menuMap.reason} />}
              <p className="mt-3 text-xs text-muted-foreground">Selected-period popularity and current contribution margins are used internally. Only quadrant counts leave the server.</p>
            </Panel>
          </div>
          <Readiness summary={s} members={q.data.members.length} invites={q.data.invites.length} />
        </div>
      )}

      {tab === "Sales" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Units sold · selected period" metric={s.sales.volume} compare={compare} format={qty} formula="Sum of sale quantities by sale_date. Individual transactions and revenue are excluded." />
            <Stat label="Revenue" value="Confidential" sub="No peso sales values are returned to MenuWise Admin" />
          </div>
          <TrendChart title="Eight-week sales volume" points={s.sales.weekly} compare={compare} unit="units" kind="bar" />
        </div>
      )}

      {tab === "Waste" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Waste-to-sales ratio" metric={s.waste.ratio} compare={compare} format={pct} formula="Calculated waste value ÷ sales revenue × 100." />
            <Stat label="Waste incidents" value={String(s.waste.incidents)} sub={range(s.period.from, s.period.to)} />
            <Stat label="Waste value" value="Confidential" sub="Only ratios and distributions are returned" />
          </div>
          <WasteTrend summary={s} compare={compare} />
          <Panel>
            <SectionTitle>Unit-compatible waste rates <InfoTip text="Wasted units ÷ available units × 100. Mass, volume, pieces, packs, boxes, ingredients and finished products are never mixed." /></SectionTitle>
            <UnitMetricList metrics={s.waste.rates} compare={compare} />
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel><SectionTitle>Waste stage breakdown <InfoTip text="Percentage share of calculated waste value across Ingredient, WIP and Finished Product stages." /></SectionTitle><ShareBars result={s.waste.stages} empty="Insufficient costed waste records for a privacy-safe breakdown." /></Panel>
            <Panel><SectionTitle>Waste reason breakdown <InfoTip text="Reasons come from actual waste records. Unsold is not reclassified as expired." /></SectionTitle><ShareBars result={s.waste.reasons} empty="Insufficient costed waste records for a privacy-safe reason breakdown." /></Panel>
          </div>
        </div>
      )}

      {tab === "Inventory" && <InventoryPanel summary={s} compare={compare} />}

      {tab === "Data Quality" && <QualityPanel summary={s} compare={compare} />}

      {tab === "Research" && <ResearchPanel summary={s} />}

      {tab === "Menu Items" && (
        <Panel><SectionTitle>Catalog setup status</SectionTitle><Table head={["Hashed ID", "Category", "Type", "Costing setup"]} rows={s.menuItems.map((item) => [item.id, item.category, item.type, item.recipeStatus])} empty="No menu items yet." /><PrivacyNote /></Panel>
      )}
      {tab === "Ingredients" && (
        <Panel><SectionTitle>Ingredient readiness</SectionTitle><Table head={["Hashed ID", "Unit", "Cost status"]} rows={s.ingredients.map((ingredient) => [ingredient.id, ingredient.unit, ingredient.costStatus])} empty="No ingredients yet." /><PrivacyNote /></Panel>
      )}
      {tab === "Members" && (
        <div className="space-y-4">
          <Panel><SectionTitle>Members</SectionTitle><ul className="divide-y divide-border text-sm">{q.data.members.map((member) => (
            <li key={member.user_id} className="flex items-start justify-between gap-3 py-2"><div className="min-w-0"><p className="font-semibold text-primary">{member.display_name ?? "—"}</p><p className="truncate text-xs text-muted-foreground">{member.email ?? "—"} · joined {shortDate(member.joined_at)}</p>{member.role === "staff" && <InventoryAccessToggle workspaceId={id} userId={member.user_id} name={member.display_name || member.email?.split("@")[0] || "This member"} initial={member.inventory_access} onChanged={() => void qc.invalidateQueries()} />}</div><span className="text-xs text-muted-foreground">{member.role === "owner" ? "Owner" : "Staff"}</span></li>
          ))}</ul></Panel>
          <Panel><SectionTitle>Pending invitations</SectionTitle>{q.data.invites.length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p> : <ul className="text-sm">{q.data.invites.map((invite) => <li key={invite.id} className="border-t border-border py-2">{invite.email} · invited {shortDate(invite.created_at)}</li>)}</ul>}</Panel>
        </div>
      )}
    </div>
  );
}

function InfoTip({ text }: { text: string }) {
  return <span tabIndex={0} role="note" aria-label={text} title={text} className="inline-flex cursor-help align-middle text-muted-foreground"><Info className="h-4 w-4" /></span>;
}
function MetricCard({ label, metric, compare, format, formula, customValue, emptyText }: { label: string; metric: MetricComparison; compare: boolean; format: (value: number | null) => string; formula: string; customValue?: string; emptyText?: string }) {
  return <div className="rounded-xl border border-border bg-card p-4"><p className="flex items-center justify-between gap-2 text-xs font-semibold text-primary">{label}<InfoTip text={formula} /></p><p className={`mt-1 font-bold text-primary ${customValue || format(metric.current) === "Insufficient Data" ? "text-lg" : "text-2xl"}`}>{customValue ?? format(metric.current)}</p>{customValue && emptyText && <p className="mt-1 text-xs text-muted-foreground">{emptyText}</p>}{compare ? <ComparisonLine metric={metric} format={format} /> : <p className="mt-1 text-xs text-muted-foreground">Previous-period comparison is off</p>}</div>;
}
function ComparisonLine({ metric, format }: { metric: MetricComparison; format: (value: number | null) => string }) {
  if (metric.current === null || metric.previous === null || metric.difference === null) return <p className="mt-1 text-xs text-muted-foreground">Previous: {format(metric.previous)} · Insufficient equivalent data</p>;
  const change = metric.changeUnit === "percentage-points" ? `${metric.difference > 0 ? "+" : ""}${metric.difference.toFixed(1)} pp` : metric.changePct !== null ? `${metric.changePct > 0 ? "+" : ""}${metric.changePct.toFixed(1)}%` : `${metric.difference > 0 ? "+" : ""}${fmtQty(metric.difference)} ${metric.changeUnit}`;
  return <div className="mt-1 text-xs"><p className="text-muted-foreground">Previous: {format(metric.previous)} · {change}</p><p className={`mt-0.5 font-semibold ${metric.status === "Improved" ? "text-success" : metric.status === "No Significant Change" ? "text-muted-foreground" : "text-warning"}`}>{metric.status}</p></div>;
}
function CoverageGrid({ summary: s, compare }: { summary: CafeSummary; compare: boolean }) {
  const rows = [
    { label: "Sales Logging Coverage", days: s.kpis.logging.days.sales, metric: s.kpis.logging.sales, formula: "Expected operating days with at least one sale ÷ expected operating days." },
    { label: "Inventory / Production Coverage", days: s.kpis.logging.days.inventory, metric: s.kpis.logging.inventory, formula: "Expected operating days with a purchase, usage or production event ÷ expected operating days." },
    { label: "Waste Logging Coverage", days: s.kpis.logging.days.waste, metric: s.kpis.logging.waste, formula: "Days with waste records or an explicit no-waste confirmation ÷ expected operating days." },
    { label: "Daily Closeout Completion", days: s.kpis.logging.days.closeout, metric: s.kpis.logging.closeout, formula: "Expected operating days with an explicit daily closeout ÷ expected operating days." },
    { label: "Overall Daily Record Completion", days: s.kpis.logging.days.completed, metric: s.kpis.logging.overall, formula: "Days containing all three required record types: sales, inventory/production and waste check." },
  ];
  return <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{rows.map((row) => <div key={row.label} className="rounded-lg border border-border p-3"><p className="flex items-start justify-between gap-1 text-xs font-semibold text-primary">{row.label}<InfoTip text={row.formula} /></p><p className="mt-2 text-xl font-bold text-primary">{pct(row.metric.current)}</p><p className="text-xs text-muted-foreground">{row.days} / {s.kpis.logging.expectedDays} expected days</p>{compare && <ComparisonLine metric={row.metric} format={pct} />}</div>)}</div>;
}
function Readiness({ summary: s, members, invites }: { summary: CafeSummary; members: number; invites: number }) {
  return <Panel><SectionTitle>Operational health & data readiness <span className="text-xs font-normal text-muted-foreground">Current configuration · not date-filtered</span></SectionTitle><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Status label="Menu setup" value={`${s.catalog.recipeReady} / ${s.catalog.menuItems}`} detail="items with recipes or outsourced costing" /><Status label="Ingredient costing" value={`${s.catalog.pricedIngredients} / ${s.catalog.ingredients}`} detail="ingredients marked priced" /><Status label="Production · selected period" value={String(s.catalog.productionBatchesPeriod)} detail={range(s.period.from, s.period.to)} /><Status label="Production · all time" value={String(s.catalog.productionBatches)} detail="historical batches" /><Status label="Team & invitations" value={`${members} / ${invites}`} detail="members / pending invites" /></div></Panel>;
}
function Status({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-lg border border-border p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold text-primary">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>;
}
function Empty({ title, detail }: { title: string; detail?: string | null }) {
  return <div className="rounded-lg bg-secondary px-4 py-8 text-center"><p className="text-sm font-semibold text-primary">{title}</p>{detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}</div>;
}
function ShareBars({ result, empty }: { result: { available: boolean; shares: ShareMetric[]; suppressedGroups: number; missingCosting: number }; empty: string }) {
  if (!result.available || !result.shares.length) return <Empty title="Insufficient Data" detail={`${empty}${result.suppressedGroups ? ` ${result.suppressedGroups} small group(s) suppressed for privacy.` : ""}`} />;
  return <><div className="space-y-3">{result.shares.map((share) => <div key={share.key}><div className="mb-1 flex justify-between gap-3 text-sm"><span>{share.label}</span><span className="font-semibold text-primary">{share.sharePct.toFixed(1)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-accent" style={{ width: `${share.sharePct}%` }} /></div><p className="mt-0.5 text-xs text-muted-foreground">{share.records} records</p></div>)}</div>{result.suppressedGroups > 0 && <p className="mt-3 text-xs text-muted-foreground">{result.suppressedGroups} group(s) with fewer than three records are suppressed. Percentages still use all costed waste as the denominator.</p>}</>;
}
function UnitMetricList({ metrics, compare }: { metrics: UnitMetric[]; compare: boolean }) {
  if (!metrics.length) return <Empty title="Insufficient Data" detail="No eligible opening and received/produced inventory could be reconstructed for this period." />;
  return <div className="grid gap-3 md:grid-cols-2">{metrics.map((metric) => <div key={metric.key} className="rounded-lg border border-border p-3"><p className="text-sm font-semibold text-primary">{metric.label}</p><p className="mt-1 text-xl font-bold text-primary">{metric.suppressed ? "Privacy suppressed" : pct(metric.comparison.current)}</p><p className="mt-1 text-xs text-muted-foreground">{metric.note ?? `${metric.recordCount} waste records`}</p>{compare && !metric.suppressed && <ComparisonLine metric={metric.comparison} format={pct} />}</div>)}</div>;
}
function WasteTrend({ summary: s, compare }: { summary: CafeSummary; compare: boolean }) {
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("weekly");
  const points = s.waste.trend[granularity];
  return <div><div className="mb-3 max-w-md"><Segmented value={granularity} options={["daily", "weekly", "monthly"] as const} onChange={setGranularity} /></div>{points.length ? <TrendChart title={`${granularity[0]!.toUpperCase()}${granularity.slice(1)} waste-to-sales trend${granularity === "weekly" ? " · latest 8 weeks" : granularity === "monthly" ? " · latest 6 months" : ""}`} points={points} compare={compare} unit="%" kind="line" /> : <Empty title="Daily trend unavailable" detail="Daily granularity supports selected ranges of up to 62 days. Use weekly or monthly for longer ranges." />}</div>;
}
function TrendChart({ title, points, compare, unit, kind }: { title: string; points: TrendPoint[]; compare: boolean; unit: "%" | "units"; kind: "line" | "bar" }) {
  const hasData = points.some((point) => point.current !== null || (compare && point.previous !== null));
  return <Panel><SectionTitle>{title}</SectionTitle>{!hasData ? <Empty title="Insufficient Data" detail="No valid costed waste and sales combinations are available for these buckets." /> : <><div className="h-72 w-full"><ResponsiveContainer>{kind === "line" ? <LineChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} /><YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} unit={unit === "%" ? "%" : undefined} /><Tooltip content={<TrendTooltip unit={unit} />} /><Line type="monotone" dataKey="current" name="Current" stroke="var(--primary)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />{compare && <Line type="monotone" dataKey="previous" name="Previous" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />}</LineChart> : <BarChart data={points} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} /><YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} /><Tooltip content={<TrendTooltip unit={unit} />} /><Bar dataKey="current" name="Current" fill="var(--primary)" radius={[4, 4, 0, 0]} isAnimationActive={false} />{compare && <Bar dataKey="previous" name="Previous" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />}</BarChart>}</ResponsiveContainer></div><p className="mt-2 text-xs text-muted-foreground">{unit === "%" ? "Waste-to-sales percentages; no peso values. Each comparison point uses the equivalent prior bucket." : "Aggregated units sold. Empty buckets are unknown, not automatically zero."} Partial buckets are identified in tooltips.</p></>}</Panel>;
}
function TrendTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: TrendPoint }[]; unit: "%" | "units" }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const value = (number: number | null) => number === null ? "Insufficient Data" : `${fmtQty(number)}${unit === "%" ? "%" : " units"}`;
  return <div className="rounded-lg border border-border bg-card p-3 text-xs shadow"><p className="font-semibold text-primary">{range(point.currentFrom, point.currentTo)}{point.partial ? " · partial" : ""}</p><p className="mt-1">Current: <b>{value(point.current)}</b></p><p className="text-muted-foreground">Previous ({range(point.previousFrom, point.previousTo)}): <b>{value(point.previous)}</b></p></div>;
}
function InventoryPanel({ summary: s, compare }: { summary: CafeSummary; compare: boolean }) {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Incoming supplier deliveries" value={String(s.inventory.incomingSupplierDeliveries)} sub="Ingredient purchases + outsourced finished-product receipts" /><Stat label="In-house production" value={String(s.inventory.inHouseProduction)} sub="Kept separate from supplier deliveries" /><Stat label="Stockout frequency" value={`${s.inventory.stockouts.items} / ${s.inventory.stockouts.eligibleItems}`} sub="Reconstructed items ending with no available units" /><Stat label="Reconciliation discrepancies" value={String(s.inventory.reconciliation.discrepancies)} sub={`${s.inventory.reconciliation.eligible} eligible ingredient records`} /></div><div className="grid gap-4 lg:grid-cols-2"><Panel><SectionTitle>Inventory sell-through <InfoTip text="Sold units ÷ available units × 100, by compatible finished-product unit group." /></SectionTitle><UnitMetricList metrics={s.inventory.sellThrough} compare={compare} /></Panel><Panel className="min-w-0"><SectionTitle>Weekly closing stock <InfoTip text="Closing stock = opening stock + received/produced − sold/used − wasted. Totals are calculated separately for each stock type and compatible unit." /></SectionTitle>{s.inventory.closing.groups.length ? <Table head={["Week", "Reporting dates", ...s.inventory.closing.groups.map((group) => group.label)]} rows={s.inventory.closing.weeks.map((week) => [`${week.label}${week.partial ? " · partial" : ""}`, range(week.from, week.to), ...s.inventory.closing.groups.map((group) => { const value = week.values[group.key]; return value === null || value === undefined ? "Insufficient data" : `${fmtQty(value)} ${group.unit}`; })])} empty="No eligible weekly closing-stock history is available." /> : <Empty title="Insufficient Data" detail="No eligible closing stock reconstruction is available." />}<p className="mt-3 text-xs text-muted-foreground">Exact aggregate quantities are shown for the latest eight Monday–Sunday weeks in Asia/Manila. The latest week ends on the selected reporting date when incomplete. These are reconstructed totals, not independent physical counts; missing or incompatible records show as insufficient data.</p></Panel></div><Panel><SectionTitle>Inventory movement summary</SectionTitle><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Object.entries(s.inventory.movement).map(([key, count]) => <Status key={key} label={key[0]!.toUpperCase() + key.slice(1)} value={String(count)} detail="records in selected period" />)}</div></Panel><Panel><SectionTitle>Inventory reconciliation <InfoTip text="Opening Stock + Received Stock = Used/Sold + Wasted + Closing Stock. Only current ingredient lots have an independent recorded closing balance." /></SectionTitle>{s.inventory.reconciliation.available ? <div className="grid gap-3 sm:grid-cols-3"><Status label="Balanced" value={String(s.inventory.reconciliation.balanced)} detail="eligible current ingredients" /><Status label="Discrepancies" value={String(s.inventory.reconciliation.discrepancies)} detail="identified, not auto-corrected" /><Status label="Reconciliation rate" value={pct(s.inventory.reconciliation.percentage)} detail="balanced ÷ eligible × 100" /></div> : <Empty title="Insufficient Data" detail="Select a period ending today and ensure ingredient lots have recorded closing balances. Finished goods and historical dates lack independent closing snapshots." />}</Panel></div>;
}
function QualityPanel({ summary: s, compare }: { summary: CafeSummary; compare: boolean }) {
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Record completeness" value={pct(s.quality.completeness.percentage)} sub={`${s.quality.completeness.complete} / ${s.quality.completeness.total} selected-period records`} /><Stat label="Exact duplicate records" value={String(s.quality.duplicates.count)} sub={`${pct(s.quality.duplicates.ratePct)} of ${s.quality.duplicates.checked} checked`} /><Stat label="Invalid references" value={String(s.quality.invalidReferences)} sub="Missing menu, ingredient or batch links" /><Stat label="Inventory reconciliation" value={pct(s.quality.reconciliation.percentage)} sub={`${s.quality.reconciliation.eligible} eligible records`} /></div><Panel><SectionTitle>Synchronization health & data freshness</SectionTitle><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Status label="Last successful sync" value="Unavailable" detail="Device success events are not transmitted" /><Status label="Pending sync" value="Unavailable" detail="Device-local queue is not transmitted" /><Status label="Failures / conflicts" value="Unavailable" detail="No server-side failure or conflict events" /><Status label="Latest operational event" value={s.quality.latestOperationalDate ? shortDate(s.quality.latestOperationalDate) : "No data"} detail="Uses sale, production, purchase, usage or waste event dates" /></div><p className="mt-3 text-xs text-muted-foreground">Latest synced record update: {s.quality.sync.latestRecordUpdatedAt ? new Date(s.quality.sync.latestRecordUpdatedAt).toLocaleString() : "No synced records"}. This timestamp is not substituted for transaction dates. Upsert retries with the same record ID are not counted as new transactions.</p></Panel><Panel><SectionTitle>System adoption & usage</SectionTitle><div className="mb-3 grid gap-3 sm:grid-cols-3"><Status label="Active usage days" value={`${s.usage.activeDays} / ${s.usage.expectedDays}`} detail="Any operational record on expected operating days" /><Status label="Daily closeout completion" value={pct(s.usage.closeoutCompletionPct)} detail="Explicit closeout records only" /><Status label="Overall daily completion" value={pct(s.kpis.logging.overall.current)} detail="Sales + inventory/production + waste check" /></div><div className="grid gap-3 sm:grid-cols-5">{s.usage.features.map((feature) => <Status key={feature.key} label={feature.label} value={`${feature.days} days`} detail="Aggregated; no employee activity shown" />)}</div></Panel><CoverageGrid summary={s} compare={compare} /><DataLimitations summary={s} /></div>;
}
function ResearchPanel({ summary: s }: { summary: CafeSummary }) {
  return <div className="space-y-4"><Callout tone={s.research.allowed ? "info" : "warning"} title={s.research.allowed ? "Research reporting permitted by café" : "Research reporting disabled by café"}>{s.research.allowed ? "The owner has not opted out. Findings below use only privacy-safe aggregates and avoid causal claims." : "The owner opted out of research reporting. Operational monitoring remains available, but research findings are not generated."}</Callout>{s.research.allowed && <Panel><SectionTitle>Research insights</SectionTitle>{s.research.findings.length ? <div className="space-y-3">{s.research.findings.map((finding, index) => <article key={`${finding.metric}-${index}`} className="rounded-lg border border-border p-4"><p className="flex items-center gap-2 font-semibold text-primary"><CheckCircle2 className="h-4 w-4 text-success" />{finding.metric}</p><p className="mt-2 text-sm">{finding.statement}</p><dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><div><dt className="font-semibold text-primary">Reporting period</dt><dd>{finding.period}</dd></div><div><dt className="font-semibold text-primary">Comparison period</dt><dd>{finding.comparisonPeriod}</dd></div><div><dt className="font-semibold text-primary">Observed difference</dt><dd>{finding.difference}</dd></div><div><dt className="font-semibold text-primary">Data completeness</dt><dd>{finding.completeness}</dd></div></dl><p className="mt-2 text-xs text-warning">Limitation: {finding.limitation}</p></article>)}</div> : <Empty title="Insufficient Data" detail="No supported research findings can be generated for this period." />}</Panel>}<DataLimitations summary={s} /></div>;
}
function DataLimitations({ summary: s }: { summary: CafeSummary }) {
  return <Panel><SectionTitle>Data limitations</SectionTitle><ul className="space-y-2 text-sm text-muted-foreground">{s.research.limitations.map((limitation, index) => <li key={index} className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>{limitation}</span></li>)}</ul><p className="mt-3 text-xs font-semibold text-primary">Missing records are reported as missing—not as zero activity. Observed changes do not establish that MenuWise caused them.</p></Panel>;
}
function PrivacyNote() {
  return <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Item and ingredient names are one-way hashed on the server. Prices, costs, recipes, transactions and edit values are confidential.</p>;
}
function Table({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2.5 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0"><thead className="text-xs uppercase text-muted-foreground"><tr>{head.map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-border">{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
