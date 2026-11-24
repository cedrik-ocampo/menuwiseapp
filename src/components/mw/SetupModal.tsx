import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { currentUser, currentWorkspace, useDB, usePermissions } from "@/lib/store";
import { SetupWizard } from "./SetupWizard";

/** Opens the setup guide automatically the first time an owner signs in to a café with no data. */
export function SetupModal() {
  const db = useDB();
  const { isOwner } = usePermissions();
  const [open, setOpen] = useState(false);
  const ws = currentWorkspace();
  const uid = currentUser().id;
  const key = `menuwise:setup-modal-seen:${uid}:${ws}`;
  const empty = db.ingredients.length === 0 && db.menuItems.length === 0 && db.sales.length === 0;
  useEffect(() => {
    if (!db.ready || !isOwner || !ws || !uid || !empty) return;
    if (localStorage.getItem(key) === "1") return;
    setOpen(true);
  }, [db.ready, isOwner, ws, uid, empty, key]);
  function change(o: boolean) {
    setOpen(o);
    if (!o) localStorage.setItem(key, "1");
  }
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Welcome to MenuWise</DialogTitle>
          <DialogDescription>Name your café, invite your team and add your data. You can reopen this guide anytime from Profile.</DialogDescription>
        </DialogHeader>
        <SetupWizard alwaysShow />
      </DialogContent>
    </Dialog>
  );
}
