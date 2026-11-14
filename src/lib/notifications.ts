import type { ChangeLog } from "./types";

export interface AdminNotice { key: string; at: string; text: string; note?: string; collection: string; recordId?: string; count: number }

const LABEL: Record<string, string> = { menuItems: "menu item", ingredients: "ingredient", sales: "sale", batches: "production batch", wasteLogs: "waste log", purchases: "delivery", usages: "stock adjustment" };
const plural = (c: string, n: number) => `${n} ${LABEL[c] ?? "record"}${n === 1 ? "" : "s"}`;

/** Admin activity grouped so one import (same timestamp, collection, action) is one notice. */
export function adminNotices(logs: ChangeLog[]): AdminNotice[] {
  const groups = new Map<string, ChangeLog[]>();
  for (const l of logs) {
    if (!l.adminEdit) continue;
    const k = `${l.at}|${l.collection}|${l.action}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(l);
  }
  return [...groups.entries()].map(([key, g]) => {
    const l = g[0];
    let text: string;
    if (l.action === "viewed") text = "MenuWise Admin viewed your café's privacy-safe summary";
    else if (g.length > 1) text = `MenuWise Admin ${l.action === "created" ? "added" : l.action} ${plural(l.collection, g.length)}`;
    else {
      const name = l.changes.find((c) => c.field === "name")?.to;
      const detail = l.action === "edited" ? l.changes.filter((c) => c.from !== null).map((c) => `${c.field} ${String(c.from)} → ${String(c.to)}`).join(", ") : "";
      text = `MenuWise Admin ${l.action === "created" ? "added" : l.action} ${LABEL[l.collection] ?? "record"}${name ? ` “${String(name)}”` : ""}${detail ? `: ${detail}` : ""}`;
    }
    return { key, at: l.at, text, note: l.note, collection: l.collection, recordId: g.length === 1 ? l.recordId : undefined, count: g.length };
  }).sort((a, b) => b.at.localeCompare(a.at));
}

export const unreadCount = (n: AdminNotice[], lastSeen: string | null) => n.filter((x) => !lastSeen || x.at > lastSeen).length;
