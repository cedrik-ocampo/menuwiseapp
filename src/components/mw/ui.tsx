import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-card p-5 ${className}`}>{children}</section>;
}

export function Callout({ tone, title, children }: { tone: "info" | "warning"; title: string; children: ReactNode }) {
  const cls = tone === "info" ? "bg-info-soft border-info-border text-primary" : "bg-warning-soft border-warning-border text-warning";
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="flex items-center gap-2 font-semibold">
        <Icon className="h-5 w-5" /> {title}
      </p>
      <div className="mt-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function Stat({ label, value, sub, className = "" }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <p className="text-xs font-semibold text-primary">{label}</p>
      <p className="mt-1 text-2xl font-bold text-primary">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h3 className="text-lg font-bold text-primary">{children}</h3>
      {right}
    </div>
  );
}

export const inputCls =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60";

export function Field({ label, hint, error, required, children }: { label: ReactNode; hint?: string; error?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-2 text-sm font-semibold text-primary">
        <span>{label}</span>
        {required && <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Required</span>}
      </span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div className="grid rounded-lg bg-secondary p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          type="button"
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-md px-2 py-2 text-xs font-semibold transition-colors ${value === o ? "bg-primary text-primary-foreground" : "text-primary"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export const btnPrimary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
export const btnSecondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-secondary px-5 text-sm font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50";
