import * as THREE from 'three';
import { INTERIOR_COUNT, LAYERS, propertiesAt } from '../data/earth.js';
import { scale } from '../data/scale.js';
import { blackbody, defines, noise, outputChunks, planet, ramps } from '../shaders/common.js';
import { profileLookup, shared, TEMPERATURE_SCALE } from './uniforms.js';

// The cross-section: two half-disc faces bounding the cutaway wedge, plus a
// sphere for each interior layer that shows when the layers above are peeled.

const layerColors = LAYERS.map((l) => new THREE.Color(l.color));

const faceVertex = /* glsl */ `
varying vec3 vPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const faceFragment = /* glsl */ `
${defines}
${noise}
${blackbody}
${ramps}
${planet}
${profileLookup}

uniform int uRegion;      // 0 interior, 1 atmosphere
uniform int uDataMode;    // 1..4, the data view blended in by uModeMix
uniform float uModeMix;
uniform float uShade;
uniform int uHover;
uniform int uSelected;
uniform vec3 uLayerColors[LAYER_COUNT];
varying vec3 vPos;

float band(float x, float center, float width) {
  float d = (x - center) / width;
  return exp(-d * d);
}

// Mantle convection: warped noise plus a pair of rising plumes and sinking slabs.
float mantleHeat(float rn, float theta, out float slab) {
  float t = uTime;
  vec3 q = vPos * 3.2;
  vec3 warp = vec3(fbm(q + vec3(0.0, 0.0, t * 0.04)), fbm(q + vec3(5.2, 1.3, t * 0.04)), 0.0);
  float conv = fbm(q + warp * 1.8 + vec3(0.0, -t * 0.03, 0.0));

  float heat = conv * 260.0;
  for (int k = 0; k < 2; k++) {
    float base = k == 0 ? 0.95 : 2.25;
    float wobble = 0.035 * sin(rn * 18.0 - t * 0.6 + float(k) * 2.0);
    float width = 0.03 + 0.07 * band(rn, 0.86 + 0.01 * sin(t * 0.3), 0.035);
    float plume = band(theta, base + wobble, width);
    plume *= smoothstep(0.54, 0.57, rn) * (1.0 - smoothstep(0.87, 0.92, rn));
    heat += plume * 900.0;
  }
  slab = 0.0;
  for (int k = 0; k < 2; k++) {
    float start = k == 0 ? 1.45 : 2.75;
    float dip = k == 0 ? 0.55 : -0.45;
    float s = band(theta, start + (1.0 - rn) * dip, 0.018 + (1.0 - rn) * 0.02);
    s *= smoothstep(0.58 + float(k) * 0.15, 0.66 + float(k) * 0.15, rn);
    slab = max(slab, s);
  }
  heat -= slab * 700.0;
  return heat;
}

vec3 materialColor(int li, float frac, float rReal, float kelvin, out float alpha) {
  alpha = 1.0;
  vec3 base = uLayerColors[li];
  float rn = rReal / 6371.0;
  float theta = acos(clamp(vPos.y / max(length(vPos), 1e-4), -1.0, 1.0));
  float t = uTime;

  if (li == 0) {
    vec2 v = voronoi(vPos * 9.0);
    float edge = 1.0 - smoothstep(0.0, 0.06, v.y - v.x);
    float grain = fbm(vPos * 30.0) * 0.5 + 0.5;
    vec3 metal = mix(vec3(0.85, 0.55, 0.22), vec3(1.0, 0.86, 0.55), grain);
    return metal * (0.7 + 0.35 * v.x) + edge * vec3(1.1, 0.9, 0.6);
  }
  if (li == 1) {
    // Time-evolving domain warp: turbulent without shearing into streaks.
    vec3 q = vPos * 4.2;
    vec3 flow = vec3(
      fbm(q * 0.8 + vec3(0.0, t * 0.06, 0.0)),
      fbm(q * 0.8 + vec3(3.1, -t * 0.05, 1.7)),
      fbm(q * 0.8 + vec3(-2.3, 0.4, t * 0.05)));
    float n = fbm(q + flow * 2.2 + vec3(0.0, 0.0, t * 0.04)) * 0.5 + 0.5;
    float streak = pow(n, 3.0);
    vec3 molten = mix(vec3(0.55, 0.1, 0.01), vec3(1.0, 0.42, 0.05), n);
    // Brighter toward the hotter inner core.
    return molten * (0.7 + 0.5 * (1.0 - frac)) + vec3(1.0, 0.7, 0.3) * streak * 1.4;
  }
  if (li == 2) {
    float blob = smoothstep(0.0, 0.35, fbm(vPos * 2.6 + vec3(0.0, t * 0.01, 0.0)));
    vec3 rock = base * (0.45 + 0.25 * blob);
    return rock + blackbody(kelvin - 700.0 + blob * 900.0) * 0.45;
  }
  if (li <= 6) {
    float slab;
    float heat = mantleHeat(rn, theta, slab);
    float grain = fbm(vPos * 26.0) * 0.12;
    vec3 rock = base * (0.5 + grain + heat / 2400.0);
    rock = mix(rock, vec3(0.08, 0.1, 0.16), slab * 0.7);
    float glowScale = li == 6 ? 0.1 : 0.3;
    return rock + blackbody(kelvin + heat) * glowScale;
  }
  if (li == 7) {
    float n = fbm(vPos * vec3(18.0, 60.0, 18.0));
    float strata = 0.5 + 0.5 * sin(rReal * 1.2 + n * 5.0);
    return base * mix(0.45, 0.85, strata) * (0.9 + 0.2 * n);
  }

  // Atmosphere: translucent bands fading with altitude.
  float altitude = rReal - 6371.0;
  alpha = mix(0.5, 0.2, frac);
  if (li == LAYER_COUNT - 1) alpha *= 0.3 * (1.0 - smoothstep(0.0, 0.6, frac));
  vec3 col = base * (0.75 + 0.35 * (1.0 - frac));
  if (li == 9) col += vec3(0.25, 0.55, 1.0) * band(altitude, 25.0, 8.0) * 0.6; // ozone layer
  if (li == 11) {
    float curtain = smoothstep(0.3, 0.9, snoise(vec3(theta * 40.0, t * 0.3, 0.0)) * 0.5 + 0.5);
    col += vec3(0.2, 1.0, 0.5) * band(altitude, 160.0, 60.0) * curtain * 0.8;
  }
  return col;
}

void main() {
  float r = length(vPos);
  int li;
  float frac;
  layerAt(r, li, frac);
  if (uRegion == 0 && li >= INTERIOR) discard;
  if (uRegion == 1 && (li < INTERIOR || r > uDisplay[BOUNDS - 1])) discard;

  float vis = visOf(li);
  if (uRegion == 1) vis = uVis[INTERIOR - 1];
  float burn = dissolve(vPos, vis);
  if (burn < 0.0) discard;

  vec4 prof = profileAt(li, frac);
  float kelvin = prof.x * ${TEMPERATURE_SCALE.toFixed(1)};
  float rReal = realRadius(li, frac);

  float alpha;
  vec3 col = materialColor(li, frac, rReal, kelvin, alpha);

  if (uModeMix > 0.0) {
    float v = uDataMode == 1 ? prof.x : uDataMode == 2 ? prof.y : uDataMode == 3 ? prof.z : prof.w;
    vec3 data = dataRamp(uDataMode, v);
    float contour = abs(fract(v * 10.0 + 0.5) - 0.5) / fwidth(v * 10.0);
    data *= 0.82 + 0.18 * smoothstep(0.0, 1.2, contour);
    float dataAlpha = uRegion == 1 ? (uDataMode == 1 ? 0.55 : 0.12) : 1.0;
    col = mix(col, data, uModeMix);
    alpha = mix(alpha, dataAlpha, uModeMix);
  }

  // Layer boundaries.
  float fw = fwidth(r);
  float line = 0.0;
  float hoverLine = 0.0;
  for (int i = 1; i < BOUNDS; i++) {
    float l = 1.0 - smoothstep(0.0, fw * 1.4, abs(r - uDisplay[i]));
    line = max(line, l);
    if (i == uHover || i == uHover + 1) hoverLine = max(hoverLine, l);
  }

  if (uSelected >= 0 && li != uSelected) {
    float grey = dot(col, vec3(0.3, 0.55, 0.15));
    col = mix(col, vec3(grey) * 0.45, 0.55);
  }
  if (li == uHover) {
    col = col * 1.25 + 0.06;
    alpha = min(1.0, alpha * 1.6);
  }

  col *= uShade;
  col = mix(col, vec3(0.015, 0.012, 0.02), line * (uRegion == 0 ? 0.75 : 0.3));
  col += hoverLine * vec3(1.6, 1.5, 1.3);
  col += vec3(1.0, 0.45, 0.1) * burn * 3.0;

  gl_FragColor = vec4(col, alpha);
  ${outputChunks}
}
`;

const sphereVertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vObj;
varying vec3 vNormalW;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  vObj = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const sphereFragment = /* glsl */ `
${defines}
${noise}
${blackbody}
${planet}

uniform int uLayer;
uniform vec3 uColor;
uniform float uKelvin;
uniform vec3 uSunDir;
uniform int uHover;
uniform int uSelected;
varying vec3 vPos;
varying vec3 vObj;
varying vec3 vNormalW;

void main() {
  if (inWedge(vPos)) discard;
  float burn = dissolve(vPos, visOf(uLayer));
  if (burn < 0.0) discard;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPos);
  float light = 0.3 + 0.7 * max(dot(N, uSunDir), 0.0);
  float t = uTime;
  vec3 col;

  if (uLayer == 0) {
    vec2 v = voronoi(vObj * 6.0);
    float edge = 1.0 - smoothstep(0.0, 0.05, v.y - v.x);
    float grain = fbm(vObj * 14.0) * 0.5 + 0.5;
    vec3 metal = mix(vec3(0.85, 0.55, 0.22), vec3(1.0, 0.85, 0.55), grain);
    col = metal * (0.45 + 0.5 * light) * (0.8 + 0.4 * v.x) + edge * vec3(0.8, 0.65, 0.4);
  } else if (uLayer == 1) {
    // Liquid iron organised into swirling columns by Earth's rotation.
    vec3 q = vec3(vObj.x * 3.0, vObj.y * 8.0, vObj.z * 3.0);
    vec3 flow = vec3(fbm(q * 0.7 + vec3(0.0, 0.0, t * 0.05)), fbm(q * 0.7 + vec3(4.0, 1.0, -t * 0.05)), 0.0);
    float n = fbm(q + flow * 2.0 + vec3(t * 0.03, 0.0, 0.0)) * 0.5 + 0.5;
    vec3 molten = mix(vec3(0.5, 0.09, 0.01), vec3(1.0, 0.45, 0.06), n);
    col = molten * (0.55 + 0.45 * light) + vec3(1.0, 0.7, 0.3) * pow(n, 3.0) * 1.2;
  } else {
    // Rock plates separated by glowing seams, with slow convective drift.
    vec3 q = vObj * (uLayer == 2 ? 4.0 : 6.0) + vec3(0.0, t * 0.01, 0.0);
    q += fbm(q * 0.7 + t * 0.02) * 0.5;
    vec2 v = voronoi(q);
    float seam = 1.0 - smoothstep(0.0, 0.1, v.y - v.x);
    float n = fbm(vObj * 12.0);
    vec3 rock = uColor * (0.35 + 0.2 * n) * light;
    col = rock + blackbody(uKelvin + 400.0 + n * 300.0) * seam * 1.6
               + blackbody(uKelvin) * 0.15;
  }

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += blackbody(uKelvin) * fresnel * 0.35;
  if (uLayer == uHover) col = col * 1.2 + 0.05;
  if (uSelected >= 0 && uSelected != uLayer) col *= 0.55;
  col += vec3(1.0, 0.45, 0.1) * burn * 3.0;

  gl_FragColor = vec4(col, 1.0);
  ${outputChunks}
}
`;

function makeFaceMaterial(region, shade) {
  return new THREE.ShaderMaterial({
    vertexShader: faceVertex,
    fragmentShader: faceFragment,
    uniforms: {
      ...shared,
      uRegion: { value: region },
      uShade: { value: shade },
      uDataMode: { value: 1 },
      uLayerColors: { value: layerColors },
    },
    side: THREE.DoubleSide,
    transparent: region === 1,
    depthWrite: region === 0,
  });
}

export function createInterior() {
  const group = new THREE.Group();

  // Half-disc spanning x ∈ [0, 1], y ∈ [-1, 1]; scaled to the needed radius.
  const faceGeometry = new THREE.PlaneGeometry(1, 2);
  faceGeometry.translate(0.5, 0, 0);

  const faces = [];
  for (const [side, shade] of [
    ['a', 1.0],
    ['b', 0.82],
  ]) {
    const pivot = new THREE.Group();
    const interior = new THREE.Mesh(faceGeometry, makeFaceMaterial(0, shade));
    const atmosphere = new THREE.Mesh(faceGeometry, makeFaceMaterial(1, shade));
    atmosphere.renderOrder = 2;
    interior.userData.probe = true;
    atmosphere.userData.probe = true;
    pivot.add(interior, atmosphere);
    pivot.userData = { side, interior, atmosphere };
    group.add(pivot);
    faces.push(pivot);
  }

  const sphereGeometry = new THREE.SphereGeometry(1, 128, 64);
  const spheres = [];
  for (let i = 0; i < INTERIOR_COUNT - 1; i++) {
    const kelvin = propertiesAt(LAYERS[i].top - 1).temperature;
    const material = new THREE.ShaderMaterial({
      vertexShader: sphereVertex,
      fragmentShader: sphereFragment,
      uniforms: {
        ...shared,
        uLayer: { value: i },
        uColor: { value: new THREE.Color(LAYERS[i].color) },
        uKelvin: { value: kelvin },
      },
    });
    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.userData.layer = i;
    spheres.push(mesh);
    group.add(mesh);
  }

  let atmosphereVisible = true;

  return {
    group,
    faces,
    spheres,
    setDataMode(index) {
      for (const f of faces) {
        f.userData.interior.material.uniforms.uDataMode.value = index;
        f.userData.atmosphere.material.uniforms.uDataMode.value = index;
      }
    },
    setAtmosphereVisible(v) {
      atmosphereVisible = v;
    },
    update(dt, spin) {
      const cut = shared.uCut.value;
      const center = shared.uWedgeCenter.value;
      const showFaces = cut > 0.002;
      const angles = [center - cut / 2, center + cut / 2];
      const surface = scale.display[INTERIOR_COUNT];
      const outer = scale.display[scale.display.length - 1];
      faces.forEach((pivot, k) => {
        pivot.visible = showFaces;
        pivot.rotation.y = -angles[k];
        pivot.userData.interior.scale.setScalar(surface * 1.001);
        pivot.userData.atmosphere.scale.setScalar(outer * 1.001);
        pivot.userData.atmosphere.visible = atmosphereVisible && shared.uVis.value[INTERIOR_COUNT - 1] > 0.01;
      });

      const vis = shared.uVis.value;
      spheres.forEach((mesh, i) => {
        const r = scale.display[i + 1];
        mesh.scale.setScalar(r);
        mesh.rotation.y = spin * (0.6 + i * 0.05);
        // Only draw a sphere when it can be seen: it exists and the layer above is peeling.
        const above = vis[i + 1] ?? 0;
        mesh.visible = vis[i] > 0.001 && above < 0.999;
      });
    },
  };
}
