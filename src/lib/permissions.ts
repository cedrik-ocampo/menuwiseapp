import type { Audit, CollectionName } from './types';

export type WorkspaceRole = 'owner' | 'staff' | null;
export const DAILY_COLLECTIONS: CollectionName[] = ['batches', 'sales', 'wasteLogs'];

export function mayAdd(role: WorkspaceRole, collection: CollectionName) {
  return role === 'owner' || (role === 'staff' && DAILY_COLLECTIONS.includes(collection));
}

export function mayEdit(role: WorkspaceRole, userId: string | null, collection: CollectionName, id: string, rows: (Audit & { id: string })[]) {
  if (role === 'owner') return true;
  if (role !== 'staff' || !userId || !DAILY_COLLECTIONS.includes(collection)) return false;
  const own = rows.filter((r) => r.createdBy === userId && r.createdAt);
  const latest = own.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || b.id.localeCompare(a.id))[0];
  return latest?.id === id;
}