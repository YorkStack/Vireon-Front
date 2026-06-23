// Shared type definitions for the whole game.

export type DamageType = 'ballistic' | 'explosive' | 'energy';
export type ArmorType = 'light' | 'heavy' | 'structure';
export type UnitClass = 'infantry' | 'vehicle';
export type ProjectileKind = 'bullet' | 'rocket' | 'shell' | 'laser';
export type TeamId = 0 | 1; // 0 = player, 1 = enemy

export interface WeaponDef {
  damage: number;
  damageType: DamageType;
  range: number; // in tiles
  cooldown: number; // seconds
  projectile: ProjectileKind;
}

/** Visual identity block attached to resolved unit defs (faction variants). */
export interface UnitVisual {
  factoryId: string;        // model factory key, e.g. 'red:mediumTank'
  movement: string;         // MovementType (visual style only)
  textureSetId?: string;
  artMetadataId?: string;
  silhouetteScale?: number;
  selectionRingSize?: number;
  previewCamera?: { distance: number; height: number };
}

export interface UnitDef {
  id: string;
  name: string;
  class: UnitClass;
  role: string;
  cost: number;
  buildTime: number;
  hp: number;
  armor: ArmorType;
  speed: number; // tiles per second
  vision: number;
  radius: number;
  builtAt: string;
  weapon: WeaponDef | null;
  builder?: boolean;
  repairs?: boolean;
  harvester?: boolean;
  capacity?: number;
  gatherTime?: number;
  description: string;
  // ---- extended, populated by unitFactory.resolveUnit ----
  classId?: string;         // template id (id === classId for resolved defs)
  factionId?: string;
  techTier?: number;
  // sensors & autonomy (defaults preserve legacy behavior)
  autoAcquireRange?: number;          // tiles; legacy = vision
  canAutoAttack?: boolean;            // legacy = has weapon
  defaultStance?: 'holdFire' | 'returnFire' | 'defendArea' | 'aggressive';
  pursuitRange?: number;              // tiles from anchor; legacy = vision * 1.6
  maxAutonomousDistance?: number;
  patrolRadius?: number;
  guardRadius?: number;
  targetPriority?: string[];
  intelligenceLevel?: string;
  // utility
  supportAura?: { repairRange: number; repairAmount: number };
  buildRange?: number;
  repairRate?: number;
  clears?: boolean;          // pioneer: can clear F_TREE vegetation tiles
  clearRange?: number;       // tiles within which it can clear a tree tile
  clearTime?: number;        // seconds of work per tile
  // visual variant (vehicles with faction variants)
  visual?: UnitVisual;
}

export interface BuildingDef {
  id: string;
  name: string;
  cost: number;
  buildTime: number;
  hp: number;
  footprint: [number, number];
  power: number; // + provides, - consumes
  vision: number;
  prereq: string[];
  weapon?: WeaponDef;
  produces?: 'infantry' | 'vehicle';
  dropoff?: boolean;
  critical?: boolean;
  wall?: boolean;
  needsPower?: boolean;
  buildSource?: boolean;
  description: string;
}

// The faction's FIXED identity (always active when you pick the faction). This
// is NOT a per-match choice — Doctrines (see data/doctrines.ts) are the AI
// strategy variants WITHIN a faction and never replace this identity.
export interface TacticalProfile {
  doctrineLabel: string;     // faction signature, e.g. "Balanced Military Doctrine"
  build: string;
  attack: string;
  defense: string;
  economy: string;
  difficulty: string;        // faction complexity/ambition rating (NOT the global game difficulty)
  shortDescription: string;
}

export interface FactionDef {
  id: string;
  name: string;
  color: string;
  emissive: string;
  tagline: string;
  perks: string[];
  /** @deprecated Removed in Phase 4c.2 — balance lives in FACTION_MODIFIERS
   *  (src/data/factionModifiers.ts). Kept optional only for legacy compatibility;
   *  no runtime/validator/UI code reads it. */
  modifiers?: Record<string, number>;
  tactical?: TacticalProfile;
  strengths?: string[];
  weaknesses?: string[];
  defaultDoctrineId?: string; // the AI persona used when none is set explicitly
}

export interface MissionDef {
  id: string;
  name: string;
  briefing: string;
  map: { seed: number; size: number };
  playerFaction: string | null;
  enemyFaction: string;
  startingResources: number;
  enemyStartingResources: number;
  startingUnits: { type: string; offset: [number, number] }[];
  enemyStartingUnits: { type: string; offset: [number, number] }[];
  objectives: string[];
  winCondition: string;
  loseCondition: string;
  aiProfile: {
    name: string;
    firstWaveAt: number;
    waveInterval: number;
    waveGrowth: number;
    maxArmy: number;
    harvesters: number;
    rebuilds: boolean;
  };
}

export interface CampaignDef {
  id: string;
  name: string;
  description: string;
  missions: { id: string; name: string; file: string }[];
}
