// Místní úložiště (IndexedDB). Každý řádek nese user_id / household_id
// a updated_at + dirty, aby šel později synchronizovat se serverem.
import { useSyncExternalStore } from 'react';

export interface Row {
  id: string;
  user_id?: string;
  household_id?: string;
  updated_at?: string;
  deleted?: boolean;
  dirty?: boolean;
  [k: string]: any;
}

const DB_NAME = 'zdravi';
const STORE = 'rows';
let db: IDBDatabase | null = null;
const data = new Map<string, Map<string, Row>>();
const cache = new Map<string, Row[]>();
const listeners = new Set<() => void>();
const EMPTY: Row[] = [];

export const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2);

export function ids() {
  let raw = localStorage.getItem('zdravi.ids');
  if (!raw) {
    raw = JSON.stringify({ user_id: uid(), household_id: uid() });
    localStorage.setItem('zdravi.ids', raw);
  }
  return JSON.parse(raw) as { user_id: string; household_id: string };
}

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function init() {
  db = await open();
  await new Promise<void>((res, rej) => {
    const r = db!.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => {
      for (const rec of r.result as { table: string; row: Row }[]) tableMap(rec.table).set(rec.row.id, rec.row);
      res();
    };
    r.onerror = () => rej(r.error);
  });
  navigator.storage?.persist?.();
}

function tableMap(table: string) {
  let m = data.get(table);
  if (!m) data.set(table, (m = new Map()));
  return m;
}

function emit(table: string) {
  cache.delete(table);
  listeners.forEach((l) => l());
}

export function all<T extends Row = Row>(table: string): T[] {
  let c = cache.get(table);
  if (!c) {
    const m = data.get(table);
    c = m ? [...m.values()].filter((r) => !r.deleted) : EMPTY;
    cache.set(table, c);
  }
  return c as T[];
}

export function get<T extends Row = Row>(table: string, id: string): T | undefined {
  const r = data.get(table)?.get(id);
  return r && !r.deleted ? (r as T) : undefined;
}

function persist(table: string, row: Row) {
  db?.transaction(STORE, 'readwrite').objectStore(STORE).put({ key: table + '/' + row.id, table, row });
}

export function put<T extends Row>(table: string, row: T): T {
  const me = ids();
  const full = {
    ...row,
    user_id: row.user_id ?? me.user_id,
    updated_at: new Date().toISOString(),
    dirty: true,
  } as T;
  tableMap(table).set(full.id, full);
  persist(table, full);
  emit(table);
  return full;
}

export function remove(table: string, id: string) {
  const r = data.get(table)?.get(id);
  if (r) put(table, { ...r, deleted: true });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useTable<T extends Row = Row>(table: string): T[] {
  return useSyncExternalStore(subscribe, () => all<T>(table));
}

export function isEmpty() {
  return data.size === 0;
}

export function exportAll() {
  const tables: Record<string, Row[]> = {};
  for (const [t, m] of data) tables[t] = [...m.values()];
  return { app: 'zdravi', version: 1, exported_at: new Date().toISOString(), tables };
}

// Seed i záloha mají stejný tvar. "me" a "home" se nahradí místním uživatelem a domácností.
export function importAll(dump: { tables: Record<string, Row[]> }) {
  const me = ids();
  for (const [table, rows] of Object.entries(dump.tables)) {
    for (const row of rows) {
      const r = { ...row };
      if (!r.user_id || r.user_id === 'me') r.user_id = me.user_id;
      if (r.household_id === 'home') r.household_id = me.household_id;
      if (r.id === 'me') r.id = me.user_id;
      put(table, r);
    }
  }
}

export async function wipe() {
  await new Promise<void>((res) => {
    const t = db!.transaction(STORE, 'readwrite');
    t.objectStore(STORE).clear();
    t.oncomplete = () => res();
  });
  data.clear();
  cache.clear();
  localStorage.removeItem('zdravi.ids');
}
