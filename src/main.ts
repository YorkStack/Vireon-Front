// Entry point: start screen -> briefing -> game -> (restart | back to menu).
/// <reference types="vite/client" />
import { showStartScreen, showBriefing } from './ui/screens';
import { Game } from './core/game';
import { FACTION_DEFS } from './core/defs';
import { preloadVehicleGlbs } from './render/vehicleGlb';
import { preloadBuildingGlbs } from './render/buildingGlb';
import { preloadShotVfx } from './render/shotVfx';

// Warm the runtime-GLB cache (vehicles + buildings) + shot-VFX textures before
// any match starts. Shot-VFX failures are swallowed → procedural fallback.
const glbReady = Promise.all([preloadVehicleGlbs(), preloadBuildingGlbs(), preloadShotVfx()]);

// Dev-only F8 admin/balancing panel (live faction-modifier tuning). Not shown in
// normal player UI — hidden until F8. Self-installs its own hotkeys.
if (import.meta.env.DEV) {
  import('./ui/adminPanel').then((m) => m.installAdminPanel());
}

// Dev guard: warn loudly when faction variants drift from their class
// template without a declared reason (full report: npm run validate:balance).
if (import.meta.env.DEV) {
  import('./systems/balanceValidation').then((m) => {
    const r = m.validateBalance();
    if (r.violations.length) console.warn('[balance] VIOLATIONS:', r.violations);
    else console.info(`[balance] ok — ${r.intentional.length} intentional faction-perk differences`);
  });
}

async function main() {
  for (;;) {
    const choice = await showStartScreen();
    await showBriefing(choice.mission, FACTION_DEFS[choice.factionId]);
    let result: 'restart' | 'menu';
    await glbReady; // ensure baked vehicle GLBs are cached before units spawn
    do {
      const game = new Game(choice.mission, choice.factionId, choice.difficulty);
      result = await game.run();
    } while (result === 'restart');
  }
}

main();
