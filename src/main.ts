// Entry point: start screen -> briefing -> game -> (restart | back to menu).
/// <reference types="vite/client" />
import { showStartScreen, showBriefing } from './ui/screens';
import { Game } from './core/game';
import { FACTION_DEFS } from './core/defs';

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
    await showBriefing(choice.mission, FACTION_DEFS[choice.factionId].name);
    let result: 'restart' | 'menu';
    do {
      const game = new Game(choice.mission, choice.factionId);
      result = await game.run();
    } while (result === 'restart');
  }
}

main();
