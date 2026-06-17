import { describe, it, expect } from 'vitest';
import {
  BUILDING_ASSETS, UNMAPPED_BUILDING_ASSETS, CANONICAL_FACTION,
  getBuildingAsset, defenseTowerAsset, powerPlantAsset, hqAsset,
} from './buildingAssets';
import {
  BUILDING_ROLES, BUILDING_ROLES_ALL, BUILDING_TAGS_ALL, buildingsWithTag, buildingsWithRole,
} from './buildingRoles';
import { BUILDING_DEFS } from '../core/defs';
import type { FactionId } from './factionModifiers';

const FACTIONS: FactionId[] = ['red', 'blue', 'green', 'yellow'];

describe('building roles/tags — pure metadata, valid + gameplay-neutral', () => {
  it('1+2. every classified building uses a valid role and valid tags', () => {
    for (const [id, info] of Object.entries(BUILDING_ROLES)) {
      expect(BUILDING_ROLES_ALL, `${id}.role`).toContain(info.role);
      for (const t of info.tags) expect(BUILDING_TAGS_ALL, `${id}.tag ${t}`).toContain(t);
    }
  });

  it('classification covers exactly the existing buildings (no phantom ids)', () => {
    for (const id of Object.keys(BUILDING_ROLES)) expect(BUILDING_DEFS[id], id).toBeDefined();
    for (const id of Object.keys(BUILDING_DEFS)) expect(BUILDING_ROLES[id], id).toBeDefined();
  });

  it('the two weapon turrets are role defense + tag turret; spire is the power plant', () => {
    expect(buildingsWithTag('turret').sort()).toEqual(['cannon', 'lance']);
    expect(buildingsWithRole('defense').sort()).toEqual(['cannon', 'lance', 'wall']);
    expect(BUILDING_ROLES.spire.role).toBe('power');
    expect(BUILDING_ROLES.spire.tags).toContain('powerPlant');
  });
});

describe('building asset registry — inventory only, no gameplay values', () => {
  it('3. all asset keys are unique (incl. unmapped)', () => {
    const keys = [...BUILDING_ASSETS, ...UNMAPPED_BUILDING_ASSETS].map((a) => a.assetKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('4. every modelPath ends in .glb and lives under /assets/buildings/', () => {
    for (const a of BUILDING_ASSETS) {
      expect(a.modelPath.endsWith('.glb'), a.assetKey).toBe(true);
      expect(a.modelPath.startsWith('/assets/buildings/'), a.assetKey).toBe(true);
    }
  });

  it('5. every factionId is a valid runtime faction', () => {
    for (const a of BUILDING_ASSETS) expect(FACTIONS, a.assetKey).toContain(a.factionId);
    expect(Object.keys(CANONICAL_FACTION).sort()).toEqual([...FACTIONS].sort());
  });

  it('6. defense assets have role defense + tag turret (one per faction)', () => {
    for (const id of FACTIONS) {
      const a = defenseTowerAsset(id);
      expect(a, `defense ${id}`).toBeDefined();
      expect(a!.role).toBe('defense');
      expect(a!.tags).toContain('turret');
      expect(a!.fallbackShape).toBe('turret');
    }
  });

  it('7. powerplant assets have role power + tags powerPlant + energyProducer (all four factions)', () => {
    for (const id of FACTIONS) {
      const a = powerPlantAsset(id);
      expect(a, `power ${id}`).toBeDefined();
      expect(a!.role).toBe('power');
      expect(a!.buildingId).toBe('spire');
      expect(a!.tags).toEqual(expect.arrayContaining(['powerPlant', 'energyProducer']));
      expect(a!.fallbackShape).toBe('powerPlant');
    }
    // all assets are delivered now → no unmapped gaps
    expect(UNMAPPED_BUILDING_ASSETS).toHaveLength(0);
  });

  it('7b. HQ assets have role hq + buildingId nexus (one per faction)', () => {
    for (const id of FACTIONS) {
      const a = hqAsset(id);
      expect(a, `hq ${id}`).toBeDefined();
      expect(a!.role).toBe('hq');
      expect(a!.buildingId).toBe('nexus');
      expect(a!.fallbackShape).toBe('hq');
      expect(BUILDING_DEFS.nexus).toBeDefined();
    }
  });

  it('8. the registry carries no gameplay/stat fields (purely descriptive)', () => {
    const allowed = new Set(['assetKey', 'factionId', 'buildingId', 'role', 'tags', 'modelPath', 'fallbackShape', 'sourceFileName', 'notes']);
    for (const a of BUILDING_ASSETS) {
      for (const k of Object.keys(a)) expect(allowed.has(k), `${a.assetKey}.${k}`).toBe(true);
    }
    // a linked buildingId must reference a real building, and must not be mutated
    for (const a of BUILDING_ASSETS) {
      if (a.buildingId) expect(BUILDING_DEFS[a.buildingId], a.assetKey).toBeDefined();
    }
  });

  it('getBuildingAsset resolves known keys and ignores unknown', () => {
    expect(getBuildingAsset('crimson.defense.vulcan')?.factionId).toBe('red');
    expect(getBuildingAsset('solar.defense.monolith')?.factionId).toBe('yellow');
    expect(getBuildingAsset('nope')).toBeUndefined();
  });
});
