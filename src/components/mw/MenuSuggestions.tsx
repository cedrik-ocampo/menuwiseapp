import { useMemo } from "react";
import { useDB } from "@/lib/store";
import { manilaToday } from "@/lib/admin-periods";
import { formatPeso } from "@/lib/format";
import { menuSuggestions } from "@/lib/suggestions-data";
import { ConfidenceBadge } from "./SuggestedOrders";
import { Panel, SectionTitle } from "./ui";

/** Owner-only ranked menu actions from the within-category quadrant engine. */
export function MenuSuggestions() {
  const db = useDB();
  const today = manilaToday();
  const rows = useMemo(() => menuSuggestions(db, today), [db, today]);
  const classified = rows.filter((r) => r.status === "classified");
  const tooNew = rows.filter((r) => r.status === "too-new");
  return (
    <Panel className="mt-6">
      <SectionTitle>Menu suggestions</SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-muted-foreground">Last 4 weeks, compared within category. Popularity = units per open day (sold-out days excluded); margin includes waste cost. Ranked by estimated ₱ impact.</p>
      {classified.length === 0 && <p className="text-sm text-muted-foreground">Not enough history yet — items need 28+ days listed and 10+ sales.</p>}
      <ol className="divide-y divide-border">
        {classified.map((r) => (
          <li key={r.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-primary">{r.name} <span className="text-xs font-normal text-muted-foreground">· {r.category}</span></p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded bg-info-soft px-1.5 py-0.5 text-[11px] font-bold text-primary">{r.quadrant}</span>
                  {r.borderline && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[11px] font-bold text-warning">Borderline</span>}
                  <ConfidenceBadge value={r.confidence} />
                  {r.scope === "menu" && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">Compared with whole menu</span>}
                </div>
              </div>
              {r.impact > 0 && <p className="text-right font-bold text-primary">{formatPeso(r.impact)}<span className="block text-[11px] font-normal text-muted-foreground">est. impact</span></p>}
            </div>
            <p className="mt-1 text-primary">{r.action}</p>
            <p className="text-xs text-muted-foreground">{r.popularity.toFixed(2)} sold per open day (line {r.popThreshold.toFixed(2)}) · margin {formatPeso(r.margin)} (median {formatPeso(r.marginThreshold)})</p>
            {r.notes.map((n) => <p key={n} className="text-xs text-warning">{n}</p>)}
          </li>
        ))}
      </ol>
      {tooNew.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Too new to classify: {tooNew.map((r) => r.name).join(", ")}</p>}
    </Panel>
  );
}
