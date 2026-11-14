import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { adminPresetCafe, listCafes } from "@/lib/admin.functions";
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
  const q = useQuery({ queryKey: ["admin", "cafes"], queryFn: () => fn(), retry: false });
  return (
    <div>
      <PageTitle title="Café Monitoring" subtitle="Privacy-safe computation outputs for every café. Sales values, prices, costs and transaction details stay with the café." />
      <PresetCafe />
      <Panel>
        {q.isLoading ? <p className="py-10 text-center text-muted-foreground">Loading cafés…</p>
          : q.error ? <p className="py-10 text-center text-destructive">You don’t have admin access.</p>
          : !q.data?.length ? <p className="py-10 text-center text-muted-foreground">No cafés yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2.5 [&_th:first-child]:pl-0 [&_td:first-child]:pl-0 [&_th:last-child]:pr-0 [&_td:last-child]:pr-0">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Café</th><th>Accounts</th><th className="text-right">Members</th><th className="text-right">Invites</th><th className="text-right">Menu items</th><th className="text-right">Ingredients</th><th className="text-right">Sales logs</th><th className="text-right">Batches</th><th className="text-right">Waste logs</th><th>Last activity</th><th /></tr>
              </thead>
              <tbody>
                {q.data.map((c) => (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="py-2 font-semibold text-primary">{c.name}{c.pendingOwner && <span className="mt-1 block text-xs font-normal text-muted-foreground">Pending owner signup: {c.pendingOwner}</span>}</td>
                    <td><ul className="space-y-1">{c.accounts.map((a) => (<li key={a.email + a.role}><span className="block">{a.name} <span className="text-xs text-muted-foreground">({a.role === "owner" ? "Owner" : "Staff"})</span></span><span className="text-xs text-muted-foreground">{a.email}</span></li>))}</ul></td>
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
    </div>
  );
}

function PresetCafe() {
  const fn = useServerFn(adminPresetCafe);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fn({ data: { name, ownerEmail: email } });
      toast.success(`${name} is ready. Ask the owner to sign up with ${email}.`);
      setName(""); setEmail("");
      qc.invalidateQueries({ queryKey: ["admin", "cafes"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not create café"); }
    finally { setBusy(false); }
  }
  return (
    <Panel className="mb-4">
      <p className="mb-1 font-semibold text-primary">Pre-set a new café</p>
      <p className="mb-3 text-sm text-muted-foreground">Create the café now. When the owner signs up with this email, they become its Owner automatically and can complete their private setup.</p>
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Café name" className="h-10 min-w-[200px] flex-1 rounded-md border border-input bg-background px-3 text-sm" />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Owner email" className="h-10 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-sm" />
        <button disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy ? "Creating…" : "Create café"}</button>
      </form>
    </Panel>
  );
}
