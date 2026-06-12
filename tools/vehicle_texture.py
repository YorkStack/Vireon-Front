"""Vehicle texture pipeline (Stage 2-4 + 6 of the art workflow).

Generates faction-vehicle texture sets via Gemini / Nano Banana, driven by the
design briefs exported from src/data/artMetadata.ts (run `npm run
export:artmeta`, or use the combined `npm run generate:texture`).

Usage (via npm):
  npm run generate:texture -- --faction red --unit medium_tank
  npm run generate:texture -- --faction blue --unit harvester --variants 3
  npm run generate:texture -- --batch-initial            # the approved 6er batch (drafts)
  npm run generate:texture -- --all --dry-run            # print prompts, no API calls
  npm run generate:texture -- --faction red --unit medium_tank --final   # Pro quality

Rules baked in:
  - Claude (the briefs) controls silhouette/readability; Gemini adds alien
    surface imagination. Gameplay stats are NEVER touched by this tool.
  - Drafts use the cheap Flash model and write baseColor_draft.png; finals
    (--final) use Pro and write baseColor.png. Show drafts -> get approval ->
    run finals. Never silently replace approved sets.
  - Fails safely without GEMINI_API_KEY (clear message, exit 1). The key is
    only read from .gemini_key/.env / environment and never printed.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

TOOLS_DIR = Path(__file__).resolve().parent
ROOT = TOOLS_DIR.parent
sys.path.insert(0, str(ROOT))

import generate_asset as ga  # noqa: E402  (existing, proven pipeline)

META_PATH = TOOLS_DIR / "art_metadata.json"
OUT_ROOT = ROOT / "public" / "assets" / "vehicles"

# The approved initial batch (Stage 5 — human approval loop).
INITIAL_BATCH = [
    ("red", "harvester"), ("red", "builder"), ("red", "medium_tank"),
    ("blue", "medium_tank"), ("green", "medium_tank"), ("yellow", "medium_tank"),
]

SNAKE_TO_CLASS = {
    "harvester": "harvester", "builder": "builder", "scout": "scout",
    "light_attack": "lightAttack", "medium_tank": "mediumTank",
    "heavy_tank": "heavyTank", "anti_air": "antiAir", "support": "support",
}


def load_meta() -> dict:
    if not META_PATH.exists():
        sys.exit("tools/art_metadata.json fehlt - erst `npm run export:artmeta` ausfuehren.")
    return json.loads(META_PATH.read_text(encoding="utf-8"))


def build_texture_prompt(meta: dict) -> str:
    """Stage 2: deterministic prompt from the design brief (reproducible)."""
    b = meta["designBrief"]
    return (
        f"Stylized seamless sci-fi vehicle hull texture sheet for a {meta['faction']} faction "
        f"{b['role']} in an alien RTS. Material: {b['materialFamily']}. "
        f"Palette: {b['palette']}. "
        f"Alien design language: {', '.join(b['alienKeywords'])}. "
        f"Include armor panel lines, subtle wear, faction markings as abstract glyphs. "
        f"Forbidden: {', '.join(b['forbiddenElements'])}. "
        f"{b['rtsReadabilityNotes']}"
    )


def gemini_prompt_candidates(meta: dict, client) -> list[str]:
    """Stage 2 (optional): ask Gemini for 2-3 imaginative prompt candidates.
    Falls back to the deterministic prompt on any failure."""
    base = build_texture_prompt(meta)
    try:
        b = meta["designBrief"]
        ask = (
            "Write 2 alternative one-paragraph image-generation prompts for a seamless "
            f"sci-fi vehicle hull TEXTURE (not a vehicle render) of a {meta['faction']} "
            f"{b['role']}. Must keep: {b['palette']}; material {b['materialFamily']}; "
            "flat orthographic texture-sheet style, no perspective, no baked lighting, no text. "
            "Add imaginative alien industrial surface detail. Output ONLY the two prompts, "
            "separated by a line with three dashes."
        )
        resp = client.models.generate_content(model="gemini-2.5-flash", contents=ask)
        text = (getattr(resp, "text", None) or "").strip()
        cands = [c.strip() for c in text.split("---") if len(c.strip()) > 80]
        return [base, *cands[:2]]
    except Exception:
        return [base]


def generate_set(faction: str, unit_snake: str, *, final: bool, variants: int,
                 dry_run: bool, with_emissive: bool, client=None) -> None:
    meta_all = load_meta()
    class_id = SNAKE_TO_CLASS.get(unit_snake, unit_snake)
    meta = meta_all.get(f"{faction}_{class_id}")
    if not meta:
        sys.exit(f"Kein Art-Metadata-Eintrag fuer {faction}/{unit_snake}.")

    out_dir = OUT_ROOT / faction / unit_snake
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates = gemini_prompt_candidates(meta, client) if (client and not dry_run) else [build_texture_prompt(meta)]
    chosen = candidates[-1]  # prefer the Gemini-imagined variant when available

    if dry_run:
        print(f"\n[{faction}/{unit_snake}] PROMPT (dry-run):\n  {chosen}\n")
        return

    model = ga.MODEL_PRO if final else ga.MODEL_FAST
    suffix = "" if final else "_draft"
    for v in range(variants):
        vtag = f"_v{v + 1}" if variants > 1 else ""
        name = f"vehicles/{faction}/{unit_snake}/baseColor{vtag}{suffix}.png"
        ga.create_game_asset(prompt=chosen, filename=name, is_sprite_sheet=False,
                             client=client, model=model, transparent=False, kind="texture")
    if with_emissive:
        em_prompt = (
            f"{chosen} Emissive mask variant: mostly black surface with only the glowing "
            f"accent strips, conduits and markings in {meta['designBrief']['palette'].split(' with ')[-1]}."
        )
        ga.create_game_asset(prompt=em_prompt,
                             filename=f"vehicles/{faction}/{unit_snake}/emissive{suffix}.png",
                             is_sprite_sheet=False, client=client, model=model,
                             transparent=False, kind="texture")

    # Stage 4: reproducibility record next to the textures.
    record = {
        "designBrief": meta["designBrief"],
        "promptCandidates": candidates,
        "finalImagePrompt": chosen,
        "generationDate": date.today().isoformat(),
        "model": model,
        "quality": "final" if final else "draft",
        "approvalStatus": "pending-review",
        "notes": "Gameplay stats are defined in src/data/unitClasses.ts and were not touched.",
    }
    (out_dir / "prompt.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print(f"  -> {out_dir}/prompt.json geschrieben.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Faction vehicle texture generator")
    ap.add_argument("--faction", choices=["red", "blue", "green", "yellow"])
    ap.add_argument("--unit", help="snake_case unit, z.B. medium_tank")
    ap.add_argument("--variants", type=int, default=1)
    ap.add_argument("--final", action="store_true", help="Pro-Qualitaet, ueberschreibt baseColor.png")
    ap.add_argument("--emissive", action="store_true", help="zusaetzlich Emissive-Map erzeugen")
    ap.add_argument("--all", action="store_true", help="alle 32 Varianten")
    ap.add_argument("--batch-initial", action="store_true", help="die freigegebene 6er-Erstcharge")
    ap.add_argument("--dry-run", action="store_true", help="nur Prompts ausgeben, keine API-Calls")
    args = ap.parse_args()

    if args.all:
        jobs = [(f, s) for f in ["red", "blue", "green", "yellow"] for s in SNAKE_TO_CLASS]
    elif args.batch_initial:
        jobs = INITIAL_BATCH
    elif args.faction and args.unit:
        jobs = [(args.faction, args.unit)]
    else:
        ap.error("--faction + --unit angeben (oder --all / --batch-initial)")
        return

    client = None
    if not args.dry_run:
        try:
            client = ga.get_client()
        except Exception as exc:  # key missing/invalid — fail safely, never print the key
            sys.exit(f"GEMINI_API_KEY nicht verfuegbar ({type(exc).__name__}). "
                     "Spiel laeuft weiter mit prozeduralen Fallback-Materialien. "
                     "Key in .gemini_key/.env hinterlegen, dann erneut ausfuehren.")

    for faction, unit in jobs:
        generate_set(faction, unit, final=args.final, variants=args.variants,
                     dry_run=args.dry_run, with_emissive=args.emissive, client=client)

    if not args.dry_run:
        ga.print_cost_summary()


if __name__ == "__main__":
    main()
