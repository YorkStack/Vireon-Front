// Lightweight pooled VFX: projectiles, laser beams, muzzle flashes,
// explosions, hit sparks and ground command markers.
import * as THREE from 'three';

interface Fx {
  mesh: THREE.Object3D;
  ttl: number;
  life: number;
  update?: (fx: Fx, dt: number) => void;
}

const V = new THREE.Vector3();

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
  private boomGeo = new THREE.IcosahedronGeometry(1, 0);
  private flashGeo = new THREE.SphereGeometry(0.22, 6, 4);
  private ringGeo = (() => { const g = new THREE.RingGeometry(0.6, 0.78, 24); g.rotateX(-Math.PI / 2); return g; })();
  private scorchGeo = (() => { const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); return g; })();

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
  ) {
    const geo = kind === 'bullet' ? this.bulletGeo : kind === 'shell' ? this.shellGeo : this.rocketGeo;
    const mat = kind === 'bullet' ? this.bulletMat : kind === 'shell' ? this.shellMat : this.rocketMat;
    const m = new THREE.Mesh(geo, mat);
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
      if (kind === 'bullet') {
        fx.mesh.lookAt(prev); // tracer points along its actual flight path
      } else if (kind === 'rocket') {
        V.copy(end).sub(start);
        fx.mesh.lookAt(fx.mesh.position.x + V.x, fx.mesh.position.y, fx.mesh.position.z + V.z);
        fx.mesh.rotateX(Math.PI / 2);
      }
      if (fx.ttl <= 0 && !fired) { fired = true; onHit(); }
    });
  }

  /** Instant laser beam between two points (damage applied by caller). */
  beam(from: THREE.Vector3, to: THREE.Vector3, colorHex: string) {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.95 });
    const m = new THREE.Mesh(this.beamGeo, mat);
    const dist = from.distanceTo(to);
    m.position.lerpVectors(from, to, 0.5);
    m.scale.set(1, dist, 1);
    m.lookAt(to);
    m.rotateX(Math.PI / 2);
    this.add(m, 0.12, (fx) => { mat.opacity = 0.95 * (fx.ttl / fx.life); });
    // bright impact spark
    const spark = new THREE.Mesh(this.flashGeo, this.sparkMat.clone());
    spark.position.copy(to);
    this.add(spark, 0.15, (fx) => {
      fx.mesh.scale.setScalar(1 + (1 - fx.ttl / fx.life) * 2);
      (fx.mesh as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>).material.opacity = fx.ttl / fx.life;
    });
  }

  muzzleFlash(at: THREE.Vector3) {
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
