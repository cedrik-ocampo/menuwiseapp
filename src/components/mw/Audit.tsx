import { useState } from "react";
import { useDB } from "@/lib/store";
import type { Audit, CollectionName } from "@/lib/types";
import { formatPeso, shortDate } from "@/lib/format";

const LABEL: Record<string, string> = {
  quantity: "Quantity", unit: "Unit", unitCost: "Unit cost", value: "Waste value", wasteType: "Waste type", at: "Date",
  producedAt: "Produced", expiryDate: "Expiry", purchaseDate: "Purchased", remaining: "Remaining", note: "Note",
  name: "Name", category: "Category", storage: "Storage", retailPrice: "Price", available: "Available", description: "Description",
};
const MONEY = new Set(["unitCost", "value", "retailPrice", "retailValue", "batchCost", "purchaseCost"]);

function fmt(field: string, v: unknown) {
  if (v === undefined || v === null || v === "") return "—";
  if (MONEY.has(field) && typeof v === "number") return formatPeso(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return shortDate(v);
  if (typeof v === "object") return "updated";
  return String(v);
}

/** Small "Logged by … · Edited by …" caption with an expandable list of changes. */
export function AuditCaption({ collection, record }: { collection: CollectionName; record: { id: string } & Audit }) {
  const db = useDB();
  const [open, setOpen] = useState(false);
  const edits = db.changeLogs
    .filter((c) => c.collection === collection && c.recordId === record.id && c.action === "edited")
    .sort((a, b) => b.at.localeCompare(a.at));
  if (!record.createdByName && !edits.length) return null;
  return (
    <div className="mt-1 text-[11px] text-muted-foreground">
      {record.createdByName && <span>Logged by {record.createdByName}{record.createdAt ? ` on ${shortDate(record.createdAt)}` : ""}</span>}
      {record.updatedByName && (
        <>
          {record.createdByName && " · "}
          <button type="button" className="underline-offset-2 hover:underline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open); }}>
            Edited by {record.updatedByName} on {shortDate(record.updatedAt)}{edits.length ? ` (${open ? "hide" : "see changes"})` : ""}
          </button>
        </>
      )}
      {open && (
        <ul className="mt-1 space-y-0.5 rounded-md bg-muted p-2">
          {edits.map((c) => (
            <li key={c.id}>
              <b className="text-primary">{c.byName}</b>{c.adminEdit && <span className="ml-1 rounded bg-warning-soft px-1 font-semibold text-warning">Admin edit</span>} · {shortDate(c.at)} {new Date(c.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}:{" "}
              {c.changes.map((ch) => `${LABEL[ch.field] ?? ch.field} ${fmt(ch.field, ch.from)} → ${fmt(ch.field, ch.to)}`).join("; ")}{c.note ? ` — “${c.note}”` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
