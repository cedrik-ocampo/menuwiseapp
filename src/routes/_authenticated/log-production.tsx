import { ProductionHistory } from "@/components/mw/History";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Check, CheckCircle2, Plus, ArrowUpRight, X } from "lucide-react";
import { toast } from "sonner";
import { useDB, put } from "@/lib/store";
import { avgWeeklyProduction, producedThisWeek, weekStart } from "@/lib/calc";
import { consumeForProduction } from "@/lib/consume";
import { addDays, fmtQty, shortDate, todayISO, timeOf } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { ProductionTabs } from "@/components/mw/ProductionTabs";
import { ImportButton, type ParsedRow } from "@/components/mw/ImportButton";
import { normDate, num as toNum, type Row as SheetRow } from "@/lib/import";
import type { Batch } from "@/lib/types";
import { Field, Panel, SectionTitle, Stat, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";

export const Route = createFileRoute("/_authenticated/log-production")({
  validateSearch: (s: Record<string, unknown>) => ({ item: typeof s.item === "string" ? s.item : undefined }),
  head: () => ({
    meta: [
      { title: "Log Production — MenuWise" },
      { name: "description", content: "Track every batch, from bake to expiry." },
      { property: "og:title", content: "Log Production — MenuWise" },
      { property: "og:description", content: "Track every batch, from bake to expiry." },
    ],
  }),
  component: LogProduction,
});

interface Row { batchId: string; quantity: string; expiry: string }

const PROD_COLS = "Menu_Item_ID, quantity, producedAt, expiryDate (Batch_ID optional)";

function LogProduction() {
  const db = useDB();
  const { item } = Route.useSearch();
  const [menuItemId, setMenuItemId] = useState(item ?? "");
  const [date, setDate] = useState(todayISO());
  const menu = db.menuItems.find((m) => m.id === menuItemId);
  const mkRow = (i = 0): Row => {
    const prefix = (menu?.id ?? "B").split("-")[0];
    const d = date.replace(/-/g, "").slice(4);
    return { batchId: `${prefix}-${d}-${String.fromCharCode(65 + i)}`, quantity: String(menu?.defaultBatchSize ?? ""), expiry: addDays(date, menu?.defaultExpiryDays ?? 1) };
  };
  const [rows, setRows] = useState<Row[]>([mkRow()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);

  const rowSchema = z.object({
    batchId: z.string().trim().min(1, "Batch ID is required").max(30),
    quantity: z.number({ invalid_type_error: "Enter quantity made" }).positive("Quantity must be more than 0"),
    expiry: z.string().min(1, "Expiry date is required"),
  });

  function onItemChange(id: string) {
    setMenuItemId(id);
    const m = db.menuItems.find((x) => x.id === id);
    const prefix = id.split("-")[0];
    const d = date.replace(/-/g, "").slice(4);
    setRows([{ batchId: `${prefix}-${d}-A`, quantity: String(m?.defaultBatchSize ?? ""), expiry: addDays(date, m?.defaultExpiryDays ?? 1) }]);
  }

  function save() {
    if (!menu) return setErrors(["Choose a menu item"]);
    const errs: string[] = [];
    rows.forEach((r, i) => {
      const res = rowSchema.safeParse({ ...r, quantity: parseFloat(r.quantity) });
      if (!res.success) errs[i] = res.error.issues[0].message;
      else if (r.expiry < date) errs[i] = "Expiry must be on or after the production date";
      else if (db.batches.some((b) => b.id === r.batchId.trim())) errs[i] = "This Batch ID is already used";
    });
    setErrors(errs);
    if (errs.some(Boolean)) return;
    const now = new Date();
    const at = new Date(`${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`).toISOString();
    rows.forEach((r) => {
      put("batches", { id: r.batchId.trim(), menuItemId: menu.id, producedAt: at, quantity: parseFloat(r.quantity), expiryDate: r.expiry });
      consumeForProduction(menu, parseFloat(r.quantity), date, r.batchId.trim());
    });
    const total = rows.reduce((a, r) => a + parseFloat(r.quantity), 0);
    setLast(`Latest save: ${fmtQty(total)} ${menu.batchUnit} added to ${rows.map((r) => r.batchId).join(", ")} at ${timeOf(at)} on ${shortDate(date)}. Metrics updated below.`);
    toast.success("Production logged");
    setRows([{ ...mkRow(rows.length), batchId: `${rows[0].batchId.slice(0, -1)}${String.fromCharCode(65 + rows.length)}` }]);
  }

  function parseProd(rows: SheetRow[]): ParsedRow<Batch>[] {
    const used = new Set(db.batches.map((b) => b.id));
    return rows.map((r, k) => {
      const mid = r.menuitemid || r.menuitem || "";
      const m = db.menuItems.find((x) => x.id.toLowerCase() === mid.toLowerCase() || x.name.toLowerCase() === mid.toLowerCase());
      const q = toNum(r.quantity), produced = normDate(r.producedat || r.productiondate || r.date), exp = normDate(r.expirydate);
      const id = (r.batchid || `${(m?.id ?? "B").split("-")[0]}-${produced.replace(/-/g, "").slice(4)}-I${k}`).trim();
      const base = { line: k + 2, label: `${m?.name ?? mid} · ${r.quantity ?? ""}` };
      const err = !m ? `Unknown menu item "${mid}"` : !(q > 0) ? "Quantity must be more than 0" : !produced ? "Invalid producedAt" : !exp ? "Invalid expiryDate" : exp < produced ? "Expiry is before production date" : used.has(id) ? `Batch ID ${id} already used` : "";
      if (err) return { ...base, error: err };
      used.add(id);
      return { ...base, item: { id, menuItemId: m!.id, producedAt: new Date(`${produced}T08:00`).toISOString(), quantity: q, expiryDate: exp } };
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Log Production" subtitle="Track every batch, from bake to expiry." />
      <ProductionTabs active="log" />
      <SectionTitle right={
        <ImportButton what="production entries" columns={PROD_COLS} className="h-9 px-3" parse={parseProd} commit={(items) => items.forEach((b) => {
          put("batches", b);
          const m = db.menuItems.find((x) => x.id === b.menuItemId);
          if (m) consumeForProduction(m, b.quantity, b.producedAt.slice(0, 10), b.id);
        })}
          template={{ filename: "production-template.csv", header: ["Menu_Item_ID", "quantity", "producedAt", "expiryDate", "Batch_ID"], rows: [] }} />
      }>Production Log Form</SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-muted-foreground">Import · Required Columns: {PROD_COLS}.</p>
      <Panel className="space-y-4">
        <Field label="Menu item" error={errors[0] === "Choose a menu item" ? "Choose a menu item" : undefined}>
          <select className={inputCls} value={menuItemId} onChange={(e) => onItemChange(e.target.value)}>
            <option value="">Select a menu item</option>
            {db.menuItems.map((m) => <option key={m.id} value={m.id}>{m.id} · {m.name}</option>)}
          </select>
        </Field>
        <Field label="Production date">
          <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        {rows.map((r, i) => (
          <div key={i} className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-primary">Batch Make {rows.length > 1 ? i + 1 : ""}</p>
              {rows.length > 1 && <button aria-label="Remove batch" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>}
            </div>
            <Field label="Batch ID"><input className={inputCls} value={r.batchId} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, batchId: e.target.value } : x)))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity made"><input inputMode="decimal" className={inputCls} value={r.quantity} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /></Field>
              <Field label="Unit"><input className={inputCls} value={menu?.batchUnit ?? ""} disabled /></Field>
            </div>
            <Field label="Expiry date · this batch" hint="Set the expiry for each batch separately." error={errors[i]}>
              <input type="date" className={inputCls} value={r.expiry} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, expiry: e.target.value } : x)))} />
            </Field>
          </div>
        ))}
        <button type="button" className={`${btnSecondary} w-full`} onClick={() => setRows([...rows, { ...mkRow(rows.length), batchId: `${rows[0].batchId.slice(0, -1)}${String.fromCharCode(65 + rows.length)}` }])}>
          <Plus className="h-4 w-4" /> Add another batch
        </button>
        <p className="text-xs text-muted-foreground">Add another batch of this menu item with its own quantity and expiry date.</p>
      </Panel>
      {errors[0] === "Choose a menu item" && <p className="mt-2 text-sm text-destructive">Choose a menu item</p>}
      <button className={`${btnPrimary} mt-4 h-12 w-full`} onClick={save}><Check className="h-4 w-4" /> Save production log</button>
      <p className="mt-3 text-center text-sm"><Link to="/menu/new" className="font-semibold text-accent">+ Create new menu item</Link></p>
      {last && (
        <p className="mt-3 flex gap-2 rounded-xl bg-success/10 p-3 text-sm text-success"><CheckCircle2 className="h-5 w-5 shrink-0" /> {last}</p>
      )}

      {menu && (
        <div className="mt-8 space-y-4">
          <SectionTitle>Updated Metrics</SectionTitle>
          <p className="-mt-2 text-sm text-muted-foreground">{menu.name} · includes the latest saved batch</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Amt. Produced for the Week" value={<>{fmtQty(producedThisWeek(db, menu.id))} <span className="text-sm font-normal">{menu.batchUnit}</span></>} sub={`${shortDate(weekStart())}–${shortDate(addDays(weekStart(), 6))}`} />
            <Stat label="Average Weekly Production" value={<>{fmtQty(Math.round(avgWeeklyProduction(db, menu.id)))} <span className="text-sm font-normal">{menu.batchUnit}</span></>} sub="Last 4 complete weeks" />
          </div>
          <Link to="/menu/$id" params={{ id: menu.id }} className="block rounded-2xl border border-border bg-card p-5 hover:border-accent">
            <p className="flex items-center justify-between font-bold text-primary">{menu.name} <ArrowUpRight className="h-5 w-5 text-accent" /></p>
            <p className="mt-1 text-sm text-muted-foreground">Compare production, sales and waste to plan the next bake.</p>
            <p className="mt-2 text-sm font-semibold text-accent">View Individual Menu Item →</p>
          </Link>
        </div>
      )}
      <div className="mt-8"><ProductionHistory db={db} /></div>
    </div>
  );
}
