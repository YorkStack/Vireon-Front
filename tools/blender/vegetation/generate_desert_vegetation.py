"""
Vireon Front — Desert Vegetation Variant Set (v3.1)
===================================================
Generates four low-poly authored desert vegetation GLBs that extend the active
GLB v3.1 vegetation set with real cactus/palm diversity (replacing the earlier
procedural cactus-arm stopgap).

Run headlessly:
  /Applications/Blender.app/Contents/MacOS/blender --background \
    --python tools/blender/vegetation/generate_desert_vegetation.py

Output GLBs : public/assets/vegetation/glb_v31/desert/
Draft PNGs  : tools/blender/vegetation/drafts/

Assets:
  1. desert_saguaro_v31.glb   — tall ribbed column + 2-3 upward arms
  2. desert_barrel_v31.glb     — short clustered ribbed barrel bodies
  3. desert_opuntia_v31.glb    — branching flat oval paddle pads
  4. desert_palm_v31.glb       — segmented brown trunk + drooping green fronds

Style + conventions match tools/blender/vegetation/generate_vegetation_assets.py:
bmesh primitives -> per-part material -> join -> origin bottom-center -> GLB.

Material names are chosen so the game's name-based classifier (vegZoneOf) tints
them correctly at runtime:
  cactus_body  -> 'cactus' (sage tint + rib shader)
  palm_trunk   -> 'woody'  (brown bark shader)
  palm_frond   -> 'foliage' (green leaf shader; 'frond' added to the regex)
  cactus_spine -> unclassified (authored dark colour preserved)
  cactus_flower-> unclassified (authored warm colour preserved)
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
OUT_DIR      = os.path.join(PROJECT_ROOT, "public", "assets", "vegetation", "glb_v31", "desert")
DRAFT_DIR    = os.path.join(SCRIPT_DIR, "drafts")
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(DRAFT_DIR, exist_ok=True)
print(f"[INIT] GLB out: {OUT_DIR}")
print(f"[INIT] drafts : {DRAFT_DIR}")


# ── sRGB → linear helper ──────────────────────────────────────────────────────
def _lin(r, g, b, a=1.0):
    def c(x):
        x /= 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)


COL_CACTUS_BODY  = _lin( 95, 138,  74)   # #5F8A4A sage green
COL_CACTUS_SPINE = _lin( 46,  58,  34)   # #2E3A22 dark olive
COL_CACTUS_FLOW  = _lin(210, 103,  78)   # #D2674E warm desert bloom
COL_PALM_TRUNK   = _lin(107,  74,  44)   # #6B4A2C brown
COL_PALM_FROND   = _lin( 90, 148,  64)   # #5A9440 frond green


# ── Material factory (Principled BSDF, no emission) ───────────────────────────
def _make_material(name, base_color, roughness=0.8):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
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


def _setup_materials():
    _make_material("cactus_body",   COL_CACTUS_BODY,  0.82)
    _make_material("cactus_spine",  COL_CACTUS_SPINE, 0.7)
    _make_material("cactus_flower", COL_CACTUS_FLOW,  0.55)
    _make_material("palm_trunk",    COL_PALM_TRUNK,   0.85)
    _make_material("palm_frond",    COL_PALM_FROND,   0.75)


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


def _shade_smooth(obj):
    _set_active(obj)
    bpy.ops.object.shade_smooth()


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
def _tapered_cylinder(name, radius_bottom, radius_top, height, verts=8, location=(0, 0, 0)):
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


def _segment(name, p0, p1, r0, r1, verts=8, flat=1.0):
    """Tapered cylinder spanning arbitrary points p0->p1 (like the game's limbGeo).
    `flat` (<1) squashes the cross-section along t2 → a flat blade in the segment's
    OWN frame (don't use object.scale on these — the verts are baked in world space,
    so a world-space scale would also displace the segment toward the origin)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = (p1 - p0)
    L = d.length
    if L < 1e-5:
        L = 1e-5
    d = d / L
    up = Vector((0, 0, 1)) if abs(d.z) < 0.95 else Vector((1, 0, 0))
    t1 = d.cross(up).normalized()
    t2 = d.cross(t1).normalized()
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    b_verts, t_verts = [], []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        off0 = (t1 * math.cos(a) + t2 * (math.sin(a) * flat)) * r0
        off1 = (t1 * math.cos(a) + t2 * (math.sin(a) * flat)) * r1
        b_verts.append(bm.verts.new(p0 + off0))
        t_verts.append(bm.verts.new(p1 + off1))
    bm.verts.ensure_lookup_table()
    for i in range(verts):
        ni = (i + 1) % verts
        bm.faces.new([b_verts[i], b_verts[ni], t_verts[ni], t_verts[i]])
    bm.faces.new(list(reversed(b_verts)))
    bm.faces.new(t_verts)
    bm.to_mesh(mesh); bm.free(); mesh.update()
    return obj


def _ico_sphere(name, radius=0.3, subdivs=1, location=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivs, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj


def _pad(name, w, h, thick, location=(0, 0, 0), rot_z=0.0, rot_x=0.0):
    """A flat oval paddle (opuntia segment): broad in X (w) and Z (h), thin in Y
    (thick) → a flat vertical oval pad facing ±Y."""
    obj = _ico_sphere(name, radius=1.0, subdivs=1, location=location)
    obj.scale = (w, thick, h)            # thin in Y → flat oval facing ±Y
    obj.rotation_euler.z = rot_z
    obj.rotation_euler.x = rot_x
    _apply_transform(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# A — desert_saguaro : tall ribbed column + 2-3 upward arms
# ═══════════════════════════════════════════════════════════════════════════════
def build_saguaro():
    _clear_scene(); _setup_materials()
    parts = []
    col = _tapered_cylinder("col", 0.30, 0.20, 2.25, verts=10, location=(0, 0, 0))
    _shade_flat(col); _assign_mat(col, "cactus_body"); parts.append(col)

    # 3 arms: short outward elbow then a tall vertical riser (classic saguaro).
    arm_cfgs = [
        (math.radians(25),  0.95, 0.85),   # (azimuth, elbow_height, riser_height)
        (math.radians(205), 1.30, 0.70),
        (math.radians(120), 0.70, 0.55),
    ]
    for i, (az, zb, rh) in enumerate(arm_cfgs):
        dx, dy = math.cos(az), math.sin(az)
        base   = (dx * 0.18, dy * 0.18, zb)
        elbow  = (dx * 0.52, dy * 0.52, zb + 0.18)
        top    = (dx * 0.52, dy * 0.52, zb + 0.18 + rh)
        s1 = _segment(f"arm_lo_{i}", base, elbow, 0.115, 0.10, verts=8)
        s2 = _segment(f"arm_up_{i}", elbow, top, 0.10, 0.085, verts=8)
        for s in (s1, s2):
            _shade_flat(s); _assign_mat(s, "cactus_body"); parts.append(s)

    # subtle spine hints: tiny dark cones along the column crest
    for i in range(5):
        z = 0.4 + i * 0.38
        sp = _ico_sphere(f"spine_{i}", radius=0.03, subdivs=1, location=(0.30, 0.0, z))
        sp.rotation_euler.z = i * 1.1
        _apply_transform(sp); _assign_mat(sp, "cactus_spine"); parts.append(sp)

    obj = _join_objects(parts); obj.name = "desert_saguaro"
    _set_origin_bottom_center(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# B — desert_barrel : short clustered ribbed barrel bodies
# ═══════════════════════════════════════════════════════════════════════════════
def build_barrel():
    _clear_scene(); _setup_materials()
    parts = []
    # (offset_x, offset_y, radius_bottom, radius_top, height)
    # ~20% slimmer than the first pass (radii x0.8) so the cluster reads less fat.
    cfgs = [
        ( 0.00,  0.00, 0.44, 0.34, 0.95),
        ( 0.53,  0.10, 0.34, 0.26, 0.70),
        (-0.34,  0.29, 0.30, 0.24, 0.62),
        ( 0.15, -0.44, 0.27, 0.21, 0.52),
    ]
    for i, (ox, oy, rb, rt, h) in enumerate(cfgs):
        body = _tapered_cylinder(f"barrel_{i}", rb, rt, h, verts=12, location=(ox, oy, 0))
        _shade_flat(body); _assign_mat(body, "cactus_body"); parts.append(body)
        # rounded ribbed crown
        crown = _ico_sphere(f"crown_{i}", radius=rt * 1.04, subdivs=1, location=(ox, oy, h))
        crown.scale = (1.0, 1.0, 0.6); _apply_transform(crown)
        _shade_flat(crown); _assign_mat(crown, "cactus_body"); parts.append(crown)
    # a couple of small blooms on the two tallest bodies
    for i, (ox, oy, rb, rt, h) in enumerate(cfgs[:2]):
        fl = _ico_sphere(f"bloom_{i}", radius=0.10, subdivs=1, location=(ox, oy, h + 0.12))
        fl.scale = (1.0, 1.0, 0.6); _apply_transform(fl)
        _assign_mat(fl, "cactus_flower"); parts.append(fl)

    obj = _join_objects(parts); obj.name = "desert_barrel"
    _set_origin_bottom_center(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# C — desert_opuntia : branching flat oval paddle pads
# ═══════════════════════════════════════════════════════════════════════════════
def build_opuntia():
    _clear_scene(); _setup_materials()
    parts = []
    # base pads (rooted), then upper pads branching off their tops, asymmetric.
    # (w, h, thick, x, z, rot_z, rot_x) — thin pads read clearly as paddles.
    pad_cfgs = [
        (0.46, 0.60, 0.085, -0.05, 0.58,  0.20, 0.0),
        (0.44, 0.56, 0.085,  0.34, 0.52, -0.55, 0.0),
        (0.36, 0.50, 0.080, -0.22, 1.12,  0.65, 0.10),
        (0.34, 0.48, 0.080,  0.40, 1.08, -0.35, -0.12),
        (0.28, 0.42, 0.075,  0.06, 1.55,  0.10, 0.05),
    ]
    for i, (w, h, th, x, z, rz, rx) in enumerate(pad_cfgs):
        pad = _pad(f"pad_{i}", w, h, th, location=(x, 0.0, z), rot_z=rz, rot_x=rx)
        _shade_flat(pad); _assign_mat(pad, "cactus_body"); parts.append(pad)
        # tiny blooms on the upper-pad tips
        if i >= 2:
            fl = _ico_sphere(f"obloom_{i}", radius=0.07, subdivs=1, location=(x, 0.0, z + h * 0.55))
            fl.scale = (1.0, 0.5, 1.0); _apply_transform(fl)
            _assign_mat(fl, "cactus_flower"); parts.append(fl)

    obj = _join_objects(parts); obj.name = "desert_opuntia"
    _set_origin_bottom_center(obj)
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# D — desert_palm : segmented brown trunk + drooping green fronds
# ═══════════════════════════════════════════════════════════════════════════════
def build_palm():
    _clear_scene(); _setup_materials()
    parts = []
    # Trunk: stacked segments with a gentle lean (reads as ringed at zoom).
    pts = [(0.0, 0.0, 0.0), (0.05, 0.02, 0.85), (0.12, 0.04, 1.7), (0.20, 0.06, 2.45)]
    radii = [0.17, 0.145, 0.125, 0.10]
    for i in range(len(pts) - 1):
        seg = _segment(f"trunk_{i}", pts[i], pts[i + 1], radii[i], radii[i + 1], verts=8)
        _shade_flat(seg); _assign_mat(seg, "palm_trunk"); parts.append(seg)
    crown = Vector(pts[-1])

    # Fronds: long drooping flattened blades radiating with asymmetric angles.
    n_fronds = 8
    for i in range(n_fronds):
        az = 2 * math.pi * i / n_fronds + (0.18 if i % 2 else -0.12)
        reach = 1.05 + 0.18 * (i % 3) / 2.0
        droop = 0.50 + 0.12 * (i % 2)
        mid = crown + Vector((math.cos(az) * reach * 0.5, math.sin(az) * reach * 0.5, 0.04))
        tip = crown + Vector((math.cos(az) * reach, math.sin(az) * reach, -droop))
        f1 = _segment(f"frond_a_{i}", crown, mid, 0.14, 0.10, verts=6, flat=0.32)
        f2 = _segment(f"frond_b_{i}", mid, tip, 0.10, 0.018, verts=6, flat=0.32)
        for f in (f1, f2):
            _shade_flat(f); _assign_mat(f, "palm_frond"); parts.append(f)
    # crown core cluster hiding the frond roots at the very top
    core = _ico_sphere("crown_core", radius=0.19, subdivs=1, location=tuple(crown + Vector((0, 0, 0.08))))
    core.scale = (1.0, 1.0, 0.8); _apply_transform(core)
    _assign_mat(core, "palm_frond"); parts.append(core)

    obj = _join_objects(parts); obj.name = "desert_palm"
    _set_origin_bottom_center(obj)
    return obj


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
    cam.location = Vector((3.1, -3.1, 4.3))   # higher / more top-down, RTS-like
    direction = Vector((0, 0, 1.05)) - cam.location
    cam.rotation_mode = "QUATERNION"
    cam.rotation_quaternion = direction.to_track_quat("-Z", "Y")
    scene.camera = cam
    out = os.path.join(DRAFT_DIR, f"{name}.png")
    scene.render.filepath = out
    bpy.ops.render.render(write_still=True)
    print(f"[DRAFT] {out}")


def tri_count(obj):
    me = obj.data
    return sum((len(p.vertices) - 2) for p in me.polygons)


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
ASSETS = [
    ("desert_saguaro",  build_saguaro),
    ("desert_barrel",   build_barrel),
    ("desert_opuntia",  build_opuntia),
    ("desert_palm",     build_palm),
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
print("  VIREON DESERT VEGETATION — GENERATION SUMMARY")
print("=" * 60)
all_ok = True
for r in results:
    ok = r["status"] == "OK" and r["size"] > 0
    all_ok = all_ok and ok
    label = f"OK ({r['size']:,} B, {r['tris']} tris, {r['mats']})" if ok else r["status"]
    print(f"  {'OK ' if ok else 'FAIL'} {r['name']:<22} {label}")
print("=" * 60)
sys.exit(0 if all_ok else 1)
