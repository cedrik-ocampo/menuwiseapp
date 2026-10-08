import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Mail, Trash2, UserPlus, Crown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { currentUser, currentWorkspace, useDB } from "@/lib/store";
import { shortDate } from "@/lib/format";
import { PageTitle } from "@/components/mw/AppShell";
import { Field, Panel, SectionTitle, btnPrimary, inputCls } from "@/components/mw/ui";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — MenuWise" },
      { name: "description", content: "Invite staff so everyone at your café shares the same inventory, menu and logs." },
      { property: "og:title", content: "Team — MenuWise" },
      { property: "og:description", content: "Invite staff so everyone at your café shares the same inventory, menu and logs." },
    ],
  }),
  component: Team,
});

interface Member { user_id: string; role: "owner" | "staff"; email: string | null; display_name: string | null; joined_at: string }
interface Invite { id: string; email: string; created_at: string }

function Team() {
  const db = useDB();
  const ws = currentWorkspace();
  const me = currentUser().id;
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!ws) return;
    const [m, i] = await Promise.all([
      supabase.from("workspace_members").select("user_id,role,email,display_name,joined_at").eq("workspace_id", ws).order("joined_at"),
      supabase.from("workspace_invites").select("id,email,created_at").eq("workspace_id", ws).order("created_at"),
    ]);
    if (m.data) setMembers(m.data as Member[]);
    if (i.data) setInvites(i.data);
    setLoading(false);
  }, [ws]);
  useEffect(() => { void load(); }, [load]);

  const isOwner = members.some((m) => m.user_id === me && m.role === "owner");

  async function invite() {
    const r = z.string().trim().email("Enter a valid email").max(255).safeParse(email);
    if (!r.success) return setErr(r.error.issues[0].message);
    const e = r.data.toLowerCase();
    if (members.some((m) => m.email?.toLowerCase() === e)) return setErr("This person is already on the team");
    setErr("");
    const { error } = await supabase.from("workspace_invites").insert({ workspace_id: ws!, email: e });
    if (error) return setErr(error.code === "23505" ? "Already invited" : "Couldn't send the invite. Check your connection.");
    toast.success(`${e} invited`);
    setEmail("");
    void load();
  }

  if (!db.online) return <div><PageTitle title="Team" /><p className="text-muted-foreground">Connect to the internet to manage your team.</p></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Team" subtitle="Everyone on your team sees the same inventory, menu and logs." />

      {isOwner && (
        <Panel className="mb-6 space-y-3">
          <SectionTitle>Invite a staff member</SectionTitle>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void invite(); }}>
            <div className="flex-1"><Field label="Email" error={err}><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@example.com" /></Field></div>
            <button type="submit" className={`${btnPrimary} mt-7 shrink-0`}><UserPlus className="h-4 w-4" /> Invite</button>
          </form>
          <p className="text-xs text-muted-foreground">Ask them to sign up or sign in to MenuWise with this email — they'll join your café automatically.</p>
        </Panel>
      )}

      <Panel className="mb-6">
        <SectionTitle>Members</SectionTitle>
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.user_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-semibold text-primary">
                    {m.display_name || m.email?.split("@")[0] || "Member"}{m.user_id === me && " (you)"}
                    {m.role === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email} · {m.role === "owner" ? "Owner" : "Staff"} · joined {shortDate(m.joined_at)}</p>
                </div>
                {isOwner && m.role === "staff" && (
                  <button aria-label="Remove member" className="text-muted-foreground hover:text-destructive" onClick={async () => {
                    if (!window.confirm(`Remove ${m.email ?? "this member"} from the team?`)) return;
                    const { error } = await supabase.from("workspace_members").delete().eq("workspace_id", ws!).eq("user_id", m.user_id);
                    if (error) toast.error("Couldn't remove member"); else { toast.success("Member removed"); void load(); }
                  }}><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {invites.length > 0 && (
        <Panel>
          <SectionTitle>Waiting to join</SectionTitle>
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-primary"><Mail className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{i.email}</span></span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  Invited {shortDate(i.created_at)}
                  {isOwner && (
                    <button aria-label="Cancel invite" className="hover:text-destructive" onClick={async () => {
                      await supabase.from("workspace_invites").delete().eq("id", i.id);
                      void load();
                    }}><Trash2 className="h-4 w-4" /></button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
