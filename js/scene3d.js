import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GARMENTS, VIEW_W, VIEW_H, traceThreeShape } from './garments.js';

let renderer, scene, camera, controls;
let garmentGroup = null;
let frontMesh, backMesh, sideMesh;
let tweenId = null;
const texByMesh = new WeakMap();

const DEFAULT_DIST = 640;

// A small tiled grain texture so the fabric reads as cloth, not plastic.
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
  tex.repeat.set(26, 32);
  return tex;
}
let fabricGrain = null;

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
  key.position.set(220, 260, 380);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-260, -80, 220);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(0, 100, -400);
  scene.add(rim);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.8;
  controls.zoomSpeed = 0.8;
  controls.enablePan = false;
  controls.minDistance = 320;
  controls.maxDistance = 1100;
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
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
  garmentGroup = null;
}

export function buildGarment(key) {
  disposeGarment();
  const cfg = GARMENTS[key];
  const shape = traceThreeShape(THREE, cfg.outline);
  const geo = new THREE.ShapeGeometry(shape, 8);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cy = (bb.min.y + bb.max.y) / 2;

  // Remap UVs from the shared VIEW_W/VIEW_H design space BEFORE recentering,
  // so the fabric-canvas texture lines up with the silhouette exactly.
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    uv.setXY(i, x / VIEW_W, 1 + y / VIEW_H);
  }
  uv.needsUpdate = true;
  geo.translate(-cx, -cy, 0);

  const frontMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, roughnessMap: fabricGrain, metalness: 0.02, side: THREE.DoubleSide });
  const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, roughnessMap: fabricGrain, metalness: 0.02, side: THREE.DoubleSide });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.9, roughnessMap: fabricGrain });

  frontMesh = new THREE.Mesh(geo, frontMat);
  frontMesh.position.z = 4;

  backMesh = new THREE.Mesh(geo.clone(), backMat);
  backMesh.position.z = -4;
  backMesh.rotation.y = Math.PI;

  // Thin edge band for a touch of thickness/depth
  const extrudeGeo = new THREE.ExtrudeGeometry(shape, { depth: 8, bevelEnabled: false, curveSegments: 8 });
  extrudeGeo.translate(-cx, -cy, 0);
  sideMesh = new THREE.Mesh(extrudeGeo, edgeMat);
  sideMesh.position.z = -4;

  garmentGroup = new THREE.Group();
  garmentGroup.add(sideMesh, frontMesh, backMesh);
  scene.add(garmentGroup);
}

export function setColor3D(hex) {
  if (sideMesh) sideMesh.material.color.set(hex);
}

// canvasEl is a live <canvas> we keep updating in place, so we create the
// THREE.CanvasTexture once per mesh and just flag it dirty afterwards —
// no async image decoding, no flicker, no export-timing race.
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

export function setFrontTexture(canvasEl) { applyCanvasTexture(frontMesh, canvasEl); }
export function setBackTexture(canvasEl) { applyCanvasTexture(backMesh, canvasEl); }

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
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
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
