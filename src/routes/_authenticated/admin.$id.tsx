import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Pencil, ShieldCheck } from "lucide-react";
import { adminSaveMenuItems, adminUpdateRecord, getCafe } from "@/lib/admin.functions";
import { MenuImport } from "@/components/mw/MenuImport";
import type { DBView } from "@/lib/store";
import type { MenuItem } from "@/lib/types";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel, SectionTitle, Segmented, Stat } from "@/components/mw/ui";
import { formatPeso, fmtQty, shortDate, todayISO, addDays } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/$id")({
  head: () => ({
    meta: [
      { title: "Café Details — MenuWise Admin" },
      { name: "description", content: "Read-only café records, members and invitations." },
      { property: "og:title", content: "Café Details — MenuWise Admin" },
      { property: "og:description", content: "Read-only café records, members and invitations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminCafe,
});

type Rec = Record<string, any>;
const TABS = ["Overview", "Menu Items", "Ingredients", "Sales", "Production", "Waste", "Members"] as const;

function AdminCafe() {
  const { id } = Route.useParams();
  const fn = useServerFn(getCafe);
  const q = useQuery({ queryKey: ["admin", "cafe", id], queryFn: () => fn({ data: { id } }), retry: false });
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [editMode, setEditMode] = useState(false);
  const by = useMemo(() => {
    const m: Record<string, Rec[]> = {};
    if (q.data) (JSON.parse(q.data.recordsJson) as { collection: string; data: Rec }[]).forEach((r) => (m[r.collection] ??= []).push(r.data));
    return m;
  }, [q.data]);
  const menuName = (mid: string) => by.menuItems?.find((m) => m.id === mid)?.name ?? mid;
  const rev = (s: Rec) => s.revenue ?? s.quantity * (s.unitPrice ?? by.menuItems?.find((m) => m.id === s.menuItemId)?.retailPrice ?? 0);

  if (q.isLoading) return <p className="py-20 text-center text-muted-foreground">Loading café…</p>;
  if (q.error || !q.data) return <p className="py-20 text-center text-destructive">Café unavailable or you don’t have admin access.</p>;
  const sales = by.sales ?? [], waste = by.wasteLogs ?? [];
  const from = addDays(todayISO(), -29);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-2 text-sm font-semibold text-warning">
        <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> {editMode ? "Edit mode on · changes are logged and shown to this café" : "Viewing as MenuWise admin · read-only"}</span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={editMode} onChange={(e) => setEditMode(e.target.checked)} className="h-4 w-4 accent-current" /> Edit mode
        </label>
      </div>
      <PageTitle back={{ to: "/admin", label: "Café Monitoring" }} title={q.data.cafe.name} subtitle={`Created ${shortDate(q.data.cafe.created_at)}`} />
      <div className="mb-4 overflow-x-auto"><Segmented value={tab} options={TABS} onChange={setTab} /></div>

      {tab === "Overview" && (
        <div className="grid gap-3 md:grid-cols-3">
          <Stat label="Sales value · last 30 days" value={formatPeso(sales.filter((s) => s.date >= from).reduce((a, s) => a + rev(s), 0))} />
          <Stat label="Waste value · last 30 days" value={formatPeso(waste.filter((w) => String(w.at).slice(0, 10) >= from).reduce((a, w) => a + (w.value ?? 0), 0))} />
          <Stat label="Members / pending invites" value={`${q.data.members.length} / ${q.data.invites.length}`} />
          <Stat label="Menu items" value={String(by.menuItems?.length ?? 0)} />
          <Stat label="Ingredients" value={String(by.ingredients?.length ?? 0)} />
          <Stat label="Production batches" value={String(by.batches?.length ?? 0)} />
        </div>
      )}
      {tab === "Menu Items" && editMode && <AdminMenuSetup workspaceId={id} by={by} />}
      {tab === "Menu Items" && (editMode
        ? <EditTable workspaceId={id} collection="menuItems" records={by.menuItems ?? []} fields={[{ k: "name", label: "Name" }, { k: "category", label: "Category" }, { k: "retailPrice", label: "Retail (₱)", num: true }]} />
        : <Table head={["ID", "Name", "Category", "Type", "Retail", "Last edit"]} rows={(by.menuItems ?? []).map((m) => [m.id, m.name, m.category, m.type, formatPeso(m.retailPrice ?? 0), m.updatedByName ? `${m.updatedByName} · ${shortDate(m.updatedAt)}` : "—"])} />)}
      {tab === "Ingredients" && (editMode
        ? <EditTable workspaceId={id} collection="ingredients" records={by.ingredients ?? []} fields={[{ k: "name", label: "Name" }, { k: "unit", label: "Unit" }, { k: "unitCost", label: "Unit cost (₱)", num: true }]} />
        : <Table head={["ID", "Name", "Unit", "Unit cost", "Last edit"]} rows={(by.ingredients ?? []).map((i) => [i.id, i.name, i.unit, formatPeso(i.unitCost ?? 0), i.updatedByName ? `${i.updatedByName} · ${shortDate(i.updatedAt)}` : "—"])} />)}
      {editMode && tab !== "Menu Items" && tab !== "Ingredients" && <p className="mt-3 text-xs text-muted-foreground">Edit mode covers Menu Items and Ingredients. Other tabs stay read-only.</p>}
      {tab === "Sales" && <Table head={["Date", "Menu item", "Qty", "Revenue"]} rows={[...sales].sort((a, b) => String(b.date).localeCompare(a.date)).map((s) => [shortDate(s.date), menuName(s.menuItemId), fmtQty(s.quantity), formatPeso(rev(s))])} />}
      {tab === "Production" && <Table head={["Batch", "Menu item", "Produced", "Qty", "Expiry"]} rows={[...(by.batches ?? [])].sort((a, b) => String(b.producedAt).localeCompare(a.producedAt)).map((b) => [b.id, menuName(b.menuItemId), shortDate(b.producedAt), fmtQty(b.quantity), shortDate(b.expiryDate)])} />}
      {tab === "Waste" && <Table head={["Date", "Stage", "Type", "Qty", "Value"]} rows={[...waste].sort((a, b) => String(b.at).localeCompare(a.at)).map((w) => [shortDate(w.at), w.stage, w.wasteType, `${fmtQty(w.quantity)} ${w.unit}`, formatPeso(w.value ?? 0)])} />}
      {tab === "Members" && (
        <div className="space-y-4">
          <Table head={["Name", "Email", "Role", "Joined"]} rows={q.data.members.map((m) => [m.display_name ?? "—", m.email ?? "—", m.role, shortDate(m.joined_at)])} />
          <Panel><SectionTitle>Pending invitations</SectionTitle>
            {q.data.invites.length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p>
              : <ul className="text-sm">{q.data.invites.map((i) => <li key={i.id} className="border-t border-border py-2">{i.email} · invited {shortDate(i.created_at)}</li>)}</ul>}
          </Panel>
        </div>
      )}
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <Panel>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No records.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2.5 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
            <thead className="text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

type Field = { k: string; label: string; num?: boolean };

function EditTable({ workspaceId, collection, records, fields }: { workspaceId: string; collection: "menuItems" | "ingredients"; records: Rec[]; fields: Field[] }) {
  if (!records.length) return <Panel><p className="py-6 text-center text-sm text-muted-foreground">No records.</p></Panel>;
  return (
    <Panel>
      <div className="space-y-3">
        {records.map((r) => <EditRow key={r.id} workspaceId={workspaceId} collection={collection} rec={r} fields={fields} />)}
      </div>
    </Panel>
  );
}

function EditRow({ workspaceId, collection, rec, fields }: { workspaceId: string; collection: "menuItems" | "ingredients"; rec: Rec; fields: Field[] }) {
  const save = useServerFn(adminUpdateRecord);
  const qc = useQueryClient();
  const init = () => Object.fromEntries(fields.map((f) => [f.k, String(rec[f.k] ?? "")]));
  const [vals, setVals] = useState<Record<string, string>>(init);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const dirty = fields.some((f) => vals[f.k] !== String(rec[f.k] ?? ""));
  async function submit() {
    const patch: Record<string, string | number> = {};
    for (const f of fields) {
      if (vals[f.k] === String(rec[f.k] ?? "")) continue;
      if (f.num) {
        const n = Number(vals[f.k]);
        if (!Number.isFinite(n) || n < 0) { toast.error(`${f.label} must be a number ≥ 0`); return; }
        patch[f.k] = n;
      } else {
        if (f.k === "name" && !vals[f.k].trim()) { toast.error("Name can't be empty"); return; }
        patch[f.k] = vals[f.k].trim();
      }
    }
    setBusy(true);
    try {
      const res = await save({ data: { workspaceId, collection, id: rec.id, patch, note: note.trim() || undefined } });
      toast.success(res.changed ? "Saved. The café will see this admin edit." : "No changes");
      setNote("");
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch {
      toast.error("Couldn't save this edit");
    } finally { setBusy(false); }
  }
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><Pencil className="h-3 w-3" /> {rec.id}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f.k} className="text-xs font-medium text-muted-foreground">{f.label}
            <input value={vals[f.k]} inputMode={f.num ? "decimal" : undefined} onChange={(e) => setVals({ ...vals, [f.k]: e.target.value })} className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional, shown to the café)" className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm" />
        <button type="button" disabled={!dirty} onClick={() => setVals(init())} className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground disabled:opacity-40">Reset</button>
        <button type="button" disabled={!dirty || busy} onClick={() => void submit()} className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

function AdminMenuSetup({ workspaceId, by }: { workspaceId: string; by: Record<string, Rec[]> }) {
  const save = useServerFn(adminSaveMenuItems);
  const qc = useQueryClient();
  const db = useMemo(() => ({ ready: true, ingredients: by.ingredients ?? [], purchases: by.purchases ?? [], usages: by.usages ?? [], menuItems: by.menuItems ?? [], batches: by.batches ?? [], sales: by.sales ?? [], wasteLogs: by.wasteLogs ?? [], changeLogs: [], insightResponses: [], pendingCollections: new Set(), online: true }) as unknown as DBView, [by]);
  const [f, setF] = useState({ name: "", category: "", retailPrice: "", purchase: "", pieces: "1", shelf: "1" });
  const [busy, setBusy] = useState(false);
  async function persist(items: MenuItem[]) {
    const res = await save({ data: { workspaceId, items: items as unknown as { id: string; name: string }[] } });
    toast.success(`Saved for this café: ${res.added} added, ${res.updated} updated.`);
    await qc.invalidateQueries({ queryKey: ["admin"] });
  }
  async function add() {
    const name = f.name.trim(), price = Number(f.retailPrice), cost = Number(f.purchase), pieces = Number(f.pieces), shelf = Number(f.shelf);
    if (!name || !f.category.trim()) { toast.error("Name and category are required"); return; }
    if (db.menuItems.some((m) => m.name.trim().toLowerCase() === name.toLowerCase())) { toast.error("A menu item with this name already exists"); return; }
    if (!(price > 0) || !(cost >= 0) || !(pieces > 0) || !(shelf >= 0)) { toast.error("Check the prices, pieces and shelf life"); return; }
    const item: MenuItem = { id: `M-${Date.now().toString(36)}`, name, category: f.category.trim(), subcategory: "", description: "", available: true, tags: [], type: "Outsourced", batchCost: 0, yield: pieces, purchaseCost: cost, unit: "piece", retailPrice: price, supplier: "", shelfLifeDays: shelf, expiryRule: "After the shelf life", defaultBatchSize: 1, batchUnit: "pieces", defaultExpiryDays: shelf, defaultWasteStage: "Finished Product", defaultWasteType: "Unsold", allowQuickAdd: true, recipe: [] } as MenuItem;
    setBusy(true);
    try { await persist([item]); setF({ name: "", category: "", retailPrice: "", purchase: "", pieces: "1", shelf: "1" }); }
    catch { toast.error("Couldn't add this item"); } finally { setBusy(false); }
  }
  const input = "mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground";
  const fields: [keyof typeof f, string][] = [["name", "Name"], ["category", "Category"], ["retailPrice", "Selling price (₱)"], ["purchase", "Purchase price (₱)"], ["pieces", "Pieces per purchase"], ["shelf", "Shelf life (days)"]];
  return (
    <Panel className="mb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SectionTitle>Set up menu items for this café</SectionTitle>
        <MenuImport db={db} save={persist} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Quick add creates a ready-to-sell item without a recipe. For recipes, use Import. Everything is labeled as a MenuWise Admin change for the café.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {fields.map(([k, label]) => <label key={k} className="text-xs font-medium text-muted-foreground">{label}<input value={f[k]} inputMode={k === "name" || k === "category" ? undefined : "decimal"} onChange={(e) => setF({ ...f, [k]: e.target.value })} className={input} /></label>)}
      </div>
      <button type="button" disabled={busy} onClick={() => void add()} className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Adding…" : "Add item"}</button>
    </Panel>
  );
}
