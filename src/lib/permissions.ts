import type { Audit, CollectionName } from './types';

export type WorkspaceRole = 'owner' | 'staff' | null;
export const DAILY_COLLECTIONS: CollectionName[] = ['batches', 'sales', 'wasteLogs'];

/** Tag on menu items added by staff on shift, so owners know to add costs or a recipe. */
export const NEEDS_REVIEW_TAG = 'needs-review';

/** Stock collections staff can manage when the owner turns on inventory access. */
export const INVENTORY_COLLECTIONS: CollectionName[] = ['ingredients', 'purchases', 'usages'];

export function mayAdd(role: WorkspaceRole, collection: CollectionName, inventory = false) {
  // Staff may also add (never edit) a missing menu item during a shift.
  if (role === 'staff' && inventory && INVENTORY_COLLECTIONS.includes(collection)) return true;
  return role === 'owner' || (role === 'staff' && (DAILY_COLLECTIONS.includes(collection) || collection === 'menuItems'));
}

export function mayEdit(role: WorkspaceRole, userId: string | null, collection: CollectionName, id: string, rows: (Audit & { id: string })[], inventory = false) {
  if (role === 'owner') return true;
  if (role === 'staff' && inventory && INVENTORY_COLLECTIONS.includes(collection)) return true;
  if (role !== 'staff' || !userId || !DAILY_COLLECTIONS.includes(collection)) return false;
  const own = rows.filter((r) => r.createdBy === userId && r.createdAt);
  const latest = own.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))[0];
  return latest?.id === id;
}