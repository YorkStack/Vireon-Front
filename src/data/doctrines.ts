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
};

/** Each faction's default (enemy-AI) doctrine, keyed by legacy faction id. */
export const DEFAULT_DOCTRINE_BY_FACTION: Record<string, string> = {
  red: 'crimson_field_marshal',
  blue: 'azure_shield_architect',
  green: 'verdant_brood_rusher',
  yellow: 'solar_radiant_cultivator',
};

export function defaultDoctrineFor(legacyFactionId: string): Doctrine {
  return DOCTRINES[DEFAULT_DOCTRINE_BY_FACTION[legacyFactionId] ?? 'crimson_field_marshal'];
}
