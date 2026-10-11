import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initStore, useDB } from "@/lib/store";
import { AppHeader, NavBar } from "@/components/mw/AppShell";
import { SessionTimeout } from "@/components/mw/SessionTimeout";

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
  const { user } = Route.useRouteContext();
  const db = useDB();
  const cafe = (user.user_metadata?.cafe_name as string) || "My Café";
  const display = (user.user_metadata?.full_name as string) || (user.email ?? "").split("@")[0] || "Staff";
  useEffect(() => {
    void initStore(user.id, display, cafe);
  }, [user.id, display, cafe]);
  return (
    <div className="flex min-h-screen w-full bg-background">
      <SessionTimeout />
      <NavBar />
      <div className="min-w-0 flex-1 pb-24 md:pb-10">
        <AppHeader cafeName={cafe} />
        <main className="mx-auto max-w-6xl px-5 py-6 md:px-8">
          {db.ready ? <Outlet /> : <p className="py-20 text-center text-muted-foreground">Loading your café data…</p>}
        </main>
      </div>
    </div>
  );
}
