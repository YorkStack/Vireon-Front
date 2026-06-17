import { describe, it, expect, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  activeBuildingAsset, makeGlbBuildingGroup, __setBuildingGlbForTest, hasBuildingGlb,
  ACTIVE_ASSET_ROLES,
} from './buildingGlb';
import { powerPlantAsset } from '../data/buildingAssets';
import type { FactionId } from '../data/factionModifiers';

const CRIMSON_KEY = 'crimson.power.plant';
const AZURE_KEY = 'azure.power.core';

function fakeScene(): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshStandardMaterial());
  mesh.position.y = 1.5; // base near y=0, top near y=3
  g.add(mesh);
  return g;
}

afterEach(() => {
  __setBuildingGlbForTest(CRIMSON_KEY, null);
  __setBuildingGlbForTest(AZURE_KEY, null);
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

  it('3. powerplant mapping: red/blue use GLB (when cached); green/yellow fall back', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene());
    __setBuildingGlbForTest(AZURE_KEY, fakeScene());
    expect(activeBuildingAsset('spire', 'red')).not.toBeNull();
    expect(activeBuildingAsset('spire', 'blue')).not.toBeNull();
    // verdant + solar have NO powerplant asset at all
    expect(powerPlantAsset('green')).toBeUndefined();
    expect(powerPlantAsset('yellow')).toBeUndefined();
    expect(activeBuildingAsset('spire', 'green')).toBeNull();
    expect(activeBuildingAsset('spire', 'yellow')).toBeNull();
  });

  it('4. defense towers are NOT auto-activated (cannon/lance keep procedural)', () => {
    expect(ACTIVE_ASSET_ROLES.has('defense')).toBe(false);
    for (const id of ['red', 'blue', 'green', 'yellow'] as FactionId[]) {
      expect(activeBuildingAsset('cannon', id), `cannon ${id}`).toBeNull();
      expect(activeBuildingAsset('lance', id), `lance ${id}`).toBeNull();
    }
  });

  it('5. non-power buildings never get a GLB (nexus/refinery/foundry…)', () => {
    __setBuildingGlbForTest(CRIMSON_KEY, fakeScene());
    for (const bid of ['nexus', 'refinery', 'barracks', 'foundry', 'wall']) {
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
