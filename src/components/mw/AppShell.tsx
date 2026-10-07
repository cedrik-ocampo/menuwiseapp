import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Trash2, PackagePlus, LayoutGrid, Package, LogOut, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/mw-logo.png.asset.json";
import { useDB, resetStore } from "@/lib/store";
import { shortDate, todayISO } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { CollectionName } from "@/lib/types";

const TABS: { to: string; label: string; icon: typeof Trash2; pending?: CollectionName[] }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/log-waste", label: "Log Waste", icon: Trash2, pending: ["wasteLogs"] },
  { to: "/log-production", label: "Log Production", icon: PackagePlus, pending: ["batches", "sales"] },
  { to: "/menu", label: "Menu Map", icon: LayoutGrid },
  { to: "/ingredients", label: "Ingredients", icon: Package },
];

function useActive() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (to: string) => (to === "/" ? path === "/" : path === to || path.startsWith(to + "/"));
}

export function NavBar() {
  const isActive = useActive();
  const db = useDB();
  return (
    <>
      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Main"
        role="tablist"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card shadow-[0_-2px_8px_color-mix(in_oklab,var(--foreground)_6%,transparent)] md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid h-16 grid-cols-5">
          {TABS.map((t, i) => {
            const active = isActive(t.to);
            const pending = t.pending?.some((c) => db.pendingCollections.has(c)) && !db.online;
            return (
              <li key={t.to} className="flex">
                <Link
                  to={t.to}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  aria-label={`${t.label}, tab, ${i + 1} of 5`}
                  className={`relative flex min-h-12 w-full flex-col items-center justify-center gap-1 py-1.5 transition-transform duration-100 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${active ? "font-semibold text-primary" : "font-medium text-nav-inactive"}`}
                >
                  {active && <span className="absolute top-0 h-[3px] w-8 rounded-full bg-primary" />}
                  <span className="relative">
                    <t.icon className="h-6 w-6" strokeWidth={active ? 2.2 : 1.8} />
                    {pending && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-warning" />}
                  </span>
                  <span className="whitespace-nowrap text-[10px] leading-none">{t.label}</span>
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
          {TABS.map((t, i) => {
            const active = isActive(t.to);
            const pending = t.pending?.some((c) => db.pendingCollections.has(c)) && !db.online;
            return (
              <Link
                key={t.to}
                to={t.to}
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-label={`${t.label}, tab, ${i + 1} of 5`}
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
        <div className="mt-auto px-5 pb-6">
          <SignOutButton className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" />
        </div>
      </aside>
    </>
  );
}

function SignOutButton({ className }: { className?: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <button
      className={className}
      onClick={async () => {
        await qc.cancelQueries();
        qc.clear();
        resetStore();
        await supabase.auth.signOut();
        navigate({ to: "/login", replace: true });
      }}
    >
      <LogOut className="h-4 w-4" /> Sign out
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
          <p className="truncate text-sm italic opacity-90">{cafeName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!db.online && (
            <span className="flex items-center gap-1 rounded-full bg-warning px-2 py-1 text-xs font-medium text-primary-foreground">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          <SignOutButton className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100 md:hidden" />
          <img src={logo.url} alt="" className="h-12 w-12 object-contain md:hidden" />
        </div>
      </div>
    </header>
  );
}

export function PageTitle({ back, title, subtitle, children }: { back?: { to: string; label: string; params?: Record<string, string> }; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
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
