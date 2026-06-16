import { describe, it, expect } from 'vitest';
import { FACTION_DEFS } from '../core/defs';
import { resolveUnit, templateToDef } from './unitFactory';
import { UNIT_CLASS_TEMPLATES } from '../data/unitClasses';
import {
  FACTION_MODIFIERS, getAdminEditableFactionModifierPaths, getModifierMetadata, type FactionId,
} from '../data/factionModifiers';
import { editablePaths } from '../ui/adminPanel';

const IDS: FactionId[] = ['red', 'blue', 'green', 'yellow'];
const legacy = (id: FactionId, key: string): number => (FACTION_DEFS[id].modifiers[key] ?? 1);

describe('Phase 4b.2b infantry-speed rename + migration — NO balance change', () => {
  it('1+2+3. infantry speed = base × infantrySpeed; green ×1.15, others ×1.0', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        if (t.unitClass !== 'infantry') continue;
        const baseSpeed = templateToDef(t).speed; // no speed overrides exist
        const expected = baseSpeed * legacy(id, 'infantrySpeed');
        expect(resolveUnit(classId, FACTION_DEFS[id]).speed, `${id}.${classId}.speed`).toBe(expected);
      }
    }
    // green is the only faction with the perk
    expect(legacy('green', 'infantrySpeed')).toBe(1.15);
    for (const id of ['red', 'blue', 'yellow'] as FactionId[]) expect(legacy(id, 'infantrySpeed')).toBe(1);
  });

  it('4+5. vehicles are exactly unchanged — no faction speeds up its vehicles', () => {
    for (const id of IDS) {
      for (const [classId, t] of Object.entries(UNIT_CLASS_TEMPLATES)) {
        if (t.unitClass === 'infantry') continue; // vehicles (and any non-infantry)
        const baseSpeed = templateToDef(t).speed;
        expect(resolveUnit(classId, FACTION_DEFS[id]).speed, `${id}.${classId}.speed`).toBe(baseSpeed);
      }
    }
    // green vehicles specifically must NOT get the 1.15 infantry perk
    const tankBase = templateToDef(UNIT_CLASS_TEMPLATES['mediumTank']).speed;
    expect(resolveUnit('mediumTank', FACTION_DEFS.green).speed).toBe(tankBase);
  });

  it('6+7. registry mirrors legacy infantrySpeed exactly (no double application)', () => {
    for (const id of IDS) {
      expect(FACTION_MODIFIERS[id].combat.infantrySpeed, `${id}.infantrySpeed`).toBe(legacy(id, 'infantrySpeed'));
    }
    expect(FACTION_MODIFIERS.green.combat.infantrySpeed).toBe(1.15);
    expect(FACTION_MODIFIERS.blue.combat.infantrySpeed).toBe(1.0);   // was aspirational 0.95
    expect(FACTION_MODIFIERS.yellow.combat.infantrySpeed).toBe(1.0); // was aspirational 0.98
  });
});

describe('Phase 4b.2b — metadata & deprecation', () => {
  it('8. combat.infantrySpeed live/editable; combat.unitSpeed deprecated (not live, not editable, no effect)', () => {
    const inf = getModifierMetadata('combat.infantrySpeed')!;
    expect(inf, 'combat.infantrySpeed').toBeDefined();
    expect(inf.status).toBe('live');
    expect(inf.adminEditable).toBe(true);
    expect(inf.runtimeSource).toBe('FACTION_MODIFIERS');

    // combat.unitSpeed survives only as a deprecated, read-only marker
    const dep = getModifierMetadata('combat.unitSpeed')!;
    expect(dep, 'combat.unitSpeed').toBeDefined();
    expect(dep.adminEditable).toBe(false);
    expect(dep.runtimeSource).not.toBe('FACTION_MODIFIERS');
    expect(dep.description.toLowerCase()).toContain('deprecated');

    const editable = getAdminEditableFactionModifierPaths().map((m) => m.path);
    expect(editable).toContain('combat.infantrySpeed');
    expect(editable).not.toContain('combat.unitSpeed');

    // the registry has NO unitSpeed field — proves the deprecated path has no value/effect
    expect((FACTION_MODIFIERS.green.combat as unknown as Record<string, unknown>).unitSpeed).toBeUndefined();
  });

  it('9. defense.turretDurability remains prepared (not migrated)', () => {
    expect(getModifierMetadata('defense.turretDurability')!.status).toBe('prepared');
  });

  it('10. F8 panel exposes combat.infantrySpeed but never combat.unitSpeed', () => {
    expect(editablePaths()).toContain('combat.infantrySpeed');
    expect(editablePaths()).not.toContain('combat.unitSpeed');
  });
});
