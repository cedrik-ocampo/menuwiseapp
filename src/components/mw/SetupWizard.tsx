import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, UserPlus, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createWorkspaceInvite } from "@/lib/invitations.functions";
import { currentWorkspace, useDB, usePermissions } from "@/lib/store";
import { Panel, SectionTitle, btnPrimary, inputCls } from "./ui";

const DEFAULT_NAME = "My Café";

const HIDE_KEY = "mw-setup-wizard-hidden";

export function SetupWizard({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const db = useDB();
  const [hidden, setHidden] = useState(true);
  useEffect(() => { setHidden(!alwaysShow && localStorage.getItem(HIDE_KEY) === "1"); }, [alwaysShow]);
  const steps = [
    { n: 3, title: "Ingredients & stock", to: "/ingredients", count: db.ingredients.length, unit: "ingredients", note: "Costs, units and current stock. Do this first." },
    { n: 4, title: "Menu items & recipes", to: "/menu-items", count: db.menuItems.length, unit: "menu items", note: "Recipes match ingredients by name.", needs: db.ingredients.length === 0 ? "Import ingredients first" : null },
    { n: 5, title: "Sales", to: "/sales", count: db.sales.length, unit: "sales", note: "Past sales for popularity and revenue.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
    { n: 6, title: "Production", to: "/log-production", count: db.batches.length, unit: "batches", note: "Deducts ingredients used.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
    { n: 7, title: "Waste", to: "/log-waste", count: db.wasteLogs.length, unit: "waste logs", note: "Builds your waste-to-sales ratio.", needs: db.menuItems.length === 0 ? "Import menu items first" : null },
  ] as const;
  const { isOwner } = usePermissions();
  const invite = useServerFn(createWorkspaceInvite);
  const [cafe, setCafe] = useState(DEFAULT_NAME);
  const [cafeDraft, setCafeDraft] = useState("");
  const [team, setTeam] = useState(0);
  const [email, setEmail] = useState("");
  const loadCafe = useCallback(async () => {
    const ws = currentWorkspace();
    if (!ws || !navigator.onLine) return;
    const [{ data: w }, { count: m }, { count: i }] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", ws).maybeSingle(),
      supabase.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", ws),
      supabase.from("workspace_invites").select("id", { count: "exact", head: true }).eq("workspace_id", ws),
    ]);
    if (w?.name) { setCafe(w.name); setCafeDraft((d) => d || (w.name === DEFAULT_NAME ? "" : w.name)); }
    setTeam(Math.max(0, (m ?? 1) - 1) + (i ?? 0));
  }, []);
  useEffect(() => { const t = setTimeout(() => void loadCafe(), 800); return () => clearTimeout(t); }, [loadCafe, db.online]);

  async function saveCafe() {
    const v = cafeDraft.trim();
    if (!v) return void toast.error("Enter your café name");
    if (v.length > 60) return void toast.error("Keep the name under 60 characters");
    const ws = currentWorkspace();
    if (!ws || !navigator.onLine) return void toast.error("Connect to the internet to save");
    const { error } = await supabase.from("workspaces").update({ name: v }).eq("id", ws);
    if (error) return void toast.error("Couldn't save the café name");
    localStorage.setItem("menuwise:cafe_name", v);
    setCafe(v); toast.success("Café name saved");
  }
  async function addMember() {
    const r = z.string().trim().email("Enter a valid email").max(255).safeParse(email);
    if (!r.success) return void toast.error(r.error.issues[0].message);
    const ws = currentWorkspace();
    if (!ws || !navigator.onLine) return void toast.error("Connect to the internet to invite");
    try {
      await invite({ data: { workspaceId: ws, email: r.data } });
      setEmail(""); toast.success(`Invitation saved for ${r.data}. They join when they sign up with this email.`);
      void loadCafe();
    } catch (e) { toast.error((e as Error).message); }
  }

  const named = cafe !== DEFAULT_NAME;
  const teamDone = team > 0 || !isOwner;
  const done = steps.filter((s) => s.count > 0).length + (named ? 1 : 0) + (teamDone ? 1 : 0);
  const total = steps.length + 2;
  if (!alwaysShow && (hidden || done === total)) return null;
  const dot = (ok: boolean, n: number) => <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{ok ? <Check className="h-4 w-4" /> : n}</span>;

  return (
    <Panel className="space-y-3">
      <SectionTitle right={!alwaysShow ? (
        <button type="button" aria-label="Hide setup guide" className="rounded p-1 text-muted-foreground hover:bg-muted" onClick={() => { localStorage.setItem(HIDE_KEY, "1"); setHidden(true); }}><X className="h-4 w-4" /></button>
      ) : undefined}>Set up your café data · {done}/{total} done</SectionTitle>
      <p className="text-sm text-muted-foreground">Name your café, invite your team, then import your spreadsheets in this order. Each import step opens its page, where you can download the template and use Import.</p>
      <ol className="space-y-2">
        <li className="flex items-start gap-3 rounded-lg border border-border p-3">
          {dot(named, 1)}
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block font-semibold">Name your café</span>
            {isOwner ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void saveCafe(); }}>
                <input className={inputCls} aria-label="Café name" placeholder="e.g. Kape Corner" maxLength={60} value={cafeDraft} onChange={(e) => setCafeDraft(e.target.value)} />
                <button type="submit" className={btnPrimary}>Save</button>
              </form>
            ) : <span className="block text-xs text-muted-foreground">{named ? cafe : "Your café owner sets the name."}</span>}
            {isOwner && named && <span className="block text-xs text-muted-foreground">Saved as “{cafe}”</span>}
          </div>
        </li>
        <li className="flex items-start gap-3 rounded-lg border border-border p-3">
          {dot(teamDone, 2)}
          <div className="min-w-0 flex-1 space-y-2">
            <span className="block font-semibold">Add team members</span>
            {isOwner ? (
              <>
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addMember(); }}>
                  <input type="email" className={inputCls} aria-label="Team member email" placeholder="staff@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                  <button type="submit" className={btnPrimary}><UserPlus className="h-4 w-4" /> Invite</button>
                </form>
                <span className="block text-xs text-muted-foreground">{team > 0 ? `${team} team member${team === 1 ? "" : "s"} added or invited · ` : ""}They join as Staff when they sign up with that email. Optional — manage everyone in <Link to="/profile" className="underline">Profile</Link>.</span>
              </>
            ) : <span className="block text-xs text-muted-foreground">You're part of this café's team.</span>}
          </div>
        </li>
        {steps.map((s) => {
          const ok = s.count > 0;
          const needs = "needs" in s ? s.needs : null;
          return (
            <li key={s.n}>
              <Link to={s.to} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{ok ? <Check className="h-4 w-4" /> : s.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{ok ? `${s.count} ${s.unit} loaded` : needs ?? s.note}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
