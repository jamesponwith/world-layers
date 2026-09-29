import * as THREE from 'three';
import { EARTH_RADIUS_KM, INTERIOR_COUNT, LAYERS } from '../data/earth.js';
import { scale, toDisplay } from '../data/scale.js';
import { defines, noise, outputChunks, planet } from '../shaders/common.js';
import { shared } from './uniforms.js';

// The planet's surface, clouds, atmospheric glow and the atmosphere layer shells.

const loader = new THREE.TextureLoader();
function texture(name, srgb = true) {
  const tex = loader.load(`${import.meta.env.BASE_URL}textures/${name}`);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const worldVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vObjN;
void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPos = world.xyz;
  vObjN = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const surfaceFragment = /* glsl */ `
${defines}
${noise}
${planet}
uniform mat4 modelMatrix;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uSpec;
uniform sampler2D uNormal;
uniform sampler2D uCloudMap;
uniform float uCloudShift;
uniform vec3 uSunDir;
uniform int uHover;
uniform int uSelected;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormalW;
varying vec3 vObjN;

void main() {
  if (inWedge(vPos)) discard;
  float burn = dissolve(vPos, uVis[INTERIOR - 1]);
  if (burn < 0.0) discard;

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPos);

  // Tangent frame of the UV sphere: T points east, B north.
  vec3 n = normalize(vObjN);
  vec3 T = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 B = cross(n, T);
  vec3 nm = texture2D(uNormal, vUv).xyz * 2.0 - 1.0;
  nm.xy *= 0.9;
  vec3 Nd = normalize(mat3(modelMatrix) * normalize(T * nm.x + B * nm.y + n * nm.z));

  float sunDot = dot(N, uSunDir);
  float dayMix = smoothstep(-0.1, 0.22, sunDot);
  float diffuse = max(dot(Nd, uSunDir), 0.0);

  vec3 day = texture2D(uDay, vUv).rgb;
  float water = texture2D(uSpec, vUv).r;
  float cloudShadow = texture2D(uCloudMap, vUv - vec2(uCloudShift, 0.0)).a;

  vec3 H = normalize(uSunDir + V);
  float nh = max(dot(N, H), 0.0);
  float spec = (pow(nh, 70.0) * 1.4 + pow(nh, 9.0) * 0.08) * water;

  vec3 col = day * (diffuse * 1.15 + 0.015) * (1.0 - cloudShadow * 0.45 * dayMix);
  col += spec * vec3(1.0, 0.9, 0.72) * dayMix * (1.0 - cloudShadow);

  vec3 lights = texture2D(uNight, vUv).rgb;
  col += pow(lights, vec3(1.3)) * vec3(1.0, 0.72, 0.42) * (1.0 - dayMix) * 2.2 * (1.0 - cloudShadow * 0.6);

  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += vec3(0.3, 0.55, 1.0) * fresnel * (dayMix * 0.9 + 0.04);
  col += vec3(1.0, 0.42, 0.12) * exp(-pow(sunDot / 0.12, 2.0)) * fresnel * 0.5;

  if (uHover == INTERIOR - 1) col = col * 1.2 + 0.03;
  if (uSelected >= 0 && uSelected != INTERIOR - 1) col *= 0.55;
  col += vec3(1.0, 0.45, 0.1) * burn * 3.0;

  gl_FragColor = vec4(col, 1.0);
  ${outputChunks}
}
`;

const cloudFragment = /* glsl */ `
${defines}
${noise}
${planet}
uniform sampler2D uCloudMap;
uniform vec3 uSunDir;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vPos;
varying vec3 vNormalW;

void main() {
  if (inWedge(vPos)) discard;
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPos);
  float c = texture2D(uCloudMap, vUv).a;
  float sunDot = dot(N, uSunDir);
  float light = smoothstep(-0.15, 0.35, sunDot);
  vec3 col = mix(vec3(0.015, 0.02, 0.04), vec3(1.0), light);
  col = mix(col, vec3(1.0, 0.55, 0.3), exp(-pow(sunDot / 0.1, 2.0)) * 0.5);
  float edge = smoothstep(0.0, 0.25, dot(N, V));
  gl_FragColor = vec4(col, c * 0.9 * uOpacity * mix(0.4, 1.0, edge));
  ${outputChunks}
}
`;

// Back-faced shell: glow strongest just outside the planet's limb.
const haloFragment = /* glsl */ `
uniform vec3 uSunDir;
uniform float uLimb;
uniform float uOpacity;
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPos);
  float d = clamp(-dot(N, V) / uLimb, 0.0, 1.0);
  float glow = pow(d, 3.5);
  float sun = dot(normalize(vPos), uSunDir);
  float lit = smoothstep(-0.35, 0.4, sun);
  vec3 col = mix(vec3(0.25, 0.5, 1.0), vec3(1.0, 0.5, 0.2), exp(-pow(sun / 0.25, 2.0)) * 0.7);
  gl_FragColor = vec4(col * glow * (lit * 1.4 + 0.04) * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

const shellFragment = /* glsl */ `
${defines}
${noise}
${planet}
uniform vec3 uColor;
uniform float uOpacity;
uniform int uLayer;
uniform int uHover;
varying vec3 vPos;
varying vec3 vNormalW;
void main() {
  if (inWedge(vPos)) discard;
  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vPos);
  float rim = pow(1.0 - abs(dot(N, V)), 6.0);
  float boost = uLayer == uHover ? 2.5 : uLayer == LAYER_COUNT - 1 ? 0.35 : 1.0;
  gl_FragColor = vec4(uColor * rim * 0.1 * boost * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

export function createEarth() {
  const group = new THREE.Group();
  const cloudMap = texture('earth_clouds_1024.png', false);

  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 96),
    new THREE.ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: surfaceFragment,
      uniforms: {
        ...shared,
        uDay: { value: texture('earth_atmos_2048.jpg') },
        uNight: { value: texture('earth_lights_2048.png') },
        uSpec: { value: texture('earth_specular_2048.jpg', false) },
        uNormal: { value: texture('earth_normal_2048.jpg', false) },
        uCloudMap: { value: cloudMap },
        uCloudShift: { value: 0 },
      },
    }),
  );
  surface.userData.layer = INTERIOR_COUNT - 1;
  group.add(surface);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(1, 128, 64),
    new THREE.ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: cloudFragment,
      uniforms: { ...shared, uCloudMap: { value: cloudMap }, uOpacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
    }),
  );
  clouds.renderOrder = 1;
  group.add(clouds);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 48),
    new THREE.ShaderMaterial({
      vertexShader: worldVertex,
      fragmentShader: haloFragment,
      uniforms: { uSunDir: shared.uSunDir, uLimb: { value: 0.3 }, uOpacity: { value: 1 } },
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(halo);

  const shells = LAYERS.map((layer, i) => {
    if (layer.kind !== 'atmosphere') return null;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 96, 48),
      new THREE.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: shellFragment,
        uniforms: {
          ...shared,
          uColor: { value: new THREE.Color(layer.color) },
          uOpacity: { value: 0 },
          uLayer: { value: i },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.renderOrder = 3;
    group.add(mesh);
    return mesh;
  }).filter(Boolean);

  let cloudSpin = 0;
  const fade = { clouds: 1, atmosphere: 1 };

  return {
    group,
    surface,
    update(dt, spin, toggles) {
      const surfaceVis = shared.uVis.value[INTERIOR_COUNT - 1];
      surface.visible = surfaceVis > 0.001;
      surface.rotation.y = spin;

      cloudSpin += dt * 0.004;
      const shift = (cloudSpin % (Math.PI * 2)) / (Math.PI * 2);
      surface.material.uniforms.uCloudShift.value = shift;

      const approach = (v, target) => v + (target - v) * Math.min(1, dt * 5);
      fade.clouds = approach(fade.clouds, toggles.clouds && surfaceVis > 0.99 ? 1 : 0);
      fade.atmosphere = approach(fade.atmosphere, toggles.atmosphere && surfaceVis > 0.99 ? 1 : 0);

      clouds.visible = fade.clouds > 0.01;
      clouds.rotation.y = spin + cloudSpin;
      clouds.material.uniforms.uOpacity.value = fade.clouds;
      clouds.scale.setScalar(Math.max(toDisplay(EARTH_RADIUS_KM + 8), 1.004));

      const haloRadius = Math.max(toDisplay(EARTH_RADIUS_KM + 60), 1.025);
      halo.scale.setScalar(haloRadius);
      halo.visible = fade.atmosphere > 0.01;
      halo.material.uniforms.uLimb.value = Math.sqrt(1 - 1 / (haloRadius * haloRadius));
      halo.material.uniforms.uOpacity.value = fade.atmosphere;

      shells.forEach((mesh, k) => {
        const i = INTERIOR_COUNT + k;
        mesh.scale.setScalar(scale.display[i + 1]);
        mesh.visible = fade.atmosphere > 0.01;
        mesh.material.uniforms.uOpacity.value = fade.atmosphere;
      });
    },
  };
}
