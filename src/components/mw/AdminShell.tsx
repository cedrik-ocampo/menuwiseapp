import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import logo from "@/assets/mw-logo.png.asset.json";
import { useDB } from "@/lib/store";
import { shortDate } from "@/lib/format";
import { UserMenu } from "./UserMenu";

export function AdminHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const tab = (to: string, label: string, active: boolean) => (
    <Link to={to} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-header-foreground text-header" : "opacity-80 hover:opacity-100"}`}>{label}</Link>
  );
  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-8">
        <div className="flex items-center gap-3">
          <img src={logo.url} alt="MenuWise logo" className="h-10 w-10 object-contain" />
          <div>
            <p className="text-lg font-bold">MenuWise Admin</p>
            <p className="flex items-center gap-1 text-xs opacity-80"><ShieldCheck className="h-3 w-3" /> Café Monitoring</p>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {tab("/admin", "Cafés", path === "/admin" || (path.startsWith("/admin/") && path !== "/admin/logs" && path !== "/admin/bugs"))}
          {tab("/admin/logs", "My Edit Logs", path === "/admin/logs")}
          {tab("/admin/bugs", "Bug Reports", path === "/admin/bugs")}
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}

const SEEN_KEY = "menuwise:admin-edits-seen";

/** Shown to café staff when a MenuWise admin has changed their records since they last dismissed it. */
export function AdminEditNotice() {
  const db = useDB();
  const [seen, setSeen] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setSeen(localStorage.getItem(SEEN_KEY)); setHydrated(true); }, []);
  const edits = db.changeLogs.filter((c) => c.adminEdit && c.action !== "viewed" && (c.collection === "menuItems" || c.collection === "ingredients")).sort((a, b) => b.at.localeCompare(a.at));
  const unseen = edits.filter((c) => !seen || c.at > seen);
  if (!hydrated || !unseen.length) return null;
  const name = (c: (typeof edits)[number]) => {
    const list = c.collection === "menuItems" ? db.menuItems : db.ingredients;
    return (list as { id: string; name: string }[]).find((r) => r.id === c.recordId)?.name ?? c.recordId;
  };
  return (
    <div className="mb-4 rounded-xl border border-warning-border bg-warning-soft px-4 py-3 text-sm text-warning">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 shrink-0" /> MenuWise Admin made {unseen.length} edit{unseen.length > 1 ? "s" : ""} to your café</p>
        <button type="button" aria-label="Dismiss" onClick={() => { const t = edits[0]!.at; localStorage.setItem(SEEN_KEY, t); setSeen(t); }}><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {unseen.slice(0, 5).map((c) => (
          <li key={c.id}>{shortDate(c.at)} · {c.collection === "menuItems" ? "Menu item" : "Ingredient"} <b>{name(c)}</b>: {c.changes.map((ch) => ch.field).join(", ")}{c.note ? ` — “${c.note}”` : ""}</li>
        ))}
      </ul>
    </div>
  );
}
