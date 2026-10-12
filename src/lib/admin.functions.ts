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
