import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Trash2, PackagePlus, LayoutGrid, Package, LogOut, WifiOff, Pencil, Check, X, Users, PhilippinePeso, BookOpen } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import logo from "@/assets/mw-logo.png.asset.json";
import { useDB, usePermissions, resetStore, currentWorkspace } from "@/lib/store";
import { shortDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";
import type { CollectionName } from "@/lib/types";

const TABS: { to: string; label: string; mobileLabel: string; icon: typeof Trash2; pending?: CollectionName[] }[] = [
  { to: "/", label: "Home", mobileLabel: "Home", icon: LayoutDashboard },
  { to: "/sales", label: "Sales", mobileLabel: "Sales", icon: PhilippinePeso, pending: ["sales"] },
  { to: "/log-production", label: "Log Production", mobileLabel: "Production", icon: PackagePlus, pending: ["batches"] },
  { to: "/log-waste", label: "Log Waste", mobileLabel: "Waste", icon: Trash2, pending: ["wasteLogs"] },
  { to: "/ingredients", label: "Ingredients", mobileLabel: "Ingredients", icon: Package },
  { to: "/menu-items", label: "Menu Items", mobileLabel: "Menu Items", icon: BookOpen },
  { to: "/menu", label: "Menu Map", mobileLabel: "Menu Map", icon: LayoutGrid },
];

function useActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => {
    if (to === "/") return path === "/";
    if (to === "/menu-items") return path === "/menu-items" || (path.startsWith("/menu/") && path !== "/menu/");
    if (to === "/menu") return path === "/menu" || path === "/menu/";
    return path === to || path.startsWith(to + "/");
  };
}

export function NavBar() {
  const isActive = useActive();
  const db = useDB();
  const perm = usePermissions();
  const tabs = perm.isOwner ? TABS : TABS.filter((tab) => ["/", "/sales", "/log-production", "/log-waste", ...(perm.canInventory ? ["/ingredients"] : [])].includes(tab.to));
  return (
    <>
      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        role="tablist"
        className="fixed inset-x-0 bottom-0 z-50 overflow-x-auto border-t border-border bg-card shadow-[0_-2px_8px_color-mix(in_oklab,var(--foreground)_6%,transparent)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-16 min-w-max">
          {tabs.map((t, i) => {
            const active = isActive(t.to);
            const pending = t.pending?.some((c) => db.pendingCollections.has(c)) && !db.online;
            return (
              <li key={t.to} className="flex w-[76px] shrink-0">
                <Link
                  to={t.to}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                   aria-label={`${t.label}, tab, ${i + 1} of ${tabs.length}`}
                  className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-1 py-1.5 transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "font-semibold text-primary" : "font-medium text-nav-inactive"}`}
                >
                  {active && <span className="absolute top-0 h-[3px] w-8 rounded-full bg-primary" />}
                  <span className="relative">
                     <t.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
                    {pending && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-warning" />}
                  </span>
                   <span className="block max-w-full truncate px-0.5 text-[9px] leading-none">{t.mobileLabel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Tablet / desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <img src={logo.url} alt="MenuWise logo" className="h-10 w-10 object-contain" />
          <span className="text-lg font-bold text-primary">MenuWise</span>
        </div>
        <nav aria-label="Main" role="tablist" className="flex flex-col gap-1 px-3">
          {tabs.map((t, i) => {
            const active = isActive(t.to);
            const pending = t.pending?.some((c) => db.pendingCollections.has(c)) && !db.online;
            return (
              <Link
                key={t.to}
                to={t.to}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                 aria-label={`${t.label}, tab, ${i + 1} of ${tabs.length}`}
                className={`relative flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "bg-secondary font-semibold text-primary" : "font-medium text-nav-inactive hover:bg-muted"}`}
              >
                {active && <span className="absolute left-0 h-6 w-[3px] rounded-full bg-primary" />}
                <t.icon className="h-5 w-5" />
                {t.label}
                {pending && <span className="ml-auto h-2 w-2 rounded-full bg-warning" />}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

export function CafeName({ initial }: { initial: string }) {
  const perm = usePermissions();
  const [name, setName] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const local = localStorage.getItem("menuwise:cafe_name");
    if (local) { setName(local); setDraft(local); }
    // Shared café name from the team workspace
    const t = setTimeout(async () => {
      const ws = currentWorkspace();
      if (!ws || !navigator.onLine) return;
      const { data } = await supabase.from("workspaces").select("name").eq("id", ws).maybeSingle();
      if (data?.name) { setName(data.name); setDraft(data.name); localStorage.setItem("menuwise:cafe_name", data.name); }
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  async function save() {
    const v = draft.trim();
    if (!v) { toast.error("Café name can't be empty"); return; }
    if (v.length > 60) { toast.error("Keep the name under 60 characters"); return; }
    setName(v);
    setEditing(false);
    localStorage.setItem("menuwise:cafe_name", v);
    const ws = currentWorkspace();
    if (ws) await supabase.from("workspaces").update({ name: v }).eq("id", ws);
    const { error } = await supabase.auth.updateUser({ data: { cafe_name: v } });
    if (error) toast.message("Saved on this device. It will update online when you're connected.");
    else toast.success("Café name updated");
  }
  if (!perm.isOwner) return <p className="max-w-full truncate text-sm italic opacity-90">{name}</p>;
  if (editing) {
    return (
      <form className="mt-1 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <input autoFocus value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} aria-label="Café name" className="min-w-0 rounded-md bg-background px-2 py-1 text-sm text-foreground" />
        <button type="submit" aria-label="Save café name" className="opacity-90 hover:opacity-100"><Check className="h-4 w-4" /></button>
        <button type="button" aria-label="Cancel" className="opacity-90 hover:opacity-100" onClick={() => { setDraft(name); setEditing(false); }}><X className="h-4 w-4" /></button>
      </form>
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)} className="group flex max-w-full items-center gap-1 text-sm italic opacity-90 hover:opacity-100" title="Change café name">
      <span className="truncate">{name}</span>
      <Pencil className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" />
    </button>
  );
}

export function AppHeader({ cafeName }: { cafeName: string }) {
  const db = useDB();
  return (
    <header className="bg-header text-header-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 md:px-8">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">Today is {shortDate(todayISO())}.</h1>
          <CafeName initial={cafeName} />
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!db.online && (
            <span className="flex items-center gap-1 rounded-full bg-warning px-2 py-1 text-xs font-medium text-primary-foreground">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          <NotificationBell />
          <UserMenu />
          <img src={logo.url} alt="" className="h-12 w-12 object-contain md:hidden" />
        </div>
      </div>
    </header>
  );
}

export function PageTitle({ back, title, subtitle, className, children }: { back?: { to: string; label: string; params?: Record<string, string> }; title: string; subtitle?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("mb-6", className)}>
      {back && (
        <Link to={back.to} params={back.params as never} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-primary md:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
