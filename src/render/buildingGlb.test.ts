import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  activeBuildingAsset, makeGlbBuildingGroup, __setBuildingGlbForTest, hasBuildingGlb,
  ACTIVE_ASSET_ROLES,
} from './buildingGlb';
import { powerPlantAsset, hqAsset } from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

const CRIMSON_KEY = 'crimson.power.plant';
const AZURE_KEY = 'azure.power.core';
const VERDANT_KEY = 'verdant.power.reactor';
const SOLAR_KEY = 'solar.power.nexus';
const CRIMSON_HQ = 'crimson.hq.fortress';

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

afterEach(() => {
  for (const k of [CRIMSON_KEY, AZURE_KEY, VERDANT_KEY, SOLAR_KEY, CRIMSON_HQ]) __setBuildingGlbForTest(k, null);
});

describe('building GLB loader — mapping + fallback (powerplants only this phase)', () => {
  it('1. resolves the registry asset for spire when its GLB is cached', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene());
    expect(activeBuildingAsset('spire', 'red')?.assetKey).toBe(CRIMSON_KEY);
    __setBuildingGlbForTest(AZURE_KEY, fakeScene());
    expect(activeBuildingAsset('spire', 'blue')?.assetKey).toBe(AZURE_KEY);
  });

  it('2. missing GLB → null (fallback), never a throw', () => {
    // not cached yet
    expect(hasBuildingGlb(CRIMSON_KEY)).toBe(false);
    expect(activeBuildingAsset('spire', 'red')).toBeNull();
  });

  it('3. powerplant + HQ mapping: spire→powerplant, nexus→HQ for all four factions when cached', () => {
    const keys: Record<FactionId, string> = { red: CRIMSON_KEY, blue: AZURE_KEY, green: VERDANT_KEY, yellow: SOLAR_KEY };
    for (const id of ['red', 'blue', 'green', 'yellow'] as FactionId[]) {
      expect(powerPlantAsset(id), `power ${id}`).toBeDefined();
      expect(hqAsset(id), `hq ${id}`).toBeDefined();
      // not cached yet → fallback
      expect(activeBuildingAsset('spire', id)).toBeNull();
      __setBuildingGlbForTest(keys[id], fakeScene());
      expect(activeBuildingAsset('spire', id), `spire ${id}`).not.toBeNull();
    }
    // nexus → HQ asset once its GLB is cached
    expect(activeBuildingAsset('nexus', 'red')).toBeNull();
    __setBuildingGlbForTest(CRIMSON_HQ, fakeScene());
    expect(activeBuildingAsset('nexus', 'red')?.role).toBe('hq');
  });

  it('4. defense towers are NOT auto-activated (cannon/lance keep procedural)', () => {
    expect(ACTIVE_ASSET_ROLES.has('defense')).toBe(false);
    for (const id of ['red', 'blue', 'green', 'yellow'] as FactionId[]) {
      expect(activeBuildingAsset('cannon', id), `cannon ${id}`).toBeNull();
      expect(activeBuildingAsset('lance', id), `lance ${id}`).toBeNull();
    }
  });

  it('5. non-active buildings never get a GLB (refinery/barracks/foundry/wall)', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene());
    __setBuildingGlbForTest(CRIMSON_HQ, fakeScene());
    for (const bid of ['refinery', 'barracks', 'foundry', 'wall']) {
      expect(activeBuildingAsset(bid, 'red'), bid).toBeNull();
    }
  });

  it('6. makeGlbBuildingGroup returns a procedural-shaped, grounded group', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene());
    const asset = activeBuildingAsset('spire', 'red')!;
    const g = makeGlbBuildingGroup(asset, '#ff5c4d', 2)!;
    expect(g).not.toBeNull();
    expect(g.userData.anim).toEqual({});            // no turret/spin anim
    expect(typeof g.userData.topY).toBe('number');
    expect(g.userData.topY).toBeGreaterThan(0);
    expect(g.userData.inner).toBeDefined();
    // grounded: the inner group lifts the model so its base sits at/above y≈0
    const box = new THREE.Box3().setFromObject(g);
    expect(box.min.y).toBeGreaterThanOrEqual(-1e-6);
  });

  it('7. makeGlbBuildingGroup returns null when the asset is not cached (fallback)', () => {
    // craft an asset object whose key is not in the cache
    const ghost = { ...powerPlantAsset('red')!, assetKey: 'ghost.key' };
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
    __setBuildingGlbForTest(CRIMSON_KEY, scene);
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const c = findMat(g, 'Concrete')!;
    expect(c.color.getHex()).toBe(concrete.color.getHex()); // untouched colour
    expect(c.emissiveIntensity).toBe(1);                    // not boosted
  });

  it('preserves baked emissive look and registers it for the idle pulse', () => {
    const { scene } = fakeGlowScene();
    __setBuildingGlbForTest(CRIMSON_KEY, scene);
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const glow = findMat(g, 'Status_Glow')!;
    expect(glow.emissiveIntensity).toBe(1);                     // baked strength preserved
    expect(glow.emissive.getHex()).toBe(new THREE.Color(1, 0.42, 0).getHex()); // colour preserved
    const pulse = (g.userData.anim as { pulseMats?: { base: number }[] }).pulseMats!;
    expect(pulse.length).toBe(1);
    expect(pulse[0].base).toBe(1);                              // pulse centres on baked value
  });

  it('clones emissive materials per instance — no leak between buildings or to the template', () => {
    const { scene, glow: templateGlow } = fakeGlowScene();
    __setBuildingGlbForTest(CRIMSON_KEY, scene);
    const a = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const b = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    const ga = findMat(a, 'Status_Glow')!, gb = findMat(b, 'Status_Glow')!;
    expect(ga).not.toBe(gb);              // separate instances
    expect(ga).not.toBe(templateGlow);    // not the cached template material
    expect(templateGlow.emissiveIntensity).toBe(1); // template never mutated
  });

  it('a non-emissive-only scene yields no pulse and an empty anim (no crash)', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene()); // default material, no emissive
    const g = makeGlbBuildingGroup(activeBuildingAsset('spire', 'red')!, '#ff5c4d', 2)!;
    expect(g.userData.anim).toEqual({});
  });
});
