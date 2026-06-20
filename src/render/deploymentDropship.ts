// Procedural low-poly dropship for the deployment intro. Visual-only: one small
// THREE.Group built once, then only its transform (and a couple of emissive
// pulses) are updated per frame — no per-frame allocations, no gameplay state.
// Faction-tinted via the accent colour. Driven by the pure intro timeline in
// ../core/deploymentIntro so the ship and the controller stay in lockstep.
import * as THREE from 'three';
import { introStateAt, phaseProgressAt } from '../core/deploymentIntro';

const SKY_Y = 46; // entry / exit altitude (well above the camera-facing scene)
const HOVER_Y = 7; // altitude after the descent, before settling
const REST_Y = 2.0; // hovering-just-above-ground unload height
const ENTER_DX = 26; // horizontal entry offset (comes in from the side)
const ENTER_DZ = 16;

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

export class DeploymentDropship {
  readonly group: THREE.Group;
  private ramp: THREE.Mesh;
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(accentHex = '#cfe8ff') {
    const g = new THREE.Group();

    const track = <T extends THREE.BufferGeometry>(geo: T): T => {
      this.geos.push(geo);
      return geo;
    };
    const hullMat = new THREE.MeshStandardMaterial({ color: '#9aa3b6', roughness: 0.5, metalness: 0.55 });
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2a2d3a', roughness: 0.7, metalness: 0.35 });
    const accent = new THREE.Color(accentHex);
    const glowMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4, roughness: 0.4 });
    this.mats.push(hullMat, darkMat, glowMat);
    this.glowMats.push(glowMat);

    // Fuselage.
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(3.0, 1.6, 6.2)), hullMat);
    body.position.y = 0;
    g.add(body);

    // Nose (tapered front).
    const nose = new THREE.Mesh(track(new THREE.ConeGeometry(1.5, 2.2, 4)), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI / 4;
    nose.position.set(0, 0, -3.9);
    g.add(nose);

    // Wings / side pods.
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(track(new THREE.BoxGeometry(2.2, 0.4, 2.6)), darkMat);
      wing.position.set(sx * 2.3, -0.1, 0.4);
      wing.rotation.z = sx * 0.18;
      g.add(wing);
      // Engine glow pods under the wings.
      const podMat = glowMat.clone();
      this.mats.push(podMat);
      this.glowMats.push(podMat);
      const pod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 8)), podMat);
      pod.rotation.x = Math.PI / 2;
      pod.position.set(sx * 3.0, -0.4, 0.9);
      g.add(pod);
    }

    // Cockpit accent strip.
    const strip = new THREE.Mesh(track(new THREE.BoxGeometry(1.4, 0.3, 0.6)), glowMat);
    strip.position.set(0, 0.7, -2.4);
    g.add(strip);

    // Rear unload ramp (hinged at the back; rotates down during unloading).
    this.ramp = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 0.25, 2.4)), darkMat);
    this.ramp.geometry.translate(0, 0, 1.2); // hinge at the fuselage edge
    this.ramp.position.set(0, -0.7, 3.0);
    g.add(this.ramp);

    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    g.visible = false;
    this.group = g;
  }

  /** Place the dropship for a given elapsed time + landing-zone world position. */
  applyState(elapsed: number, landingX: number, landingZ: number, groundY: number): void {
    const state = introStateAt(elapsed);
    if (state === 'complete') {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const p = ease(phaseProgressAt(elapsed));
    let x = landingX;
    let z = landingZ;
    let y = groundY + REST_Y;
    let rampOpen = 0;

    if (state === 'entering') {
      y = groundY + THREE.MathUtils.lerp(SKY_Y, HOVER_Y, p);
      x = landingX + THREE.MathUtils.lerp(ENTER_DX, 0, p);
      z = landingZ + THREE.MathUtils.lerp(ENTER_DZ, 0, p);
    } else if (state === 'landing') {
      y = groundY + THREE.MathUtils.lerp(HOVER_Y, REST_Y, p);
    } else if (state === 'unloading') {
      y = groundY + REST_Y;
      rampOpen = ease(Math.min(1, p * 1.4)); // ramp swings down early in the phase
    } else if (state === 'departing') {
      y = groundY + THREE.MathUtils.lerp(REST_Y, SKY_Y, p);
      x = landingX + THREE.MathUtils.lerp(0, -ENTER_DX, p);
      z = landingZ + THREE.MathUtils.lerp(0, -ENTER_DZ, p);
      rampOpen = ease(1 - p); // ramp closes as it lifts
    }

    this.group.position.set(x, y, z);
    this.ramp.rotation.x = rampOpen * (Math.PI / 2.4);
    // Subtle engine throb so the parked ship doesn't read as a static prop.
    const throb = 1.1 + 0.5 * Math.sin(elapsed * 9);
    for (const m of this.glowMats) m.emissiveIntensity = throb;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    for (const geo of this.geos) geo.dispose();
    for (const m of this.mats) m.dispose();
  }
}
