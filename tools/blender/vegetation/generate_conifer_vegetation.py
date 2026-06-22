"""
Vireon Front — Conifer / Needle-Tree Draft Set (v3.1) — refined 4-variant set
============================================================================
Authors low-poly conifer (pine) GLB drafts for future forest/highland biome use.
DRAFT ONLY — not registered in VEG_V31_ASSETS and not scattered until approved.

Refinement pass: more natural/irregular tiers (ragged needle skirts, non-identical
heights/radii, slight yaw + horizontal jitter), subtle per-variant green variation,
four size classes.

Run headlessly:
  /Applications/Blender.app/Contents/MacOS/blender --background \
    --python tools/blender/vegetation/generate_conifer_vegetation.py

Output GLBs : public/assets/vegetation/glb_v31/forest/
Draft PNGs  : tools/blender/vegetation/drafts/

Assets (4 size variants):
  1. forest_conifer_small_v31.glb   — small/slim young pine  (3 tiers, lighter green)
  2. forest_conifer_medium_v31.glb  — balanced medium pine   (4 tiers, forest green)
  3. forest_conifer_tall_v31.glb    — tall narrow pine       (5 tiers, cooler/darker green)
  4. forest_conifer_broad_v31.glb   — broad/dense short pine  (5 wide tiers, deep green)

Conventions match tools/blender/vegetation/generate_desert_vegetation.py:
bmesh primitives -> per-part material -> join -> origin bottom-center -> GLB.

Materials (chosen for the game's name-based classifier vegZoneOf):
  bark_pine    -> matches /bark/ -> 'woody'   (brown trunk, no regex change needed)
  needle_pine  -> would need 'needle' added to the foliage regex at registration.
  NOTE: at registration the runtime 'foliage' tint currently REPLACES the foliage
  colour, so the per-variant green authored here would be unified in-game unless the
  conifers are given a per-asset tint exception (flag for the approval discussion).
"""

import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

# ── Output directories ────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))
OUT_DIR      = os.path.join(PROJECT_ROOT, "public", "assets", "vegetation", "glb_v31", "forest")
DRAFT_DIR    = os.path.join(SCRIPT_DIR, "drafts")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DRAFT_DIR, exist_ok=True)
print(f"[INIT] GLB out: {OUT_DIR}")
print(f"[INIT] drafts : {DRAFT_DIR}")


# ── deterministic hash (no Math.random) ───────────────────────────────────────
def _h(a, b):
    x = math.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return x - math.floor(x)


# ── sRGB → linear helper ──────────────────────────────────────────────────────
def _lin(r, g, b, a=1.0):
    def c(x):
        x /= 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)


COL_BARK_PINE = _lin( 95,  66,  42)   # #5F422A mid brown (kept visible at base)
# Subtle, coherent pine-green palette (light → deep) per size class.
NEEDLE_SMALL  = _lin( 88, 133,  74)   # #58854A slightly lighter young green
NEEDLE_MEDIUM = _lin( 62, 107,  58)   # #3E6B3A standard forest green
NEEDLE_TALL   = _lin( 51,  94,  60)   # #335E3C slightly cooler/darker green
NEEDLE_BROAD  = _lin( 45,  84,  47)   # #2D542F deep dense green


# ── Material factory (Principled BSDF, no emission) ───────────────────────────
def _make_material(name, base_color, roughness=0.85):
    # Re-create each time (scene is cleared per asset) so per-variant colours apply.
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out  = nodes.new("ShaderNodeOutputMaterial");  out.location  = (300, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled");   bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value  = roughness
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    mat.diffuse_color = base_color   # Workbench viewport/draft colour
    return mat


# ── Scene helpers ─────────────────────────────────────────────────────────────
def _clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def _set_active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def _apply_transform(obj):
    _set_active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def _assign_mat(obj, mat_name):
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        print(f"[WARN] Material not found: {mat_name}")
        return
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat


def _shade_flat(obj):
    _set_active(obj)
    bpy.ops.object.shade_flat()


def _join_objects(objects):
    assert len(objects) >= 1
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    return bpy.context.active_object


def _set_origin_bottom_center(obj):
    _apply_transform(obj)
    coords = [obj.matrix_world @ v.co for v in obj.data.vertices]
    min_z = min(c.z for c in coords) if coords else 0.0
    obj.location.z -= min_z
    _apply_transform(obj)
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    _set_active(obj)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.location = (0.0, 0.0, 0.0)
    _apply_transform(obj)


# ── Geometry primitives ───────────────────────────────────────────────────────
def _tapered_cylinder(name, radius_bottom, radius_top, height, verts=7, location=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    n = verts
    ox, oy, oz = location
    b_verts, t_verts = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        b_verts.append(bm.verts.new((ox + radius_bottom * math.cos(a), oy + radius_bottom * math.sin(a), oz)))
    for i in range(n):
        a = 2 * math.pi * i / n
        t_verts.append(bm.verts.new((ox + radius_top * math.cos(a), oy + radius_top * math.sin(a), oz + height)))
    bm.verts.ensure_lookup_table()
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new([b_verts[i], b_verts[ni], t_verts[ni], t_verts[i]])
    bm.faces.new(list(reversed(b_verts)))
    bm.faces.new(t_verts)
    bm.to_mesh(mesh); bm.free(); mesh.update()
    return obj


def _needle_tier(name, r, depth, verts, seed, droop=0.06):
    """One low-poly needle tier: an apex over a RAGGED base ring (per-vertex radius
    + slight downward droop) → irregular lower edges, no clean geometric cone."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    base = []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        rr = r * (0.82 + _h(seed * 5 + i, seed * 9 + i) * 0.36)        # ±radius per needle
        dz = -droop * _h(seed * 3 + i, seed * 7 + i)                   # ragged droop down
        base.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), dz)))
    apex = bm.verts.new((0.0, 0.0, depth))
    bm.verts.ensure_lookup_table()
    for i in range(verts):
        ni = (i + 1) % verts
        bm.faces.new([base[i], base[ni], apex])
    bm.faces.new(list(reversed(base)))                                 # closed base (hidden under next tier)
    bm.to_mesh(mesh); bm.free(); mesh.update()
    return obj


# ── Conifer builder ───────────────────────────────────────────────────────────
def build_conifer(name, trunk_h, trunk_rb, trunk_rt, tiers, base_r, top_r, step,
                  tier_depth, needle_color, seed):
    _clear_scene()
    _make_material("bark_pine", COL_BARK_PINE, 0.88)
    _make_material("needle_pine", needle_color, 0.80)
    parts = []
    # Brown tapered trunk (kept partly visible below the lowest tier).
    trunk = _tapered_cylinder("trunk", trunk_rb, trunk_rt, trunk_h, verts=7, location=(0, 0, 0))
    _shade_flat(trunk); _assign_mat(trunk, "bark_pine"); parts.append(trunk)
    # Stacked ragged needle tiers — widest at the bottom, irregular per tier.
    for i in range(tiers):
        t = i / (tiers - 1) if tiers > 1 else 0.0                     # 0 bottom .. 1 top
        r = base_r + (top_r - base_r) * t
        depth = tier_depth * (1.0 - 0.18 * t) * (0.85 + _h(seed * 7 + i, seed * 5 + i) * 0.32)  # non-identical heights
        zb = trunk_h * 0.88 + i * step                                # leave a little trunk showing
        ox = (_h(seed * 2 + i, seed * 4 + i) - 0.5) * 0.06 * base_r    # subtle horizontal jitter
        oy = (_h(seed * 6 + i, seed * 8 + i) - 0.5) * 0.06 * base_r
        yaw = i * 0.7 + (_h(seed + i, seed * 3 + i) - 0.5) * 0.7
        tier = _needle_tier(f"tier_{i}", r, depth, 7, seed * 13 + i, droop=0.10 * r)
        tier.location = (ox, oy, zb)
        tier.rotation_euler.z = yaw
        _apply_transform(tier)
        _shade_flat(tier); _assign_mat(tier, "needle_pine"); parts.append(tier)
    obj = _join_objects(parts); obj.name = name
    _set_origin_bottom_center(obj)
    return obj


def build_small():
    return build_conifer("forest_conifer_small", trunk_h=0.42, trunk_rb=0.11, trunk_rt=0.08,
                         tiers=3, base_r=0.42, top_r=0.15, step=0.42, tier_depth=0.58,
                         needle_color=NEEDLE_SMALL, seed=11)


def build_medium():
    return build_conifer("forest_conifer_medium", trunk_h=0.50, trunk_rb=0.14, trunk_rt=0.10,
                         tiers=4, base_r=0.66, top_r=0.20, step=0.46, tier_depth=0.70,
                         needle_color=NEEDLE_MEDIUM, seed=22)


def build_tall():
    return build_conifer("forest_conifer_tall", trunk_h=0.58, trunk_rb=0.13, trunk_rt=0.09,
                         tiers=5, base_r=0.56, top_r=0.16, step=0.50, tier_depth=0.70,
                         needle_color=NEEDLE_TALL, seed=33)


def build_broad():
    return build_conifer("forest_conifer_broad", trunk_h=0.44, trunk_rb=0.17, trunk_rt=0.12,
                         tiers=5, base_r=0.98, top_r=0.30, step=0.40, tier_depth=0.82,
                         needle_color=NEEDLE_BROAD, seed=44)


# ── Draft render (Workbench — headless-safe, solid shaded) ────────────────────
def render_draft(name):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 480
    scene.render.film_transparent = False
    try:
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "MATERIAL"
    except Exception:
        pass
    cam_data = bpy.data.cameras.new("draft_cam")
    cam = bpy.data.objects.new("draft_cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector((3.1, -3.1, 4.3))   # higher / RTS-like
    direction = Vector((0, 0, 1.15)) - cam.location
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")
    scene.camera = cam
    out = os.path.join(DRAFT_DIR, f"{name}.png")
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print(f"[DRAFT] {out}")


def tri_count(obj):
    return sum((len(p.vertices) - 2) for p in obj.data.polygons)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
ASSETS = [
    ("forest_conifer_small",  build_small),
    ("forest_conifer_medium", build_medium),
    ("forest_conifer_tall",   build_tall),
    ("forest_conifer_broad",  build_broad),
]

results = []
for asset_name, build_fn in ASSETS:
    print(f"\n{'='*60}\n  Building: {asset_name}\n{'='*60}")
    try:
        obj = build_fn()
        tris = tri_count(obj)
        mats = [m.name for m in obj.data.materials]
        out_path = os.path.join(OUT_DIR, f"{asset_name}_v31.glb")
        bpy.ops.export_scene.gltf(
            filepath=out_path, export_format="GLB", use_selection=False,
            export_cameras=False, export_lights=False, export_apply=True,
        )
        size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
        render_draft(asset_name)
        print(f"[EXPORTED] {out_path} ({size:,} bytes, {tris} tris, mats={mats})")
        results.append({"name": asset_name, "size": size, "tris": tris, "mats": mats, "status": "OK"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        results.append({"name": asset_name, "size": 0, "tris": 0, "mats": [], "status": f"FAILED: {e}"})

print("\n\n" + "=" * 60)
print("  VIREON CONIFER DRAFT (refined 4-variant) — SUMMARY")
print("=" * 60)
all_ok = True
for r in results:
    ok = r["status"] == "OK" and r["size"] > 0
    all_ok = all_ok and ok
    label = f"OK ({r['size']:,} B, {r['tris']} tris, {r['mats']})" if ok else r["status"]
    print(f"  {'OK ' if ok else 'FAIL'} {r['name']:<24} {label}")
print("=" * 60)
sys.exit(0 if all_ok else 1)
