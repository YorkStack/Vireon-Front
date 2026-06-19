// Faction-aware procedural infantry visual resolver (DOM-free, unit-testable).
//
// Decides WHICH procedural visual variant an infantry unit uses for a given
// faction. The geometry itself lives in models.ts; this module is pure string/
// data logic so it can be tested without three.js / `document`. This is a
// VISUAL-ONLY layer: gameplay stats, unit ids, balance, scoring and production
// are all untouched — only the rendered silhouette/identity changes.

/**
 * Infantry def ids that currently have faction-specific procedural variants.
 * Today only the basic rifle trooper (`lancer`) is covered; other infantry
 * (breacher, arcweaver, …) fall back to the shared per-defId template.
 */
export const FACTION_INFANTRY_VARIANT_DEFS = new Set<string>(['lancer']);

/** Factions that ship a procedural variant for the covered infantry defs. */
export const FACTIONS_WITH_INFANTRY_VARIANT = new Set<string>(['red', 'blue', 'green', 'yellow']);

/**
 * Resolve the faction-specific infantry visual key (e.g. `lancer@blue`), or
 * `null` to fall back to the shared per-defId template. Returns null when the
 * factionId is missing, the faction has no variant, or the unit is not a covered
 * infantry def — so callers can always `?? fallback`.
 */
export function infantryVisualFor(defId: string, factionId?: string): string | null {
  if (!factionId) return null;
  if (!FACTION_INFANTRY_VARIANT_DEFS.has(defId)) return null;
  if (!FACTIONS_WITH_INFANTRY_VARIANT.has(factionId)) return null;
  return `${defId}@${factionId}`;
}
