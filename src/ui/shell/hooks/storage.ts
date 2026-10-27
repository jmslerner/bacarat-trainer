/**
 * localStorage persistence under `bt:` keys — the one place the shell (and other modules)
 * touch storage. Every read/write is wrapped in try/catch: private mode, quota errors and
 * disabled storage degrade to in-memory behaviour, never to a crash.
 *
 * `createPersistedStore` is a tiny external store (get/set/subscribe) usable outside React
 * (e.g. the GameSession singleton reads the persisted rules) and inside React through
 * `useStore` / `useLocalStorage` with `useSyncExternalStore`.
 */
import { useCallback, useSyncExternalStore } from 'react';

export const STORAGE_PREFIX = 'bt:';

/** Ensures a key carries the `bt:` prefix exactly once. */
export function storageKey(key: string): string {
  return key.startsWith(STORAGE_PREFIX) ? key : STORAGE_PREFIX + key;
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Raw string under `bt:<key>` or null (missing / storage unavailable). */
export function readRaw(key: string): string | null {
  try {
    const s = getStorage();
    return s ? s.getItem(storageKey(key)) : null;
  } catch {
    return null;
  }
}

/** Write a raw string (null removes the key). Returns false when storage is unavailable. */
export function writeRaw(key: string, raw: string | null): boolean {
  try {
    const s = getStorage();
    if (!s) return false;
    if (raw === null) s.removeItem(storageKey(key));
    else s.setItem(storageKey(key), raw);
    return true;
  } catch {
    return false;
  }
}

/** Parse JSON from storage; `fallback` on missing/invalid; `validate` can reject stale shapes. */
export function readStorage<T>(key: string, fallback: T, validate?: (value: unknown) => value is T): T {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): boolean {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function removeStorage(key: string): void {
  writeRaw(key, null);
}

/* ---------------------------------------------------------------------------------------- */

export interface Store<T> {
  /** Full storage key, including the `bt:` prefix. */
  readonly key: string;
  get(): T;
  set(value: T | ((prev: T) => T)): void;
  /** Shallow-merge a patch (object stores only). */
  update(patch: Partial<T>): void;
  /** Back to the defaults and remove the key from storage. */
  reset(): void;
  subscribe(listener: (value: T) => void): () => void;
}

export interface StoreOptions<T> {
  /** Normalise whatever was persisted (possibly by an older version) into a valid T. */
  sanitize?: (raw: unknown, defaults: T) => T;
}

interface StoreEntry<T> {
  store: Store<T>;
  defaults: T;
  sanitize?: (raw: unknown, defaults: T) => T;
  listeners: Set<(value: T) => void>;
  value: T;
  raw: string | null;
}

const registry = new Map<string, StoreEntry<unknown>>();
let storageEventBound = false;

/** Cross-tab sync: another tab wrote one of our keys. */
function bindStorageEvent(): void {
  if (storageEventBound || typeof window === 'undefined') return;
  storageEventBound = true;
  try {
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
      const entry = registry.get(e.key);
      if (!entry || e.newValue === entry.raw) return;
      hydrate(entry, e.newValue);
      for (const l of entry.listeners) l(entry.value);
    });
  } catch {
    /* ignore */
  }
}

function hydrate<T>(entry: StoreEntry<T>, raw: string | null): void {
  entry.raw = raw;
  if (raw === null) {
    entry.value = entry.defaults;
    return;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    entry.value = entry.sanitize ? entry.sanitize(parsed, entry.defaults) : (parsed as T);
  } catch {
    entry.value = entry.defaults;
  }
}

/**
 * Create (or retrieve) the persisted store for `key`. A key maps to exactly one store, so every
 * component/hook using the same key shares one source of truth and re-renders together.
 * (The `defaults`/`sanitize` of the first creation win.)
 */
export function createPersistedStore<T>(key: string, defaults: T, options: StoreOptions<T> = {}): Store<T> {
  const fullKey = storageKey(key);
  const existing = registry.get(fullKey);
  if (existing) return existing.store as Store<T>;

  const entry: StoreEntry<T> = {
    store: undefined as unknown as Store<T>,
    defaults,
    sanitize: options.sanitize,
    listeners: new Set(),
    value: defaults,
    raw: null,
  };
  const emit = (): void => {
    for (const l of entry.listeners) l(entry.value);
  };

  const store: Store<T> = {
    key: fullKey,
    get: () => entry.value,
    set: (next) => {
      const value = typeof next === 'function' ? (next as (prev: T) => T)(entry.value) : next;
      if (Object.is(value, entry.value)) return;
      entry.value = value;
      let raw: string | null = null;
      try {
        raw = JSON.stringify(value);
      } catch {
        raw = null;
      }
      entry.raw = raw;
      writeRaw(fullKey, raw);
      emit();
    },
    update: (patch) => {
      const prev = entry.value;
      if (prev === null || typeof prev !== 'object') return;
      store.set({ ...(prev as object), ...patch } as T);
    },
    reset: () => {
      entry.value = defaults;
      entry.raw = null;
      writeRaw(fullKey, null);
      emit();
    },
    subscribe: (listener) => {
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
  };

  entry.store = store;
  hydrate(entry, readRaw(fullKey));
  registry.set(fullKey, entry as StoreEntry<unknown>);
  bindStorageEvent();
  return store;
}

/** Forget every registered store (tests only). Does not touch localStorage itself. */
export function __resetStoresForTests(): void {
  registry.clear();
}

/** Subscribe a React component to a store. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

export type SetStored<T> = (value: T | ((prev: T) => T)) => void;

/**
 * `useState` persisted in localStorage under `bt:<key>` and shared by every user of the key
 * (same tab and other tabs). Returns [value, setValue, reset].
 */
export function useLocalStorage<T>(key: string, initial: T, options: StoreOptions<T> = {}): [T, SetStored<T>, () => void] {
  const store = createPersistedStore<T>(key, initial, options);
  const value = useStore(store);
  const set = useCallback<SetStored<T>>((v) => store.set(v), [store]);
  const reset = useCallback(() => store.reset(), [store]);
  return [value, set, reset];
}
