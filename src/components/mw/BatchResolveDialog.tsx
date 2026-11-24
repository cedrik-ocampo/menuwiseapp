import { useEffect, useState } from "react";
import { Trash2, ShoppingBag, Users, Clock3, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { currentUser, put } from "@/lib/store";
import { costPerUnit } from "@/lib/calc";
import { formatPeso, fmtQty, shortDate, uid } from "@/lib/format";
import type { Batch, MenuItem, WasteLog, WasteType } from "@/lib/types";

type Outcome = "waste" | "sold" | "staff" | "display";
const OUTCOMES: { key: Outcome; title: string; desc: string; icon: typeof Trash2 }[] = [
  { key: "waste", title: "Thrown away", desc: "Log the pieces as waste", icon: Trash2 },
  { key: "sold", title: "All sold", desc: "Nothing left to waste", icon: ShoppingBag },
  { key: "staff", title: "Given to staff / used", desc: "Not counted as waste", icon: Users },
  { key: "display", title: "Still on display", desc: "Keep reminding me tomorrow", icon: Clock3 },
];
const REASONS: WasteType[] = ["Expiry", "Unsold", "Day-old", "Spoilage"];

export function BatchResolveDialog({ open, onOpenChange, batch, item, left, insightId, label }: {
  open: boolean; onOpenChange: (o: boolean) => void; batch: Batch; item: MenuItem; left: number; insightId: string; label: string;
}) {
  const [step, setStep] = useState<"choose" | "waste" | "confirm">("choose");
  const [qty, setQty] = useState(String(left));
  const [reason, setReason] = useState<WasteType>("Expiry");
  useEffect(() => { if (open) { setStep("choose"); setQty(String(left)); setReason("Expiry"); } }, [open, left]);

  const q = Number(qty);
  const qtyError = !Number.isFinite(q) || q <= 0 ? "Enter how many pieces were thrown away" : q > left ? `Only ${fmtQty(left)} ${item.batchUnit} are left in this batch` : "";
  const unitCost = +costPerUnit(item).toFixed(2);
  const value = +(q * unitCost).toFixed(2);

  function close(outcomeText: string, status: "accepted" | "snoozed" = "accepted", until?: string) {
    put("insightResponses", { id: insightId, status, until, at: new Date().toISOString(), byName: currentUser().name, label: `${label} — ${outcomeText}` });
    onOpenChange(false);
  }
  function choose(o: Outcome) {
    if (o === "waste") return setStep("waste");
    if (o === "display") { close("still on display", "snoozed", new Date(Date.now() + 24 * 3600_000).toISOString()); return toast.message("We'll remind you again in 24 hours"); }
    close(o === "sold" ? "all sold" : "given to staff / used");
    toast.success("Marked as handled — no waste logged");
  }
  function saveWaste() {
    const log: WasteLog = {
      id: uid("W-"), at: new Date().toISOString(), stage: "Finished Product", menuItemId: item.id, batchId: batch.id,
      wasteType: reason, quantity: q, unit: item.batchUnit, unitCost, value, allocation: "Batch-linked", retailValue: q * item.retailPrice,
    };
    put("wasteLogs", log);
    close(`${fmtQty(q)} ${item.batchUnit} logged as waste`);
    toast.success(`Waste logged: ${fmtQty(q)} ${item.batchUnit} · ${formatPeso(value)}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "confirm" ? "Double-check before saving" : `What happened to ${item.name}?`}</DialogTitle>
          <DialogDescription>Batch {batch.id} · expiry {shortDate(batch.expiryDate)} · up to {fmtQty(left)} {item.batchUnit} left</DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map(({ key, title, desc, icon: Icon }) => (
              <button key={key} type="button" onClick={() => choose(key)}
                className="flex flex-col items-start gap-1 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-accent hover:bg-secondary">
                <Icon className={`h-5 w-5 ${key === "waste" ? "text-destructive" : "text-accent"}`} />
                <span className="text-sm font-semibold text-primary">{title}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
        )}

        {step === "waste" && (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-primary">How many {item.batchUnit} were thrown away?
              <input type="number" min={0} max={left} step="any" value={qty} onChange={(e) => setQty(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-base font-normal" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Count what's actually in the bin — not what's recorded. Some may have sold.</span>
              {qtyError && qty !== "" && <span className="mt-1 block text-xs font-normal text-destructive">{qtyError}</span>}
            </label>
            <div>
              <p className="mb-1 text-sm font-semibold text-primary">Reason</p>
              <div className="flex flex-wrap gap-2">
                {REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${reason === r ? "border-accent bg-accent text-accent-foreground" : "border-border text-primary hover:bg-secondary"}`}>{r}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("choose")}><ArrowLeft /> Back</Button>
              <Button disabled={!!qtyError} onClick={() => setStep("confirm")}>Review</Button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <dl className="divide-y divide-border rounded-xl border border-border text-sm">
              {[
                ["Item", item.name], ["Batch", batch.id], ["Stage", "Finished Product"], ["Reason", reason],
                ["Quantity", `${fmtQty(q)} ${item.batchUnit}`], ["Cost per piece", formatPeso(unitCost)], ["Waste value", formatPeso(value)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold text-primary">{v}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">This adds a waste log under your name. You can edit or delete it later on Log Waste.</p>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setStep("waste")}><ArrowLeft /> Edit</Button>
              <Button variant="destructive" onClick={saveWaste}><Trash2 /> Confirm & log waste</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
