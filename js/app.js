import { GARMENTS, VIEW_W, VIEW_H } from './garments.js';
import * as Editor2D from './editor2d.js';
import * as Scene3D from './scene3d.js';

const SWATCHES = ['#2B2E33', '#F3F1EC', '#8C1D18', '#274B4A', '#3ED9A0', '#FF5A36', '#1D2B53', '#E8B84B'];

let currentView = '2d';

// Persistent offscreen canvases (silhouette + design baked together) that we
// keep feeding to the 3D textures — reused every sync so there's no async
// image loading involved anywhere in the 3D pipeline.
const TEX_SCALE = 2;
const frontComposite = document.createElement('canvas');
frontComposite.width = VIEW_W * TEX_SCALE; frontComposite.height = VIEW_H * TEX_SCALE;
const backComposite = document.createElement('canvas');
backComposite.width = VIEW_W * TEX_SCALE; backComposite.height = VIEW_H * TEX_SCALE;

function paintComposite(side, canvasEl) {
  const ctx = canvasEl.getContext('2d');
  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  ctx.drawImage(Editor2D.getBgCanvasEl(side), 0, 0, canvasEl.width, canvasEl.height);
  ctx.drawImage(Editor2D.getFabricCanvasEl(side), 0, 0, canvasEl.width, canvasEl.height);
}

// ---------------------------------------------------------------- Garment grid
function buildGarmentGrid() {
  const grid = document.getElementById('garmentGrid');
  Object.entries(GARMENTS).forEach(([key, cfg], i) => {
    const btn = document.createElement('button');
    btn.className = 'garment-btn' + (i === 0 ? ' is-active' : '');
    btn.textContent = cfg.label;
    btn.dataset.key = key;
    btn.addEventListener('click', () => selectGarment(key));
    grid.appendChild(btn);
  });
}

function selectGarment(key) {
  document.querySelectorAll('.garment-btn').forEach(b => b.classList.toggle('is-active', b.dataset.key === key));
  Editor2D.setGarment(key);
  Scene3D.buildGarment(key);
  Scene3D.setColor3D(Editor2D.getCurrentColor());
  syncDecals();
  updateSpec();
}

// ---------------------------------------------------------------- Color
function buildSwatches() {
  const grid = document.getElementById('swatchGrid');
  SWATCHES.forEach((hex, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' is-active' : '');
    b.style.background = hex;
    b.addEventListener('click', () => selectColor(hex, b));
    grid.appendChild(b);
  });
}

function selectColor(hex, btnEl) {
  document.querySelectorAll('.swatch').forEach(b => b.classList.remove('is-active'));
  if (btnEl) btnEl.classList.add('is-active');
  document.getElementById('customColor').value = hex;
  Editor2D.setColor(hex);
  Scene3D.setColor3D(hex);
  updateSpec();
}

document.getElementById('customColor').addEventListener('input', (e) => selectColor(e.target.value, null));

// ---------------------------------------------------------------- Side toggle
document.querySelectorAll('.side-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.side-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    Editor2D.setSide(btn.dataset.side);
    updateSpec();
  });
});

// ---------------------------------------------------------------- Add text / image
document.getElementById('addTextBtn').addEventListener('click', () => {
  Editor2D.addText();
  document.getElementById('textControls').hidden = false;
});

document.getElementById('addImageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => Editor2D.addImageFromDataUrl(reader.result);
  reader.readAsDataURL(file);
  e.target.value = '';
});

const textInputValue = document.getElementById('textInputValue');
const textColor = document.getElementById('textColor');
const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
[textInputValue, textColor, fontFamily, fontSize].forEach(el => {
  el.addEventListener('input', () => {
    Editor2D.updateActiveTextStyle({
      text: textInputValue.value,
      color: textColor.value,
      fontFamily: fontFamily.value,
      fontSize: fontSize.value
    });
  });
});

document.getElementById('deleteLayerBtn').addEventListener('click', () => {
  Editor2D.deleteSelected();
  document.getElementById('textControls').hidden = true;
});

// ---------------------------------------------------------------- View toggle (2D / 3D)
document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentView = btn.dataset.view;
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('is-active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    document.getElementById('stage2d').hidden = currentView !== '2d';
    document.getElementById('stage3d').hidden = currentView !== '3d';
    if (currentView === '3d') syncDecals();
  });
});

document.querySelectorAll('.view-quick button').forEach(btn => {
  btn.addEventListener('click', () => Scene3D.setQuickView(btn.dataset.cam));
});

// ---------------------------------------------------------------- Mobile tools drawer
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('toolsPanel').classList.toggle('is-open');
});

// ---------------------------------------------------------------- Spec ticket
function updateSpec() {
  document.getElementById('specGarment').textContent = GARMENTS[Editor2D.getCurrentGarment()].label;
  document.getElementById('specColor').textContent = Editor2D.getCurrentColor().toUpperCase();
  document.getElementById('specSide').textContent = Editor2D.getCurrentSide() === 'front' ? 'Front' : 'Back';
}

// ---------------------------------------------------------------- Sync 2D design -> 3D decals
function syncDecals() {
  paintComposite('front', frontComposite);
  paintComposite('back', backComposite);
  Scene3D.setFrontTexture(frontComposite);
  Scene3D.setBackTexture(backComposite);
}

// ---------------------------------------------------------------- Export
function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

document.getElementById('exportPng').addEventListener('click', async () => {
  const side = Editor2D.getCurrentSide();
  const url = await Editor2D.getMockupDataUrl(side, 'png');
  downloadDataUrl(url, `design-${side}.png`);
});

document.getElementById('exportJpg').addEventListener('click', async () => {
  const side = Editor2D.getCurrentSide();
  const url = await Editor2D.getMockupDataUrl(side, 'jpg');
  downloadDataUrl(url, `design-${side}.jpg`);
});

document.getElementById('exportGlb').addEventListener('click', async () => {
  syncDecals();
  const blob = await Scene3D.exportGLB();
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, 'custom-garment.glb');
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

// ---------------------------------------------------------------- Init
buildGarmentGrid();
buildSwatches();
Editor2D.initEditor2D(() => { syncDecals(); });
Scene3D.initScene3D();
updateSpec();
