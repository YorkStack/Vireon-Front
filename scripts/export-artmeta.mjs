// Exports the TypeScript art metadata (design briefs + status) to
// tools/art_metadata.json so the Python texture pipeline can read it.
// Run automatically by `npm run generate:texture`.
import { createServer } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';

const server = await createServer({
  server: { middlewareMode: true },
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
try {
  const mod = await server.ssrLoadModule('/src/data/artMetadata.ts');
  mkdirSync('tools', { recursive: true });
  writeFileSync('tools/art_metadata.json', JSON.stringify(mod.ART_METADATA, null, 2));
  console.log(`tools/art_metadata.json written (${Object.keys(mod.ART_METADATA).length} entries).`);
} finally {
  await server.close();
}
