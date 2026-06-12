// CLI runner: loads the TS balance validator through Vite's SSR pipeline so
// TypeScript + JSON imports resolve exactly like in the app. Exit code 1 on
// unexplained balance differences (CI-friendly).
import { createServer } from 'vite';

const server = await createServer({
  server: { middlewareMode: true },
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true },
});
try {
  const mod = await server.ssrLoadModule('/src/systems/balanceValidation.ts');
  const ok = mod.printBalanceReport();
  process.exitCode = ok ? 0 : 1;
} finally {
  await server.close();
}
