import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeCafe, type CafeRecordInput } from "./admin-privacy";
import type { ChangeLog } from "./types";

/** Read-only MenuWise admin monitoring. All reads go through RLS as the caller; admin-only SELECT policies grant cross-café visibility. */
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) {
    console.error("Admin role check failed", userId, error?.message ?? "role not granted");
    throw new Error("Forbidden");
  }
}

export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    console.log("Admin role check", context.userId, !!data);
    return { admin: !!data };
  });

/** Page through results; the database returns at most 1,000 rows per request. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<{ data: T[] }> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error("Could not load café records");
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) return { data: out };
  }
}

export const listCafes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Only the verified server may read raw rows; the browser receives counts.
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const [{ data: ws }, { data: members }, { data: invites }, { data: recs }] = await Promise.all([
      sb.from("workspaces").select("id,name,owner_id,created_at").order("created_at"),
      sb.from("workspace_members").select("workspace_id,role,email,display_name"),
      sb.from("workspace_invites").select("workspace_id,email,role"),
      fetchAll<{ workspace_id: string; collection: string; updated_at: string }>((a, b) => sb.from("records").select("workspace_id,collection,updated_at").eq("deleted", false).order("workspace_id").order("collection").order("id").range(a, b)),
    ]);
    return (ws ?? []).map((w) => {
      const m = (members ?? []).filter((x) => x.workspace_id === w.id);
      const r = (recs ?? []).filter((x) => x.workspace_id === w.id);
      const count = (c: string) => r.filter((x) => x.collection === c).length;
      const owner = m.find((x) => x.role === "owner");
      return {
        id: w.id, name: w.name, createdAt: w.created_at,
        owner: owner?.display_name || owner?.email || "—", ownerEmail: owner?.email ?? "",
        members: m.length, accounts: m.map((x) => ({ name: x.display_name || (x.email ?? "").split("@")[0] || "—", email: x.email ?? "", role: x.role as string })), pendingInvites: (invites ?? []).filter((x) => x.workspace_id === w.id).length, pendingOwner: (invites ?? []).find((x) => x.workspace_id === w.id && x.role === "owner")?.email ?? null,
        lastActivity: r.map((x) => x.updated_at).sort().pop() ?? null,
        counts: { menuItems: count("menuItems"), ingredients: count("ingredients"), sales: count("sales"), batches: count("batches"), wasteLogs: count("wasteLogs") },
      };
    });
  });

export const getCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Raw records are aggregated here and never cross the server boundary.
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const [{ data: ws }, { data: members }, { data: invites }, { data: recs }] = await Promise.all([
      sb.from("workspaces").select("id,name,created_at").eq("id", data.id).maybeSingle(),
      sb.from("workspace_members").select("user_id,role,email,display_name,joined_at,inventory_access").eq("workspace_id", data.id),
      sb.from("workspace_invites").select("id,email,created_at").eq("workspace_id", data.id),
      fetchAll<{ collection: string; data: unknown }>((a, b) => sb.from("records").select("id,collection,data").eq("workspace_id", data.id).eq("deleted", false).in("collection", ["ingredients", "menuItems", "sales", "batches", "wasteLogs"]).order("collection").order("id").range(a, b)),
    ]);
    if (!ws) throw new Error("Café not found");
    // Café-visible notice that an admin viewed its records (one per day).
    const now = new Date().toISOString(); const viewId = `view-${data.id}-${now.slice(0, 10)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("records").upsert({ id: viewId, collection: "changeLogs", user_id: context.userId, workspace_id: data.id, updated_at: now, deleted: false,
      data: { id: viewId, collection: "workspace", recordId: data.id, action: "viewed", at: now, by: context.userId, byName: "MenuWise Admin", changes: [], adminEdit: true } as never }, { onConflict: "workspace_id,collection,id" });
    const collection = <K extends keyof CafeRecordInput>(name: K) =>
      (recs ?? []).filter((r) => r.collection === name).map((r) => r.data) as NonNullable<CafeRecordInput[K]>;
    const summary = summarizeCafe({
      ingredients: collection("ingredients"),
      menuItems: collection("menuItems"),
      sales: collection("sales"),
      batches: collection("batches"),
      wasteLogs: collection("wasteLogs"),
    }, new Date().toISOString().slice(0, 10));
    return { cafe: ws, members: members ?? [], invites: invites ?? [], summary };
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
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin: sb } = await import("@/integrations/supabase/client.server");
    const [{ data: logs }, { data: ws }] = await Promise.all([
      sb.from("records").select("workspace_id,data").eq("collection", "changeLogs").eq("data->>adminEdit", "true").eq("data->>by", context.userId).neq("data->>action", "viewed").order("updated_at", { ascending: false }).limit(1000),
      sb.from("workspaces").select("id,name"),
    ]);
    const names = new Map((ws ?? []).map((w) => [w.id, w.name]));
    return JSON.stringify((logs ?? []).map((l) => {
      const log = l.data as unknown as ChangeLog;
      return {
        cafeId: l.workspace_id,
        cafe: names.get(l.workspace_id) ?? "—",
        id: log.id,
        collection: log.collection,
        recordId: log.recordId,
        action: log.action,
        at: log.at,
        note: log.note,
        // Admin logs identify fields, never reveal old/new confidential values.
        changes: (log.changes ?? []).map((change) => ({ field: change.field })),
      };
    }));
  });

export const listBugReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [{ data: reps }, { data: ws }] = await Promise.all([
      context.supabase.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(500),
      context.supabase.from("workspaces").select("id,name"),
    ]);
    const names = new Map((ws ?? []).map((w) => [w.id, w.name]));
    return (reps ?? []).map((r) => ({ ...r, cafe: r.workspace_id ? names.get(r.workspace_id) ?? "—" : "—" }));
  });

export const setBugStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("bug_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin setup: verifies the admin role, then adds or updates menu items in a café with café-visible admin change logs. */
export const adminSaveMenuItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      workspaceId: z.string().uuid(),
      items: z.array(z.object({ id: z.string().min(1).max(200), name: z.string().trim().min(1).max(120) }).passthrough()).min(1).max(500),
      note: z.string().trim().max(300).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ws } = await supabaseAdmin.from("workspaces").select("id").eq("id", data.workspaceId).maybeSingle();
    if (!ws) throw new Error("Café not found");
    const ids = data.items.map((i) => i.id);
    const { data: existing } = await supabaseAdmin.from("records").select("id").eq("workspace_id", data.workspaceId).eq("collection", "menuItems").in("id", ids);
    const known = new Set((existing ?? []).map((r) => r.id));
    const now = new Date().toISOString();
    const stamp = { updatedBy: context.userId, updatedByName: "MenuWise Admin", updatedAt: now };
    const rows = data.items.map((item) => ({
      id: item.id, collection: "menuItems", user_id: context.userId, workspace_id: data.workspaceId, deleted: false, updated_at: now,
      data: { ...item, ...stamp, ...(known.has(item.id) ? {} : { createdBy: context.userId, createdByName: "MenuWise Admin", createdAt: now }) } as never,
    }));
    const { error } = await supabaseAdmin.from("records").upsert(rows, { onConflict: "workspace_id,collection,id" });
    if (error) throw new Error("Could not save menu items");
    const logs = data.items.map((item, i) => {
      const id = `menuItems-${item.id}-${Date.now()}-${i}-admin`;
      return { id, collection: "changeLogs", user_id: context.userId, workspace_id: data.workspaceId, updated_at: now,
        data: { id, collection: "menuItems", recordId: item.id, action: known.has(item.id) ? "edited" : "created", at: now, by: context.userId, byName: "MenuWise Admin", changes: [{ field: "name", from: null, to: item.name }], adminEdit: true, note: data.note || undefined } as never };
    });
    const { error: e2 } = await supabaseAdmin.from("records").insert(logs);
    if (e2) throw new Error("Saved, but the change log failed");
    return { added: data.items.length - known.size, updated: known.size };
  });

/** Admin pre-setup: creates a café that the given email claims as Owner when they sign up. */
export const adminPresetCafe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(120), ownerEmail: z.string().trim().toLowerCase().email().max(255) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin.from("workspace_members").select("workspace_id").ilike("email", data.ownerEmail).limit(1);
    if (taken?.length) throw new Error("This email already belongs to a café account");
    const { data: pending } = await supabaseAdmin.from("workspace_invites").select("id").ilike("email", data.ownerEmail).eq("role", "owner").limit(1);
    if (pending?.length) throw new Error("A café is already waiting for this email");
    const { data: ws, error } = await supabaseAdmin.from("workspaces").insert({ name: data.name, owner_id: context.userId }).select("id").single();
    if (error || !ws) throw new Error("Could not create café");
    const { error: e2 } = await supabaseAdmin.from("workspace_invites").insert({ workspace_id: ws.id, email: data.ownerEmail, invited_by: context.userId, role: "owner" });
    if (e2) throw new Error("Café created, but the owner invite failed");
    return { id: ws.id };
  });
