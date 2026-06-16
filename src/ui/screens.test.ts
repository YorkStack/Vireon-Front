// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { showBriefing } from './screens';
import type { FactionDef, MissionDef } from '../core/types';

const mission = {
  name: 'Foothold', briefing: 'Establish a foothold.', objectives: ['Destroy the enemy Nexus'],
} as unknown as MissionDef;

const verdant: FactionDef = {
  id: 'green', name: 'Verdant Swarm', color: '#2ecc40', emissive: '#49e85d', tagline: 'We are many.',
  perks: [], modifiers: {}, defaultDoctrineId: 'verdant_hive_expander',
  tactical: {
    doctrineLabel: 'Swarm Consumption Doctrine', build: 'Sehr schnell', attack: 'Unerbittlich',
    defense: 'Schwach', economy: 'Ressourcenhungrig', difficulty: 'Aggressiv', shortDescription: '…',
  },
  strengths: [], weaknesses: [],
};

describe('briefing: faction tactical profile (not a per-match player doctrine)', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

  it('shows the FACTION tactical profile and no player "Doktrin:" choice', () => {
    void showBriefing(mission, verdant); // resolves on launch click; we only inspect the DOM
    const text = document.getElementById('ui-root')!.textContent || '';
    expect(text).toContain('COMMANDING: Verdant Swarm');
    expect(text).toContain('Swarm Consumption Doctrine'); // the fixed faction identity label
    expect(text).toContain('Unerbittlich');               // a tactical-profile stat
    expect(text).not.toContain('Doktrin:');               // briefing must not imply a player doctrine pick
  });
});
