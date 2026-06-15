// Unit class templates — THE single source of balance truth.
//
// Every faction variant of a class inherits these numbers unchanged unless it
// declares an explicit, audited balanceOverride (see src/vehicles/*). Values
// for pre-existing classes are byte-identical to the old units.json so the
// verified gameplay loop does not move.
//
// Faction-wide perks (factions.json modifiers) are applied on top by
// unitFactory.resolveUnit() — those are intentional, visible in faction perks,
// and reported as "intentional" by the balance validator.

import type { UnitClass } from '../core/types';
import type { MovementType } from './movementProfiles';
import { ARMOR_CLASS_RESISTANCES, type ArmorClassId, type ResistanceTable } from './armor';

export type Stance = 'holdFire' | 'returnFire' | 'defendArea' | 'aggressive';
export type IntelligenceLevel = 'passive' | 'basic' | 'tactical' | 'autonomous';
export type TargetPriority = 'infantry' | 'vehicles' | 'aircraft' | 'structures' | 'harvesters' | 'turrets';

export interface UnitClassTemplate {
  id: string;
  displayName: string;
  unitClass: UnitClass;           // 'infantry' | 'vehicle' (sim collision/HUD)
  role: string;                   // AI production role key
  techTier: number;
  description: string;
  // general / economy
  builtAt: string;
  buildTime: number;
  cost: number;
  supplyCost: number;             // reserved — no supply system yet
  prerequisites: string[];
  // mobility (gameplay-effective — equal across factions!)
  defaultMovementType: MovementType;
  speed: number;
  acceleration: number;
  turnRate: number;
  pathingCategory: 'ground' | 'air' | 'water';
  canUseRamps: boolean;
  canCrossCliffs: boolean;
  canCrossWater: boolean;
  canFly: boolean;
  formationSpacing: number;
  collisionRadius: number;
  // durability
  maxHitPoints: number;
  armorClass: ArmorClassId;
  armorValue: number;             // reserved flat reduction (0 = legacy behavior)
  resistances: ResistanceTable;
  shieldPoints: number;
  shieldRechargeRate: number;
  // weapons (ids into data/weapons.ts; null = unarmed)
  primaryWeapon: string | null;
  secondaryWeapon: string | null;
  // sensors & autonomy
  visionRange: number;
  detectionRange: number;         // stealth detection (future)
  autoAcquireRange: number;
  canAutoAttack: boolean;
  defaultStance: Stance;
  pursuitRange: number;           // max chase distance from current anchor
  maxAutonomousDistanceFromBase: number;
  patrolRadius: number;
  guardRadius: number;
  retreatBehavior: 'none' | 'atLowHp' | 'afterStrike';
  targetPriority: TargetPriority[];
  intelligenceLevel: IntelligenceLevel;
  requiresPlayerAttackOrder: boolean;
  // utility blocks (per role)
  harvesting?: {
    cargoCapacity: number;
    gatherTime: number;           // seconds per load (legacy sim field)
    unloadRate: number;
    resourceTypesAccepted: string[];
    preferredResourceType: string;
    returnDropoffTypes: string[];
  };
  building?: {
    buildRange: number;
    repairRate: number;
    canBuildStructures: boolean;
    canRepair: boolean;
    buildCategoriesAllowed: string[];
    deployAnimationStyle: string;
  };
  support?: {
    repairAuraRange: number;      // tiles
    repairAmount: number;         // hp/s to nearby damaged vehicles
    shieldBoostRange: number;
    detectionAuraRange: number;
  };
}

const T = (t: UnitClassTemplate) => t;

/** Shared defaults so templates stay readable. */
const GROUND_MOBILITY = {
  pathingCategory: 'ground' as const,
  canUseRamps: true, canCrossCliffs: false, canCrossWater: false, canFly: false,
  acceleration: 8, turnRate: 3.2, formationSpacing: 1.2,
};
const NO_SHIELD = { shieldPoints: 0, shieldRechargeRate: 0 };
const COMBAT_AI = {
  canAutoAttack: true, defaultStance: 'aggressive' as Stance,
  intelligenceLevel: 'basic' as IntelligenceLevel, requiresPlayerAttackOrder: false,
  patrolRadius: 8, guardRadius: 7, retreatBehavior: 'none' as const,
  maxAutonomousDistanceFromBase: 60, detectionRange: 0,
};
const PASSIVE_AI = {
  canAutoAttack: false, defaultStance: 'holdFire' as Stance,
  intelligenceLevel: 'passive' as IntelligenceLevel, requiresPlayerAttackOrder: true,
  patrolRadius: 0, guardRadius: 0, retreatBehavior: 'atLowHp' as const,
  maxAutonomousDistanceFromBase: 60, detectionRange: 0,
};
const res = (a: ArmorClassId) => ({ ...ARMOR_CLASS_RESISTANCES[a] });

export const UNIT_CLASS_TEMPLATES: Record<string, UnitClassTemplate> = {
  // ====================== vehicles ======================
  harvester: T({
    id: 'harvester', displayName: 'Crystal Harvester', unitClass: 'vehicle', role: 'harvester',
    techTier: 1, builtAt: 'foundry', buildTime: 14, cost: 600, supplyCost: 0, prerequisites: [],
    description: 'Extracts vire crystal and hauls it to a refinery.',
    defaultMovementType: 'tracked', speed: 5.0, collisionRadius: 0.85, ...GROUND_MOBILITY,
    maxHitPoints: 420, armorClass: 'heavy', armorValue: 0, resistances: res('heavy'), ...NO_SHIELD,
    primaryWeapon: null, secondaryWeapon: null,
    visionRange: 8, autoAcquireRange: 8, pursuitRange: 12.8,
    targetPriority: [], ...PASSIVE_AI,
    harvesting: {
      cargoCapacity: 300, gatherTime: 7, unloadRate: 150,
      resourceTypesAccepted: ['vireCrystal'], preferredResourceType: 'vireCrystal',
      returnDropoffTypes: ['refinery'],
    },
  }),
  builder: T({
    id: 'builder', displayName: 'Fabricator', unitClass: 'vehicle', role: 'builder',
    techTier: 1, builtAt: 'foundry', buildTime: 18, cost: 800, supplyCost: 0, prerequisites: [],
    description: 'Constructs and repairs structures. Slow and unarmed - protect it.',
    defaultMovementType: 'tracked', speed: 5.2, collisionRadius: 0.85, ...GROUND_MOBILITY,
    maxHitPoints: 320, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: null, secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: [], ...PASSIVE_AI,
    building: {
      buildRange: 3, repairRate: 20, canBuildStructures: true, canRepair: true,
      buildCategoriesAllowed: ['all'], deployAnimationStyle: 'crane',
    },
  }),
  scout: T({
    id: 'scout', displayName: 'Dart', unitClass: 'vehicle', role: 'scout',
    techTier: 1, builtAt: 'foundry', buildTime: 9, cost: 350, supplyCost: 0, prerequisites: [],
    description: 'Fast recon skimmer with a light repeater. Scouts and harasses.',
    defaultMovementType: 'hover', speed: 8.6, collisionRadius: 0.7, ...GROUND_MOBILITY,
    maxHitPoints: 180, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'scoutRepeater', secondaryWeapon: null,
    visionRange: 12, autoAcquireRange: 12, pursuitRange: 19.2,
    targetPriority: ['harvesters', 'infantry'], ...COMBAT_AI,
  }),
  lightAttack: T({
    id: 'lightAttack', displayName: 'Striker', unitClass: 'vehicle', role: 'attackVehicle',
    techTier: 2, builtAt: 'foundry', buildTime: 10, cost: 450, supplyCost: 0, prerequisites: [],
    description: 'Light attack vehicle with a rapid autocannon. Fast flanker.',
    defaultMovementType: 'wheeled', speed: 7.0, collisionRadius: 0.75, ...GROUND_MOBILITY,
    maxHitPoints: 260, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'lightAutocannon', secondaryWeapon: null,
    visionRange: 10, autoAcquireRange: 10, pursuitRange: 16,
    targetPriority: ['infantry', 'harvesters', 'vehicles'], ...COMBAT_AI,
  }),
  mediumTank: T({
    id: 'mediumTank', displayName: 'Vanguard', unitClass: 'vehicle', role: 'tank',
    techTier: 2, builtAt: 'foundry', buildTime: 14, cost: 700, supplyCost: 0, prerequisites: [],
    description: 'Main battle tank. The backbone of any armored push.',
    defaultMovementType: 'tracked', speed: 5.6, collisionRadius: 0.9, ...GROUND_MOBILITY,
    maxHitPoints: 520, armorClass: 'heavy', armorValue: 0, resistances: res('heavy'), ...NO_SHIELD,
    primaryWeapon: 'tankCannon', secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: ['vehicles', 'turrets', 'structures'], ...COMBAT_AI,
  }),
  heavyTank: T({
    id: 'heavyTank', displayName: 'Earthshaker', unitClass: 'vehicle', role: 'siege',
    techTier: 3, builtAt: 'foundry', buildTime: 22, cost: 1200, supplyCost: 0, prerequisites: [],
    description: 'Siege platform. Long-range artillery that levels bases.',
    defaultMovementType: 'tracked', speed: 3.8, collisionRadius: 1.05, ...GROUND_MOBILITY,
    maxHitPoints: 760, armorClass: 'heavy', armorValue: 0, resistances: res('heavy'), ...NO_SHIELD,
    primaryWeapon: 'siegeHowitzer', secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: ['structures', 'turrets', 'vehicles'], ...COMBAT_AI,
  }),
  antiAir: T({
    id: 'antiAir', displayName: 'Skywatch', unitClass: 'vehicle', role: 'antiAir',
    techTier: 2, builtAt: 'foundry', buildTime: 12, cost: 550, supplyCost: 0, prerequisites: [],
    description: 'Anti-air platform. Weak flak vs ground - devastating once enemies take to the sky.',
    defaultMovementType: 'tracked', speed: 5.8, collisionRadius: 0.85, ...GROUND_MOBILITY,
    maxHitPoints: 300, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'flakBattery', secondaryWeapon: null,
    visionRange: 11, autoAcquireRange: 11, pursuitRange: 17.6,
    targetPriority: ['aircraft', 'infantry', 'vehicles'], ...COMBAT_AI,
  }),
  support: T({
    id: 'support', displayName: 'Tender', unitClass: 'vehicle', role: 'support',
    techTier: 2, builtAt: 'foundry', buildTime: 12, cost: 500, supplyCost: 0, prerequisites: [],
    description: 'Mobile repair rig. Slowly restores nearby damaged vehicles.',
    defaultMovementType: 'tracked', speed: 5.4, collisionRadius: 0.85, ...GROUND_MOBILITY,
    maxHitPoints: 320, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: null, secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: [], ...PASSIVE_AI,
    support: { repairAuraRange: 6, repairAmount: 8, shieldBoostRange: 0, detectionAuraRange: 0 },
  }),
  warden: T({
    id: 'warden', displayName: 'Warden', unitClass: 'vehicle', role: 'tank',
    techTier: 3, builtAt: 'foundry', buildTime: 20, cost: 1000, supplyCost: 0, prerequisites: [],
    description: 'Six-legged assault walker. Strides over rough terrain with a heavy cannon.',
    defaultMovementType: 'walker', speed: 4.4, collisionRadius: 1.0, ...GROUND_MOBILITY,
    maxHitPoints: 640, armorClass: 'heavy', armorValue: 0, resistances: res('heavy'), ...NO_SHIELD,
    primaryWeapon: 'tankCannon', secondaryWeapon: null,
    visionRange: 10, autoAcquireRange: 10, pursuitRange: 16,
    targetPriority: ['vehicles', 'structures', 'turrets'], ...COMBAT_AI,
  }),
  // ====================== infantry ======================
  lancer: T({
    id: 'lancer', displayName: 'Lancer', unitClass: 'infantry', role: 'rifle',
    techTier: 1, builtAt: 'barracks', buildTime: 6, cost: 120, supplyCost: 0, prerequisites: [],
    description: 'Cheap versatile rifle trooper. Strong against infantry.',
    defaultMovementType: 'walker', speed: 4.6, collisionRadius: 0.35, ...GROUND_MOBILITY,
    maxHitPoints: 90, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'lancerRifle', secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: ['infantry'], ...COMBAT_AI,
  }),
  breacher: T({
    id: 'breacher', displayName: 'Breacher', unitClass: 'infantry', role: 'rocket',
    techTier: 1, builtAt: 'barracks', buildTime: 9, cost: 240, supplyCost: 0, prerequisites: [],
    description: 'Shoulder-launched plasma rockets. Shreds vehicles and structures.',
    defaultMovementType: 'walker', speed: 4.2, collisionRadius: 0.35, ...GROUND_MOBILITY,
    maxHitPoints: 80, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'breacherRocket', secondaryWeapon: null,
    visionRange: 9, autoAcquireRange: 9, pursuitRange: 14.4,
    targetPriority: ['vehicles', 'structures'], ...COMBAT_AI,
  }),
  arcweaver: T({
    id: 'arcweaver', displayName: 'Arcweaver', unitClass: 'infantry', role: 'energy',
    techTier: 2, builtAt: 'barracks', buildTime: 11, cost: 320, supplyCost: 0, prerequisites: [],
    description: 'Specialist with an arc projector. Reliable damage against everything.',
    defaultMovementType: 'walker', speed: 4.4, collisionRadius: 0.35, ...GROUND_MOBILITY,
    maxHitPoints: 110, armorClass: 'light', armorValue: 0, resistances: res('light'), ...NO_SHIELD,
    primaryWeapon: 'arcProjector', secondaryWeapon: null,
    visionRange: 10, autoAcquireRange: 10, pursuitRange: 16,
    targetPriority: ['infantry', 'vehicles'], ...COMBAT_AI,
  }),
};

/** Vehicle classes that get per-faction variants (order = codex display + balance audit). */
export const VEHICLE_CLASS_IDS = [
  'harvester', 'builder', 'scout', 'lightAttack',
  'mediumTank', 'heavyTank', 'antiAir', 'support', 'warden',
] as const;
export type VehicleClassId = typeof VEHICLE_CLASS_IDS[number];

// ---------------- custom classes (studio-authored: ships, aircraft, …) ----------------
// Registered by `npm run import:vehicle` writing src/data/customClasses.json from
// an export bundle's classDef. Statically integrated: they get a ground-vehicle
// balance template (no new movement physics), render via their imported spec, and
// appear in the Unit Codex. Faction perks still apply via unitFactory.
import customClassDefs from './customClasses.json';

export interface CustomClassDef {
  id: string;
  displayName: string;
  role: string;
  tilesWide: number;
  subject?: string;
  techTier?: number;
  movementType?: MovementType;
}

/** Build a full balance template for a custom class from its compact definition. */
export function customClassToTemplate(def: CustomClassDef): UnitClassTemplate {
  const tiles = Math.max(1, def.tilesWide || 3);
  const hp = Math.round(220 + tiles * 140);
  return T({
    id: def.id, displayName: def.displayName, unitClass: 'vehicle', role: def.role || 'attackVehicle',
    techTier: def.techTier ?? 2, builtAt: 'foundry', buildTime: Math.round(10 + tiles * 3),
    cost: Math.round((400 + tiles * 200) / 5) * 5, supplyCost: 0, prerequisites: [],
    description: def.subject || `${def.displayName} (custom class).`,
    defaultMovementType: def.movementType ?? 'tracked', speed: 5.2,
    collisionRadius: +(tiles * 0.3).toFixed(2), ...GROUND_MOBILITY,
    maxHitPoints: hp, armorClass: 'heavy', armorValue: 0, resistances: res('heavy'), ...NO_SHIELD,
    primaryWeapon: null, secondaryWeapon: null,
    visionRange: 10, autoAcquireRange: 10, pursuitRange: 16,
    targetPriority: ['vehicles', 'structures'], ...COMBAT_AI,
  });
}

export const CUSTOM_CLASS_DEFS = customClassDefs as unknown as CustomClassDef[];
export const CUSTOM_CLASS_IDS: string[] = CUSTOM_CLASS_DEFS.map((d) => d.id);

// Merge custom templates into the single balance registry.
for (const def of CUSTOM_CLASS_DEFS) {
  UNIT_CLASS_TEMPLATES[def.id] = customClassToTemplate(def);
}
