import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Read-only MenuWise admin monitoring. All reads go through RLS as the caller; admin-only SELECT policies grant cross-café visibility. */
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!data };
  });

export const listCafes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const [{ data: ws }, { data: members }, { data: invites }, { data: recs }] = await Promise.all([
      sb.from("workspaces").select("id,name,owner_id,created_at").order("created_at"),
      sb.from("workspace_members").select("workspace_id,role,email,display_name"),
      sb.from("workspace_invites").select("workspace_id"),
      sb.from("records").select("workspace_id,collection,updated_at").eq("deleted", false).limit(50000),
    ]);
    return (ws ?? []).map((w) => {
      const m = (members ?? []).filter((x) => x.workspace_id === w.id);
      const r = (recs ?? []).filter((x) => x.workspace_id === w.id);
      const count = (c: string) => r.filter((x) => x.collection === c).length;
      const owner = m.find((x) => x.role === "owner");
      return {
        id: w.id, name: w.name, createdAt: w.created_at,
        owner: owner?.display_name || owner?.email || "—", ownerEmail: owner?.email ?? "",
        members: m.length, pendingInvites: (invites ?? []).filter((x) => x.workspace_id === w.id).length,
        lastActivity: r.map((x) => x.updated_at).sort().pop() ?? null,
        counts: { menuItems: count("menuItems"), ingredients: count("ingredients"), sales: count("sales"), batches: count("batches"), wasteLogs: count("wasteLogs") },
      };
    });
  });

export const getCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const [{ data: ws }, { data: members }, { data: invites }, { data: recs }] = await Promise.all([
      sb.from("workspaces").select("id,name,created_at").eq("id", data.id).maybeSingle(),
      sb.from("workspace_members").select("user_id,role,email,display_name,joined_at").eq("workspace_id", data.id),
      sb.from("workspace_invites").select("id,email,created_at").eq("workspace_id", data.id),
      sb.from("records").select("id,collection,data,updated_at").eq("workspace_id", data.id).eq("deleted", false).limit(20000),
    ]);
    if (!ws) throw new Error("Café not found");
    return { cafe: ws, members: members ?? [], invites: invites ?? [], recordsJson: JSON.stringify((recs ?? []).map((r) => ({ collection: r.collection, data: r.data }))) };
  });

const EDITABLE = {
  menuItems: ["name", "category", "retailPrice", "available"],
  ingredients: ["name", "category", "unit", "unitCost"],
} as const;

/** Admin edit: verifies the admin role, updates one café record and appends a café-visible change log. */
export const adminUpdateRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      workspaceId: z.string().uuid(),
      collection: z.enum(["menuItems", "ingredients"]),
      id: z.string().min(1).max(200),
      patch: z.object({
        name: z.string().trim().min(1).max(120).optional(),
        category: z.string().trim().max(80).optional(),
        unit: z.string().trim().min(1).max(20).optional(),
        unitCost: z.number().min(0).max(1_000_000).optional(),
        retailPrice: z.number().min(0).max(1_000_000).optional(),
        available: z.boolean().optional(),
      }),
      note: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("records").select("data")
      .eq("workspace_id", data.workspaceId).eq("collection", data.collection).eq("id", data.id).eq("deleted", false).maybeSingle();
    if (error || !row) throw new Error("Record not found");
    const prev = row.data as Record<string, unknown>;
    const allowed = EDITABLE[data.collection] as readonly string[];
    const changes: { field: string; from: unknown; to: unknown }[] = [];
    const next: Record<string, unknown> = { ...prev };
    for (const [k, v] of Object.entries(data.patch)) {
      if (v === undefined || !allowed.includes(k)) continue;
      if (JSON.stringify(prev[k]) !== JSON.stringify(v)) { changes.push({ field: k, from: prev[k], to: v }); next[k] = v; }
    }
    if (!changes.length) return { changed: 0 };
    const now = new Date().toISOString();
    Object.assign(next, { updatedBy: context.userId, updatedByName: "MenuWise Admin", updatedAt: now });
    const { error: e1 } = await supabaseAdmin.from("records").update({ data: next as never, updated_at: now })
      .eq("workspace_id", data.workspaceId).eq("collection", data.collection).eq("id", data.id);
    if (e1) throw new Error("Could not save");
    const logId = `${data.collection}-${data.id}-${Date.now()}-admin`;
    const log = { id: logId, collection: data.collection, recordId: data.id, action: "edited", at: now, by: context.userId, byName: "MenuWise Admin", changes, adminEdit: true, note: data.note || undefined };
    const { error: e2 } = await supabaseAdmin.from("records").insert({ id: logId, collection: "changeLogs", user_id: context.userId, workspace_id: data.workspaceId, data: log as never, updated_at: now });
    if (e2) throw new Error("Saved, but the change log failed");
    return { changed: changes.length };
  });

/** The admin's personal edit history across every café. */
export const listAdminEdits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    await assertAdmin(sb, context.userId);
    const [{ data: logs }, { data: ws }] = await Promise.all([
      sb.from("records").select("workspace_id,data").eq("collection", "changeLogs").eq("data->>adminEdit", "true").eq("data->>by", context.userId).order("updated_at", { ascending: false }).limit(1000),
      sb.from("workspaces").select("id,name"),
    ]);
    const names = new Map((ws ?? []).map((w) => [w.id, w.name]));
    return JSON.stringify((logs ?? []).map((l) => ({ cafeId: l.workspace_id, cafe: names.get(l.workspace_id) ?? "—", ...(l.data as object) })));
  });
