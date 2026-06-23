// Game orchestrator: builds the world from a mission definition, runs the
// main loop, owns win/lose detection, and wires UI <-> simulation.
import * as THREE from 'three';
import { GameMap, TILE } from '../map/map';
import { buildTerrain } from '../render/terrain';
import { hideVegetationAtTile } from '../render/vegetationGlb';
import { warpXZ } from '../render/terrainNoise';
import { TumbleweedSystem } from '../render/tumbleweed';
import { SceneRig } from '../render/scene';
import { Effects } from '../render/effects';
import { World, Unit, Building } from '../sim/world';
import { EnemyAI } from '../ai/enemy';
import { Hud } from '../ui/hud';
import { Minimap } from '../ui/minimap';
import { InputController } from '../ui/input';
import { showPauseMenu, showEndScreen, toast } from '../ui/screens';
import { FACTION_DEFS } from './defs';
import type { MissionDef, TeamId } from './types';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, type DifficultyId } from '../data/difficulty';
import { randomDoctrineFor } from '../data/doctrines';
import { recordMatchResult } from '../game/scoring/recordMatchEnd';
import { recordCampaignMissionResult } from '../game/campaignProgress/recordCampaignProgress';
import { LocalStorageCommanderProfileStore } from '../platform/profile/CommanderProfileStore';
import type { MatchResultView } from '../ui/scoreFormat';
import { perfEnabled, PerfOverlay } from '../ui/perfOverlay';
import { currentPerformanceSettings, type PerformanceSettings } from './performanceSettings';
import { DeploymentIntroController, currentDeploymentIntroEnabled } from './deploymentIntro';
import { DeploymentDropship } from '../render/deploymentDropship';
import { showDeploymentIntroOverlay, type DeploymentIntroOverlayHandle } from '../ui/deploymentIntroOverlay';

export type GameResult = 'restart' | 'menu';

/** Optional campaign context so a won mission can advance local progress. */
export interface CampaignContext {
  campaignId: string;
  missionOrder: string[]; // ordered mission ids (CampaignDef.missions order)
}

export class Game {
  private mission: MissionDef;
  private difficultyId: DifficultyId;
  private campaign?: CampaignContext;
  private map: GameMap;
  private rig: SceneRig;
  private world: World;
  private effects: Effects;
  private ai: EnemyAI;
  private hud: Hud;
  private minimap: Minimap;
  private input: InputController;
  private paused = false;
  private over = false;
  private raf = 0;
  private lastT = 0;
  private fpsAcc = 0; private fpsN = 0; private fpsTimer = 0;
  private perf?: PerfOverlay;                 // dev-only ?perf=1 overlay (no gameplay effect)
  private simMsAcc = 0; private renderMsAcc = 0;
  private perfSettings: PerformanceSettings = currentPerformanceSettings(); // FPS cap / mode
  private onVisibility?: () => void;
  private resolveRun!: (r: GameResult) => void;
  private updateProps!: (camera: THREE.Camera) => void;
  private tumbleweed?: TumbleweedSystem; // rare ambient decoration (render-only)
  // Deployment intro (short dropship/landing opener). Visual-only; never changes
  // unit counts/positions — starting units are just hidden then revealed.
  private introActive = false;
  private intro?: DeploymentIntroController;
  private dropship?: DeploymentDropship;
  private introOverlay?: DeploymentIntroOverlayHandle;
  private introUnits: Unit[] = [];
  private landing = { x: 0, z: 0, y: 0 };

  constructor(mission: MissionDef, playerFactionId: string, difficultyId: DifficultyId = DEFAULT_DIFFICULTY, campaign?: CampaignContext) {
    this.mission = mission;
    this.difficultyId = difficultyId;
    this.campaign = campaign;
    const difficulty = DIFFICULTIES[difficultyId] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
    const playerFaction = FACTION_DEFS[playerFactionId];
    let enemyId = mission.enemyFaction;
    if (!enemyId || enemyId === 'auto') {
      const others = Object.keys(FACTION_DEFS).filter(f => f !== playerFactionId);
      enemyId = others[Math.floor(Math.random() * others.length)];
    }
    const enemyFaction = FACTION_DEFS[enemyId];

    this.map = new GameMap(mission.map.size, mission.map.seed);
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.rig = new SceneRig(canvas, this.map.size);
    this.effects = new Effects(this.rig.scene);

    const built = buildTerrain(this.map);
    this.updateProps = built.updateProps;
    this.rig.scene.add(built.terrain, built.rocks, built.props);
    for (const [id, g] of built.crystalGroups) {
      g.userData.crystalId = id;
      this.rig.scene.add(g);
    }

    this.world = new World(this.map, this.rig.scene, this.effects, playerFaction, enemyFaction, built.crystalGroups);
    // Slice 2C/2D: when a pioneer clears a tile's F_TREE, hide its blocking
    // vegetation visual AND kick off a short wood-splinter burst at the stump.
    // Render-only; the sim stays free of Three/render imports. The vegetation
    // visual rides the terrain warp, so spawn the chips at the warped tile centre.
    const vegGroup = this.rig.scene.getObjectByName('vegetation-glb-v31');
    this.world.onVegetationCleared = (tx, tz) => {
      hideVegetationAtTile(vegGroup, tx, tz);
      const [cx, cz] = this.map.tileToWorld(tx, tz);
      const [wx, wz] = warpXZ(cx, cz);
      this.effects.woodChips(new THREE.Vector3(wx, this.map.groundHeight(wx, wz), wz));
    };
    this.world.teams[0].credits = mission.startingResources;
    this.world.teams[1].credits = mission.enemyStartingResources;
    this.world.teams[1].incomeMul = difficulty.aiIncomeMul; // AI economy handicap by difficulty

    // Rare rolling tumbleweed (render-only atmosphere). Opt-out via ?tumbleweed=0.
    const tumbleOff = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('tumbleweed') === '0';
    if (!tumbleOff) this.tumbleweed = new TumbleweedSystem(this.rig.scene, this.map);

    // Starting units.
    const spawn = (team: TeamId, list: { type: string; offset: [number, number] }[], at: { tx: number; tz: number }) => {
      for (const s of list) {
        const [wx, wz] = this.map.tileToWorld(at.tx + s.offset[0], at.tz + s.offset[1]);
        const u = this.world.spawnUnit(team, s.type, wx, wz);
        u.group.userData.unit = u;
      }
    };
    spawn(0, mission.startingUnits, this.map.playerStart);
    spawn(1, mission.enemyStartingUnits, this.map.enemyStart);

    // Hook userData for everything spawned later, too.
    const origSpawn = this.world.spawnUnit.bind(this.world);
    this.world.spawnUnit = (team, defId, x, z) => {
      const u = origSpawn(team, defId, x, z);
      u.group.userData.unit = u;
      return u;
    };
    const origPlace = this.world.placeBuilding.bind(this.world);
    this.world.placeBuilding = (team, defId, tx, tz, instant) => {
      const b = origPlace(team, defId, tx, tz, instant);
      if (b) b.group.userData.building = b;
      return b;
    };

    // Enemy faction = fixed identity; enemy doctrine = this match's AI persona,
    // drawn at random from that faction's doctrines (replay variety).
    const enemyDoctrine = randomDoctrineFor(enemyId);
    this.ai = new EnemyAI(this.world, mission.aiProfile, this.map.enemyStart.tx, this.map.enemyStart.tz, difficulty, enemyDoctrine);
    const enemyLabel = enemyFaction.tactical?.doctrineLabel;
    toast(`Gegner: ${enemyFaction.name}${enemyLabel ? ` (${enemyLabel})` : ''} — KI-Doktrin: ${enemyDoctrine.uiName}`);

    this.input = new InputController(this.rig, this.world, this.effects, built.terrain);
    this.input.openPause = () => this.openPause();

    this.hud = new Hud(this.world, {
      startPlacement: (defId) => this.input.startPlacement(defId),
      openPause: () => this.openPause(),
      getSelection: () => ({ units: this.input.selectedUnits, building: this.input.selectedBuilding }),
      armAttack: () => this.input.armAttackMove(),
      stopSel: () => this.input.stopSelected(),
      holdSel: () => this.input.holdSelected(),
      returnHarvesters: () => this.input.returnLoadedHarvesters(),
      isArmed: () => this.input.attackArmed,
      armClear: () => this.input.armClearVegetation(),
      isClearArmed: () => this.input.clearArmed,
    });
    this.input.onSelectionChanged = () => this.hud.renderPanel();

    this.minimap = new Minimap(this.map);
    this.minimap.onLook = (x, z) => this.rig.lookAt(x, z);
    this.minimap.onCommand = (x, z) => {
      if (this.input.selectedUnits.length) this.input.moveFormation(this.input.selectedUnits, x, z, false);
    };

    const [px, pz] = this.map.tileToWorld(this.map.playerStart.tx, this.map.playerStart.tz);
    this.rig.lookAt(px, pz, true);
    // Initialize the camera transform right away so picking works before the first frame.
    this.rig.update(0, (x, z) => this.map.groundHeight(x, z));

    // Short deployment intro: a dropship lands on the player start, "unloads" the
    // (already-spawned) starting units, and leaves. Toggle in Admin/Tools or via
    // ?intro=0 / ?skipIntro=1. Setup only happens here; it runs in frame().
    if (currentDeploymentIntroEnabled()) this.setupDeploymentIntro(px, pz, playerFaction.id, playerFaction.emissive);

    // Debug/profiling hook (also used by automated verification).
    (window as unknown as Record<string, unknown>).__game = {
      world: this.world, input: this.input, rig: this.rig, map: this.map, mission: this.mission,
      tumbleweed: this.tumbleweed, // render-only ambient decoration (debug/smoke handle)
      step: (secs: number) => {
        for (let t = 0; t < secs; t += 0.05) {
          this.world.update(0.05, this.rig.camera);
          this.ai.update(0.05);
          this.effects.update(0.05);
        }
        this.world.syncVisuals(this.rig.camera, 0.05);
        this.rig.update(0.001, (x, z) => this.map.groundHeight(x, z));
        this.checkEnd();
      },
    };
  }

  /** Build the deployment-intro state (hide starting units, spawn dropship, lock input). */
  private setupDeploymentIntro(px: number, pz: number, factionId: string, accentHex: string) {
    this.introUnits = this.world.units.filter((u) => u.team === 0); // the just-spawned starting units
    if (!this.introUnits.length) return; // nothing to deploy → no intro
    for (const u of this.introUnits) u.group.visible = false; // hidden until the unload moment

    this.landing = { x: px, z: pz, y: this.map.groundHeight(px, pz) };
    this.dropship = new DeploymentDropship(factionId, accentHex);
    this.rig.scene.add(this.dropship.group);

    this.input.setEnabled(false); // no orders during the intro
    this.setHudVisible(false);

    this.intro = new DeploymentIntroController({
      onReveal: () => {
        for (const u of this.introUnits) u.group.visible = true; // same units, just shown
      },
      onComplete: () => this.finalizeIntro(),
    });
    this.introOverlay = showDeploymentIntroOverlay(() => this.intro?.skip());
    this.introActive = true;
  }

  /** Tear down the intro and hand control back. Idempotent. */
  private finalizeIntro() {
    if (!this.introActive && !this.dropship) return;
    this.introActive = false;
    for (const u of this.introUnits) u.group.visible = true; // belt-and-suspenders: never leave a unit hidden
    this.dropship?.dispose();
    this.dropship = undefined;
    this.introOverlay?.dispose();
    this.introOverlay = undefined;
    this.setHudVisible(true);
    if (!this.paused && !this.over) this.input.setEnabled(true);
  }

  private setHudVisible(v: boolean) {
    const d = v ? '' : 'none';
    const top = document.getElementById('topbar');
    const cmd = document.getElementById('cmdpanel');
    if (top) top.style.display = d;
    if (cmd) cmd.style.display = d;
  }

  run(): Promise<GameResult> {
    return new Promise<GameResult>((resolve) => {
      this.resolveRun = resolve;
      if (perfEnabled()) this.perf = new PerfOverlay(); // dev-only metrics, hidden unless ?perf=1
      const startT = performance.now();
      this.lastT = startT;
      let lastFrameT = startT; // timestamp of the last PROCESSED (non-skipped) frame
      toast(`Objective: ${this.mission.objectives[this.mission.objectives.length - 1]}`);

      // Hidden-tab safety: on return to visibility, reset timestamps so the first
      // visible frame never sees a huge delta (no gameplay "catch-up" storm). rAF
      // already throttles to ~0 Hz when hidden; this also caps the resume spike.
      this.onVisibility = () => {
        if (typeof document !== 'undefined' && !document.hidden) {
          const n = performance.now();
          this.lastT = n; lastFrameT = n;
        }
      };
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVisibility);

      // Frame pacing: still driven by rAF, but skip work until ~one capped-frame
      // interval has elapsed. The slack keeps a 60-cap from being halved to 30 by
      // timing jitter on a 60 Hz panel. dt is real wall-time between PROCESSED
      // frames (clamped 0.05s) → simulation stays real-time at any cap.
      const PACING_SLACK_MS = 4;
      const loop = (t: number) => {
        this.raf = requestAnimationFrame(loop);
        if (typeof document !== 'undefined' && document.hidden) return; // hidden → no work
        const gate = Math.max(0, this.perfSettings.minFrameMs - PACING_SLACK_MS);
        if (t - lastFrameT < gate) return; // too soon for this FPS cap → skip
        lastFrameT = t;
        const dt = Math.min(0.05, (t - this.lastT) / 1000);
        this.lastT = t;
        this.frame(dt);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  private frame(dt: number) {
    // Deployment intro: advance the timeline + dropship, render, but DON'T run the
    // simulation/AI/HUD (so AI can't attack and the player can't issue orders). The
    // FPS cap still applies via the rAF gate in run(). dt is clamped real wall-time.
    if (this.introActive && this.intro) {
      this.intro.update(dt); // may fire onComplete → finalizeIntro() (clears introActive + dropship)
      this.dropship?.applyState(this.intro.elapsed, this.landing.x, this.landing.z, this.landing.y);
      this.rig.update(dt, (x, z) => this.map.groundHeight(x, z));
      this.updateProps(this.rig.camera);
      return;
    }

    const perf = this.perf; // when set (?perf=1) we time the sim vs render split; else zero overhead
    const t0 = perf ? performance.now() : 0;
    if (!this.paused && !this.over) {
      this.world.update(dt, this.rig.camera);
      this.ai.update(dt);
      this.effects.update(dt);
      this.tumbleweed?.update(dt); // render-only ambient decoration; no gameplay
      this.input.update(dt);
      this.input.validateSelection();
      this.world.syncVisuals(this.rig.camera, dt);
      this.hud.update(dt);
      this.checkEnd();
    }
    const t1 = perf ? performance.now() : 0;
    this.rig.update(dt, (x, z) => this.map.groundHeight(x, z)); // updates camera + renders the scene
    this.updateProps(this.rig.camera); // Y-lock vegetation billboards to the camera

    // Minimap + fps.
    const viewW = 2 * this.rig.dist * Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov / 2)) * this.rig.camera.aspect;
    this.minimap.render(this.world, this.rig.target.x, this.rig.target.z, viewW, viewW * 0.75);
    if (perf) { this.simMsAcc += t1 - t0; this.renderMsAcc += performance.now() - t1; }
    this.fpsAcc += dt; this.fpsN++; this.fpsTimer += dt;
    if (this.fpsTimer > 0.5) {
      this.hud.setFps(this.fpsN / this.fpsAcc);
      if (perf) {
        const info = this.rig.renderer.info;
        perf.update({
          mode: this.perfSettings.mode,
          fpsCap: this.perfSettings.fpsCap,
          fps: this.fpsN / this.fpsAcc,
          frameMs: (1000 * this.fpsAcc) / this.fpsN,
          simMs: this.simMsAcc / this.fpsN,
          renderMs: this.renderMsAcc / this.fpsN,
          units: this.world.units.length,
          buildings: this.world.buildings.length,
          projectiles: this.effects.active.length,
          crystals: this.world.crystalGroups.size,
          drawCalls: info.render.calls,
          triangles: info.render.triangles,
          textures: info.memory.textures,
          geometries: info.memory.geometries,
          programs: info.programs?.length ?? 0,
        });
        this.simMsAcc = 0; this.renderMsAcc = 0;
      }
      this.fpsAcc = 0; this.fpsN = 0; this.fpsTimer = 0;
    }
  }

  /** A side is defeated when it has no command nexus and no fabricator left. */
  private checkEnd() {
    if (this.over) return;
    const sideAlive = (team: TeamId) =>
      this.world.buildings.some(b => b.team === team && b.alive && b.def.id === 'nexus') ||
      this.world.units.some(u => u.team === team && u.alive && u.def.builder);
    const playerAlive = sideAlive(0);
    const enemyAlive = sideAlive(1);
    if (playerAlive && enemyAlive) return;
    this.over = true; // runs exactly once → score is recorded once
    const victory = playerAlive;

    // Local, offline score recording (no backend). Wrapped so a storage hiccup
    // can never block the win/lose flow. No-op if no Commander Profile exists.
    let resultView: MatchResultView | undefined;
    let matchScore = 0; // this match's final score (for per-mission best score)
    try {
      const t0 = this.world.teams[0];
      const result = recordMatchResult({
        victory,
        commandCenterDestroyed: victory, // win condition = enemy command nexus destroyed
        difficulty: this.difficultyId,
        playerFactionId: t0.faction.id,
        opponentFactionId: this.world.teams[1].faction.id,
        missionId: this.mission.id,
        mapId: `${this.mission.map.seed}_${this.mission.map.size}`,
        durationSeconds: this.world.time,
        stats: t0.stats,
      });
      // Reuse the already-computed score for display — no recalculation, no re-save.
      matchScore = result.score ?? 0;
      if (result.saved && result.breakdown && result.playerName != null) {
        resultView = {
          victory, commanderName: result.playerName, score: result.score ?? 0,
          difficulty: this.difficultyId, durationSeconds: this.world.time, breakdown: result.breakdown,
        };
      }
      if (import.meta.env.DEV) console.info('[score] match end', { victory, ...result });
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[score] recording failed (ignored)', e);
    }

    // Local, offline campaign progress (no backend). Only on victory of a campaign
    // mission with a known commander. Defensive: a storage hiccup must never block
    // the win/lose flow, and missing campaign data is simply skipped. Score saving
    // above is unaffected by this block.
    if (victory && this.campaign) {
      try {
        const profile = new LocalStorageCommanderProfileStore().getProfile();
        if (profile) {
          const r = recordCampaignMissionResult({
            playerId: profile.id,
            campaignId: this.campaign.campaignId,
            missionId: this.mission.id,
            victory,
            score: matchScore, // this match's final score (per-mission best handled in the helper)
            difficulty: this.difficultyId,
            completedAt: new Date().toISOString(),
            missionOrder: this.campaign.missionOrder,
          });
          if (import.meta.env.DEV) console.info('[campaign] progress', r);
        }
      } catch (e) {
        if (import.meta.env.DEV) console.warn('[campaign] progress update failed (ignored)', e);
      }
    }

    const mins = Math.floor(this.world.time / 60), secs = Math.floor(this.world.time % 60);
    const stats = `Mission time ${mins}:${String(secs).padStart(2, '0')} — ${this.mission.name}`;
    setTimeout(async () => {
      const r = await showEndScreen(victory, stats, resultView);
      this.dispose();
      this.resolveRun(r);
    }, 1400); // let the final explosion play out
  }

  private async openPause() {
    if (this.paused || this.over) return;
    this.paused = true;
    this.input.setEnabled(false);
    const r = await showPauseMenu();
    this.paused = false;
    this.input.setEnabled(true);
    if (r.action === 'restart') { this.dispose(); this.resolveRun('restart'); }
    if (r.action === 'quit') { this.dispose(); this.resolveRun('menu'); }
  }

  private dispose() {
    cancelAnimationFrame(this.raf);
    this.tumbleweed?.dispose();
    this.introOverlay?.dispose(); // remove any lingering intro listeners/DOM
    this.dropship?.dispose();
    if (this.onVisibility && typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibility);
    this.perf?.dispose();
    document.getElementById('ui-root')!.innerHTML = '';
    this.rig.renderer.dispose();
    this.rig.scene.clear();
  }
}
