# Vegetation Asset Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate 6 low-poly alien vegetation GLBs via Blender Python CLI for RTS map decoration — no runtime integration.

**Architecture:** Single Blender Python script (`tools/blender/vegetation/generate_vegetation_assets.py`) with central material definitions, helper geometry functions, and one export function per asset. Run headlessly via Blender 4.0.2. Output to `Vegetation/output/`. QA report generated post-run.

**Tech Stack:** Blender 4.0.2 (`/Applications/Blender.app/Contents/MacOS/blender`), `bpy`, `bmesh`, Python 3.11 (bundled with Blender), GLB/glTF export.

---

## File Map

| Action | Path |
|--------|------|
| Create | `tools/blender/vegetation/generate_vegetation_assets.py` |
| Create | `Vegetation/output/` (directory, gitignored large files) |
| Create | `VEGETATION_ASSET_QA.md` |
| Create | `docs/vegetation-assets.md` |
| Update | `HANDOFF.md` (brief entry at bottom) |
| No touch | `src/` — zero changes |
| No touch | Terrain, gameplay, balance, combat, buildings, VFX |

**Generated GLBs** (all in `Vegetation/output/`):
1. `alien_mushroom_tree.glb`
2. `alien_mushroom_cluster.glb`
3. `alien_spore_bush.glb`
4. `alien_crystal_fern.glb`
5. `alien_biolume_reed.glb`
6. `alien_pod_shrub.glb`

---

## Task 1: Create Directory Structure

**Files:**
- Create: `tools/blender/vegetation/` (directory)
- Create: `Vegetation/output/` (directory)

- [ ] **Step 1: Create output and script directories**

```bash
mkdir -p "/Users/yorkvonloew/Documents/Claude/Vireon Front/tools/blender/vegetation"
mkdir -p "/Users/yorkvonloew/Documents/Claude/Vireon Front/Vegetation/output"
```

- [ ] **Step 2: Verify directories exist**

```bash
ls "/Users/yorkvonloew/Documents/Claude/Vireon Front/tools/blender/vegetation"
ls "/Users/yorkvonloew/Documents/Claude/Vireon Front/Vegetation/output"
```

Expected: both directories accessible (empty is fine).

---

## Task 2: Write the Blender Python Script

**Files:**
- Create: `tools/blender/vegetation/generate_vegetation_assets.py`

This is the main deliverable. The script must:
- Run in Blender 4.0.2 headless mode
- Define 4 core materials + optional accents centrally
- Include helper functions for geometry primitives
- Generate and export all 6 assets sequentially
- Log file paths and sizes to console
- Run a post-generation validation check

- [ ] **Step 1: Write the full script**

Write `tools/blender/vegetation/generate_vegetation_assets.py` with the following structure:

```python
"""
Vireon Front — Alien Vegetation Asset Generator
================================================
Generates 6 low-poly alien vegetation GLBs for RTS map decoration.

Run headlessly:
  /Applications/Blender.app/Contents/MacOS/blender --background \
    --python tools/blender/vegetation/generate_vegetation_assets.py

Output: Vegetation/output/<asset_name>.glb
"""

import bpy
import bmesh
import math
import os
import sys

# ── Output directory ─────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))
OUT_DIR = os.path.join(PROJECT_ROOT, "Vegetation", "output")
os.makedirs(OUT_DIR, exist_ok=True)

# ── Colours (linear RGB, converted from sRGB hex) ────────────────────────────
# Use srgb_to_linear() helper — Blender 4.x expects linear in node inputs.
def srgb(r, g, b):
    """Convert 0-255 sRGB integers to linear float tuple for Blender."""
    def c(x):
        x /= 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), 1.0)

COL_STEM       = srgb(224, 255, 255)   # #E0FFFF  pale cyan-white
COL_CAP_TOP    = srgb(  0, 206, 209)   # #00CED1  deep turquoise
COL_CAP_RIM    = srgb(186,  85, 211)   # #BA55D3  violet-magenta
COL_SPORE      = srgb(  0, 255, 255)   # #00FFFF  pure cyan
COL_DARK_BASE  = srgb( 10,  20,  30)   # near-black organic base
COL_CRYSTAL_AQ = srgb(  0, 180, 200)   # aqua crystal
COL_CRYSTAL_VI = srgb(120,  60, 180)   # violet crystal
COL_VEIN       = srgb(  0, 240, 220)   # emissive vein

# ── Material factory ─────────────────────────────────────────────────────────
def _make_material(name, base_color, emit_color=None, emit_strength=0.0, roughness=0.5):
    """Create or retrieve a Principled BSDF material."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out  = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value    = base_color
    bsdf.inputs["Roughness"].default_value     = roughness
    if emit_color and emit_strength > 0:
        bsdf.inputs["Emission Color"].default_value    = emit_color
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat

def _setup_materials():
    _make_material("MAT_Glowing_Stem",           COL_STEM,    COL_STEM,    1.5, 0.15)
    _make_material("MAT_Mushroom_Cap_Turquoise", COL_CAP_TOP, None,        0.0, 0.7)
    _make_material("MAT_Mushroom_Cap_Violet_Rim",COL_CAP_RIM, None,        0.0, 0.65)
    _make_material("MAT_Spore_Glow",             COL_SPORE,   COL_SPORE,   4.0, 0.1)
    _make_material("MAT_Alien_Dark_Base",        COL_DARK_BASE,None,       0.0, 0.9)
    _make_material("MAT_Crystal_Aqua",           COL_CRYSTAL_AQ,COL_CRYSTAL_AQ,0.6,0.2)
    _make_material("MAT_Crystal_Violet",         COL_CRYSTAL_VI,COL_CRYSTAL_VI,0.3,0.25)
    _make_material("MAT_Emissive_Veins",         COL_VEIN,    COL_VEIN,    2.0, 0.3)

# ── Scene helpers ─────────────────────────────────────────────────────────────
def _clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for b in list(block):
            if b.users == 0:
                block.remove(b)

def _set_active(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)

def _apply_transform(obj):
    bpy.ops.object.select_all(action="DESELECT")
    _set_active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

def _assign_mat(obj, mat_name):
    mat = bpy.data.materials.get(mat_name)
    if mat:
        if len(obj.data.materials) == 0:
            obj.data.materials.append(mat)
        else:
            obj.data.materials[0] = mat

def _shade_smooth(obj):
    bpy.ops.object.select_all(action="DESELECT")
    _set_active(obj)
    bpy.ops.object.shade_smooth()

def _set_origin_to_bottom_center(obj):
    """Move origin to the bottom-center of the object's bounding box, then place at world (0,0,0)."""
    bpy.ops.object.select_all(action="DESELECT")
    _set_active(obj)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    # Shift so bottom = 0
    bb = obj.bound_box
    min_z = min(v[2] for v in bb) * obj.scale.z + obj.location.z
    obj.location.z -= min_z
    _apply_transform(obj)
    # Now origin is at geometry center; move to bottom
    bpy.ops.object.select_all(action="DESELECT")
    _set_active(obj)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    # origin is now at bbox center — shift origin DOWN by half height
    bpy.context.scene.cursor.location = (0, 0, 0)
    # Use cursor at base
    bb = obj.bound_box
    min_z = min(v[2] for v in bb)
    bpy.context.scene.cursor.location = (0.0, 0.0, min_z + obj.location.z)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    obj.location = (0.0, 0.0, 0.0)
    _apply_transform(obj)

# ── Geometry primitives ───────────────────────────────────────────────────────
def _tapered_cylinder(name, radius_bottom, radius_top, height, verts=8, location=(0,0,0)):
    """Tapered cylinder (stem). Returns object."""
    mesh = bpy.data.meshes.new(name)
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    segs = verts
    # Bottom ring
    for i in range(segs):
        a = 2 * math.pi * i / segs
        bm.verts.new((radius_bottom * math.cos(a) + location[0],
                      radius_bottom * math.sin(a) + location[1],
                      location[2]))
    # Top ring
    for i in range(segs):
        a = 2 * math.pi * i / segs
        bm.verts.new((radius_top * math.cos(a) + location[0],
                      radius_top * math.sin(a) + location[1],
                      location[2] + height))
    bm.verts.ensure_lookup_table()
    # Side faces
    for i in range(segs):
        ni = (i + 1) % segs
        bm.faces.new([bm.verts[i], bm.verts[ni],
                      bm.verts[segs + ni], bm.verts[segs + i]])
    # Cap bottom
    bm.faces.new(list(reversed([bm.verts[i] for i in range(segs)])))
    # Cap top
    bm.faces.new([bm.verts[segs + i] for i in range(segs)])
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj

def _low_poly_sphere(name, radius=0.3, subdivs=1, location=(0,0,0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivs, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj

def _uv_sphere_half(name, radius=1.0, segments=12, rings=4, location=(0,0,0), flip=False):
    """Half UV sphere (dome for cap). flip=True gives bottom half."""
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings*2,
                                          radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    # Remove vertices below (or above) equator
    thresh = 0.0
    to_del = [v for v in bm.verts if (v.co.z < thresh if not flip else v.co.z > thresh)]
    bmesh.ops.delete(bm, geom=to_del, context="VERTS")
    bm.to_mesh(me)
    bm.free()
    me.update()
    return obj

def _flat_disc(name, radius=1.0, verts=12, location=(0,0,0)):
    bpy.ops.mesh.primitive_circle_add(vertices=verts, radius=radius,
                                       fill_type="NGON", location=location)
    obj = bpy.context.active_object
    obj.name = name
    return obj

def _crystal_prism(name, radius=0.1, height=0.5, verts=5, location=(0,0,0)):
    """Faceted prism — elongated crystal blade."""
    mesh = bpy.data.meshes.new(name)
    obj  = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    for i in range(verts):
        a = 2 * math.pi * i / verts
        bm.verts.new((radius * math.cos(a) + location[0],
                      radius * math.sin(a) + location[1],
                      location[2]))
    tip = bm.verts.new((location[0], location[1], location[2] + height))
    bm.verts.ensure_lookup_table()
    for i in range(verts):
        ni = (i + 1) % verts
        bm.faces.new([bm.verts[i], bm.verts[ni], tip])
    bm.faces.new(list(reversed([bm.verts[i] for i in range(verts)])))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj

def _join_objects(objects):
    """Join list of objects into the first one. Returns joined object."""
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    return bpy.context.active_object

def _export_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=False,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_apply=True,
    )
    size = os.path.getsize(filepath) if os.path.exists(filepath) else 0
    print(f"[EXPORTED] {filepath}  ({size:,} bytes)")
    return size

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 1 — alien_mushroom_tree
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_mushroom_tree():
    _clear_scene()
    _setup_materials()

    # Stem: tall tapered cylinder, smooth shaded
    stem = _tapered_cylinder("stem", radius_bottom=0.12, radius_top=0.045,
                              height=2.2, verts=10, location=(0, 0, 0))
    _assign_mat(stem, "MAT_Glowing_Stem")
    _shade_smooth(stem)

    # Cap top (turquoise upper dome)
    cap_top = _uv_sphere_half("cap_top", radius=0.75, segments=14, rings=4,
                               location=(0, 0, 2.2), flip=False)
    cap_top.scale.z = 0.38
    _apply_transform(cap_top)
    _assign_mat(cap_top, "MAT_Mushroom_Cap_Turquoise")

    # Cap rim (violet lower flat cone ring — represents underside/rim)
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.82, radius2=0.35,
                                     depth=0.18, location=(0, 0, 2.05))
    cap_rim = bpy.context.active_object
    cap_rim.name = "cap_rim"
    _assign_mat(cap_rim, "MAT_Mushroom_Cap_Violet_Rim")

    # Spore pods under cap rim — 4 glowing icospheres
    pods = []
    for i in range(4):
        angle = 2 * math.pi * i / 4
        px = 0.6 * math.cos(angle)
        py = 0.6 * math.sin(angle)
        pod = _low_poly_sphere(f"pod_{i}", radius=0.07, subdivs=1,
                                location=(px, py, 2.02))
        _assign_mat(pod, "MAT_Spore_Glow")
        pods.append(pod)

    all_parts = [stem, cap_top, cap_rim] + pods
    joined = _join_objects(all_parts)
    joined.name = "alien_mushroom_tree"
    _set_origin_to_bottom_center(joined)
    return joined

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 2 — alien_mushroom_cluster
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_mushroom_cluster():
    _clear_scene()
    _setup_materials()
    import random
    rng = random.Random(42)

    configs = [
        (0.0,   0.0,  1.0,  0.08, 0.03,  0.55),
        (0.45,  0.2,  0.72, 0.06, 0.025, 0.42),
        (-0.4,  0.3,  0.85, 0.07, 0.028, 0.50),
        (0.15, -0.5,  0.6,  0.055,0.022, 0.38),
        (-0.2, -0.35, 0.5,  0.05, 0.02,  0.32),
    ]

    all_parts = []
    for idx, (ox, oy, h, rb, rt, cr) in enumerate(configs):
        stem = _tapered_cylinder(f"stem_{idx}", radius_bottom=rb, radius_top=rt,
                                  height=h, verts=8, location=(ox, oy, 0))
        _assign_mat(stem, "MAT_Glowing_Stem")
        _shade_smooth(stem)

        bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=cr + 0.05, radius2=cr * 0.4,
                                         depth=cr * 0.55, location=(ox, oy, h))
        cap = bpy.context.active_object
        cap.name = f"cap_{idx}"
        _assign_mat(cap, "MAT_Mushroom_Cap_Turquoise" if idx % 2 == 0 else "MAT_Mushroom_Cap_Violet_Rim")

        # 2 spore pods per tree
        for si in range(2):
            a = 2 * math.pi * si / 2 + rng.random() * 0.5
            pod = _low_poly_sphere(f"pod_{idx}_{si}", radius=0.04, subdivs=1,
                                    location=(ox + cr * 0.75 * math.cos(a),
                                              oy + cr * 0.75 * math.sin(a),
                                              h - cr * 0.1))
            _assign_mat(pod, "MAT_Spore_Glow")
            all_parts.append(pod)

        all_parts += [stem, cap]

    joined = _join_objects(all_parts)
    joined.name = "alien_mushroom_cluster"
    _set_origin_to_bottom_center(joined)
    return joined

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 3 — alien_spore_bush
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_spore_bush():
    _clear_scene()
    _setup_materials()

    all_parts = []
    # Base mound
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.4, location=(0, 0, 0.2))
    base = bpy.context.active_object
    base.name = "bush_base"
    base.scale.z = 0.5
    _apply_transform(base)
    _assign_mat(base, "MAT_Alien_Dark_Base")
    all_parts.append(base)

    # Short curved stems (tapered cylinders at angles)
    stem_configs = [
        (0.0,  0.0, 0.0,   0.35,  0.0),
        (0.25, 0.1, 0.2,   0.30, 15.0),
        (-0.2, 0.15,-0.1,  0.28, -12.0),
        (0.1, -0.25, 0.1,  0.32, 10.0),
        (-0.15,-0.2, -0.2, 0.25, -8.0),
    ]
    for i, (ox, oy, oz, h, tilt_deg) in enumerate(stem_configs):
        s = _tapered_cylinder(f"bstem_{i}", 0.055, 0.02, h, verts=6,
                               location=(ox, oy, oz))
        s.rotation_euler.x = math.radians(tilt_deg)
        _apply_transform(s)
        _assign_mat(s, "MAT_Glowing_Stem")
        _shade_smooth(s)
        all_parts.append(s)
        # pod at tip
        tip_z = oz + h * math.cos(math.radians(abs(tilt_deg)))
        pod = _low_poly_sphere(f"bpod_{i}", radius=0.07, subdivs=1,
                                location=(ox, oy, tip_z))
        _assign_mat(pod, "MAT_Spore_Glow")
        all_parts.append(pod)

    joined = _join_objects(all_parts)
    joined.name = "alien_spore_bush"
    _set_origin_to_bottom_center(joined)
    return joined

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 4 — alien_crystal_fern
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_crystal_fern():
    _clear_scene()
    _setup_materials()

    all_parts = []
    # Base stub
    base = _tapered_cylinder("fern_base", 0.08, 0.04, 0.15, verts=6, location=(0,0,0))
    _assign_mat(base, "MAT_Alien_Dark_Base")
    all_parts.append(base)

    # Crystal blades radiating upward
    blade_configs = [
        (0.0,  0.0,  0.15, 0.55, 0.0,  -30),
        (0.08, 0.0,  0.12, 0.50, 0.0,  -40),
        (-0.06,0.05, 0.12, 0.45, 30.0, -38),
        (0.05, -0.06,0.12, 0.48, -25.0,-35),
        (0.12, 0.08, 0.10, 0.42, 15.0, -50),
        (-0.10,-0.06,0.10, 0.40, -20.0,-45),
        (0.0,  0.12, 0.12, 0.52, 45.0, -32),
        (-0.12, 0.0, 0.10, 0.44, -50.0,-40),
    ]
    for i, (ox, oy, oz, h, rot_z, tilt_x) in enumerate(blade_configs):
        blade = _crystal_prism(f"blade_{i}", radius=0.04, height=h, verts=4,
                                location=(ox, oy, oz))
        blade.rotation_euler.z = math.radians(rot_z)
        blade.rotation_euler.x = math.radians(tilt_x)
        _apply_transform(blade)
        mat = "MAT_Crystal_Aqua" if i % 3 != 2 else "MAT_Crystal_Violet"
        _assign_mat(blade, mat)
        all_parts.append(blade)

    # Small emissive vein nodes
    for i in range(4):
        a = 2 * math.pi * i / 4
        node = _low_poly_sphere(f"vein_{i}", radius=0.03, subdivs=1,
                                 location=(0.1 * math.cos(a), 0.1 * math.sin(a), 0.25))
        _assign_mat(node, "MAT_Emissive_Veins")
        all_parts.append(node)

    joined = _join_objects(all_parts)
    joined.name = "alien_crystal_fern"
    _set_origin_to_bottom_center(joined)
    return joined

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 5 — alien_biolume_reed
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_biolume_reed():
    _clear_scene()
    _setup_materials()

    all_parts = []
    reed_configs = [
        (0.0,   0.0,  1.8, 0.0),
        (0.12, -0.05, 1.6, 5.0),
        (-0.1,  0.1,  2.0, -4.0),
        (0.22,  0.15, 1.5, 8.0),
        (-0.18,-0.12, 1.7, -6.0),
        (0.08,  0.25, 1.9, 3.0),
    ]
    for i, (ox, oy, h, tilt) in enumerate(reed_configs):
        reed = _tapered_cylinder(f"reed_{i}", radius_bottom=0.03, radius_top=0.008,
                                  height=h, verts=6, location=(ox, oy, 0))
        reed.rotation_euler.x = math.radians(tilt)
        _apply_transform(reed)
        _assign_mat(reed, "MAT_Glowing_Stem")
        _shade_smooth(reed)
        all_parts.append(reed)

        # Glowing tip
        tip_z = h * math.cos(math.radians(abs(tilt)))
        tip = _low_poly_sphere(f"rtip_{i}", radius=0.045, subdivs=1,
                                location=(ox, oy, tip_z))
        _assign_mat(tip, "MAT_Spore_Glow")
        all_parts.append(tip)

    # Small base cluster of dark base nodes
    base = _tapered_cylinder("reed_base", 0.15, 0.08, 0.06, verts=8, location=(0,0,0))
    _assign_mat(base, "MAT_Alien_Dark_Base")
    all_parts.append(base)

    joined = _join_objects(all_parts)
    joined.name = "alien_biolume_reed"
    _set_origin_to_bottom_center(joined)
    return joined

# ═══════════════════════════════════════════════════════════════════════════════
# ASSET 6 — alien_pod_shrub
# ═══════════════════════════════════════════════════════════════════════════════
def build_alien_pod_shrub():
    _clear_scene()
    _setup_materials()

    all_parts = []
    # Central dark organic mass
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.35, location=(0, 0, 0.3))
    core = bpy.context.active_object
    core.name = "pod_core"
    core.scale = (1.0, 1.0, 0.8)
    _apply_transform(core)
    _assign_mat(core, "MAT_Alien_Dark_Base")
    all_parts.append(core)

    # Bulbous spore pods protruding from core
    pod_configs = [
        (0.3,  0.0,  0.4,  0.14),
        (-0.3, 0.1,  0.35, 0.13),
        (0.1,  0.35, 0.38, 0.12),
        (-0.1,-0.35, 0.32, 0.13),
        (0.25, 0.25, 0.5,  0.11),
        (-0.25,-0.2, 0.45, 0.12),
    ]
    for i, (ox, oy, oz, r) in enumerate(pod_configs):
        pod = _low_poly_sphere(f"shrub_pod_{i}", radius=r, subdivs=2, location=(ox, oy, oz))
        _assign_mat(pod, "MAT_Mushroom_Cap_Turquoise" if i % 3 != 0 else "MAT_Mushroom_Cap_Violet_Rim")
        all_parts.append(pod)

    # Small cyan emissive dots on pods
    for i in range(4):
        a = 2 * math.pi * i / 4
        glow = _low_poly_sphere(f"shrub_glow_{i}", radius=0.04, subdivs=1,
                                 location=(0.28 * math.cos(a), 0.28 * math.sin(a), 0.55))
        _assign_mat(glow, "MAT_Spore_Glow")
        all_parts.append(glow)

    # Short stem stubs around base
    for i in range(5):
        a = 2 * math.pi * i / 5
        sx, sy = 0.18 * math.cos(a), 0.18 * math.sin(a)
        stub = _tapered_cylinder(f"stub_{i}", 0.04, 0.015, 0.22, verts=5,
                                  location=(sx, sy, 0))
        stub.rotation_euler.x = math.radians(20)
        stub.rotation_euler.z = math.radians(a * 57.3)
        _apply_transform(stub)
        _assign_mat(stub, "MAT_Glowing_Stem")
        all_parts.append(stub)

    joined = _join_objects(all_parts)
    joined.name = "alien_pod_shrub"
    _set_origin_to_bottom_center(joined)
    return joined

# ══════════════════════════════════════════════════════════════════════════════
# MAIN — generate all assets
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
        size = _export_glb(out_path)
        results.append({"name": asset_name, "path": out_path, "size": size, "status": "OK"})
    except Exception as e:
        print(f"[ERROR] {asset_name}: {e}")
        import traceback; traceback.print_exc()
        results.append({"name": asset_name, "path": "", "size": 0, "status": f"FAILED: {e}"})

# Post-generation summary
print("\n\n" + "="*60)
print("  GENERATION SUMMARY")
print("="*60)
all_ok = True
for r in results:
    ok = r["status"] == "OK" and r["size"] > 0
    if not ok:
        all_ok = False
    status_str = f"OK ({r['size']:,} bytes)" if ok else r["status"]
    print(f"  {'✓' if ok else '✗'}  {r['name']:<32} {status_str}")

print("\nOutput dir:", OUT_DIR)
sys.exit(0 if all_ok else 1)
```

- [ ] **Step 2: Verify the file was written**

```bash
wc -l "/Users/yorkvonloew/Documents/Claude/Vireon Front/tools/blender/vegetation/generate_vegetation_assets.py"
```

Expected: >200 lines.

---

## Task 3: Run Blender Headlessly to Generate GLBs

**Files:**
- Creates: `Vegetation/output/*.glb` (6 files)

- [ ] **Step 1: Run Blender headlessly**

```bash
cd "/Users/yorkvonloew/Documents/Claude/Vireon Front" && \
/Applications/Blender.app/Contents/MacOS/blender --background \
  --python tools/blender/vegetation/generate_vegetation_assets.py 2>&1 | tail -60
```

Expected output includes:
- `[EXPORTED] .../alien_mushroom_tree.glb  (... bytes)` for all 6 assets
- `GENERATION SUMMARY` section
- 6 lines with `✓`
- Exit code 0

- [ ] **Step 2: Verify all 6 GLBs exist and are non-empty**

```bash
ls -lh "/Users/yorkvonloew/Documents/Claude/Vireon Front/Vegetation/output/"
```

Expected: 6 `.glb` files, each >5 KB.

- [ ] **Step 3: If any asset failed — debug**

Read the error output. Common issues:
- `bpy.ops.object.join()` requires at least 2 selected objects — check `_join_objects` receives non-empty list
- `origin_set` on empty selection — ensure object is selected before calling
- Blender 4.x `Emission` input name — use `"Emission Color"` and `"Emission Strength"` (not `"Emission"`)
- Adjust and re-run

---

## Task 4: Write QA Report

**Files:**
- Create: `VEGETATION_ASSET_QA.md`

- [ ] **Step 1: Collect file sizes and dimensions**

```bash
ls -lh "/Users/yorkvonloew/Documents/Claude/Vireon Front/Vegetation/output/"
```

- [ ] **Step 2: Write VEGETATION_ASSET_QA.md**

Write at project root with:
- Asset name, file path, file size
- Approximate dimensions (described from script knowledge)
- Material names assigned
- Emissive materials: YES/NO
- Origin bottom-center: OK
- Poly style: low-poly
- RTS readability assessment
- Status: OK / WARNING / FAILED

---

## Task 5: Write Documentation

**Files:**
- Create: `docs/vegetation-assets.md`
- Update: `HANDOFF.md`

- [ ] **Step 1: Write docs/vegetation-assets.md**

Include:
1. Why GLB over PNG
2. List of 6 assets with path, size, materials
3. Biom/faction inspiration per asset
4. Recommended use (scatter/landmark/rare)
5. How to regenerate: `blender --background --python tools/blender/vegetation/generate_vegetation_assets.py`
6. Next step: vegetation placement integration (separate phase, not started)

- [ ] **Step 2: Add brief entry to HANDOFF.md**

At the bottom of the "Was zuletzt fertig wurde" section, add:

```
**Vegetation GLB Generation (2026-06-18):** 6 low-poly alien vegetation GLBs erzeugt via Blender Python.
Assets in `Vegetation/output/`. Script: `tools/blender/vegetation/generate_vegetation_assets.py`.
QA-Report: `VEGETATION_ASSET_QA.md`. Docs: `docs/vegetation-assets.md`.
Kein `src/`-Change. Keine Runtime-Integration. Nächster Schritt: Placement-Phase separat.
```

---

## Task 6: Verify No src/ Changes

- [ ] **Step 1: Run git diff on src/**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" diff -- src/
```

Expected: **empty output** (no src/ changes).

- [ ] **Step 2: Confirm existing tests still pass**

Since this is docs/assets/tooling only and no src/ was changed, full test run is optional.
If `src/` is clean, confirm: "docs/assets/tooling-only — no typecheck or test run required."

---

## Task 7: Commit and Push

- [ ] **Step 1: Check git status**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" status --short
```

Do NOT stage `public/assets/vehicles/blue_lightTank.*` files.

- [ ] **Step 2: Stage new files only**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" add \
  tools/blender/vegetation/generate_vegetation_assets.py \
  Vegetation/output/ \
  VEGETATION_ASSET_QA.md \
  docs/vegetation-assets.md \
  HANDOFF.md
```

- [ ] **Step 3: Commit**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" commit -m "$(cat <<'EOF'
feat(vegetation): generate low-poly alien vegetation assets

- 6 alien vegetation GLBs generated via Blender 4.0.2 Python headlessly
- alien_mushroom_tree, alien_mushroom_cluster, alien_spore_bush,
  alien_crystal_fern, alien_biolume_reed, alien_pod_shrub
- Script: tools/blender/vegetation/generate_vegetation_assets.py
- QA report: VEGETATION_ASSET_QA.md
- Docs: docs/vegetation-assets.md
- No src/ changes. No runtime integration.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Push**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" push origin main
```

- [ ] **Step 5: Confirm commit hash**

```bash
git -C "/Users/yorkvonloew/Documents/Claude/Vireon Front" log --oneline -3
```

---

## Final Reporting Checklist

After completion, report:
1. Git status / commit hash
2. Confirmation last push is on origin/main
3. Blender version used
4. All 6 GLBs generated: YES/NO
5. File size per GLB
6. Approximate dimensions per GLB
7. Whether preview images were generated
8. Confirmation all assets are real 3D geometry (not flat)
9. Confirmation no external textures
10. Confirmation `src/` is unchanged
11. Confirmation `docs/vegetation-assets.md` exists
12. Confirmation `HANDOFF.md` updated
13. Commit hash
14. Any open warnings or risks
