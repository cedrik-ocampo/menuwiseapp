import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getCafe } from "@/lib/admin.functions";
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
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-2 text-sm font-semibold text-warning">
        <ShieldCheck className="h-4 w-4" /> Viewing as MenuWise admin · read-only
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
      {tab === "Menu Items" && <Table head={["ID", "Name", "Category", "Type", "Retail"]} rows={(by.menuItems ?? []).map((m) => [m.id, m.name, m.category, m.type, formatPeso(m.retailPrice ?? 0)])} />}
      {tab === "Ingredients" && <Table head={["ID", "Name", "Unit", "Unit cost"]} rows={(by.ingredients ?? []).map((i) => [i.id, i.name, i.unit, formatPeso(i.unitCost ?? 0)])} />}
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
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground"><tr>{head.map((h) => <th key={h} className="py-2">{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="py-2 pr-3">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
