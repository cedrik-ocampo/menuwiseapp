import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { useSignOut } from "./UserMenu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary, btnSecondary } from "./ui";

const IDLE_MS = 30 * 60 * 1000;
const WARNING_MS = 60 * 1000;

export function SessionTimeout() {
  const signOut = useSignOut();
  const [warning, setWarning] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let warningTimer: ReturnType<typeof setTimeout>;
    let logoutTimer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      warningTimer = setTimeout(() => setWarning(true), IDLE_MS - WARNING_MS);
      logoutTimer = setTimeout(() => void signOut(), IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(warningTimer);
      clearTimeout(logoutTimer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [signOut, generation]);

  return (
    <Dialog open={warning} onOpenChange={() => undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5" /> Session ending soon</DialogTitle>
          <DialogDescription>You’ll be signed out after 30 minutes of inactivity. Unsynced records stay on this device.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3">
          <button type="button" className={`${btnPrimary} flex-1`} onClick={() => setGeneration((value) => value + 1)}>Stay signed in</button>
          <button type="button" className={`${btnSecondary} flex-1`} onClick={() => void signOut()}>Sign out</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}