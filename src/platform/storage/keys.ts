// Central localStorage keys + a tiny storage abstraction for the local-only
// Commander Profile data layer (MVP 1). NOT authentication, NOT a backend — just
// an offline save container. Hidden behind `StorageLike` so the implementation
// can later migrate to IndexedDB or an online adapter without touching callers.

export const STORAGE_KEYS = {
  commanderProfile: 'vireon.commanderProfile',
  campaignProgress: 'vireon.campaignProgress',
  localScores: 'vireon.localScores',
  settings: 'vireon.settings',
} as const;

/** Minimal surface of Web Storage — lets tests inject in-memory storage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * The browser `localStorage` if it exists and is reachable, else `null`.
 * Access can throw (privacy mode / disabled storage) or be undefined (Node, SSR,
 * the Vitest `node` env) — all handled by returning `null` so nothing crashes.
 */
export function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage as StorageLike;
  } catch {
    /* localStorage access denied → treat as unavailable */
  }
  return null;
}
