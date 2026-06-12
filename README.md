# Vireon Front

A real-time strategy game in the spirit of late-90s base builders, set on the hostile crystal world of Vireon. You land with a single Fabricator, raise a base, harvest vire crystal, build an army, and destroy the rival expedition's Command Nexus before they destroy yours.

Built with TypeScript, Three.js, and Vite. Runs at 60+ FPS on an Apple Silicon MacBook.

## Setup (macOS)

You need Node.js 18 or newer (`brew install node` if you don't have it).

```bash
cd "Vireon Front"
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). That's it.

Other commands:

```bash
npm run check    # type-check only
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build
```

## How to play

Pick the campaign and one of the four factions on the start screen, read the briefing, and you're in.

Controls:

| Input | Action |
|---|---|
| Left click | Select a unit or building |
| Left drag | Box-select multiple units |
| Right click | Move / attack / gather / repair, depending on target |
| Hold A + right click | Attack-move (engage everything on the way) |
| W / D / arrow keys, screen edges | Pan the camera |
| Mouse wheel | Zoom |
| S | Stop selected units (pans camera south when nothing is selected) |
| Space | Jump to your base |
| Esc | Cancel placement, or open the pause menu |

The core loop: select the Fabricator, build a Command Nexus, then a Refinery and a Power Spire. Build a Vehicle Foundry, produce a Harvester, and right-click it onto a glowing crystal field. With income flowing, add a Barracks and turrets, train an army, and push into the enemy base. You win when the enemy has neither a Nexus nor a Fabricator left; you lose under the same condition.

Terrain matters. Cliffs block all movement, ramps (the lighter paved tiles) connect height levels, and the narrow greenish ramps are infantry-only. Units on high ground get +1 range and vision against targets below, so plateaus and choke points are worth holding.

Power matters too. Each building consumes or produces power (shown in the top bar). If usage exceeds production, unit production runs at half speed and Pulse Lance turrets shut off.

## The factions

All four share the same tech tree with different bonuses:

- Crimson Pact (red): vehicle weapons +15% damage, vehicles cost +10%
- Azure Concord (blue): everything has +15% hull, construction is 12% slower
- Verdant Swarm (green): infantry +15% speed and -15% cost, all units -10% hull
- Solar Dominion (yellow): energy weapons +20% damage and turrets +1 range, buildings use +25% power

The enemy AI plays a faction different from yours, with the same rules and bonuses.

## Project structure

```
public/campaigns/          mission and campaign definitions (JSON, loaded at runtime)
  index.json               list of campaign folders
  campaign_01/
    campaign.json          campaign name, description, mission list
    mission_01.json        map seed, factions, starting units, resources, AI profile
src/
  data/                    unit, building, and faction definitions (JSON)
  core/types.ts            shared interfaces
  core/defs.ts             loads the JSON defs, applies faction modifiers, damage matrix
  core/game.ts             game orchestrator: main loop, win/lose, wiring
  map/map.ts               map generation: plateaus, ramps, rocks, crystals, connectivity
  path/astar.ts            grid A* with cliff rules and no corner cutting
  sim/world.ts             the simulation: units, buildings, orders, combat, economy
  ai/enemy.ts              enemy AI: build order, economy, production, attack waves
  render/scene.ts          renderer, camera rig, lighting
  render/terrain.ts        terrain mesh, rock spires, crystal nodes
  render/models.ts         procedural unit/building models, health bars, rings
  render/effects.ts        projectiles, lasers, explosions, command markers
  ui/screens.ts            start screen, briefing, pause, win/loss
  ui/hud.ts                resource bar, command panel, build queues
  ui/minimap.ts            minimap rendering and click-to-command
  ui/input.ts              selection, orders, placement mode, camera input
  campaign/campaign.ts     campaign/mission JSON loading
  main.ts                  entry point
```

The simulation (`sim/world.ts`) owns game state; rendering reads from it. Definitions are data, not code: a unit is a JSON entry plus a procedural model.

## Extending the game

### A new campaign

1. Create `public/campaigns/campaign_02/` with a `campaign.json`:

```json
{
  "id": "campaign_02",
  "name": "My Campaign",
  "description": "...",
  "missions": [{ "id": "mission_01", "name": "First Strike", "file": "mission_01.json" }]
}
```

2. Add the folder name to `public/campaigns/index.json`.

That's the whole change. The start screen lists every mission of every campaign automatically.

### A new mission

Copy `mission_01.json` into the campaign folder, register it in that campaign's `campaign.json`, and edit the fields: `map.seed` and `map.size` control generation, `startingUnits`/`enemyStartingUnits` set the opening forces, `aiProfile` tunes the AI (first wave time, wave interval and growth, army cap, harvester count, whether it rebuilds).

### A new unit

Add an entry to `src/data/units.json` (stats, cost, weapon, which building produces it), then give it a silhouette in `unitParts()` in `src/render/models.ts` (a few primitive shapes assigned to the `body`, `dark`, or `accent` slot). The HUD, production queues, and AI pick it up from the data. To put it in the AI's army mix, add it to `ARMY_MIX` in `src/ai/enemy.ts`.

### A new building

Same pattern: add an entry to `src/data/buildings.json` (cost, footprint in tiles, power draw or output, prerequisites, optional weapon for turrets), add a model in `buildingParts()` in `src/render/models.ts`, and add its id to `BUILD_ORDER` in `src/ui/hud.ts` so it shows up in the construct menu.

### A new faction

Add an entry to `src/data/factions.json` with a color and a `modifiers` map. Supported modifier keys: `hp`, `unitHp`, `buildTime`, `vehicleDamage`, `vehicleCost`, `infantrySpeed`, `infantryCost`, `energyDamage`, `turretRange`, `powerUse`. The start screen card, unit tinting, and stat application are automatic.

## Design notes and known limitations

- The win/lose rule is "a side is defeated when it has no Command Nexus and no Fabricator". This covers the edge case where a Nexus hasn't been built yet at game start.
- Repairs (Fabricator on a damaged building) cost time but no credits.
- The Fabricator builds one structure at a time; pulling it away pauses the site, and you can right-click the site later to resume.
- There is no fog of war. It was the first item on the agreed cut list and didn't make the slice.
- Walls chain-place (the ghost stays active after each placement); other buildings place one at a time.
- A debug handle is exposed as `window.__game` in the browser console, with a `step(seconds)` function that fast-forwards the simulation. Useful for testing missions and AI tuning.

## Performance

The whole map is three draw calls (terrain, rocks, crystals are merged geometry), and each unit costs at most three. Target acquisition scans are staggered across frames, and pathfinding caps node expansion per request. A 7-minute battle simulates in well under a second of CPU time; rendering sits at 60+ FPS on an M2 at 1600x900 with the default unit caps (AI army capped at 26, practical totals under ~120 units).
