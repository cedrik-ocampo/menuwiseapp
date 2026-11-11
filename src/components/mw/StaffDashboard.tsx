import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, PackagePlus, PhilippinePeso, Trash2, TrendingUp, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDB } from '@/lib/store';
import { daysBetween, fmtQty, shortDate, timeOf, todayISO } from '@/lib/format';
import { shiftDashboard } from '@/lib/shift-dashboard';
import { ProductionImport, SalesImport } from './DailyImports';
import { WasteImport } from './WasteImport';

export function StaffDashboard() {
  const db = useDB();
  const today = todayISO();
  const shift = useMemo(() => shiftDashboard(db, today), [db, today]);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase text-accent">Team workspace</p><h2 className="mt-1 text-2xl font-bold text-primary">Your shift at a glance</h2></div>
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">{db.pendingCollections.size ? <><Clock3 className="h-4 w-4 text-warning" /> Changes awaiting sync</> : !db.online ? <><WifiOff className="h-4 w-4" /> Offline</> : <><CheckCircle2 className="h-4 w-4 text-success" /> All changes synced</>}</p>
    </div>

    <section aria-labelledby="shift-expiry-title" className="border-y border-border py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 id="shift-expiry-title" className="flex items-center gap-2 text-lg font-bold text-primary"><AlertTriangle className="h-5 w-5 text-warning" /> Expiry watch</h3><span className="text-xs text-muted-foreground">Overdue · today · next 2 days</span></div>
      {shift.alerts.length === 0 ? <p className="text-sm text-muted-foreground">{db.purchases.length || db.batches.length ? 'No recorded stock or batches need an expiry check in the next 2 days.' : 'No stock or batch expiry dates recorded yet.'}</p> : <ul className="grid max-h-96 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
        {shift.alerts.map((alert) => {
          const days = daysBetween(today, alert.expiry);
          return <li key={`${alert.kind}:${alert.id}`} className={`rounded-lg border p-4 ${days < 0 ? 'border-destructive/30 bg-destructive/5' : 'border-warning-border bg-warning-soft'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words font-semibold text-primary">{alert.name}</p><span className={`text-xs font-bold ${days < 0 ? 'text-destructive' : 'text-warning'}`}>{days < 0 ? 'Expired — do not use' : days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : 'Expires in 2 days'}</span></div>
            <p className="mt-1 break-words text-xs text-muted-foreground">{alert.kind === 'ingredient' ? `Lot ${alert.id} · ${fmtQty(alert.quantity)} ${alert.unit} remaining` : `Batch ${alert.id} · ${fmtQty(alert.quantity)} ${alert.unit} originally logged`} · {shortDate(alert.expiry)}</p>
            <p className="mt-2 text-sm text-foreground">{days < 0 ? 'Set aside and record waste after checking the stock.' : alert.kind === 'ingredient' ? 'Check freshness and use the earliest-expiring lot first.' : 'Check unsold stock and freshness before serving.'}</p>
            <Button asChild variant="link" className="mt-2 h-auto p-0">{alert.kind === 'ingredient' ? <Link to="/ingredients/$id" params={{ id: alert.itemId }}>View stock <ArrowRight /></Link> : <Link to="/log-production" search={{ item: alert.itemId }}>View production <ArrowRight /></Link>}</Button>
          </li>;
        })}
      </ul>}
      {shift.alerts.some((a) => a.kind === 'batch') && <p className="mt-3 text-xs text-muted-foreground">Batch reminders are based on recorded expiry dates, not confirmed stock remaining. Sales are not assigned to individual batches.</p>}
    </section>

    <section aria-labelledby="shift-log-title">
      <h3 id="shift-log-title" className="mb-4 text-lg font-bold text-primary">Daily logs</h3>
      {db.menuItems.length === 0 && <p className="mb-4 text-sm text-warning">Your café owner needs to add menu items before you can record item sales or production.</p>}
      <div className="grid gap-3 lg:grid-cols-3">
        {([
          { key: 'sales', title: 'Sales', icon: PhilippinePeso, to: '/sales', importer: <SalesImport /> },
          { key: 'batches', title: 'Production', icon: PackagePlus, to: '/log-production', importer: <ProductionImport /> },
          { key: 'wasteLogs', title: 'Waste', icon: Trash2, to: '/log-waste', importer: <WasteImport /> },
        ] as const).map((action) => <div key={action.key} className="flex flex-col rounded-lg border border-border bg-card p-4">
          <h4 className="flex items-center gap-2 font-semibold text-primary"><action.icon className="h-5 w-5 text-accent" />{action.title}</h4>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">{shift.counts[action.key]} {shift.counts[action.key] === 1 ? 'entry' : 'entries'} recorded today</p>
          <div className="mt-auto flex flex-wrap items-center gap-2">{action.importer}<Button asChild variant="secondary">{action.to === '/log-production' ? <Link to="/log-production" search={{ item: undefined }}>Log manually <ArrowRight /></Link> : <Link to={action.to}>Log manually <ArrowRight /></Link>}</Button></div>
        </div>)}
      </div>
    </section>

    <section aria-labelledby="shift-feedback-title" className="border-y border-border py-5">
      <h3 id="shift-feedback-title" className="mb-4 text-lg font-bold text-primary">Your team's progress</h3>
      <div className="grid gap-5 sm:grid-cols-3">
        <div><p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Logging activity</p><p className="mt-2 text-2xl font-bold text-primary">{shift.loggedDays} / 7 days</p><p className="mt-1 text-xs text-muted-foreground">With at least one team entry. Every accurate log helps the next shift.</p></div>
        <div><p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><TrendingUp className="h-4 w-4 text-accent" /> Yesterday's top seller</p><p className="mt-2 break-words text-xl font-bold text-primary">{shift.topSeller?.name ?? 'No sales recorded'}</p><p className="mt-1 text-xs text-muted-foreground">{shift.topSeller ? `${fmtQty(shift.topSeller.quantity)} units sold · useful for today's prep check` : 'Record sales to see what customers are choosing.'}</p></div>
        <div><p className="text-sm font-semibold text-muted-foreground">Waste / sales · this week</p><p className={`mt-2 text-2xl font-bold ${shift.wastePct === null ? 'text-primary' : shift.wastePct < 3 ? 'text-success' : shift.wastePct <= 5 ? 'text-warning' : 'text-primary'}`}>{shift.wastePct === null ? '—' : `${shift.wastePct.toFixed(1)}%`}</p><p className="mt-1 text-xs text-muted-foreground">{shift.wastePct === null ? 'Needs both sales and waste entries. No entry does not mean zero waste.' : shift.wastePct < 3 ? 'Under the 3% guide. Keep checking freshness and logging honestly.' : 'Use expiry checks and accurate logs to spot opportunities together.'}</p></div>
      </div>
    </section>

    <section aria-labelledby="shift-activity-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 id="shift-activity-title" className="text-lg font-bold text-primary">Today's team activity</h3><span className="text-xs text-muted-foreground">{shift.activity.length} entries</span></div>
      {shift.activity.length === 0 ? <p className="py-4 text-sm text-muted-foreground">No entries for today yet. Your next log will appear here for the team.</p> : <ul className="divide-y divide-border">
        {shift.activity.slice(0, 20).map((entry) => <li key={`${entry.kind}:${entry.record.id}`} className="flex items-start gap-3 py-3"><span className="mt-1 rounded-md bg-muted p-2 text-accent">{entry.kind === 'Production' ? <PackagePlus className="h-4 w-4" /> : entry.kind === 'Waste' ? <Trash2 className="h-4 w-4" /> : <PhilippinePeso className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold text-primary">{entry.name} · {fmtQty(entry.quantity)} {entry.unit}</p><p className="mt-1 break-words text-xs text-muted-foreground">{entry.kind} · {entry.record.createdByName || 'Team member'}{entry.kind === 'Production' ? ` · Batch ${entry.record.id}` : ''}</p></div><span className="shrink-0 text-xs text-muted-foreground">{entry.at ? timeOf(entry.at) : 'Time unavailable'}</span></li>)}
      </ul>}
      {shift.activity.length > 20 && <p className="mt-2 text-xs text-muted-foreground">Showing the latest 20 entries. All entries remain on their daily log pages.</p>}
    </section>
  </div>;
}