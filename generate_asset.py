"""
generate_asset.py
=================
Erzeugt Grafiken und Sprites für das Vireon-Front-Projekt mit Googles
Bildmodell "Nano Banana" (gemini-3-pro-image-preview).

Aufbau:
- load_api_key()        laedt GEMINI_API_KEY aus .gemini_key/.env
- get_client()          baut einen wiederverwendbaren genai-Client
- build_prompt()        haengt je nach Asset-Typ passende Modifikatoren an
- create_game_asset()   Hauptfunktion: Prompt -> Bild -> Datei

Aufrufbeispiele stehen ganz unten im __main__-Block.
"""

from __future__ import annotations

import io
import os
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types
from PIL import Image

# --- feste Pfade -----------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent
ENV_PATH = PROJECT_ROOT / ".gemini_key" / ".env"
# Asset-Wurzel in public/. `filename` darf einen Unterpfad enthalten, z.B.
# "terrain/ground/valley/02.png" oder "buildings/common/hull.png" - die
# Zielordner werden automatisch angelegt. Struktur:
#   terrain/ground/{valley,mid,high}/NN.png   terrain/crystal/...
#   buildings/<gruppe>/...  vehicles/<gruppe>/...  people/<gruppe>/...
#   ui/...   drafts/...
OUTPUT_DIR = PROJECT_ROOT / "public" / "assets"
MODEL_PRO = "gemini-3-pro-image-preview"   # "Nano Banana Pro": Detail + Konsistenz
MODEL_FAST = "gemini-2.5-flash-image"      # "Nano Banana": schnell + guenstig
MODEL = MODEL_PRO                          # Standard fuer finale Assets
MODEL_FREE_FALLBACK = MODEL_FAST           # Alias (Abwaertskompatibilitaet)

# Modellstrategie (siehe create_draft / create_final):
# - Entwuerfe IMMER mit Flash (guenstig, schnell), dann pruefen/anzeigen.
# - Finale Qualitaet: Pro fuer alles, wo Detail/Konsistenz zaehlt und was gross
#   und mehrfach im Spiel zu sehen ist; Flash fuer kleine, vergebende Assets.
PRO_CATEGORIES = {
    "unit",            # Einheiten / Sprite-Sheets (8 Richtungen, Konsistenz!)
    "unit_sheet",
    "building",        # Gebaeude
    "building_texture",
    "hero",            # alles Grosse, mehrfach Sichtbare
}
FAST_CATEGORIES = {
    "icon",            # kleine UI-Icons
    "prop",            # Streu-Props / Deko
    "ground_texture",  # Boden-/Terrain-Texturen
}


def recommend_final_model(category: str) -> str:
    """Waehlt das finale Modell anhand der Asset-Kategorie."""
    return MODEL_PRO if category in PRO_CATEGORIES else MODEL_FAST

# Preise in USD pro 1 Mio. Tokens (Stand Juni 2026, Standard-Tier).
# Quelle: https://ai.google.dev/gemini-api/docs/pricing
PRICES_USD_PER_1M = {
    "gemini-3-pro-image-preview": {"input": 2.00, "output": 120.00},
    "gemini-3-pro-image": {"input": 2.00, "output": 120.00},
    "gemini-2.5-flash-image": {"input": 0.30, "output": 30.00},
}
# Logdatei fuer die laufende Kostensumme.
COST_LOG = PROJECT_ROOT / "asset_cost_log.csv"

# Durchgehende Kunst-Identitaet des Spiels ("Crystalline Noir"). Wird an jeden
# Prompt angehaengt, damit alle Assets zueinander passen.
VIREON_STYLE = (
    "art style: Crystalline Noir - a hostile alien crystal world; "
    "dark gunmetal and deep violet-indigo surfaces, brushed metal panels with "
    "fine trim and panel lines, glowing bioluminescent teal vire-crystal "
    "accents (#1fd4c2), emissive neon faction highlights, moody cool "
    "moonlight key light from top-left, high contrast, crisp readable "
    "silhouette, cohesive stylized sci-fi RTS look, no text, no watermark, "
    "no UI frame around the subject"
)

# Chroma-Key-Hintergrund: Nano Banana liefert JPEG ohne Alpha-Kanal und malt
# "transparent" nur als Schachbrett ins Bild. Deshalb lassen wir bewusst eine
# einfarbige Flaeche rendern und stanzen sie danach per Pillow zu echtem Alpha.
# Magenta liegt weit weg von der Vireon-Palette (Teal/Violett/Gunmetal).
CHROMA_KEY_RGB = (255, 0, 255)
CHROMA_BG_TEXT = (
    "isolated on a solid flat pure magenta background (RGB 255,0,255), "
    "completely uniform background with no checkerboard, no gradient, no shadow "
    "on the background"
)

# Modifikatoren je nach Asset-Typ.
SPRITE_MODIFIERS = (
    "rendered as a 2D sprite sheet, several animation frames laid out on a "
    "regular grid with uniform cell size, "
    f"{CHROMA_BG_TEXT}, "
    "consistent three-quarter top-down RTS camera angle, subject centered in "
    "each cell"
)
ICON_MODIFIERS = (
    f"single centered game icon, {CHROMA_BG_TEXT}, "
    "clean crisp edges, subtle inner glow, readable at small sizes"
)

# Stil-Variante fuer Material-Texturen: keine Silhouette, kein isoliertes
# Objekt, kein Hintergrund - die Oberflaeche fuellt das ganze Bild.
VIREON_MATERIAL_STYLE = (
    "Crystalline Noir sci-fi material: dark gunmetal and deep violet-indigo "
    "metal, brushed surface with fine panel lines, rivets and subtle wear, "
    "muted cool palette, no text, no watermark"
)
TEXTURE_MODIFIERS = (
    "seamless tileable texture, flat top-down orthographic view, the surface "
    "fills the entire frame edge to edge, evenly and flatly lit with no baked "
    "shadows and no strong highlights, no isolated object, no background, "
    "no border, no vignette"
)

# Fahrzeug-Hülle: MITTELHELLES, gut lesbares Militaer-Metall. Bewusst NICHT
# dunkel (sonst versinkt das Detail in der dunklen Spielszene). Nieten, Luken,
# Lufteinlaesse, Kuehlrippen sollen deutlich sichtbar sein.
VEHICLE_MATERIAL_STYLE = (
    "clean mid-tone brushed metal vehicle armor, MEDIUM-LIGHT brightness "
    "(definitely not dark, no black areas), strong readable surface detail: "
    "raised rivets and bolts, bevelled armor panel seams, recessed maintenance "
    "hatches, air intakes and slotted cooling grilles, small stencil markings; "
    "matte finish, even diffuse light, bright crisp faction-color accent trim, "
    "high local contrast so details pop at RTS distance, no heavy shadows, "
    "no dark vignette, no text"
)

# Natur-Gelaende: organischer Fels OHNE Technik (kein Panel, keine Nieten).
NATURE_STYLE = (
    "natural alien planet rock ground, organic weathered cracked stone, "
    "no man-made panels, no rivets, no machinery, no metal, no straight lines, "
    "muted cool palette, no text, no watermark"
)
# Gras-Ebene: weicher Bodenbewuchs OHNE eingebackene grosse Felsen, damit der
# Talboden offen/sauber bleibt (Platz fuers Bauen) und beim Kacheln kein
# Stein-Raster entsteht.
GRASS_STYLE = (
    "natural alien planet grassland, calm uniform soft short grass and low moss "
    "over damp dark soil, smooth and even, only gentle subtle tonal variation, "
    "no large rocks, no boulders, no cracked stone, no glowing veins, no bright "
    "streaks, no busy detail, no man-made elements, no metal, no straight lines, "
    "quiet muted cool blue-green palette, at most a few very faint teal specks, "
    "no text, no watermark"
)
# Cinematic-Szene (z.B. Menue-Hintergrund): kein Stilzwang, kein Chroma-Key.
SCENE_MODIFIERS = (
    "cinematic key art, dramatic lighting, highly detailed, no text, "
    "no user interface, no watermark, no logo"
)

# Fraktionsfarben fuer gezielte Einheiten-/Gebaeude-Prompts.
FACTIONS = {
    "red": "Crimson Pact, glowing crimson-red accent lights (#ff3b30)",
    "blue": "Azure Concord, glowing azure-blue accent lights (#2f7cff)",
    "green": "Verdant Swarm, glowing emerald-green accent lights (#2ecc40)",
    "yellow": "Solar Dominion, glowing solar-yellow accent lights (#ffcc00)",
}


# --- Bausteine -------------------------------------------------------------

def load_api_key() -> str:
    """Laedt GEMINI_API_KEY aus .gemini_key/.env und gibt ihn zurueck."""
    if not ENV_PATH.exists():
        raise FileNotFoundError(
            f".env-Datei nicht gefunden: {ENV_PATH}. "
            "Bitte GEMINI_API_KEY dort hinterlegen."
        )
    load_dotenv(dotenv_path=ENV_PATH)
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError(
            f"GEMINI_API_KEY ist in {ENV_PATH} nicht gesetzt oder leer."
        )
    return api_key


def get_client() -> genai.Client:
    """Erzeugt einen genai-Client mit dem geladenen API-Key."""
    return genai.Client(api_key=load_api_key())


def build_prompt(prompt: str, is_sprite_sheet: bool, kind: str | None = None) -> str:
    """
    Webt Vireon-Stil und die typabhaengigen Modifikatoren in den Prompt.
    kind: "sprite", "icon" oder "texture". Ohne Angabe aus is_sprite_sheet
    abgeleitet (True -> sprite, False -> icon).
    """
    if kind is None:
        kind = "sprite" if is_sprite_sheet else "icon"
    if kind == "texture":
        return f"{prompt.strip()}. {VIREON_MATERIAL_STYLE}. {TEXTURE_MODIFIERS}."
    if kind == "vehicle":
        return f"{prompt.strip()}. {VEHICLE_MATERIAL_STYLE}. {TEXTURE_MODIFIERS}."
    if kind == "terrain":
        return f"{prompt.strip()}. {NATURE_STYLE}. {TEXTURE_MODIFIERS}."
    if kind == "grass":
        return f"{prompt.strip()}. {GRASS_STYLE}. {TEXTURE_MODIFIERS}."
    if kind == "scene":
        return f"{prompt.strip()}. {SCENE_MODIFIERS}."
    modifiers = SPRITE_MODIFIERS if kind == "sprite" else ICON_MODIFIERS
    return f"{prompt.strip()}. {VIREON_STYLE}. {modifiers}."


def _build_config(aspect_ratio: str = "1:1"):
    """
    Baut die Generierungs-Config mit gewuenschtem Seitenverhaeltnis. Faellt
    schrittweise auf einfachere Varianten zurueck, falls die installierte
    SDK-Version einzelne Felder nicht kennt - am Ende ggf. None (= Default).
    """
    try:
        return types.GenerateContentConfig(
            image_config=types.ImageConfig(aspect_ratio=aspect_ratio),
        )
    except (AttributeError, TypeError):
        return None


def _extract_image(response) -> tuple[bytes, str] | None:
    """
    Sucht in der Antwort die erste Bild-Part und gibt (Bytes, mime_type)
    zurueck. Gibt None zurueck, wenn kein Bild geliefert wurde.
    """
    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline is not None and getattr(inline, "data", None):
                mime = getattr(inline, "mime_type", "image/png")
                return inline.data, mime
    return None


def _chroma_key_to_png(data: bytes, key=CHROMA_KEY_RGB, tol: int = 90) -> bytes:
    """
    Stanzt den einfarbigen Hintergrund (Standard: Magenta) zu echtem Alpha aus
    und gibt PNG-Bytes zurueck. Pixel nahe der Key-Farbe werden transparent,
    Kanten zwischen tol und 1.6*tol weich ausgeblendet (Anti-Aliasing).
    """
    img = Image.open(io.BytesIO(data)).convert("RGBA")
    px = img.load()
    kr, kg, kb = key
    soft = tol * 1.6
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            dist = ((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) ** 0.5
            if dist <= tol:
                px[x, y] = (r, g, b, 0)
            elif dist < soft:
                a = int(255 * (dist - tol) / (soft - tol))
                px[x, y] = (r, g, b, a)
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def _collect_text(response) -> str:
    """Sammelt etwaige Text-Antworten (z.B. Ablehnungsgruende) ein."""
    chunks: list[str] = []
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            text = getattr(part, "text", None)
            if text:
                chunks.append(text)
    return "\n".join(chunks)


def _report_cost(response, model: str, filename: str) -> float:
    """
    Liest die echten Token-Zahlen aus usage_metadata, berechnet die Kosten und
    haengt eine Zeile an die Logdatei an. Gibt die Kosten in USD zurueck.
    """
    usage = getattr(response, "usage_metadata", None)
    in_tok = getattr(usage, "prompt_token_count", 0) or 0
    out_tok = getattr(usage, "candidates_token_count", 0) or 0
    price = PRICES_USD_PER_1M.get(model, {"input": 0.0, "output": 0.0})
    cost = in_tok / 1e6 * price["input"] + out_tok / 1e6 * price["output"]
    print(
        f"  Kosten: ${cost:.4f}  "
        f"(Input {in_tok} Tok, Output {out_tok} Tok, Modell {model})"
    )
    new_file = not COST_LOG.exists()
    with COST_LOG.open("a", encoding="utf-8") as fh:
        if new_file:
            fh.write("datei,modell,input_tokens,output_tokens,kosten_usd\n")
        fh.write(f"{filename},{model},{in_tok},{out_tok},{cost:.4f}\n")
    return cost


def print_cost_summary() -> float:
    """Gibt die Gesamtkosten aus der Logdatei aus und liefert die Summe zurueck."""
    if not COST_LOG.exists():
        print("Noch keine Kosten protokolliert.")
        return 0.0
    total = 0.0
    rows = COST_LOG.read_text(encoding="utf-8").strip().splitlines()[1:]
    for row in rows:
        try:
            total += float(row.rsplit(",", 1)[1])
        except (ValueError, IndexError):
            continue
    print(f"Bisher generiert: {len(rows)} Bild(er)  |  Gesamtkosten: ${total:.4f}")
    return total


# --- Hauptfunktion ---------------------------------------------------------

def create_game_asset(
    prompt: str,
    filename: str,
    is_sprite_sheet: bool = True,
    client: genai.Client | None = None,
    model: str = MODEL,
    transparent: bool = True,
    kind: str | None = None,
) -> Path:
    """
    Erzeugt ein Spiel-Asset aus einem Text-Prompt und speichert es unter
    public/assets/sprites/<filename>.

    Args:
        prompt:          Beschreibung des gewuenschten Assets.
        filename:        Zieldateiname, z.B. "drone.png".
        is_sprite_sheet: True -> animiertes Sprite-Sheet, False -> Einzel-Icon.
        client:          Optionaler vorhandener genai-Client (sonst neu gebaut).
        model:           Modellname; Standard ist Nano Banana Pro. Bei fehlendem
                         Kontingent auf MODEL_FREE_FALLBACK ausweichen.
        transparent:     True -> Magenta-Hintergrund per Chroma-Key zu echtem
                         Alpha ausstanzen und als PNG speichern.

    Returns:
        Pfad zur gespeicherten Datei.
    """
    client = client or get_client()
    full_prompt = build_prompt(prompt, is_sprite_sheet, kind)
    # Texturen / Gelaende / Szenen haben keinen Alpha-Kanal - Chroma-Key aus.
    if kind in ("texture", "vehicle", "terrain", "grass", "scene"):
        transparent = False

    print(f"[Nano Banana] Generiere '{filename}' mit Modell '{model}' ...")
    print(f"  Prompt: {full_prompt}")

    config = _build_config("1:1")
    kwargs = {"model": model, "contents": full_prompt}
    if config is not None:
        kwargs["config"] = config
    try:
        response = client.models.generate_content(**kwargs)
    except errors.ClientError as exc:
        if getattr(exc, "code", None) == 429 or "RESOURCE_EXHAUSTED" in str(exc):
            raise RuntimeError(
                f"Kontingent fuer Modell '{model}' erschoepft oder nicht "
                "freigeschaltet (HTTP 429). Nano Banana Pro "
                "(gemini-3-pro-image-preview) ist im kostenlosen Tier meist "
                "nicht verfuegbar. Optionen: (1) Abrechnung im Google-Konto "
                "aktivieren, oder (2) model=MODEL_FREE_FALLBACK "
                "('gemini-2.5-flash-image') verwenden."
            ) from exc
        raise

    _report_cost(response, model, filename)

    image = _extract_image(response)
    if image is None:
        note = _collect_text(response) or "Keine Begruendung geliefert."
        raise RuntimeError(
            f"Das Modell hat kein Bild zurueckgegeben. Antwort: {note}"
        )

    data, mime = image

    # Hintergrund zu echtem Alpha ausstanzen -> immer PNG. Sonst Originalformat.
    if transparent:
        data = _chroma_key_to_png(data)
        mime = "image/png"
        ext = ".png"
    else:
        ext = ".jpg" if "jpeg" in mime else ".png"

    out_path = (OUTPUT_DIR / filename).with_suffix(ext)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(data)
    print(f"  -> gespeichert: {out_path}  ({len(data) // 1024} KB, {mime})")
    return out_path


# --- Zwei-Stufen-Workflow: erst guenstiger Entwurf, dann finale Qualitaet ----

def create_draft(
    prompt: str,
    filename: str,
    is_sprite_sheet: bool = True,
    client: genai.Client | None = None,
    transparent: bool = True,
) -> Path:
    """
    Schneller, guenstiger ENTWURF mit dem Flash-Modell (~4 Cent). Speichert
    unter <name>_draft.<ext>, damit eine spaetere finale Version nicht
    ueberschrieben wird. Gedacht zum Anschauen vor der teuren Pro-Version.
    """
    stem = Path(filename)
    draft_name = str(stem.with_name(f"{stem.stem}_draft{stem.suffix or '.png'}"))
    return create_game_asset(
        prompt, draft_name, is_sprite_sheet, client,
        model=MODEL_FAST, transparent=transparent,
    )


def create_final(
    prompt: str,
    filename: str,
    category: str,
    is_sprite_sheet: bool = True,
    client: genai.Client | None = None,
    transparent: bool = True,
) -> Path:
    """
    FINALE Variante. Modellwahl automatisch nach Kategorie:
    Pro fuer Detail/Konsistenz (unit, building, building_texture, hero),
    Flash fuer kleine Assets (icon, prop, ground_texture).
    """
    model = recommend_final_model(category)
    return create_game_asset(
        prompt, filename, is_sprite_sheet, client,
        model=model, transparent=transparent,
    )


def create_texture(
    prompt: str,
    filename: str,
    final: bool = False,
    client: genai.Client | None = None,
) -> Path:
    """
    Nahtlose Material-Textur (kein Alpha, fuellt das ganze Bild).
    final=False -> guenstiger Flash-Entwurf als <name>_draft.<ext>.
    final=True  -> Pro-Qualitaet unter <name>.
    """
    model = MODEL_PRO if final else MODEL_FAST
    if final:
        name = filename
    else:
        stem = Path(filename)
        name = str(stem.with_name(f"{stem.stem}_draft{stem.suffix or '.jpg'}"))
    return create_game_asset(
        prompt, name, is_sprite_sheet=False, client=client,
        model=model, transparent=False, kind="texture",
    )


# --- Beispiele -------------------------------------------------------------

if __name__ == "__main__":
    # Achtung: Jeder Aufruf loest einen echten API-Call aus (kostet Kontingent).
    # Einfach die gewuenschten Zeilen einkommentieren und das Skript starten:
    #   source venv/bin/activate
    #   python generate_asset.py

    # Einen Client einmal bauen und an alle Aufrufe weiterreichen (effizienter).
    client = get_client()

    # Beispiel 1: "Dart"-Aufklaerer als 8-Richtungs-Sprite-Sheet (Crimson Pact).
    # Entspricht der Scout-Einheit "dartcycle" aus src/data/units.json.
    create_game_asset(
        prompt=(
            "fast hovering alien recon skimmer named 'Dart', sleek wedge-shaped "
            "hull with two side thruster pods and a light repeater gun, "
            f"{FACTIONS['red']}, eight rotation directions (N, NE, E, SE, S, SW, "
            "W, NW) of the same vehicle arranged in a 3x3 grid for an RTS unit"
        ),
        filename="dart_red.png",
        is_sprite_sheet=True,
        client=client,
    )

    # Beispiel 2: "Vanguard"-Kampfpanzer als Sprite-Sheet (Solar Dominion, gelb).
    # Entspricht der mittleren Kampfeinheit "vanguard".
    create_game_asset(
        prompt=(
            "main battle tank named 'Vanguard', heavy tracked hull with a "
            "central rotating turret and long cannon, riveted armor plates, "
            f"{FACTIONS['yellow']}, eight rotation directions of the same tank "
            "laid out on a 3x3 grid for an isometric RTS unit"
        ),
        filename="vanguard_yellow.png",
        is_sprite_sheet=True,
        client=client,
    )

    # Beispiel 3: UI-Icon fuer die Kommandoleiste (Einzel-Asset-Modus).
    create_game_asset(
        prompt=(
            "build-menu icon of a cluster of glowing vire crystals, sharp "
            "faceted teal shards rising from a small rock base, gently lit"
        ),
        filename="icon_crystal.png",
        is_sprite_sheet=False,
        client=client,
    )

    print("Fertig.")
