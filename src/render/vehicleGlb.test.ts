// @vitest-environment happy-dom
// (vehicleGlb imports GLTFLoader from three/addons, which touches DOM at import.)
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  vehicleGlbKey, hasVehicleGlb, expectedVehicleGlb, makeGlbEntityGroup, __setGlbForTest, __setMetaForTest, VEH_SOURCE,
} from './vehicleGlb';

/** Hand-build a scene shaped like a baked vehicle GLB (turret node + muzzle + mat_accent). */
function fakeScene(): THREE.Group {
  const scene = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial({ name: 'mat_body' }));
  hull.name = 'hull_static';
  const turret = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), new THREE.MeshStandardMaterial({ name: 'mat_accent' }));
  turret.name = 'turret';
  turret.position.set(0, 1.2, 0);
  const muzzle = new THREE.Object3D();
  muzzle.name = 'muzzle';
  muzzle.position.set(0, 0, 1.5);
  turret.add(muzzle);
  scene.add(hull, turret);
  return scene;
}

/** Scene with a separate `barrel` node under the turret + a `tex_tire` static group. */
function fakeSceneWithBarrel(): THREE.Group {
  const scene = fakeScene();
  const turret = scene.getObjectByName('turret')!;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1.5), new THREE.MeshStandardMaterial({ name: 'mat_dark' }));
  barrel.name = 'barrel';
  barrel.position.set(0, 0, 0.8);
  // muzzle should hang under the barrel so it tracks the pump
  const muzzle = scene.getObjectByName('muzzle')!;
  barrel.add(muzzle);
  turret.add(barrel);
  const texTire = new THREE.Group();
  texTire.name = 'tex_tire';
  texTire.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshStandardMaterial({ name: 'mat_dark' })));
  scene.add(texTire);
  return scene;
}

describe('vehicleGlb helpers', () => {
  it('keys and registry flags', () => {
    expect(vehicleGlbKey('red', 'mediumTank')).toBe('red:mediumTank');
    expect(expectedVehicleGlb('red', 'mediumTank')).toBe(true);   // registered
    expect(expectedVehicleGlb('blue', 'scout')).toBe(false);      // not registered
  });
});

describe('makeGlbEntityGroup', () => {
  it('returns null when no GLB is cached', () => {
    __setGlbForTest('red', 'tmp', null);
    expect(makeGlbEntityGroup('red', 'tmp', '#ff0000')).toBeNull();
  });

  it('builds a makeEntityGroup-shaped visual with turret/muzzle and tinted accent', () => {
    __setGlbForTest('test', 'tank', fakeScene());
    expect(hasVehicleGlb('test', 'tank')).toBe(true);
    const g = makeGlbEntityGroup('test', 'tank', '#22ccff')!;
    expect(g).toBeTruthy();
    // shape contract used by world.ts / models.ts
    expect(g.userData.inner).toBeTruthy();
    expect(g.userData.anim.turret, 'no turret anim node').toBeTruthy();
    expect(g.userData.anim.turret.name).toBe('turret');
    expect(g.userData.muzzle?.name).toBe('muzzle');
    expect(g.userData.topY).toBeGreaterThan(0);
    expect(VEH_SOURCE['test:tank']).toBe('glb');

    // accent material was cloned + recolored (no leak to a shared material).
    let accent: THREE.MeshStandardMaterial | undefined;
    g.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m && m.name === 'mat_accent') accent = m;
    });
    expect(accent).toBeTruthy();
    expect('#' + accent!.color.getHexString()).toBe('#22ccff');
  });

  it('wires barrel + barrelAnim when metadata declares motion', () => {
    __setGlbForTest('test', 'pump', fakeSceneWithBarrel());
    __setMetaForTest('test', 'pump', { barrelAnim: { spin: true, pump: 0.6 } });
    const g = makeGlbEntityGroup('test', 'pump', '#ff8800')!;
    expect(g.userData.barrel?.name).toBe('barrel');
    expect(g.userData.barrelAnim).toEqual({ spin: true, pump: 0.6 });
    // muzzle resolves under the (pumping) barrel
    expect(g.userData.muzzle?.name).toBe('muzzle');
    __setMetaForTest('test', 'pump', null);
  });

  it('no barrel anim node when metadata declares no motion', () => {
    __setGlbForTest('test', 'still', fakeSceneWithBarrel());
    __setMetaForTest('test', 'still', { barrelAnim: { spin: false, pump: 0 } });
    const g = makeGlbEntityGroup('test', 'still', '#ff8800')!;
    expect(g.userData.barrel).toBeUndefined();
    __setMetaForTest('test', 'still', null);
  });

  it('a turret-group texture does not bleed onto the barrel under it', () => {
    __setGlbForTest('test', 'tex', fakeSceneWithBarrel());
    // 1x1 png data URIs (base64) for turret + tire groups
    const px = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    __setMetaForTest('test', 'tex', { slotTextures: { turret: px, tire: px } });
    const g = makeGlbEntityGroup('test', 'tex', '#ffffff')!;
    const mat = (name: string) => {
      let m: THREE.MeshStandardMaterial | undefined;
      g.traverse((o) => { if (o.name === name) m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial; });
      return m;
    };
    expect(mat('turret')!.map, 'turret textured').toBeTruthy();
    expect(mat('barrel')!.map, 'barrel must stay untextured by the turret group').toBeFalsy();
    __setMetaForTest('test', 'tex', null);
  });

  it('tints per-instance without leaking colour between factions', () => {
    __setGlbForTest('test', 'tank2', fakeScene());
    const a = makeGlbEntityGroup('test', 'tank2', '#ff0000')!;
    const b = makeGlbEntityGroup('test', 'tank2', '#00ff00')!;
    const accentOf = (g: THREE.Group) => {
      let c = '';
      g.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && m.name === 'mat_accent') c = '#' + m.color.getHexString();
      });
      return c;
    };
    expect(accentOf(a)).toBe('#ff0000');
    expect(accentOf(b)).toBe('#00ff00');
  });
});
