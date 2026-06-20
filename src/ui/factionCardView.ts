// Pure view-models for the faction-selection cards (DOM-free, unit-testable).
//
// Factions are PLAYSTYLE choices, not difficulty tiers — so the compact card
// deliberately drops the old "Anspruch: <difficulty>" badge and the long
// strengths/weaknesses lists. Those move into the details view (info modal). No
// gameplay, balance, faction-modifier or doctrine data is changed here; this is a
// presentation layer over the existing FactionDef.
import type { FactionDef } from '../core/types';

export interface FactionCardView {
  id: string;
  name: string;
  tagline: string;                 // one short identity line
  doctrineLabel: string | null;    // Tactical Profile / Doctrine
  traits: string[];                // up to 3 compact playstyle tags (no difficulty)
}

export interface FactionDetailsView {
  id: string;
  name: string;
  tagline: string;
  doctrineLabel: string | null;
  profile: { build: string; attack: string; defense: string; economy: string } | null;
  strengths: string[];
  weaknesses: string[];
  recommendation: string | null;   // tactical.shortDescription
}

/**
 * Compact card view-model: name + one identity line + doctrine + up to three
 * playstyle traits (build / attack / defense). Intentionally omits the faction
 * "difficulty/Anspruch" rating and the long strengths/weaknesses lists.
 */
export function factionCardView(f: FactionDef): FactionCardView {
  const t = f.tactical;
  const traits = t ? [t.build, t.attack, t.defense].filter((s): s is string => !!s) : [];
  return {
    id: f.id,
    name: f.name,
    tagline: f.tagline,
    doctrineLabel: t?.doctrineLabel ?? null,
    traits,
  };
}

/** Full details view-model for the info modal — the long content lives here. */
export function factionDetailsView(f: FactionDef): FactionDetailsView {
  const t = f.tactical;
  return {
    id: f.id,
    name: f.name,
    tagline: f.tagline,
    doctrineLabel: t?.doctrineLabel ?? null,
    profile: t ? { build: t.build, attack: t.attack, defense: t.defense, economy: t.economy } : null,
    strengths: f.strengths ?? [],
    weaknesses: f.weaknesses ?? [],
    recommendation: t?.shortDescription ?? null,
  };
}
