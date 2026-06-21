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
  // Brutalist war-economy: graphite alloy + reinforced-paneling albedo, amber emissive.
  crimson: {
    armor: { color: '#2c2e33', metal: 0.85, rough: 0.45, flat: true },
    panel: { color: '#4d525e', metal: 0.6, rough: 0.8, flat: true },
    trim: { color: '#9e3329', metal: 0.5, rough: 0.7 },
    glow: { color: '#ff9a3c' },
  },
  // Hydro-aerodynamic: pearl-white ceramic shell albedo, pale-aqua panels, cyan emissive.
  azure: {
    armor: { color: '#f6f7f9', metal: 0.1, rough: 0.15 },
    panel: { color: '#a9cfe0', metal: 0.35, rough: 0.3 },
    trim: { color: '#6fb7d6', metal: 0.45, rough: 0.35 },
    glow: { color: '#45d8ff' },
  },
  // Bio-engineered chitin: segmented-scale carapace albedo, green tissue, toxic veins.
  verdant: {
    armor: { color: '#3a2e2b', metal: 0.0, rough: 0.85, flat: true },
    panel: { color: '#5f8f3a', metal: 0.1, rough: 0.6 },
    trim: { color: '#3c6b2a', metal: 0.1, rough: 0.7 },
    glow: { color: '#9cff5a' },
  },
  // Levitating bio-mineral: ivory sunburst crystal albedo, golden mineral, core emissive.
  solar: {
    armor: { color: '#f3eace', metal: 0.2, rough: 0.25, flat: true },
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

/**
 * Runtime 256² canvas albedo for the main hull, one stylised pattern per faction.
 * Patterns are drawn at low globalAlpha so they read as surface detail from the RTS
 * camera height, never as noise. Headless-safe (returns null without `document`).
 */
function makeFactionAlbedo(arch: Archetype): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  let repeat = 2;

  if (arch === 'crimson') {
    // Subtle reinforced metal paneling: graphite base + steel grid + recessed rivets.
    ctx.fillStyle = '#2c2e33';
    ctx.fillRect(0, 0, S, S);
    const cell = 64;
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#474b54';
    ctx.lineWidth = 3;
    for (let p = 0; p <= S; p += cell) {
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(S, p); ctx.stroke();
    }
    // faint highlight line just inside each panel for a stamped-steel bevel
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#5a5f69';
    ctx.lineWidth = 1;
    for (let p = cell; p <= S; p += cell) {
      ctx.beginPath(); ctx.moveTo(p - 4, 0); ctx.lineTo(p - 4, S); ctx.stroke();
    }
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#16171a';
    for (let x = 0; x < S; x += cell) {
      for (let y = 0; y < S; y += cell) {
        for (const [dx, dy] of [[6, 6], [cell - 9, 6], [6, cell - 9], [cell - 9, cell - 9]]) {
          ctx.fillRect(x + dx, y + dy, 3, 3);
        }
      }
    }
    repeat = 3;
  } else if (arch === 'azure') {
    // Flowing aquatic ceramic: pearlescent horizontal gradient + concentric wave arcs.
    const grad = ctx.createLinearGradient(0, 0, S, 0);
    grad.addColorStop(0, '#f6f7f9');
    grad.addColorStop(1, '#edeff4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = '#d4dae3';
    ctx.lineWidth = 3;
    for (let i = -1; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(S * 0.2, S * 0.5, 34 + i * 34, -Math.PI / 2.1, Math.PI / 2.1);
      ctx.stroke();
    }
    repeat = 1;
  } else if (arch === 'verdant') {
    // Segmented chitin scales: repeating hexagonal carapace plates.
    ctx.fillStyle = '#3a2e2b';
    ctx.fillRect(0, 0, S, S);
    const r = 22;
    const hStep = r * 1.5;
    const vStep = r * Math.sqrt(3);
    ctx.lineWidth = 2.5;
    let row = 0;
    for (let cy = 0; cy <= S + vStep; cy += vStep, row++) {
      for (let cx = 0; cx <= S + hStep; cx += hStep * 2) {
        const ox = (row % 2) * hStep + cx;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#4d3d37';
        ctx.strokeStyle = '#211a17';
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const ang = (Math.PI / 3) * a;
          const px = ox + r * Math.cos(ang);
          const py = cy + r * Math.sin(ang);
          if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    repeat = 3;
  } else {
    // Solar: radiant sunburst — fine radial lines + a few branching crystalline cracks.
    ctx.fillStyle = '#f3eace';
    ctx.fillRect(0, 0, S, S);
    const cxp = S / 2, cyp = S / 2;
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#ffec7a';
    ctx.lineWidth = 1.3;
    const rays = 72;
    for (let i = 0; i < rays; i++) {
      const ang = (Math.PI * 2 * i) / rays;
      ctx.beginPath();
      ctx.moveTo(cxp, cyp);
      ctx.lineTo(cxp + Math.cos(ang) * S, cyp + Math.sin(ang) * S);
      ctx.stroke();
    }
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const ang = (Math.PI * 2 * i) / 8 + 0.3;
      let x = cxp, y = cyp;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += Math.cos(ang + (s % 2 ? 0.4 : -0.4)) * 16;
        y += Math.sin(ang + (s % 2 ? 0.4 : -0.4)) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    repeat = 1;
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Translucent insect/dragonfly wing membrane with branching venation, baked into
 * the alpha channel so the wing reads as a veined see-through membrane. `veinHex`
 * = vein/edge colour, `membraneHex` = faint membrane tint. Headless-safe.
 */
function makeWingTexture(veinHex: string, membraneHex: string): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const W = 256, H = 160;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H);

  // Faint membrane so the wing isn't fully invisible between veins.
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = membraneHex;
  ctx.fillRect(0, 0, W, H);

  // Longitudinal main veins fanning from the wing root (left) to the tip (right).
  const roots = [H * 0.5, H * 0.32, H * 0.68, H * 0.18, H * 0.82];
  const tips = [H * 0.5, H * 0.15, H * 0.85, H * 0.05, H * 0.95];
  ctx.strokeStyle = veinHex;
  ctx.lineWidth = 2.2;
  ctx.globalAlpha = 0.7;
  const mains: { y0: number; y1: number }[] = [];
  for (let i = 0; i < roots.length; i++) {
    ctx.beginPath();
    ctx.moveTo(2, roots[i]);
    ctx.bezierCurveTo(W * 0.4, (roots[i] + tips[i]) / 2, W * 0.7, tips[i], W - 2, tips[i]);
    ctx.stroke();
    mains.push({ y0: roots[i], y1: tips[i] });
  }
  // Leading-edge spar (thicker).
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(2, tips[3]); ctx.lineTo(W - 2, tips[3]); ctx.stroke();

  // Cross-venation: dense short connectors → the characteristic dragonfly cells.
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let x = 12; x < W - 8; x += 13) {
    const t = x / W;
    const ys = mains.map((m) => m.y0 + (m.y1 - m.y0) * t).sort((a, b) => a - b);
    for (let j = 0; j < ys.length - 1; j++) {
      const jitter = ((x * 7 + j * 31) % 9) - 4;
      ctx.beginPath();
      ctx.moveTo(x, ys[j]);
      ctx.lineTo(x + jitter, ys[j + 1]);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
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

    // Global presence bump: all four ships ~25% larger. Uniform scale around the
    // group origin → pivot/landing offsets unaffected; Solar's internal 1.25× mass
    // parity with Crimson is preserved (both grow by the same factor).
    g.scale.setScalar(1.25);

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

    // Main hull gets a faction-specific runtime canvas albedo on its .map.
    const armor = std(spec.armor.color, spec.armor.metal, spec.armor.rough, spec.armor.flat);
    const albedo = makeFactionAlbedo(arch);
    if (albedo) {
      armor.map = albedo;
      armor.needsUpdate = true;
      this.textures.push(albedo);
    }
    return {
      armor,
      panel: std(spec.panel.color, spec.panel.metal, spec.panel.rough, spec.panel.flat),
      trim: std(spec.trim.color, spec.trim.metal, spec.trim.rough),
      glow,
    };
  }

  /** Translucent veined dragonfly-wing material (tracked for disposal). */
  private wingMaterial(veinHex: string, membraneHex: string): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({
      color: '#ffffff', transparent: true, side: THREE.DoubleSide,
      roughness: 0.4, metalness: 0.0, depthWrite: false,
    });
    const tex = makeWingTexture(veinHex, membraneHex);
    if (tex) {
      m.map = tex; // colour + per-texel alpha (membrane vs veins)
      m.alphaMap = tex;
      this.textures.push(tex);
    } else {
      m.opacity = 0.55; // headless fallback
    }
    m.needsUpdate = true;
    this.mats.push(m);
    return m;
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
    // Swept dragonfly wings (veined translucent membrane), swept back + down.
    const azureWing = this.wingMaterial('#8fd6f0', '#dff4ff');
    for (const sx of [-1, 1]) {
      const wing = this.mesh(new THREE.PlaneGeometry(3.4, 1.7), azureWing, [sx * 2.5, 0.0, 0.9], [Math.PI / 2, 0, 0]);
      wing.rotation.z = sx * 0.32; // sweep
      wing.rotation.x = Math.PI / 2 - 0.18; // slight downward cant
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
    // Hyper-thin translucent dragonfly wings with veined membrane texture.
    const wingMat = this.wingMaterial('#9cff5a', '#3f7a2c');
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
