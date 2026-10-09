import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { Crown, Download, RefreshCw, Trash2, UserPlus, LogOut, Camera } from "lucide-react";
import { toast } from "sonner";
import { clear as idbClear } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { currentUser, currentWorkspace, getView, useDB } from "@/lib/store";
import { avatarDataUrl } from "@/lib/image";
import { isDemoMode, setPrefs, usePrefs, type Currency, type Landing, type Theme } from "@/lib/prefs";
import { useThreshold } from "@/lib/settings";
import { downloadCsv } from "@/components/mw/ImportButton";
import { PageTitle, CafeName } from "@/components/mw/AppShell";
import { Avatar, useMe, useSignOut } from "@/components/mw/UserMenu";
import { Field, Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "@/components/mw/ui";
import { leaveWorkspace, deleteAccount } from "@/lib/account.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — MenuWise" },
      { name: "description", content: "Manage your account, café workspace, preferences and data in MenuWise." },
      { property: "og:title", content: "Profile — MenuWise" },
      { property: "og:description", content: "Manage your account, café workspace, preferences and data in MenuWise." },
    ],
  }),
  component: Profile,
});

const OFFLINE = "You're offline. Reconnect to save this change.";
interface Member { user_id: string; role: "owner" | "staff"; email: string | null; display_name: string | null }

function Choice<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm font-semibold text-primary">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-lg bg-secondary p-1" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${value === o.v ? "bg-primary text-primary-foreground" : "text-primary"}`}>{o.l}</button>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, desc, onClose, children }: { title: string; desc?: string; onClose: () => void; children: ReactNode }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{desc && <DialogDescription>{desc}</DialogDescription>}</DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Profile() {
  const db = useDB();
  const ws = currentWorkspace();
  const myId = currentUser().id;
  const [me, reloadMe] = useMe();
  const prefs = usePrefs();
  const [threshold, setThreshold] = useThreshold();
  const signOut = useSignOut();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [modal, setModal] = useState<null | "email" | "password" | "delete">(null);
  const demo = isDemoMode();
  useEffect(() => setName(me.name), [me.name]);

  const load = useCallback(async () => {
    if (!ws || !navigator.onLine) return;
    const { data } = await supabase.from("workspace_members").select("user_id,role,email,display_name").eq("workspace_id", ws).order("joined_at");
    if (data) setMembers(data as Member[]);
  }, [ws]);
  useEffect(() => { void load(); }, [load]);
  const sole = members.length <= 1;
  const isOwner = members.some((m) => m.user_id === myId && m.role === "owner");
  const online = () => { if (!navigator.onLine) { toast.error(OFFLINE); return false; } return true; };

  async function saveName() {
    const v = name.trim();
    if (!v) return toast.error("Name can't be empty");
    if (!online()) return;
    const { error } = await supabase.auth.updateUser({ data: { full_name: v.slice(0, 60) } });
    if (error) return toast.error(error.message);
    if (ws) await supabase.from("workspace_members").update({ display_name: v }).eq("workspace_id", ws).eq("user_id", myId);
    toast.success("Name updated"); reloadMe(); void load();
  }

  async function pickAvatar(f?: File) {
    if (!f || !online()) return;
    try {
      const url = await avatarDataUrl(f);
      const { error } = await supabase.auth.updateUser({ data: { avatar_url: url } });
      if (error) throw error;
      toast.success("Photo updated"); reloadMe();
    } catch (e) { toast.error((e as Error).message); }
  }

  async function invite() {
    const r = z.string().trim().email("Enter a valid email").max(255).safeParse(inviteEmail);
    if (!r.success) return toast.error(r.error.issues[0].message);
    if (!online()) return;
    const { error } = await supabase.from("workspace_invites").insert({ workspace_id: ws!, email: r.data.toLowerCase() });
    if (error) return toast.error(error.code === "23505" ? "Already invited" : "Couldn't send the invite");
    toast.success(`${r.data} invited — ask them to sign up with this email`); setInviteEmail("");
  }

  async function leave() {
    if (!online() || !ws || !window.confirm("Leave this café? You'll start with an empty café of your own.")) return;
    try { await leaveWorkspace({ data: { workspaceId: ws } }); localStorage.removeItem(`menuwise:wsid:${myId}`); await idbClear(); toast.success("You left the café"); window.location.href = "/"; }
    catch (e) { toast.error((e as Error).message); }
  }

  function exportData() {
    const v = getView() as unknown as Record<string, unknown>;
    const rows: string[][] = [];
    for (const [c, list] of Object.entries(v)) if (Array.isArray(list)) for (const r of list as { id?: string }[]) rows.push([c, String(r.id ?? ""), JSON.stringify(r)]);
    downloadCsv(`menuwise-export-${new Date().toISOString().slice(0, 10)}.csv`, ["collection", "id", "data"], rows);
  }

  async function clearCache() {
    if (!window.confirm("Clear this device's copy of your café data? Anything not yet synced will be lost. Your data online stays safe.")) return;
    await idbClear();
    toast.success("Local copy cleared — re-syncing");
    setTimeout(() => window.location.reload(), 400);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle back={{ to: "/", label: "Dashboard / Summary" }} title="Profile" subtitle="Your account, café and preferences." />

      <Panel className="space-y-4">
        <SectionTitle>Account</SectionTitle>
        <div className="flex items-center gap-4">
          <Avatar me={me} size={64} />
          <button type="button" className={btnSecondary} onClick={() => fileRef.current?.click()}><Camera className="h-4 w-4" /> Upload photo</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void pickAvatar(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <p className="text-xs text-muted-foreground">Max 2 MB. Saved as a small 128×128 photo.</p>
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
          <div className="flex-1"><Field label="Display name"><input className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></Field></div>
          <button type="submit" className={btnPrimary}>Save</button>
        </form>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Field label="Email"><input className={inputCls} value={me.email} readOnly /></Field></div>
          <button type="button" className={btnSecondary} onClick={() => online() && setModal("email")}>Change email</button>
        </div>
        <button type="button" className={btnSecondary} onClick={() => online() && setModal("password")}>Change password</button>
      </Panel>

      <Panel className="space-y-4">
        <SectionTitle>Workspace</SectionTitle>
        <div><p className="mb-1 text-sm font-semibold text-primary">Café name</p><div className="text-primary"><CafeName initial={localStorage.getItem("menuwise:cafe_name") ?? "My Café"} /></div></div>
        <div>
          <p className="mb-1 text-sm font-semibold text-primary">Members</p>
          {!db.online ? <p className="text-sm text-muted-foreground">Connect to the internet to see members.</p> : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-semibold text-primary">{m.display_name || m.email?.split("@")[0] || "Member"}{m.user_id === myId && " (you)"}{m.role === "owner" && <Crown className="h-3.5 w-3.5 text-warning" />}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.role === "owner" ? "Owner" : "Staff"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {isOwner && (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void invite(); }}>
            <div className="flex-1"><Field label="Invite member"><input type="email" className={inputCls} placeholder="staff@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></Field></div>
            <button type="submit" className={btnPrimary}><UserPlus className="h-4 w-4" /> Invite</button>
          </form>
        )}
        {!sole && <button type="button" className={btnSecondary} onClick={() => void leave()}><LogOut className="h-4 w-4" /> Leave workspace</button>}
      </Panel>

      <Panel className="space-y-4">
        <SectionTitle>Preferences</SectionTitle>
        <Choice<Theme> label="Appearance" value={prefs.theme} onChange={(theme) => setPrefs({ theme })} options={[{ v: "light", l: "Light" }, { v: "dark", l: "Dark" }, { v: "system", l: "System" }]} />
        <Choice<Landing> label="Default landing page" value={prefs.landing} onChange={(landing) => setPrefs({ landing })} options={[{ v: "/", l: "Dashboard" }, { v: "/sales", l: "Sales" }, { v: "/menu", l: "Menu Map" }]} />
        <Choice<number> label="Default Ongoing Insights window" value={threshold} onChange={setThreshold} options={[{ v: 7, l: "7 days" }, { v: 14, l: "14 days" }, { v: 30, l: "30 days" }]} />
        <Choice<Currency> label="Currency format" value={prefs.currency} onChange={(currency) => setPrefs({ currency })} options={[{ v: "P", l: "P" }, { v: "₱", l: "₱" }]} />
        <p className="text-xs text-muted-foreground">Saved on this device. Works offline.</p>
      </Panel>

      <Panel className="space-y-3">
        <SectionTitle>Data</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={exportData}><Download className="h-4 w-4" /> Export my data</button>
          <button type="button" className={btnSecondary} onClick={() => void clearCache()}><RefreshCw className="h-4 w-4" /> Clear local cache</button>
        </div>
      </Panel>

      <div className="rounded-xl border-2 border-destructive/50 bg-card p-5">
        <h3 className="mb-2 text-lg font-bold text-destructive">Danger zone</h3>
        <span title={demo ? "Disabled in demo mode." : undefined} className="inline-block">
          <button type="button" disabled={demo} onClick={() => online() && setModal("delete")}
            className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Delete account
          </button>
        </span>
        {demo && <p className="mt-2 text-xs text-muted-foreground">Disabled in demo mode.</p>}
      </div>

      {modal === "email" && <EmailModal onClose={() => setModal(null)} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
      {modal === "delete" && <DeleteModal sole={sole} onClose={() => setModal(null)} onDone={() => signOut({ clearCache: true })} />}
    </div>
  );
}

function EmailModal({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState("");
  return (
    <Modal title="Change email" desc="We'll send a confirmation link to the new address." onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const r = z.string().trim().email().safeParse(v);
        if (!r.success) return toast.error("Enter a valid email");
        if (!navigator.onLine) return toast.error(OFFLINE);
        const { error } = await supabase.auth.updateUser({ email: r.data });
        if (error) return toast.error(error.message);
        toast.success("Check your new email to confirm the change"); onClose();
      }}>
        <input type="email" className={inputCls} value={v} onChange={(e) => setV(e.target.value)} placeholder="you@example.com" autoFocus />
        <button type="submit" className={btnPrimary}>Send confirmation</button>
      </form>
    </Modal>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [a, setA] = useState(""), [b, setB] = useState("");
  return (
    <Modal title="Change password" onClose={onClose}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        if (a.length < 8) return toast.error("Use at least 8 characters");
        if (a !== b) return toast.error("Passwords don't match");
        if (!navigator.onLine) return toast.error(OFFLINE);
        const { error } = await supabase.auth.updateUser({ password: a });
        if (error) return toast.error(error.message);
        toast.success("Password changed"); onClose();
      }}>
        <Field label="New password"><input type="password" className={inputCls} value={a} onChange={(e) => setA(e.target.value)} autoFocus /></Field>
        <Field label="Confirm new password"><input type="password" className={inputCls} value={b} onChange={(e) => setB(e.target.value)} /></Field>
        <button type="submit" className={btnPrimary}>Change password</button>
      </form>
    </Modal>
  );
}

function DeleteModal({ sole, onClose, onDone }: { sole: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const [txt, setTxt] = useState("");
  const [busy, setBusy] = useState(false);
  const msg = sole
    ? "This will permanently delete your account and all data in this workspace. This cannot be undone."
    : "This will remove you from this workspace. Your logs will remain, marked as from a former member.";
  return (
    <Modal title="Delete account" desc={msg} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Type DELETE to confirm"><input className={inputCls} value={txt} onChange={(e) => setTxt(e.target.value)} autoFocus /></Field>
        <button type="button" disabled={txt !== "DELETE" || busy || isDemoMode()}
          className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          onClick={async () => {
            if (!navigator.onLine) return toast.error(OFFLINE);
            const ws = currentWorkspace();
            if (!ws) return toast.error("Couldn't find your café");
            setBusy(true);
            try {
              await deleteAccount({ data: { workspaceId: ws } });
              localStorage.removeItem("menuwise:cafe_name");
              await onDone();
              toast.success("Your account was deleted");
            } catch (e) { setBusy(false); toast.error((e as Error).message); }
          }}>
          <Trash2 className="h-4 w-4" /> {busy ? "Deleting…" : "Delete"}
        </button>
      </div>
    </Modal>
  );
}
