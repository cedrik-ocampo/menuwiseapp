import { useEffect, useState } from "react";
import { Trash2, ChefHat, Users, Clock3, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { currentUser, put } from "@/lib/store";
import { formatPeso, fmtQty, shortDate, uid } from "@/lib/format";
import type { Ingredient, Purchase, WasteLog, WasteType } from "@/lib/types";

type Outcome = "waste" | "used" | "staff" | "keep";
const OUTCOMES: { key: Outcome; title: string; desc: string; icon: typeof Trash2 }[] = [
  { key: "waste", title: "Thrown away", desc: "Log it as waste and remove from stock", icon: Trash2 },
  { key: "used", title: "Used up", desc: "Went into drinks or prep — clear stock", icon: ChefHat },
  { key: "staff", title: "Given away", desc: "Given to staff / donated — clear stock", icon: Users },
  { key: "keep", title: "Still usable", desc: "Keep it and remind me tomorrow", icon: Clock3 },
];
const REASONS: WasteType[] = ["Expiry", "Spoilage"];

export function IngredientResolveDialog({ open, onOpenChange, ingredient, lot, insightId, label }: {
  open: boolean; onOpenChange: (o: boolean) => void; ingredient: Ingredient; lot: Purchase; insightId: string; label: string;
}) {
  const left = lot.remaining;
  const [step, setStep] = useState<"choose" | "waste" | "confirm">("choose");
  const [qty, setQty] = useState(String(left));
  const [reason, setReason] = useState<WasteType>("Expiry");
  useEffect(() => { if (open) { setStep("choose"); setQty(String(left)); setReason("Expiry"); } }, [open, left]);

  const q = Number(qty);
  const qtyError = !Number.isFinite(q) || q <= 0 ? "Enter how much was thrown away" : q > left ? `Only ${fmtQty(left)} ${ingredient.unit} left in this lot` : "";
  const unitCost = lot.unitCost || ingredient.unitCost;
  const value = +(q * unitCost).toFixed(2);

  function respond(text: string, status: "accepted" | "snoozed" = "accepted", until?: string) {
    put("insightResponses", { id: insightId, status, until, at: new Date().toISOString(), byName: currentUser().name, label: `${label} — ${text}` });
    onOpenChange(false);
  }
  function run(fn: () => void) {
    try { fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't save"); }
  }
  function choose(o: Outcome) {
    if (o === "waste") return setStep("waste");
    run(() => {
      if (o === "keep") { respond("still usable", "snoozed", new Date(Date.now() + 24 * 3600_000).toISOString()); toast.message("We'll remind you again in 24 hours"); return; }
      put("purchases", { ...lot, remaining: 0 });
      respond(o === "used" ? "used up" : "given away");
      toast.success(`${ingredient.name} lot cleared — no waste logged`);
    });
  }
  function saveWaste() {
    run(() => {
      const log: WasteLog = {
        id: uid("W-"), at: new Date().toISOString(), stage: "Ingredient", ingredientId: ingredient.id,
        wasteType: reason, quantity: q, unit: ingredient.unit, unitCost, value, allocation: "Direct",
      };
      put("wasteLogs", log);
      put("purchases", { ...lot, remaining: +Math.max(0, left - q).toFixed(3) });
      respond(`${fmtQty(q)} ${ingredient.unit} logged as waste`);
      toast.success(`Waste logged: ${fmtQty(q)} ${ingredient.unit} · ${formatPeso(value)}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === "confirm" ? "Double-check before saving" : `What happened to ${ingredient.name}?`}</DialogTitle>
          <DialogDescription>Expiry {shortDate(lot.expiryDate)} · {fmtQty(left)} {ingredient.unit} still recorded in this lot</DialogDescription>
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
            <label className="block text-sm font-semibold text-primary">How much {ingredient.unit} was thrown away?
              <input type="number" min={0} max={left} step="any" value={qty} onChange={(e) => setQty(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-base font-normal" />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Measure what's actually discarded. Anything left stays in stock.</span>
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
              {[["Ingredient", ingredient.name], ["Stage", "Ingredient"], ["Reason", reason], ["Quantity", `${fmtQty(q)} ${ingredient.unit}`],
                ["Cost per unit", formatPeso(unitCost)], ["Waste value", formatPeso(value)], ["Left in stock after", `${fmtQty(Math.max(0, left - q))} ${ingredient.unit}`]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-3 py-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold text-primary">{v}</dd></div>
              ))}
            </dl>
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
