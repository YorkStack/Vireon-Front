"""Generate low-poly fractured rock variants as GLB for Vireon Front.

Run inside Blender (via the MCP `execute_blender_code`, or `blender --background
--python tools/blender/rocks.py`). Produces N single-mesh, single-material rocks
with baked ambient occlusion in a vertex-color attribute (COLOR_0), exported to
public/assets/terrain/rock/rock_0N.glb.

Design (matches docs/superpowers/specs/2026-06-14-environment-assets-design.md):
- chunky low-poly silhouette (~150-400 tris), faceted "broken stone" look
- ONE closed mesh, ONE material  -> InstancedMesh-compatible
- smooth shading with auto-smooth so sharp fracture edges survive
- AO baked into vertex colors via `vertex_color_dirt` (no UV / texture bake)
- in-engine the game applies its own triplanar material; the GLB carries only
  geometry + vertex-color AO.

The script is deliberately defensive about Blender API differences (3.x vs 4.x).
"""
import bpy
import bmesh
import math
import os
import random

# Absolute output dir (Blender runs as a separate process; relative paths are
# unreliable). Override via the VIREON_ROCK_OUT env var if the repo moves.
OUT_DIR = os.environ.get(
    "VIREON_ROCK_OUT",
    "/Users/yorkvonloew/Documents/Claude/Vireon Front/public/assets/terrain/rock",
)
N_ROCKS = 5
TARGET_TRIS = 140  # decimate target; low-poly background props (perf budget)
AO_FLOOR = 0.5     # lift baked AO so cavities darken but never go black


def _clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials):
        for b in list(block):
            if b.users == 0:
                block.remove(b)


def _make_rock(seed: int):
    rng = random.Random(seed)
    # Start from a cube, subdivide, then push vertices along their normals by
    # layered noise -> a lumpy boulder. Decimate (planar) gives flat facets.
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    obj = bpy.context.active_object
    obj.name = f"rock_{seed:02d}"

    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for _ in range(2):
        bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=2, use_grid_fill=True)
    bm.normal_update()
    for v in bm.verts:
        n = v.normal
        # layered value-ish noise from position
        d = 0.0
        for f, a in ((1.7, 0.30), (3.3, 0.16), (6.1, 0.09)):
            d += a * math.sin(v.co.x * f + seed) * math.cos(v.co.y * f - seed) * math.sin(v.co.z * f + seed * 2)
        jitter = (rng.random() - 0.5) * 0.10
        v.co += n * (d + jitter)
    bm.to_mesh(me)
    bm.free()

    # Non-uniform base shape so variants differ; keep it boulder-ish.
    obj.scale = (
        0.8 + rng.random() * 0.6,
        0.6 + rng.random() * 0.5,
        0.8 + rng.random() * 0.6,
    )
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Decimate to a low-poly faceted form.
    dec = obj.modifiers.new("Decimate", type="DECIMATE")
    dec.decimate_type = "DISSOLVE"  # planar dissolve -> flat broken-stone facets
    dec.angle_limit = math.radians(18)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    # Triangulate so the export mesh is clean and within budget.
    tri = obj.modifiers.new("Triangulate", type="TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=tri.name)
    if len(obj.data.polygons) > TARGET_TRIS:
        dec2 = obj.modifiers.new("Decimate2", type="DECIMATE")
        dec2.decimate_type = "COLLAPSE"
        dec2.ratio = TARGET_TRIS / max(1, len(obj.data.polygons))
        bpy.ops.object.modifier_apply(modifier=dec2.name)

    # Smooth shading + auto-smooth (keep sharp fracture edges). API differs by
    # version: try the operator's auto-smooth args, then fall back.
    try:
        bpy.ops.object.shade_smooth(use_auto_smooth=True, auto_smooth_angle=math.radians(35))
    except TypeError:
        bpy.ops.object.shade_smooth()
        if hasattr(obj.data, "use_auto_smooth"):
            obj.data.use_auto_smooth = True
            obj.data.auto_smooth_angle = math.radians(35)

    # Single material.
    mat = bpy.data.materials.new(f"rock_mat_{seed:02d}")
    mat.diffuse_color = (0.55, 0.53, 0.6, 1.0)
    obj.data.materials.clear()
    obj.data.materials.append(mat)

    # AO into a color attribute (COLOR_0 on export). Create the attribute, make
    # it active, then bake cavities/contact darkening with vertex_color_dirt.
    me = obj.data
    # remove any stray color attrs, add a fresh one
    while me.color_attributes:
        me.color_attributes.remove(me.color_attributes[0])
    me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.paint.vertex_color_dirt(dirt_angle=math.radians(90), clean_angle=math.radians(90), dirt_only=False)
    except Exception as e:  # noqa: BLE001 - keep going even if the op is unavailable
        print(f"vertex_color_dirt failed ({e}); leaving flat vertex colors")
    # Lift the baked AO toward white so cavities read as gentle darkening, not
    # near-black (the in-engine material multiplies this in).
    ca = obj.data.color_attributes.get("Col")
    if ca:
        for d in ca.data:
            c = d.color
            d.color = (
                AO_FLOOR + (1.0 - AO_FLOOR) * c[0],
                AO_FLOOR + (1.0 - AO_FLOOR) * c[1],
                AO_FLOOR + (1.0 - AO_FLOOR) * c[2],
                c[3],
            )

    # Center origin to geometry, sit base near y=0 in +Y-up export space.
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    return obj


def _export(obj, path):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    kwargs = dict(filepath=path, export_format="GLB", use_selection=True, export_yup=True)
    # Vertex-color export flag name changed across versions.
    try:
        bpy.ops.export_scene.gltf(export_vertex_color="ACTIVE", **kwargs)
    except TypeError:
        try:
            bpy.ops.export_scene.gltf(export_colors=True, **kwargs)
        except TypeError:
            bpy.ops.export_scene.gltf(**kwargs)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    _clear_scene()
    made = []
    for i in range(1, N_ROCKS + 1):
        _clear_scene()
        obj = _make_rock(seed=i)
        path = os.path.join(OUT_DIR, f"rock_{i:02d}.glb")
        _export(obj, path)
        made.append({"file": path, "tris": len(obj.data.polygons), "has_color": bool(obj.data.color_attributes)})
    print("ROCKS_DONE", made)
    return made


result = main()
