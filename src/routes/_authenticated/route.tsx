import { createFileRoute, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initStore, resetStore, useDB, usePermissions } from "@/lib/store";
import { AppHeader, NavBar } from "@/components/mw/AppShell";
import { SessionTimeout } from "@/components/mw/SessionTimeout";
import { AdminHeader, AdminEditNotice } from "@/components/mw/AdminShell";
import { useIsAdmin } from "@/lib/useIsAdmin";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Offline sign-in: a session saved on this device lets the app open without internet.
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) throw redirect({ to: "/login" });
    if (navigator.onLine) {
      const { data, error } = await supabase.auth.getUser();
      if (!data.user && error && (error.status === 401 || error.status === 403)) throw redirect({ to: "/login" });
    }
    return { user: s.session.user };
  },
  component: Layout,
});

function Layout() {
  const admin = useIsAdmin();
  if (admin.isLoading) return <p className="py-20 text-center text-muted-foreground">Loading…</p>;
  const acting = typeof window !== "undefined" ? sessionStorage.getItem(ADMIN_WS_KEY) : null;
  if (admin.data?.admin) return acting ? <CafeLayout adminWorkspace={acting} /> : <AdminLayout />;
  return <CafeLayout />;
}

/** Admin account: Café Monitoring only — no café dashboard, sidebar or tabs. */
function AdminLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const onAdmin = path === "/admin" || path.startsWith("/admin/");
  useEffect(() => {
    if (!onAdmin) navigate({ to: "/admin", replace: true });
  }, [onAdmin, navigate]);
  return (
    <div className="min-h-screen w-full bg-background">
      <SessionTimeout />
      <AdminHeader />
      <main className="mx-auto max-w-6xl px-5 py-6 md:px-8">{onAdmin ? <Outlet /> : null}</main>
    </div>
  );
}

export const ADMIN_WS_KEY = "menuwise:admin-acting-ws";

function AdminActingBar({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-border bg-warning-soft px-4 py-2 text-sm font-semibold text-warning">
      <span>Working in this café as MenuWise Admin · full owner controls · every change is logged</span>
      <button type="button" onClick={() => { sessionStorage.removeItem(ADMIN_WS_KEY); resetStore(); window.location.href = `/admin/${workspaceId}`; }} className="rounded-md bg-primary px-3 py-1 text-primary-foreground">Exit to Café Monitoring</button>
    </div>
  );
}

function CafeLayout({ adminWorkspace }: { adminWorkspace?: string }) {
  const { user } = Route.useRouteContext();
  const db = useDB();
  const perm = usePermissions();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const ownerOnly = path === "/menu/new" || path === "/ingredients/new";
  const cafe = (user.user_metadata?.cafe_name as string) || "My Café";
  const display = (user.user_metadata?.full_name as string) || (user.email ?? "").split("@")[0] || "Staff";
  useEffect(() => {
    void initStore(user.id, display, cafe, adminWorkspace ?? null);
  }, [user.id, display, cafe, adminWorkspace]);
  return (
    <div className="flex min-h-screen w-full bg-background">
      <SessionTimeout />
      <NavBar />
      <div className="min-w-0 flex-1 pb-24 md:pb-10">
        <AppHeader cafeName={cafe} />
        <main className="mx-auto max-w-6xl px-5 py-6 md:px-8">
          {adminWorkspace && <AdminActingBar workspaceId={adminWorkspace} />}
          {db.ready && !adminWorkspace && <AdminEditNotice />}
          {db.ready && ownerOnly && !(perm.isOwner || (path === "/ingredients/new" && perm.canInventory)) ? <p className="py-20 text-center text-muted-foreground">Only the café owner can add ingredients and menu items. You can log production, waste, and sales.</p> : db.ready ? <Outlet /> : <p className="py-20 text-center text-muted-foreground">Loading your café data…</p>}
        </main>
        <footer className="px-5 pb-4 text-center text-xs text-muted-foreground md:px-8">Need help or have concerns? Contact <a href="mailto:menuwise.contact@gmail.com" className="font-semibold text-accent">menuwise.contact@gmail.com</a></footer>
      </div>
    </div>
  );
}
