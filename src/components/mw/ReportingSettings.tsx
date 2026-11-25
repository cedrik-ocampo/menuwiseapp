import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { currentWorkspace } from "@/lib/store";
import { Panel, SectionTitle, btnPrimary } from "./ui";

const WEEKDAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" }, { value: 0, label: "Sun" },
];

/** Owner-controlled reporting schedule and research opt-out. */
export function ReportingSettings({ isOwner }: { isOwner: boolean }) {
  const workspaceId = currentWorkspace();
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [consent, setConsent] = useState(true);
  const [initialConsent, setInitialConsent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    if (!workspaceId || !navigator.onLine) { setLoading(false); return; }
    const { data, error } = await supabase.from("workspaces").select("operating_days,research_consent").eq("id", workspaceId).maybeSingle();
    if (error) toast.error("Could not load reporting settings");
    if (data) {
      setDays(data.operating_days ?? [0, 1, 2, 3, 4, 5, 6]);
      setConsent(data.research_consent ?? true);
      setInitialConsent(data.research_consent ?? true);
    }
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!workspaceId || !isOwner) return;
    if (!days.length) return void toast.error("Select at least one expected operating day");
    if (!navigator.onLine) return void toast.error("You're offline. Reconnect to save reporting settings.");
    setSaving(true);
    const { error } = await supabase.from("workspaces").update({
      operating_days: days,
      research_consent: consent,
      ...(consent !== initialConsent ? { research_consent_updated_at: new Date().toISOString() } : {}),
    }).eq("id", workspaceId);
    setSaving(false);
    if (error) return void toast.error("Could not save reporting settings");
    setInitialConsent(consent);
    toast.success("Reporting settings saved");
  }

  return (
    <Panel className="space-y-4">
      <SectionTitle>Reporting & research privacy</SectionTitle>
      <div>
        <p className="text-sm font-semibold text-primary">Expected café operating days</p>
        <p className="mt-1 text-xs text-muted-foreground">Admin logging coverage uses these days instead of assuming every calendar day is an operating day.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Expected café operating days">
          {WEEKDAYS.map((day) => {
            const selected = days.includes(day.value);
            return <button key={day.value} type="button" disabled={!isOwner || loading} aria-pressed={selected} onClick={() => setDays((current) => selected ? current.filter((value) => value !== day.value) : [...current, day.value])} className={`h-10 min-w-14 rounded-lg px-3 text-sm font-semibold ${selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"} disabled:opacity-60`}>{day.label}</button>;
          })}
        </div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
        <input type="checkbox" className="mt-1" disabled={!isOwner || loading} checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span><span className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" />Allow privacy-safe research reporting</span><span className="mt-1 block text-xs text-muted-foreground">Research reporting is opt-out. Only aggregated percentages, counts and trends may be used. Raw sales, prices, costs, recipes, transactions and employee activity remain private. Turn this off to stop research findings; operational monitoring continues.</span></span>
      </label>
      {!isOwner && <p className="text-xs text-muted-foreground">Only the café owner can change these settings.</p>}
      {isOwner && <button type="button" className={btnPrimary} disabled={saving || loading || !days.length} onClick={() => void save()}>{saving ? "Saving…" : "Save reporting settings"}</button>}
    </Panel>
  );
}
