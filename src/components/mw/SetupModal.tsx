import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { currentUser, currentWorkspace, useDB, usePermissions } from "@/lib/store";
import { SetupWizard } from "./SetupWizard";

/** Opens the setup guide once for a new owner; "done" is saved on the account so it never returns on any device. */
export function SetupModal() {
  const db = useDB();
  const { isOwner } = usePermissions();
  const [open, setOpen] = useState(false);
  const ws = currentWorkspace();
  const uid = currentUser().id;
  const key = `menuwise:setup-modal-seen:${uid}:${ws}`;
  const empty = db.ingredients.length === 0 && db.menuItems.length === 0 && db.sales.length === 0;

  useEffect(() => {
    if (!db.ready || !isOwner || !ws || !uid) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const meta = data.session?.user.user_metadata ?? {};
      const local = localStorage.getItem(key) === "1";
      if (meta["setup_completed_at"]) return;
      // Finished offline earlier: push the flag to the account now.
      if (local || !empty) { if (navigator.onLine) void markDone(); return; }
      const { data: w } = navigator.onLine ? await supabase.from("workspaces").select("name").eq("id", ws).maybeSingle() : { data: null };
      if (w?.name && w.name !== "My Café") { void markDone(); return; }
      if (!cancelled) setOpen(true);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.ready, isOwner, ws, uid, empty, key]);

  async function markDone() {
    localStorage.setItem(key, "1");
    if (!navigator.onLine) return;
    await supabase.auth.updateUser({ data: { setup_completed_at: new Date().toISOString() } });
  }
  function change(o: boolean) {
    setOpen(o);
    if (!o) void markDone();
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Welcome to MenuWise</DialogTitle>
          <DialogDescription>Name your café, invite your team and add your data. You can reopen this guide anytime from Profile.</DialogDescription>
        </DialogHeader>
        <SetupWizard alwaysShow onProgress={() => void markDone()} />
      </DialogContent>
    </Dialog>
  );
}
