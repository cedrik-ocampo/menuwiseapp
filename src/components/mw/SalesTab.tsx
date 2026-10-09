import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { put, remove, useDB, type DBView } from "@/lib/store";
import { saleRevenue, saleUnitPrice, weekStart, weeklyRevenue } from "@/lib/calc";
import { addDays, formatPeso, fmtQty, shortDate, todayISO, uid } from "@/lib/format";
import { normDate, num, type Row } from "@/lib/import";
import type { Audit, Sale } from "@/lib/types";
import { AuditCaption } from "./Audit";
import { ImportButton, type ParsedRow } from "./ImportButton";
import { SaleDialog } from "./SaleDialog";
import { Panel, SectionTitle, Stat, btnPrimary } from "./ui";

const SALES_COLS = "sale_date, menu_item_id, quantity (Optional: unit_price, notes)";
function parseSales(rows: Row[], db: DBView): ParsedRow<Sale>[] {
  const t = todayISO(), oldest = addDays(t, -365);
  const existing = new Set(db.sales.map((s) => `${s.date}|${s.menuItemId}`));
  return rows.map((r, k) => {
    const mid = (r.menuitemid ?? "").trim();
    const m = db.menuItems.find((x) => x.id.toLowerCase() === mid.toLowerCase());
    const date = normDate(r.saledate ?? "");
    const q = num(r.quantity ?? "");
    const hasPrice = (r.unitprice ?? "") !== "";
    const p = hasPrice ? num(r.unitprice) : m?.retailPrice ?? 0;
    const base = { line: k + 2, label: `${date || r.saledate || "?"} · ${m?.name ?? mid} · ${r.quantity ?? ""}` };
    const err = !date ? "Invalid sale_date (use YYYY-MM-DD or MM/DD/YYYY)"
      : date > t ? "sale_date is in the future"
      : date < oldest ? "sale_date is more than 1 year old"
      : !mid ? "Missing menu_item_id"
      : !m ? `Unknown menu_item_id "${mid}"`
      : !(Number.isInteger(q) && q > 0) ? "quantity must be a whole number more than 0"
      : hasPrice && !(Number.isFinite(p) && p >= 0) ? "unit_price must be 0 or more"
      : "";
    if (err) return { ...base, error: err };
    return {
      ...base,
      duplicate: existing.has(`${date}|${m!.id}`),
      item: { id: uid("S-"), menuItemId: m!.id, date, quantity: q, unitPrice: p, revenue: q * p, notes: (r.notes ?? "").trim() || undefined },
    };
  });
}

function template(db: DBView) {
  const t = todayISO();
  const fallback = [["ML-001", "Spanish Latte", "180"], ["PS-002", "Almond Croissant", "145"], ["CK-003", "Matcha Cheesecake", "195"]];
  const items = db.menuItems.length ? db.menuItems.slice(0, 3).map((m) => [m.id, m.name, String(m.retailPrice)]) : fallback;
  return {
    filename: "menuwise-sales-template.csv",
    header: ["sale_date", "menu_item_id", "quantity", "unit_price", "notes"],
    rows: items.map(([id, name, price], i) => [addDays(t, -i), id, String(12 - i * 4), price, i === 0 ? `Example: ${name}` : ""]),
  };
}

export function SalesTab({ compactHeader = false }: { compactHeader?: boolean }) {
  const db = useDB();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Sale | null>(null);
  const t = todayISO(), ws = weekStart();
  const nameOf = (id: string) => db.menuItems.find((m) => m.id === id)?.name ?? id;

  const { today, week, top, weeks, list } = useMemo(() => {
    const rev = (s: Sale) => saleRevenue(db, s);
    const today = db.sales.filter((s) => s.date === t).reduce((a, s) => a + rev(s), 0);
    const weekSales = db.sales.filter((s) => s.date >= ws && s.date <= t);
    const week = weekSales.reduce((a, s) => a + rev(s), 0);
    const units = new Map<string, number>();
    weekSales.forEach((s) => units.set(s.menuItemId, (units.get(s.menuItemId) ?? 0) + s.quantity));
    const top = [...units.entries()].sort((a, b) => b[1] - a[1])[0];
    const weeks = weeklyRevenue(db.sales, rev, t);
    const list = [...db.sales].sort((a, b) => b.date.localeCompare(a.date) || ((b as Audit).createdAt ?? "").localeCompare((a as Audit).createdAt ?? ""));
    return { today, week, top, weeks, list };
  }, [db, t, ws]);

  return (
    <div className="space-y-5">
      {(open || editing) && <SaleDialog sale={editing ?? undefined} onClose={() => { setOpen(false); setEditing(null); }} />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!compactHeader && <h3 className="text-xl font-bold text-primary">Sales</h3>}
          <p className="text-sm text-muted-foreground">Track daily sales per menu item. Feeds the popularity axis of the bubble chart.</p>
          <p className="mt-1 text-xs text-muted-foreground">Import · Required Columns: sale_date, menu_item_id, quantity. Optional: unit_price, notes.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={btnPrimary} onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Manual Entry</button>
          <ImportButton what="sales" columns={SALES_COLS} template={template(db)} parse={(rows) => parseSales(rows, db)} commit={(items) => items.forEach((s) => put("sales", s))} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Stat label="Today's Revenue" value={formatPeso(today)} sub={shortDate(t)} />
        <Stat label="This Week's Revenue" value={formatPeso(week)} sub={`Since ${shortDate(ws)}`} />
        <Stat label="Top Seller" value={top ? nameOf(top[0]) : "—"} sub={top ? `${fmtQty(top[1])} units this week` : "No sales this week"} />
      </div>

      <WeeklyRevenue weeks={weeks} hasSales={db.sales.length > 0} />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-secondary text-left text-xs font-bold uppercase text-primary">
            <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Menu Item</th><th className="px-3 py-2 text-right">Quantity</th><th className="px-3 py-2 text-right">Unit Price</th><th className="px-3 py-2 text-right">Revenue</th><th className="px-3 py-2">Notes</th><th className="px-3 py-2 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No sales logged yet.</td></tr>}
            {list.map((s) => (
              <tr key={s.id} className="cursor-pointer border-t border-border align-top hover:bg-muted" onClick={() => navigate({ to: "/menu/$id", params: { id: s.menuItemId } })}>
                <td className="px-3 py-2 font-semibold text-primary">{shortDate(s.date)}</td>
                <td className="px-3 py-2 text-primary">{nameOf(s.menuItemId)}<AuditCaption collection="sales" record={s} /></td>
                <td className="px-3 py-2 text-right">{fmtQty(s.quantity)}</td>
                <td className="px-3 py-2 text-right">{formatPeso(saleUnitPrice(db, s))}</td>
                <td className="px-3 py-2 text-right font-bold text-primary">{formatPeso(saleRevenue(db, s))}</td>
                <td className="px-3 py-2 text-muted-foreground">{s.notes ?? ""}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <button type="button" aria-label="Edit sale" className="text-muted-foreground hover:text-primary" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
                    <button type="button" aria-label="Delete sale" className="text-muted-foreground hover:text-destructive" onClick={() => { if (window.confirm("Delete this sale?")) { remove("sales", s.id); toast.success("Sale deleted"); } }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Last 30 days of sales for one menu item (Individual Menu Item View). */
export function MenuSalesHistory({ menuItemId }: { menuItemId: string }) {
  const db = useDB();
  const [editing, setEditing] = useState<Sale | null>(null);
  const from = addDays(todayISO(), -29);
  const rows = db.sales.filter((s) => s.menuItemId === menuItemId && s.date >= from).sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((a, s) => a + saleRevenue(db, s), 0);
  return (
    <div>
      {editing && <SaleDialog sale={editing} onClose={() => setEditing(null)} />}
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">Last 30 days · {rows.length} entries · Revenue <b className="text-primary">{formatPeso(total)}</b></p>
      {rows.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No sales logged yet.</p> : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] bg-secondary px-4 py-2 text-xs font-bold uppercase text-primary"><span>Date</span><span className="text-right">Quantity</span><span className="text-right">Unit Price</span><span className="text-right">Revenue</span><span /></div>
          {rows.map((s) => (
            <div key={s.id} className="border-t border-border px-4 py-2 text-sm">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_2rem] items-center">
                <span className="font-semibold text-primary">{shortDate(s.date)}</span>
                <span className="text-right">{fmtQty(s.quantity)}</span>
                <span className="text-right">{formatPeso(saleUnitPrice(db, s))}</span>
                <span className="text-right font-bold text-primary">{formatPeso(saleRevenue(db, s))}</span>
                <button type="button" aria-label="Edit sale" className="justify-self-end text-muted-foreground hover:text-primary" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></button>
              </div>
              <AuditCaption collection="sales" record={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function compactPeso(v: number) {
  const sym = formatPeso(0).replace(/[\d.,]/g, "");
  if (v >= 1e6) return `${sym}${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (v >= 1e4) return `${sym}${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  if (v >= 1000) return `${sym}${(v / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  if (v === 0) return formatPeso(0);
  return `${sym}${Math.round(v)}`;
}

function WeeklyRevenue({ weeks, hasSales }: { weeks: ReturnType<typeof weeklyRevenue>; hasSales: boolean }) {
  const avg = weeks.slice(1, 5).reduce((a, w) => a + w.revenue, 0) / 4;
  // oldest → newest, left to right
  const data = [...weeks].reverse();
  const max = Math.max(1, ...data.map((w) => w.revenue));
  const labelOf = (key: string) => data.find((w) => w.key === key)?.label ?? "";
  return (
    <Panel>
      <SectionTitle>Weekly Revenue · last 8 weeks</SectionTitle>
      {!hasSales ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No sales yet. Log or import sales to see weekly revenue.</p>
      ) : (
        <>
          <div className="-mx-1 overflow-x-auto px-1"><div className="mx-auto h-64 w-full min-w-[440px] max-w-4xl">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: 28, right: 8, bottom: 4, left: 4 }} barCategoryGap="20%" maxBarSize={56}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="key" type="category" interval={0} tickFormatter={labelOf} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compactPeso(Number(v))} width={56} domain={[0, Math.ceil(max * 1.15)]} allowDataOverflow />
                <Tooltip
                  cursor={{ fill: "var(--secondary)" }}
                  content={({ active, payload }) => {
                    const w = active ? (payload?.[0]?.payload as (typeof data)[number] | undefined) : undefined;
                    if (!w) return null;
                    const head = w.current ? `This Week (Mon–${new Date().toLocaleDateString("en-US", { weekday: "short" })})` : `Week of ${shortDate(w.start)}–${shortDate(w.end)}`;
                    return <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow">{head}: <b>{formatPeso(w.revenue)}</b></div>;
                  }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]} minPointSize={3} isAnimationActive={false}>
                  {data.map((w) => (
                    <Cell key={w.key}
                      fill={w.revenue === 0 ? "var(--muted-foreground)" : "var(--primary)"}
                      fillOpacity={w.revenue === 0 ? 0.35 : w.current ? 0.45 : 1}
                      stroke={w.current ? "var(--primary)" : undefined}
                      strokeDasharray={w.current ? "4 3" : undefined}
                      strokeWidth={w.current ? 2 : 0} />
                  ))}
                  <LabelList dataKey="revenue" position="top" offset={6} formatter={(v: number) => compactPeso(Number(v))} style={{ fontSize: 9, fill: "var(--foreground)" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div></div>
          <p className="mt-2 text-xs text-muted-foreground">Oldest on the left. This Week (so far) is shown lighter with a dashed outline.</p>
          <p className="mt-1 text-sm text-muted-foreground">Average weekly revenue (last 4 weeks): <span className="font-semibold text-primary">{formatPeso(avg)}</span></p>
        </>
      )}
    </Panel>
  );
}
