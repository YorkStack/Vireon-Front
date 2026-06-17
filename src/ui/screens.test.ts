// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { showBriefing, showStartScreen } from './screens';
import type { FactionDef, MissionDef } from '../core/types';

// Stub the campaign loader (it uses fetch, unavailable in the test env).
vi.mock('../campaign/campaign', () => ({
  loadCampaignList: async () => [
    { id: 'demo', name: 'Demo Campaign', description: 'A short demo.', missions: [{ file: 'm1.json', name: 'First Light' }] },
  ],
  loadMission: async () => ({ name: 'First Light', briefing: 'b', objectives: ['o'] }),
}));

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

describe('start screen: viewport-safe DEPLOY layout', () => {
  beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

  it('renders the DEPLOY button inside the always-visible CTA footer, not the scroll area', async () => {
    void showStartScreen();                 // resolves only on DEPLOY click; inspect the DOM
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0)); // let the mocked campaign load + DOM build settle

    const btn = document.getElementById('btn-start');
    expect(btn, 'DEPLOY button present').not.toBeNull();
    expect(btn!.textContent).toContain('DEPLOY');

    const cta = document.querySelector('.deploy-layout .screen-cta');
    const scroll = document.querySelector('.deploy-layout .screen-scroll');
    expect(cta, 'CTA footer present').not.toBeNull();
    expect(scroll, 'scrollable content present').not.toBeNull();
    // DEPLOY lives in the sticky footer, NOT in the scrollable content
    expect(cta!.contains(btn!)).toBe(true);
    expect(scroll!.contains(btn!)).toBe(false);
    // long faction/campaign content sits in the scroll area, so it can never push
    // the CTA off-screen
    expect(scroll!.querySelector('#faction-row')).not.toBeNull();
  });
});
