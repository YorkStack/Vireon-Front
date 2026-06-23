// Lightweight pooled VFX: projectiles, laser beams, muzzle flashes,
// explosions, hit sparks and ground command markers.
//
// VFX Phase 2: beam/projectile/muzzle can render faction shot SPRITES when a
// texture is loaded (see shotVfx.ts). The sprite path ONLY swaps the visual mesh
// + material — travel, ttl, onHit and damage timing are identical to (and shared
// with) the procedural path, which stays the fallback whenever a texture or
// faction is missing.
import * as THREE from 'three';
import type { FactionId } from '../data/factionModifiers';
import { beamTextureFor, bulletTextureFor, muzzleTextureFor, makeGlowMaterial } from './shotVfx';

/** Fixed visual width of a sprite beam quad (world units). Cosmetic only. */
const BEAM_SPRITE_WIDTH = 1.5;

interface Fx {
  mesh: THREE.Object3D;
  ttl: number;
  life: number;
  update?: (fx: Fx, dt: number) => void;
}

const V = new THREE.Vector3();

// ── Wood splinter burst (pioneer tree clearing) ───────────────────────────────
// Brown shades from dark bark → reddish bark → medium wood → light tan. Index is
// the material slot in Effects.chipMats.
export const WOOD_CHIP_COLORS = ['#3a2616', '#5a3320', '#6b4a2c', '#9c7a48'] as const;

/** One spawned wood chip: local position, velocity, tumble spin, scale, colour slot. */
export interface WoodChipSpec {
  px: number; py: number; pz: number;   // start position (local to the burst origin)
  vx: number; vy: number; vz: number;   // initial velocity (m/s); vy>0 = upward kick
  sx: number; sy: number; sz: number;   // tumble angular velocity (rad/s)
  scale: number;
  mat: number;                          // index into WOOD_CHIP_COLORS
}

/**
 * Deterministic-for-a-given-rng init of a wood-chip burst: each chip gets a small
 * upward kick, an outward radial velocity, a random tumble and a brown colour
 * slot. Pure (no THREE / no scene) so the spread can be unit-tested. `rng`
 * defaults to Math.random; pass a seeded rng for reproducible data.
 */
export function woodChipParticleInit(count: number, rng: () => number = Math.random): WoodChipSpec[] {
  const out: WoodChipSpec[] = [];
  for (let i = 0; i < count; i++) {
    const ang = rng() * Math.PI * 2;
    const outward = 1.4 + rng() * 2.2;        // radial speed (outward spread)
    out.push({
      px: 0, py: 0.25 + rng() * 0.3, pz: 0,   // start just above the stump
      vx: Math.cos(ang) * outward,
      vy: 2.6 + rng() * 1.8,                   // upward kick (always positive)
      vz: Math.sin(ang) * outward,
      sx: (rng() - 0.5) * 12, sy: (rng() - 0.5) * 12, sz: (rng() - 0.5) * 12,
      scale: 0.7 + rng() * 0.8,
      mat: i % WOOD_CHIP_COLORS.length,        // cycle the brown palette
    });
  }
  return out;
}

export class Effects {
  scene: THREE.Scene;
  active: Fx[] = [];

  private bulletGeo = (() => {
    const g = new THREE.CylinderGeometry(0.045, 0.045, 0.55, 5);
    g.rotateX(Math.PI / 2); // tracer aligned with flight direction
    return g;
  })();
  private shellGeo = new THREE.SphereGeometry(0.16, 6, 4);
  private rocketGeo = new THREE.ConeGeometry(0.1, 0.45, 6);
  private beamGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);
  // Flat quad lying in XZ (spans local X=length, Z=width, normal +Y) for sprite
  // beams. UV u=0 (texture left/flare) at -X, u=1 (tip) at +X.
  private beamPlaneGeo = (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })();
  private boomGeo = new THREE.IcosahedronGeometry(1, 0);
  private flashGeo = new THREE.SphereGeometry(0.22, 6, 4);
  private ringGeo = (() => { const g = new THREE.RingGeometry(0.6, 0.78, 24); g.rotateX(-Math.PI / 2); return g; })();
  private scorchGeo = (() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })();

  // Small flat triangular splinter (a thin wedge ~0.14 across), shared by every
  // wood chip; DoubleSide so it stays visible while tumbling.
  private chipGeo = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0.11, -0.07, 0, -0.06, 0.07, 0, -0.06,
    ]), 3));
    g.computeVertexNormals();
    return g;
  })();
  private chipMats = WOOD_CHIP_COLORS.map(c => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));

  private bulletMat = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
  private shellMat = new THREE.MeshBasicMaterial({ color: '#ffb060' });
  private rocketMat = new THREE.MeshBasicMaterial({ color: '#ff8a5c' });
  private flashMat = new THREE.MeshBasicMaterial({ color: '#fff3c2', transparent: true, opacity: 0.9 });
  private boomMat = new THREE.MeshBasicMaterial({ color: '#ff9540', transparent: true, opacity: 0.85 });
  private boomMat2 = new THREE.MeshBasicMaterial({ color: '#ffe9b0', transparent: true, opacity: 0.9 });
  private sparkMat = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.9 });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  private add(mesh: THREE.Object3D, ttl: number, update?: (fx: Fx, dt: number) => void) {
    const fx: Fx = { mesh, ttl, life: ttl, update };
    this.scene.add(mesh);
    this.active.push(fx);
  }

  /** Fires a visual projectile; calls onHit when it lands. */
  projectile(
    kind: 'bullet' | 'shell' | 'rocket', from: THREE.Vector3, to: THREE.Vector3, onHit: () => void,
    factionId?: FactionId,
  ) {
    // Sprite path: a textured bullet sprite for the faction (crimson) — purely a
    // visual swap. Travel/ttl/onHit below are IDENTICAL to the procedural path.
    const bulletTex = kind === 'bullet' && factionId ? bulletTextureFor(factionId) : null;
    let m: THREE.Object3D;
    let isSprite = false;
    if (bulletTex) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: bulletTex, transparent: true, depthWrite: false, toneMapped: false,
      }));
      sp.scale.set(1.1, 1.15, 1); // bullet_tracer ~ square; cosmetic size
      m = sp; isSprite = true;
    } else {
      const geo = kind === 'bullet' ? this.bulletGeo : kind === 'shell' ? this.shellGeo : this.rocketGeo;
      const mat = kind === 'bullet' ? this.bulletMat : kind === 'shell' ? this.shellMat : this.rocketMat;
      m = new THREE.Mesh(geo, mat);
    }
    m.position.copy(from);
    const speed = kind === 'bullet' ? 38 : kind === 'rocket' ? 22 : 28;
    const dist = from.distanceTo(to);
    const ttl = Math.max(0.05, dist / speed);
    const start = from.clone(), end = to.clone();
    const arc = kind === 'shell' ? Math.min(4, dist * 0.25) : kind === 'rocket' ? 1.2 : 0;
    let fired = false;
    const prev = from.clone();
    this.add(m, ttl, (fx) => {
      const t = 1 - fx.ttl / fx.life;
      prev.copy(fx.mesh.position);
      fx.mesh.position.lerpVectors(start, end, t);
      fx.mesh.position.y += Math.sin(t * Math.PI) * arc;
      if (kind === 'bullet' && !isSprite) {
        fx.mesh.lookAt(prev); // tracer mesh points along its flight path (sprites auto-billboard)
      } else if (kind === 'rocket') {
        V.copy(end).sub(start);
        fx.mesh.lookAt(fx.mesh.position.x + V.x, fx.mesh.position.y, fx.mesh.position.z + V.z);
        fx.mesh.rotateX(Math.PI / 2);
      }
      if (fx.ttl <= 0 && !fired) { fired = true; onHit(); }
    });
  }

  /** Instant laser beam between two points (damage applied by caller). */
  beam(from: THREE.Vector3, to: THREE.Vector3, colorHex: string, factionId?: FactionId) {
    const dist = from.distanceTo(to);
    const beamTex = factionId ? beamTextureFor(factionId) : null;
    if (beamTex) {
      // Sprite path: stretch ONE full-beam quad along the shot line (no UV tiling).
      // Flare (texture left, u=0) at -X = `from`/muzzle; tip (u=1) at +X = `to`.
      const mat = makeGlowMaterial(beamTex, 1);
      const m = new THREE.Mesh(this.beamPlaneGeo, mat);
      m.position.lerpVectors(from, to, 0.5);
      m.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
      m.scale.set(dist, 1, BEAM_SPRITE_WIDTH);
      m.renderOrder = 5;
      this.add(m, 0.14, (fx) => { mat.opacity = fx.ttl / fx.life; });
    } else {
      // Procedural fallback: a thin faction-coloured cylinder.
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
      const m = new THREE.Mesh(this.beamGeo, mat);
      m.position.lerpVectors(from, to, 0.5);
      m.scale.set(1, dist, 1);
      m.lookAt(to);
      m.rotateX(Math.PI / 2);
      this.add(m, 0.12, (fx) => { mat.opacity = 0.95 * (fx.ttl / fx.life); });
    }
    // bright impact spark
    const spark = new THREE.Mesh(this.flashGeo, this.sparkMat.clone());
    spark.position.copy(to);
    this.add(spark, 0.15, (fx) => {
      fx.mesh.scale.setScalar(1 + (1 - fx.ttl / fx.life) * 2);
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = fx.ttl / fx.life;
    });
  }

  muzzleFlash(at: THREE.Vector3, factionId?: FactionId) {
    const tex = factionId ? muzzleTextureFor(factionId) : null;
    if (tex) {
      // Sprite path: a brief textured flash (crimson). Billboards to the camera.
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }));
      sp.position.copy(at);
      this.add(sp, 0.1, (fx) => {
        const k = fx.ttl / fx.life;
        fx.mesh.scale.setScalar(2.2 - 0.9 * (1 - k));
        (fx.mesh as THREE.Sprite).material.opacity = k;
      });
      return;
    }
    const m = new THREE.Mesh(this.flashGeo, this.flashMat.clone());
    m.position.copy(at);
    m.scale.setScalar(1.4);
    this.add(m, 0.08, (fx) => {
      fx.mesh.scale.setScalar(1.4 - 0.8 * (1 - fx.ttl / fx.life));
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = fx.ttl / fx.life;
    });
  }

  /** Expanding flat shockwave + lingering scorch mark for destroyed entities. */
  deathBlast(at: THREE.Vector3, scale = 1) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffb36a', transparent: true, opacity: 0.85, depthWrite: false });
    const ring = new THREE.Mesh(this.ringGeo, mat);
    ring.position.copy(at).add(new THREE.Vector3(0, 0.1, 0));
    ring.renderOrder = 7;
    this.add(ring, 0.5, (fx) => {
      const t = 1 - fx.ttl / fx.life;
      fx.mesh.scale.setScalar(0.5 + t * 6 * scale);
      mat.opacity = 0.85 * (fx.ttl / fx.life);
    });
    // Scorch: a dark circle that slowly fades away.
    const sMat = new THREE.MeshBasicMaterial({ color: '#05050a', transparent: true, opacity: 0.55, depthWrite: false });
    const scorch = new THREE.Mesh(this.scorchGeo, sMat);
    scorch.position.copy(at).setY(at.y + 0.06);
    scorch.scale.setScalar(1.4 * scale);
    scorch.rotation.y = Math.random() * 6.28;
    scorch.renderOrder = 2;
    this.add(scorch, 12, (fx) => {
      if (fx.ttl < 5) sMat.opacity = 0.55 * (fx.ttl / 5);
    });
  }

  explosion(at: THREE.Vector3, scale = 1) {
    const core = new THREE.Mesh(this.boomGeo, this.boomMat2.clone());
    core.position.copy(at);
    this.add(core, 0.3, (fx) => {
      const t = 1 - fx.ttl / fx.life;
      fx.mesh.scale.setScalar(0.3 * scale + t * 1.4 * scale);
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.95 * (fx.ttl / fx.life);
    });
    const shell = new THREE.Mesh(this.boomGeo, this.boomMat.clone());
    shell.position.copy(at);
    this.add(shell, 0.55, (fx) => {
      const t = 1 - fx.ttl / fx.life;
      fx.mesh.scale.setScalar(0.5 * scale + t * 2.6 * scale);
      fx.mesh.rotation.y += 2 * t;
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.8 * (fx.ttl / fx.life);
    });
  }

  hitSpark(at: THREE.Vector3) {
    const m = new THREE.Mesh(this.flashGeo, this.sparkMat.clone());
    m.position.copy(at);
    m.scale.setScalar(0.6);
    this.add(m, 0.12, (fx) => {
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = 0.9 * (fx.ttl / fx.life);
    });
  }

  /**
   * Short brown wood-splinter burst when a pioneer fells a tree. A single Group of
   * `count` tiny triangle chips, each kicked up + outward, pulled down by gravity,
   * tumbling; chips vanish on ground contact and the whole burst clears at ttl.
   * Visual-only — no gameplay/collision. `at` is the stump position (ground level).
   */
  woodChips(at: THREE.Vector3, count = 14) {
    const group = new THREE.Group();
    group.position.copy(at);
    const specs = woodChipParticleInit(count);
    const parts = specs.map((s) => {
      const m = new THREE.Mesh(this.chipGeo, this.chipMats[s.mat]);
      m.position.set(s.px, s.py, s.pz);
      m.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
      m.scale.setScalar(s.scale);
      group.add(m);
      return { mesh: m, vx: s.vx, vy: s.vy, vz: s.vz, sx: s.sx, sy: s.sy, sz: s.sz, landed: false };
    });
    const G = 11; // gravity (m/s²) — chips arc and drop quickly
    this.add(group, 1.6, (_fx, dt) => {
      for (const p of parts) {
        if (p.landed) continue;
        p.vy -= G * dt;
        p.vx *= 0.98; p.vz *= 0.98; // mild air drag so they don't slide far
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.rotation.x += p.sx * dt;
        p.mesh.rotation.y += p.sy * dt;
        p.mesh.rotation.z += p.sz * dt;
        if (p.mesh.position.y <= 0) { p.mesh.position.y = 0; p.mesh.visible = false; p.landed = true; }
      }
    });
  }

  /** Expanding ground ring marking a command: move / attack / gather. */
  marker(at: THREE.Vector3, kind: 'move' | 'attack' | 'gather') {
    const color = kind === 'move' ? '#3aff7a' : kind === 'attack' ? '#ff4545' : '#2ee6d0';
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false });
    const m = new THREE.Mesh(this.ringGeo, mat);
    m.position.copy(at).add(new THREE.Vector3(0, 0.08, 0));
    m.renderOrder = 6;
    this.add(m, 0.6, (fx) => {
      const t = 1 - fx.ttl / fx.life;
      fx.mesh.scale.setScalar(0.6 + t * 1.3);
      mat.opacity = 0.95 * (fx.ttl / fx.life);
    });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const fx = this.active[i];
      fx.ttl -= dt;
      fx.update?.(fx, dt);
      if (fx.ttl <= 0) {
        this.scene.remove(fx.mesh);
        this.active.splice(i, 1);
      }
    }
  }
}
