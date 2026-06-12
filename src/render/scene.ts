// Renderer, camera rig (RTS pan/zoom), lighting and atmosphere.
import * as THREE from 'three';
import { TILE } from '../map/map';

/** Window aspect ratio, safe against zero-size (hidden) windows. */
function aspectOf(): number {
  return window.innerHeight > 0 ? window.innerWidth / window.innerHeight : 16 / 9;
}

export class SceneRig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;

  // Camera target (point on the ground the camera looks at) and zoom distance.
  target = new THREE.Vector3();
  targetGoal = new THREE.Vector3();
  dist = 46;
  distGoal = 46;
  readonly minDist = 16;
  readonly maxDist = 95;
  readonly pitch = THREE.MathUtils.degToRad(52);
  readonly yaw = THREE.MathUtils.degToRad(0);
  mapWorldSize: number;

  constructor(canvas: HTMLCanvasElement, mapSize: number) {
    this.mapWorldSize = mapSize * TILE;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0b0a14');
    this.scene.fog = new THREE.Fog('#0b0a14', 160, 420);

    this.camera = new THREE.PerspectiveCamera(42, aspectOf(), 1, 600);

    // Cool moonlight key + teal/violet fill for the Crystalline Noir mood,
    // bright enough that terrain levels stay clearly readable.
    const hemi = new THREE.HemisphereLight('#9aa6d8', '#33304a', 1.45);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#dde2ff', 3.1);
    this.sun.position.set(-45, 95, 65);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.6;
    const s = 90;
    this.sun.shadow.camera.left = -s; this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s; this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.far = 320;
    this.scene.add(this.sun, this.sun.target);

    const amb = new THREE.AmbientLight('#454b73', 0.62);
    this.scene.add(amb);
    // Warm counter-fill from the opposite side so shadow faces keep their detail.
    const fill = new THREE.DirectionalLight('#ffb184', 0.85);
    fill.position.set(70, 45, -60);
    this.scene.add(fill);

    window.addEventListener('resize', () => {
      this.camera.aspect = aspectOf();
      this.camera.updateProjectionMatrix();
      if (window.innerWidth > 0 && window.innerHeight > 0) {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });
  }

  lookAt(x: number, z: number, immediate = false) {
    this.targetGoal.set(
      THREE.MathUtils.clamp(x, 0, this.mapWorldSize),
      0,
      THREE.MathUtils.clamp(z, 0, this.mapWorldSize),
    );
    if (immediate) this.target.copy(this.targetGoal);
  }

  pan(dx: number, dz: number) {
    this.lookAt(this.targetGoal.x + dx, this.targetGoal.z + dz);
  }

  zoom(delta: number) {
    this.distGoal = THREE.MathUtils.clamp(this.distGoal * (1 + delta), this.minDist, this.maxDist);
  }

  update(dt: number, groundY: (x: number, z: number) => number) {
    // Catch missed resize events (e.g. window was hidden or zero-size at init).
    const size = this.renderer.getSize(new THREE.Vector2());
    if (window.innerWidth > 0 && window.innerHeight > 0 &&
        (size.x !== window.innerWidth || size.y !== window.innerHeight)) {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.camera.aspect = aspectOf();
      this.camera.updateProjectionMatrix();
    }
    const k = 1 - Math.pow(0.0001, dt); // smooth exponential approach
    this.target.lerp(this.targetGoal, k);
    this.dist += (this.distGoal - this.dist) * k;

    const ty = groundY(this.target.x, this.target.z);
    const cx = this.target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cz = this.target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const cy = ty + Math.sin(this.pitch) * this.dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(this.target.x, ty, this.target.z);

    // Keep the shadow frustum centered on the view.
    this.sun.position.set(this.target.x - 45, 95, this.target.z + 65);
    this.sun.target.position.set(this.target.x, 0, this.target.z);

    this.renderer.render(this.scene, this.camera);
  }
}
