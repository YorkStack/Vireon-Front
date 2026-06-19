import { describe, it, expect } from 'vitest';
import { infantryVisualFor } from './infantryVisual';

const FACTIONS = ['red', 'blue', 'green', 'yellow'] as const;
const COVERED = ['lancer', 'breacher', 'arcweaver'] as const;

describe('infantryVisualFor', () => {
  it('returns a distinct variant key per faction for each covered infantry def', () => {
    for (const def of COVERED)
      for (const f of FACTIONS)
        expect(infantryVisualFor(def, f)).toBe(`${def}@${f}`);
  });

  it('produces four mutually distinct keys per covered def', () => {
    for (const def of COVERED) {
      const keys = FACTIONS.map((f) => infantryVisualFor(def, f));
      expect(new Set(keys).size).toBe(4);
    }
  });

  it('produces globally unique keys across all covered def × faction combos', () => {
    const keys = COVERED.flatMap((def) => FACTIONS.map((f) => infantryVisualFor(def, f)));
    expect(new Set(keys).size).toBe(COVERED.length * FACTIONS.length); // 12 unique
  });

  it('falls back (null) for an unknown faction', () => {
    for (const def of COVERED) {
      expect(infantryVisualFor(def, 'teal')).toBeNull();
      expect(infantryVisualFor(def, undefined)).toBeNull();
      expect(infantryVisualFor(def, '')).toBeNull();
    }
  });

  it('falls back (null) for non-covered infantry / other units', () => {
    expect(infantryVisualFor('fabricator', 'blue')).toBeNull();
    expect(infantryVisualFor('vanguard', 'yellow')).toBeNull();
    expect(infantryVisualFor('harvester', 'red')).toBeNull();
  });
});
