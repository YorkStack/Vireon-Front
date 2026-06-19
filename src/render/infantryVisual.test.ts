import { describe, it, expect } from 'vitest';
import { infantryVisualFor } from './infantryVisual';

describe('infantryVisualFor', () => {
  it('returns a distinct variant key for each faction lancer', () => {
    expect(infantryVisualFor('lancer', 'red')).toBe('lancer@red');     // Crimson (human Iron Guard)
    expect(infantryVisualFor('lancer', 'blue')).toBe('lancer@blue');   // Azure (Shellwalker)
    expect(infantryVisualFor('lancer', 'green')).toBe('lancer@green'); // Verdant (Brood Skirmisher)
    expect(infantryVisualFor('lancer', 'yellow')).toBe('lancer@yellow'); // Solar (Plasma Seed)
  });

  it('produces four mutually distinct keys', () => {
    const keys = ['red', 'blue', 'green', 'yellow'].map((f) => infantryVisualFor('lancer', f));
    expect(new Set(keys).size).toBe(4);
  });

  it('falls back (null) for an unknown faction', () => {
    expect(infantryVisualFor('lancer', 'teal')).toBeNull();
    expect(infantryVisualFor('lancer', undefined)).toBeNull();
    expect(infantryVisualFor('lancer', '')).toBeNull();
  });

  it('falls back (null) for non-lancer infantry / other units', () => {
    expect(infantryVisualFor('breacher', 'red')).toBeNull();
    expect(infantryVisualFor('arcweaver', 'green')).toBeNull();
    expect(infantryVisualFor('fabricator', 'blue')).toBeNull();
    expect(infantryVisualFor('vanguard', 'yellow')).toBeNull();
  });
});
