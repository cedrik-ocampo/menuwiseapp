import { ChevronDown } from "lucide-react";

/** Full-width show/hide bar used by long Home lists. */
export function CollapseToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-secondary"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1 text-xs text-accent">
        {open ? "Hide" : "Show"}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </span>
    </button>
  );
}
