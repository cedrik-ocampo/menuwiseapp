import { useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

/** Per-staff switch that lets a barista manage ingredients and stock. Owner or MenuWise admin only. */
export function InventoryAccessToggle({ workspaceId, userId, name, initial, onChanged }: { workspaceId: string; userId: string; name: string; initial: boolean; onChanged?: () => void }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function change(next: boolean) {
    if (!navigator.onLine) return void toast.error("Connect to the internet to change permissions");
    setBusy(true); setOn(next);
    const { error } = await supabase.rpc("set_member_inventory_access", { _ws: workspaceId, _user: userId, _on: next });
    setBusy(false);
    if (error) { setOn(!next); return void toast.error("Couldn't change inventory access"); }
    toast.success(next ? `${name} can now manage inventory` : `${name} no longer manages inventory`);
    onChanged?.();
  }
  return (
    <label className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
      <Package className="h-3.5 w-3.5" /> Inventory access
      <Switch checked={on} disabled={busy} onCheckedChange={(v) => void change(v)} aria-label={`Inventory access for ${name}`} />
    </label>
  );
}
