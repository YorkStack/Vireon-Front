import { describe, it, expect } from 'vitest';
import {
  APPROVAL_ASSETS, APPROVAL_FACTIONS, approvalAssetsForFaction,
  defaultApprovalRecord, APPROVAL_CHECKLIST_ITEMS,
} from './buildingApprovalRegistry';
import { analyzeGltf, GLASS_HINT, type GltfJson } from './glbInspect';
import { BUILDING_ASSETS } from '../data/buildingAssets';
import { ACTIVE_ASSET_ROLES } from '../render/buildingGlb';
import buildings from '../data/buildings.json';

describe('approval registry — coverage + safe defaults', () => {
  it('lists every registered building GLB (all factions)', () => {
    expect(APPROVAL_ASSETS.length).toBe(BUILDING_ASSETS.length);
    const keys = new Set(APPROVAL_ASSETS.map(a => a.assetKey));
    for (const a of BUILDING_ASSETS) expect(keys.has(a.assetKey)).toBe(true);
  });

  it('each faction has its hq + power + defense assets', () => {
    for (const f of APPROVAL_FACTIONS) {
      const roles = approvalAssetsForFaction(f.id).map(a => a.role).sort();
      expect(roles).toEqual(['defense', 'hq', 'power']);
    }
  });

  it('every asset defaults to PENDING with an all-unchecked checklist', () => {
    for (const a of APPROVAL_ASSETS) {
      const rec = defaultApprovalRecord(a);
      expect(rec.status).toBe('PENDING');
      expect(Object.values(rec.checklist).every(v => v === false)).toBe(true);
      expect(Object.keys(rec.checklist).length).toBe(APPROVAL_CHECKLIST_ITEMS.length);
    }
  });

  it('NO asset ever defaults to YES', () => {
    expect(APPROVAL_ASSETS.some(a => defaultApprovalRecord(a).status === 'YES')).toBe(false);
  });

  it('approval assets carry NO gameplay numbers (no cost/hp/power/buildTime)', () => {
    const forbidden = ['cost', 'hp', 'power', 'buildTime', 'damage', 'range'];
    for (const a of APPROVAL_ASSETS as unknown as Record<string, unknown>[]) {
      for (const k of forbidden) expect(k in a).toBe(false);
    }
  });
});

describe('glbInspect — material / glass / hierarchy analysis', () => {
  const gltf: GltfJson = {
    meshes: [
      { primitives: [{ material: 0 }] }, // uses mat 0
      { primitives: [{}] },              // a mesh WITHOUT material
    ],
    materials: [
      { name: 'Aqua_Glass', alphaMode: 'BLEND', emissiveFactor: [0, 1, 1] }, // glass, used, transparent, emissive
      { name: 'Unused_Steel' },                                              // not referenced
    ],
    nodes: [
      { name: 'ATTACH_turret_pivot', children: [] }, // empty marker
      { name: 'Body', mesh: 0 },
    ],
    textures: [],
    images: [],
  };
  const r = analyzeGltf(gltf);

  it('detects mesh-assigned vs unused materials', () => {
    expect(r.materials[0].assignedToMesh).toBe(true);
    expect(r.materials[1].assignedToMesh).toBe(false);
    expect(r.unusedMaterials).toContain('Unused_Steel');
  });

  it('detects meshes without a material', () => {
    expect(r.meshesWithoutMaterial).toBe(1);
  });

  it('distinguishes glass found / assigned / transparent', () => {
    expect(r.glass.found).toBe(true);
    expect(r.glass.assignedToMesh).toBe(true);
    expect(r.glass.transparent).toBe(true);
    expect(GLASS_HINT.test('Aqua_Glass')).toBe(true);
    expect(GLASS_HINT.test('Concrete')).toBe(false);
  });

  it('flags an empty ATTACH_turret_pivot (geometry not parented)', () => {
    expect(r.turretPivotHasChildren).toBe(false);
    expect(r.attachNodes).toContain('ATTACH_turret_pivot');
  });

  it('reports null pivot when there is no turret pivot node', () => {
    expect(analyzeGltf({ nodes: [{ name: 'Body', mesh: 0 }] }).turretPivotHasChildren).toBeNull();
  });
});

describe('runtime safety — nothing was activated', () => {
  it('ACTIVE_ASSET_ROLES is still exactly {power, hq}', () => {
    expect([...ACTIVE_ASSET_ROLES].sort()).toEqual(['hq', 'power']);
    expect(ACTIVE_ASSET_ROLES.has('defense')).toBe(false);
    expect(ACTIVE_ASSET_ROLES.has('resource')).toBe(false);
    expect(ACTIVE_ASSET_ROLES.has('production')).toBe(false);
  });

  it('gameplay config (buildings.json) is unchanged — spot stats intact', () => {
    const b = buildings as Record<string, { cost: number; power: number }>;
    expect(b.nexus.cost).toBe(2000);
    expect(b.spire.power).toBe(50);
    expect(b.cannon.cost).toBe(500);
    expect(b.lance.power).toBe(-20);
  });
});
