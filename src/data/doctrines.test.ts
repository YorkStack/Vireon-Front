import { describe, it, expect } from 'vitest';
import { DOCTRINES, DOCTRINES_BY_FACTION, DEFAULT_DOCTRINE_BY_FACTION, doctrinesFor, defaultDoctrineFor, doctrineById, randomDoctrineFor, type CommanderPersonality } from './doctrines';
import factions from './factions.json';

const FACTIONS = ['red', 'blue', 'green', 'yellow'] as const;
const EXPECTED_DEFAULTS: Record<string, string> = {
  red: 'crimson_field_marshal', blue: 'azure_shield_architect',
  green: 'verdant_hive_expander', yellow: 'solar_radiant_cultivator',
};
const PERSONALITY_KEYS: (keyof CommanderPersonality)[] = [
  'buildAggression', 'attackAggression', 'defensePriority', 'economyPriority', 'techPriority',
  'expansionPriority', 'riskTolerance', 'repairPriority', 'retreatThreshold', 'harassmentPreference',
  'staticDefensePreference', 'unitReplacementBias', 'powerDependencyTolerance',
];

describe('doctrine library (12 total, 3 per faction)', () => {
  it('has exactly 12 doctrines, 3 per faction', () => {
    expect(Object.keys(DOCTRINES)).toHaveLength(12);
    for (const f of FACTIONS) expect(DOCTRINES_BY_FACTION[f]).toHaveLength(3);
  });

  it('every listed id exists and is tagged with its faction', () => {
    for (const f of FACTIONS) {
      for (const id of DOCTRINES_BY_FACTION[f]) {
        const d = DOCTRINES[id];
        expect(d, `${id} missing`).toBeDefined();
        expect(d.faction).toBe(f);
        expect(d.uiName.length).toBeGreaterThan(0);
      }
    }
  });

  it('personality knobs are all within 0..1', () => {
    for (const d of Object.values(DOCTRINES)) {
      for (const k of PERSONALITY_KEYS) {
        expect(d.personality[k], `${d.id}.${k}`).toBeGreaterThanOrEqual(0);
        expect(d.personality[k], `${d.id}.${k}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('army mixes (when present) sum to roughly 1', () => {
    for (const d of Object.values(DOCTRINES)) {
      if (!d.armyMix) continue;
      const sum = d.armyMix.reduce((s, [, w]) => s + w, 0);
      expect(sum, `${d.id} armyMix sum`).toBeGreaterThan(0.9);
      expect(sum, `${d.id} armyMix sum`).toBeLessThan(1.1);
    }
  });

  it('each faction has exactly one default doctrine, belonging to that faction', () => {
    for (const f of FACTIONS) {
      const def = defaultDoctrineFor(f);
      expect(def.id).toBe(EXPECTED_DEFAULTS[f]);
      expect(def.faction).toBe(f);
      expect(DEFAULT_DOCTRINE_BY_FACTION[f]).toBe(EXPECTED_DEFAULTS[f]);
    }
  });

  it('factions.json mirrors the default doctrine ids (data model in sync)', () => {
    for (const f of FACTIONS) {
      expect((factions as Record<string, { defaultDoctrineId: string }>)[f].defaultDoctrineId)
        .toBe(EXPECTED_DEFAULTS[f]);
    }
  });

  it('each faction has exactly one fixed Tactical Profile (with a doctrineLabel)', () => {
    for (const f of FACTIONS) {
      const tp = (factions as Record<string, { tactical?: { doctrineLabel: string } }>)[f].tactical;
      expect(tp, `${f} tactical`).toBeDefined();
      expect(tp!.doctrineLabel.length).toBeGreaterThan(0);
    }
  });

  it('randomDoctrineFor only ever returns a doctrine of the requested faction', () => {
    for (const f of FACTIONS) {
      const ids = new Set(DOCTRINES_BY_FACTION[f]);
      // sweep the whole [0,1) range so every list slot is hit
      for (let i = 0; i < 60; i++) {
        const d = randomDoctrineFor(f, () => i / 60);
        expect(d.faction).toBe(f);
        expect(ids.has(d.id)).toBe(true);
      }
    }
  });

  it('doctrineById resolves + falls back to the faction default', () => {
    expect(doctrineById('crimson_siege', 'red').id).toBe('crimson_siege');
    expect(doctrineById(undefined, 'green').id).toBe('verdant_hive_expander'); // fallback to default
    expect(doctrineById('nonexistent', 'blue').id).toBe('azure_shield_architect'); // fallback
  });
});
