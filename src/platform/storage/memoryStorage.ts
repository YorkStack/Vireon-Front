// In-memory StorageLike implementations for tests (the Vitest env is `node`, so
// there is no real localStorage). Not test files themselves → not auto-run by the
// `*.test.ts` glob; imported by the store tests.
import type { StorageLike } from './keys';

export interface MemoryStorage extends StorageLike {
  dump(): Record<string, string>;
  size(): number;
}

/** A simple Map-backed StorageLike. */
export function createMemoryStorage(initial?: Record<string, string>): MemoryStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    dump: () => Object.fromEntries(map),
    size: () => map.size,
  };
}

/** A StorageLike whose setItem always throws — to test graceful write failure. */
export function createThrowingStorage(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError (simulated)');
    },
    removeItem: () => {},
  };
}
