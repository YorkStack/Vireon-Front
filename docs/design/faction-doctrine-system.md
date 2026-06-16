# Vireon Front — Faction Doctrine, AI-Personality & Balancing System

> Design-Spec (Entwurf). Datengetrieben, implementierungsnah, auf den bestehenden
> Code abgestimmt (`src/data/factions.json`, `src/ai/enemy.ts`, das Power-System in
> `src/sim/world.ts`, `unitStats`/`buildingStats` in `src/core/defs.ts`).
> Status: zur Freigabe. Nichts davon ist bereits implementiert.

---

## 1. Kurzfazit / Designentscheidung

Wir führen **drei orthogonale Datenschichten** ein, die sich multiplikativ kombinieren:

1. **Faction** — *wer* sie sind (Biologie/Kultur/Tech). Bestimmt Boni/Mali, Ressourcen- und Energie-Charakter. Erweitert das bestehende `factions.json`.
2. **Doctrine** (intern `CommanderProfile`/`AIPersonality`) — *wie* sie spielen. 3 pro Fraktion = **12 Doctrines**. Reine Verhaltens- und Prioritätsdaten (0..1-Knöpfe) + Build-/Armee-Overrides.
3. **Difficulty** — globale Schwierigkeit (leicht/mittel/schwer/superschwer) als Multiplikatoren auf Timing, Armeegröße und KI-Einkommen.

> **Endwert eines KI-Parameters = Basis (Mission) × Difficulty × Doctrine-Bias × Faction-Modifier.**

Alles liegt in JSON/TS-Daten, nicht im Code verteilt. Ein **Admin-/Dev-Tuning-Overlay** erlaubt Live-Justierung mit localStorage-Persistenz, Export/Import und einem **Power-Score** als Balancing-Frühwarnung.

Leitprinzip Balancing: **jede Fraktion hat klare Stärken UND klare Schwächen; jeder Bonus wird durch einen Malus bezahlt.** Früh-/Mittel-/Spätspiel werden getrennt bewertet.

---

## 2. Commander vs. Doctrine vs. sichtbarer Held

```
Fraktion   = Wer sind sie? (Biologie, Kultur, Tech)         → factions.json
Doctrine   = Wie kämpfen & wirtschaften sie?                → doctrines.json (CommanderProfile)
Held       = optionale sichtbare Einheit, die eine Doctrine verkörpert (später, optional)
```

- **Intern** heißt das Profil `CommanderProfile` (Feld `personality: CommanderPersonality`).
- **Im UI** erscheint es als **„Tactical Doctrine"** — kein Held nötig.
- Das Datenmodell trägt ein optionales `heroUnitId?: string`. Ist es gesetzt, kann später eine sichtbare Commander-Einheit gespawnt werden; ist es leer, läuft alles rein als Strategieprofil. **Kein Code-Pfad hängt von einem Helden ab.**

---

## 3. Zielarchitektur

```
src/data/
  factions.json            # erweitert: tacticalProfile, strengths, weaknesses, economy, power
  doctrines.json           # 12 CommanderProfiles
  difficulty.ts            # 4 DifficultyConfigs (leicht..superschwer)
  balancing.ts             # BalancingWeights + DEFAULT_TUNING + Power-Score-Gewichte

src/ai/
  enemy.ts                 # bekommt (difficulty, doctrine); nutzt deren Werte statt Konstanten
  decisions.ts (neu)       # getBuildPriorities/shouldAttack/... — reine Funktionen, testbar
  gameState.ts (neu)       # Phasen-/Bedrohungs-/Ressourcen-Snapshot für die Entscheidungen

src/sim/
  economy.ts (neu)         # ResourceModel + PowerModel + Upkeep + ColonyAura (aus world.ts extrahiert/erweitert)

src/ui/
  tacticalCard.ts (neu)    # Tactical-Profile-Karte im Auswahlbildschirm
  adminPanel.ts (neu)      # Dev-Tuning-Overlay (nur im Dev-Build / per ?admin)

src/core/
  tuning.ts (neu)          # lädt DEFAULTS, merged Admin-Overrides aus localStorage, liefert effektive Werte
```

Kernidee: **eine `Tuning`-Singleton-Quelle**. Alles (Faction-Mods, Doctrine-Knöpfe, Difficulty, Balancing-Gewichte) läuft durch `tuning.get(...)`, das Defaults mit Admin-Overrides merged. So ist jeder Wert an *einer* Stelle justierbar.

---

## 4. TypeScript-Interfaces / Datenmodell

```ts
// ---------- Faction ----------
export interface TacticalProfile {
  doctrine: string;            // Default-Doctrine-Anzeigename
  build: string;               // "Stable" | "Slower, stronger" | "Very fast" | "Energy-dependent"
  attack: string;              // "Coordinated" | "Counter-focused" | "Relentless" | "Devastating"
  defense: string;             // "Fortified" | "Excellent" | "Weak" | "Zone-based"
  economy: string;             // "Controlled" | "Efficient" | "Resource-hungry" | "Power-intensive"
  difficulty: 'Easy' | 'Medium' | 'Medium-Hard' | 'Aggressive' | 'Hard';
  recommendedPlaystyle: string;
}

export interface FactionModifiers {     // alle optional; default 1.0 (bzw. 0)
  vehicleDamage?: number; energyDamage?: number; infantryDamage?: number;
  hp?: number; unitHp?: number; buildingHp?: number;
  buildTime?: number;                 // >1 = langsamer
  staticDefenseBuildTime?: number;    // Crimson: 0.9
  vehicleCost?: number; infantryCost?: number; unitCost?: number; buildingCost?: number;
  unitProdSpeed?: number;             // Verdant: 1.20 (schnellere Queue)
  gatherRate?: number;                // Erz pro Ladung
  resourceUpkeep?: number;            // Verdant: 1.10 laufender Abzug
  powerUse?: number;                  // Solar: 1.25
  turretRange?: number;               // additiv (Tiles)
  turretTurnRate?: number;            // Azure: 0.8 (langsamer)
  repairRate?: number;                // Crimson: 1.10
  shieldStrength?: number;            // Azure
  auraStrength?: number;              // Solar
  powerGridVulnerability?: number;    // Solar: 1.35 (Strafe bei Ausfall)
}

export interface FactionStrengthWeakness { strengths: string[]; weaknesses: string[]; }

export interface FactionProfile {
  id: 'crimson_pact' | 'azure_concorde' | 'verdant_swarm' | 'solar_dominion';
  legacyKey: 'red' | 'blue' | 'green' | 'yellow';   // Brücke zum bestehenden Code
  displayName: string; color: string; emissive: string; tagline: string;
  tacticalProfile: TacticalProfile;
  modifiers: FactionModifiers;
  perks: string[];                     // kurze UI-Bullets (Boni)
  strengthsWeaknesses: FactionStrengthWeakness;
  economy: FactionEconomyModifiers;
  power: PowerModel;
  defaultDoctrineId: string;
  doctrineIds: string[];               // 3 Doctrines
}

// ---------- Doctrine / Commander ----------
export type AttackTiming = 'early' | 'mid' | 'late';

export interface CommanderPersonality {  // alle 0.0..1.0
  buildAggression: number;        // wie schnell/breit gebaut wird
  attackAggression: number;       // Angriffsdruck
  defensePriority: number;        // Anteil Armee/Bau für Verteidigung
  economyPriority: number;        // Harvester/Refinery-Fokus
  techPriority: number;           // Hochrüsten vs. Masse
  expansionPriority: number;      // Zweitbasis/Map-Control
  riskTolerance: number;          // greift trotz Unterzahl an?
  repairPriority: number;
  retreatThreshold: number;       // HP/Verlust-Quote, ab der zurückgezogen wird
  harassmentPreference: number;   // kleine Nadelstiche statt Großangriff
  staticDefensePreference: number;// Türme/Mauern
  unitReplacementBias: number;    // Verluste ersetzen statt Rückzug (Verdant hoch)
  powerDependencyTolerance: number;// wie viel Energie-Risiko akzeptiert wird (Solar niedrig = vorsichtig)
}

export interface CommanderStrategy {
  earlyGame: string; midGame: string; lateGame: string;  // semantische Tags (s.u.)
}

export interface CommanderProfile {
  id: string;                     // "crimson_field_marshal"
  faction: FactionProfile['id'];
  displayName: string;            // "Field Marshal Doctrine"
  uiName: string;                 // "Field Marshal"
  description: string;
  personality: CommanderPersonality;
  strategy: CommanderStrategy;
  preferredAttackTiming: AttackTiming;
  buildOrder?: string[];          // Override der CORE_PLAN
  defenseOrder?: string[];        // Override der DEFENSE_PLAN
  armyMix?: [string, number][];   // Override der ARMY_ROLE_MIX (role, weight)
  heroUnitId?: string;            // optional, später
}

// ---------- Difficulty ----------
export interface DifficultyConfig {
  id: 'leicht' | 'mittel' | 'schwer' | 'superschwer';
  uiName: string;
  firstWaveMul: number; waveIntervalMul: number; waveGrowthMul: number;
  maxArmyMul: number; aiIncomeMul: number; buildCadenceMul: number;
}

// ---------- Economy / Power ----------
export interface FactionEconomyModifiers {
  gatherRateMul: number;          // Erz pro Ladung
  unitCostMul: number; buildingCostMul: number;
  buildSpeedMul: number;          // <1 = langsamer (Azure), >1 = schneller (Verdant)
  upkeepPerUnit: number;          // 0 = kein Upkeep; Verdant > 0
  startingCreditsMul: number;
}
export interface ResourceModel { primary: 'crystal'; dropoffTypes: string[]; cargoToCredits: number; }
export interface PowerModel {
  baseDependency: number;         // 0..1 wie stark die Fraktion von Strom abhängt
  outage: PowerOutageEffect;
  aura?: ColonyAuraEffect;        // nur Solar
}
export interface PowerOutageEffect {
  productionRateMul: number;      // Queue-Tempo bei lowPower (z. B. 0.5)
  turretsOffline: boolean;        // Türme feuern nicht
  repairRateMul: number;          // Reparatur/Schild bei lowPower
  unitDamageMul: number;          // Solar: Energie-Einheiten verlieren Punch (z. B. 0.7)
  moveSpeedMul: number;           // optional
}
export interface ColonyAuraEffect {
  radiusTiles: number; buildingHpMul: number; unitDamageMul: number; repairBonus: number;
}

// ---------- Balancing ----------
export interface BalancingWeights {     // Power-Score-Gewichte (Summe der Pluspunkte ~1.0)
  early: number; mid: number; late: number;
  economy: number; attack: number; defense: number; tech: number;
}
export interface FactionPowerScore {
  faction: string; doctrine?: string;
  early: number; mid: number; late: number;
  economy: number; attack: number; defense: number; tech: number;
  resourcePenalty: number; energyPenalty: number; vulnerabilityPenalty: number;
  overall: number; verdict: 'underpowered' | 'balanced' | 'overpowered';
}
export interface BalancingTuningProfile {     // ein speicherbares Admin-Set
  id: string; createdAt: string;
  factionOverrides: Record<string, Partial<FactionModifiers & FactionEconomyModifiers>>;
  doctrineOverrides: Record<string, Partial<CommanderPersonality>>;
  difficultyOverrides: Record<string, Partial<DifficultyConfig>>;
  weights: BalancingWeights;
}
export interface AdminTuningState {
  active: BalancingTuningProfile;
  defaults: BalancingTuningProfile;
  dirty: boolean;
}
```

---

## 5. Fraktionsprofile (Tactical Profile, Boni/Mali, Ressourcen-/Energie-Logik)

Konkrete `factions.json`-Erweiterung (gekürzt; `legacyKey` hält den bestehenden Code lauffähig).

```jsonc
{
  "crimson_pact": {
    "legacyKey": "red", "displayName": "Crimson Pact",
    "color": "#ff3b30", "emissive": "#ff5c4d", "tagline": "Iron columns. Forward, always.",
    "tacticalProfile": { "doctrine": "Balanced Military Doctrine", "build": "Stable",
      "attack": "Coordinated", "defense": "Fortified", "economy": "Controlled",
      "difficulty": "Medium", "recommendedPlaystyle": "Sichern, aufbauen, koordiniert zuschlagen." },
    "modifiers": { "vehicleDamage": 1.15, "vehicleCost": 1.10, "staticDefenseBuildTime": 0.90, "repairRate": 1.10 },
    "perks": ["Vehicle weapons +15% damage", "Static defenses build 10% faster", "Repair +10%", "Vehicles cost +10%"],
    "strengthsWeaknesses": {
      "strengths": ["Reliable vehicles", "Strong defensive setup", "Balanced economy"],
      "weaknesses": ["Vehicles cost more", "Less explosive early aggression"] },
    "economy": { "gatherRateMul": 1.0, "unitCostMul": 1.0, "buildingCostMul": 1.0, "buildSpeedMul": 1.0, "upkeepPerUnit": 0, "startingCreditsMul": 1.0 },
    "power": { "baseDependency": 0.5,
      "outage": { "productionRateMul": 0.6, "turretsOffline": true, "repairRateMul": 0.7, "unitDamageMul": 1.0, "moveSpeedMul": 1.0 } },
    "defaultDoctrineId": "crimson_field_marshal",
    "doctrineIds": ["crimson_field_marshal", "crimson_siege", "crimson_armored"]
  },

  "azure_concorde": {
    "legacyKey": "blue", "displayName": "Azure Concorde",
    "color": "#2f7cff", "emissive": "#4d8cff", "tagline": "The shield that does not break.",
    "tacticalProfile": { "doctrine": "Shielded Control Doctrine", "build": "Slower, stronger",
      "attack": "Counter-focused", "defense": "Excellent", "economy": "Efficient",
      "difficulty": "Medium-Hard", "recommendedPlaystyle": "Befestigen, kontern, Raum kontrollieren." },
    "modifiers": { "hp": 1.15, "buildTime": 1.12, "shieldStrength": 1.25, "turretTurnRate": 0.80, "repairRate": 1.15, "powerUse": 1.10 },
    "perks": ["Units & buildings +15% hull", "Stronger shields & repair", "Construction 12% slower", "Turrets turn slower"],
    "strengthsWeaknesses": {
      "strengths": ["Durable units & buildings", "Strong defensive tech", "Excellent counterattacks"],
      "weaknesses": ["Slower construction", "Energy-dependent defenses"] },
    "economy": { "gatherRateMul": 1.10, "unitCostMul": 1.0, "buildingCostMul": 1.05, "buildSpeedMul": 0.88, "upkeepPerUnit": 0, "startingCreditsMul": 1.0 },
    "power": { "baseDependency": 0.7,
      "outage": { "productionRateMul": 0.6, "turretsOffline": true, "repairRateMul": 0.4, "unitDamageMul": 1.0, "moveSpeedMul": 1.0 } },
    "defaultDoctrineId": "azure_shield_architect",
    "doctrineIds": ["azure_shield_architect", "azure_tide_strategist", "azure_deep_current"]
  },

  "verdant_swarm": {
    "legacyKey": "green", "displayName": "Verdant Swarm",
    "color": "#2ecc40", "emissive": "#49e85d", "tagline": "We are many. We are fast.",
    "tacticalProfile": { "doctrine": "Swarm Consumption Doctrine", "build": "Very fast",
      "attack": "Relentless", "defense": "Weak", "economy": "Resource-hungry",
      "difficulty": "Aggressive", "recommendedPlaystyle": "Früh expandieren, billig spammen, Druck halten." },
    "modifiers": { "infantrySpeed": 1.15, "infantryCost": 0.85, "unitCost": 0.90, "unitHp": 0.90, "buildingHp": 0.90, "unitProdSpeed": 1.20, "resourceUpkeep": 1.10 },
    "perks": ["Infantry +15% speed, −15% cost", "Unit production +20%", "Units −10% cost", "−10% hull", "Resource upkeep +10%"],
    "strengthsWeaknesses": {
      "strengths": ["Fast production", "Cheap units", "Early pressure"],
      "weaknesses": ["Weak static defense", "High resource consumption", "Lower durability"] },
    "economy": { "gatherRateMul": 1.0, "unitCostMul": 0.90, "buildingCostMul": 0.95, "buildSpeedMul": 1.20, "upkeepPerUnit": 0.4, "startingCreditsMul": 1.0 },
    "power": { "baseDependency": 0.3,
      "outage": { "productionRateMul": 0.8, "turretsOffline": false, "repairRateMul": 0.9, "unitDamageMul": 1.0, "moveSpeedMul": 1.0 } },
    "defaultDoctrineId": "verdant_brood_rusher",
    "doctrineIds": ["verdant_brood_rusher", "verdant_hive_expander", "verdant_carapace_broodlord"]
  },

  "solar_dominion": {
    "legacyKey": "yellow", "displayName": "Solar Dominion",
    "color": "#ffcc00", "emissive": "#ffd84d", "tagline": "Light, weaponized.",
    "tacticalProfile": { "doctrine": "Radiant Colony Doctrine", "build": "Energy-dependent",
      "attack": "Devastating", "defense": "Zone-based", "economy": "Power-intensive",
      "difficulty": "Hard", "recommendedPlaystyle": "Power-Grid sichern, Zonen halten, spät vernichtend zuschlagen." },
    "modifiers": { "energyDamage": 1.20, "turretRange": 1, "powerUse": 1.25, "auraStrength": 1.0, "powerGridVulnerability": 1.35 },
    "perks": ["Energy weapons +20% damage", "Turrets +1 range", "Colony aura buffs nearby", "Buildings use +25% power", "Weak if power grid disrupted"],
    "strengthsWeaknesses": {
      "strengths": ["Powerful energy weapons", "Long-range turrets", "Colony aura control"],
      "weaknesses": ["High power consumption", "Crippled if power grid is disrupted", "Slow early game"] },
    "economy": { "gatherRateMul": 1.0, "unitCostMul": 1.05, "buildingCostMul": 1.0, "buildSpeedMul": 0.92, "upkeepPerUnit": 0, "startingCreditsMul": 1.0 },
    "power": { "baseDependency": 0.95,
      "outage": { "productionRateMul": 0.4, "turretsOffline": true, "repairRateMul": 0.5, "unitDamageMul": 0.70, "moveSpeedMul": 0.9 },
      "aura": { "radiusTiles": 6, "buildingHpMul": 1.10, "unitDamageMul": 1.10, "repairBonus": 0.5 } }
  }
}
```

### Ressourcen-/Energie-Logik (Zusammenfassung)
- **ResourceModel:** Kristall → Harvester → Dropoff (`refinery`/`foundry`) → Credits (`cargoToCredits` = aktuell 1:1). `gatherRateMul` skaliert den Ertrag pro Fraktion.
- **PowerModel:** bestehendes `b.def.power` (+/−), `team.lowPower = used > prod`. Neu: **`PowerOutageEffect` pro Fraktion** ersetzt die heute pauschale `lowPower`-Logik. Solar fällt bei Ausfall hart ab (`unitDamageMul 0.70`, `productionRateMul 0.40`, Türme offline), Verdant kaum (`0.80`, Türme bleiben). 
- **UpkeepModel (optional, Phase 3):** `upkeepPerUnit` zieht laufend Credits ab → Verdant „ressourcenhungrig". Default 0 für die anderen.
- **ColonyAuraEffect (Solar):** Energie-Strukturen erzeugen eine Aura (`radiusTiles 6`), die nahe Gebäude/Einheiten verstärkt — Solars „Zonenkontrolle".

---

## 6. Die 12 Doctrines (konkrete Werte)

`doctrines.json` (Personality-Knöpfe 0..1). Kompakt; `strategy`-Tags sind die semantischen Hooks für `decisions.ts`.

```jsonc
// ===== CRIMSON PACT =====
{ "id":"crimson_field_marshal","faction":"crimson_pact","displayName":"Field Marshal Doctrine","uiName":"Field Marshal",
  "description":"Sichert Wirtschaft & Basis, schlägt dann koordiniert mit Panzern zu.",
  "personality":{"buildAggression":0.45,"attackAggression":0.55,"defensePriority":0.65,"economyPriority":0.70,"techPriority":0.50,"expansionPriority":0.45,"riskTolerance":0.35,"repairPriority":0.75,"retreatThreshold":0.35,"harassmentPreference":0.30,"staticDefensePreference":0.60,"unitReplacementBias":0.45,"powerDependencyTolerance":0.50},
  "strategy":{"earlyGame":"secure_base_and_economy","midGame":"vehicle_force_and_static_defense","lateGame":"coordinated_armored_attack"},
  "preferredAttackTiming":"mid" },

{ "id":"crimson_siege","faction":"crimson_pact","displayName":"Siege Doctrine","uiName":"Siege",
  "description":"Defensiv: Türme, Mauern, Reparatur — spät, aber massiv.",
  "personality":{"buildAggression":0.40,"attackAggression":0.40,"defensePriority":0.85,"economyPriority":0.65,"techPriority":0.55,"expansionPriority":0.30,"riskTolerance":0.25,"repairPriority":0.85,"retreatThreshold":0.45,"harassmentPreference":0.15,"staticDefensePreference":0.90,"unitReplacementBias":0.40,"powerDependencyTolerance":0.50},
  "strategy":{"earlyGame":"turtle_and_economy","midGame":"fortify_and_tech","lateGame":"heavy_siege_push"},
  "preferredAttackTiming":"late",
  "defenseOrder":["cannon","cannon","wall","lance","wall","cannon","lance","cannon"] },

{ "id":"crimson_armored","faction":"crimson_pact","displayName":"Armored Doctrine","uiName":"Armored",
  "description":"Mechanisiert: schnelle Fabrik, mittelfrüher Panzerangriff, weniger Defensive.",
  "personality":{"buildAggression":0.65,"attackAggression":0.70,"defensePriority":0.40,"economyPriority":0.60,"techPriority":0.55,"expansionPriority":0.45,"riskTolerance":0.55,"repairPriority":0.60,"retreatThreshold":0.30,"harassmentPreference":0.35,"staticDefensePreference":0.35,"unitReplacementBias":0.50,"powerDependencyTolerance":0.50},
  "strategy":{"earlyGame":"fast_foundry","midGame":"tank_pressure","lateGame":"combined_arms_push"},
  "preferredAttackTiming":"mid",
  "buildOrder":["nexus","refinery","spire","foundry","spire","barracks"],
  "armyMix":[["attackVehicle",0.25],["tank",0.35],["siege",0.12],["rifle",0.15],["rocket",0.10],["antiAir",0.03]] },

// ===== AZURE CONCORDE =====
{ "id":"azure_shield_architect","faction":"azure_concorde","displayName":"Shield Architect Doctrine","uiName":"Shield Architect",
  "description":"Sehr defensiv: starke Gebäude, Schilde, Reparatur; langsam, schwer zu knacken.",
  "personality":{"buildAggression":0.35,"attackAggression":0.30,"defensePriority":0.90,"economyPriority":0.70,"techPriority":0.60,"expansionPriority":0.25,"riskTolerance":0.20,"repairPriority":0.90,"retreatThreshold":0.55,"harassmentPreference":0.10,"staticDefensePreference":0.85,"unitReplacementBias":0.35,"powerDependencyTolerance":0.40},
  "strategy":{"earlyGame":"fortify_core","midGame":"shield_wall_and_repair","lateGame":"counter_and_hold"},
  "preferredAttackTiming":"late" },

{ "id":"azure_tide_strategist","faction":"azure_concorde","displayName":"Tide Strategist Doctrine","uiName":"Tide Strategist",
  "description":"Gebietskontrolle, gesicherte Expansion, präzise Konter.",
  "personality":{"buildAggression":0.45,"attackAggression":0.45,"defensePriority":0.70,"economyPriority":0.65,"techPriority":0.55,"expansionPriority":0.60,"riskTolerance":0.35,"repairPriority":0.75,"retreatThreshold":0.50,"harassmentPreference":0.30,"staticDefensePreference":0.65,"unitReplacementBias":0.40,"powerDependencyTolerance":0.45},
  "strategy":{"earlyGame":"secure_expand","midGame":"zone_control","lateGame":"precise_counterattacks"},
  "preferredAttackTiming":"mid" },

{ "id":"azure_deep_current","faction":"azure_concorde","displayName":"Deep Current Engineer Doctrine","uiName":"Deep Current",
  "description":"Tech-orientiert: schwach im Early, starke fortgeschrittene Einheiten im Mid/Late.",
  "personality":{"buildAggression":0.35,"attackAggression":0.40,"defensePriority":0.60,"economyPriority":0.75,"techPriority":0.90,"expansionPriority":0.35,"riskTolerance":0.30,"repairPriority":0.70,"retreatThreshold":0.55,"harassmentPreference":0.20,"staticDefensePreference":0.55,"unitReplacementBias":0.35,"powerDependencyTolerance":0.45},
  "strategy":{"earlyGame":"tech_economy","midGame":"advanced_units","lateGame":"high_tech_strike"},
  "preferredAttackTiming":"late" },

// ===== VERDANT SWARM =====
{ "id":"verdant_brood_rusher","faction":"verdant_swarm","displayName":"Brood Rusher Doctrine","uiName":"Brood Rusher",
  "description":"Sehr früher Angriff, billige schnelle Einheiten, minimale Verteidigung.",
  "personality":{"buildAggression":0.85,"attackAggression":0.95,"defensePriority":0.15,"economyPriority":0.45,"techPriority":0.20,"expansionPriority":0.55,"riskTolerance":0.85,"repairPriority":0.20,"retreatThreshold":0.10,"harassmentPreference":0.60,"staticDefensePreference":0.10,"unitReplacementBias":0.90,"powerDependencyTolerance":0.70},
  "strategy":{"earlyGame":"mass_cheap_infantry","midGame":"relentless_waves","lateGame":"overwhelm"},
  "preferredAttackTiming":"early",
  "buildOrder":["nexus","barracks","refinery","spire","barracks","foundry"],
  "armyMix":[["rifle",0.45],["scout",0.18],["rocket",0.22],["tank",0.10],["antiAir",0.05]] },

{ "id":"verdant_hive_expander","faction":"verdant_swarm","displayName":"Hive Expander Doctrine","uiName":"Hive Expander",
  "description":"Schnelle Expansion, sehr hoher Ressourcenverbrauch, Map-Control durch Masse.",
  "personality":{"buildAggression":0.80,"attackAggression":0.70,"defensePriority":0.20,"economyPriority":0.70,"techPriority":0.30,"expansionPriority":0.90,"riskTolerance":0.70,"repairPriority":0.25,"retreatThreshold":0.15,"harassmentPreference":0.45,"staticDefensePreference":0.20,"unitReplacementBias":0.80,"powerDependencyTolerance":0.65},
  "strategy":{"earlyGame":"fast_expand","midGame":"map_control_mass","lateGame":"economic_overwhelm"},
  "preferredAttackTiming":"mid" },

{ "id":"verdant_carapace_broodlord","faction":"verdant_swarm","displayName":"Carapace Broodlord Doctrine","uiName":"Carapace Broodlord",
  "description":"Robustere Schwarmwellen, weniger Rush, gefährliches Midgame.",
  "personality":{"buildAggression":0.65,"attackAggression":0.75,"defensePriority":0.35,"economyPriority":0.60,"techPriority":0.50,"expansionPriority":0.55,"riskTolerance":0.60,"repairPriority":0.35,"retreatThreshold":0.25,"harassmentPreference":0.30,"staticDefensePreference":0.30,"unitReplacementBias":0.70,"powerDependencyTolerance":0.65},
  "strategy":{"earlyGame":"steady_broods","midGame":"armored_swarm","lateGame":"heavy_waves"},
  "preferredAttackTiming":"mid",
  "armyMix":[["rifle",0.30],["rocket",0.25],["tank",0.25],["siege",0.10],["antiAir",0.10]] },

// ===== SOLAR DOMINION =====
{ "id":"solar_radiant_cultivator","faction":"solar_dominion","displayName":"Radiant Cultivator Doctrine","uiName":"Radiant Cultivator",
  "description":"Energie-/Kolonie-Netzwerke, Gebietskontrolle, starke Verteidigung in kontrollierten Zonen.",
  "personality":{"buildAggression":0.45,"attackAggression":0.45,"defensePriority":0.75,"economyPriority":0.70,"techPriority":0.65,"expansionPriority":0.55,"riskTolerance":0.35,"repairPriority":0.70,"retreatThreshold":0.45,"harassmentPreference":0.20,"staticDefensePreference":0.80,"unitReplacementBias":0.45,"powerDependencyTolerance":0.30},
  "strategy":{"earlyGame":"power_grid_first","midGame":"colony_zones","lateGame":"fortified_radiance"},
  "preferredAttackTiming":"late",
  "buildOrder":["nexus","spire","spire","refinery","foundry","spire"] },

{ "id":"solar_spore_prophet","faction":"solar_dominion","displayName":"Spore Prophet Doctrine","uiName":"Spore Prophet",
  "description":"Unberechenbare Wellen, Störung/Mutation, nicht-lineares Build-Verhalten.",
  "personality":{"buildAggression":0.60,"attackAggression":0.65,"defensePriority":0.45,"economyPriority":0.55,"techPriority":0.70,"expansionPriority":0.50,"riskTolerance":0.65,"repairPriority":0.45,"retreatThreshold":0.30,"harassmentPreference":0.65,"staticDefensePreference":0.45,"unitReplacementBias":0.55,"powerDependencyTolerance":0.40},
  "strategy":{"earlyGame":"erratic_probe","midGame":"disruptive_waves","lateGame":"mutation_surge"},
  "preferredAttackTiming":"mid" },

{ "id":"solar_annihilator","faction":"solar_dominion","displayName":"Solar Annihilator Doctrine","uiName":"Solar Annihilator",
  "description":"Langsamer, energiehungriger Aufbau; extrem starke Late-Game-Energieangriffe; anfällig bei Stromausfall.",
  "personality":{"buildAggression":0.35,"attackAggression":0.55,"defensePriority":0.55,"economyPriority":0.70,"techPriority":0.90,"expansionPriority":0.30,"riskTolerance":0.40,"repairPriority":0.60,"retreatThreshold":0.45,"harassmentPreference":0.10,"staticDefensePreference":0.60,"unitReplacementBias":0.40,"powerDependencyTolerance":0.20},
  "strategy":{"earlyGame":"power_and_tech","midGame":"energy_buildup","lateGame":"devastating_energy_strike"},
  "preferredAttackTiming":"late",
  "armyMix":[["energy",0.30],["tank",0.30],["siege",0.15],["rifle",0.12],["antiAir",0.13]] }
```

---

## 7. Balancing-Matrix

Skala 1–5 (Charakter), daneben die konkrete Übersetzung in Multiplikatoren/Knöpfe.

| Fraktion | Build | Angriff | Verteid. | Ressourcen | Energie | Early | Mid | Late | Risiko |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Crimson Pact | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 3 | 2 |
| Azure Concorde | 2 | 2.5 | 5 | 3 | 4 | 2 | 3 | 4 | 2 |
| Verdant Swarm | 5 | 5 | 1.5 | 5 (Verbrauch) | 2 | 5 | 4 | 2.5 | 5 |
| Solar Dominion | 2.5 | 4.5 (spät) | 4 (Zone) | 4 | 5 | 2 | 3 | 5 | 4 |

```ts
// src/data/balancing.ts — Matrix als verwertbare Achsen (0..1 normalisiert, 5→1.0)
export const FACTION_AXES = {
  crimson_pact:   { build:.6, attack:.6, defense:.6, resourceUse:.6, energyDep:.6, early:.6, mid:.6, late:.6, risk:.4 },
  azure_concorde: { build:.4, attack:.5, defense:1.0, resourceUse:.6, energyDep:.8, early:.4, mid:.6, late:.8, risk:.4 },
  verdant_swarm:  { build:1.0,attack:1.0,defense:.3, resourceUse:1.0,energyDep:.4, early:1.0,mid:.8, late:.5, risk:1.0 },
  solar_dominion: { build:.5, attack:.9, defense:.8, resourceUse:.8, energyDep:1.0,early:.4, mid:.6, late:1.0,risk:.8 },
} as const;
```

Diese Achsen treiben (a) den **Power-Score** (Abschnitt 8) und (b) optional Hilfs-Defaults für Doctrine-Knöpfe.

---

## 8. Balancing-Gewichtungen & Power-Score

```ts
// src/data/balancing.ts
export const DEFAULT_WEIGHTS: BalancingWeights = {
  early: 0.18, mid: 0.20, late: 0.18, economy: 0.16, attack: 0.16, defense: 0.12, tech: 0.0, // tech via late eingerechnet
};

export function factionPowerScore(ax = FACTION_AXES['crimson_pact'], w = DEFAULT_WEIGHTS,
  pen = { resource: 0, energy: 0, vulnerability: 0 }): FactionPowerScore {
  const base =
      ax.early   * w.early
    + ax.mid     * w.mid
    + ax.late    * w.late
    + ((ax.resourceUse <= .6 ? .6 : 1.2 - ax.resourceUse) ) * w.economy   // hoher Verbrauch = Eco-Malus
    + ax.attack  * w.attack
    + ax.defense * w.defense;
  // Strafen: Ressourcenhunger, Energieabhängigkeit, Risiko
  const resourcePenalty     = Math.max(0, ax.resourceUse - 0.6) * 0.25;
  const energyPenalty       = Math.max(0, ax.energyDep   - 0.6) * 0.20;
  const vulnerabilityPenalty= Math.max(0, ax.risk        - 0.5) * 0.15;
  const overall = base - resourcePenalty - energyPenalty - vulnerabilityPenalty + pen.resource*0; // pen-Hook
  const verdict = overall < 0.45 ? 'underpowered' : overall > 0.62 ? 'overpowered' : 'balanced';
  return { faction:'', early:ax.early, mid:ax.mid, late:ax.late, economy:ax.resourceUse,
    attack:ax.attack, defense:ax.defense, tech:ax.late, resourcePenalty, energyPenalty, vulnerabilityPenalty, overall, verdict };
}
```

Ziel: alle vier Fraktionen landen mit den obigen Achsen im Band **`balanced` (≈0.45–0.62)**. Das Admin-UI warnt, wenn eine Fraktion/Doctrine herausfällt — Stärken werden also explizit durch Strafen (Ressourcen/Energie/Risiko) bezahlt.

---

## 9. Admin-/Dev-Tuning

**Aktivierung:** nur Dev-Build oder `?admin=1`. Overlay-Panel (DOM, kein 3D), Tastenkürzel `F8`.

```
Admin / Balancing                         [Power-Score-Leiste je Fraktion + ⚠ Warnungen]
├─ Factions      → pro Fraktion Slider: damage/hull/buildSpeed/unitCost/buildingCost/
│                  powerUse/gatherRate/upkeep/turretRange/repairRate/shieldStrength/auraStrength
├─ Doctrines     → pro Doctrine Slider: alle CommanderPersonality-Knöpfe (0..1) + attackTiming
├─ Economy       → gatherRate, cargoToCredits, startingCredits, upkeep
├─ Combat        → globale Damage-/HP-Skalen, turret range/turn
├─ Power Grid    → outage-Effekte je Fraktion, Aura-Radius/Stärke
├─ AI Behavior   → Difficulty-Multiplikatoren (leicht..superschwer)
└─ Export / Import → Reset · Save Profile · Load Profile · Export JSON · Import JSON
```

**Funktionen:** Reset to defaults · Save/Load local profile (localStorage `vireon.tuning.*`) · Export/Import JSON · **Compare faction power score** (Balkenleiste) · **derived early/mid/late estimate** · **Warn if too strong** (rote Markierung wenn `verdict !== 'balanced'`).

**Datenfluss:** `tuning.ts` lädt `DEFAULT_TUNING`, merged `AdminTuningState.active` (aus localStorage), und **jeder** Lese-Zugriff (`unitStats`, `buildingStats`, AI-Entscheidungen, Power-Effekte) geht durch `tuning.get(path)`. Änderungen im Panel sind sofort live, da die Werte pro Frame frisch gelesen werden. Kein Code-Redeploy zum Balancen.

---

## 10. UI: Tactical Profile im Auswahlbildschirm

Pro Fraktionskarte (erweitert die bestehende `showStartScreen`):

```ts
export interface TacticalCardVM {
  name: string; tagline: string; color: string;
  profile: TacticalProfile;        // build/attack/defense/economy/difficulty
  strengths: string[]; weaknesses: string[];
  perks: string[]; recommended: string;
  doctrineOptions: { id: string; uiName: string }[];   // Dropdown „Doctrine"
  selectedDoctrineId: string;
}
```

Layout der Karte:
```
┌────────────────────────────┐
│ CRIMSON PACT      [Medium] │   ← Name + Schwierigkeits-Badge
│ "Iron columns. Forward…"   │
│ Doctrine: [Field Marshal ▾]│   ← wählbar (3 Optionen)
│ Build Stable · Atk Coord.  │
│ Def Fortified · Eco Ctrl.  │
│ + Reliable vehicles        │   ← Stärken (grün)
│ + Strong defense           │
│ − Vehicles cost more       │   ← Schwächen (rot)
│ Playstyle: secure → strike │
└────────────────────────────┘
```

Die Doctrine-Auswahl gilt **für die eigene Fraktion** (beeinflusst evtl. Start-Boni/empfohlenen Stil) und — falls der Gegner dieselbe Fraktion nutzt — als sichtbare Vorschau. Die **gegnerische** Doctrine wird pro Mission gesetzt (oder zufällig aus den 3 gewählt).

---

## 11. AI-Entscheidungsfunktionen (Pseudocode)

`src/ai/decisions.ts` — reine Funktionen, je `(faction, doctrine, gameState)`; testbar ohne Three.js.

```ts
type Phase = 'early' | 'mid' | 'late';
interface GameState { phase: Phase; credits: number; income: number; powerRatio: number; // used/prod
  armySize: number; armyValue: number; harvesters: number; baseThreat: number; // 0..1
  ownLossesRecent: number; enemyArmyEstimate: number; haveTech: Record<string,boolean>; }

export function getBuildPriorities(f: FactionProfile, d: CommanderProfile, g: GameState): string[] {
  if (d.buildOrder && g.phase === 'early') return d.buildOrder;
  const order: string[] = [];
  if (g.harvesters < 2) order.push('refinery');                       // Wirtschaft zuerst
  if (g.powerRatio > 0.85 || f.power.baseDependency > 0.7) order.push('spire'); // Strom sichern
  if (d.personality.staticDefensePreference > 0.6 && g.baseThreat > 0.3) order.push('cannon','wall');
  order.push(d.personality.techPriority > 0.7 ? 'foundry' : 'barracks');
  return order;
}

export function shouldAttack(f: FactionProfile, d: CommanderProfile, g: GameState): boolean {
  const timingOk = g.phase === d.preferredAttackTiming
    || (d.preferredAttackTiming === 'mid' && g.phase !== 'early');
  const massOk = g.armySize >= attackThreshold(d, g);                  // s.u.
  const safeBase = g.baseThreat < (1 - d.personality.defensePriority); // hält genug zurück?
  const brave = d.personality.riskTolerance > 0.7;
  return (timingOk && massOk && safeBase) || (brave && massOk);
}
function attackThreshold(d: CommanderProfile, g: GameState) {
  // aggressivere Doctrines schlagen mit kleinerer Armee zu
  return Math.round(4 + (1 - d.personality.attackAggression) * 14);    // 4..18
}

export function shouldExpand(f, d, g): boolean {
  return g.phase !== 'early' && g.credits > 1200
    && Math.random() < d.personality.expansionPriority * (g.baseThreat < 0.3 ? 1 : 0.3);
}

export function getDefensePriority(f, d, g): number {                  // 0..1 Anteil Armee, der hält
  const base = d.personality.defensePriority;
  const threatBoost = g.baseThreat * 0.4;
  return Math.min(1, base + threatBoost);
}

export function getResourceUrgency(f, d, g): number {
  const hunger = f.economy.unitCostMul < 1 ? 0.2 : 0;                  // billige Fraktion = mehr Durchsatz nötig
  return Math.min(1, (g.income < 5 ? 0.8 : 0.3) + d.personality.economyPriority * 0.3 + hunger);
}

export function getPowerUrgency(f, d, g): number {
  const dep = f.power.baseDependency;                                 // Solar ~0.95
  return Math.min(1, g.powerRatio * dep + (g.powerRatio > 0.9 ? 0.4 : 0));
}

export function getRetreatDecision(f, d, army: { hpRatio: number; outnumbered: number }): boolean {
  if (d.personality.unitReplacementBias > 0.75) return false;         // Verdant: nie zurück, nachbauen
  return army.hpRatio < d.personality.retreatThreshold || army.outnumbered > 1.6;
}

export function getTechPriority(f, d, g): number {
  return Math.min(1, d.personality.techPriority + (g.phase === 'late' ? 0.2 : 0));
}
```

**Integration in `enemy.ts`:** `runConstruction` nutzt `getBuildPriorities` statt `CORE_PLAN`; `runWaves` ruft `shouldAttack`/`attackThreshold` + `getDefensePriority` (Anteil idle-Armee, der NICHT mitgeht); `runProduction` nutzt `doctrine.armyMix ?? ARMY_ROLE_MIX`; `runDefense` nutzt `getRetreatDecision`. Difficulty skaliert `firstWaveAt`/`waveInterval`/`maxArmy`/Income davor.

---

## 12. Roadmap

**MVP (Phase 1) — spürbar besser, kleiner Footprint**
1. `difficulty.ts` (4 Stufen) + Schwierigkeits-Auswahl im Startbildschirm; KI-Income-Hebel.
2. `factions.json` um `tacticalProfile`/`strengths`/`weaknesses`/`perks` erweitern (Werte aus §5) + Tactical-Profile-Karten im Auswahlbildschirm.
3. **Je 1 Default-Doctrine** pro Fraktion aktiv verdrahtet (build/defense/armyMix-Override + `shouldAttack`/`getDefensePriority`) → Fraktionen spielen erkennbar unterschiedlich.
4. Tests für `decisions.ts` (reine Funktionen) + Difficulty-Mapping.

**Phase 2 — volle Tiefe**
5. Alle **12 Doctrines** + Doctrine-Dropdown (eigene + gegnerische); gegnerische Doctrine pro Mission/zufällig.
6. `economy.ts`: `FactionEconomyModifiers` (gatherRate/buildSpeed/cost) + faction-spezifische `PowerOutageEffect` statt pauschalem lowPower.
7. **Admin-/Dev-Panel** (F8) mit Slidern, localStorage, Export/Import, Power-Score-Leiste + Warnungen.

**Phase 3 — fortgeschritten**
8. `ColonyAuraEffect` (Solar) + `UpkeepModel` (Verdant) + `powerGridVulnerability`-Effekte.
9. Power-Score-Auto-Balancing-Hinweise; Tuning-Profile teilen (JSON).
10. Optional: **sichtbare Commander-/Hero-Einheit** je Doctrine (`heroUnitId`) — rein additiv.

---

### Mapping auf bestehenden Code (Kompatibilität)
- `legacyKey` (red/blue/green/yellow) hält `unitStats`/`buildingStats`/`vehicleGlb`/Varianten lauffähig — keine Massenumbenennung nötig.
- Bestehende `aiProfile`-Knöpfe bleiben die **Basis**, auf die Difficulty × Doctrine multiplizieren.
- Das heutige `lowPower` wird zu einem Spezialfall von `PowerOutageEffect` (Crimson-Defaults = aktuelles Verhalten).
