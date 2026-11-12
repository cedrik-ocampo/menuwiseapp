import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
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
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  async function change(id: string, status: "open" | "resolved") {
    setSaving(id);
    try {
      await set({ data: { id, status } });
      await qc.invalidateQueries({ queryKey: ["admin", "bugs"] });
      toast.success(status === "resolved" ? "Marked as resolved" : "Report reopened");
    } catch { toast.error("Couldn't update the report"); }
    finally { setSaving(null); }
  }
  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const all = q.data ?? [];
  const counts = { open: all.filter((r) => r.status === "open").length, resolved: all.filter((r) => r.status !== "open").length, all: all.length };
  const shown = filter === "all" ? all : all.filter((r) => (filter === "open" ? r.status === "open" : r.status !== "open"));
  return (
    <div>
      <PageTitle title="Bug Reports" subtitle="Problems reported by café users, newest first." />
      <div className="mb-3 flex gap-2">
        {(["open", "resolved", "all"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm font-semibold capitalize ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {f} ({counts[f]})
          </button>
        ))}
      </div>
      <Panel>
        {q.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading…</p>
          : q.error ? <p className="py-10 text-center text-destructive">Couldn’t load bug reports.</p>
          : !shown.length ? <p className="py-10 text-center text-muted-foreground">No {filter === "all" ? "" : filter} bug reports.</p> : (
          <ul className="divide-y divide-border">
            {shown.map((r) => {
              const isOpen = open.has(r.id);
              const resolved = r.status !== "open";
              return (
                <li key={r.id} className="py-4">
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => toggleOpen(r.id)} aria-expanded={isOpen} className="min-w-0 flex-1 space-y-1 text-left">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        <p className="font-semibold text-primary">{r.title}</p>
                        {resolved && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Resolved</span>}
                      </div>
                      <p className={`whitespace-pre-wrap text-sm text-primary ${isOpen ? "" : "line-clamp-2"}`}>{r.description}</p>
                      {isOpen ? (
                        <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                          <div><dt className="inline font-semibold">Café: </dt><dd className="inline">{r.cafe}</dd></div>
                          <div><dt className="inline font-semibold">Reporter: </dt><dd className="inline">{r.reporter_name || "Unknown"}{r.reporter_email ? ` (${r.reporter_email})` : ""}</dd></div>
                          <div><dt className="inline font-semibold">Sent: </dt><dd className="inline">{new Date(r.created_at).toLocaleString()}</dd></div>
                          <div><dt className="inline font-semibold">Page: </dt><dd className="inline">{r.page || "—"}</dd></div>
                        </dl>
                      ) : (
                        <p className="text-xs text-muted-foreground">{r.cafe} · {r.reporter_name || r.reporter_email || "Unknown"} · {shortDate(r.created_at)} · View details</p>
                      )}
                    </button>
                    {resolved ? (
                      <button type="button" disabled={saving === r.id} onClick={() => void change(r.id, "open")} className="shrink-0 text-xs font-semibold text-muted-foreground underline">
                        {saving === r.id ? "Saving…" : "Reopen"}
                      </button>
                    ) : (
                      <button type="button" disabled={saving === r.id} onClick={() => void change(r.id, "resolved")}
                        className="flex shrink-0 items-center gap-1 rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                        <Check className="h-4 w-4" />{saving === r.id ? "Saving…" : "Mark resolved"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
