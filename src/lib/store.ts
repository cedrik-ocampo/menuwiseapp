/**
 * Offline-first store. All data lives in IndexedDB on the device and is
 * synced to Lovable Cloud (public.records) with Last-Write-Wins on updated_at.
 * Data is shared per café workspace; every write records who/when and edits
 * append a change log entry.
 */
import { useSyncExternalStore } from "react";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { COLLECTIONS, type Audit, type CollectionName, type Collections, type FieldChange } from "./types";

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
  changeLogs: Collections["changeLogs"][];
  insightResponses: Collections["insightResponses"][];
  pendingCollections: Set<CollectionName>;
  online: boolean;
}

const emptyTables = (): Tables =>
  Object.fromEntries(COLLECTIONS.map((c) => [c, {}])) as unknown as Tables;

let userId: string | null = null;
let userName = "";
let workspaceId: string | null = null;
let state: Persisted = { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
let ready = false;
let online = typeof navigator !== "undefined" ? navigator.onLine : true;
let view: DBView = computeView();
const listeners = new Set<() => void>();
let syncing = false;

function computeView(): DBView {
  const v = { ready, online, pendingCollections: new Set<CollectionName>() } as DBView;
  for (const c of COLLECTIONS) {
    (v as unknown as Record<string, unknown[]>)[c] = Object.values(state.tables[c] ?? {})
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

const storeKey = () => `menuwise:ws:${workspaceId}`;
async function persist() {
  if (workspaceId) await idbSet(storeKey(), state);
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const serverView: DBView = computeView();
export function useDB(): DBView {
  return useSyncExternalStore(subscribe, () => view, () => serverView);
}

export function currentWorkspace() {
  return workspaceId;
}
export function currentUser() {
  return { id: userId, name: userName };
}

/** Resolve (or create / join via invite) the user's café workspace. Cached for offline use. */
async function resolveWorkspace(uid: string, display: string, cafe: string): Promise<string | null> {
  const cacheKey = `menuwise:wsid:${uid}`;
  if (typeof navigator === "undefined" || navigator.onLine) {
    const { data, error } = await supabase.rpc("ensure_workspace", { _name: cafe, _display: display });
    if (!error && data) {
      localStorage.setItem(cacheKey, data as string);
      return data as string;
    }
    console.warn("Workspace lookup deferred:", error);
  }
  return localStorage.getItem(cacheKey);
}

export async function initStore(uid: string, display: string, cafe = "My Café") {
  if (userId === uid && ready) return;
  userId = uid;
  userName = display;
  const ws = await resolveWorkspace(uid, display, cafe);
  if (!ws) {
    // first sign-in offline: nothing to show yet
    workspaceId = null;
    ready = true;
    emit();
    return;
  }
  workspaceId = ws;
  const saved = await idbGet<Persisted>(storeKey());
  state = saved ?? { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
  for (const c of COLLECTIONS) state.tables[c] ??= {};
  ready = true;
  emit();
  void sync();
}

export function resetStore() {
  userId = null;
  workspaceId = null;
  ready = false;
  state = { tables: emptyTables(), pending: [], lastPull: null, seeded: false };
  emit();
}

const AUDIT_KEYS = new Set(["createdBy", "createdByName", "createdAt", "updatedBy", "updatedByName", "updatedAt", "image"]);

function diff(a: Record<string, unknown>, b: Record<string, unknown>): FieldChange[] {
  const out: FieldChange[] = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (AUDIT_KEYS.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push({ field: k, from: a[k], to: b[k] });
  }
  if (JSON.stringify(a.image) !== JSON.stringify(b.image)) out.push({ field: "image", from: a.image ? "photo" : "none", to: b.image ? "new photo" : "none" });
  return out;
}

function raw<K extends CollectionName>(collection: K, item: Collections[K] & { id: string }) {
  (state.tables[collection] as Record<string, Rec>)[item.id] = { data: item, updated_at: new Date().toISOString() };
  const key = `${collection}|${item.id}`;
  if (!state.pending.includes(key)) state.pending.push(key);
}

function logChange(collection: CollectionName, recordId: string, action: "created" | "edited" | "deleted", changes: FieldChange[]) {
  const at = new Date().toISOString();
  raw("changeLogs", {
    id: `${collection}-${recordId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    collection,
    recordId,
    action,
    at,
    by: userId ?? "",
    byName: userName,
    changes,
  });
}

const TRACKED: CollectionName[] = ["ingredients", "purchases", "usages", "menuItems", "batches", "sales", "wasteLogs"];

export function put<K extends CollectionName>(collection: K, item: Collections[K] & { id: string }) {
  const prev = state.tables[collection][item.id];
  const existing = prev && !prev.deleted ? (prev.data as unknown as Record<string, unknown> & Audit) : undefined;
  const now = new Date().toISOString();
  let next = item as unknown as Record<string, unknown> & Audit;
  if (TRACKED.includes(collection)) {
    next = existing
      ? { ...next, createdBy: existing.createdBy, createdByName: existing.createdByName, createdAt: existing.createdAt, updatedBy: userId ?? "", updatedByName: userName, updatedAt: now }
      : { ...next, createdBy: userId ?? "", createdByName: userName, createdAt: now };
    if (existing) {
      const ch = diff(existing, next);
      if (!ch.length) return;
      logChange(collection, item.id, "edited", ch);
    } else logChange(collection, item.id, "created", []);
  }
  raw(collection, next as never);
  emit();
  void persist().then(() => sync());
}

export function getView(): DBView {
  return view;
}

/** Bulk-write records (one change-log entry per record), emitting once. */
export function putMany(entries: { collection: CollectionName; item: { id: string } }[]) {
  const now = new Date().toISOString();
  for (const { collection, item } of entries) {
    const next = TRACKED.includes(collection)
      ? { ...item, createdBy: userId ?? "", createdByName: userName, createdAt: now }
      : item;
    if (TRACKED.includes(collection)) logChange(collection, item.id, "created", []);
    raw(collection, next as never);
  }
  emit();
  void persist().then(() => sync());
}

/** Soft-delete every record in the given collections, emitting once. */
export function clearCollections(collections: CollectionName[]) {
  const now = new Date().toISOString();
  for (const c of collections) {
    for (const [id, r] of Object.entries(state.tables[c])) {
      if (r.deleted) continue;
      r.deleted = true;
      r.updated_at = now;
      const key = `${c}|${id}`;
      if (!state.pending.includes(key)) state.pending.push(key);
    }
  }
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
  if (TRACKED.includes(collection)) logChange(collection, id, "deleted", []);
  emit();
  void persist().then(() => sync());
}

export async function sync(): Promise<void> {
  if (!userId || !workspaceId || syncing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  syncing = true;
  const ws = workspaceId;
  try {
    let q = supabase.from("records").select("id,collection,data,deleted,updated_at").eq("workspace_id", ws).order("updated_at").limit(5000);
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
    state.seeded = true;

    if (state.pending.length) {
      const batch = state.pending.slice();
      const payload = batch.map((key) => {
        const [c, id] = key.split("|") as [CollectionName, string];
        const r = state.tables[c][id];
        return { id, collection: c, user_id: userId!, workspace_id: ws, data: r.data as never, deleted: !!r.deleted, updated_at: r.updated_at };
      });
      for (let i = 0; i < payload.length; i += 500) {
        const { error: e } = await supabase.from("records").upsert(payload.slice(i, i + 500), { onConflict: "workspace_id,collection,id" });
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
