import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({ workspaceId: z.string().uuid() });

async function membership(ctx: { supabase: any; userId: string }, ws: string) {
  const { data, error } = await ctx.supabase.from("workspace_members").select("user_id").eq("workspace_id", ws);
  if (error) throw new Error("Couldn't check your workspace");
  const ids = (data ?? []).map((m: { user_id: string }) => m.user_id);
  if (!ids.includes(ctx.userId)) throw new Error("You're not a member of this workspace");
  return ids as string[];
}

/** Replace the leaving user's name on every record with "Former member". */
async function anonymize(admin: any, ws: string, uid: string) {
  const { data } = await admin.from("records").select("id,collection,data").eq("workspace_id", ws);
  for (const r of data ?? []) {
    const d = { ...(r.data as Record<string, unknown>) };
    let changed = false;
    if (d.createdBy === uid) { d.createdBy = null; d.createdByName = "Former member"; changed = true; }
    if (d.updatedBy === uid) { d.updatedBy = null; d.updatedByName = "Former member"; changed = true; }
    if (d.by === uid) { d.by = ""; d.byName = "Former member"; changed = true; }
    if (changed) await admin.from("records").update({ data: d }).eq("workspace_id", ws).eq("collection", r.collection).eq("id", r.id);
  }
}

export const leaveWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const ids = await membership(context, data.workspaceId);
    if (ids.length <= 1) throw new Error("You're the only member — you can't leave");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("workspace_members").delete().eq("workspace_id", data.workspaceId).eq("user_id", context.userId);
    return { ok: true };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const ids = await membership(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const ws = data.workspaceId;
    if (ids.length <= 1) {
      await admin.from("records").delete().eq("workspace_id", ws);
      await admin.from("workspace_invites").delete().eq("workspace_id", ws);
      await admin.from("workspace_members").delete().eq("workspace_id", ws);
      await admin.from("workspaces").delete().eq("id", ws);
    } else {
      await anonymize(admin, ws, context.userId);
      await admin.from("workspace_members").delete().eq("workspace_id", ws).eq("user_id", context.userId);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error("Couldn't delete the account. Please try again.");
    return { ok: true, sole: ids.length <= 1 };
  });
