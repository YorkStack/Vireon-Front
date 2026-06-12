// Exports studio-export/catalog.json — the studio's input: every faction x
// vehicle class with its in-game SIZE (correctly including silhouetteScale) and
// design brief, so Gemini designs at the right detail-to-size ratio.
//
// localFootprint comes from the seed spec bbox (authoritative model-local size);
// worldFootprint = local * renderScale, renderScale = UNIT_VISUAL_SCALE *
// silhouetteScale. Run `npm run seed:specs` first.
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

// Stable engine constants (src/render/models.ts UNIT_VISUAL_SCALE, src/map/map.ts TILE).
const UNIT_VISUAL_SCALE = 1.28;
const TILE = 2.0;

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { VEHICLE_VARIANTS } = await server.ssrLoadModule('/src/vehicles/index.ts');
  const { UNIT_CLASS_TEMPLATES } = await server.ssrLoadModule('/src/data/unitClasses.ts');
  const { ART_METADATA } = await server.ssrLoadModule('/src/data/artMetadata.ts');

  const r = (n) => Math.round(n * 1000) / 1000;
  const out = {};
  for (const v of VEHICLE_VARIANTS.values()) {
    const t = UNIT_CLASS_TEMPLATES[v.classId];
    const seedPath = `studio-seeds/${v.factionId}_${v.classId}.json`;
    if (!existsSync(seedPath)) { console.warn(`missing seed ${seedPath} — run npm run seed:specs`); continue; }
    const local = JSON.parse(readFileSync(seedPath, 'utf8')).footprint;
    const silhouetteScale = v.silhouetteScale ?? 1;
    const renderScale = UNIT_VISUAL_SCALE * silhouetteScale;
    const world = { w: r(local.w * renderScale), h: r(local.h * renderScale), l: r(local.l * renderScale) };
    out[`${v.factionId}:${v.classId}`] = {
      faction: v.factionId,
      vehicleClass: v.classId,
      displayName: v.displayName ?? t?.displayName ?? v.classId,
      role: t?.role,
      techTier: t?.techTier,
      description: t?.description,
      movementType: v.movementType,
      renderScale: r(renderScale),
      silhouetteScale,
      localFootprint: { w: r(local.w), h: r(local.h), l: r(local.l) },
      worldFootprint: world,
      tilesWide: r(world.w / TILE),
      tileSize: TILE,
      designBrief: ART_METADATA[`${v.factionId}_${v.classId}`]?.designBrief,
    };
  }
  mkdirSync('studio-export', { recursive: true });
  writeFileSync('studio-export/catalog.json', JSON.stringify(out, null, 2));
  console.log(`Wrote studio-export/catalog.json (${Object.keys(out).length} vehicles).`);
} finally {
  await server.close();
}
