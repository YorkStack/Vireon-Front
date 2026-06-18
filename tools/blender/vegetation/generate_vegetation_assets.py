"""
Vireon Front — Alien Vegetation Asset Generator
================================================
Generates 6 low-poly alien vegetation GLBs for RTS map decoration.

Run headlessly:
  /Applications/Blender.app/Contents/MacOS/blender --background \
    --python tools/blender/vegetation/generate_vegetation_assets.py

Output: Vegetation/output/<asset_name>.glb

Assets:
  1. alien_mushroom_tree.glb    — tall single mushroom (reference quality)
  2. alien_mushroom_cluster.glb — group of 3–5 smaller mushrooms
  3. alien_spore_bush.glb       — low scatter bush with glowing pods
  4. alien_crystal_fern.glb     — faceted crystalline fern blades
  5. alien_biolume_reed.glb     — tall thin bioluminescent reeds
  6. alien_pod_shrub.glb        — medium organic shrub with bulbous pods
"""

import bpy
import bmesh
import math
import os
import sys

# ── Output directory ──────────────────────────────────────────────────────────
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))
OUT_DIR      = os.path.join(PROJECT_ROOT, "Vegetation", "output")
os.makedirs(OUT_DIR, exist_ok=True)
print(f"[INIT] Output dir: {OUT_DIR}")


# ── sRGB → linear helper ──────────────────────────────────────────────────────
def _lin(r, g, b, a=1.0):
    """Convert 0–255 sRGB integers to linear float 4-tuple for Blender inputs."""
    def c(x):
        x /= 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)


COL_STEM        = _lin(224, 255, 255)   # #E0FFFF  pale cyan-white
COL_CAP_TOP     = _lin(  0, 206, 209)   # #00CED1  deep turquoise
COL_CAP_RIM     = _lin(186,  85, 211)   # #BA55D3  violet-magenta
COL_SPORE       = _lin(  0, 255, 255)   # #00FFFF  pure cyan
COL_DARK_BASE   = _lin( 10,  20,  30)   # near-black organic base
COL_CRYSTAL_AQ  = _lin(  0, 180, 200)   # aqua crystal
COL_CRYSTAL_VI  = _lin(120,  60, 180)   # violet crystal
COL_VEIN        = _lin(  0, 240, 220)   # emissive vein teal


# ── Material factory ──────────────────────────────────────────────────────────
def _make_material(name, base_color, emit_color=None, emit_strength=0.0, roughness=0.5):
    """Create or retrieve a Principled BSDF material.  Blender 4.x compatible."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out  = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    out.location  = (300, 0)
    bsdf.location = (0,   0)

    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value  = roughness

    if emit_color and emit_strength > 0:
        # Blender 4.x uses "Emission Color" + "Emission Strength" as separate inputs
        try:
            bsdf.inputs["Emission Color"].default_value    = emit_color
            bsdf.inputs["Emission Strength"].default_value = emit_strength
        except KeyError:
            # Blender 3.x fallback: single "Emission" input
            try:
                bsdf.inputs["Emission"].default_value = emit_color
                bsdf.inputs["Emission Strength"].default_value = emit_strength
            except KeyError:
                pass

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def _setup_materials():
    """Define all shared materials in current Blender data."""
    _make_material("MAT_Glowing_Stem",            COL_STEM,       COL_STEM,       1.5, 0.15)
    _make_material("MAT_Mushroom_Cap_Turquoise",  COL_CAP_TOP,    None,           0.0, 0.70)
    _make_material("MAT_Mushroom_Cap_Violet_Rim", COL_CAP_RIM,    None,           0.0, 0.65)
    _make_material("MAT_Spore_Glow",              COL_SPORE,      COL_SPORE,      4.0, 0.10)
    _make_material("MAT_Alien_Dark_Base",         COL_DARK_BASE,  None,           0.0, 0.90)
    _make_material("MAT_Crystal_Aqua",            COL_CRYSTAL_AQ, COL_CRYSTAL_AQ, 0.6, 0.20)
    _make_material("MAT_Crystal_Violet",          COL_CRYSTAL_VI, COL_CRYSTAL_VI, 0.3, 0.25)
    _make_material("MAT_Emissive_Veins",          COL_VEIN,       COL_VEIN,       2.0, 0.30)


# ── Scene helpers ─────────────────────────────────────────────────────────────
def _clear_scene():
    """Remove all objects, meshes, materials, cameras, lights from scene."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials,
                  bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def _link(obj):
    """Link object to scene collection if not already linked."""
    if obj.name not in bpy.context.collection.objects:
        bpy.context.collection.objects.link(obj)


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


def _shade_smooth(obj):
    _set_active(obj)
    bpy.ops.object.shade_smooth()


def _join_objects(objects):
    """Join all objects in list into the first one. Returns joined object."""
    assert len(objects) >= 1, "join_objects: need at least 1 object"
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    return bpy.context.active_object


def _set_origin_bottom_center(obj):
    """
    Move the object so its lowest vertex is at Z=0, then set origin to (0,0,0).
    Works reliably across Blender 3.x and 4.x.
    """
    # 1. Apply any pending transforms first
    _apply_transform(obj)

    # 2. Find world-space min Z from bounding box
    world_z = [obj.matrix_world @ obj.data.vertices[v].co
               for v in range(len(obj.data.vertices))]
    if not world_z:
        # fallback: use bounding box
        world_z_vals = [(obj.matrix_world @ __import__('mathutils').Vector(bb)).z
                        for bb in obj.bound_box]
        min_z = min(world_z_vals)
    else:
        min_z = min(co.z for co in world_z)

    # 3. Shift object up so bottom = 0
    obj.location.z -= min_z
    _apply_transform(obj)

    # 4. Set cursor to (0,0,0), then set origin to cursor
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    _set_active(obj)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

    # 5. Move object back to (0,0,0)
    obj.location = (0.0, 0.0, 0.0)
    _apply_transform(obj)


# ── Geometry primitives ───────────────────────────────────────────────────────
def _tapered_cylinder(name, radius_bottom, radius_top, height, verts=8, location=(0, 0, 0)):
    """Manually built tapered cylinder (stem primitive)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    n = verts
    ox, oy, oz = location

    # bottom ring
    b_verts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        b_verts.append(bm.verts.new((ox + radius_bottom * math.cos(a),
                                     oy + radius_bottom * math.sin(a),
                                     oz)))
    # top ring
    t_verts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        t_verts.append(bm.verts.new((ox + radius_top * math.cos(a),
                                     oy + radius_top * math.sin(a),
                                     oz + height)))
    bm.verts.ensure_lookup_table()

    # side faces
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new([b_verts[i], b_verts[ni], t_verts[ni], t_verts[i]])

    # bottom cap
    bm.faces.new(list(reversed(b_verts)))
    # top cap
    bm.faces.new(t_verts)

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj


def _ico_sphere(name, radius=0.3, subdivs=1, location=(0, 0, 0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivs,
                                           radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj


def _crystal_prism(name, radius=0.05, height=0.5, verts=4, location=(0, 0, 0)):
    """Faceted prism — pointed at top (crystal blade)."""
    mesh = bpy.data.meshes.new(name + "_mesh")
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    ox, oy, oz = location
    base_verts = []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        base_verts.append(bm.verts.new((ox + radius * math.cos(a),
                                        oy + radius * math.sin(a),
                                        oz)))
    tip = bm.verts.new((ox, oy, oz + height))
    bm.verts.ensure_lookup_table()

    # side triangles
    for i in range(verts):
        ni = (i + 1) % verts
        bm.faces.new([base_verts[i], base_verts[ni], tip])
    # base cap
    bm.faces.new(list(reversed(base_verts)))

    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 1 — alien_mushroom_tree  (reference quality)
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_mushroom_tree():
    _clear_scene()
    _setup_materials()

    parts = []

    # --- Stem: tall tapered cylinder, smooth shaded ---
    stem = _tapered_cylinder("stem", radius_bottom=0.12, radius_top=0.04,
                              height=2.2, verts=10, location=(0, 0, 0))
    _assign_mat(stem, "MAT_Glowing_Stem")
    _shade_smooth(stem)
    parts.append(stem)

    # --- Cap top: flattened upper dome (turquoise) ---
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=6,
                                          radius=0.78, location=(0, 0, 2.2))
    cap_top = bpy.context.active_object
    cap_top.name = "cap_top"
    cap_top.scale.z = 0.35
    _apply_transform(cap_top)
    # Remove lower hemisphere
    me = cap_top.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    to_del = [v for v in bm.verts if v.co.z < -0.01]
    bmesh.ops.delete(bm, geom=to_del, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    _assign_mat(cap_top, "MAT_Mushroom_Cap_Turquoise")
    parts.append(cap_top)

    # --- Cap rim: lower tapered ring (violet/magenta underside) ---
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.86, radius2=0.38,
                                     depth=0.20, location=(0, 0, 2.05))
    cap_rim = bpy.context.active_object
    cap_rim.name = "cap_rim"
    _assign_mat(cap_rim, "MAT_Mushroom_Cap_Violet_Rim")
    parts.append(cap_rim)

    # --- Spore pods: 4 glowing icospheres under cap rim ---
    for i in range(4):
        angle = 2 * math.pi * i / 4 + math.pi / 4
        px = 0.62 * math.cos(angle)
        py = 0.62 * math.sin(angle)
        pod = _ico_sphere(f"pod_{i}", radius=0.07, subdivs=1,
                           location=(px, py, 2.0))
        _assign_mat(pod, "MAT_Spore_Glow")
        parts.append(pod)

    joined = _join_objects(parts)
    joined.name = "alien_mushroom_tree"
    _set_origin_bottom_center(joined)
    return joined


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 2 — alien_mushroom_cluster
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_mushroom_cluster():
    _clear_scene()
    _setup_materials()
    import random
    rng = random.Random(42)

    # (offset_x, offset_y, stem_height, stem_rb, stem_rt, cap_radius)
    configs = [
        ( 0.00,  0.00, 1.05, 0.085, 0.030, 0.58),
        ( 0.48,  0.20, 0.75, 0.065, 0.025, 0.44),
        (-0.42,  0.32, 0.88, 0.072, 0.028, 0.52),
        ( 0.15, -0.52, 0.62, 0.058, 0.022, 0.40),
        (-0.20, -0.38, 0.52, 0.052, 0.020, 0.34),
    ]

    all_parts = []
    for idx, (ox, oy, h, rb, rt, cr) in enumerate(configs):
        stem = _tapered_cylinder(f"stem_{idx}", rb, rt, h, verts=8,
                                  location=(ox, oy, 0))
        _assign_mat(stem, "MAT_Glowing_Stem")
        _shade_smooth(stem)
        all_parts.append(stem)

        # cap cone
        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=cr + 0.06,
                                         radius2=cr * 0.38, depth=cr * 0.52,
                                         location=(ox, oy, h))
        cap = bpy.context.active_object
        cap.name = f"cap_{idx}"
        mat = "MAT_Mushroom_Cap_Turquoise" if idx % 2 == 0 else "MAT_Mushroom_Cap_Violet_Rim"
        _assign_mat(cap, mat)
        all_parts.append(cap)

        # 2 spore pods per mushroom
        for si in range(2):
            a = math.pi * si + rng.random() * 0.4
            px = ox + cr * 0.78 * math.cos(a)
            py = oy + cr * 0.78 * math.sin(a)
            pod = _ico_sphere(f"pod_{idx}_{si}", radius=0.045, subdivs=1,
                               location=(px, py, h - cr * 0.08))
            _assign_mat(pod, "MAT_Spore_Glow")
            all_parts.append(pod)

    joined = _join_objects(all_parts)
    joined.name = "alien_mushroom_cluster"
    _set_origin_bottom_center(joined)
    return joined


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 3 — alien_spore_bush
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_spore_bush():
    _clear_scene()
    _setup_materials()

    parts = []

    # Dark organic base mound
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.42,
                                           location=(0, 0, 0.18))
    base = bpy.context.active_object
    base.name = "bush_base"
    base.scale.z = 0.48
    _apply_transform(base)
    _assign_mat(base, "MAT_Alien_Dark_Base")
    parts.append(base)

    # Short curved stems at various angles
    stem_configs = [
        ( 0.00,  0.00,  0.0,  0.38,  0.0),
        ( 0.22,  0.10,  0.0,  0.32, 14.0),
        (-0.18,  0.16,  0.0,  0.30,-12.0),
        ( 0.10, -0.24,  0.0,  0.35, 10.0),
        (-0.15, -0.20,  0.0,  0.26, -9.0),
        ( 0.28, -0.08,  0.0,  0.28, 16.0),
    ]
    for i, (ox, oy, oz, h, tilt) in enumerate(stem_configs):
        s = _tapered_cylinder(f"bstem_{i}", 0.055, 0.02, h, verts=6,
                               location=(ox, oy, oz + 0.12))
        s.rotation_euler.x = math.radians(tilt)
        _apply_transform(s)
        _assign_mat(s, "MAT_Glowing_Stem")
        _shade_smooth(s)
        parts.append(s)

        # glowing pod at stem tip
        tip_z = oz + 0.12 + h * math.cos(math.radians(abs(tilt)))
        pod = _ico_sphere(f"bpod_{i}", radius=0.072, subdivs=1,
                           location=(ox, oy, tip_z))
        _assign_mat(pod, "MAT_Spore_Glow")
        parts.append(pod)

    joined = _join_objects(parts)
    joined.name = "alien_spore_bush"
    _set_origin_bottom_center(joined)
    return joined


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 4 — alien_crystal_fern
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_crystal_fern():
    _clear_scene()
    _setup_materials()

    parts = []

    # Short base stub
    base = _tapered_cylinder("fern_base", 0.09, 0.04, 0.18, verts=6,
                              location=(0, 0, 0))
    _assign_mat(base, "MAT_Alien_Dark_Base")
    parts.append(base)

    # Crystal blades radiating upward at various angles
    blade_configs = [
        ( 0.00,  0.00, 0.18, 0.58, 0.0,   -28),
        ( 0.07,  0.00, 0.14, 0.52, 0.0,   -38),
        (-0.06,  0.06, 0.14, 0.48, 32.0,  -36),
        ( 0.05, -0.07, 0.14, 0.50,-24.0,  -34),
        ( 0.12,  0.08, 0.12, 0.44, 16.0,  -48),
        (-0.10, -0.06, 0.12, 0.42,-20.0,  -44),
        ( 0.00,  0.13, 0.14, 0.54, 48.0,  -30),
        (-0.13,  0.00, 0.12, 0.46,-52.0,  -42),
    ]
    for i, (ox, oy, oz, h, rz, rx) in enumerate(blade_configs):
        blade = _crystal_prism(f"blade_{i}", radius=0.038, height=h,
                                verts=4, location=(ox, oy, oz))
        blade.rotation_euler.z = math.radians(rz)
        blade.rotation_euler.x = math.radians(rx)
        _apply_transform(blade)
        mat = "MAT_Crystal_Violet" if i % 3 == 2 else "MAT_Crystal_Aqua"
        _assign_mat(blade, mat)
        parts.append(blade)

    # Small emissive vein nodes at junction
    for i in range(4):
        a = 2 * math.pi * i / 4
        node = _ico_sphere(f"vein_{i}", radius=0.028, subdivs=1,
                            location=(0.09 * math.cos(a), 0.09 * math.sin(a), 0.26))
        _assign_mat(node, "MAT_Emissive_Veins")
        parts.append(node)

    joined = _join_objects(parts)
    joined.name = "alien_crystal_fern"
    _set_origin_bottom_center(joined)
    return joined


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 5 — alien_biolume_reed
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_biolume_reed():
    _clear_scene()
    _setup_materials()

    parts = []

    # Flat base plate
    base = _tapered_cylinder("reed_base", 0.16, 0.09, 0.06, verts=8,
                              location=(0, 0, 0))
    _assign_mat(base, "MAT_Alien_Dark_Base")
    parts.append(base)

    reed_configs = [
        ( 0.00,  0.00, 1.85,  0.0),
        ( 0.13, -0.05, 1.65,  5.5),
        (-0.10,  0.11, 2.05, -4.0),
        ( 0.23,  0.16, 1.55,  8.0),
        (-0.19, -0.12, 1.72, -6.0),
        ( 0.09,  0.26, 1.92,  3.5),
    ]
    for i, (ox, oy, h, tilt) in enumerate(reed_configs):
        reed = _tapered_cylinder(f"reed_{i}", radius_bottom=0.030,
                                  radius_top=0.007, height=h, verts=6,
                                  location=(ox, oy, 0.06))
        reed.rotation_euler.x = math.radians(tilt)
        _apply_transform(reed)
        _assign_mat(reed, "MAT_Glowing_Stem")
        _shade_smooth(reed)
        parts.append(reed)

        # Glowing tip at top of each reed
        tip_z = 0.06 + h * math.cos(math.radians(abs(tilt)))
        tip = _ico_sphere(f"rtip_{i}", radius=0.048, subdivs=1,
                           location=(ox, oy, tip_z))
        _assign_mat(tip, "MAT_Spore_Glow")
        parts.append(tip)

    joined = _join_objects(parts)
    joined.name = "alien_biolume_reed"
    _set_origin_bottom_center(joined)
    return joined


# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 6 — alien_pod_shrub
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_pod_shrub():
    _clear_scene()
    _setup_materials()

    parts = []

    # Central organic core mass
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.38,
                                           location=(0, 0, 0.28))
    core = bpy.context.active_object
    core.name = "pod_core"
    core.scale = (1.0, 1.0, 0.82)
    _apply_transform(core)
    _assign_mat(core, "MAT_Alien_Dark_Base")
    parts.append(core)

    # Bulbous spore pods protruding outward
    pod_configs = [
        ( 0.32,  0.00, 0.40, 0.145),
        (-0.30,  0.12, 0.36, 0.132),
        ( 0.10,  0.36, 0.38, 0.122),
        (-0.10, -0.36, 0.34, 0.132),
        ( 0.26,  0.26, 0.50, 0.112),
        (-0.26, -0.22, 0.46, 0.122),
        ( 0.00,  0.30, 0.56, 0.105),
    ]
    for i, (ox, oy, oz, r) in enumerate(pod_configs):
        pod = _ico_sphere(f"shrub_pod_{i}", radius=r, subdivs=2,
                           location=(ox, oy, oz))
        mat = "MAT_Mushroom_Cap_Turquoise" if i % 3 != 0 else "MAT_Mushroom_Cap_Violet_Rim"
        _assign_mat(pod, mat)
        parts.append(pod)

    # Emissive cyan glows on top pods
    for i in range(4):
        a = 2 * math.pi * i / 4
        glow = _ico_sphere(f"shrub_glow_{i}", radius=0.038, subdivs=1,
                            location=(0.30 * math.cos(a), 0.30 * math.sin(a), 0.55))
        _assign_mat(glow, "MAT_Spore_Glow")
        parts.append(glow)

    # Short stem stubs radiating from base
    for i in range(5):
        a = 2 * math.pi * i / 5
        sx, sy = 0.20 * math.cos(a), 0.20 * math.sin(a)
        stub = _tapered_cylinder(f"stub_{i}", 0.042, 0.016, 0.24, verts=5,
                                  location=(sx, sy, 0))
        stub.rotation_euler.z = a
        stub.rotation_euler.x = math.radians(22)
        _apply_transform(stub)
        _assign_mat(stub, "MAT_Glowing_Stem")
        parts.append(stub)

    joined = _join_objects(parts)
    joined.name = "alien_pod_shrub"
    _set_origin_bottom_center(joined)
    return joined


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
ASSETS = [
    ("alien_mushroom_tree",    build_alien_mushroom_tree),
    ("alien_mushroom_cluster", build_alien_mushroom_cluster),
    ("alien_spore_bush",       build_alien_spore_bush),
    ("alien_crystal_fern",     build_alien_crystal_fern),
    ("alien_biolume_reed",     build_alien_biolume_reed),
    ("alien_pod_shrub",        build_alien_pod_shrub),
]

results = []

for asset_name, build_fn in ASSETS:
    print(f"\n{'='*60}")
    print(f"  Building: {asset_name}")
    print(f"{'='*60}")
    try:
        build_fn()
        out_path = os.path.join(OUT_DIR, f"{asset_name}.glb")
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format="GLB",
            use_selection=False,
            export_cameras=False,
            export_lights=False,
            export_apply=True,
        )
        size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
        print(f"[EXPORTED] {out_path}  ({size:,} bytes)")
        results.append({"name": asset_name, "path": out_path, "size": size, "status": "OK"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[ERROR] {asset_name}: {e}")
        results.append({"name": asset_name, "path": "", "size": 0, "status": f"FAILED: {e}"})

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n\n" + "=" * 60)
print("  VIREON VEGETATION — GENERATION SUMMARY")
print("=" * 60)
all_ok = True
for r in results:
    ok = r["status"] == "OK" and r["size"] > 0
    if not ok:
        all_ok = False
    label = f"OK ({r['size']:,} bytes)" if ok else r["status"]
    print(f"  {'OK' if ok else 'FAIL'}  {r['name']:<34}  {label}")

print(f"\nOutput: {OUT_DIR}")
print("=" * 60)
sys.exit(0 if all_ok else 1)
