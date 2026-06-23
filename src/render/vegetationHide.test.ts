// Slice 2C: runtime hiding of cleared vegetation. Covers the hide helper
// (collapse-to-zero, idempotency, multiple primitives per tile, missing tile,
// null group) and the structural wiring of the tile->instance bookkeeping that
// buildVegetationGlbInstances attaches to the group. The real builder's instance
// population needs loaded GLB templates (browser-only); the end-to-end disappear
// is covered by the browser smoke.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { hideVegetationAtTile, vegTileKey, buildVegetationGlbInstances } from './vegetationGlb';
import { GameMap } from '../map/map';

interface Ref { mesh: THREE.InstancedMesh; index: number; }

function fakeMesh(count: number): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), count);
  const id = new THREE.Matrix4(); // identity = "placed/visible"
  for (let i = 0; i < count; i++) im.setMatrixAt(i, id);
  return im;
}
function fakeGroup(byTile: Map<string, Ref[]>): THREE.Group {
  const g = new THREE.Group();
  g.userData.tileToInstances = byTile;
  g.userData.hiddenTiles = new Set<string>();
  return g;
}
/** Scale magnitude of one instance via the matrix diagonal (0 once hidden, ~1 when
 *  placed). Read from the matrix elements directly — THREE's decompose misbehaves
 *  on a fully-degenerate zero-scale matrix, which is exactly what hiding produces. */
function instanceScale(mesh: THREE.InstancedMesh, index: number): number {
  const m = new THREE.Matrix4(); mesh.getMatrixAt(index, m);
  const e = m.elements; // column-major; diagonal scale terms are 0,5,10
  return Math.max(Math.abs(e[0]), Math.abs(e[5]), Math.abs(e[10]));
}

describe('vegTileKey', () => {
  it('is the logical-tile string key', () => {
    expect(vegTileKey(3, 4)).toBe('3,4');
    expect(vegTileKey(0, 0)).toBe('0,0');
  });
});

describe('hideVegetationAtTile', () => {
  it('collapses every instance for a tile, across multiple primitives', () => {
    const meshA = fakeMesh(2), meshB = fakeMesh(2);
    const byTile = new Map<string, Ref[]>([
      [vegTileKey(5, 7), [{ mesh: meshA, index: 0 }, { mesh: meshB, index: 1 }]],
    ]);
    const g = fakeGroup(byTile);
    expect(instanceScale(meshA, 0)).toBeGreaterThan(0.5); // visible before
    expect(instanceScale(meshB, 1)).toBeGreaterThan(0.5);

    expect(hideVegetationAtTile(g, 5, 7)).toBe(true);

    expect(instanceScale(meshA, 0)).toBeCloseTo(0); // both primitives hidden
    expect(instanceScale(meshB, 1)).toBeCloseTo(0);
    // An unrelated instance on the same mesh is untouched.
    expect(instanceScale(meshA, 1)).toBeGreaterThan(0.5);
  });

  it('is idempotent (second call no-ops and returns false)', () => {
    const mesh = fakeMesh(1);
    const g = fakeGroup(new Map([[vegTileKey(2, 2), [{ mesh, index: 0 }]]]));
    expect(hideVegetationAtTile(g, 2, 2)).toBe(true);
    expect(hideVegetationAtTile(g, 2, 2)).toBe(false); // already hidden
    expect(instanceScale(mesh, 0)).toBeCloseTo(0);
  });

  it('returns false for a tile with no recorded vegetation', () => {
    const g = fakeGroup(new Map([[vegTileKey(1, 1), [{ mesh: fakeMesh(1), index: 0 }]]]));
    expect(hideVegetationAtTile(g, 9, 9)).toBe(false);
  });

  it('does not throw for a null/undefined group or a group with no map', () => {
    expect(hideVegetationAtTile(null, 1, 1)).toBe(false);
    expect(hideVegetationAtTile(undefined, 1, 1)).toBe(false);
    expect(hideVegetationAtTile(new THREE.Group(), 1, 1)).toBe(false);
  });
});

describe('buildVegetationGlbInstances — tile->instance bookkeeping wiring', () => {
  it('attaches a tileToInstances Map and a hiddenTiles Set to the group', () => {
    const g = buildVegetationGlbInstances(new GameMap(48, 123), 285);
    expect(g.name).toBe('vegetation-glb-v31');
    expect(g.userData.tileToInstances).toBeInstanceOf(Map);
    expect(g.userData.hiddenTiles).toBeInstanceOf(Set);
  });
});
