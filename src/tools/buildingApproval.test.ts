/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import {
  APPROVAL_ASSETS, GENERATED_APPROVAL_ASSETS, ACTIVE_APPROVAL_ASSETS,
  APPROVAL_FACTIONS, approvalAssetsForFaction,
  defaultApprovalRecord, APPROVAL_CHECKLIST_ITEMS,
} from './buildingApprovalRegistry';
import { GENERATED_BUILDING_ASSETS } from './generatedBuildingAssets';
import { analyzeGltf, GLASS_HINT, type GltfJson } from './glbInspect';
import { BUILDING_ASSETS } from '../data/buildingAssets';
import { ACTIVE_ASSET_ROLES } from '../render/buildingGlb';
import buildings from '../data/buildings.json';

describe('approval registry — coverage + safe defaults', () => {
  it('has all 28 generated review assets (7 per faction)', () => {
    expect(GENERATED_APPROVAL_ASSETS.length).toBe(28);
    expect(GENERATED_BUILDING_ASSETS.length).toBe(28);
    for (const f of APPROVAL_FACTIONS) {
      expect(approvalAssetsForFaction(f.id, 'generated').length).toBe(7);
    }
  });

  it('keeps the 12 active gameplay assets reviewable too', () => {
    expect(ACTIVE_APPROVAL_ASSETS.length).toBe(BUILDING_ASSETS.length);
    expect(APPROVAL_ASSETS.length).toBe(28 + BUILDING_ASSETS.length);
    const keys = new Set(APPROVAL_ASSETS.map(a => a.assetKey));
    for (const a of BUILDING_ASSETS) expect(keys.has(a.assetKey)).toBe(true);
  });

  it('every generated asset points to an imported file on disk', () => {
    for (const a of GENERATED_BUILDING_ASSETS) {
      expect(existsSync(`public${a.modelPath}`), a.modelPath).toBe(true);
    }
  });

  it('no generated asset is active in gameplay (review-only)', () => {
    expect(GENERATED_APPROVAL_ASSETS.every(a => a.activeInGameplay === false)).toBe(true);
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

  it('detects glass by BEHAVIOUR (transparent material with a non-glass code name)', () => {
    // The generated batch names a transparent panel "AB" — not a glass keyword.
    const beh = analyzeGltf({
      meshes: [{ primitives: [{ material: 0 }] }],
      materials: [{ name: 'AB', alphaMode: 'BLEND', pbrMetallicRoughness: { baseColorFactor: [0, 0.8, 1, 0.85] } }],
    });
    expect(GLASS_HINT.test('AB')).toBe(false);   // name alone misses it
    expect(beh.glass.found).toBe(true);          // behaviour catches it
    expect(beh.glass.transparent).toBe(true);
    expect(beh.glass.assignedToMesh).toBe(true);
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

describe('reconciliation artifacts exist', () => {
  it('QA + reconciliation reports are present', () => {
    expect(existsSync('BUILDING_ASSET_APPROVAL_QA.md')).toBe(true);
    expect(existsSync('BUILDING_ASSET_RECONCILIATION.md')).toBe(true);
  });
});
