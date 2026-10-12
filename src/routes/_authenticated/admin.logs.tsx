import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminEdits } from "@/lib/admin.functions";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel } from "@/components/mw/ui";
import { formatPeso, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "My Edit Logs — MenuWise Admin" },
      { name: "description", content: "Every change the MenuWise admin has made across cafés." },
      { property: "og:title", content: "My Edit Logs — MenuWise Admin" },
      { property: "og:description", content: "Every change the MenuWise admin has made across cafés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminLogs,
});

type Log = { id: string; cafeId: string; cafe: string; collection: string; recordId: string; at: string; note?: string; changes: { field: string; from: unknown; to: unknown }[] };
const MONEY = new Set(["retailPrice", "unitCost"]);
const fmt = (f: string, v: unknown) => (v === undefined || v === null || v === "" ? "—" : MONEY.has(f) && typeof v === "number" ? formatPeso(v) : String(v));

function AdminLogs() {
  const fn = useServerFn(listAdminEdits);
  const q = useQuery({ queryKey: ["admin", "logs"], queryFn: async () => JSON.parse(await fn()) as Log[], retry: false });
  return (
    <div>
      <PageTitle title="My Edit Logs" subtitle="Every change you made as MenuWise Admin. Each café also sees these edits." />
      <Panel>
        {q.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading…</p>
          : q.error ? <p className="py-10 text-center text-destructive">Couldn’t load your edit logs.</p>
          : !q.data?.length ? <p className="py-10 text-center text-muted-foreground">No edits yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-2">When</th><th>Café</th><th>Record</th><th>Changes</th><th>Reason</th></tr></thead>
              <tbody>
                {q.data.map((l) => (
                  <tr key={l.id} className="border-t border-border align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{shortDate(l.at)} {new Date(l.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                    <td className="pr-3"><Link to="/admin/$id" params={{ id: l.cafeId }} className="font-semibold text-accent">{l.cafe}</Link></td>
                    <td className="pr-3">{l.collection === "menuItems" ? "Menu item" : "Ingredient"} · {l.recordId}</td>
                    <td className="pr-3">{l.changes.map((c) => `${c.field}: ${fmt(c.field, c.from)} → ${fmt(c.field, c.to)}`).join("; ")}</td>
                    <td className="text-muted-foreground">{l.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
