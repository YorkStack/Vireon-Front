// Procedural dropship factory for the deployment intro. Four faction-distinct ship
// architectures, each built from procedural primitives + a per-zone PBR material kit
// (armor / panel / trim / glow). Flat plastic look is broken up by a tiny runtime
// canvas noise texture used as roughnessMap + bumpMap (no external assets, offline).
//
// Visual-only. The class keeps its existing contract so the intro animation never
// breaks: `new DeploymentDropship(factionId, accentHex)`, `.group`, `.applyState
// (elapsed, landingX, landingZ, groundY)`, `.dispose()`. Nose faces -z (forward),
// base sits at y≈0, so landing/unload offsets stay valid.
import * as THREE from 'three';
import { introStateAt, phaseProgressAt } from '../core/deploymentIntro';

const SKY_Y = 46; // entry / exit altitude
const HOVER_Y = 7; // altitude after the descent, before settling
const REST_Y = 2.0; // hovering-just-above-ground unload height
const ENTER_DX = 26; // horizontal entry offset
const ENTER_DZ = 16;

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

// --- Faction id normalisation (engine ids red/blue/green/yellow → ship archetypes) ---
type Archetype = 'crimson' | 'azure' | 'verdant' | 'solar';
function archetypeOf(factionId: string | undefined): Archetype {
  switch ((factionId ?? '').toLowerCase()) {
    case 'red': case 'crimson': return 'crimson';
    case 'blue': case 'azure': return 'azure';
    case 'green': case 'verdant': return 'verdant';
    case 'yellow': case 'solar': return 'solar';
    default: return 'crimson';
  }
}

// --- Per-zone PBR material kit ----------------------------------------------------
interface FactionMaterialKit {
  armor: THREE.MeshStandardMaterial; // ZONE A — main hull
  panel: THREE.MeshStandardMaterial; // ZONE B — secondary panels / wings
  trim: THREE.MeshStandardMaterial; // ZONE D — paint / trim lines
  glow: THREE.MeshStandardMaterial; // ZONE C/G — emissive
}

interface KitSpec {
  armor: { color: string; metal: number; rough: number; flat?: boolean };
  panel: { color: string; metal: number; rough: number; flat?: boolean };
  trim: { color: string; metal: number; rough: number };
  glow: { color: string };
}

const KIT_SPECS: Record<Archetype, KitSpec> = {
  // Brutalist war-economy: dark graphite alloy, muted crimson trim, amber emissive.
  crimson: {
    armor: { color: '#3a3d47', metal: 0.65, rough: 0.85, flat: true },
    panel: { color: '#4d525e', metal: 0.6, rough: 0.8, flat: true },
    trim: { color: '#9e3329', metal: 0.5, rough: 0.7 },
    glow: { color: '#ff9a3c' },
  },
  // Hydro-aerodynamic: pearl-white ceramic, pale-aqua panels, cyan emissive.
  azure: {
    armor: { color: '#dce7ef', metal: 0.4, rough: 0.28 },
    panel: { color: '#a9cfe0', metal: 0.35, rough: 0.3 },
    trim: { color: '#6fb7d6', metal: 0.45, rough: 0.35 },
    glow: { color: '#45d8ff' },
  },
  // Bio-engineered chitin: dark carapace, organic-green tissue, toxic-green veins.
  verdant: {
    armor: { color: '#2c3a23', metal: 0.15, rough: 0.72, flat: true },
    panel: { color: '#5f8f3a', metal: 0.1, rough: 0.6 },
    trim: { color: '#3c6b2a', metal: 0.1, rough: 0.7 },
    glow: { color: '#9cff5a' },
  },
  // Levitating bio-mineral: ivory crystal shell, golden mineral, solar-core emissive.
  solar: {
    armor: { color: '#ece3c8', metal: 0.3, rough: 0.32, flat: true },
    panel: { color: '#c8a23a', metal: 0.7, rough: 0.4 },
    trim: { color: '#b8902f', metal: 0.6, rough: 0.45 },
    glow: { color: '#ffd24a' },
  },
};

/** Tiny runtime value-noise texture → breaks specular monotony (roughness + bump). */
function makeNoiseTexture(seed: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(S, S);
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 0xffffffff);
  for (let i = 0; i < S * S; i++) {
    const v = 150 + Math.floor(rnd() * 105); // mid-high grey, gentle variance
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

export class DeploymentDropship {
  readonly group: THREE.Group;
  private ramp?: THREE.Object3D; // unload door / shell-flap pivot (absent for Solar)
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly kit: FactionMaterialKit;

  constructor(factionId = 'red', accentHex = '#cfe8ff') {
    const arch = archetypeOf(factionId);
    this.kit = this.makeKit(arch, accentHex);

    const g = new THREE.Group();
    g.name = `dropship_${arch}`;
    this.group = g;

    if (arch === 'crimson') this.buildCrimson();
    else if (arch === 'azure') this.buildAzure();
    else if (arch === 'verdant') this.buildVerdant();
    else this.buildSolar();

    g.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = false;
    });
    g.visible = false;
  }

  // --- material kit -------------------------------------------------------------
  private makeKit(arch: Archetype, accentHex: string): FactionMaterialKit {
    const spec = KIT_SPECS[arch];
    const noise = makeNoiseTexture(arch.length * 7919 + 13);
    if (noise) this.textures.push(noise);

    const std = (c: string, metal: number, rough: number, flat = false) => {
      const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), metalness: metal, roughness: rough, flatShading: flat });
      if (noise) {
        m.roughnessMap = noise;
        m.bumpMap = noise;
        m.bumpScale = 0.015;
      }
      this.mats.push(m);
      return m;
    };
    // Glow zone: faction emissive, blended slightly toward the passed accent so the
    // ship still reads as "this player's colour". Intensity stays in the 0.8–1.2 band.
    const glowCol = new THREE.Color(spec.glow.color).lerp(new THREE.Color(accentHex), 0.25);
    const glow = new THREE.MeshStandardMaterial({
      color: glowCol, emissive: glowCol, emissiveIntensity: 1.0, metalness: 0.0, roughness: 0.4,
    });
    this.mats.push(glow);
    this.glowMats.push(glow);

    return {
      armor: std(spec.armor.color, spec.armor.metal, spec.armor.rough, spec.armor.flat),
      panel: std(spec.panel.color, spec.panel.metal, spec.panel.rough, spec.panel.flat),
      trim: std(spec.trim.color, spec.trim.metal, spec.trim.rough),
      glow,
    };
  }

  // --- primitive helpers (track geo, add to group) ------------------------------
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number], rot?: [number, number, number]): THREE.Mesh {
    this.geos.push(geo);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    this.group.add(m);
    return m;
  }

  // --- 1. CRIMSON PACT — Brutalist War-Economy Dreadnought ----------------------
  private buildCrimson() {
    const k = this.kit;
    // Heavy armoured fuselage.
    this.mesh(new THREE.BoxGeometry(3.2, 1.9, 6.6), k.armor, [0, 0, 0]);
    // Stepped, layered armour seams (roof + sides).
    this.mesh(new THREE.BoxGeometry(3.7, 0.45, 4.4), k.panel, [0, 1.05, -0.2]);
    this.mesh(new THREE.BoxGeometry(2.9, 0.4, 2.8), k.trim, [0, 1.45, -0.8]);
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(0.5, 1.3, 4.6), k.panel, [sx * 1.75, -0.1, 0.1]);
      this.mesh(new THREE.BoxGeometry(0.35, 0.7, 3.0), k.trim, [sx * 1.95, 0.2, -0.4]); // crimson paint stripe
    }
    // Sharp 4-sided downward nose.
    this.mesh(new THREE.ConeGeometry(1.7, 2.6, 4), k.armor, [0, -0.15, -4.0], [-Math.PI / 2 + 0.2, Math.PI / 4, 0]);
    // Cockpit visor (amber emissive).
    this.mesh(new THREE.BoxGeometry(1.7, 0.45, 0.7), k.glow, [0, 0.7, -2.6]);
    // Rectangular blocky thruster pods + emissive exits.
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.BoxGeometry(1.1, 1.3, 1.9), k.panel, [sx * 1.15, -0.15, 3.6]);
      this.mesh(new THREE.BoxGeometry(0.78, 0.95, 0.25), k.glow, [sx * 1.15, -0.15, 4.6]);
    }
    // Mechanical unload ramp (hinged at the fuselage rear edge).
    const ramp = this.mesh(new THREE.BoxGeometry(2.5, 0.28, 2.4), k.trim, [0, -0.85, 3.1]);
    ramp.geometry.translate(0, 0, 1.2);
    ramp.position.set(0, -0.85, 2.6);
    this.ramp = ramp;
  }

  // --- 2. AZURE CONCORDE — Hydro-Aerodynamic Sub-Orbital Cruiser ----------------
  private buildAzure() {
    const k = this.kit;
    // Smooth elliptical capsule fuselage (cylinder laid along z, flattened in y).
    const body = this.mesh(new THREE.CylinderGeometry(1.25, 1.35, 6.6, 24, 1), k.armor, [0, 0, 0.2], [Math.PI / 2, 0, 0]);
    body.scale.set(1, 1, 0.72); // ellipse cross-section (local y is along the hull)
    // Smooth blended nose cone.
    this.mesh(new THREE.ConeGeometry(1.25, 2.8, 24), k.armor, [0, -0.05, -3.9], [-Math.PI / 2, 0, 0]);
    // Swept crescent manta wings (thin, curved back + down).
    for (const sx of [-1, 1]) {
      const wing = this.mesh(new THREE.CylinderGeometry(2.2, 0.25, 0.14, 3, 1), k.panel, [sx * 2.4, -0.15, 1.0], [Math.PI / 2, 0, sx * 0.5]);
      wing.scale.set(1, 1.7, 1);
      wing.rotation.z = sx * 0.34;
      // pale-aqua intake panel
      this.mesh(new THREE.BoxGeometry(0.5, 0.5, 2.4), k.panel, [sx * 1.05, 0.1, 0.4]);
    }
    // Cyan power trim lines along the hull.
    for (const sx of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.06, 0.12, 4.6), k.glow, [sx * 1.05, 0.55, 0.3]);
    // Thrusters recessed INSIDE the rear hull (dark recess + glowing core).
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16), k.trim, [sx * 0.6, 0, 3.4], [Math.PI / 2, 0, 0]);
      this.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 16), k.glow, [sx * 0.6, 0, 3.5], [Math.PI / 2, 0, 0]);
    }
    // Belly hatch (lowers gently — no big mechanical ramp).
    const hatch = this.mesh(new THREE.BoxGeometry(1.8, 0.18, 2.2), k.panel, [0, -0.75, 0.6]);
    hatch.geometry.translate(0, 0, 1.0);
    hatch.position.set(0, -0.75, -0.4);
    this.ramp = hatch;
  }

  // --- 3. VERDANT SWARM — Bio-Engineered Chitinous Bio-Pod ----------------------
  private buildVerdant() {
    const k = this.kit;
    // Segmented abdomen — chained spheres scaling down toward the rear.
    const seg: [number, number][] = [[1.45, -1.6], [1.2, 0.1], [0.98, 1.6], [0.78, 2.9]];
    for (const [r, z] of seg) {
      const s = this.mesh(new THREE.SphereGeometry(r, 10, 8), k.armor, [0, 0, z]);
      s.scale.set(1, 0.9, 1.15);
    }
    // Head + scissor mandibles at the front.
    this.mesh(new THREE.SphereGeometry(0.95, 10, 8), k.armor, [0, 0.05, -3.0]);
    for (const sx of [-1, 1]) {
      const mand = this.mesh(new THREE.ConeGeometry(0.18, 1.6, 5), k.trim, [sx * 0.55, -0.1, -3.7], [-Math.PI / 2 + 0.5, 0, sx * 0.5]);
      mand.scale.set(1, 1, 0.6);
    }
    // Hyper-thin translucent dragonfly wings.
    const wingMat = k.panel.clone();
    wingMat.transparent = true;
    wingMat.opacity = 0.55;
    wingMat.side = THREE.DoubleSide;
    this.mats.push(wingMat);
    for (const sx of [-1, 1]) {
      const w1 = this.mesh(new THREE.PlaneGeometry(3.4, 1.1), wingMat, [sx * 2.0, 0.6, -0.2], [Math.PI / 2, 0, sx * 0.35]);
      w1.rotation.z = sx * 0.5;
      const w2 = this.mesh(new THREE.PlaneGeometry(2.6, 0.9), wingMat, [sx * 1.8, 0.4, 1.0], [Math.PI / 2, 0, sx * 0.35]);
      w2.rotation.z = sx * 0.62;
    }
    // Pulsing bio-veins (toxic-green emissive) along the spine.
    for (const z of [-1.0, 0.4, 1.8]) this.mesh(new THREE.SphereGeometry(0.22, 8, 6), k.glow, [0, 0.9, z]);
    // Organic shell-flaps underneath (deform open instead of a ramp).
    const flaps = new THREE.Group();
    for (const sx of [-1, 1]) {
      const geo = new THREE.BoxGeometry(0.9, 0.16, 2.2);
      this.geos.push(geo);
      const flap = new THREE.Mesh(geo, k.armor);
      flap.position.set(sx * 0.5, -0.9, 0.3);
      flaps.add(flap);
    }
    this.group.add(flaps);
    this.ramp = flaps;
  }

  // --- 4. SOLAR DOMINION — Levitating Bio-Mineral Sun-Prisma --------------------
  private buildSolar() {
    const k = this.kit;
    // Vertical faceted crystal pillar = hex bipyramid (flat-shaded).
    this.mesh(new THREE.ConeGeometry(1.25, 2.8, 6), k.armor, [0, 1.1, 0]); // up
    this.mesh(new THREE.ConeGeometry(1.25, 1.8, 6), k.armor, [0, -0.6, 0], [Math.PI, 0, 0]); // down
    // Glowing solar core at the crystal's heart.
    this.mesh(new THREE.IcosahedronGeometry(0.55, 0), k.glow, [0, 0.6, 0]);
    // Levitating drive rings — translated OUTWARD with a visible air gap (no contact).
    for (const sx of [-1, 1]) {
      this.mesh(new THREE.TorusGeometry(0.6, 0.16, 6, 12), k.panel, [sx * 2.4, 0.3, 0], [0, Math.PI / 2, 0]);
      // floating core inside each ring
      this.mesh(new THREE.IcosahedronGeometry(0.26, 0), k.glow, [sx * 2.4, 0.3, 0]);
    }
    // A low golden base disc that floats just under the crystal.
    this.mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.3, 6), k.trim, [0, -1.5, 0]);
    // Solar reads slightly small vs the heavy Crimson bomber → bump its whole mass
    // 1.25× so it carries the same on-screen presence. Pivot stays at the origin, so
    // landing/unload offsets are unaffected.
    for (const c of this.group.children) {
      c.scale.multiplyScalar(1.25);
      c.position.multiplyScalar(1.25); // scale layout too → uniform 1.25× incl. ring gaps
    }
    // Solar has no mechanical ramp — units manifest beneath the levitating prism.
    this.ramp = undefined;
  }

  // --- animation (unchanged contract) -------------------------------------------
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
      rampOpen = ease(Math.min(1, p * 1.4));
    } else if (state === 'departing') {
      y = groundY + THREE.MathUtils.lerp(REST_Y, SKY_Y, p);
      x = landingX + THREE.MathUtils.lerp(0, -ENTER_DX, p);
      z = landingZ + THREE.MathUtils.lerp(0, -ENTER_DZ, p);
      rampOpen = ease(1 - p);
    }

    this.group.position.set(x, y, z);
    if (this.ramp) this.ramp.rotation.x = rampOpen * (Math.PI / 2.4);
    // Subtle engine throb (kept within ~0.8–1.2 so it never blows out the bloom).
    const throb = 1.0 + 0.18 * Math.sin(elapsed * 9);
    for (const m of this.glowMats) m.emissiveIntensity = throb;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
    for (const geo of this.geos) geo.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.textures) t.dispose();
  }
}
