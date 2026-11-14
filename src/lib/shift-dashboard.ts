import type { DBView } from './store';
import { addDays, toISODate } from './format';
import { totalSales, totalWaste, weekStart } from './calc';
import type { Audit } from './types';

export function operationalDate(value: string) {
  if (value.length === 10) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : toISODate(date);
}

/** Recorded production is not remaining stock: sales are not allocated to batches. */
export function shiftDashboard(db: DBView, today: string) {
  const limit = addDays(today, 2);
  const ingredientAlerts = db.purchases.flatMap((lot) => {
    const ingredient = db.ingredients.find((item) => item.id === lot.ingredientId);
    if (!ingredient || lot.remaining <= 0 || lot.purchaseDate > today || !lot.expiryDate || lot.expiryDate > limit) return [];
    return [{ kind: 'ingredient' as const, id: lot.id, itemId: ingredient.id, name: ingredient.name, expiry: lot.expiryDate, quantity: lot.remaining, unit: ingredient.unit }];
  });
  const batchAlerts = db.batches.flatMap((batch) => {
    const item = db.menuItems.find((menu) => menu.id === batch.menuItemId);
    const discarded = db.wasteLogs.filter((w) => w.batchId === batch.id && operationalDate(w.at) <= today && w.unit === item?.batchUnit).reduce((sum, w) => sum + w.quantity, 0);
    if (!item || batch.quantity <= discarded || operationalDate(batch.producedAt) > today || !batch.expiryDate || batch.expiryDate > limit) return [];
    return [{ kind: 'batch' as const, id: batch.id, itemId: item.id, name: item.name, expiry: batch.expiryDate, quantity: batch.quantity, unit: item.batchUnit }];
  });
  const alerts = [...ingredientAlerts, ...batchAlerts].sort((a, b) => a.expiry.localeCompare(b.expiry) || a.name.localeCompare(b.name));
  const counts = {
    sales: db.sales.filter((r) => operationalDate(r.date) === today).length,
    batches: db.batches.filter((r) => operationalDate(r.producedAt) === today).length,
    wasteLogs: db.wasteLogs.filter((r) => operationalDate(r.at) === today).length,
  };
  const activity = [
    ...db.sales.filter((r) => operationalDate(r.date) === today).map((r) => ({ record: r as typeof r & Audit, kind: 'Sales', itemId: r.menuItemId, quantity: r.quantity, unit: db.menuItems.find((m) => m.id === r.menuItemId)?.unit ?? 'units', fallbackAt: undefined })),
    ...db.batches.filter((r) => operationalDate(r.producedAt) === today).map((r) => ({ record: r as typeof r & Audit, kind: 'Production', itemId: r.menuItemId, quantity: r.quantity, unit: db.menuItems.find((m) => m.id === r.menuItemId)?.batchUnit ?? 'units', fallbackAt: r.producedAt })),
    ...db.wasteLogs.filter((r) => operationalDate(r.at) === today).map((r) => ({ record: r as typeof r & Audit, kind: 'Waste', itemId: r.menuItemId ?? r.ingredientId ?? r.customName, quantity: r.quantity, unit: r.unit, fallbackAt: r.at })),
  ].map((a) => ({ ...a, at: a.record.createdAt ?? a.fallbackAt, name: db.menuItems.find((m) => m.id === a.itemId)?.name ?? db.ingredients.find((i) => i.id === a.itemId)?.name ?? (a.itemId ? `${a.itemId} (custom)` : 'Unlinked item') }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const loggedDates = new Set([
    ...db.sales.map((r) => operationalDate(r.date)),
    ...db.batches.map((r) => operationalDate(r.producedAt)),
    ...db.wasteLogs.map((r) => operationalDate(r.at)),
  ]);
  const loggedDays = Array.from({ length: 7 }, (_, i) => addDays(today, -i)).filter((date) => loggedDates.has(date)).length;
  const yesterday = addDays(today, -1);
  const units = new Map<string, number>();
  db.sales.filter((r) => operationalDate(r.date) === yesterday).forEach((r) => units.set(r.menuItemId, (units.get(r.menuItemId) ?? 0) + r.quantity));
  const top = [...units.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const from = weekStart(today);
  const sales = totalSales(db, from, today);
  const waste = totalWaste(db, from, today).total;
  const hasWaste = db.wasteLogs.some((r) => operationalDate(r.at) >= from && operationalDate(r.at) <= today);
  return { alerts, counts, activity, loggedDays, topSeller: top ? { name: db.menuItems.find((m) => m.id === top[0])?.name ?? top[0], quantity: top[1] } : null, wastePct: sales > 0 && hasWaste ? waste / sales * 100 : null };
}