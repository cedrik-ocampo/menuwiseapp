import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WorkspaceInput = z.object({ workspaceId: z.string().uuid() });
const InviteInput = WorkspaceInput.extend({ email: z.string().trim().email().max(255) });
const CancelInput = WorkspaceInput.extend({ inviteId: z.string().uuid() });

async function requireOwner(context: { supabase: any; userId: string }, workspaceId: string) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (isAdmin) return;
  const { data, error } = await context.supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error || data?.role !== "owner") throw new Error("Only the café owner can manage invitations");
}

export const createWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => InviteInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.workspaceId);
    const email = data.email.toLowerCase();
    const { data: existing } = await context.supabase
      .from("workspace_invites")
      .select("id")
      .eq("workspace_id", data.workspaceId)
      .ilike("email", email)
      .maybeSingle();
    if (existing) throw new Error("This email already has a pending invitation");
    const { data: invite, error } = await context.supabase
      .from("workspace_invites")
      .insert({ workspace_id: data.workspaceId, email })
      .select("id,email,invited_by,created_at")
      .single();
    if (error || !invite) throw new Error("Couldn't create the invitation");
    return { invite, emailSent: false as const, reason: "email_domain_required" as const };
  });

export const cancelWorkspaceInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CancelInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireOwner(context, data.workspaceId);
    const { error } = await context.supabase
      .from("workspace_invites")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("id", data.inviteId);
    if (error) throw new Error("Couldn't cancel the invitation");
    return { ok: true };
  });