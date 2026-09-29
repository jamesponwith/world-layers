import * as THREE from 'three';
import { DATA_MODES, INTERIOR_COUNT, LAYERS, layerBottom, propertiesAt } from '../data/earth.js';
import { scale } from '../data/scale.js';

export const PROFILE_TEXELS_PER_LAYER = 64;

// Bakes the physical profiles into a texture indexed by (layer, fraction)
// rather than radius, so thin layers get as much resolution as thick ones.
// Channels: temperature, density, pressure, P-wave speed — each normalised to
// its data-mode range. Half-float so linear filtering needs no extension.
function createProfileTexture() {
  const width = LAYERS.length * PROFILE_TEXELS_PER_LAYER;
  const data = new Uint16Array(width * 4);
  const modes = [DATA_MODES.temperature, DATA_MODES.density, DATA_MODES.pressure, DATA_MODES.vp];
  LAYERS.forEach((layer, li) => {
    const bottom = layerBottom(li);
    for (let k = 0; k < PROFILE_TEXELS_PER_LAYER; k++) {
      const f = k / (PROFILE_TEXELS_PER_LAYER - 1);
      // Nudge inside the layer so discontinuities resolve to this layer's side.
      const r = bottom + (layer.top - bottom) * (0.0005 + f * 0.999);
      const props = propertiesAt(r);
      const o = (li * PROFILE_TEXELS_PER_LAYER + k) * 4;
      modes.forEach((mode, c) => {
        const [lo, hi] = mode.range;
        const inAtmosphere = props.region === 'atmosphere' && c !== 0;
        data[o + c] = THREE.DataUtils.toHalfFloat(inAtmosphere ? 0 : (mode.value(props) - lo) / (hi - lo));
      });
    }
  });
  const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export const MODE_INDEX = { material: 0, temperature: 1, density: 2, pressure: 3, vp: 4 };

// Uniform objects shared by reference between every planet material, so one
// assignment updates them all.
export const shared = {
  uTime: { value: 0 },
  uCut: { value: Math.PI / 2 },
  uWedgeCenter: { value: Math.PI / 4 },
  uDisplay: { value: scale.display },
  uReal: { value: scale.real },
  uVis: { value: new Float32Array(INTERIOR_COUNT).fill(1) },
  uSunDir: { value: new THREE.Vector3(-0.35, 0.3, 1).normalize() },
  uMode: { value: 0 },
  uModeMix: { value: 0 },
  uHover: { value: -1 },
  uSelected: { value: -1 },
  uProfile: { value: createProfileTexture() },
};

export const profileLookup = /* glsl */ `
uniform sampler2D uProfile;
vec4 profileAt(int index, float frac) {
  float texel = float(index) * ${PROFILE_TEXELS_PER_LAYER}.0 + frac * ${PROFILE_TEXELS_PER_LAYER - 1}.0 + 0.5;
  return texture2D(uProfile, vec2(texel / ${LAYERS.length * PROFILE_TEXELS_PER_LAYER}.0, 0.5));
}
`;

// Temperature (K) is channel 0 scaled by the temperature range.
export const TEMPERATURE_SCALE = DATA_MODES.temperature.range[1];
