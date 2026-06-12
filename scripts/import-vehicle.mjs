// CLI: import a studio bundle (or a folder of bundles) into the game.
//   npm run import:vehicle -- <bundle-dir> [--dry-run]
//   npm run import:vehicle -- --all <dir-of-bundles> [--dry-run]
// Loads the TS planner via Vite SSR so validation matches the game exactly.
import { createServer } from 'vite';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const allIdx = argv.indexOf('--all');
const positional = argv.filter((a) => !a.startsWith('--'));

let bundles = [];
if (allIdx !== -1) {
  const dir = argv[allIdx + 1];
  if (!dir || !existsSync(dir)) { console.error('--all needs a directory'); process.exit(1); }
  bundles = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, 'geometry.json')))
    .map((d) => join(dir, d.name));
} else if (positional.length) {
  bundles = [positional[0]];
} else {
  console.error('usage: import:vehicle -- <bundle-dir> [--dry-run] | --all <dir> [--dry-run]');
  process.exit(1);
}

const server = await createServer({ server: { middlewareMode: true }, logLevel: 'error', optimizeDeps: { noDiscovery: true } });
let failures = 0;
try {
  const { planImport, applyImport } = await server.ssrLoadModule('/scripts/importVehicle.ts');
  for (const b of bundles) {
    const plan = planImport(b);
    if (!plan.ok) { console.error(`✗ ${b}: ${plan.errors.join('; ')}`); failures++; continue; }
    console.log(`${dryRun ? '[dry-run] ' : ''}${plan.faction}:${plan.classId}`);
    for (const c of plan.actions.copy) console.log(`    ${c.from}  ->  ${c.to}`);
    console.log(`    status ${plan.actions.statusFlip.id} -> ${plan.actions.statusFlip.to}`);
    if (!dryRun) { applyImport(plan); console.log('    applied.'); }
  }
} finally {
  await server.close();
}
if (!dryRun && failures === 0) console.log('Done. Restart the dev server / rebuild so the new spec is picked up.');
process.exitCode = failures ? 1 : 0;
