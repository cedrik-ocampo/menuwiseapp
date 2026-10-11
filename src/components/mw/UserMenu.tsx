import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CircleHelp, History, LogOut, User } from "lucide-react";
import { clear as idbClear } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { resetStore } from "@/lib/store";
import { applyTheme } from "@/lib/prefs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface Me { name: string; email: string; avatar?: string }

export function initials(name: string) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

export function useMe(): [Me, () => void] {
  const [me, setMe] = useState<Me>({ name: "", email: "" });
  const load = () => {
    void supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      setMe({
        name: (u.user_metadata?.full_name as string) || (u.email ?? "").split("@")[0] || "Staff",
        email: u.email ?? "",
        avatar: u.user_metadata?.avatar_url as string | undefined,
      });
    });
  };
  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange(() => load());
    return () => data.subscription.unsubscribe();
  }, []);
  return [me, load];
}

export function Avatar({ me, size = 36 }: { me: Me; size?: number }) {
  return me.avatar ? (
    <img src={me.avatar} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />
  ) : (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }} className="flex items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">
      {initials(me.name)}
    </span>
  );
}

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async (opts?: { clearCache?: boolean }) => {
    await qc.cancelQueries();
    qc.clear();
    resetStore();
    if (opts?.clearCache) await idbClear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };
}

export function UserMenu() {
  const [me] = useMe();
  const navigate = useNavigate();
  const signOut = useSignOut();
  useEffect(() => {
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);
    return () => mq.removeEventListener("change", applyTheme);
  }, []);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label="Account menu" className="flex items-center gap-2 rounded-full p-0.5 focus-visible:outline-2 focus-visible:outline-ring">
        <Avatar me={me} />
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{me.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-screen max-w-none rounded-none border-x-0 sm:w-64 sm:rounded-md sm:border-x"
      >
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-bold text-foreground">{me.name}</p>
          <p className="truncate text-xs text-muted-foreground">{me.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-2" onSelect={() => navigate({ to: "/profile" })}>
          <User className="h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-2" onSelect={() => navigate({ to: "/whats-new" })}>
          <History className="h-4 w-4" /> What’s New
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-2" onSelect={() => navigate({ to: "/help" })}>
          <CircleHelp className="h-4 w-4" /> Help & Contact
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-2" onSelect={() => void signOut()}>
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
