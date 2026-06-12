// Art metadata — design briefs, generation prompts and approval status for
// every faction vehicle. This drives:
//   - the texture pipeline (tools/vehicle_texture.py reads the exported JSON)
//   - texture wiring (models.ts only loads generated sets when status allows)
//   - the Unit Codex "Design Brief" tab
//
// Claude (this codebase) owns gameplay structure & readability requirements;
// Gemini/Nano Banana contributes alien surface imagination on top. Gemini
// never defines gameplay stats.

export type AssetStatus = 'placeholder' | 'generated' | 'approved' | 'needsRevision';

export interface DesignBrief {
  role: string;
  silhouette: string;
  movementType: string;
  weaponType: string;
  requiredComponents: string[];
  forbiddenElements: string[];
  palette: string;
  materialFamily: string;
  alienKeywords: string[];
  rtsReadabilityNotes: string;
}

export interface ArtMetadata {
  id: string;                 // '<faction>_<classId>'
  faction: string;
  vehicleClass: string;
  status: AssetStatus;
  textureSetId: string;       // folder under public/assets/vehicles/
  designBrief: DesignBrief;
  /** Filled by the pipeline after generation (also mirrored in prompt.json). */
  chosenPrompt?: string;
  notes?: string;
}

// ---- faction design languages (Gemini elaborates on these creatively) ----
export const FACTION_ART_LANGUAGE: Record<string, { style: string; palette: string; material: string; keywords: string[] }> = {
  red: {
    style: 'heavy tracked war machines, aggressive angular armor plates, brutalist industrial design, exposed vents, reinforced housings',
    palette: 'gunmetal with crimson/orange emissive accent strips',
    material: 'rolled battle steel, scorched plating, riveted armor',
    keywords: ['brutalist', 'asymmetric reinforcement', 'battle wear', 'non-human panel language'],
  },
  blue: {
    style: 'wheeled precision vehicles, defensive technical disciplined design, sensor arrays, shield emitters, clean armor plating',
    palette: 'cool steel blue with blue/white emissive accents',
    material: 'precision-machined composite, clean panel seams',
    keywords: ['modular', 'sensor-studded', 'ordered geometry', 'shield emitter nodes'],
  },
  green: {
    style: 'hover/grav vehicles, fast efficient semi-organic bio-industrial design, curved forms, glowing conduits',
    palette: 'deep moss-metal with green/teal emissive conduits',
    material: 'alien composite shell, grown-metal surfaces',
    keywords: ['semi-organic', 'flowing conduits', 'chitinous panels', 'grav skirt glow'],
  },
  yellow: {
    style: 'exotic mono-wheel energy platforms, unusual alien mechanics, asymmetry allowed, high-tech energy weapon surfaces',
    palette: 'dark ceramic with yellow/gold emissive accents',
    material: 'iridescent ceramic-alloy, energy lattice inlays',
    keywords: ['gyroscopic', 'energy lattice', 'floating segments', 'solar-forged'],
  },
};

const CLASS_BRIEF: Record<string, Pick<DesignBrief, 'role' | 'silhouette' | 'weaponType' | 'requiredComponents' | 'forbiddenElements'>> = {
  harvester: {
    role: 'resource collector / hauler',
    silhouette: 'bulky cargo body, visible hopper and frontal intake — must read as a hauler',
    weaponType: 'none',
    requiredComponents: ['cargo hopper', 'frontal intake/scoop', 'small crew cab'],
    forbiddenElements: ['cannons', 'missile pods', 'anything that reads as a combat unit'],
  },
  builder: {
    role: 'construction & repair vehicle',
    silhouette: 'work vehicle with crane/manipulator arm and utility body',
    weaponType: 'none',
    requiredComponents: ['crane or manipulator arm', 'tool/utility racks', 'warning markings'],
    forbiddenElements: ['weapons', 'aggressive armor spikes'],
  },
  scout: {
    role: 'fast recon skimmer',
    silhouette: 'small, slim, nose-forward dart shape — must read as fast and light',
    weaponType: 'light repeater',
    requiredComponents: ['slim nose', 'canopy', 'light barrel'],
    forbiddenElements: ['heavy armor plates', 'large turret'],
  },
  lightAttack: {
    role: 'light attack vehicle / flanker',
    silhouette: 'compact agile chassis with one small visible turret',
    weaponType: 'rapid autocannon',
    requiredComponents: ['small top turret', 'thin autocannon barrel'],
    forbiddenElements: ['bulky cargo body', 'long siege barrel'],
  },
  mediumTank: {
    role: 'armored frontline combat vehicle',
    silhouette: 'broad low chassis, obvious rotating turret, single main cannon',
    weaponType: 'direct-fire ballistic cannon',
    requiredComponents: ['main turret', 'long cannon barrel', 'armored glacis'],
    forbiddenElements: ['crane arms', 'cargo hoppers', 'multiple long barrels'],
  },
  heavyTank: {
    role: 'siege platform / heavy assault',
    silhouette: 'massive hull, oversized angled howitzer — must read as heavy and dangerous',
    weaponType: 'long-range explosive howitzer',
    requiredComponents: ['oversized angled barrel', 'reinforced side armor', 'rear stabilizer'],
    forbiddenElements: ['slim sporty shapes'],
  },
  antiAir: {
    role: 'anti-air platform',
    silhouette: 'angled missile pods / flak array plus a visible radar element',
    weaponType: 'flak battery / AA missiles',
    requiredComponents: ['upward-angled missile pods or flak barrels', 'rotating radar'],
    forbiddenElements: ['single forward cannon (reads as tank)'],
  },
  support: {
    role: 'mobile repair / logistics support',
    silhouette: 'workshop body with repair dish and manipulator arms — must read as support',
    weaponType: 'none',
    requiredComponents: ['repair dish/emitter', 'tool arms', 'workshop body'],
    forbiddenElements: ['weapons', 'siege barrels'],
  },
};

const SNAKE: Record<string, string> = {
  harvester: 'harvester', builder: 'builder', scout: 'scout', lightAttack: 'light_attack',
  mediumTank: 'medium_tank', heavyTank: 'heavy_tank', antiAir: 'anti_air', support: 'support',
};

const MOVEMENT: Record<string, string> = {
  red: 'heavy tracked', blue: 'wheeled (multi-axle)', green: 'hover/grav', yellow: 'mono-wheel gyro platform',
};

function makeMeta(faction: string, classId: string): ArtMetadata {
  const lang = FACTION_ART_LANGUAGE[faction];
  const cls = CLASS_BRIEF[classId];
  return {
    id: `${faction}_${classId}`,
    faction,
    vehicleClass: classId,
    status: 'placeholder',
    textureSetId: `${faction}/${SNAKE[classId]}`,
    designBrief: {
      role: cls.role,
      silhouette: cls.silhouette,
      movementType: MOVEMENT[faction],
      weaponType: cls.weaponType,
      requiredComponents: cls.requiredComponents,
      forbiddenElements: cls.forbiddenElements,
      palette: lang.palette,
      materialFamily: lang.material,
      alienKeywords: lang.keywords,
      rtsReadabilityNotes:
        'Must stay readable from an isometric RTS camera at distance; no noisy micro-detail that shimmers; faction accent visible but not overwhelming; no text.',
    },
  };
}

export const ART_METADATA: Record<string, ArtMetadata> = {};
for (const faction of ['red', 'blue', 'green', 'yellow']) {
  for (const classId of Object.keys(CLASS_BRIEF)) {
    const m = makeMeta(faction, classId);
    ART_METADATA[m.id] = m;
  }
}

// ---- asset status ledger ----
// All 32 sets exist on disk (rich military-detail style: rivets, hatches,
// intakes, camo, spares; 6 hero sets in Pro quality, rest Flash; prompt.json
// beside each texture). 'generated' = renderer loads them; flip individual
// ids to 'approved' after review or 'needsRevision' to fall back to the
// procedural materials.
for (const m of Object.values(ART_METADATA)) m.status = 'generated';
const STATUS: Partial<Record<string, AssetStatus>> = {
  // per-id overrides, z.B.: red_scout: 'needsRevision',
};
for (const [id, s] of Object.entries(STATUS)) if (ART_METADATA[id] && s) ART_METADATA[id].status = s;

/** True when the generated texture set may be loaded by the renderer. */
export function textureSetUsable(artMetadataId: string | undefined): boolean {
  if (!artMetadataId) return false;
  const s = ART_METADATA[artMetadataId]?.status;
  return s === 'generated' || s === 'approved';
}
