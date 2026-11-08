import { ProductionHistory } from "@/components/mw/History";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AlertTriangle, Check, CheckCircle2, Info, Plus, ArrowUpRight, X } from "lucide-react";
import { matchingQuantity, nextBatchId, sameDayBatches } from "@/lib/duplicate-batches";
import { toast } from "sonner";
import { useDB, put, isWorkspaceOwner } from "@/lib/store";
import { avgWeeklyProduction, producedThisWeek, weekStart } from "@/lib/calc";
import { consumeForProduction } from "@/lib/consume";
import { addDays, fmtQty, shortDate, todayISO, timeOf } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { ProductionTabs } from "@/components/mw/ProductionTabs";
import { ImportButton, type ParsedRow } from "@/components/mw/ImportButton";
import { parseProductionRows } from "@/lib/import-parsers";
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const usedIds = new Set(db.batches.map((b) => b.id));
  const idPrefix = (id: string, d: string) => `${(id || "B").split("-")[0]}-${d.replace(/-/g, "").slice(4)}`;
  const mkRow = (reserved: string[] = [], id = menu?.id ?? "", d = date): Row => {
    const m = db.menuItems.find((x) => x.id === id);
    return { batchId: nextBatchId(idPrefix(id, d), usedIds, reserved), quantity: String(m?.defaultBatchSize ?? ""), expiry: addDays(d, m?.defaultExpiryDays ?? 1) };
  };
  const [rows, setRows] = useState<Row[]>([mkRow()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [confirmDup, setConfirmDup] = useState(false);
  const earlier = menu ? sameDayBatches(db.batches, menu.id, date) : [];
  const dupRows = rows.map((r) => matchingQuantity(earlier, parseFloat(r.quantity)));
  const hasDup = dupRows.some((d) => d.length > 0);
  const who = (b: { createdByName?: string }) => b.createdByName || "Someone";

  const rowSchema = z.object({
    batchId: z.string().trim().min(1, "Batch ID is required").max(30),
    quantity: z.number({ invalid_type_error: "Enter quantity made" }).positive("Quantity must be more than 0"),
    expiry: z.string().min(1, "Expiry date is required"),
  });

  function onItemChange(id: string) {
    setMenuItemId(id);
    setRows([mkRow([], id)]);
    setConfirmDup(false);
  }

  function onDateChange(d: string) {
    setDate(d);
    setConfirmDup(false);
    if (menuItemId) setRows([mkRow([], menuItemId, d)]);
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
    if (hasDup && !confirmDup) return setConfirmDup(true);
    setConfirmDup(false);
    const now = new Date();
    const at = new Date(`${date}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`).toISOString();
    rows.forEach((r) => {
      put("batches", { id: r.batchId.trim(), menuItemId: menu.id, producedAt: at, quantity: parseFloat(r.quantity), expiryDate: r.expiry });
      consumeForProduction(menu, parseFloat(r.quantity), date, r.batchId.trim());
    });
    const total = rows.reduce((a, r) => a + parseFloat(r.quantity), 0);
    setLast(`Latest save: ${fmtQty(total)} ${menu.batchUnit} added to ${rows.map((r) => r.batchId).join(", ")} at ${timeOf(at)} on ${shortDate(date)}. Metrics updated below.`);
    toast.success("Production logged");
    setRows([mkRow(rows.map((r) => r.batchId.trim()))]);
  }


  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Log Production" subtitle="Track every batch, from bake to expiry." />
      <ProductionTabs active="log" />
      <SectionTitle right={
        <ImportButton what="production entries" columns={PROD_COLS} className="h-9 px-3" fields={{ menuitemid: { options: db.menuItems.map((m) => m.id), labels: Object.fromEntries(db.menuItems.map((m) => [m.id, m.name])) }, producedat: { type: "date" }, expirydate: { type: "date" }, quantity: { type: "number" } }} parse={(rows) => parseProductionRows(rows, db)} commit={(items) => items.forEach((b) => {
          put("batches", b);
          const m = db.menuItems.find((x) => x.id === b.menuItemId);
          if (m) consumeForProduction(m, b.quantity, b.producedAt.slice(0, 10), b.id);
        })}
          template={{ filename: "production-template.csv", header: ["Menu_Item_ID", "quantity", "producedAt", "expiryDate", "Batch_ID", "Note"], rows: [[db.menuItems[0]?.id ?? "Spanish Latte", "12", todayISO(), addDays(todayISO(), 1), "EXAMPLE-BATCH", "Example batch"]] }} />
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
          <input type="date" className={inputCls} value={date} onChange={(e) => onDateChange(e.target.value)} />
        </Field>
        {menu && earlier.length > 0 && !hasDup && (
          <p className="flex gap-2 rounded-xl bg-muted p-3 text-sm text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0" />
            Note: {earlier.length} earlier batch{earlier.length > 1 ? "es" : ""} of {menu.name} logged on {shortDate(date)} ({earlier.map((b) => `${fmtQty(b.quantity)} ${menu.batchUnit} by ${who(b)} at ${timeOf(b.producedAt)}`).join("; ")}). New batch ID set to {rows[0]?.batchId}.
          </p>
        )}
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
            {menu && dupRows[i].length > 0 && (
              <p role="alert" className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                Possible duplicate: {who(dupRows[i][0])} already logged {fmtQty(dupRows[i][0].quantity)} {menu.batchUnit} of {menu.name} on {shortDate(date)} at {timeOf(dupRows[i][0].producedAt)} (Batch {dupRows[i][0].id}). If this is the same bake, don't save again.
              </p>
            )}
            <Field label="Expiry date · this batch" hint="Set the expiry for each batch separately." error={errors[i]}>
              <input type="date" className={inputCls} value={r.expiry} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, expiry: e.target.value } : x)))} />
            </Field>
          </div>
        ))}
        <button type="button" className={`${btnSecondary} w-full`} onClick={() => setRows([...rows, mkRow(rows.map((r) => r.batchId.trim()))])}>
          <Plus className="h-4 w-4" /> Add another batch
        </button>
        <p className="text-xs text-muted-foreground">Add another batch of this menu item with its own quantity and expiry date.</p>
      </Panel>
      {errors[0] === "Choose a menu item" && <p className="mt-2 text-sm text-destructive">Choose a menu item</p>}
      {confirmDup && hasDup ? (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <p className="text-sm font-semibold text-foreground">A batch with the same quantity was already logged for this item on {shortDate(date)}.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className={btnSecondary} onClick={() => setConfirmDup(false)}>Cancel</button>
            <button className={btnPrimary} onClick={save}><Check className="h-4 w-4" /> Confirm: separate batch</button>
          </div>
        </div>
      ) : (
        <button className={`${btnPrimary} mt-4 h-12 w-full`} onClick={save}><Check className="h-4 w-4" /> Save production log</button>
      )}
      {isWorkspaceOwner() && <p className="mt-3 text-center text-sm"><Link to="/menu/new" className="font-semibold text-accent">+ Create new menu item</Link></p>}
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
