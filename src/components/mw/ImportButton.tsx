import { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Upload, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { keyOf, readSheet, type Row } from "@/lib/import";
import { resolveImport, type ImportDecision } from "@/lib/import-review";
import { inputCls } from "./ui";

export interface ParsedRow<T> { line: number; label: string; item?: T; error?: string; flag?: string; duplicate?: boolean }
export interface ImportTemplate { filename: string; header: string[]; rows: string[][] }
export interface ImportField { options?: string[] | ((row: Row) => string[]); type?: 'text' | 'number' | 'date' | 'time'; allowCustom?: boolean; labels?: Record<string, string> }
export function ImportButton<T>({ what, columns, parse, commit, className = "", template, fields = {}, allowMerge = false }: {
  what: string; columns: string; parse: (rows: Row[]) => ParsedRow<T>[];
  commit: (items: T[], merges?: T[]) => void | Promise<void>; className?: string; template?: ImportTemplate;
  fields?: Record<string, ImportField>; allowMerge?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState<Row[] | null>(null);
  const [decisions, setDecisions] = useState<Record<number, ImportDecision>>({});
  const [corrected, setCorrected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [accept, setAccept] = useState('.xlsx,.xls,.csv');
  const headers = [...new Set([...(template?.header ?? requiredCols(columns)).map(keyOf), ...(raw?.flatMap(Object.keys) ?? [])])].filter((key) => key !== '__line');
  const entries = raw ? parse(raw) : [];
  const resolved = resolveImport(entries, decisions);
  const ready = resolved.add.length + resolved.merge.length;
  const dl = () => downloadCsv(template?.filename ?? `${what.replace(/\s+/g, '-')}-template.csv`, template ? [template.header, ...template.rows] : [requiredCols(columns)]);
  function pick(ext: string) { setAccept(ext); setTimeout(() => fileRef.current?.click(), 0); }
  async function onFile(file: File) {
    try {
      const rows = await readSheet(file);
      if (!rows.length) { toast.error('That file has no rows'); return; }
      setRaw(rows.map((row, index) => ({ ...row, __line: String(index + 2) })));
      setDecisions({}); setCorrected(new Set()); setConfirm(false);
    } catch { toast.error("Couldn't read that file. Use Excel (.xlsx) or CSV."); }
  }
  function edit(line: number, key: string, value: string) {
    setRaw((rows) => rows?.map((row) => Number(row.__line) === line ? { ...row, [key]: value } : row) ?? null);
    setCorrected((current) => new Set([...current, line])); setConfirm(false);
  }
  async function save() {
    setSaving(true);
    try {
      await commit(resolved.add, resolved.merge);
      toast.success(`Imported ${ready} ${what}. ${resolved.skipped.length} skipped.`);
      if (resolved.skipped.length) downloadCsv(`${what.replace(/\s+/g, '-')}-import-errors.csv`, [['row', 'reason', ...headers], ...resolved.skipped.map((entry) => { const row = raw?.find((r) => Number(r.__line) === entry.line); return [String(entry.line), entry.error ?? (entry.duplicate ? 'Possible duplicate — skipped' : 'Skipped by choice'), ...headers.map((key) => row?.[key] ?? '')]; })]);
      setRaw(null);
    } catch { toast.error('Import could not finish. Check the saved entries before trying again.'); }
    finally { setSaving(false); }
  }
  return <>
    <input aria-label={`Import ${what} file`} ref={fileRef} type="file" accept={accept} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onFile(file); }} />
    <DropdownMenu><DropdownMenuTrigger asChild><Button className={className}><Upload /> Import</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuItem onSelect={dl}><Download /> Download template (CSV)</DropdownMenuItem><DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => pick('.xlsx,.xls')}><FileSpreadsheet /> Excel (.xlsx)</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => pick('.csv,text/csv')}><FileText /> CSV</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { toast.message('Download your Google Sheet as Excel or CSV, then choose that file.'); pick('.xlsx,.xls,.csv'); }}>Google Sheets</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <Dialog open={raw !== null} onOpenChange={(open) => { if (!open && !saving) setRaw(null); }}><DialogContent className="flex max-h-[90vh] max-w-[calc(100vw-2rem)] flex-col sm:max-w-6xl">
      <DialogHeader><DialogTitle>{confirm ? 'Confirm import' : 'Review import'}</DialogTitle><DialogDescription>{what} · {ready} ready · {corrected.size} rows corrected · {resolved.skipped.length} entries skipped · {entries.filter((e) => e.duplicate).length} possible duplicates</DialogDescription></DialogHeader>
      {confirm ? <div className="space-y-3 py-4"><p className="text-sm text-foreground">{resolved.add.length} new entries · {resolved.merge.length} sales entries to combine.</p><p className="text-sm text-muted-foreground">Existing records stay unchanged except sales explicitly marked Merge. Unresolved or skipped entries are excluded.</p></div> : <div className="min-h-0 space-y-4 overflow-y-auto">
        {entries.map((entry) => <div key={entry.line} className="space-y-2 border-b border-border py-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words font-semibold text-primary">Row {entry.line}: {entry.label || 'Unnamed entry'}</p>
            <select aria-label={`Decision for row ${entry.line}`} className={`${inputCls} w-auto`} value={decisions[entry.line] ?? (entry.duplicate ? 'skip' : 'add')} onChange={(e) => setDecisions({ ...decisions, [entry.line]: e.target.value as ImportDecision })}><option value="add">{entry.duplicate ? 'Add anyway' : 'Add'}</option><option value="skip">Skip</option>{allowMerge && entry.duplicate && <option value="merge">Merge (same date, item and price)</option>}</select></div>
          {entry.error && <p role="alert" className="text-sm text-destructive">{entry.error}</p>}{entry.flag && <p className="text-sm text-warning">{entry.flag}</p>}{entry.duplicate && <p className="text-sm text-warning">Possible duplicate — skipped unless you choose otherwise.</p>}
        </div>)}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Row</th>{headers.map((key) => <th className="p-2" key={key}>{template?.header.find((h) => keyOf(h) === key)?.replace(/_/g, ' ') ?? key}</th>)}<th /></tr></thead><tbody>
          {raw?.map((row) => { const line = Number(row.__line); return <tr key={line} className="border-t border-border"><td className="p-2">{line}</td>{headers.map((key) => {
            const field = fields[key] ?? {}; const options = typeof field.options === 'function' ? field.options(row) : field.options;
            const value = row[key] ?? ''; const choices = [...new Set([...(options ?? []), ...(value ? [value] : [])])];
            return <td className="p-2" key={key}>{options && !field.allowCustom ? <select aria-label={`Row ${line} ${key}`} className={`${inputCls} min-w-40`} value={value} onChange={(e) => edit(line, key, e.target.value)}><option value="">Unselected</option>{choices.map((option) => <option key={option} value={option}>{field.labels?.[option] ?? option}</option>)}</select> : <input aria-label={`Row ${line} ${key}`} list={options ? `choices-${key}-${line}` : undefined} className={`${inputCls} min-w-40`} type={field.type ?? 'text'} step={field.type === 'number' ? 'any' : undefined} value={value} onChange={(e) => edit(line, key, e.target.value)} />}{options && field.allowCustom && <datalist id={`choices-${key}-${line}`}>{options.map((option) => <option key={option} value={option} />)}</datalist>}</td>;
          })}<td className="p-2"><Button variant="ghost" size="icon" aria-label={`Remove row ${line}`} onClick={() => { setRaw(raw.filter((r) => r !== row)); setDecisions({}); }}><Trash2 /></Button></td></tr>; })}
        </tbody></table></div>
        <Button variant="outline" onClick={() => { const line = Math.max(1, ...(raw ?? []).map((r) => Number(r.__line))) + 1; setRaw([...(raw ?? []), { __line: String(line) }]); }}><Plus /> Add row</Button>
      </div>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3"><Button variant="outline" onClick={dl}><Download /> Template</Button><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => confirm ? setConfirm(false) : setRaw(null)}>{confirm ? 'Back to review' : 'Cancel'}</Button><Button disabled={!ready || saving} onClick={() => confirm ? void save() : setConfirm(true)}>{saving ? 'Saving…' : confirm ? `Import ${ready}` : 'Review summary'}</Button></div></div>
    </DialogContent></Dialog>
  </>;
}
export function requiredCols(columns: string) { return columns.replace(/\([^)]*\)/g, '').split(',').map((c) => c.trim()).filter(Boolean); }
export function downloadCsv(filename: string, rows: string[][]) {
  const esc = (value: string) => { const safe = /^[=+@\-]/.test(value) ? `'${value}` : value; return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
