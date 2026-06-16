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

export interface TacticalProfile {
  build: string;
  attack: string;
  defense: string;
  economy: string;
  archetype: string;         // faction playstyle tag shown as a badge (NOT the game difficulty)
  recommended?: string;
}

export interface FactionDef {
  id: string;
  name: string;
  color: string;
  emissive: string;
  tagline: string;
  perks: string[];
  modifiers: Record<string, number>;
  tactical?: TacticalProfile;
  strengths?: string[];
  weaknesses?: string[];
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
