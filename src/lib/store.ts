/**
 * Offline-first store. All data lives in IndexedDB on the device and is
 * synced to Lovable Cloud (public.records) with Last-Write-Wins on updated_at.
 */
import { useSyncExternalStore } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { COLLECTIONS, type CollectionName, type Collections } from "./types";
import { buildSeed } from "./seed";

interface Rec<T = unknown> {
  data: T;
  updated_at: string;
  deleted?: boolean;
}
type Tables = { [K in CollectionName]: Record<string, Rec<Collections[K]>> };

interface Persisted {
  tables: Tables;
  pending: string[]; // "collection|id"
  lastPull: string | null;
  seeded: boolean;
}

export interface DBView {
  ready: boolean;
  ingredients: Collections["ingredients"][];
  purchases: Collections["purchases"][];
  usages: Collections["usages"][];
  menuItems: Collections["menuItems"][];
  batches: Collections["batches"][];
  sales: Collections["sales"][];
  wasteLogs: Collections["wasteLogs"][];
  pendingCollections: Set<CollectionName>;
  online: boolean;
}

const emptyTables = (): Tables =>
  Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as Tables;

let userId: string | null = null;
let state: Persisted = { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
let ready = false;
let online = typeof navigator !== "undefined" ? navigator.onLine : true;
let view: DBView = computeView();
const listeners = new Set<() => void>();
let syncing = false;

function computeView(): DBView {
  const v = { ready, online, pendingCollections: new Set<CollectionName>() } as DBView;
  for (const c of COLLECTIONS) {
    (v as unknown as Record<string, unknown[]>)[c] = Object.values(state.tables[c])
      .filter((r) => !r.deleted)
      .map((r) => r.data);
  }
  for (const p of state.pending) v.pendingCollections.add(p.split("|")[0] as CollectionName);
  return v;
}

function emit() {
  view = computeView();
  listeners.forEach((l) => l());
}

async function persist() {
  if (userId) await idbSet(`menuwise:${userId}`, state);
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverView: DBView = computeView();
export function useDB(): DBView {
  return useSyncExternalStore(subscribe, () => view, () => serverView);
}

export async function initStore(uid: string) {
  if (userId === uid && ready) return;
  userId = uid;
  const saved = await idbGet<Persisted>(`menuwise:${uid}`);
  state = saved ?? { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
  for (const c of COLLECTIONS) state.tables[c] ??= {};
  ready = true;
  emit();
  void sync();
}

export function resetStore() {
  userId = null;
  ready = false;
  state = { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
  emit();
}

export function put<K extends CollectionName>(collection: K, item: Collections[K] & { id: string }) {
  (state.tables[collection] as Record<string, Rec>)[item.id] = { data: item, updated_at: new Date().toISOString() };
  const key = `${collection}|${item.id}`;
  if (!state.pending.includes(key)) state.pending.push(key);
  emit();
  void persist().then(() => sync());
}

export function remove(collection: CollectionName, id: string) {
  const r = state.tables[collection][id];
  if (!r) return;
  r.deleted = true;
  r.updated_at = new Date().toISOString();
  const key = `${collection}|${id}`;
  if (!state.pending.includes(key)) state.pending.push(key);
  emit();
  void persist().then(() => sync());
}

export async function sync(): Promise<void> {
  if (!userId || syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;
  try {
    // Pull remote changes (LWW merge)
    let q = supabase.from("records").select("id,collection,data,deleted,updated_at").order("updated_at").limit(5000);
    if (state.lastPull) q = q.gt("updated_at", state.lastPull);
    const { data: rows, error } = await q;
    if (error) throw error;
    let maxTs = state.lastPull;
    for (const row of rows ?? []) {
      const c = row.collection as CollectionName;
      if (!state.tables[c]) continue;
      const local = state.tables[c][row.id];
      if (!local || local.updated_at < row.updated_at) {
        state.tables[c][row.id] = { data: row.data as never, updated_at: row.updated_at, deleted: row.deleted };
        state.pending = state.pending.filter((p) => p !== `${c}|${row.id}`);
      }
      if (!maxTs || row.updated_at > maxTs) maxTs = row.updated_at;
    }
    state.lastPull = maxTs;

    // No demo data: start with a clean slate
    if (!state.seeded) {
      state.seeded = true;
      emit();
    }

    // Push pending
    if (state.pending.length) {
      const batch = state.pending.slice();
      const payload = batch.map((key) => {
        const [c, id] = key.split("|") as [CollectionName, string];
        const r = state.tables[c][id];
        return { id, collection: c, user_id: userId!, data: r.data as never, deleted: !!r.deleted, updated_at: r.updated_at };
      });
      for (let i = 0; i < payload.length; i += 500) {
        const { error: e } = await supabase.from("records").upsert(payload.slice(i, i + 500), { onConflict: "user_id,collection,id" });
        if (e) throw e;
      }
      state.pending = state.pending.filter((p) => !batch.includes(p));
    }
    await persist();
    emit();
  } catch (e) {
    console.warn("Sync deferred:", e);
  } finally {
    syncing = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    online = true;
    emit();
    void sync();
  });
  window.addEventListener("offline", () => {
    online = false;
    emit();
  });
  setInterval(() => void sync(), 60000);
}
