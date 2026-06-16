import { describe, it, expect } from 'vitest';
import { DOCTRINES, DOCTRINES_BY_FACTION, doctrinesFor, defaultDoctrineFor, doctrineById, type CommanderPersonality } from './doctrines';

const FACTIONS = ['red', 'blue', 'green', 'yellow'] as const;
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

  it('helpers resolve correctly', () => {
    for (const f of FACTIONS) {
      expect(doctrinesFor(f)).toHaveLength(3);
      expect(defaultDoctrineFor(f).id).toBe(DOCTRINES_BY_FACTION[f][0]);
    }
    expect(doctrineById('crimson_siege', 'red').id).toBe('crimson_siege');
    expect(doctrineById(undefined, 'green').id).toBe('verdant_brood_rusher'); // fallback to default
    expect(doctrineById('nonexistent', 'blue').id).toBe('azure_shield_architect'); // fallback
  });
});
