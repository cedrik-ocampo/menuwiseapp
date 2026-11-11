import { ImportButton } from './ImportButton';
import { put, useDB } from '@/lib/store';
import { parseProductionRows, parseSales } from '@/lib/import-parsers';
import { mergeSales } from '@/lib/import-review';
import { consumeForProduction } from '@/lib/consume';
import { addDays, todayISO } from '@/lib/format';

export function SalesImport() {
  const db = useDB();
  return <ImportButton what="sales" columns="sale_date, menu_item_id, quantity (Optional: unit_price, notes)" template={{
    filename: 'menuwise-sales-template.csv', header: ['sale_date', 'menu_item_id', 'quantity', 'unit_price', 'notes'],
    rows: (db.menuItems.length ? db.menuItems.slice(0, 3).map((m) => [m.id, m.name, String(m.retailPrice)]) : [['ML-001', 'Spanish Latte', '180'], ['PS-002', 'Almond Croissant', '145'], ['CK-003', 'Matcha Cheesecake', '195']]).map(([id, name, price], i) => [addDays(todayISO(), -i), id, String(12 - i * 4), price, i === 0 ? `Example: ${name}` : '']),
  }} parse={(rows) => parseSales(rows, db)} allowMerge fields={{ menuitemid: { options: db.menuItems.map((m) => m.id), labels: Object.fromEntries(db.menuItems.map((m) => [m.id, m.name])) }, saledate: { type: 'date' }, quantity: { type: 'number' }, unitprice: { type: 'number' } }} commit={(items, merges = []) => { const result = mergeSales(db.sales, items, merges); result.filter((sale) => !db.sales.includes(sale)).forEach((sale) => put('sales', sale)); }} />;
}

export function ProductionImport() {
  const db = useDB();
  return <ImportButton what="production entries" columns="Menu_Item_ID, quantity, producedAt, expiryDate (Batch_ID optional)" className="h-9 px-3" fields={{ menuitemid: { options: db.menuItems.map((m) => m.id), labels: Object.fromEntries(db.menuItems.map((m) => [m.id, m.name])) }, producedat: { type: 'date' }, expirydate: { type: 'date' }, quantity: { type: 'number' } }} parse={(rows) => parseProductionRows(rows, db)} commit={(items) => items.forEach((b) => {
    put('batches', b);
    const m = db.menuItems.find((x) => x.id === b.menuItemId);
    if (m) consumeForProduction(m, b.quantity, b.producedAt.slice(0, 10), b.id);
  })} template={{ filename: 'production-template.csv', header: ['Menu_Item_ID', 'quantity', 'producedAt', 'expiryDate', 'Batch_ID', 'Note'], rows: [[db.menuItems[0]?.id ?? 'Spanish Latte', '12', todayISO(), addDays(todayISO(), 1), 'EXAMPLE-BATCH', 'Example batch']] }} />;
}