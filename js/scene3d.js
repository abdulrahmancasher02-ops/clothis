import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GARMENTS } from './garments.js';

// ============================================================================
// PARAMETRIC GARMENT BUILDER
// ----------------------------------------------------------------------------
// Each garment is assembled from simple primitives (torso, sleeves, collar,
// hood, pocket, placket) instead of extruding the flat 2D outline. Extruding
// the flat outline produced broken/self-intersecting geometry for shapes
// with sleeves — this version only ever creates simple, valid, watertight
// primitives, so it can't produce a broken mesh.
//
// All the tunable numbers live in FIT below — nudge them if you want a
// slimmer/boxier fit, longer sleeves, a deeper hood, etc.
// ============================================================================

const FIT = {
  torsoHeight: 3.3,
  shoulderRadius: 1.05,
  hemRadius: 0.95,
  torsoFlatten: 0.56,        // front-to-back flatten ratio (oval cross-section)
  sleeveShortLen: 0.95,
  sleeveLongLen: 2.5,
  sleeveTopRadius: 0.34,
  sleeveEndRadiusShort: 0.30,
  sleeveEndRadiusLong: 0.20,
  sleeveAngleShort: 84,      // rotation (deg) — bigger = closer to horizontal
  sleeveAngleLong: 80,
  collarRadius: 0.34,
  collarTube: 0.065,
  smallCollarRadius: 0.30
};

const GARMENT_3D = {
  tshirt:     { sleeve: 'short', collar: 'crew',  hood: false, pocket: false, placket: false, ribHem: false },
  hoodie:     { sleeve: 'long',  collar: 'small', hood: true,  pocket: true,  placket: false, ribHem: true  },
  tank:       { sleeve: 'none',  collar: 'small', hood: false, pocket: false, placket: false, ribHem: false },
  longsleeve: { sleeve: 'long',  collar: 'crew',  hood: false, pocket: false, placket: false, ribHem: false },
  polo:       { sleeve: 'short', collar: 'crew',  hood: false, pocket: false, placket: true,  ribHem: false }
};

function shadeHex(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = (v) => Math.min(255, Math.max(0, v + Math.round(255 * pct)));
  const r = clamp(n >> 16), g = clamp((n >> 8) & 0xff), b = clamp(n & 0xff);
  return (r << 16) | (g << 8) | b;
}

let renderer, scene, camera, controls;
let garmentGroup = null;
let bodyMaterial, ribMaterial, buttonMaterial;
let frontDecal, backDecal;
let tweenId = null;
const texByMesh = new WeakMap();
let fabricGrain = null;

const DEFAULT_DIST = 9.5;

function makeFabricGrain() {
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 96, 96);
  const dots = ctx.createImageData(96, 96);
  for (let i = 0; i < dots.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 46;
    dots.data[i] = dots.data[i + 1] = dots.data[i + 2] = n;
    dots.data[i + 3] = 255;
  }
  ctx.putImageData(dots, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 10);
  return tex;
}

export function initScene3D() {
  const canvas = document.getElementById('threeCanvas');
  const parent = canvas.parentElement;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, 1, 0.1, 3000);
  camera.position.set(0, 0, DEFAULT_DIST);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 1.15);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(4, 6, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-5, -2, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.28);
  rim.position.set(0, 3, -7);
  scene.add(rim);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.8;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 22;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.maxPolarAngle = Math.PI * 0.85;
  controls.target.set(0, 0, 0);
  controls.addEventListener('start', () => { if (tweenId) { cancelAnimationFrame(tweenId); tweenId = null; } });

  function resize() {
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(parent);
  resize();

  fabricGrain = makeFabricGrain();

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  buildGarment('tshirt');
}

function disposeGarment() {
  if (!garmentGroup) return;
  scene.remove(garmentGroup);
  garmentGroup.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
  });
  [bodyMaterial, ribMaterial, buttonMaterial].forEach(m => m && m.dispose());
  [frontDecal, backDecal].forEach(m => { if (m && m.material.map) m.material.map.dispose(); if (m) m.material.dispose(); });
  garmentGroup = null;
}

// A cylinder "limb" that hangs from a pivot at its top end, so rotating the
// pivot swings it from the shoulder like a real sleeve.
function makeLimb(radiusTop, radiusBottom, length, angleDeg, material, cuffMaterial) {
  const pivot = new THREE.Group();
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, 14);
  geo.translate(0, -length / 2, 0);
  pivot.add(new THREE.Mesh(geo, material));
  if (cuffMaterial) {
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(radiusBottom * 1.22, 0.045, 8, 20), cuffMaterial);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -length + 0.03;
    pivot.add(cuff);
  }
  pivot.rotation.z = THREE.MathUtils.degToRad(angleDeg);
  return pivot;
}

export function buildGarment(key) {
  disposeGarment();
  const cfg = GARMENT_3D[key];
  const group = new THREE.Group();

  bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.85, roughnessMap: fabricGrain, metalness: 0.02 });
  ribMaterial = new THREE.MeshStandardMaterial({ color: shadeHex('#2b2e33', -0.18), roughness: 0.9, roughnessMap: fabricGrain, metalness: 0.02 });
  buttonMaterial = new THREE.MeshStandardMaterial({ color: 0xefebe3, roughness: 0.45, metalness: 0.1 });

  const halfH = FIT.torsoHeight / 2;
  const frontZ = FIT.shoulderRadius * FIT.torsoFlatten;

  // ---- torso
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(FIT.shoulderRadius, FIT.hemRadius, FIT.torsoHeight, 24, 1),
    bodyMaterial
  );
  torso.scale.z = FIT.torsoFlatten;
  group.add(torso);

  // ---- collar
  const collarR = cfg.collar === 'small' ? FIT.smallCollarRadius : FIT.collarRadius;
  const collar = new THREE.Mesh(new THREE.TorusGeometry(collarR, FIT.collarTube, 12, 28), bodyMaterial);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = halfH - 0.02;
  group.add(collar);

  // ---- sleeves / straps
  if (cfg.sleeve !== 'none') {
    const long = cfg.sleeve === 'long';
    const len = long ? FIT.sleeveLongLen : FIT.sleeveShortLen;
    const endR = long ? FIT.sleeveEndRadiusLong : FIT.sleeveEndRadiusShort;
    const angle = long ? FIT.sleeveAngleLong : FIT.sleeveAngleShort;
    [-1, 1].forEach((side) => {
      const limb = makeLimb(FIT.sleeveTopRadius, endR, len, angle * side, bodyMaterial, long ? ribMaterial : null);
      limb.position.set(side * FIT.shoulderRadius * 0.9, halfH - 0.35, 0);
      group.add(limb);
    });
  } else {
    [-1, 1].forEach((side) => {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.08), bodyMaterial);
      strap.position.set(side * FIT.smallCollarRadius * 0.85, halfH + 0.2, 0);
      group.add(strap);
    });
  }

  // ---- hood
  if (cfg.hood) {
    const hood = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
      bodyMaterial
    );
    hood.position.set(0, halfH + 0.24, -0.24);
    hood.rotation.x = -0.28;
    group.add(hood);
  }

  // ---- kangaroo pocket
  if (cfg.pocket) {
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.58, 0.12), bodyMaterial);
    pocket.position.set(0, -halfH * 0.22, frontZ + 0.05);
    group.add(pocket);
  }

  // ---- placket + buttons (polo)
  if (cfg.placket) {
    const placket = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.05), bodyMaterial);
    placket.position.set(0, halfH - 0.42, frontZ + 0.04);
    group.add(placket);
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 10), buttonMaterial);
      btn.position.set(0, halfH - 0.3 - i * 0.2, frontZ + 0.095);
      group.add(btn);
    }
  }

  // ---- ribbed hem
  if (cfg.ribHem) {
    const hem = new THREE.Mesh(
      new THREE.CylinderGeometry(FIT.hemRadius * 1.03, FIT.hemRadius * 1.03, 0.18, 24),
      ribMaterial
    );
    hem.scale.z = FIT.torsoFlatten;
    hem.position.y = -halfH + 0.09;
    group.add(hem);
  }

  // ---- design decals (front + back print area, sized to match the 2D zone)
  const zone = GARMENTS[key].zone;
  const decalH = 1.15;
  const decalW = decalH * (zone.w / zone.h);
  const decalGeo = new THREE.PlaneGeometry(decalW, decalH);

  frontDecal = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.9, side: THREE.DoubleSide }));
  frontDecal.position.set(0, 0.05, frontZ + 0.07);
  group.add(frontDecal);

  backDecal = new THREE.Mesh(decalGeo.clone(), new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.9, side: THREE.DoubleSide }));
  backDecal.position.set(0, 0.05, -(frontZ + 0.07));
  backDecal.rotation.y = Math.PI;
  group.add(backDecal);

  garmentGroup = group;
  scene.add(garmentGroup);
}

export function setColor3D(hex) {
  if (bodyMaterial) bodyMaterial.color.setHex(parseInt(hex.replace('#', ''), 16));
  if (ribMaterial) ribMaterial.color.setHex(shadeHex(hex, -0.18));
}

// canvasEl is a live <canvas> (the Fabric.js design layer) we keep updating in
// place — one CanvasTexture per mesh, refreshed via needsUpdate, so there's
// no async image decoding and no export-timing race.
function applyCanvasTexture(mesh, canvasEl) {
  if (!mesh) return;
  let tex = texByMesh.get(mesh);
  if (!tex || tex.image !== canvasEl) {
    if (tex) tex.dispose();
    tex = new THREE.CanvasTexture(canvasEl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    texByMesh.set(mesh, tex);
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
  } else {
    tex.needsUpdate = true;
  }
}

export function setFrontTexture(canvasEl) { applyCanvasTexture(frontDecal, canvasEl); }
export function setBackTexture(canvasEl) { applyCanvasTexture(backDecal, canvasEl); }

export function setQuickView(pos) {
  const dist = camera.position.length() || DEFAULT_DIST;
  const targets = {
    front: [0, 0, dist],
    back: [0, 0, -dist],
    side: [dist, 0, 0]
  };
  const [tx, ty, tz] = targets[pos] || targets.front;
  const start = camera.position.clone();
  const end = new THREE.Vector3(tx, ty, tz);
  const t0 = performance.now();
  const duration = 450;
  if (tweenId) cancelAnimationFrame(tweenId);

  function step(now) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(start, end, eased);
    camera.lookAt(0, 0, 0);
    if (t < 1) tweenId = requestAnimationFrame(step);
    else tweenId = null;
  }
  tweenId = requestAnimationFrame(step);
}

export function exportGLB() {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      garmentGroup,
      (result) => resolve(new Blob([result], { type: 'model/gltf-binary' })),
      (err) => reject(err),
      { binary: true }
    );
  });
}
