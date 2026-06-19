// Local id + timestamp helpers for the offline data layer. Uses crypto.randomUUID
// when available (browsers, Node 18+), with a timestamp+random fallback. These
// ids are LOCAL ONLY — no security/uniqueness guarantees beyond one device.

/** A locally-unique id, e.g. a UUID or `local_<ts>_<rand>`. */
export function newId(prefix = 'local'): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    /* fall through to manual id */
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Current time as an ISO string. */
export function nowIso(): string {
  return new Date().toISOString();
}
