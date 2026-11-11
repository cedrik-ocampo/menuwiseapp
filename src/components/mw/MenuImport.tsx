import { ImportButton } from './ImportButton';
import { put, useDB } from '@/lib/store';
import { CATS, EXPIRY_OPTIONS, parseMenuRows } from '@/lib/import-parsers';
import { compatibleRecipeUnits, ITEM_TYPE_LABELS } from '@/lib/menu-costing';

export function MenuImport() {
  const db = useDB();
  return <ImportButton what="menu items with recipes" columns="Menu_Item_Name, category, type, Selling_Price, Shelf_Life_Days, Expires_When"
    parse={(rows) => parseMenuRows(rows, db)} commit={(items, merges = []) => { items.forEach((item) => put('menuItems', item)); merges.forEach((item) => { const old = db.menuItems.find((m) => m.id === item.id); put('menuItems', old ? { ...old, ...item, description: item.description || old.description, tags: item.tags.length ? item.tags : old.tags, supplier: item.supplier || old.supplier } : item); }); }}
    allowMerge allowAddDuplicate={false} mergeLabel="Update existing item" mergeSummary="existing menu items to update"
    fields={{ ingredientname: { options: db.ingredients.map((i) => i.name) }, category: { options: Object.keys(CATS), allowCustom: true }, subcategory: { options: (row) => CATS[row.category] ?? [], allowCustom: true }, type: { options: Object.values(ITEM_TYPE_LABELS) }, unit: { options: (row) => compatibleRecipeUnits(db.ingredients.find((i) => i.name.toLowerCase() === (row.ingredientname || '').toLowerCase())?.unit) }, expireswhen: { options: EXPIRY_OPTIONS }, available: { options: ['true', 'false'] } }}
    template={{ filename: 'menu-items-with-recipes-template.csv', header: ['Menu_Item_Name', 'Category', 'Subcategory', 'Type', 'Selling_Price', 'Batch_Yield', 'Batch_Purchase_Price', 'Pieces_Per_Batch', 'Ingredient_Name', 'Amount', 'Unit', 'Shelf_Life_Days', 'Expires_When', 'Description', 'Tags', 'Supplier', 'Available'], rows: [
      ['Chocolate Croissant', 'Pastry', 'Croissants & Danishes', 'Batch-made item', '120', '12', '', '', 'Flour', '500', 'g', '2', 'After the shelf life', '', '', '', 'true'],
      ['Chocolate Croissant', 'Pastry', 'Croissants & Danishes', 'Batch-made item', '120', '12', '', '', 'Butter', '250', 'g', '2', 'After the shelf life', '', '', '', 'true'],
      ['Purchased Cookie', 'Pastry', '', 'Outsourced item', '80', '', '500', '10', '', '', '', '3', 'After the shelf life', '', '', 'Example supplier', 'true'],
    ] }} />;
}
