import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { manilaToday } from "@/lib/admin-periods";
import { todayISO } from "@/lib/format";
import { currentUser, put, useDB, usePermissions } from "@/lib/store";
import type { DailyCheck } from "@/lib/types";
import { Field, Panel, SectionTitle, btnPrimary, inputCls } from "./ui";

/** Explicit daily confirmation used by admin logging-coverage aggregates. */
export function DailyCloseout() {
  const db = useDB();
  const permissions = usePermissions();
  const user = currentUser();
  const [date, setDate] = useState(todayISO());
  const id = `DC-${date}-${user.id ?? "unknown"}`;
  const existing = db.dailyChecks.find((check) => check.id === id);
  const [noWaste, setNoWaste] = useState(false);
  const [closeout, setCloseout] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setNoWaste(existing?.noWaste ?? false);
    setCloseout(existing?.closeout ?? false);
    setNotes(existing?.notes ?? "");
  }, [existing?.id, existing?.noWaste, existing?.closeout, existing?.notes]);
  const wasteCount = db.wasteLogs.filter((waste) => manilaToday(new Date(waste.at)) === date).length;
  const canEdit = !existing || permissions.canEdit("dailyChecks", existing.id);

  function save() {
    if (!noWaste && !closeout) return void toast.error("Select no waste, daily closeout, or both");
    if (noWaste && wasteCount > 0) return void toast.error("Waste is already logged for this date. Remove the no-waste confirmation.");
    if (!canEdit) return void toast.error("Employees can edit only their own latest daily check");
    setSaving(true);
    try {
      const record: DailyCheck = { id, date, noWaste, closeout, notes: notes.trim() || undefined };
      put("dailyChecks", record);
      toast.success(existing ? "Daily check updated" : "Daily check saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save daily check");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <SectionTitle>Daily waste check & closeout</SectionTitle>
      <p className="mb-4 text-sm text-muted-foreground">An empty day is not counted as waste-free unless someone explicitly confirms it. Closeout completion is also recorded separately.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Check date"><input type="date" className={inputCls} value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} /></Field>
        <Field label="Notes · optional"><input className={inputCls} value={notes} maxLength={300} onChange={(event) => setNotes(event.target.value)} placeholder="Closing check notes" /></Field>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={noWaste} disabled={wasteCount > 0} onChange={(event) => setNoWaste(event.target.checked)} />
          <span><span className="block font-semibold text-primary">No waste occurred</span><span className="text-xs text-muted-foreground">{wasteCount > 0 ? `${wasteCount} waste record(s) already exist for this date.` : "Explicitly confirm the waste check for this date."}</span></span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={closeout} onChange={(event) => setCloseout(event.target.checked)} />
          <span><span className="block font-semibold text-primary">Daily closeout completed</span><span className="text-xs text-muted-foreground">Confirm the café's daily records have been reviewed.</span></span>
        </label>
      </div>
      <button type="button" className={`${btnPrimary} mt-4`} disabled={saving || !canEdit} onClick={save}><CheckCircle2 className="h-4 w-4" />{saving ? "Saving…" : existing ? "Update daily check" : "Save daily check"}</button>
      {existing && <p className="mt-2 text-xs text-muted-foreground">Your saved check: {existing.noWaste ? "no waste confirmed" : "waste not confirmed"} · {existing.closeout ? "closeout completed" : "closeout not completed"}.</p>}
    </Panel>
  );
}
