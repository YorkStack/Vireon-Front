// DEV-ONLY review harness for the gated TEXTURED building path.
//
// Exercises the REAL runtime code (preloadBuildingGlbs → activeBuildingAsset →
// makeGlbBuildingGroup) under the `?buildings=textured` gate, laying out the 6
// safe static roles of a faction in a row on a neutral ground so the final baked
// textures can be visually smoke-tested without playing a full match.
//
// Not imported by the game. Mode is taken from the page URL (?buildings=textured
// vs current), faction from ?fac=red|blue|green|yellow. Visual-only.
import * as THREE from 'three';
import { SceneRig } from '../render/scene';
import { preloadBuildingGlbs, activeBuildingAsset, makeGlbBuildingGroup, buildingModeFromQuery, BUILDING_SOURCE } from '../render/buildingGlb';
import type { FactionId } from '../data/factionModifiers';

const ROLES = ['nexus', 'spire', 'refinery', 'barracks', 'foundry', 'wall'];
const FOOTPRINT: Record<string, number> = { nexus: 4, spire: 2, refinery: 3, barracks: 3, foundry: 3, wall: 1 };
const ACCENT: Record<FactionId, string> = { red: '#ff5a4a', blue: '#5ad1ff', green: '#7dff5a', yellow: '#ffd24a' };

const params = new URLSearchParams(location.search);
const fac = (params.get('fac') as FactionId) || 'red';
const mode = buildingModeFromQuery();

const canvas = document.getElementById('c') as HTMLCanvasElement;
const rig = new SceneRig(canvas, 64);

// neutral ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(120, 60),
  new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 1 }),
);
ground.rotateX(-Math.PI / 2);
ground.receiveShadow = true;
rig.scene.add(ground);

rig.lookAt(0, 0, true);
rig.distGoal = rig.dist = 34;

const resolved: { role: string; key: string; src: string }[] = [];

function layout() {
  const fid = fac;
  let x = -(ROLES.length - 1) * 9 / 2;
  for (const role of ROLES) {
    const asset = activeBuildingAsset(role, fid);
    let key = '— (procedural fallback)';
    if (asset) {
      const grp = makeGlbBuildingGroup(asset, ACCENT[fid], FOOTPRINT[role]);
      if (grp) { grp.position.set(x, 0, 0); rig.scene.add(grp); }
      key = asset.assetKey;
    }
    resolved.push({ role, key, src: BUILDING_SOURCE[asset?.assetKey ?? ''] ?? 'procedural' });
    x += 9;
  }
}

function frame() {
  rig.update(1 / 60, () => 0);
  requestAnimationFrame(frame);
}

const hud = document.getElementById('hud')!;
(async () => {
  await preloadBuildingGlbs();
  layout();
  hud.innerHTML = `<b>buildings=${mode}</b> · fac=${fac}<br>` +
    resolved.map((r) => `${r.role}: <code>${r.key}</code> [${r.src}]`).join('<br>');
  (window as any).__bld = { mode, fac, resolved, cam: (d: number, tx = 0, tz = 0) => { rig.distGoal = rig.dist = d; rig.lookAt(tx, tz, true); }, ready: true };
  frame();
})();
