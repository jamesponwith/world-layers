import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EARTH_RADIUS_KM } from '../data/earth.js';
import { toDisplay } from '../data/scale.js';
import { defines, noise, planet } from '../shaders/common.js';
import { shared } from './uniforms.js';

// Dipole magnetic field lines (tilted ~11° from the spin axis, squashed on the
// dayside and stretched into a tail on the nightside) and the auroral ovals.

const DIPOLE_TILT = THREE.MathUtils.degToRad(11);
const SHELLS = [1.7, 2.4, 3.4, 4.8, 6.6];
const LONGITUDES = 12;

// Dipole field line: r = L·cos²(λ), from the southern to the northern footpoint.
function fieldLine(L, longitude) {
  const maxLat = Math.acos(Math.sqrt(1 / L));
  const points = [];
  const steps = 96;
  for (let s = 0; s <= steps; s++) {
    const lat = -maxLat + (2 * maxLat * s) / steps;
    const r = L * Math.cos(lat) ** 2;
    points.push(
      new THREE.Vector3(
        r * Math.cos(lat) * Math.cos(longitude),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(longitude),
      ),
    );
  }
  return new THREE.CatmullRomCurve3(points);
}

const fieldVertex = /* glsl */ `
attribute float aSeed;
uniform vec3 uSunDir;
varying vec2 vUv;
varying float vSeed;
varying float vNight;
void main() {
  vUv = uv;
  vSeed = aSeed;
  vec4 world = modelMatrix * vec4(position, 1.0);
  float r = length(world.xyz);
  float s = dot(normalize(world.xyz), uSunDir);
  float k = 1.0 - 0.28 * max(s, 0.0) * smoothstep(1.3, 5.0, r)
                + 0.9 * max(-s, 0.0) * smoothstep(1.6, 6.5, r);
  world.xyz *= k;
  vNight = -s;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const fieldFragment = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;
varying float vSeed;
varying float vNight;
void main() {
  float pulse = fract(vUv.x * 3.0 - uTime * 0.12 + vSeed);
  float head = pow(pulse, 18.0) * 2.5;
  float ends = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  vec3 base = mix(vec3(0.2, 0.55, 1.0), vec3(0.55, 0.35, 1.0), smoothstep(-0.5, 0.8, vNight));
  vec3 col = base * (0.28 + head) * ends;
  gl_FragColor = vec4(col * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

const auroraVertex = /* glsl */ `
attribute float aAngle;
attribute float aHeight;
attribute float aHemisphere;
uniform float uTime;
uniform float uR0;
uniform float uR1;
varying float vHeight;
varying float vAngle;
varying vec3 vPos;
void main() {
  float colat = 0.36 + 0.035 * sin(aAngle * 5.0 + uTime * 0.25) + 0.015 * sin(aAngle * 13.0 - uTime * 0.6);
  vec3 dir = vec3(sin(colat) * cos(aAngle), cos(colat) * aHemisphere, sin(colat) * sin(aAngle));
  vec4 world = modelMatrix * vec4(dir * mix(uR0, uR1, aHeight), 1.0);
  vHeight = aHeight;
  vAngle = aAngle;
  vPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const auroraFragment = /* glsl */ `
${defines}
${noise}
${planet}
uniform vec3 uSunDir;
uniform float uOpacity;
varying float vHeight;
varying float vAngle;
varying vec3 vPos;
void main() {
  if (inWedge(vPos)) discard;
  float rays = snoise(vec3(vAngle * 26.0, uTime * 0.35, 0.0)) * 0.5 + 0.5;
  rays = mix(rays, snoise(vec3(vAngle * 70.0, uTime * 0.9, 3.0)) * 0.5 + 0.5, 0.4);
  float curtain = smoothstep(0.25, 0.85, rays);
  float lower = smoothstep(0.0, 0.08, vHeight);
  float upper = 1.0 - smoothstep(0.2, 1.0, vHeight);
  vec3 col = mix(vec3(0.15, 1.0, 0.45), vec3(0.75, 0.2, 0.85), smoothstep(0.35, 0.95, vHeight));
  float night = smoothstep(0.35, -0.25, dot(normalize(vPos), uSunDir));
  float intensity = curtain * lower * upper * mix(0.2, 1.0, night) * 2.2;
  gl_FragColor = vec4(col * intensity * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

function auroraGeometry() {
  const segments = 360;
  const positions = [];
  const angles = [];
  const heights = [];
  const hemispheres = [];
  const index = [];
  for (const hemisphere of [1, -1]) {
    const start = positions.length / 3;
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      for (const h of [0, 1]) {
        positions.push(0, 0, 0);
        angles.push(a);
        heights.push(h);
        hemispheres.push(hemisphere);
      }
    }
    for (let i = 0; i < segments; i++) {
      const a = start + i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1));
  g.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));
  g.setAttribute('aHemisphere', new THREE.Float32BufferAttribute(hemispheres, 1));
  g.setIndex(index);
  // Positions are computed in the vertex shader; give culling a sane bound.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
  return g;
}

export function createMagnetosphere() {
  const spinGroup = new THREE.Group();
  const tilted = new THREE.Group();
  tilted.rotation.z = DIPOLE_TILT;
  spinGroup.add(tilted);

  const tubes = [];
  SHELLS.forEach((L, li) => {
    for (let k = 0; k < LONGITUDES; k++) {
      const lon = (k / LONGITUDES) * Math.PI * 2 + li * 0.2;
      const tube = new THREE.TubeGeometry(fieldLine(L, lon), 160, 0.0045 + L * 0.0008, 5, false);
      const seed = Math.random();
      tube.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(tube.attributes.position.count).fill(seed), 1));
      tubes.push(tube);
    }
  });
  const fieldMaterial = new THREE.ShaderMaterial({
    vertexShader: fieldVertex,
    fragmentShader: fieldFragment,
    uniforms: { uTime: shared.uTime, uSunDir: shared.uSunDir, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const field = new THREE.Mesh(mergeGeometries(tubes), fieldMaterial);
  field.frustumCulled = false;
  tilted.add(field);

  const auroraMaterial = new THREE.ShaderMaterial({
    vertexShader: auroraVertex,
    fragmentShader: auroraFragment,
    uniforms: { ...shared, uR0: { value: 1.02 }, uR1: { value: 1.08 }, uOpacity: { value: 0 } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const aurora = new THREE.Mesh(auroraGeometry(), auroraMaterial);
  aurora.renderOrder = 4;
  tilted.add(aurora);

  const fade = { field: 0, aurora: 0 };
  return {
    group: spinGroup,
    update(dt, spin, toggles, surfaceVisible) {
      spinGroup.rotation.y = spin;
      const approach = (v, target) => v + (target - v) * Math.min(1, dt * 4);
      fade.field = approach(fade.field, toggles.magnetosphere ? 1 : 0);
      fade.aurora = approach(fade.aurora, toggles.aurora && surfaceVisible ? 1 : 0);
      field.visible = fade.field > 0.01;
      aurora.visible = fade.aurora > 0.01;
      fieldMaterial.uniforms.uOpacity.value = fade.field;
      auroraMaterial.uniforms.uOpacity.value = fade.aurora;
      auroraMaterial.uniforms.uR0.value = toDisplay(EARTH_RADIUS_KM + 95);
      auroraMaterial.uniforms.uR1.value = Math.max(toDisplay(EARTH_RADIUS_KM + 320), 1.035);
    },
  };
}
