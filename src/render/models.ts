// Procedural models for every unit and building. Each template merges its
// primitives into four geometries (body / dark / accent / light) so an entity
// costs at most 4 draw calls. Parts can be tagged with an animation channel:
//   turret - aims at the current target (rotates around a per-model pivot)
//   spin   - idle rotation + gentle bob (cores, halos, prisms)
//   load   - harvester cargo (scaled by how full the hopper is)
// Accent parts glow in the owner faction's color; light parts are
// cool-white windows and lamps that softly pulse.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILE } from '../map/map';
import type { UnitVisual } from '../core/types';
import { textureSetUsable } from '../data/artMetadata';
import { getVariant } from '../vehicles';
import { buildVehicleParts } from './vehicleModels';

// 'smooth' = curved hero surfaces (domes) that look bad with a tiling texture;
// they get a plain shaded material instead.
export type Slot = 'body' | 'dark' | 'accent' | 'light' | 'smooth' | 'roof';
export type AnimName = 'turret' | 'spin' | 'load';
/** Pre-transform geometry spec, captured so a Part can be exported to vehicle-spec. */
export interface PartSpecMeta { prim: string; size: number[]; round?: number; pos: number[]; rot: number[]; scale: number[] }
export interface Part { geo: THREE.BufferGeometry; slot: Slot; anim?: AnimName; spec?: PartSpecMeta }

// Tags each primitive geometry with the prim + args it was built from, so P()
// can record a Part's full vehicle-spec description before the transform is
// baked into the geometry. Keyed weakly so it never holds geometries alive.
export const GEO_SPEC = new WeakMap<THREE.BufferGeometry, { prim: string; size: number[]; round?: number }>();
export function tagGeo(g: THREE.BufferGeometry, prim: string, size: number[], round?: number): THREE.BufferGeometry {
  GEO_SPEC.set(g, { prim, size, round });
  return g;
}

const bodyMat = new THREE.MeshStandardMaterial({ color: '#7d8398', roughness: 0.55, metalness: 0.4 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#262834', roughness: 0.8, metalness: 0.25 });
// Vehicle hull: weathered riveted metal texture (set up after loadTex below).
let vehicleBodyMat: THREE.MeshStandardMaterial | null = null;
const lightMat = new THREE.MeshStandardMaterial({ color: '#cfe8ff', emissive: '#9fcaff', emissiveIntensity: 1.1, roughness: 0.4 });
const accentMats = new Map<string, THREE.MeshStandardMaterial>();

// Generierte Sci-Fi-Texturen (Nano Banana) fuer Gebaeude. Asynchron geladen;
// Three.js zeigt sie automatisch an, sobald sie da sind.
const texLoader = new THREE.TextureLoader();
function loadTex(url: string, repeat = 1): THREE.Texture {
  const t = texLoader.load(url);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat); // hoeheres repeat = mehr Paneele pro Flaeche
  return t;
}
// Verdichtet (repeat 2): grosse Gebaeudeflaechen zeigen mehr Paneele, also
// mehr sichtbares Detail aus RTS-Distanz. Farbe hell, damit die Textur dominiert
// und Schattenseiten nicht absaufen.
const buildingBodyMat = new THREE.MeshStandardMaterial({
  color: '#e6eaf2', map: loadTex('/assets/buildings/common/hull.png', 2),
  roughness: 0.6, metalness: 0.45,
});
const buildingDarkMat = new THREE.MeshStandardMaterial({
  color: '#ffffff', map: loadTex('/assets/buildings/common/panels.png', 2),
  roughness: 0.7, metalness: 0.3,
});
// Kuppel-Material: kleinteilige Nieten-/Luftschlitz-Textur (repeat 3, damit das
// Muster auf der Kugel nicht verzerrt wirkt).
const smoothMat = new THREE.MeshStandardMaterial({
  color: '#eef0f6', map: loadTex('/assets/buildings/common/dome.png', 3),
  roughness: 0.45, metalness: 0.5,
});
// Dach-Material: technische Aufbauten von oben (Lüfter, Luken, Rohre).
const roofMat = new THREE.MeshStandardMaterial({
  color: '#c6ccda', map: loadTex('/assets/buildings/common/roof.png', 1),
  roughness: 0.7, metalness: 0.35,
});
// Fahrzeug-Hülle: verwittertes Metall, kleinteilig gekachelt (repeat 2).
vehicleBodyMat = new THREE.MeshStandardMaterial({
  color: '#aab0c4', map: loadTex('/assets/vehicles/common/hull.png', 2),
  roughness: 0.6, metalness: 0.5,
});
// Rollen-spezifische Hüllen-Texturen, damit Sammler/Baufahrzeug/Kampf- und
// Verteidigungseinheiten unterschiedlich aussehen.
const vehHull = (role: string) => new THREE.MeshStandardMaterial({
  color: '#d2d7e6', map: loadTex(`/assets/vehicles/${role}/hull.png`, 2),
  roughness: 0.55, metalness: 0.45,
});
// Darker variant of the same hull texture for the vehicle's panel ("dark")
// slot, so the WHOLE body shows plating instead of flat black panels.
const vehHullDark = (role: string) => new THREE.MeshStandardMaterial({
  color: '#737994', map: loadTex(`/assets/vehicles/${role}/hull.png`, 2),
  roughness: 0.62, metalness: 0.4,
});
export interface HullMats { body: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial }
const VEH_ROLE_MAT: Record<string, HullMats> = {
  harvester: { body: vehHull('harvester'), dark: vehHullDark('harvester') },
  fabricator: { body: vehHull('fabricator'), dark: vehHullDark('fabricator') },
  attack: { body: vehHull('attack'), dark: vehHullDark('attack') },
  defense: { body: vehHull('defense'), dark: vehHullDark('defense') },
};
/** Role fallback per unit class (used until a faction texture set is approved). */
const CLASS_ROLE_FALLBACK: Record<string, keyof typeof VEH_ROLE_MAT> = {
  harvester: 'harvester', builder: 'fabricator', support: 'defense', antiAir: 'defense',
  scout: 'attack', lightAttack: 'attack', mediumTank: 'attack', heavyTank: 'attack',
  // legacy ids
  fabricator: 'fabricator', dartcycle: 'attack', vanguard: 'attack', earthshaker: 'attack',
};
// Per-variant generated texture sets (public/assets/vehicles/<set>/baseColor.png),
// loaded lazily and only when the art metadata marks the set generated/approved.
const variantMatCache = new Map<string, HullMats>();
function variantHullMat(textureSetId: string): HullMats {
  let m = variantMatCache.get(textureSetId);
  if (!m) {
    const url = `/assets/vehicles/${textureSetId}/baseColor.png`;
    m = {
      body: new THREE.MeshStandardMaterial({
        color: '#d2d7e6', map: loadTex(url, 2), roughness: 0.55, metalness: 0.45,
      }),
      dark: new THREE.MeshStandardMaterial({
        color: '#737994', map: loadTex(url, 2), roughness: 0.62, metalness: 0.4,
      }),
    };
    variantMatCache.set(textureSetId, m);
  }
  return m;
}
/** Hull material pair for a vehicle: generated faction set -> role fallback. */
function vehicleHullMat(defId: string, visual?: UnitVisual): HullMats {
  if (visual?.textureSetId && textureSetUsable(visual.artMetadataId)) {
    return variantHullMat(visual.textureSetId);
  }
  return VEH_ROLE_MAT[CLASS_ROLE_FALLBACK[defId] ?? 'attack'];
}
// Fundament-Pad. Waehrend des Baus: Riffelblech mit gelb-grünem Warnrand.
// Fertig: dezente dunkle Metallplatte (hull dunkel getoent, kein Warnrand).
export const foundationBuildMat = new THREE.MeshStandardMaterial({
  color: '#ffffff', map: loadTex('/assets/buildings/common/foundation.png'),
  roughness: 0.8, metalness: 0.3,
});
export const foundationDoneMat = new THREE.MeshStandardMaterial({
  color: '#5a6078', map: loadTex('/assets/buildings/common/hull.png', 2),
  roughness: 0.85, metalness: 0.35,
});
const foundationPadGeoCache = new Map<string, THREE.BufferGeometry>();
/** Texturiertes Fundament-Pad unter einem Gebaeude (Footprint in Welt-Einheiten). */
export function makeFoundationPad(wWorld: number, dWorld: number, complete: boolean): THREE.Mesh {
  const key = `${wWorld}x${dWorld}`;
  let geo = foundationPadGeoCache.get(key);
  if (!geo) {
    geo = new THREE.PlaneGeometry(wWorld * 1.12, dWorld * 1.12);
    geo.rotateX(-Math.PI / 2);
    foundationPadGeoCache.set(key, geo);
  }
  const m = new THREE.Mesh(geo, complete ? foundationDoneMat : foundationBuildMat);
  m.position.y = 0.07;
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

export function accentMat(colorHex: string): THREE.MeshStandardMaterial {
  let m = accentMats.get(colorHex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: colorHex, emissive: colorHex, emissiveIntensity: 1.05, roughness: 0.35, metalness: 0.2,
    });
    accentMats.set(colorHex, m);
  }
  return m;
}

/** Soft global pulse on lit windows/lamps; called once per frame. */
export function pulseLights(time: number) {
  lightMat.emissiveIntensity = 1.0 + 0.2 * Math.sin(time * 2.2);
}

export function P(
  geo: THREE.BufferGeometry, slot: Slot,
  x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1,
): Part {
  const m = new THREE.Matrix4()
    .makeRotationFromEuler(new THREE.Euler(rx, ry, rz))
    .scale(new THREE.Vector3(sx, sy, sz))
    .setPosition(x, y, z);
  // Capture the pre-transform spec (prim + args + this call's transform) so the
  // part can be exported to vehicle-spec. Read before the matrix is baked in.
  const tag = GEO_SPEC.get(geo);
  const spec: PartSpecMeta | undefined = tag
    ? { ...tag, pos: [x, y, z], rot: [rx, ry, rz], scale: [sx, sy, sz] }
    : undefined;
  // toNonIndexed: primitive types mix indexed and non-indexed geometry,
  // and mergeGeometries requires them to be uniform.
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  return { geo: g.applyMatrix4(m), slot, spec };
}

/** Tag a part with an animation channel. */
export function A(anim: AnimName, part: Part): Part {
  part.anim = anim;
  return part;
}

export const box = (w: number, h: number, d: number) => tagGeo(new THREE.BoxGeometry(w, h, d), 'box', [w, h, d]);
export const cyl = (rt: number, rb: number, h: number, seg = 10) => tagGeo(new THREE.CylinderGeometry(rt, rb, h, seg), 'cyl', [rt, rb, h]);
export const sph = (r: number, seg = 12) => tagGeo(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), 'sph', [r]);
export const cone = (r: number, h: number, seg = 8) => tagGeo(new THREE.ConeGeometry(r, h, seg), 'cone', [r, h]);
export const octa = (r: number) => new THREE.OctahedronGeometry(r); // buildings only; not a vehicle-spec prim
export const torus = (r: number, t: number) => tagGeo(new THREE.TorusGeometry(r, t, 8, 20), 'torus', [r, t]);

interface SlotGeos { body: THREE.BufferGeometry | null; dark: THREE.BufferGeometry | null; accent: THREE.BufferGeometry | null; light: THREE.BufferGeometry | null; smooth: THREE.BufferGeometry | null; roof: THREE.BufferGeometry | null }
export interface Template {
  static: SlotGeos;
  anims: Partial<Record<AnimName, SlotGeos>>;
  topY: number;
}
const templateCache = new Map<string, Template>();

/** Turret pivot per model (animation parts are re-based around this point). */
const TURRET_PIVOTS: Record<string, [number, number, number]> = {
  'unit:vanguard': [0, 1.36, -0.05],
  'unit:earthshaker': [0, 1.55, -0.55],
  'building:cannon': [0, 1.45, 0],
};

function mergeSlots(parts: Part[]): SlotGeos {
  const by: Record<Slot, THREE.BufferGeometry[]> = { body: [], dark: [], accent: [], light: [], smooth: [], roof: [] };
  for (const p of parts) by[p.slot].push(p.geo);
  const merge = (gs: THREE.BufferGeometry[]) => (gs.length ? mergeGeometries(gs) : null);
  return { body: merge(by.body), dark: merge(by.dark), accent: merge(by.accent), light: merge(by.light), smooth: merge(by.smooth), roof: merge(by.roof) };
}

function makeTemplate(key: string, parts: Part[]): Template {
  const cached = templateCache.get(key);
  if (cached) return cached;
  const staticParts = parts.filter(p => !p.anim);
  const t: Template = { static: mergeSlots(staticParts), anims: {}, topY: 0 };
  for (const anim of ['turret', 'spin', 'load'] as AnimName[]) {
    const ap = parts.filter(p => p.anim === anim);
    if (!ap.length) continue;
    if (anim === 'turret') {
      const pivot = TURRET_PIVOTS[key] ?? [0, 0, 0];
      const m = new THREE.Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]);
      for (const p of ap) p.geo.applyMatrix4(m);
    }
    t.anims[anim] = mergeSlots(ap);
  }
  const scan = (sg: SlotGeos, lift = 0) => {
    for (const g of [sg.body, sg.dark, sg.accent, sg.light, sg.smooth, sg.roof]) {
      if (!g) continue;
      g.computeBoundingBox();
      t.topY = Math.max(t.topY, g.boundingBox!.max.y + lift);
    }
  };
  scan(t.static);
  for (const [name, sg] of Object.entries(t.anims)) {
    scan(sg, name === 'turret' ? (TURRET_PIVOTS[key]?.[1] ?? 0) : 0);
  }
  templateCache.set(key, t);
  return t;
}

// ---------------- shared detail helpers ----------------

/** Tank treads: dark track blocks with road wheels suggested by cylinders. */
function treads(p: Part[], halfW: number, len: number, h = 0.5) {
  for (const side of [-1, 1]) {
    p.push(P(box(0.42, h, len), 'dark', side * halfW, h / 2 + 0.05, 0));
    p.push(P(box(0.46, h * 0.35, len * 1.02), 'dark', side * halfW, h * 0.82, 0));
    for (let i = 0; i < 4; i++) {
      p.push(P(cyl(0.16, 0.16, 0.1, 8), 'body', side * (halfW + 0.18), 0.22, -len / 2 + 0.35 + i * (len - 0.7) / 3, 0, 0, Math.PI / 2));
    }
  }
}

/** Infantry base: torso, head with visor, legs, shoulder pads, backpack. */
function infantryBase(p: Part[], visorSlot: Slot = 'accent') {
  p.push(
    P(cyl(0.15, 0.2, 0.52, 8), 'body', 0, 0.5),               // torso
    P(box(0.4, 0.1, 0.24), 'body', 0, 0.72),                   // shoulders
    P(sph(0.13, 10), 'dark', 0, 0.95),                          // helmet
    P(box(0.16, 0.07, 0.06), visorSlot, 0, 0.94, 0.11),         // visor
    P(box(0.09, 0.34, 0.1), 'dark', -0.1, 0.17, 0),             // legs
    P(box(0.09, 0.34, 0.1), 'dark', 0.1, 0.17, 0),
    P(box(0.24, 0.3, 0.12), 'dark', 0, 0.55, -0.2),             // backpack
    P(box(0.06, 0.06, 0.06), 'accent', 0, 0.72, -0.24),         // pack light
  );
}

// ---------------- unit templates ----------------

function unitParts(defId: string): Part[] {
  const p: Part[] = [];
  switch (defId) {
    case 'fabricator':
      treads(p, 0.85, 2.2, 0.55);
      p.push(
        P(box(1.45, 0.6, 2.1), 'body', 0, 0.85),
        P(box(1.5, 0.1, 2.15), 'dark', 0, 1.18),
        P(box(1.15, 0.55, 0.7), 'accent', 0, 1.45, -0.6),        // cab
        P(box(0.95, 0.12, 0.5), 'light', 0, 1.5, -0.22),          // cab window strip
        P(box(0.2, 0.2, 1.7), 'body', 0.3, 1.6, 0.5, -0.55),      // crane boom
        P(box(0.16, 0.5, 0.16), 'dark', 0.3, 1.45, 1.25),         // crane head
        A('spin', P(sph(0.15, 8), 'accent', 0.3, 1.15, 1.25)),    // welder tip
        P(box(0.5, 0.3, 0.5), 'dark', -0.45, 1.35, 0.55),         // toolbox
        P(cyl(0.05, 0.05, 0.8, 6), 'dark', -0.6, 1.8, -0.8),      // antenna
        P(sph(0.06, 6), 'accent', -0.6, 2.2, -0.8),
        P(box(1.35, 0.16, 0.3), 'accent', 0, 0.62, 1.15),         // warning bumper
      );
      break;
    case 'harvester':
      treads(p, 0.95, 2.45, 0.6);
      p.push(
        P(box(1.6, 0.7, 2.2), 'body', 0, 0.95),
        P(box(1.66, 0.12, 2.26), 'dark', 0, 1.32),
        P(box(1.35, 0.85, 1.2), 'body', 0, 1.75, -0.45),          // hopper
        A('load', P(box(1.15, 0.6, 1.0), 'accent', 0, 2.1, -0.45)), // glowing crystal load
        P(box(1.4, 0.5, 0.8), 'dark', 0, 0.55, 1.5, 0.55),        // intake scoop
        P(cyl(0.12, 0.12, 1.5, 8), 'dark', 0, 0.62, 1.45, 0, 0, Math.PI / 2), // intake drum
        P(box(0.8, 0.45, 0.55), 'body', 0, 1.5, 0.75),            // cab
        P(box(0.65, 0.12, 0.4), 'light', 0, 1.55, 0.95),          // cab glass
        P(cyl(0.09, 0.12, 0.55, 6), 'dark', -0.6, 1.6, -1.0),     // exhaust
      );
      break;
    case 'lancer':
      infantryBase(p);
      p.push(
        P(box(0.07, 0.08, 0.62), 'dark', 0.17, 0.62, 0.24),       // rifle
        P(box(0.05, 0.05, 0.12), 'accent', 0.17, 0.62, 0.56),     // muzzle glow
      );
      break;
    case 'breacher':
      infantryBase(p);
      p.push(
        P(cyl(0.1, 0.1, 0.78, 8), 'dark', 0.19, 0.85, 0.05, Math.PI / 2 - 0.2),
        P(cyl(0.12, 0.12, 0.14, 8), 'accent', 0.19, 0.95, 0.38, Math.PI / 2 - 0.2),
        P(box(0.3, 0.34, 0.16), 'accent', 0, 0.52, -0.22),        // heavy pack
      );
      break;
    case 'arcweaver':
      infantryBase(p, 'light');
      p.push(
        P(cyl(0.035, 0.035, 1.05, 6), 'dark', 0.23, 0.6, 0),      // staff
        A('spin', P(octa(0.13), 'accent', 0.23, 1.22, 0)),
        A('spin', P(torus(0.09, 0.02), 'accent', 0.23, 1.22, 0, Math.PI / 2)),
        P(box(0.32, 0.36, 0.18), 'dark', 0, 0.52, -0.24),         // capacitor pack
        P(box(0.05, 0.26, 0.05), 'accent', -0.1, 0.78, -0.28),    // coil
      );
      break;
    case 'dartcycle':
      p.push(
        P(box(0.75, 0.3, 1.65), 'body', 0, 0.55),
        P(cone(0.4, 0.95, 5), 'body', 0, 0.55, 1.2, Math.PI / 2),
        P(box(0.55, 0.1, 0.55), 'light', 0, 0.72, 0.35),          // canopy
        P(cyl(0.16, 0.16, 1.0, 8), 'accent', -0.55, 0.55, -0.25, Math.PI / 2),
        P(cyl(0.16, 0.16, 1.0, 8), 'accent', 0.55, 0.55, -0.25, Math.PI / 2),
        P(cyl(0.1, 0.14, 0.3, 8), 'dark', -0.55, 0.55, -0.85, Math.PI / 2), // thruster nozzles
        P(cyl(0.1, 0.14, 0.3, 8), 'dark', 0.55, 0.55, -0.85, Math.PI / 2),
        P(box(0.5, 0.16, 0.8), 'dark', 0, 0.3, -0.35),
        P(box(0.06, 0.06, 0.75), 'dark', 0, 0.68, 1.0),           // repeater barrel
        P(box(0.4, 0.05, 1.2), 'accent', 0, 0.22, 0.2),           // hover glow strip
      );
      break;
    case 'vanguard':
      treads(p, 0.82, 2.1, 0.55);
      p.push(
        P(box(1.4, 0.5, 2.05), 'body', 0, 0.85),
        P(box(1.46, 0.1, 2.1), 'dark', 0, 1.14),
        P(box(0.5, 0.14, 0.7), 'body', 0, 0.95, 1.2, -0.35),      // glacis
        P(cyl(0.52, 0.6, 0.42, 12), 'body', 0, 1.36),             // turret ring
        P(cyl(0.04, 0.04, 0.6, 6), 'dark', 0.45, 2.0, -0.4),      // antenna (hull)
        A('turret', P(box(0.78, 0.34, 0.95), 'body', 0, 1.6, -0.05)),
        A('turret', P(box(0.5, 0.12, 0.5), 'accent', 0, 1.82)),
        A('turret', P(cyl(0.08, 0.09, 1.45, 8), 'dark', 0, 1.6, 1.0, Math.PI / 2)),
        A('turret', P(cyl(0.11, 0.11, 0.26, 8), 'dark', 0, 1.6, 1.65, Math.PI / 2)),
        A('turret', P(box(0.16, 0.1, 0.4), 'dark', -0.35, 1.8, -0.3)),
        A('turret', P(box(0.2, 0.12, 0.2), 'light', 0.3, 1.55, 0.45)),
      );
      break;
    case 'earthshaker':
      treads(p, 1.05, 2.6, 0.65);
      p.push(
        P(box(1.85, 0.65, 2.5), 'body', 0, 1.0),
        P(box(1.9, 0.12, 2.55), 'dark', 0, 1.38),
        P(box(0.34, 0.55, 1.7), 'accent', -0.95, 1.5, -0.1),      // side armor
        P(box(0.34, 0.55, 1.7), 'accent', 0.95, 1.5, -0.1),
        P(box(0.85, 0.25, 0.9), 'dark', 0, 0.5, -1.5),            // rear spade
        P(cyl(0.1, 0.13, 0.7, 6), 'dark', -0.7, 1.85, -1.1),      // exhaust stacks
        P(cyl(0.1, 0.13, 0.7, 6), 'dark', 0.7, 1.85, -1.1),
        A('turret', P(box(1.0, 0.6, 1.25), 'body', 0, 1.65, -0.55)),
        A('turret', P(box(0.7, 0.16, 0.6), 'light', 0, 1.75, 0.15)),
        A('turret', P(cyl(0.13, 0.16, 2.3, 10), 'dark', 0, 2.05, 0.6, Math.PI / 2 - 0.45)),
        A('turret', P(cyl(0.18, 0.18, 0.3, 8), 'dark', 0, 2.45, 1.45, Math.PI / 2 - 0.45)),
      );
      break;
  }
  return p;
}

// ---------------- building templates ----------------

/** Foundation slab with corner trim, sized to a footprint in world units. */
function foundation(p: Part[], w: number, d: number) {
  p.push(P(box(w, 0.35, d), 'body', 0, 0.17));
  p.push(P(box(w + 0.25, 0.14, d + 0.25), 'dark', 0, 0.07));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.push(P(box(0.4, 0.5, 0.4), 'dark', sx * (w / 2 - 0.25), 0.25, sz * (d / 2 - 0.25)));
  }
}

/** Row of small emissive lamps along an edge. */
function lampRow(p: Part[], count: number, x0: number, x1: number, y: number, z: number, slot: Slot = 'light') {
  for (let i = 0; i < count; i++) {
    const x = x0 + (x1 - x0) * (count === 1 ? 0.5 : i / (count - 1));
    p.push(P(box(0.12, 0.08, 0.08), slot, x, y, z));
  }
}

function buildingParts(defId: string): Part[] {
  const p: Part[] = [];
  switch (defId) {
    case 'nexus':
      foundation(p, 5.7, 5.7);
      p.push(
        P(box(4.6, 0.85, 4.6), 'body', 0, 0.75),
        P(box(4.7, 0.16, 4.7), 'roof', 0, 1.25),
        P(sph(2.05, 18), 'smooth', 0, 1.35, 0, 0, 0, 0, 1, 0.66, 1),
        P(torus(1.62, 0.11), 'accent', 0, 2.05, 0, Math.PI / 2),
        P(torus(1.95, 0.07), 'dark', 0, 1.55, 0, Math.PI / 2),
        P(cyl(0.32, 0.32, 1.7, 8), 'dark', 0, 2.6),
        A('spin', P(octa(0.45), 'accent', 0, 3.75)),
        A('spin', P(torus(0.5, 0.04), 'accent', 0, 3.75, 0, Math.PI / 2)),
      );
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        p.push(
          P(box(0.55, 2.9, 0.55), 'body', sx * 2.35, 1.45, sz * 2.35),
          P(box(0.62, 0.3, 0.62), 'dark', sx * 2.35, 2.6, sz * 2.35),
          P(octa(0.24), 'accent', sx * 2.35, 3.15, sz * 2.35),
          P(box(0.12, 1.6, 0.12), 'light', sx * 2.35, 1.4, sz * (2.35 - 0.31 * sz * sz)),
        );
      }
      lampRow(p, 5, -2.0, 2.0, 1.1, 2.36);
      p.push(P(box(1.4, 0.7, 0.18), 'light', 0, 0.7, 2.31)); // entrance glow
      break;
    case 'refinery':
      foundation(p, 5.7, 3.7);
      p.push(
        P(cyl(1.05, 1.05, 2.5, 14), 'body', -1.6, 1.6, -0.55),    // main silo
        P(cyl(1.1, 1.1, 0.22, 14), 'dark', -1.6, 2.85, -0.55),
        P(torus(1.06, 0.06), 'dark', -1.6, 1.4, -0.55, Math.PI / 2),
        P(cyl(0.55, 0.55, 0.3, 12), 'accent', -1.6, 3.05, -0.55), // silo cap glow
        P(cyl(0.75, 0.75, 1.9, 12), 'dark', 0.1, 1.3, -0.8),      // secondary tank
        P(cyl(0.78, 0.78, 0.16, 12), 'body', 0.1, 2.3, -0.8),
        P(box(1.7, 1.1, 1.3), 'body', 1.7, 0.9, -0.7),            // processing block
        P(box(1.0, 0.4, 0.14), 'light', 1.7, 1.0, -0.02),          // windows
        P(cyl(0.16, 0.16, 1.4, 6), 'dark', 2.3, 2.0, -1.0),       // chimney
        P(cyl(0.2, 0.2, 0.12, 6), 'accent', 2.3, 2.75, -1.0),
        P(box(2.2, 0.14, 2.2), 'accent', 1.45, 0.43, 0.85),       // unload pad (glowing)
        P(box(2.4, 0.08, 2.4), 'dark', 1.45, 0.36, 0.85),
        P(box(0.22, 0.22, 2.6), 'dark', -0.3, 1.9, -0.6, 0, 0, Math.PI / 2), // overhead pipe
        P(torus(0.3, 0.06), 'dark', -0.3, 1.9, -0.6),
        P(cyl(0.08, 0.08, 1.1, 6), 'body', -2.6, 0.9, 0.9),       // valve mast
        P(sph(0.1, 6), 'accent', -2.6, 1.5, 0.9),
      );
      lampRow(p, 3, 0.6, 2.4, 0.55, 2.0, 'accent');
      break;
    case 'spire':
      foundation(p, 3.7, 3.7);
      p.push(
        P(cyl(1.0, 1.45, 1.6, 12), 'body', 0, 1.0),
        P(cyl(0.55, 0.95, 1.7, 12), 'body', 0, 2.55),
        P(cyl(0.26, 0.5, 1.5, 8), 'dark', 0, 4.05),
        P(torus(0.92, 0.1), 'accent', 0, 1.85, 0, Math.PI / 2),
        P(torus(0.62, 0.09), 'accent', 0, 3.1, 0, Math.PI / 2),
        P(torus(0.36, 0.07), 'accent', 0, 4.35, 0, Math.PI / 2),
        A('spin', P(sph(0.34, 12), 'accent', 0, 5.0)),
        A('spin', P(sph(0.5, 10), 'light', 0, 5.0, 0, 0, 0, 0, 1, 0.25, 1)), // halo disc
      );
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        p.push(
          P(box(0.3, 1.1, 0.3), 'dark', Math.cos(a) * 1.45, 0.65, Math.sin(a) * 1.45),
          P(box(0.1, 0.5, 0.1), 'light', Math.cos(a) * 1.45, 1.4, Math.sin(a) * 1.45),
          P(box(0.16, 0.16, 1.2), 'dark', Math.cos(a) * 0.8, 1.7, Math.sin(a) * 0.8, 0, -a + Math.PI / 2, 0.5),
        );
      }
      break;
    case 'barracks':
      foundation(p, 3.7, 3.0);
      p.push(
        P(box(3.3, 1.45, 2.6), 'body', 0, 0.95),
        P(box(3.45, 0.4, 2.05), 'roof', 0, 1.85),
        P(box(2.6, 0.22, 1.4), 'roof', 0, 2.12),
        P(box(1.0, 0.95, 0.16), 'accent', 0, 0.85, 1.32),
        P(box(1.2, 0.12, 0.2), 'dark', 0, 1.5, 1.34),
        P(box(0.5, 0.35, 0.12), 'light', -1.2, 1.25, 1.32),
        P(box(0.5, 0.35, 0.12), 'light', 1.2, 1.25, 1.32),
        P(box(0.5, 0.35, 0.1), 'light', -1.66, 1.25, 0, 0, Math.PI / 2),
        P(box(0.16, 2.2, 0.16), 'dark', -1.45, 1.5, -1.1),
        P(sph(0.12, 8), 'accent', -1.45, 2.7, -1.1),
        P(box(0.6, 0.5, 0.6), 'dark', 1.2, 2.3, -0.6),
        P(cyl(0.22, 0.22, 0.1, 8), 'body', 1.2, 2.6, -0.6),
        P(box(2.6, 0.08, 0.7), 'dark', 0, 0.42, 1.65),
      );
      lampRow(p, 4, -1.4, 1.4, 1.7, 1.34, 'accent');
      break;
    case 'foundry':
      foundation(p, 5.7, 5.0);
      p.push(
        P(box(4.9, 2.1, 3.9), 'body', 0, 1.35),
        P(box(5.05, 0.35, 4.05), 'roof', 0, 2.5),
        P(box(2.4, 0.7, 4.0), 'roof', 0, 2.9, 0, 0, 0, 0, 1, 1, 0.97),
        P(box(2.2, 0.3, 0.14), 'light', 0, 2.9, 1.96),
        P(box(1.9, 1.5, 0.2), 'accent', 0, 0.95, 1.98),
        P(box(2.2, 0.16, 0.26), 'dark', 0, 1.85, 1.99),
        P(box(2.4, 0.1, 1.6), 'dark', 0, 0.42, 2.6),
        P(box(0.36, 3.2, 0.36), 'body', -2.15, 1.6, 0),
        P(box(0.36, 3.2, 0.36), 'body', 2.15, 1.6, 0),
        P(box(4.7, 0.3, 0.5), 'dark', 0, 3.3, 0),
        A('spin', P(box(0.5, 0.5, 0.4), 'accent', 0.8, 3.0, 0)),  // crane trolley orbits
        P(cyl(0.34, 0.42, 1.9, 8), 'dark', 1.85, 3.3, -1.35),
        P(cyl(0.38, 0.38, 0.2, 8), 'accent', 1.85, 4.3, -1.35),
        P(cyl(0.26, 0.32, 1.4, 8), 'dark', 1.15, 3.0, -1.6),
        P(box(0.8, 0.5, 0.12), 'light', -1.6, 1.5, 1.98),
        P(box(1.2, 0.8, 1.0), 'dark', -2.0, 0.75, -1.6),
        P(torus(0.3, 0.07), 'accent', -2.0, 1.3, -1.6, Math.PI / 2),
      );
      lampRow(p, 5, -2.2, 2.2, 2.35, 2.04);
      break;
    case 'wall':
      p.push(
        P(box(2.0, 0.5, 2.0), 'dark', 0, 0.25),
        P(box(1.75, 0.9, 1.75), 'body', 0, 0.85),
        P(box(1.85, 0.2, 1.85), 'dark', 0, 1.35),
        P(box(1.3, 0.3, 1.3), 'body', 0, 1.55),
        P(box(1.1, 0.12, 1.1), 'accent', 0, 1.72),
        P(box(0.2, 0.5, 0.2), 'dark', -0.75, 1.6, -0.75),
        P(box(0.2, 0.5, 0.2), 'dark', 0.75, 1.6, 0.75),
      );
      break;
    case 'cannon':
      p.push(
        P(cyl(1.0, 1.2, 0.5, 12), 'dark', 0, 0.25),
        P(cyl(0.85, 1.0, 0.55, 12), 'body', 0, 0.75),
        P(torus(0.86, 0.07), 'accent', 0, 1.0, Math.PI / 2),
        P(cyl(0.5, 0.6, 0.4, 10), 'body', 0, 1.25),
        P(box(0.12, 0.4, 0.12), 'accent', 0, 0.55, 1.05),
        A('turret', P(box(0.95, 0.55, 1.15), 'body', 0, 1.65)),
        A('turret', P(box(0.7, 0.14, 0.7), 'dark', 0, 1.98)),
        A('turret', P(cyl(0.09, 0.1, 1.5, 8), 'dark', 0, 1.7, 0.95, Math.PI / 2)),
        A('turret', P(cyl(0.13, 0.13, 0.3, 8), 'dark', 0, 1.7, 1.7, Math.PI / 2)),
        A('turret', P(box(0.3, 0.2, 0.4), 'dark', -0.45, 1.9, -0.2)),
        A('turret', P(box(0.16, 0.1, 0.16), 'light', 0.35, 1.85, 0.4)),
      );
      break;
    case 'lance':
      p.push(
        P(cyl(0.95, 1.15, 0.5, 12), 'dark', 0, 0.25),
        P(cyl(0.75, 0.92, 0.6, 12), 'body', 0, 0.8),
        P(torus(0.78, 0.07), 'accent', 0, 1.08, Math.PI / 2),
        P(cone(0.5, 2.2, 6), 'dark', 0, 2.2),
        P(box(0.14, 1.6, 0.14), 'body', -0.42, 1.9, 0, 0, 0, 0.22),
        P(box(0.14, 1.6, 0.14), 'body', 0.42, 1.9, 0, 0, 0, -0.22),
        A('spin', P(octa(0.48), 'accent', 0, 3.55)),
        A('spin', P(torus(0.62, 0.05), 'accent', 0, 3.55, Math.PI / 2)),
        A('spin', P(torus(0.62, 0.05), 'accent', 0, 3.55, 0, 0, Math.PI / 2)),
        A('spin', P(sph(0.16, 8), 'light', 0, 3.55)),
        P(box(0.12, 0.3, 0.12), 'light', -0.6, 0.95, 0.6),
        P(box(0.12, 0.3, 0.12), 'light', 0.6, 0.95, -0.6),
      );
      break;
  }
  return p;
}

export function getTemplate(kind: 'unit' | 'building', defId: string): Template {
  return makeTemplate(`${kind}:${defId}`, kind === 'unit' ? unitParts(defId) : buildingParts(defId));
}

/**
 * Template for a faction vehicle variant (factoryId = '<faction>:<classId>').
 * Builds chassis + role kit from the variant file and registers its turret
 * pivot so the shared animation path keeps working.
 */
function getVariantTemplate(factoryId: string): Template | null {
  const key = `unit:${factoryId}`;
  const cached = templateCache.get(key);
  if (cached) return cached;
  const [factionId, classId] = factoryId.split(':');
  const variant = getVariant(factionId, classId);
  if (!variant) return null;
  const build = buildVehicleParts(variant);
  if (build.turretPivot) TURRET_PIVOTS[key] = build.turretPivot;
  return makeTemplate(key, build.parts);
}

const UNIT_VISUAL_SCALE = 1.28; // visual-only: sim radius and collision stay data-driven

function meshesFor(
  sg: SlotGeos, accentHex: string, kind: 'unit' | 'building',
  vehicle = false, vehMat?: { body: THREE.MeshStandardMaterial; dark: THREE.MeshStandardMaterial },
): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  // Buildings carry the sci-fi textures; vehicles a role-specific hull (body +
  // darker panels both textured); infantry flat.
  const bMat = kind === 'building'
    ? buildingBodyMat
    : (vehicle ? (vehMat?.body ?? vehicleBodyMat ?? bodyMat) : bodyMat);
  const dMat = kind === 'building'
    ? buildingDarkMat
    : (vehicle && vehMat ? vehMat.dark : darkMat);
  if (sg.body) { const m = new THREE.Mesh(sg.body, bMat); m.castShadow = true; m.receiveShadow = true; out.push(m); }
  if (sg.dark) { const m = new THREE.Mesh(sg.dark, dMat); m.castShadow = true; out.push(m); }
  if (sg.accent) { const m = new THREE.Mesh(sg.accent, accentMat(accentHex)); m.castShadow = kind === 'building'; out.push(m); }
  if (sg.light) { out.push(new THREE.Mesh(sg.light, lightMat)); }
  if (sg.smooth) { const m = new THREE.Mesh(sg.smooth, smoothMat); m.castShadow = true; m.receiveShadow = true; out.push(m); }
  if (sg.roof) { const m = new THREE.Mesh(sg.roof, kind === 'building' ? roofMat : bMat); m.castShadow = true; m.receiveShadow = true; out.push(m); }
  return out;
}

/**
 * Instantiate a visual for an entity. Animation channels are exposed on
 * userData.anim: { turret?: Group, spin?: Group, load?: Group }.
 */
export function makeEntityGroup(
  kind: 'unit' | 'building', defId: string, accentHex: string,
  vehicle = false, visual?: UnitVisual,
): THREE.Group {
  // Faction vehicle variants resolve to their own template; everything else
  // (infantry, buildings, legacy ids) uses the classic per-defId templates.
  const variantT = kind === 'unit' && vehicle && visual ? getVariantTemplate(visual.factoryId) : null;
  const t = variantT ?? getTemplate(kind, defId);
  const pivotKey = variantT ? `unit:${visual!.factoryId}` : `${kind}:${defId}`;
  const vehMat = vehicle ? vehicleHullMat(visual?.factoryId?.split(':')[1] ?? defId, visual) : undefined;
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  for (const m of meshesFor(t.static, accentHex, kind, vehicle, vehMat)) inner.add(m);
  const anim: Record<string, THREE.Group> = {};
  for (const [name, sg] of Object.entries(t.anims)) {
    const g = new THREE.Group();
    for (const m of meshesFor(sg, accentHex, kind, vehicle, vehMat)) g.add(m);
    if (name === 'turret') {
      const pv = TURRET_PIVOTS[pivotKey] ?? [0, 0, 0];
      g.position.set(pv[0], pv[1], pv[2]);
    }
    inner.add(g);
    anim[name] = g;
  }
  const scale = UNIT_VISUAL_SCALE * (visual?.silhouetteScale ?? 1);
  if (kind === 'unit') inner.scale.setScalar(scale);
  outer.add(inner);
  outer.userData.topY = t.topY * (kind === 'unit' ? scale : 1);
  outer.userData.inner = inner;
  outer.userData.anim = anim;
  return outer;
}

// ---------------- placement ghost + ground decals ----------------

const ghostOk = new THREE.MeshBasicMaterial({ color: '#3aff7a', transparent: true, opacity: 0.45, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.45, depthWrite: false });
const padOk = new THREE.MeshBasicMaterial({ color: '#3aff7a', transparent: true, opacity: 0.18, depthWrite: false });
const padBad = new THREE.MeshBasicMaterial({ color: '#ff4040', transparent: true, opacity: 0.18, depthWrite: false });

/** Ghost building + a flat footprint pad so the player can read the exact tiles. */
export function makeGhost(defId: string, fw: number, fh: number): THREE.Group {
  const t = getTemplate('building', defId);
  const g = new THREE.Group();
  const ghostMeshes: THREE.Mesh[] = [];
  for (const sg of [t.static, ...Object.values(t.anims)]) {
    for (const geo of [sg.body, sg.dark, sg.accent, sg.light, sg.smooth, sg.roof]) {
      if (geo) { const m = new THREE.Mesh(geo, ghostOk); ghostMeshes.push(m); g.add(m); }
    }
  }
  const padGeo = new THREE.PlaneGeometry(fw * TILE, fh * TILE);
  padGeo.rotateX(-Math.PI / 2);
  const pad = new THREE.Mesh(padGeo, padOk);
  pad.position.y = 0.06;
  pad.renderOrder = 4;
  g.add(pad);
  const frameGeo = new THREE.RingGeometry(0.93, 1.0, 4, 1, Math.PI / 4);
  frameGeo.rotateX(-Math.PI / 2);
  const frame = new THREE.Mesh(frameGeo, ghostOk);
  frame.scale.set(fw * TILE * 0.74, 1, fh * TILE * 0.74);
  frame.position.y = 0.08;
  frame.renderOrder = 4;
  g.add(frame);
  g.userData.setValid = (ok: boolean) => {
    for (const m of ghostMeshes) m.material = ok ? ghostOk : ghostBad;
    frame.material = ok ? ghostOk : ghostBad;
    pad.material = ok ? padOk : padBad;
  };
  return g;
}

let decalTex: THREE.Texture | null = null;
function getDecalTexture(): THREE.Texture {
  if (decalTex) return decalTex;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(8,8,14,0.62)');
  g.addColorStop(0.72, 'rgba(8,8,14,0.4)');
  g.addColorStop(1, 'rgba(8,8,14,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  decalTex = new THREE.CanvasTexture(c);
  return decalTex;
}

const decalGeoCache = new Map<string, THREE.BufferGeometry>();
/** Dark contact-shadow decal blended under a building so it sits in the terrain. */
export function makeGroundDecal(wWorld: number, dWorld: number): THREE.Mesh {
  const key = `${wWorld}x${dWorld}`;
  let geo = decalGeoCache.get(key);
  if (!geo) {
    geo = new THREE.PlaneGeometry(wWorld * 1.45, dWorld * 1.45);
    geo.rotateX(-Math.PI / 2);
    decalGeoCache.set(key, geo);
  }
  const mat = new THREE.MeshBasicMaterial({
    map: getDecalTexture(), transparent: true, depthWrite: false,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.045;
  m.renderOrder = 2;
  return m;
}

// ---------------- selection rings + health bars ----------------

const ringGeo = new THREE.RingGeometry(0.82, 1.0, 24);
ringGeo.rotateX(-Math.PI / 2);
const ringInnerGeo = new THREE.CircleGeometry(0.8, 24);
ringInnerGeo.rotateX(-Math.PI / 2);
const ringMats = new Map<string, THREE.MeshBasicMaterial>();
const ringFillMats = new Map<string, THREE.MeshBasicMaterial>();
export function makeSelectionRing(radius: number, colorHex: string): THREE.Mesh {
  let m = ringMats.get(colorHex);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95, depthWrite: false });
    ringMats.set(colorHex, m);
  }
  let fm = ringFillMats.get(colorHex);
  if (!fm) {
    fm = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.12, depthWrite: false });
    ringFillMats.set(colorHex, fm);
  }
  const mesh = new THREE.Mesh(ringGeo, m);
  mesh.scale.setScalar(radius * 1.5);
  mesh.renderOrder = 5;
  const fill = new THREE.Mesh(ringInnerGeo, fm);
  fill.renderOrder = 4;
  mesh.add(fill);
  return mesh;
}

const hbBg = new THREE.MeshBasicMaterial({ color: '#101018', depthTest: false, transparent: true, opacity: 0.85 });
const hbG = new THREE.MeshBasicMaterial({ color: '#43e860', depthTest: false });
const hbY = new THREE.MeshBasicMaterial({ color: '#ffce3a', depthTest: false });
const hbR = new THREE.MeshBasicMaterial({ color: '#ff4545', depthTest: false });
const hbGeo = new THREE.PlaneGeometry(1, 1);

export interface HealthBar { group: THREE.Group; set: (ratio: number) => void }
export function makeHealthBar(width: number): HealthBar {
  const group = new THREE.Group();
  const bg = new THREE.Mesh(hbGeo, hbBg);
  bg.scale.set(width, 0.18, 1);
  bg.renderOrder = 20;
  const fg = new THREE.Mesh(hbGeo, hbG);
  fg.scale.set(width, 0.11, 1);
  fg.position.z = 0.01;
  fg.renderOrder = 21;
  group.add(bg, fg);
  const set = (ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    fg.material = r > 0.55 ? hbG : r > 0.25 ? hbY : hbR;
    fg.scale.x = width * r;
    fg.position.x = -(width * (1 - r)) / 2;
  };
  return { group, set };
}
