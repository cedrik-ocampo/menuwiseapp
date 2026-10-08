import { useRef, useState } from "react";
import { FileSpreadsheet, FileText, Sheet as SheetIcon, Upload, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { readSheet, type Row } from "@/lib/import";
import { btnPrimary, btnSecondary } from "./ui";

export interface ParsedRow<T> {
  line: number;
  label: string;
  item?: T;
  error?: string;
  /** e.g. new category that doesn't match an existing one */
  flag?: string;
}

export function ImportButton<T>({
  what,
  columns,
  parse,
  commit,
  className = "",
}: {
  what: string;
  columns: string;
  parse: (rows: Row[]) => ParsedRow<T>[];
  commit: (items: T[]) => void;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accept, setAccept] = useState(".xlsx,.xls,.csv");
  const [preview, setPreview] = useState<ParsedRow<T>[] | null>(null);

  function pick(a: string) {
    setAccept(a);
    setTimeout(() => fileRef.current?.click(), 0);
  }

  async function onFile(f: File) {
    try {
      const rows = await readSheet(f);
      if (!rows.length) return toast.error("That file has no rows");
      setPreview(parse(rows));
    } catch {
      toast.error("Couldn't read that file. Use Excel (.xlsx) or CSV.");
    }
  }

  const ok = preview?.filter((r) => r.item) ?? [];
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
          <DropdownMenuLabel>Import {what} from</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => pick(".xlsx,.xls")}><FileSpreadsheet className="h-4 w-4" /> Excel (.xlsx)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => pick(".csv,text/csv")}><FileText className="h-4 w-4" /> CSV</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => { toast.message("In Google Sheets choose File › Download › Microsoft Excel (.xlsx), then import that file."); pick(".xlsx,.xls,.csv"); }}>
            <SheetIcon className="h-4 w-4" /> Google Sheets
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-3">
            <button className={`${btnSecondary} flex-1`} onClick={() => setPreview(null)}>Cancel</button>
            <button
              className={`${btnPrimary} flex-1`}
              disabled={!ok.length}
              onClick={() => { commit(ok.map((r) => r.item!)); toast.success(`Imported ${ok.length} ${what}`); setPreview(null); }}
            >
              Import {ok.length}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
