// Few-shot seed generator: runs every procedural vehicle variant, converts it
// to a vehicle-spec, and writes studio-seeds/<faction>_<class>.json. These
// concrete, in-style examples are handed to Gemini in the studio so generated
// geometry imitates real models. The footprint is the model-local bounding box
// of the procedural parts (size baked in).
//
// A DOM is registered first because importing the render modules triggers
// THREE.TextureLoader at import time; the async image load is irrelevant here.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();

import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

const server = await createServer({
  server: { middlewareMode: true },
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
try {
  const THREE = await server.ssrLoadModule('three');
  const { VEHICLE_VARIANTS } = await server.ssrLoadModule('/src/vehicles/index.ts');
  const { buildVehicleParts, variantToSpec } = await server.ssrLoadModule('/src/render/vehicleModels.ts');

  mkdirSync('studio-seeds', { recursive: true });
  let count = 0;
  for (const variant of VEHICLE_VARIANTS.values()) {
    const { parts } = buildVehicleParts(variant);
    const b = new THREE.Box3();
    for (const p of parts) { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); }
    const s = b.getSize(new THREE.Vector3());
    const spec = variantToSpec(variant, { w: s.x, h: s.y, l: s.z });
    const file = `studio-seeds/${variant.factionId}_${variant.classId}.json`;
    writeFileSync(file, JSON.stringify(spec, null, 2));
    count++;
  }
  console.log(`Wrote ${count} seed specs to studio-seeds/.`);
} finally {
  await server.close();
}
