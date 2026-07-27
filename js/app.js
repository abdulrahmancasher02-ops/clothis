import { GARMENTS } from './garments.js';
import * as Editor2D from './editor2d.js';
import * as Scene3D from './scene3d.js';

const SWATCHES = ['#2B2E33', '#F3F1EC', '#8C1D18', '#274B4A', '#3ED9A0', '#FF5A36', '#1D2B53', '#E8B84B'];

let currentView = '2d';

const GARMENT_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 3 3 7l2.5 3L8 8v13h8V8l2.5 2L21 7l-5-4-1.5 1.5a4.2 4.2 0 0 1-5 0L8 3Z"/></svg>';

// ---------------------------------------------------------------- Garment grid
function buildGarmentGrid() {
  const grid = document.getElementById('garmentGrid');
  Object.entries(GARMENTS).forEach(([key, cfg], i) => {
    const btn = document.createElement('button');
    btn.className = 'garment-btn' + (i === 0 ? ' is-active' : '');
    btn.innerHTML = `${GARMENT_ICON}<span>${cfg.label}</span>`;
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

document.getElementById('boldBtn').addEventListener('click', () => Editor2D.toggleBold());
document.getElementById('italicBtn').addEventListener('click', () => Editor2D.toggleItalic());
document.getElementById('opacitySlider').addEventListener('input', (e) => Editor2D.setOpacity(e.target.value));
document.getElementById('bringForwardBtn').addEventListener('click', () => Editor2D.bringForward());
document.getElementById('sendBackwardBtn').addEventListener('click', () => Editor2D.sendBackward());

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
  Scene3D.setFrontTexture(Editor2D.getFabricCanvasEl('front'));
  Scene3D.setBackTexture(Editor2D.getFabricCanvasEl('back'));
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
