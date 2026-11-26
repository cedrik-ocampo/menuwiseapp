import { useState } from "react";
import { CalendarX2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { put, useDB } from "@/lib/store";
import { DEFAULT_SETTINGS } from "@/lib/reorder";
import { cafeSettingsOf, calendarOf, SETTINGS_ID } from "@/lib/suggestions-data";
import { describeClosedDays } from "@/lib/operating-calendar";
import { manilaToday } from "@/lib/admin-periods";
import { shortDate } from "@/lib/format";
import type { CafeSettings } from "@/lib/types";
import { Field, Panel, SectionTitle, btnPrimary, btnSecondary, inputCls } from "./ui";

export function saveCafeSettings(current: CafeSettings | undefined, patch: Partial<CafeSettings>) {
  const base: CafeSettings = current ?? { id: SETTINGS_ID, weekdays: [0, 1, 2, 3, 4, 5, 6], closures: [], calendarConfirmed: false, ...DEFAULT_SETTINGS };
  put("cafeSettings", { ...base, ...patch, id: SETTINGS_ID });
}

/** Owner Home prompt while open days are only guessed from activity. */
export function CalendarConfirmBanner() {
  const db = useDB();
  const today = manilaToday();
  const cal = calendarOf(db, today);
  if (cal.confirmed) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-info-border bg-info-soft p-4 text-sm">
      <p className="text-primary"><b>It looks like you're {describeClosedDays(cal.weekdays)} — is that right?</b> <span className="text-muted-foreground">Suggestions stay low-confidence until you confirm.</span></p>
      <div className="flex gap-2">
        <button type="button" className={btnPrimary} onClick={() => { saveCafeSettings(cafeSettingsOf(db), { weekdays: cal.weekdays, calendarConfirmed: true }); toast.success("Open days confirmed"); }}>Yes, save</button>
        <a href="/profile#calendar" className={btnSecondary}>Change</a>
      </div>
    </div>
  );
}

/** One-off closures and suggestion rules; saved offline like other café records. */
export function SuggestionSettingsPanel({ isOwner }: { isOwner: boolean }) {
  const db = useDB();
  const current = cafeSettingsOf(db);
  const s = { ...DEFAULT_SETTINGS, ...current };
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const closures = [...(current?.closures ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const num = (key: keyof typeof DEFAULT_SETTINGS, label: string, hint: string, min: number, max: number) => (
    <Field label={label} hint={hint}>
      <input type="number" className={inputCls} min={min} max={max} disabled={!isOwner} key={`${key}-${s[key]}`} defaultValue={s[key]} onBlur={(e) => { const v = Number(e.target.value); if (v === s[key]) return; if (!Number.isFinite(v) || v < min || v > max) { e.target.value = String(s[key]); return void toast.error(`${label} must be ${min}–${max}`); } saveCafeSettings(current, { [key]: v }); toast.success("Saved"); }} />
    </Field>
  );
  return (
    <Panel className="space-y-4">
      <div id="calendar" />
      <SectionTitle>Closures & suggestion rules</SectionTitle>
      <div>
        <p className="text-sm font-semibold text-primary">One-off closures</p>
        <p className="text-xs text-muted-foreground">Holidays or days you close outside your weekly pattern. They are never counted as zero-sales days.</p>
        {isOwner && (
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <input type="date" aria-label="Closure date" className={`${inputCls} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
            <input aria-label="Closure note" className={`${inputCls} w-48`} placeholder="e.g. Christmas" maxLength={60} value={note} onChange={(e) => setNote(e.target.value)} />
            <button type="button" className={btnSecondary} disabled={!date} onClick={() => {
              if (closures.some((c) => c.date === date)) return void toast.error("That date is already closed");
              saveCafeSettings(current, { closures: [...closures, { date, ...(note.trim() ? { note: note.trim() } : {}) }] });
              setDate(""); setNote("");
            }}><CalendarX2 className="h-4 w-4" />Add closure</button>
          </div>
        )}
        <ul className="mt-2 divide-y divide-border text-sm">
          {closures.length === 0 && <li className="py-2 text-muted-foreground">No closures added.</li>}
          {closures.map((c) => (
            <li key={c.date} className="flex items-center justify-between py-2">
              <span className="text-primary">{shortDate(c.date)}{c.note ? ` · ${c.note}` : ""}</span>
              {isOwner && <button type="button" aria-label={`Remove closure ${c.date}`} onClick={() => saveCafeSettings(current, { closures: closures.filter((x) => x.date !== c.date) })}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {num("wasteCapPct", "Waste adjustment cap (%)", "Most an order is cut for avoidable waste", 0, 50)}
        {num("safetyBufferDays", "Safety buffer (open days)", "Extra days of stock", 0, 7)}
        {num("historyWeeks", "History window (weeks)", "Used for medians", 2, 12)}
        {num("borderlinePct", "Borderline band (%)", "Near-threshold menu items", 0, 30)}
        {num("eligibilityDays", "Days before classifying", "New menu items", 7, 90)}
        {num("categoryMin", "Category minimum items", "Else compare whole menu", 2, 20)}
      </div>
    </Panel>
  );
}
