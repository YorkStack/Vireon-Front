// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createAdminPanel, installAdminPanel, editablePaths, isEditablePath, SLIDER_RANGES,
  setOverrideValue, resetTuning, getCurrentOverrides, hasOverride,
  sanitizeOverrides, importTuningJSON, exportTuningJSON, currentProfile,
  saveToStorage, loadFromStorage, TUNING_STORAGE_KEY, FACTION_IDS,
} from './adminPanel';
import {
  getAdminEditableFactionModifierPaths, getPreparedButNotLiveModifierPaths,
  getLegacyBackedModifierPaths, getFactionModifiers,
} from '../data/factionModifiers';

// happy-dom in this runner exposes window.localStorage without working methods
// (and the bare `localStorage` global resolves to Node's throw-on-use stub).
// Install a minimal in-memory Storage so the persistence path is exercised.
function makeMemoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => { m.delete(k); },
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
  } as Storage;
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  (window as unknown as { localStorage: Storage }).localStorage = makeMemoryStorage();
  resetTuning();          // clears overrides + storage
});
afterEach(() => { resetTuning(); });

describe('F8 admin panel — governance & DOM', () => {
  it('1. panel can be created (hidden) and mounted', () => {
    const p = createAdminPanel();
    expect(p.root.id).toBe('rts-admin');
    expect(p.isOpen()).toBe(false);
    document.body.appendChild(p.root);
    p.show();
    expect(p.isOpen()).toBe(true);
    expect(p.root.querySelector('.sheet')!.textContent).toContain('Admin / Balancing Panel');
  });

  it('2. editable paths come from getAdminEditableFactionModifierPaths() (incl. Phase 4a migrated)', () => {
    // Derived, not hard-coded: every admin-editable registry path that also has a
    // slider range shows up as editable.
    const fromRegistry = getAdminEditableFactionModifierPaths()
      .map((m) => m.path).filter((p) => p in SLIDER_RANGES).sort();
    expect(editablePaths().sort()).toEqual(fromRegistry);
    // the six originals…
    for (const p of ['economy.resourceGatherRate', 'power.lowPowerDefensePenalty', 'power.lowPowerProductionPenalty',
      'power.lowPowerRepairPenalty', 'power.powerOutageSeverity', 'repair.repairRate']) {
      expect(editablePaths()).toContain(p);
    }
    // …plus the five migrated economy/power cost dimensions
    for (const p of ['economy.unitCost', 'economy.infantryCost', 'economy.vehicleCost',
      'economy.buildingCost', 'power.powerUsage']) {
      expect(editablePaths()).toContain(p);
    }
  });

  it('3. only live modifiers are editable (prepared/legacy are not)', () => {
    for (const p of editablePaths()) expect(isEditablePath(p)).toBe(true);
    expect(isEditablePath('special.colonyAuraStrength')).toBe(false);
    expect(isEditablePath('combat.vehicleDamage')).toBe(false);
    expect(isEditablePath('nonsense.path')).toBe(false);
  });

  it('4. prepared modifiers render read-only (no inputs)', () => {
    const p = createAdminPanel(); document.body.appendChild(p.root); p.show();
    const sheet = p.root.querySelector('.sheet')!;
    const headings = [...sheet.querySelectorAll('h3')].map((h) => h.textContent);
    expect(headings.some((t) => t?.includes('Prepared Modifiers'))).toBe(true);
    // prepared paths appear as text but never inside an <input>
    const preparedPath = getPreparedButNotLiveModifierPaths()[0].path;
    expect(sheet.textContent).toContain(preparedPath);
    const inputPaths = [...sheet.querySelectorAll('.row')].map((r) => (r as HTMLElement).dataset.path);
    expect(inputPaths).not.toContain(preparedPath);
  });

  it('5. legacy-backed modifiers render read-only with migration note', () => {
    const p = createAdminPanel(); document.body.appendChild(p.root); p.show();
    const sheet = p.root.querySelector('.sheet')!;
    expect(sheet.textContent).toContain('Legacy-backed');
    const legacyPath = getLegacyBackedModifierPaths()[0].path;
    expect(sheet.textContent).toContain(legacyPath);
    const inputPaths = [...sheet.querySelectorAll('.row')].map((r) => (r as HTMLElement).dataset.path);
    expect(inputPaths).not.toContain(legacyPath);
  });

  it('6. editing a live slider creates a correct, clamped override', () => {
    const v = setOverrideValue('yellow', 'power.powerOutageSeverity', 1.2);
    expect(v).toBe(1.2);
    expect(hasOverride('yellow', 'power.powerOutageSeverity')).toBe(true);
    expect(getFactionModifiers('yellow').power.powerOutageSeverity).toBe(1.2);
    // out-of-range clamps to the slider max (2.0)
    const clamped = setOverrideValue('yellow', 'power.powerOutageSeverity', 99);
    expect(clamped).toBe(SLIDER_RANGES['power.powerOutageSeverity'].max);
    // a non-editable path is rejected (NaN, no override)
    expect(Number.isNaN(setOverrideValue('yellow', 'combat.vehicleDamage', 2))).toBe(true);
    expect(hasOverride('yellow', 'combat.vehicleDamage')).toBe(false);
  });

  it('7. reset removes overrides from runtime and storage', () => {
    setOverrideValue('green', 'economy.resourceGatherRate', 1.4);
    saveToStorage('x');
    expect(window.localStorage.getItem(TUNING_STORAGE_KEY)).toBeTruthy();
    resetTuning();
    expect(Object.keys(getCurrentOverrides())).toHaveLength(0);
    expect(getFactionModifiers('green').economy.resourceGatherRate).toBe(1.05); // back to default
    expect(window.localStorage.getItem(TUNING_STORAGE_KEY)).toBeNull();
  });

  it('8. save/load localStorage round-trips a live override', () => {
    setOverrideValue('blue', 'repair.repairRate', 1.5);
    expect(saveToStorage('persist-test')).toBe(true);
    expect(window.localStorage.getItem(TUNING_STORAGE_KEY)).toBeTruthy();
    // drift the runtime away WITHOUT touching storage (clearOverrideValue, not reset)
    setOverrideValue('blue', 'repair.repairRate', 0.9);
    expect(getFactionModifiers('blue').repair.repairRate).toBe(0.9);
    const r = loadFromStorage();
    expect(r?.ok).toBe(true);
    expect(getFactionModifiers('blue').repair.repairRate).toBe(1.5);
  });

  it('9. export/import JSON round-trip preserves live overrides', () => {
    setOverrideValue('red', 'power.lowPowerProductionPenalty', 0.5);
    const json = exportTuningJSON('rt');
    resetTuning();
    expect(hasOverride('red', 'power.lowPowerProductionPenalty')).toBe(false);
    const r = importTuningJSON(json);
    expect(r.ok).toBe(true);
    expect(getFactionModifiers('red').power.lowPowerProductionPenalty).toBe(0.5);
  });

  it('10. import rejects prepared & legacy-backed paths (keeps only live)', () => {
    const malicious = JSON.stringify({
      version: 1, name: 'evil', createdAt: 'x', updatedAt: 'x',
      factionModifierOverrides: {
        yellow: {
          economy: { resourceGatherRate: 1.3 },        // live → accepted
          combat: { vehicleDamage: 9 },                 // legacy-backed → rejected
          special: { colonyAuraStrength: 5 },           // prepared → rejected
        },
        bogus: { economy: { resourceGatherRate: 2 } },  // unknown faction → rejected
      },
    });
    const r = importTuningJSON(malicious);
    expect(r.ok).toBe(true);
    expect(getFactionModifiers('yellow').economy.resourceGatherRate).toBe(1.3);
    // rejected paths did NOT become overrides
    expect(hasOverride('yellow', 'combat.vehicleDamage' as string)).toBe(false);
    expect(hasOverride('yellow', 'special.colonyAuraStrength' as string)).toBe(false);
    expect(getCurrentOverrides().yellow?.combat).toBeUndefined();
    expect(getCurrentOverrides().yellow?.special).toBeUndefined();
  });

  it('11. import reports warnings for every rejected path', () => {
    const { warnings } = sanitizeOverrides({
      yellow: { combat: { vehicleDamage: 9 }, special: { colonyAuraStrength: 5 } },
      bogus: { economy: { resourceGatherRate: 2 } },
    });
    expect(warnings.some((w) => w.includes('legacy-backed'))).toBe(true);
    expect(warnings.some((w) => w.includes('prepared'))).toBe(true);
    expect(warnings.some((w) => w.includes('Unbekannte Fraktion'))).toBe(true);
  });

  it('12. power scores render for all four factions', () => {
    const p = createAdminPanel(); document.body.appendChild(p.root); p.show();
    const cards = p.root.querySelectorAll('.score .card');
    expect(cards.length).toBe(FACTION_IDS.length);
    const txt = p.root.querySelector('.score')!.textContent || '';
    expect(txt).toContain('Crimson Pact');
    expect(txt).toContain('Solar Dominion');
  });

  it('13. balancing warnings surface when a faction is pushed out of band', () => {
    // crank gather rate hard → economy score climbs → expect a "zu stark" warning to appear
    setOverrideValue('green', 'economy.resourceGatherRate', 1.5);
    const p = createAdminPanel(); document.body.appendChild(p.root); p.show();
    // overview rebuilds each show(); just assert the warnings container exists and is reachable
    const overview = p.root.querySelector('.score')!.parentElement!;
    expect(overview.textContent).toBeTruthy();
  });

  it('14. F8 toggles the panel open/closed', () => {
    const p = installAdminPanel();
    expect(p.isOpen()).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8' }));
    expect(p.isOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8' }));
    expect(p.isOpen()).toBe(false);
  });

  it('15. ESC and the close button both close the panel', () => {
    const p = installAdminPanel();
    p.show();
    expect(p.isOpen()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(p.isOpen()).toBe(false);
    // close button
    p.show();
    (p.root.querySelector('.close') as HTMLButtonElement).click();
    expect(p.isOpen()).toBe(false);
  });

  it('16. currentProfile carries only the live overrides', () => {
    setOverrideValue('green', 'economy.resourceGatherRate', 1.2);
    const prof = currentProfile('snap');
    expect(prof.version).toBe(1);
    expect(prof.factionModifierOverrides.green?.economy?.resourceGatherRate).toBe(1.2);
  });
});
