// GLB inspection — dependency-light parser for the Building Asset Approval Viewer
// and the QA report. Reads ONLY the glTF JSON chunk of a .glb container, so it
// works both in the browser (fetch → ArrayBuffer) and in Node (fs → Buffer). It
// renders nothing and touches no gameplay state — pure analysis.

/** Minimal glTF JSON shape we read (everything optional/loose on purpose). */
export interface GltfJson {
  meshes?: { primitives?: { material?: number }[] }[];
  materials?: GltfMaterial[];
  textures?: unknown[];
  images?: { uri?: string }[];
  nodes?: { name?: string; children?: number[]; mesh?: number }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
}
interface GltfMaterial {
  name?: string;
  alphaMode?: 'OPAQUE' | 'MASK' | 'BLEND';
  emissiveFactor?: [number, number, number];
  emissiveTexture?: unknown;
  normalTexture?: unknown;
  occlusionTexture?: unknown;
  pbrMetallicRoughness?: {
    baseColorFactor?: [number, number, number, number];
    baseColorTexture?: unknown;
    metallicRoughnessTexture?: unknown;
  };
}

/** Words in a material name that hint at glass / transparent / energy surfaces. */
export const GLASS_HINT = /glass|window|crystal|transparent|canopy|lens|pane|shield|water|aqua|energy|glow|emissive|alpha|translucent|plasma|membrane|veil|shell/i;

export interface MaterialInfo {
  index: number;
  name: string;
  glassLike: boolean;
  emissive: boolean;
  transparent: boolean;
  opacity: number;
  alphaMode: string;
  hasBaseColorTex: boolean;
  hasNormalTex: boolean;
  hasMetalRoughTex: boolean;
  hasEmissiveTex: boolean;
  assignedToMesh: boolean;
}

export interface GlbReport {
  meshCount: number;
  materialCount: number;
  textureCount: number;
  imageCount: number;
  embeddedImageCount: number;
  externalImageUris: string[];
  materials: MaterialInfo[];
  meshesWithoutMaterial: number;
  unusedMaterials: string[];
  attachNodes: string[];
  namedLocators: string[];
  /** true/false if an ATTACH_turret_pivot node exists, null if there is none. */
  turretPivotHasChildren: boolean | null;
  glass: {
    found: boolean;
    assignedToMesh: boolean;
    transparent: boolean;
    hasTexture: boolean;
    materialNames: string[];
  };
}

/** Parse the glTF JSON chunk out of a binary .glb ArrayBuffer. Throws on a bad header. */
export function parseGlbJson(buffer: ArrayBuffer): GltfJson {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB (bad magic)');
  let off = 12;
  const len = dv.getUint32(off, true);
  const type = dv.getUint32(off + 4, true);
  off += 8;
  if (type !== 0x4e4f534a) throw new Error('first chunk is not JSON');
  const bytes = new Uint8Array(buffer, off, len);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as GltfJson;
}

/** Analyse a parsed glTF document into an approval-friendly report. */
export function analyzeGltf(gltf: GltfJson): GlbReport {
  const meshes = gltf.meshes ?? [];
  const materials = gltf.materials ?? [];
  const nodes = gltf.nodes ?? [];

  // Which material indices are referenced by a mesh primitive?
  const usedMat = new Set<number>();
  let meshesWithoutMaterial = 0;
  for (const m of meshes) {
    for (const p of m.primitives ?? []) {
      if (typeof p.material === 'number') usedMat.add(p.material);
      else meshesWithoutMaterial++;
    }
  }

  const materialInfos: MaterialInfo[] = materials.map((mat, i) => {
    const pbr = mat.pbrMetallicRoughness ?? {};
    const baseAlpha = pbr.baseColorFactor?.[3] ?? 1;
    const alphaMode = mat.alphaMode ?? 'OPAQUE';
    const transparent = alphaMode === 'BLEND' || alphaMode === 'MASK' || baseAlpha < 1;
    const em = mat.emissiveFactor ?? [0, 0, 0];
    const name = mat.name ?? `material_${i}`;
    return {
      index: i,
      name,
      glassLike: GLASS_HINT.test(name),
      emissive: em[0] + em[1] + em[2] > 0.01 || mat.emissiveTexture != null,
      transparent,
      opacity: baseAlpha,
      alphaMode,
      hasBaseColorTex: pbr.baseColorTexture != null,
      hasNormalTex: mat.normalTexture != null,
      hasMetalRoughTex: pbr.metallicRoughnessTexture != null,
      hasEmissiveTex: mat.emissiveTexture != null,
      assignedToMesh: usedMat.has(i),
    };
  });

  const unusedMaterials = materialInfos.filter((m) => !m.assignedToMesh).map((m) => m.name);

  const namedLocators = nodes
    .filter((n) => n.name && n.mesh == null) // empty (no mesh) named nodes = locators
    .map((n) => n.name as string);
  const attachNodes = nodes
    .map((n) => n.name)
    .filter((n): n is string => !!n && n.startsWith('ATTACH_'));

  const pivot = nodes.find((n) => n.name === 'ATTACH_turret_pivot');
  const turretPivotHasChildren = pivot ? (pivot.children?.length ?? 0) > 0 : null;

  const images = gltf.images ?? [];
  const externalImageUris = images.filter((im) => !!im.uri).map((im) => im.uri as string);

  // Glass-like = by NAME (GLASS_HINT) OR by BEHAVIOUR (actually transparent /
  // alpha-enabled). The asset pipeline sometimes uses opaque code names (e.g. "AB")
  // for a transparent panel, so we must not rely on names alone.
  const glassMats = materialInfos.filter((m) => m.glassLike || m.transparent);
  const glass = {
    found: glassMats.length > 0,
    assignedToMesh: glassMats.some((m) => m.assignedToMesh),
    transparent: glassMats.some((m) => m.transparent),
    hasTexture: glassMats.some((m) => m.hasBaseColorTex || m.hasEmissiveTex || m.hasNormalTex),
    materialNames: glassMats.map((m) => m.name),
  };

  return {
    meshCount: meshes.length,
    materialCount: materials.length,
    textureCount: (gltf.textures ?? []).length,
    imageCount: images.length,
    embeddedImageCount: images.filter((im) => !im.uri).length,
    externalImageUris,
    materials: materialInfos,
    meshesWithoutMaterial,
    unusedMaterials,
    attachNodes,
    namedLocators,
    turretPivotHasChildren,
    glass,
  };
}

/** Convenience: GLB ArrayBuffer → report. */
export function inspectGlb(buffer: ArrayBuffer): GlbReport {
  return analyzeGltf(parseGlbJson(buffer));
}
