import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { INTERIOR_COUNT, LAYERS, layerIndexAtRadius, propertiesAt } from './data/earth.js';
import { scale, toDisplay, toReal, updateScale } from './data/scale.js';
import { TOUR } from './data/tour.js';
import { createCameraRig, facePoint, viewFrom } from './scene/camera.js';
import { createEarth } from './scene/earth.js';
import { createInterior } from './scene/interior.js';
import { createMagnetosphere } from './scene/magnetosphere.js';
import { createSeismic } from './scene/seismic.js';
import { createSpace } from './scene/space.js';
import { MODE_INDEX, shared } from './scene/uniforms.js';
import { store } from './store.js';
import { createLabels } from './ui/labels.js';
import { createUI } from './ui/ui.js';

const { state } = store;
const deg = THREE.MathUtils.degToRad;

// Renderer & post-processing -------------------------------------------------

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#02030a');

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 3000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.6;
controls.zoomSpeed = 0.8;
controls.minDistance = 0.3;
controls.maxDistance = 40;
controls.enablePan = true;

const renderTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, renderTarget);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Scene ------------------------------------------------------------------------

const space = createSpace();
const interior = createInterior();
const earth = createEarth();
const magnetosphere = createMagnetosphere();
const seismic = createSeismic();
interior.faces[0].add(seismic.group);
scene.add(space.group, interior.group, earth.group, magnetosphere.group);

// Iso-depth ring drawn across both cut faces while probing.
const ringGeometry = new THREE.BufferGeometry().setFromPoints(
  Array.from({ length: 129 }, (_, k) => {
    const a = -Math.PI / 2 + (Math.PI * k) / 128;
    return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
  }),
);
const ringMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), transparent: true, opacity: 0.85 });
const rings = interior.faces.map((face, k) => {
  const ring = new THREE.Line(ringGeometry, ringMaterial);
  ring.position.z = k === 0 ? 0.003 : -0.003;
  ring.visible = false;
  face.add(ring);
  return ring;
});
let ringRadiusKm = null;

const rig = createCameraRig(camera, controls);

// Actions ------------------------------------------------------------------------

let tourStep = 0;
let tourTimer = 0;
let snapshotRequested = false;

function ensureFaceVisible() {
  if (state.cut < 45) store.set({ cut: 90 });
}

function frameLayer(i, cutDeg = state.cut) {
  const lo = scale.display[i];
  const hi = scale.display[i + 1];
  const mid = i === 0 ? hi * 0.5 : (lo + hi) / 2;
  const thickness = hi - lo;
  const polar = i >= INTERIOR_COUNT ? 50 : 62;
  const target = facePoint(mid, polar, deg(cutDeg));
  const distance = THREE.MathUtils.clamp(thickness * 7 + 0.35, 0.45, 3.2);
  rig.flyTo(viewFrom(target, fitDistance(distance), 14, 5), target);
}

// Pull back on portrait screens so the whole planet fits horizontally.
function fitDistance(d) {
  return d / Math.min(1, camera.aspect) ** 0.85;
}

function overview() {
  const origin = new THREE.Vector3();
  return [viewFrom(origin, fitDistance(5.2), 26, 14), origin];
}

// Face A carries the earthquake rays: look at it nearly square-on.
function quakeView() {
  const target = facePoint(0.45, 90, deg(state.cut)).setY(0.2);
  return [viewFrom(target, fitDistance(3.9), 8, 80 - state.cut / 2), target];
}

const actions = {
  selectLayer(i, { fly = false } = {}) {
    const patch = { selected: i };
    if (i >= 0 && i < INTERIOR_COUNT && i > state.peel) patch.peel = i;
    if (i >= INTERIOR_COUNT) {
      patch.peel = INTERIOR_COUNT - 1;
      patch.toggles = { atmosphere: true };
    }
    store.set(patch);
    if (fly && i >= 0) actions.flyToLayer(i);
  },
  flyToLayer(i) {
    if (i < 0) return;
    ensureFaceVisible();
    frameLayer(i);
  },
  triggerQuake() {
    const patch = { peel: INTERIOR_COUNT - 1 };
    if (state.cut < 60) patch.cut = 100;
    store.set(patch);
    seismic.trigger();
    rig.flyTo(...quakeView());
  },
  startTour() {
    store.set({ touring: true });
    tourStep = 0;
    goToStep(0);
  },
  stopTour() {
    clearTimeout(tourTimer);
    store.set({ touring: false, selected: -1, peel: INTERIOR_COUNT - 1, mode: 'material', cut: 90 });
    rig.flyTo(...overview(), 2.4);
  },
  tourStep(d) {
    const next = tourStep + d;
    if (next >= TOUR.length) return actions.stopTour();
    if (next < 0) return;
    tourStep = next;
    goToStep(next);
  },
  probeRadius(rKm) {
    ringRadiusKm = rKm;
    store.set({ hover: rKm == null ? -1 : layerIndexAtRadius(rKm) });
  },
  snapshot() {
    snapshotRequested = true;
  },
};

function goToStep(step) {
  const s = TOUR[step];
  const { quake, ...patch } = s.state;
  store.set(patch);
  clearTimeout(tourTimer);
  if (quake) tourTimer = setTimeout(() => seismic.trigger(), 1400);
  if (s.view === 'quake') {
    rig.flyTo(...quakeView(), 2.6);
  } else {
    const { r, polar, distance, elevation, azimuth = 0 } = s.view;
    const target = facePoint(r, polar, deg(state.cut));
    rig.flyTo(viewFrom(target, fitDistance(distance), elevation, azimuth), target, 2.6);
  }
  ui.renderTour(step);
}

const ui = createUI(store, actions);
const labels = createLabels(document.getElementById('callouts'), document.getElementById('leaders'), {
  onSelect: (i) => actions.selectLayer(i, { fly: true }),
  onHover: (i) => store.set({ hover: i }),
});

// Probe: hover the cross-section to read physical properties -------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const pointerPx = { x: 0, y: 0 };
let pointerActive = false;
let pointerDirty = false;
let pointerDown = null;
let probe = null;
const lastProbeCamera = new THREE.Vector3();

function inWedge(p) {
  const cut = shared.uCut.value;
  if (cut < 0.001) return false;
  let phi = Math.atan2(p.z, p.x) - shared.uWedgeCenter.value;
  phi = ((((phi + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return Math.abs(phi) < cut / 2;
}

function runProbe() {
  raycaster.setFromCamera(pointer, camera);
  const vis = shared.uVis.value;
  const targets = [];
  for (const face of interior.faces) {
    if (!face.visible) continue;
    targets.push(face.userData.interior);
    if (face.userData.atmosphere.visible) targets.push(face.userData.atmosphere);
  }
  for (const s of interior.spheres) if (s.visible) targets.push(s);
  if (earth.surface.visible) targets.push(earth.surface);

  const surface = scale.display[INTERIOR_COUNT];
  const outer = scale.display[scale.display.length - 1];
  for (const hit of raycaster.intersectObjects(targets, false)) {
    const obj = hit.object;
    const r = hit.point.length();
    if (obj.userData.probe) {
      const isAtmosphere = interior.faces.some((f) => f.userData.atmosphere === obj);
      if (isAtmosphere ? r < surface || r > outer : r > surface) continue;
      const rKm = toReal(r);
      const layer = layerIndexAtRadius(rKm);
      if (layer < INTERIOR_COUNT && vis[layer] < 0.5) continue;
      return { layer, rKm, props: propertiesAt(rKm) };
    }
    if (inWedge(hit.point)) continue;
    const layer = obj.userData.layer;
    if (vis[layer] < 0.5) continue;
    const rKm = LAYERS[layer].top - 0.5;
    return { layer, rKm, props: propertiesAt(rKm), surface: true };
  }
  return null;
}

canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointerPx.x = e.clientX;
  pointerPx.y = e.clientY;
  pointerActive = true;
  pointerDirty = true;
});
canvas.addEventListener('pointerleave', () => {
  pointerActive = false;
  probe = null;
  ringRadiusKm = null;
  ui.showProbe(null);
  ui.chart.setCrosshair(null);
  store.set({ hover: -1 });
});
canvas.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
  rig.cancel();
});
canvas.addEventListener('pointerup', (e) => {
  if (!pointerDown) return;
  const moved = Math.hypot(e.clientX - pointerDown.x, e.clientY - pointerDown.y);
  pointerDown = null;
  if (moved > 5) return;
  const hit = runProbe();
  actions.selectLayer(hit ? hit.layer : -1);
});

// Keyboard --------------------------------------------------------------------

const MODE_KEYS = ['material', 'temperature', 'density', 'pressure', 'vp'];
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '5') store.set({ mode: MODE_KEYS[Number(k) - 1] });
  else if (k === '[') store.set({ peel: Math.max(0, state.peel - 1) });
  else if (k === ']') store.set({ peel: Math.min(INTERIOR_COUNT - 1, state.peel + 1) });
  else if (k === 'arrowleft' && !state.touring) store.set({ cut: Math.max(0, state.cut - 10) });
  else if (k === 'arrowright' && !state.touring) store.set({ cut: Math.min(270, state.cut + 10) });
  else if (k === 'arrowleft') actions.tourStep(-1);
  else if (k === 'arrowright') actions.tourStep(1);
  else if (k === 'q') actions.triggerQuake();
  else if (k === 't') (state.touring ? actions.stopTour : actions.startTour)();
  else if (k === 's') store.set({ schematic: !state.schematic });
  else if (k === 'a') store.toggle('atmosphere');
  else if (k === 'c') store.toggle('clouds');
  else if (k === 'm') store.toggle('magnetosphere');
  else if (k === 'l') store.toggle('labels');
  else if (k === ' ') store.toggle('rotate');
  else if (k === 'p') actions.snapshot();
  else if (k === '?') ui.toggleHelp();
  else if (k === 'escape') {
    if (ui.helpOpen()) ui.toggleHelp(false);
    else if (state.touring) actions.stopTour();
    else actions.selectLayer(-1);
  } else return;
  e.preventDefault();
});

// Loading & intro ----------------------------------------------------------------

let started = false;
function start() {
  if (started) return;
  started = true;
  document.getElementById('loader').classList.add('done');
  rig.flyTo(...overview(), 3.4);
}
THREE.DefaultLoadingManager.onLoad = start;
setTimeout(start, 8000);

camera.position.copy(viewFrom(new THREE.Vector3(), 28, 40, -80));
controls.target.set(0, 0, 0);

// Free horizontal space between the side panels, for the callout column.
const layersPanel = document.getElementById('layers-panel');
const infoPanel = document.getElementById('info-panel');
function panelBounds() {
  const w = window.innerWidth;
  if (w < 760) return { left: 8, right: w - 8 };
  const l = layersPanel.getBoundingClientRect();
  const r = infoPanel.getBoundingClientRect();
  return { left: l.width ? l.right + 12 : 12, right: r.width ? r.left - 12 : w - 12 };
}

// Loop ------------------------------------------------------------------------------

const timer = new THREE.Timer();
let spin = 0;
let modeIndex = 1;

function approach(current, target, rate, dt) {
  return current + (target - current) * Math.min(1, dt * rate);
}

function frame(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.05);
  shared.uTime.value += dt;

  scale.target = state.schematic ? 1 : 0;
  updateScale(dt);

  shared.uCut.value = approach(shared.uCut.value, started ? deg(state.cut) : 0, started ? 2.2 : 10, dt);
  shared.uModeMix.value = approach(shared.uModeMix.value, state.mode === 'material' ? 0 : 1, 5, dt);
  if (state.mode !== 'material' && MODE_INDEX[state.mode] !== modeIndex) {
    modeIndex = MODE_INDEX[state.mode];
    interior.setDataMode(modeIndex);
  }

  const vis = shared.uVis.value;
  for (let i = 0; i < INTERIOR_COUNT; i++) {
    const target = i <= state.peel ? 1 : 0;
    const step = dt * 1.1;
    vis[i] = target > vis[i] ? Math.min(target, vis[i] + step) : Math.max(target, vis[i] - step);
  }

  if (state.toggles.rotate) spin += dt * 0.035;
  shared.uHover.value = state.hover;
  shared.uSelected.value = state.selected;

  interior.setAtmosphereVisible(state.toggles.atmosphere);
  interior.update(dt, spin);
  earth.update(dt, spin, state.toggles);
  magnetosphere.update(dt, spin, state.toggles, vis[INTERIOR_COUNT - 1] > 0.5);
  seismic.update(dt, scale.schematic.toFixed(4), vis[INTERIOR_COUNT - 1] > 0.99);

  rig.update(dt);
  controls.update();

  const cameraMoved = !lastProbeCamera.equals(camera.position);
  if (pointerActive && (pointerDirty || cameraMoved)) {
    pointerDirty = false;
    lastProbeCamera.copy(camera.position);
    if (!pointerDown) {
      probe = runProbe();
      ui.showProbe(probe, pointerPx.x, pointerPx.y);
      ui.chart.setCrosshair(probe ? probe.rKm : null);
      ringRadiusKm = probe ? probe.rKm : null;
      const hover = probe ? probe.layer : -1;
      if (hover !== state.hover) store.set({ hover });
    }
  }

  const showRing = ringRadiusKm != null && shared.uCut.value > 0.01;
  rings.forEach((ring) => {
    ring.visible = showRing;
    if (showRing) ring.scale.setScalar(toDisplay(ringRadiusKm));
  });

  labels.update(camera, window.innerWidth, window.innerHeight, state, dt, panelBounds());
  ui.renderHud(seismic);

  composer.render();

  if (snapshotRequested) {
    snapshotRequested = false;
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `strata-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) window.strata = { store, actions };
