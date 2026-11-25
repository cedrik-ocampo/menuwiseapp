import { describe, expect, it } from 'vitest';
import { shiftDashboard } from './shift-dashboard';
import type { DBView } from './store';
import type { Batch, MenuItem, WasteLog } from './types';

function fixture(): DBView {
  return { ready: true, online: true, pendingCollections: new Set(), ingredients: [{ id: 'milk', name: 'Milk', category: '', storage: '', unit: 'L', unitCost: 80 }], menuItems: [{ id: 'latte', name: 'Latte', unit: 'cups', batchUnit: 'pc', retailPrice: 100 } as MenuItem], purchases: [], usages: [], batches: [], sales: [], wasteLogs: [], dailyChecks: [], changeLogs: [], insightResponses: [] };
}
describe('staff shift feedback', () => {
  it('includes every positive-stock lot overdue or expiring within two days, not future purchases or empty lots', () => {
    const db = fixture();
    db.purchases = ['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14'].map((expiryDate, i) => ({ id: String(i), ingredientId: 'milk', purchaseDate: '2026-11-01', expiryDate, remaining: 2, quantity: 2, unitCost: 80 }));
    db.purchases.push({ ...db.purchases[0], id: 'empty', remaining: 0 }, { ...db.purchases[0], id: 'future', purchaseDate: '2026-11-12' });
    expect(shiftDashboard(db, '2026-11-11').alerts.map((a) => a.id)).toEqual(['0', '1', '2', '3']);
  });
  it('shows batch reminders without treating original production as unsold stock', () => {
    const db = fixture();
    db.batches = [{ id: 'batch', menuItemId: 'latte', producedAt: '2026-11-11', expiryDate: '2026-11-12', quantity: 12 }];
    db.sales = [{ id: 'sale', menuItemId: 'latte', date: '2026-11-11', quantity: 10 }];
    expect(shiftDashboard(db, '2026-11-11').alerts[0].quantity).toBe(12);
    db.wasteLogs = [{ id: 'waste', batchId: 'batch', at: '2026-11-11', quantity: 12, unit: 'pc' } as WasteLog];
    expect(shiftDashboard(db, '2026-11-11').alerts).toHaveLength(0);
  });
  it('counts distinct active days in the last seven days without inventing completed shifts', () => {
    const db = fixture();
    db.sales = ['2026-11-04', '2026-11-05', '2026-11-05', '2026-11-11', '2026-11-12'].map((date, i) => ({ id: String(i), date, menuItemId: 'latte', quantity: 2 }));
    expect(shiftDashboard(db, '2026-11-11').loggedDays).toBe(2);
    expect(shiftDashboard(db, '2026-11-11').counts.sales).toBe(1);
  });
  it('aggregates yesterday sales by item, excluding today and future sales', () => {
    const db = fixture();
    db.sales = [{ id: '1', date: '2026-11-10', menuItemId: 'latte', quantity: 10 }, { id: '2', date: '2026-11-10', menuItemId: 'latte', quantity: 4 }, { id: '3', date: '2026-11-11', menuItemId: 'other', quantity: 100 }];
    expect(shiftDashboard(db, '2026-11-11').topSeller).toEqual({ name: 'Latte', quantity: 14 });
  });
  it('does not report zero waste when waste logs are missing; uses recorded waste value divided by sales', () => {
    const db = fixture();
    db.sales = [{ id: '1', date: '2026-11-11', menuItemId: 'latte', quantity: 10, unitPrice: 100 }];
    expect(shiftDashboard(db, '2026-11-11').wastePct).toBeNull();
    db.wasteLogs = [{ id: 'w', at: '2026-11-11', value: 20 } as WasteLog];
    expect(shiftDashboard(db, '2026-11-11').wastePct).toBe(2);
  });
  it('uses audit names and creation times for team activity and excludes future business dates', () => {
    const db = fixture();
    db.batches = [{ id: 'b', menuItemId: 'latte', producedAt: '2026-11-11', expiryDate: '2026-11-12', quantity: 12, createdByName: 'Alex', createdAt: '2026-11-11T08:00:00Z' } as Batch];
    db.sales = [{ id: 's', menuItemId: 'latte', date: '2026-11-12', quantity: 12 }];
    const activity = shiftDashboard(db, '2026-11-11').activity;
    expect(activity).toHaveLength(1);
    expect(activity[0].record.createdByName).toBe('Alex');
    expect(activity[0].at).toBe('2026-11-11T08:00:00Z');
  });
});