import { describe, it, expect } from 'vitest';
import { readJson, writeJson, removeKey } from './localStorageJson';
import { createMemoryStorage, createThrowingStorage } from './memoryStorage';

describe('safe JSON storage helpers', () => {
  it('returns the fallback for a missing key', () => {
    const s = createMemoryStorage();
    expect(readJson(s, 'nope', { a: 1 })).toEqual({ a: 1 });
  });

  it('round-trips a value', () => {
    const s = createMemoryStorage();
    expect(writeJson(s, 'k', { x: 5, y: [1, 2] })).toBe(true);
    expect(readJson(s, 'k', null)).toEqual({ x: 5, y: [1, 2] });
  });

  it('keeps falsy values (false/0/"") but not null/undefined', () => {
    const s = createMemoryStorage({ a: 'false', b: '0', c: '""', d: 'null' });
    expect(readJson(s, 'a', 'fb')).toBe(false);
    expect(readJson(s, 'b', 'fb')).toBe(0);
    expect(readJson(s, 'c', 'fb')).toBe('');
    expect(readJson(s, 'd', 'fb')).toBe('fb'); // stored null → fallback
  });

  it('returns the fallback for corrupted JSON instead of throwing', () => {
    const s = createMemoryStorage({ bad: '{not json' });
    expect(() => readJson(s, 'bad', [])).not.toThrow();
    expect(readJson(s, 'bad', [])).toEqual([]);
  });

  it('writeJson returns false (no throw) when setItem fails', () => {
    const s = createThrowingStorage();
    expect(() => writeJson(s, 'k', { a: 1 })).not.toThrow();
    expect(writeJson(s, 'k', { a: 1 })).toBe(false);
  });

  it('treats a null storage as unavailable (read→fallback, write→false)', () => {
    expect(readJson(null, 'k', 42)).toBe(42);
    expect(writeJson(null, 'k', 1)).toBe(false);
    expect(() => removeKey(null, 'k')).not.toThrow();
  });

  it('removeKey deletes the value', () => {
    const s = createMemoryStorage({ k: '1' });
    removeKey(s, 'k');
    expect(s.getItem('k')).toBeNull();
  });
});
