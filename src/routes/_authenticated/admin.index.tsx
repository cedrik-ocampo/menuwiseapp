import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { listCafes } from "@/lib/admin.functions";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel } from "@/components/mw/ui";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Café Monitoring — MenuWise Admin" },
      { name: "description", content: "Read-only overview of every café using MenuWise." },
      { property: "og:title", content: "Café Monitoring — MenuWise Admin" },
      { property: "og:description", content: "Read-only overview of every café using MenuWise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminHome,
});

function AdminHome() {
  const fn = useServerFn(listCafes);
  const q = useQuery({ queryKey: ["admin", "cafes"], queryFn: () => fn() });
  return (
    <div>
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Café Monitoring" subtitle="Read-only view of every café. Admins can view but never change records." />
      <Panel>
        {q.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading cafés…</p>
          : q.error ? <p className="py-10 text-center text-destructive">You don’t have admin access.</p>
          : !q.data?.length ? <p className="py-10 text-center text-muted-foreground">No cafés yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Café</th><th>Owner</th><th className="text-right">Members</th><th className="text-right">Invites</th><th className="text-right">Menu items</th><th className="text-right">Ingredients</th><th className="text-right">Sales</th><th className="text-right">Batches</th><th className="text-right">Waste logs</th><th>Last activity</th><th /></tr>
              </thead>
              <tbody>
                {q.data.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="py-2 font-semibold text-primary">{c.name}</td>
                    <td><span className="block">{c.owner}</span><span className="text-xs text-muted-foreground">{c.ownerEmail}</span></td>
                    <td className="text-right">{c.members}</td><td className="text-right">{c.pendingInvites}</td>
                    <td className="text-right">{c.counts.menuItems}</td><td className="text-right">{c.counts.ingredients}</td>
                    <td className="text-right">{c.counts.sales}</td><td className="text-right">{c.counts.batches}</td><td className="text-right">{c.counts.wasteLogs}</td>
                    <td>{c.lastActivity ? shortDate(c.lastActivity) : "No records yet"}</td>
                    <td><Link to="/admin/$id" params={{ id: c.id }} className="inline-flex items-center gap-1 font-semibold text-accent"><Eye className="h-4 w-4" /> View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-4 text-xs text-muted-foreground">Future enhancement: an admin edit mode. Admin access is currently read-only.</p>
    </div>
  );
}
