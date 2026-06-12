"""Stanzt den (rosa/magenta, aber nicht reinen) Hintergrund der Vegetations-
Sprites zu echtem Alpha aus. Bestimmt die BG-Farbe aus den Bildecken (robust
gegen ungenaues Magenta vom Modell) und keyt sie mit weicher Kante aus."""

import io
from pathlib import Path

from PIL import Image

VEG = Path(__file__).resolve().parent / "public" / "assets" / "vegetation"
FILES = ["tree_01.png", "tree_02.png", "tree_03.png", "bush_01.png", "bush_02.png"]
TOL = 95          # harte Grenze (RGB-Distanz) zur BG-Farbe
SOFT = 152        # weiche Kante bis hierhin


def corner_bg(img: Image.Image) -> tuple[int, int, int]:
    """BG-Farbe aus den KANTENMITTEN (robust gegen bereits transparente Ecken
    aus einem frueheren Chroma-Key). Ignoriert fast-schwarze/leere Pixel."""
    w, h = img.size
    px = img.load()
    centers = [(w // 2, 4), (w // 2, h - 5), (4, h // 2), (w - 5, h // 2)]
    samples = []
    for cx, cy in centers:
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                r, g, b = px[cx + dx, cy + dy][:3]
                if r + g + b > 30:  # leere/transparente Ecken aussparen
                    samples.append((r, g, b))
    if not samples:
        return (255, 0, 255)
    n = len(samples)
    return tuple(sorted(s[c] for s in samples)[n // 2] for c in range(3))


for name in FILES:
    p = VEG / name
    img = Image.open(p).convert("RGBA")
    kr, kg, kb = corner_bg(img)
    px = img.load()
    w, h = img.size
    cleared = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            dist = ((r - kr) ** 2 + (g - kg) ** 2 + (b - kb) ** 2) ** 0.5
            if dist <= TOL:
                px[x, y] = (r, g, b, 0); cleared += 1
            elif dist < SOFT:
                px[x, y] = (r, g, b, int(255 * (dist - TOL) / (SOFT - TOL)))
    out = io.BytesIO()
    img.save(p, format="PNG")
    print(f"{name}: BG≈{(kr, kg, kb)}  -> {cleared} px transparent")

print("Alpha-Fix fertig.")
