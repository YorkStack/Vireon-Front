"""Generiert: 4 Felstexturen (terrain), 5 Vegetations-Billboards (Bäume/Büsche,
mit Alpha), 4 Fahrzeug-Hüllentexturen je Rolle. Flash, mit Retry."""

import time
import generate_asset as g

client = g.get_client()

# (filename, kind, transparent, prompt)
JOBS = [
    # ---- Felsen: nahtlose Gesteinstexturen (auf Boulder-Meshes gemappt) ----
    ("terrain/rock/01.png", "terrain", False,
     "Seamless tileable dark cracked volcanic boulder rock surface, sharp angular facets"),
    ("terrain/rock/02.png", "terrain", False,
     "Seamless tileable weathered grey stone boulder surface with faint moss patches"),
    ("terrain/rock/03.png", "terrain", False,
     "Seamless tileable dark basalt rock surface with subtle mineral veins"),
    ("terrain/rock/04.png", "terrain", False,
     "Seamless tileable rough craggy alien rock surface with teal lichen specks"),
    # ---- Vegetation: Billboards (Seitenansicht, freigestellt = Alpha) ----
    ("vegetation/tree_01.png", "icon", True,
     "a single alien tree, tall slender dark trunk with a rounded glowing teal "
     "bioluminescent canopy, side elevation view, full plant from base to top"),
    ("vegetation/tree_02.png", "icon", True,
     "a single twisted alien tree with drooping luminous blue-green fronds, "
     "dark bark, side elevation view, full plant"),
    ("vegetation/tree_03.png", "icon", True,
     "a single tall alien conifer-like tree, dark needled silhouette with faint "
     "teal-lit tips, side elevation view, full plant"),
    ("vegetation/bush_01.png", "icon", True,
     "a single low alien shrub, dense teal-green leafy clump, side elevation view"),
    ("vegetation/bush_02.png", "icon", True,
     "a single alien fern bush with spread fronds and a subtle teal glow, side "
     "elevation view"),
    # ---- Fahrzeug-Hüllen je Rolle (Metall, nahtlos; auf Modelle gemappt) ----
    ("vehicles/harvester/hull.png", "texture", False,
     "industrial mining harvester hull plating, heavy worn metal with ore dust "
     "and reinforced panels, amber hazard stripes"),
    ("vehicles/fabricator/hull.png", "texture", False,
     "construction fabricator vehicle hull plating, sturdy work metal with "
     "rivets, scaffolding panels and utility markings"),
    ("vehicles/attack/hull.png", "texture", False,
     "armored battle vehicle hull plating, angular composite armor plates, "
     "scratched gunmetal, aggressive bevels"),
    ("vehicles/defense/hull.png", "texture", False,
     "fortified defense vehicle hull plating, thick bolted bunker armor, "
     "heavy dark steel plates"),
]

for filename, kind, transparent, prompt in JOBS:
    for attempt in range(6):
        try:
            g.create_game_asset(
                prompt=prompt, filename=filename, is_sprite_sheet=False,
                client=client, model=g.MODEL_FAST, transparent=transparent, kind=kind,
            )
            break
        except Exception as e:
            print(f"  {filename} Versuch {attempt + 1}: {str(e)[:110]}")
            time.sleep(10)

g.print_cost_summary()
print("Props/Fahrzeuge fertig.")
