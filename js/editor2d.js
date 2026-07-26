import { GARMENTS, VIEW_W, VIEW_H, tracePath2D } from './garments.js';

// One fabric canvas + one background canvas per side (front / back)
const sides = {};
let currentGarment = 'tshirt';
let currentColor = '#2B2E33';
let currentSide = 'front';
let onChangeCb = () => {};

function buildSide(side) {
  const bg = document.getElementById(side === 'front' ? 'bgCanvasFront' : 'bgCanvasBack');
  bg.width = VIEW_W; bg.height = VIEW_H;

  const fabricEl = document.getElementById(side === 'front' ? 'fabricFront' : 'fabricBack');
  const canvas = new fabric.Canvas(fabricEl, {
    width: VIEW_W,
    height: VIEW_H,
    backgroundColor: 'transparent',
    preserveObjectStacking: true
  });
  // Keep a fixed internal resolution (crisp exports, consistent coordinates)
  // but let the canvas display responsively at its container's size.
  canvas.setDimensions({ width: '100%', height: '100%' }, { cssOnly: true });

  canvas.on('object:modified', () => onChangeCb());
  canvas.on('object:added', () => { clampToZone(canvas); renderLayerList(); onChangeCb(); });
  canvas.on('object:removed', () => { renderLayerList(); onChangeCb(); });
  canvas.on('selection:created', renderLayerList);
  canvas.on('selection:updated', renderLayerList);
  canvas.on('selection:cleared', renderLayerList);
  canvas.on('text:changed', () => onChangeCb());

  sides[side] = { bg, bgCtx: bg.getContext('2d'), canvas };
}

function clampToZone(canvas) {
  const zone = GARMENTS[currentGarment].zone;
  canvas.getObjects().forEach(obj => {
    obj.setCoords();
  });
  void zone; // soft-clamp only via clipPath below; free movement otherwise
}

function applyClipPath(side) {
  const zone = GARMENTS[currentGarment].zone;
  const { canvas } = sides[side];
  canvas.clipPath = new fabric.Rect({
    left: zone.x, top: zone.y, width: zone.w, height: zone.h,
    absolutePositioned: true
  });
  canvas.requestRenderAll();
}

function shadeColor(hex, percent) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + Math.round(255 * percent)));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + Math.round(255 * percent)));
  const b = Math.min(255, Math.max(0, (n & 0xff) + Math.round(255 * percent)));
  return `rgb(${r},${g},${b})`;
}

function drawGarment(side) {
  const { bgCtx } = sides[side];
  const outline = GARMENTS[currentGarment].outline;
  bgCtx.clearRect(0, 0, VIEW_W, VIEW_H);

  tracePath2D(bgCtx, outline);
  bgCtx.save();
  bgCtx.clip();

  // Soft fabric-like shading: lighter across the chest, deeper at the seams
  const grad = bgCtx.createLinearGradient(0, 0, VIEW_W, VIEW_H);
  grad.addColorStop(0, shadeColor(currentColor, 0.12));
  grad.addColorStop(0.45, currentColor);
  grad.addColorStop(1, shadeColor(currentColor, -0.14));
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Gentle center highlight so the fabric doesn't read as a flat cutout
  const radial = bgCtx.createRadialGradient(VIEW_W / 2, VIEW_H * 0.35, 20, VIEW_W / 2, VIEW_H * 0.4, VIEW_H * 0.6);
  radial.addColorStop(0, 'rgba(255,255,255,0.10)');
  radial.addColorStop(1, 'rgba(255,255,255,0)');
  bgCtx.fillStyle = radial;
  bgCtx.fillRect(0, 0, VIEW_W, VIEW_H);
  bgCtx.restore();

  // Seam outline
  tracePath2D(bgCtx, outline);
  bgCtx.lineWidth = 2;
  bgCtx.strokeStyle = shadeColor(currentColor, -0.28);
  bgCtx.stroke();

  // Inset stitch line for a tailored finish
  bgCtx.save();
  tracePath2D(bgCtx, outline);
  bgCtx.clip();
  bgCtx.setLineDash([5, 5]);
  bgCtx.lineWidth = 1;
  bgCtx.strokeStyle = 'rgba(255,255,255,0.16)';
  bgCtx.stroke();
  bgCtx.restore();
}

function updateZoneGuide() {
  const zone = GARMENTS[currentGarment].zone;
  const guide = document.getElementById('zoneGuide');
  guide.style.left = (zone.x / VIEW_W * 100) + '%';
  guide.style.top = (zone.y / VIEW_H * 100) + '%';
  guide.style.width = (zone.w / VIEW_W * 100) + '%';
  guide.style.height = (zone.h / VIEW_H * 100) + '%';
}

function renderLayerList() {
  const list = document.getElementById('layerList');
  const canvas = sides[currentSide].canvas;
  const objects = canvas.getObjects();
  const active = canvas.getActiveObject();
  list.innerHTML = '';
  if (!objects.length) {
    list.innerHTML = '<li class="layer-empty">No elements yet</li>';
    return;
  }
  objects.forEach((obj, i) => {
    const li = document.createElement('li');
    const label = obj.type === 'image' ? `🖼 Image ${i + 1}` : `🔤 ${(obj.text || 'Text').slice(0, 14)}`;
    li.textContent = label;
    if (obj === active) li.classList.add('is-active');
    li.addEventListener('click', () => {
      canvas.setActiveObject(obj);
      canvas.requestRenderAll();
      renderLayerList();
    });
    list.appendChild(li);
  });
}

export function initEditor2D(onChange) {
  onChangeCb = onChange;
  buildSide('front');
  buildSide('back');
  setGarment(currentGarment);
  setSide('front');
}

export function setGarment(key) {
  currentGarment = key;
  drawGarment('front');
  drawGarment('back');
  applyClipPath('front');
  applyClipPath('back');
  updateZoneGuide();
  onChangeCb();
}

export function setColor(hex) {
  currentColor = hex;
  drawGarment('front');
  drawGarment('back');
  onChangeCb();
}

export function setSide(side) {
  currentSide = side;
  document.getElementById('bgCanvasFront').hidden = side !== 'front';
  document.getElementById('fabricFront').hidden = side !== 'front';
  document.getElementById('bgCanvasBack').hidden = side !== 'back';
  document.getElementById('fabricBack').hidden = side !== 'back';
  renderLayerList();
}

export function addText() {
  const canvas = sides[currentSide].canvas;
  const zone = GARMENTS[currentGarment].zone;
  const text = new fabric.Textbox('Your Text', {
    left: zone.x + zone.w / 2,
    top: zone.y + zone.h / 2,
    originX: 'center', originY: 'center',
    fontFamily: 'Space Grotesk',
    fontSize: 32,
    fill: '#ffffff',
    width: zone.w * 0.9,
    textAlign: 'center'
  });
  canvas.add(text);
  canvas.setActiveObject(text);
  canvas.requestRenderAll();
}

export function updateActiveTextStyle({ text, color, fontFamily, fontSize }) {
  const canvas = sides[currentSide].canvas;
  const obj = canvas.getActiveObject();
  if (!obj || obj.type !== 'textbox') return;
  if (text !== undefined) obj.set('text', text);
  if (color !== undefined) obj.set('fill', color);
  if (fontFamily !== undefined) obj.set('fontFamily', fontFamily);
  if (fontSize !== undefined) obj.set('fontSize', Number(fontSize));
  canvas.requestRenderAll();
  onChangeCb();
}

export function getActiveObject() {
  return sides[currentSide].canvas.getActiveObject();
}

export function addImageFromDataUrl(dataUrl) {
  const canvas = sides[currentSide].canvas;
  const zone = GARMENTS[currentGarment].zone;
  fabric.Image.fromURL(dataUrl, (img) => {
    const scale = Math.min((zone.w * 0.8) / img.width, (zone.h * 0.8) / img.height, 1);
    img.set({
      left: zone.x + zone.w / 2,
      top: zone.y + zone.h / 2,
      originX: 'center', originY: 'center',
      scaleX: scale, scaleY: scale
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    canvas.requestRenderAll();
  }, { crossOrigin: 'anonymous' });
}

export function deleteSelected() {
  const canvas = sides[currentSide].canvas;
  const obj = canvas.getActiveObject();
  if (obj) {
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }
}

// Transparent design-only image (objects only, no garment fill) — used as the
// decal texture on the 3D model.
export function getDesignDataUrl(side) {
  const { canvas } = sides[side];
  return canvas.toDataURL({ format: 'png', multiplier: 2 });
}

// Full flat mockup (garment silhouette + design) for PNG/JPG download
export function getMockupDataUrl(side, format = 'png') {
  const { bg } = sides[side];
  const canvas = sides[side].canvas;
  const merged = document.createElement('canvas');
  merged.width = VIEW_W * 2;
  merged.height = VIEW_H * 2;
  const ctx = merged.getContext('2d');
  if (format === 'jpg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, merged.width, merged.height);
  }
  ctx.drawImage(bg, 0, 0, merged.width, merged.height);
  const designImg = new Image();
  const designUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
  return new Promise((resolve) => {
    designImg.onload = () => {
      ctx.drawImage(designImg, 0, 0, merged.width, merged.height);
      resolve(merged.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
    };
    designImg.src = designUrl;
  });
}

// Raw canvas elements (no dataURL round-trip) — used to build the 3D texture
export function getBgCanvasEl(side) { return sides[side].bg; }
export function getFabricCanvasEl(side) { return sides[side].canvas.getElement(); }

export function getCurrentGarment() { return currentGarment; }
export function getCurrentColor() { return currentColor; }
export function getCurrentSide() { return currentSide; }
export { renderLayerList };
