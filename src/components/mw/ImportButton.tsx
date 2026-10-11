import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Sheet as SheetIcon, Upload, Download, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { keyOf, readSheet, type Row } from "@/lib/import";
import { btnPrimary, btnSecondary } from "./ui";

export interface ParsedRow<T> {
  line: number;
  label: string;
  item?: T;
  error?: string;
  /** e.g. new category that doesn't match an existing one */
  flag?: string;
  /** same entry already exists — skipped when "Skip duplicates" is on */
  duplicate?: boolean;
}

export interface ImportTemplate {
  filename: string;
  header: string[];
  rows: string[][];
}

export function ImportButton<T>({
  what,
  columns,
  parse,
  commit,
  className = "",
  template,
}: {
  what: string;
  columns: string;
  parse: (rows: Row[]) => ParsedRow<T>[];
  commit: (items: T[]) => void;
  className?: string;
  template?: ImportTemplate;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState(".xlsx,.xls,.csv");
  const [preview, setPreview] = useState<ParsedRow<T>[] | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [skipDup, setSkipDup] = useState(true);
  const dl = () => (template ? downloadCsv(template.filename, [template.header, ...template.rows]) : downloadTemplate(what, columns));

  function pick(a: string) {
    setAccept(a);
    setTimeout(() => fileRef.current?.click(), 0);
  }

  async function onFile(f: File) {
    try {
      const rows = await readSheet(f);
      if (!rows.length) { toast.error("That file has no rows"); return; }
      const have = new Set(rows.flatMap((r) => Object.keys(r)));
      const missing = requiredCols(columns).filter((c) => !have.has(keyOf(c)));
      if (missing.length) { setMissing(missing); return; }
      setPreview(parse(rows));
    } catch {
      toast.error("Couldn't read that file. Use Excel (.xlsx) or CSV.");
    }
  }

  const dups = preview?.filter((r) => r.item && r.duplicate) ?? [];
  const ok = preview?.filter((r) => r.item && !(skipDup && r.duplicate)) ?? [];
  const bad = preview?.filter((r) => !r.item) ?? [];
  const flagged = ok.filter((r) => r.flag);

  return (
    <>
      <input ref={fileRef} type="file" accept={accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void onFile(f); }} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={`${btnSecondary} ${className}`}><Upload className="h-4 w-4" /> Import</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => dl()}><Download className="h-4 w-4" /> Download template (CSV)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Import {what} from</DropdownMenuLabel>
          <p className="px-2 pb-1 text-[11px] text-muted-foreground">Required Columns: {columns}.</p>
          <DropdownMenuItem onSelect={() => pick(".xlsx,.xls")}><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pick(".csv,text/csv")}><FileText className="h-4 w-4" /> CSV</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { toast.message("In Google Sheets choose File › Download › Microsoft Excel (.xlsx), then import that file."); pick(".xlsx,.xls,.csv"); }}>
            <SheetIcon className="h-4 w-4" /> Google Sheets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!missing} onOpenChange={(o) => !o && setMissing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot import</DialogTitle>
            <DialogDescription>Cannot import — missing required columns: {missing?.join(", ")}.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Required Columns: {columns}.</p>
          <div className="flex gap-3">
            <button className={`${btnSecondary} flex-1`} onClick={() => dl()}><Download className="h-4 w-4" /> Template</button>
            <button className={`${btnPrimary} flex-1`} onClick={() => { setMissing(null); pick(accept); }}>Re-upload</button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check your import</DialogTitle>
            <DialogDescription>Required Columns: {columns}.</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-primary"><b>{ok.length}</b> ready to add{bad.length ? <> · <b className="text-destructive">{bad.length}</b> will be skipped</> : null}</p>
          {flagged.length > 0 && (
            <div className="rounded-xl border border-warning-border bg-warning-soft p-3 text-sm text-warning">
              <p className="flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" /> New categories</p>
              <p className="text-xs">These don't match an existing category and will be added as new ones. Fix the spelling in your file if that's a mistake.</p>
            </div>
          )}
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {preview?.map((r) => (
              <li key={r.line} className="flex items-start gap-2 px-3 py-2">
                {r.item ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span className="min-w-0">
                  <span className="block truncate text-primary">Row {r.line}: {r.label || "—"}</span>
                  {r.error && <span className="block text-xs text-destructive">{r.error}</span>}
                  {r.flag && <span className="block text-xs text-warning">{r.flag}</span>}
                  {r.duplicate && <span className="block text-xs text-warning">Possible duplicate — same date and item already logged{skipDup ? " (will be skipped)" : ""}</span>}
                </span>
              </li>
            ))}
          </ul>
          {dups.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-primary">
              <input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} /> Skip {dups.length} possible duplicate{dups.length > 1 ? "s" : ""}
            </label>
          )}
          {bad.length > 0 && <p className="text-xs text-muted-foreground">Fix the skipped rows in your file and re-upload, or <button type="button" className="font-semibold text-accent underline" onClick={() => dl()}>download a template</button>.</p>}
          <div className="flex gap-3">
            <button className={`${btnSecondary} flex-1`} onClick={() => setPreview(null)}>Cancel</button>
            <button
              className={`${btnPrimary} flex-1`}
              disabled={!ok.length}
              onClick={() => {
                commit(ok.map((r) => r.item!));
                const skipped = (preview ?? []).filter((r) => !ok.includes(r));
                if (skipped.length) {
                  toast.success(`Imported ${ok.length} rows. ${skipped.length} rows skipped — download the error report.`, {
                    duration: 12000,
                    action: { label: "Error report", onClick: () => downloadCsv(`${what.replace(/\s+/g, "-")}-import-errors.csv`, [["row", "reason"], ...skipped.map((r) => [String(r.line), r.error ?? "Possible duplicate"])]) },
                  });
                } else toast.success(`Imported ${ok.length} ${what}`);
                setPreview(null);
              }}
            >
              Import {ok.length}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "A, B, c (Batch_ID optional)" -> ["A","B","c"] */
export function requiredCols(columns: string) {
  return columns.replace(/\([^)]*\)/g, "").split(",").map((c) => c.trim()).filter(Boolean);
}
function downloadTemplate(what: string, columns: string) {
  downloadCsv(`${what.replace(/\s+/g, "-")}-template.csv`, [requiredCols(columns)]);
}
export function downloadCsv(filename: string, rows: string[][]) {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const blob = new Blob([rows.map((r) => r.map(esc).join(",")).join("\n") + "\n"], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
