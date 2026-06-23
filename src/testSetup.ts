// Headless test setup. The Vitest environment is 'node' (no DOM/Image), but some
// render modules (e.g. src/render/models.ts) eagerly construct materials with
// THREE.TextureLoader at import time. Stub the loader so importing the sim/render
// stack in a unit test does not try to fetch images. Tests assert on logic/geometry,
// never on decoded image pixels, so a bare Texture is sufficient.
import * as THREE from 'three';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(THREE.TextureLoader.prototype as any).load = function (): THREE.Texture {
  return new THREE.Texture();
};
