"""Generiert RUHIGE Boden-Varianten (Flash). Valley = 4 ruhige Gras-Varianten
zur Auswahl, mid/high je 3 ruhige, kohaerente Varianten. Werden im Spiel per
Blend-Shader weich ueberblendet (keine Tonangleichung noetig). Mit Retry."""

import time
import generate_asset as g

client = g.get_client()

JOBS = [
    # ---- valley: ruhiges Gras, ein paar dezente Varianten ----
    ("terrain/ground/valley/01.png", "grass",
     "Seamless tileable top-down calm uniform alien grass meadow, soft even "
     "blue-green turf, smooth, very subtle short tufts"),
    ("terrain/ground/valley/02.png", "grass",
     "Seamless tileable top-down calm alien grassland, soft moss and short grass "
     "with a few faint darker soil patches, muted and even"),
    ("terrain/ground/valley/03.png", "grass",
     "Seamless tileable top-down calm alien meadow, slightly longer soft grass "
     "with gentle quiet tonal variation, uniform"),
    ("terrain/ground/valley/04.png", "grass",
     "Seamless tileable top-down calm short alien grass with sparse tiny low "
     "ground-cover, even, muted, restful"),
    # ---- mid: ruhiger Misch (Gras -> Stein) ----
    ("terrain/ground/mid/01.png", "terrain",
     "Seamless tileable top-down calm mixed ground, mostly short dry grass over "
     "packed soil with a few flat embedded stones, muted, even, low contrast"),
    ("terrain/ground/mid/02.png", "terrain",
     "Seamless tileable top-down calm transitional ground, patchy grass fading "
     "into smooth weathered stone, quiet, low contrast"),
    ("terrain/ground/mid/03.png", "terrain",
     "Seamless tileable top-down calm rocky soil, short sparse grass over hard "
     "packed earth and gravel, muted, even"),
    # ---- high: ruhiges dunkles Gestein ----
    ("terrain/ground/high/01.png", "terrain",
     "Seamless tileable top-down calm dark stone plateau, smooth weathered "
     "bedrock with subtle shallow cracks, even, low contrast"),
    ("terrain/ground/high/02.png", "terrain",
     "Seamless tileable top-down calm grey rock surface, fine even stone with "
     "gentle fissures, muted, restful"),
    ("terrain/ground/high/03.png", "terrain",
     "Seamless tileable top-down calm dark basalt ground, smooth slabs with "
     "faint mineral veining, quiet, low contrast"),
]

for filename, kind, prompt in JOBS:
    for attempt in range(6):
        try:
            g.create_game_asset(
                prompt=prompt, filename=filename, is_sprite_sheet=False,
                client=client, model=g.MODEL_FAST, transparent=False, kind=kind,
            )
            break
        except Exception as e:
            print(f"  {filename} Versuch {attempt + 1}: {str(e)[:110]}")
            time.sleep(10)

g.print_cost_summary()
print("Ruhige Varianten fertig.")
