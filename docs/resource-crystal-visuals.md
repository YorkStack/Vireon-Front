# Resource Crystal Visuals — Cluster Fix

> **Visual-only.** Restauriert Kristall-Resource-Felder als Multi-Kristall-Cluster
> (klein/mittel/groß) statt einer einzelnen Billboard-Sprite. **Keine** Economy-/
> Harvest-/Spawn-/Balance-Änderung. Base HEAD `5bd424f`. Nicht committet.

## 1. Regression / Ursache
Ein World-Phase-1c-Schritt ersetzte den früheren Multi-Sprite-Cluster pro Node durch
**eine** Billboard-Sprite ([terrain.ts](../src/render/terrain.ts)), deren Textur die
Depletion-Stage (full/reduced/small) zeigt. Dadurch sah ein Resource-Feld aus wie
**ein großer Kristall** statt eines Clusters.

## 2. Fix — Cluster pro Node
Jeder Node rendert jetzt einen **Cluster** aus Sprites statt einer:
- **1 großer** zentraler Kristall + **2–3 mittlere** + **3–5 kleine** Shards → **6–9 Teile**.
- Asymmetrische Platzierung um das Zentrum, leichte **Scale-** und **Rotations**-Varianz.
- Größenklassen über die vorhandenen default-Sprites
  (`medium.png`=large, `medium-small.png`=medium, `small.png`=small) — **keine neuen Assets**.
- Footprint ~ wie die alte Single-Sprite (Cluster-Radius ≈ 1.9 Welt-Einheiten), damit
  Einheiten nicht stärker verdeckt werden.

### Determinismus
Das Layout kommt aus `crystalClusterLayout(seed)`
([crystalCluster.ts](../src/render/crystalCluster.ts)) — ein reiner, DOM-freier
Helfer mit deterministischem PRNG (mulberry32), **geseedet mit der Node-ID**. Gleiche
Map → identisches Cluster über Reloads (kein Flackern).

## 3. Depletion (unverändert in der Logik)
`world.ts updateCrystalVisual` ist **nicht** geändert: es skaliert die Gruppe pro
Stage (full 1.0 → reduced 0.82 → small 0.62) und blendet bei `depleted` aus. Da der
Cluster **kein** einzelnes Stage-Material trägt, wird der frühere Textur-Swap dort
einfach übersprungen (durch `ud.mat && ud.tex` geguarded) — das ganze Feld
**schrumpft** sichtbar beim Abbau. `amount`/`max`/Harvest-Daten bleiben unangetastet.

## 4. Gameplay unverändert
Resource-Menge, Depletion-Logik, Harvest-Radius, Pathfinding, Collision/Map-Flags,
Selektion, Minimap, Score-Counter und Mission-/Resource-Placement sind **nicht**
berührt. Der Fix lebt ausschließlich in der Render-Schicht (terrain.ts) + reiner
Layout-/Asset-Pfad-Logik (crystalCluster.ts, crystalAssets.ts).

## 5. Performance
- Sprites sind günstige Billboards; **Texturen werden geteilt** (Cache `crystalStageTex`)
  → nur wenige Crystal-Texturen geladen, nicht eine pro Stück.
- Browser-Smoke: 35 Nodes × ~7.5 Sprites = **261 Sprites**, gesamt **99 Draw-Calls**,
  **45 Texturen**, **keine** Per-Crystal-Lichter, Konsole sauber.
- Glow-Pool (1 additive Plane/Node) bleibt wie zuvor.

## 6. Geänderte Dateien
- [src/render/crystalCluster.ts](../src/render/crystalCluster.ts) (NEU) + Test.
- [src/data/crystalAssets.ts](../src/data/crystalAssets.ts): `crystalClusterImagePath` + `CLUSTER_ASSET_KEY` (reines Pfad-Mapping, keine Balance).
- [src/render/terrain.ts](../src/render/terrain.ts): Single-Sprite → Cluster-Build.

## 7. Bekannte Limitierungen
- Sprites bleiben 2D-Billboards (wie das bestehende Design) — kein echtes 3D-Crystal-Mesh.
- Depletion zeigt jetzt **Schrumpfen** statt Textur-Stage-Detailwechsel (das Schrumpfen
  ist der primäre Cue; die 3 Detail-Stage-PNGs werden für den Cluster nicht mehr genutzt).
- `default`-Familie hat kein echtes `large`-PNG → der „große" Kristall ist das größte
  vorhandene `medium`-Asset (hochskaliert).
- Blaze/Plasma-Familien sind vorbereitet (echte small/medium/large), aber im Spiel
  heute nicht gespawnt.

## 8. Nächster Schritt (optional)
Echte per-Größe-`large`-PNGs für die `default`-Familie generieren (Alpha-Check
beachten — KI-Pipeline backt Transparenz opak), oder Depletion zusätzlich durch
Ausblenden einzelner Rand-Shards je Stage verfeinern.
