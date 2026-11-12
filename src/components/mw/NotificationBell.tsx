import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useDB, currentUser, currentWorkspace } from "@/lib/store";
import { adminNotices, unreadCount } from "@/lib/notifications";
import { shortDate } from "@/lib/format";

export function NotificationBell() {
  const db = useDB();
  const key = `menuwise:notices-seen:${currentUser().id}:${currentWorkspace()}`;
  const [seen, setSeen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setSeen(localStorage.getItem(key)); }, [key]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const notices = useMemo(() => adminNotices(db.changeLogs), [db.changeLogs]);
  const unread = unreadCount(notices, seen);
  const markAll = () => { const t = new Date().toISOString(); localStorage.setItem(key, t); setSeen(t); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => setOpen((o) => !o)} className="relative rounded-full p-2 hover:bg-header-foreground/10">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-[18px] text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <p className="text-sm font-semibold">MenuWise Admin activity</p>
            {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold text-primary hover:underline">Mark all as read</button>}
          </div>
          {notices.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No admin activity yet.</p> : (
            <ul className="max-h-96 divide-y divide-border overflow-y-auto">
              {notices.slice(0, 50).map((n) => {
                const isNew = !seen || n.at > seen;
                const body = <>
                  <p className={`text-sm ${isNew ? "font-semibold" : ""}`}>{n.text}</p>
                  {n.note && <p className="text-xs italic text-muted-foreground">“{n.note}”</p>}
                  <p className="text-xs text-muted-foreground">{shortDate(n.at)} · {new Date(n.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>
                </>;
                return (
                  <li key={n.key} className={`px-4 py-2 ${isNew ? "bg-accent/40" : ""}`}>
                    {n.recordId && n.collection === "menuItems" ? <Link to="/menu/$id" params={{ id: n.recordId }} onClick={() => setOpen(false)} className="block">{body}</Link>
                      : n.recordId && n.collection === "ingredients" ? <Link to="/ingredients/$id" params={{ id: n.recordId }} onClick={() => setOpen(false)} className="block">{body}</Link>
                      : body}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
