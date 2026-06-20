import { describe, it, expect } from 'vitest';
import factions from '../data/factions.json';
import { factionCardView, factionDetailsView } from './factionCardView';
import type { FactionDef } from '../core/types';

const ALL = Object.values(factions as unknown as Record<string, FactionDef>);

describe('factionCardView', () => {
  it('covers all four factions', () => {
    expect(ALL.length).toBe(4);
  });

  it('drops the misleading faction difficulty / "Anspruch" rating from the card', () => {
    for (const f of ALL) {
      const v = factionCardView(f);
      expect(v).not.toHaveProperty('difficulty');
      expect(JSON.stringify(v)).not.toMatch(/Anspruch/i);
    }
  });

  it('stays compact: no long strengths/weaknesses lists, at most 3 traits', () => {
    for (const f of ALL) {
      const v = factionCardView(f);
      expect(v).not.toHaveProperty('strengths');
      expect(v).not.toHaveProperty('weaknesses');
      expect(v.traits.length).toBeLessThanOrEqual(3);
      expect(v.name).toBeTruthy();
      expect(v.tagline).toBeTruthy(); // one identity line present
    }
  });
});

describe('factionDetailsView', () => {
  it('still exposes the long detail content for every faction', () => {
    for (const f of ALL) {
      const d = factionDetailsView(f);
      expect(d.strengths.length).toBeGreaterThan(0);
      expect(d.weaknesses.length).toBeGreaterThan(0);
      expect(d.recommendation).toBeTruthy();
      expect(d.profile).not.toBeNull();
    }
  });
});
