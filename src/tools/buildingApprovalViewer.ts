// Building Asset Approval Viewer (DEV-ONLY). A standalone page that renders each
// registered building GLB in a neutral scene with orbit controls, shows a metadata
// + glass/material inspection panel, and a per-asset approval checklist that
// defaults to PENDING. It imports NO gameplay/runtime code paths and never mutates
// ACTIVE_ASSET_ROLES, buildings.json, or any balance value.
//
// Open at:  http://localhost:5180/building_asset_approval.html  (npm run dev)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  APPROVAL_ASSETS, APPROVAL_FACTIONS, APPROVAL_CHECKLIST_ITEMS,
  approvalAssetsForFaction, defaultApprovalRecord,
  type ApprovalAsset, type ApprovalStatus, type ApprovalChecklistItem,
} from './buildingApprovalRegistry';
import { inspectGlb, type GlbReport } from './glbInspect';
import type { FactionId } from '../data/factionModifiers';

const FACTION_COLOR: Record<FactionId, string> = { red: '#ff5c4d', blue: '#39c6ff', green: '#49e85d', yellow: '#ffc24d' };

// ── Persistence: reviewer convenience only (localStorage), NEVER gameplay config ──
const STORE = 'vireon.buildingApproval';
type Saved = Record<string, { status: ApprovalStatus; checklist: Record<string, boolean> }>;
function loadSaved(): Saved { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function record(assetKey: string) {
  const all = loadSaved();
  if (!all[assetKey]) all[assetKey] = defaultApprovalRecord(APPROVAL_ASSETS.find(a => a.assetKey === assetKey)!);
  return all[assetKey];
}
function save(assetKey: string, rec: { status: ApprovalStatus; checklist: Record<string, boolean> }) {
  const all = loadSaved(); all[assetKey] = rec; localStorage.setItem(STORE, JSON.stringify(all));
}

// ── Three.js neutral preview scene ───────────────────────────────────────────
const stage = document.getElementById('stage')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#202230');
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2000);
camera.position.set(6, 5, 8);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x303040, 1.0));
const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(5, 8, 4); scene.add(key);
const fill = new THREE.DirectionalLight(0x88aaff, 0.5); fill.position.set(-6, 3, -4); scene.add(fill);
const grid = new THREE.GridHelper(20, 20, 0x44485c, 0x2c2f3d); scene.add(grid);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop); })();

let current: THREE.Object3D | null = null;
const loader = new GLTFLoader();

function frameObject(obj: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  // Centre on X/Z, then ground so the model's base sits on the grid (y=0).
  obj.position.x -= center.x;
  obj.position.z -= center.z;
  obj.position.y -= box.min.y;
  const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
  const dist = radius / Math.tan((camera.fov * Math.PI / 180) / 2) * 1.6;
  controls.target.set(0, size.y * 0.45, 0);
  camera.position.set(dist * 0.7, size.y * 0.7 + dist * 0.4, dist * 0.8);
  controls.update();
  return { size, box };
}

// ── UI building ──────────────────────────────────────────────────────────────
const facBox = document.getElementById('factions')!;
const assetBox = document.getElementById('assets')!;
const panel = document.getElementById('panel')!;
let selFaction: FactionId = 'red';
let selAsset: ApprovalAsset | null = null;

for (const f of APPROVAL_FACTIONS) {
  const b = document.createElement('button');
  b.className = 'fac'; b.textContent = f.label; b.style.setProperty('--fc', FACTION_COLOR[f.id]);
  b.addEventListener('click', () => { selFaction = f.id; renderFactions(); renderAssets(); });
  b.dataset.fid = f.id;
  facBox.appendChild(b);
}
function renderFactions() {
  facBox.querySelectorAll<HTMLElement>('.fac').forEach(b => b.classList.toggle('on', b.dataset.fid === selFaction));
}
function renderAssets() {
  assetBox.innerHTML = '';
  for (const a of approvalAssetsForFaction(selFaction)) {
    const b = document.createElement('button');
    b.className = 'asset';
    const file = a.modelPath.split('/').pop();
    const badge = a.activeInGameplay ? '<span class="badge active">active</span>' : '<span class="badge inactive">inactive</span>';
    b.innerHTML = `<strong>${a.role}</strong> ${badge}<small>${file}</small>`;
    b.addEventListener('click', () => { selAsset = a; renderAssets(); void selectAsset(a); });
    if (selAsset?.assetKey === a.assetKey) b.classList.add('on');
    assetBox.appendChild(b);
  }
}

async function selectAsset(a: ApprovalAsset) {
  panel.innerHTML = `<div class="dim">Loading ${a.modelPath}…</div>`;
  if (current) { scene.remove(current); current = null; }
  // Fetch raw bytes for size + glass/material inspection.
  let report: GlbReport | null = null;
  let bytes = 0;
  let loadOk: boolean | 'UNKNOWN' = 'UNKNOWN';
  try {
    const buf = await fetch(a.modelPath).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); });
    bytes = buf.byteLength;
    report = inspectGlb(buf);
  } catch (e) {
    panel.innerHTML = `<div class="bad">Inspection failed: ${(e as Error).message}</div>`;
  }
  // Render the GLB.
  let dims = '';
  try {
    const gltf = await loader.loadAsync(a.modelPath);
    current = gltf.scene; scene.add(current);
    const { size } = frameObject(current);
    dims = `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
    loadOk = true;
  } catch {
    loadOk = false;
  }
  if (report) renderPanel(a, report, bytes, dims, loadOk);
}

function yn(b: boolean | null | undefined, t = 'YES', f = 'NO', u = 'UNCLEAR'): string {
  if (b === null || b === undefined) return `<span class="warn">${u}</span>`;
  return b ? `<span class="ok">${t}</span>` : `<span class="dim">${f}</span>`;
}

function renderPanel(a: ApprovalAsset, r: GlbReport, bytes: number, dims: string, loadOk: boolean | 'UNKNOWN') {
  const rec = record(a.assetKey);
  const kb = (bytes / 1024).toFixed(0);
  const glassUnclear = r.glass.found && !(r.glass.assignedToMesh && r.glass.transparent);
  const rows: [string, string][] = [
    ['Faction', `${a.factionName} (${a.factionId})`],
    ['Building id / role', `${a.buildingId ?? '—'} / ${a.role}`],
    ['Active in gameplay', a.activeInGameplay ? '<span class="ok">yes</span>' : '<span class="warn">no (review-only)</span>'],
    ['File', a.modelPath],
    ['File size', `${kb} KB`],
    ['Loads in viewer', loadOk === 'UNKNOWN' ? '<span class="warn">UNKNOWN</span>' : yn(loadOk)],
    ['Dimensions (≈)', dims || '<span class="dim">n/a</span>'],
    ['Mesh count', String(r.meshCount)],
    ['Material count', String(r.materialCount)],
    ['Texture / image count', `${r.textureCount} / ${r.imageCount} (${r.embeddedImageCount} embedded)`],
    ['Meshes w/o material', r.meshesWithoutMaterial ? `<span class="warn">${r.meshesWithoutMaterial}</span>` : '0'],
    ['Unused materials', r.unusedMaterials.length ? `<span class="warn">${r.unusedMaterials.join(', ')}</span>` : '<span class="dim">none</span>'],
    ['Emissive material', yn(r.materials.some(m => m.emissive))],
    ['External textures', r.externalImageUris.length ? `<span class="warn">${r.externalImageUris.join(', ')}</span>` : '<span class="dim">none (self-contained)</span>'],
    ['ATTACH locators', r.attachNodes.length ? r.attachNodes.join(', ') : '<span class="dim">none</span>'],
    ['Turret pivot parents geo', r.turretPivotHasChildren === null ? '<span class="dim">n/a</span>' : yn(r.turretPivotHasChildren, 'YES', 'NO — empty marker')],
  ];
  const glassRows: [string, string][] = [
    ['Glass-like material found', yn(r.glass.found)],
    ['…assigned to a mesh', r.glass.found ? yn(r.glass.assignedToMesh) : '<span class="dim">n/a</span>'],
    ['…transparent / alpha', r.glass.found ? yn(r.glass.transparent) : '<span class="dim">n/a</span>'],
    ['…has texture map', r.glass.found ? yn(r.glass.hasTexture) : '<span class="dim">n/a</span>'],
    ['Glass material names', r.glass.materialNames.length ? r.glass.materialNames.join(', ') : '<span class="dim">none</span>'],
    ['Glass verdict', glassUnclear ? '<span class="warn">NEEDS VISUAL CONFIRMATION</span>' : (r.glass.found ? '<span class="ok">glass applied + transparent</span>' : '<span class="dim">no glass material</span>')],
  ];
  const t = (rr: [string, string][]) => `<table>${rr.map(([k, v]) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`).join('')}</table>`;

  panel.innerHTML = `
    <h1>${a.assetKey}</h1>
    <h2>Metadata</h2>${t(rows)}
    <h2>Glass / Material Inspection</h2>${t(glassRows)}
    <h2>Approval checklist</h2><div class="chk" id="chk"></div>
    <div class="status">
      <div><strong>Approved by York:</strong></div>
      <div class="row" id="statusRow">
        <button data-s="PENDING">PENDING</button>
        <button data-s="YES">YES</button>
        <button data-s="NO">NO</button>
      </div>
    </div>`;

  const chk = panel.querySelector('#chk')!;
  for (const item of APPROVAL_CHECKLIST_ITEMS) {
    const id = `c_${item.replace(/\W+/g, '_')}`;
    const wrap = document.createElement('label');
    const checked = !!rec.checklist[item];
    wrap.innerHTML = `<input type="checkbox" id="${id}" ${checked ? 'checked' : ''}/> ${item}`;
    wrap.querySelector('input')!.addEventListener('change', (e) => {
      rec.checklist[item as ApprovalChecklistItem] = (e.target as HTMLInputElement).checked;
      save(a.assetKey, rec);
    });
    chk.appendChild(wrap);
  }
  const statusRow = panel.querySelector('#statusRow')!;
  const paint = () => statusRow.querySelectorAll<HTMLElement>('button').forEach(b =>
    b.className = b.dataset.s === rec.status ? `sel-${rec.status}` : '');
  statusRow.querySelectorAll<HTMLElement>('button').forEach(b => b.addEventListener('click', () => {
    rec.status = b.dataset.s as ApprovalStatus; save(a.assetKey, rec); paint();
  }));
  paint();
}

resize();
renderFactions();
renderAssets();
