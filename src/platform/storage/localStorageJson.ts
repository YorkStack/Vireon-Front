// Safe JSON read/write over a StorageLike. Every failure path is swallowed so a
// corrupted or unavailable store can NEVER crash the game — reads fall back to a
// provided default, writes report success as a boolean.
import type { StorageLike } from './keys';

/** Parse `key` as JSON; return `fallback` on missing key, corrupt JSON, or error. */
export function readJson<T>(storage: StorageLike | null, key: string, fallback: T): T {
  if (!storage) return fallback;
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return fallback; // getItem can throw in restricted environments
  }
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw) as T | null | undefined;
    return parsed == null ? fallback : parsed; // keep false/0/"" but not null/undefined
  } catch {
    return fallback; // corrupted JSON → fallback, never throw
  }
}

/** Stringify + persist `value`. Returns false on quota/serialize/access errors. */
export function writeJson(storage: StorageLike | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false; // QuotaExceeded / circular / access denied → graceful no-op
  }
}

/** Remove a key. Never throws. */
export function removeKey(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}
