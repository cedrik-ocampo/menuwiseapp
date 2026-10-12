import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listBugReports, setBugStatus } from "@/lib/admin.functions";
import { PageTitle } from "@/components/mw/AppShell";
import { Panel } from "@/components/mw/ui";
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/bugs")({
  head: () => ({
    meta: [
      { title: "Bug Reports — MenuWise Admin" },
      { name: "description", content: "Bug reports submitted by café users." },
      { property: "og:title", content: "Bug Reports — MenuWise Admin" },
      { property: "og:description", content: "Bug reports submitted by café users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bugs,
});

function Bugs() {
  const list = useServerFn(listBugReports);
  const set = useServerFn(setBugStatus);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "bugs"], queryFn: () => list(), retry: false });
  async function toggle(id: string, status: string) {
    try { await set({ data: { id, status: status === "open" ? "resolved" : "open" } }); await qc.invalidateQueries({ queryKey: ["admin", "bugs"] }); }
    catch { toast.error("Couldn't update the report"); }
  }
  return (
    <div>
      <PageTitle title="Bug Reports" subtitle="Problems reported by café users, newest first." />
      <Panel>
        {q.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading…</p>
          : q.error ? <p className="py-10 text-center text-destructive">Couldn’t load bug reports.</p>
          : !q.data?.length ? <p className="py-10 text-center text-muted-foreground">No bug reports yet.</p> : (
          <ul className="divide-y divide-border">
            {q.data.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-primary">{r.title}</p>
                  <p className="whitespace-pre-wrap text-sm text-primary">{r.description}</p>
                  <p className="text-xs text-muted-foreground">{r.cafe} · {r.reporter_name || r.reporter_email || "Unknown"} {r.reporter_email ? `(${r.reporter_email})` : ""} · {shortDate(r.created_at)}{r.page ? ` · from ${r.page}` : ""}</p>
                </div>
                <button type="button" onClick={() => void toggle(r.id, r.status)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${r.status === "open" ? "bg-warning-soft text-warning" : "bg-success/10 text-success"}`}>
                  {r.status === "open" ? "Open · mark resolved" : "Resolved · reopen"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
