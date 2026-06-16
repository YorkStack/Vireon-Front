// Tactical Doctrines (internally a CommanderProfile / AIPersonality). A doctrine
// is *how* a faction plays — it does NOT require a visible hero unit. The enemy
// AI uses its faction's default doctrine to shape build order, army mix and
// attack behaviour, so factions feel distinct.
//
// MVP: one default doctrine per faction (the first of three planned — see
// docs/design/faction-doctrine-system.md). Adding the rest later = more entries.
export type AttackTiming = 'early' | 'mid' | 'late';

export interface CommanderPersonality {
  buildAggression: number; attackAggression: number; defensePriority: number;
  economyPriority: number; techPriority: number; expansionPriority: number;
  riskTolerance: number; repairPriority: number; retreatThreshold: number;
  harassmentPreference: number; staticDefensePreference: number;
  unitReplacementBias: number; powerDependencyTolerance: number;
}

/**
 * Optional, SMALL modulation a doctrine may apply on top of the faction's fixed
 * modifiers — it biases, it never replaces the faction identity. Unused for now
 * (reserved for Phase 2 economy/power); kept here so the data model is complete.
 */
export interface DoctrineModifierBias {
  buildSpeed?: number;
  unitCost?: number;
  defensePower?: number;
  energyFocus?: number;
  expansionFocus?: number;
}

export interface Doctrine {
  id: string;
  faction: 'red' | 'blue' | 'green' | 'yellow'; // legacy faction key
  displayName: string;   // "Field Marshal Doctrine"
  uiName: string;        // "Field Marshal"
  description: string;
  preferredAttackTiming: AttackTiming;
  personality: CommanderPersonality;
  buildOrder?: string[];        // overrides the AI's CORE_PLAN
  defenseOrder?: string[];      // overrides the AI's DEFENSE_PLAN
  armyMix?: [string, number][]; // overrides the AI's ARMY_ROLE_MIX (role, weight)
  optionalModifierBias?: DoctrineModifierBias; // small modulation only — never replaces faction identity
  heroUnitId?: string;          // optional future visible commander
}

export const DOCTRINES: Record<string, Doctrine> = {
  crimson_field_marshal: {
    id: 'crimson_field_marshal', faction: 'red',
    displayName: 'Field Marshal Doctrine', uiName: 'Field Marshal',
    description: 'Sichert Wirtschaft & Basis, schlägt dann koordiniert mit Panzern zu.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.45, attackAggression: 0.55, defensePriority: 0.65, economyPriority: 0.70, techPriority: 0.50, expansionPriority: 0.45, riskTolerance: 0.35, repairPriority: 0.75, retreatThreshold: 0.35, harassmentPreference: 0.30, staticDefensePreference: 0.60, unitReplacementBias: 0.45, powerDependencyTolerance: 0.50 },
    buildOrder: ['nexus', 'refinery', 'spire', 'barracks', 'foundry', 'spire'],
    armyMix: [['rifle', 0.22], ['rocket', 0.16], ['attackVehicle', 0.12], ['tank', 0.28], ['siege', 0.10], ['scout', 0.06], ['antiAir', 0.06]],
  },
  azure_shield_architect: {
    id: 'azure_shield_architect', faction: 'blue',
    displayName: 'Shield Architect Doctrine', uiName: 'Shield Architect',
    description: 'Sehr defensiv: starke Gebäude, Schilde, Reparatur; langsam, schwer zu knacken.',
    preferredAttackTiming: 'late',
    personality: { buildAggression: 0.35, attackAggression: 0.30, defensePriority: 0.90, economyPriority: 0.70, techPriority: 0.60, expansionPriority: 0.25, riskTolerance: 0.20, repairPriority: 0.90, retreatThreshold: 0.55, harassmentPreference: 0.10, staticDefensePreference: 0.85, unitReplacementBias: 0.35, powerDependencyTolerance: 0.40 },
    buildOrder: ['nexus', 'refinery', 'spire', 'barracks', 'spire', 'foundry'],
    defenseOrder: ['cannon', 'wall', 'cannon', 'wall', 'lance', 'wall', 'cannon', 'lance'],
    armyMix: [['tank', 0.34], ['siege', 0.14], ['rifle', 0.22], ['rocket', 0.16], ['antiAir', 0.08], ['energy', 0.06]],
  },
  verdant_brood_rusher: {
    id: 'verdant_brood_rusher', faction: 'green',
    displayName: 'Brood Rusher Doctrine', uiName: 'Brood Rusher',
    description: 'Sehr früher Angriff, billige schnelle Einheiten, minimale Verteidigung.',
    preferredAttackTiming: 'early',
    personality: { buildAggression: 0.85, attackAggression: 0.95, defensePriority: 0.15, economyPriority: 0.45, techPriority: 0.20, expansionPriority: 0.55, riskTolerance: 0.85, repairPriority: 0.20, retreatThreshold: 0.10, harassmentPreference: 0.60, staticDefensePreference: 0.10, unitReplacementBias: 0.90, powerDependencyTolerance: 0.70 },
    buildOrder: ['nexus', 'barracks', 'refinery', 'spire', 'barracks', 'foundry'],
    defenseOrder: ['cannon', 'lance', 'cannon'],
    armyMix: [['rifle', 0.45], ['scout', 0.18], ['rocket', 0.22], ['tank', 0.10], ['antiAir', 0.05]],
  },
  solar_radiant_cultivator: {
    id: 'solar_radiant_cultivator', faction: 'yellow',
    displayName: 'Radiant Colony Doctrine', uiName: 'Radiant Cultivator',
    description: 'Energie-/Kolonie-Netzwerke, Zonenkontrolle, starke Verteidigung; spät vernichtend.',
    preferredAttackTiming: 'late',
    personality: { buildAggression: 0.45, attackAggression: 0.45, defensePriority: 0.75, economyPriority: 0.70, techPriority: 0.65, expansionPriority: 0.55, riskTolerance: 0.35, repairPriority: 0.70, retreatThreshold: 0.45, harassmentPreference: 0.20, staticDefensePreference: 0.80, unitReplacementBias: 0.45, powerDependencyTolerance: 0.30 },
    buildOrder: ['nexus', 'spire', 'refinery', 'spire', 'foundry', 'spire'],
    defenseOrder: ['lance', 'cannon', 'lance', 'wall', 'cannon', 'lance'],
    armyMix: [['energy', 0.28], ['tank', 0.30], ['siege', 0.14], ['rifle', 0.14], ['antiAir', 0.14]],
  },

  // ----- Crimson Pact (2 + 3) -----
  crimson_siege: {
    id: 'crimson_siege', faction: 'red', displayName: 'Siege Doctrine', uiName: 'Siege',
    description: 'Defensiv: Türme, Mauern, Reparatur — spät, aber massiv.',
    preferredAttackTiming: 'late',
    personality: { buildAggression: 0.40, attackAggression: 0.40, defensePriority: 0.85, economyPriority: 0.65, techPriority: 0.55, expansionPriority: 0.30, riskTolerance: 0.25, repairPriority: 0.85, retreatThreshold: 0.45, harassmentPreference: 0.15, staticDefensePreference: 0.90, unitReplacementBias: 0.40, powerDependencyTolerance: 0.50 },
    defenseOrder: ['cannon', 'cannon', 'wall', 'lance', 'wall', 'cannon', 'lance', 'cannon'],
    armyMix: [['siege', 0.28], ['tank', 0.30], ['rocket', 0.14], ['rifle', 0.16], ['antiAir', 0.12]],
  },
  crimson_armored: {
    id: 'crimson_armored', faction: 'red', displayName: 'Armored Doctrine', uiName: 'Armored',
    description: 'Mechanisiert: schnelle Fabrik, mittelfrüher Panzerangriff, weniger Defensive.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.65, attackAggression: 0.70, defensePriority: 0.40, economyPriority: 0.60, techPriority: 0.55, expansionPriority: 0.45, riskTolerance: 0.55, repairPriority: 0.60, retreatThreshold: 0.30, harassmentPreference: 0.35, staticDefensePreference: 0.35, unitReplacementBias: 0.50, powerDependencyTolerance: 0.50 },
    buildOrder: ['nexus', 'refinery', 'spire', 'foundry', 'spire', 'barracks'],
    armyMix: [['attackVehicle', 0.25], ['tank', 0.35], ['siege', 0.12], ['rifle', 0.15], ['rocket', 0.10], ['antiAir', 0.03]],
  },

  // ----- Azure Concorde (2 + 3) -----
  azure_tide_strategist: {
    id: 'azure_tide_strategist', faction: 'blue', displayName: 'Tide Strategist Doctrine', uiName: 'Tide Strategist',
    description: 'Gebietskontrolle, gesicherte Expansion, präzise Konter.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.45, attackAggression: 0.45, defensePriority: 0.70, economyPriority: 0.65, techPriority: 0.55, expansionPriority: 0.60, riskTolerance: 0.35, repairPriority: 0.75, retreatThreshold: 0.50, harassmentPreference: 0.30, staticDefensePreference: 0.65, unitReplacementBias: 0.40, powerDependencyTolerance: 0.45 },
    armyMix: [['tank', 0.30], ['rocket', 0.18], ['rifle', 0.24], ['siege', 0.10], ['scout', 0.10], ['antiAir', 0.08]],
  },
  azure_deep_current: {
    id: 'azure_deep_current', faction: 'blue', displayName: 'Deep Current Engineer Doctrine', uiName: 'Deep Current',
    description: 'Tech-orientiert: schwach im Early, starke fortgeschrittene Einheiten im Mid/Late.',
    preferredAttackTiming: 'late',
    personality: { buildAggression: 0.35, attackAggression: 0.40, defensePriority: 0.60, economyPriority: 0.75, techPriority: 0.90, expansionPriority: 0.35, riskTolerance: 0.30, repairPriority: 0.70, retreatThreshold: 0.55, harassmentPreference: 0.20, staticDefensePreference: 0.55, unitReplacementBias: 0.35, powerDependencyTolerance: 0.45 },
    buildOrder: ['nexus', 'refinery', 'spire', 'foundry', 'spire', 'barracks'],
    armyMix: [['tank', 0.30], ['siege', 0.20], ['energy', 0.14], ['rocket', 0.16], ['rifle', 0.12], ['antiAir', 0.08]],
  },

  // ----- Verdant Swarm (2 + 3) -----
  verdant_hive_expander: {
    id: 'verdant_hive_expander', faction: 'green', displayName: 'Hive Expander Doctrine', uiName: 'Hive Expander',
    description: 'Schnelle Expansion, sehr hoher Ressourcenverbrauch, Map-Control durch Masse.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.80, attackAggression: 0.70, defensePriority: 0.20, economyPriority: 0.70, techPriority: 0.30, expansionPriority: 0.90, riskTolerance: 0.70, repairPriority: 0.25, retreatThreshold: 0.15, harassmentPreference: 0.45, staticDefensePreference: 0.20, unitReplacementBias: 0.80, powerDependencyTolerance: 0.65 },
    buildOrder: ['nexus', 'refinery', 'barracks', 'spire', 'refinery', 'foundry'],
    armyMix: [['rifle', 0.40], ['scout', 0.20], ['rocket', 0.20], ['attackVehicle', 0.12], ['antiAir', 0.08]],
  },
  verdant_carapace_broodlord: {
    id: 'verdant_carapace_broodlord', faction: 'green', displayName: 'Carapace Broodlord Doctrine', uiName: 'Carapace Broodlord',
    description: 'Robustere Schwarmwellen, weniger Rush, gefährliches Midgame.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.65, attackAggression: 0.75, defensePriority: 0.35, economyPriority: 0.60, techPriority: 0.50, expansionPriority: 0.55, riskTolerance: 0.60, repairPriority: 0.35, retreatThreshold: 0.25, harassmentPreference: 0.30, staticDefensePreference: 0.30, unitReplacementBias: 0.70, powerDependencyTolerance: 0.65 },
    armyMix: [['rifle', 0.30], ['rocket', 0.25], ['tank', 0.25], ['siege', 0.10], ['antiAir', 0.10]],
  },

  // ----- Solar Dominion (2 + 3) -----
  solar_spore_prophet: {
    id: 'solar_spore_prophet', faction: 'yellow', displayName: 'Spore Prophet Doctrine', uiName: 'Spore Prophet',
    description: 'Unberechenbare Wellen, Störung/Mutation, nicht-lineares Build-Verhalten.',
    preferredAttackTiming: 'mid',
    personality: { buildAggression: 0.60, attackAggression: 0.65, defensePriority: 0.45, economyPriority: 0.55, techPriority: 0.70, expansionPriority: 0.50, riskTolerance: 0.65, repairPriority: 0.45, retreatThreshold: 0.30, harassmentPreference: 0.65, staticDefensePreference: 0.45, unitReplacementBias: 0.55, powerDependencyTolerance: 0.40 },
    armyMix: [['energy', 0.25], ['scout', 0.15], ['attackVehicle', 0.15], ['rocket', 0.20], ['tank', 0.15], ['antiAir', 0.10]],
  },
  solar_annihilator: {
    id: 'solar_annihilator', faction: 'yellow', displayName: 'Solar Annihilator Doctrine', uiName: 'Solar Annihilator',
    description: 'Langsamer, energiehungriger Aufbau; extrem starke Late-Game-Energieangriffe; anfällig bei Stromausfall.',
    preferredAttackTiming: 'late',
    personality: { buildAggression: 0.35, attackAggression: 0.55, defensePriority: 0.55, economyPriority: 0.70, techPriority: 0.90, expansionPriority: 0.30, riskTolerance: 0.40, repairPriority: 0.60, retreatThreshold: 0.45, harassmentPreference: 0.10, staticDefensePreference: 0.60, unitReplacementBias: 0.40, powerDependencyTolerance: 0.20 },
    buildOrder: ['nexus', 'spire', 'refinery', 'spire', 'spire', 'foundry'],
    armyMix: [['energy', 0.32], ['tank', 0.28], ['siege', 0.16], ['rifle', 0.12], ['antiAir', 0.12]],
  },
};

/** All doctrine ids for a faction (legacy key), in display order. */
export const DOCTRINES_BY_FACTION: Record<string, string[]> = {
  red: ['crimson_field_marshal', 'crimson_siege', 'crimson_armored'],
  blue: ['azure_shield_architect', 'azure_tide_strategist', 'azure_deep_current'],
  green: ['verdant_brood_rusher', 'verdant_hive_expander', 'verdant_carapace_broodlord'],
  yellow: ['solar_radiant_cultivator', 'solar_spore_prophet', 'solar_annihilator'],
};

/**
 * Each faction's DEFAULT doctrine (the AI persona used when none is set). This
 * is the canonical source; factions.json mirrors it as `defaultDoctrineId` for
 * the data model (a test keeps them in sync). Note: green's default is the
 * Hive Expander (expansionist), not the first-listed Brood Rusher.
 */
export const DEFAULT_DOCTRINE_BY_FACTION: Record<string, string> = {
  red: 'crimson_field_marshal',
  blue: 'azure_shield_architect',
  green: 'verdant_hive_expander',
  yellow: 'solar_radiant_cultivator',
};

export function doctrinesFor(legacyFactionId: string): Doctrine[] {
  return (DOCTRINES_BY_FACTION[legacyFactionId] ?? []).map((id) => DOCTRINES[id]).filter(Boolean);
}

export function defaultDoctrineFor(legacyFactionId: string): Doctrine {
  return DOCTRINES[DEFAULT_DOCTRINE_BY_FACTION[legacyFactionId] ?? 'crimson_field_marshal'];
}

/** Resolve a doctrine by id, falling back to a faction default. */
export function doctrineById(id: string | undefined, legacyFactionId: string): Doctrine {
  return (id && DOCTRINES[id]) || defaultDoctrineFor(legacyFactionId);
}

/**
 * Pick a doctrine for the enemy AI — ALWAYS from the enemy faction's own list
 * (enemy faction = identity; enemy doctrine = this match's AI persona). `rand`
 * is injectable for tests; defaults to Math.random.
 */
export function randomDoctrineFor(legacyFactionId: string, rand: () => number = Math.random): Doctrine {
  const list = doctrinesFor(legacyFactionId);
  if (!list.length) return defaultDoctrineFor(legacyFactionId);
  return list[Math.floor(rand() * list.length) % list.length];
}
