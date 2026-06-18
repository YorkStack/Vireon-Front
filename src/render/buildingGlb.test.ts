import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  activeBuildingAsset, makeGlbBuildingGroup, __setBuildingGlbForTest, hasBuildingGlb,
  ACTIVE_BUILDING_IDS,
} from './buildingGlb';
import { generatedGameplayAsset } from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

// Activated generated asset keys (review-approved static buildings).
const SPIRE_RED = 'crimson.gen.spire';
const SPIRE_BLUE = 'azure.gen.spire';
const SPIRE_GREEN = 'verdant.gen.spire';
const SPIRE_YELLOW = 'solar.gen.spire';
const NEXUS_RED = 'crimson.gen.nexus';
const REFINERY_RED = 'crimson.gen.refinery';
const ALL_KEYS = [SPIRE_RED, SPIRE_BLUE, SPIRE_GREEN, SPIRE_YELLOW, NEXUS_RED, REFINERY_RED,
  'crimson.gen.barracks', 'crimson.gen.foundry', 'crimson.gen.wall'];

function fakeScene(): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshStandardMaterial());
  mesh.position.y = 1.5; // base near y=0, top near y=3
  g.add(mesh);
  return g;
}

/** A scene mirroring the real GLBs: a baked concrete body + a named emissive glow. */
function fakeGlowScene(): { scene: THREE.Group; concrete: THREE.MeshStandardMaterial; glow: THREE.MeshStandardMaterial } {
  const g = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0x888888 });
  concrete.name = 'Concrete';
  const glow = new THREE.MeshStandardMaterial({ color: 0x111111 });
  glow.name = 'Status_Glow';
  glow.emissive = new THREE.Color(1, 0.42, 0); // baked emissiveFactor
  glow.emissiveIntensity = 1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), concrete);
  body.position.y = 1.5;
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), glow);
  lamp.position.y = 2.5;
  g.add(body, lamp);
  return { scene: g, concrete, glow };
}

afterEach(() => { for (const k of ALL_KEYS) __setBuildingGlbForTest(k, null); });

describe('building GLB loader — generated static buildings (towers stay procedural)', () => {
  it('1. resolves the generated asset for spire when its GLB is cached', () => {
    __setBuildingGlbForTest(SPIRE_RED, fakeScene());
    expect(activeBuildingAsset('spire', 'red')?.assetKey).toBe(SPIRE_RED);
    __setBuildingGlbForTest(SPIRE_BLUE, fakeScene());
    expect(activeBuildingAsset('spire', 'blue')?.assetKey).toBe(SPIRE_BLUE);
  });

  it('2. missing GLB → null (fallback), never a throw', () => {
    expect(hasBuildingGlb(SPIRE_RED)).toBe(false);
    expect(activeBuildingAsset('spire', 'red')).toBeNull();
  });

  it('3. spire→power, nexus→hq for all four factions when cached', () => {
    const spireKeys: Record<FactionId, string> = { red: SPIRE_RED, blue: SPIRE_BLUE, green: SPIRE_GREEN, yellow: SPIRE_YELLOW };
    for (const id of ['red', 'blue', 'green', 'yellow'] as FactionId[]) {
      expect(generatedGameplayAsset(id, 'spire'), `gen spire ${id}`).toBeDefined();
      expect(activeBuildingAsset('spire', id)).toBeNull(); // not cached yet
      __setBuildingGlbForTest(spireKeys[id], fakeScene());
      expect(activeBuildingAsset('spire', id)?.role, `spire ${id}`).toBe('power');
    }
    expect(activeBuildingAsset('nexus', 'red')).toBeNull();
    __setBuildingGlbForTest(NEXUS_RED, fakeScene());
    expect(activeBuildingAsset('nexus', 'red')?.role).toBe('hq');
  });

  it('4. cannon/lance are NOT activated (turrets keep procedural)', () => {
    expect(ACTIVE_BUILDING_IDS.has('cannon')).toBe(false);
    expect(ACTIVE_BUILDING_IDS.has('lance')).toBe(false);
    for (const id of ['red', 'blue', 'green', 'yellow'] as FactionId[]) {
      expect(activeBuildingAsset('cannon', id), `cannon ${id}`).toBeNull();
      expect(activeBuildingAsset('lance', id), `lance ${id}`).toBeNull();
    }
  });

  it('5. refinery/barracks/foundry/wall ARE activated when cached', () => {
    for (const bid of ['refinery', 'barracks', 'foundry', 'wall']) {
      expect(ACTIVE_BUILDING_IDS.has(bid), bid).toBe(true);
      const key = `crimson.gen.${bid}`;
      expect(activeBuildingAsset(bid, 'red'), `${bid} uncached`).toBeNull();
      __setBuildingGlbForTest(key, fakeScene());
      expect(activeBuildingAsset(bid, 'red')?.assetKey, bid).toBe(key);
    }
  });

  it('6. makeGlbBuildingGroup returns a procedural-shaped, grounded group', () => {
    __setBuildingGlbForTest(SPIRE_RED, fakeScene());
    const asset = activeBuildingAsset('spire', 'red')!;
    const g = makeGlbBuildingGroup(asset, '#ff5c4d', 2)!;
    expect(g).not.toBeNull();
    expect(g.userData.anim).toEqual({});            // no turret/spin anim
    expect(typeof g.userData.topY).toBe('number');
    expect(g.userData.topY).toBeGreaterThan(0);
    expect(g.userData.inner).toBeDefined();
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6); // grounded
  });

  it('7. makeGlbBuildingGroup returns null when the asset is not cached (fallback)', () => {
    const ghost = { ...generatedGameplayAsset('red', 'spire')!, assetKey: 'ghost.key' };
    expect(makeGlbBuildingGroup(ghost, '#fff', 2)).toBeNull();
  });
});

describe('building GLB material fidelity (Visual/Fidelity Phase 1)', () => {
  function findMat(g: THREE.Group, name: string): THREE.MeshStandardMaterial | undefined {
    let found: THREE.MeshStandardMaterial | undefined;
    g.traverse((o) => {
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (mat && mat.name === name) found = mat;
    });
    return found;
  }

  it('preserves non-emissive materials exactly (no replacement)', () => {
    const { scene, concrete } = fakeGlowScene();
    __setBuildingGlbForTest(SPIRE_RED, scene);
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const c = findMat(g, 'Concrete')!;
    expect(c.color.getHex()).toBe(concrete.color.getHex());
    expect(c.emissiveIntensity).toBe(1);
  });

  it('preserves baked emissive look and registers it for the idle pulse', () => {
    const { scene } = fakeGlowScene();
    __setBuildingGlbForTest(SPIRE_RED, scene);
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const glow = findMat(g, 'Status_Glow')!;
    expect(glow.emissiveIntensity).toBe(1);
    expect(glow.emissive.getHex()).toBe(new THREE.Color(1, 0.42, 0).getHex());
    const pulse = (g.userData.anim as { pulseMats?: { base: number }[] }).pulseMats!;
    expect(pulse.length).toBe(1);
    expect(pulse[0].base).toBe(1);
  });

  it('clones emissive materials per instance — no leak between buildings or to the template', () => {
    const { scene, glow: templateGlow } = fakeGlowScene();
    __setBuildingGlbForTest(SPIRE_RED, scene);
    const a = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const b = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const ga = findMat(a, 'Status_Glow')!, gb = findMat(b, 'Status_Glow')!;
    expect(ga).not.toBe(gb);
    expect(ga).not.toBe(templateGlow);
    expect(templateGlow.emissiveIntensity).toBe(1);
  });

  it('a non-emissive-only scene yields no pulse and an empty anim (no crash)', () => {
    __setBuildingGlbForTest(SPIRE_RED, fakeScene());
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    expect(g.userData.anim).toEqual({});
  });
});
