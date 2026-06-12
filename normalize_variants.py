"""Gleicht pro Hoehenlage die Varianten 02/03 tonal an Variante 01 an
(Mean + Std je Farbkanal), damit die Zufallsmischung im Spiel KEIN
Schachbrett erzeugt. Nur das Feindetail (Risse/Struktur) variiert dann noch.
Deterministisch, ohne API-Kosten. Ueberschreibt 02/03 in-place."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent / "public" / "assets" / "terrain" / "ground"
LEVELS = ["valley", "mid", "high"]
STD_STRENGTH = 0.85  # 1.0 = Kontrast voll angleichen, 0 = nur Helligkeit


def channel_stats(img: Image.Image):
    """Mittelwert und Standardabweichung je Kanal (R,G,B)."""
    stats = []
    for band in img.split()[:3]:
        px = list(band.getdata())
        n = len(px)
        mean = sum(px) / n
        var = sum((p - mean) ** 2 for p in px) / n
        stats.append((mean, var ** 0.5))
    return stats


def match_to(ref_stats, img: Image.Image) -> Image.Image:
    src = channel_stats(img)
    bands = list(img.split())
    out_bands = []
    for c in range(3):
        rmean, rstd = ref_stats[c]
        smean, sstd = src[c]
        scale = (rstd / sstd) if sstd > 1e-3 else 1.0
        scale = 1.0 + (scale - 1.0) * STD_STRENGTH
        # out = (in - smean) * scale + rmean
        lut = [max(0, min(255, round((i - smean) * scale + rmean))) for i in range(256)]
        out_bands.append(bands[c].point(lut))
    if len(bands) > 3:  # Alpha unveraendert
        out_bands.append(bands[3])
    return Image.merge(img.mode, out_bands)


for lvl in LEVELS:
    ref_path = ROOT / lvl / "01.png"
    ref_stats = channel_stats(Image.open(ref_path).convert("RGB"))
    rm = [f"{m:.0f}" for m, _ in ref_stats]
    print(f"{lvl}: Referenz 01 Mittel RGB={rm}")
    for variant in ("02.png", "03.png"):
        p = ROOT / lvl / variant
        img = Image.open(p).convert("RGBA" if p.suffix == ".png" else "RGB")
        before = [f"{m:.0f}" for m, _ in channel_stats(img)]
        out = match_to(ref_stats, img)
        after = [f"{m:.0f}" for m, _ in channel_stats(out)]
        out.save(p)
        print(f"  {lvl}/{variant}: {before} -> {after} (an 01 angeglichen)")

print("Fertig.")
