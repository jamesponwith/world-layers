import { EARTH_RADIUS_KM, LAYERS } from './earth.js';

// Maps physical radius (km) to scene units. The view blends between true scale
// (Earth radius = 1) and a schematic scale that exaggerates thin layers, so the
// 35 km crust and 12 km troposphere stay visible. Both agree at the surface.

export const BOUNDARY_COUNT = LAYERS.length + 1;
const realBounds = [0, ...LAYERS.map((l) => l.top)];
const schematicBounds = [0, ...LAYERS.map((l) => l.schematicTop)];

export const scale = {
  schematic: 1, // 0 = true scale, 1 = schematic; animated between
  target: 1,
  display: new Float32Array(BOUNDARY_COUNT),
  real: Float32Array.from(realBounds),
};

function refresh() {
  for (let i = 0; i < BOUNDARY_COUNT; i++) {
    const truth = realBounds[i] / EARTH_RADIUS_KM;
    scale.display[i] = truth + (schematicBounds[i] - truth) * scale.schematic;
  }
}
refresh();

// Returns true while still animating.
export function updateScale(dt) {
  const d = scale.target - scale.schematic;
  if (Math.abs(d) < 1e-4) {
    if (scale.schematic !== scale.target) {
      scale.schematic = scale.target;
      refresh();
    }
    return false;
  }
  scale.schematic += d * Math.min(1, dt * 4);
  refresh();
  return true;
}

export function toDisplay(rKm) {
  const last = BOUNDARY_COUNT - 1;
  if (rKm >= realBounds[last]) {
    return scale.display[last] + (rKm - realBounds[last]) / EARTH_RADIUS_KM;
  }
  for (let i = 1; i <= last; i++) {
    if (rKm <= realBounds[i]) {
      const t = (rKm - realBounds[i - 1]) / (realBounds[i] - realBounds[i - 1]);
      return scale.display[i - 1] + t * (scale.display[i] - scale.display[i - 1]);
    }
  }
  return scale.display[last];
}

export function toReal(rDisplay) {
  const last = BOUNDARY_COUNT - 1;
  if (rDisplay >= scale.display[last]) {
    return realBounds[last] + (rDisplay - scale.display[last]) * EARTH_RADIUS_KM;
  }
  for (let i = 1; i <= last; i++) {
    if (rDisplay <= scale.display[i]) {
      const t = (rDisplay - scale.display[i - 1]) / (scale.display[i] - scale.display[i - 1]);
      return realBounds[i - 1] + t * (realBounds[i] - realBounds[i - 1]);
    }
  }
  return realBounds[last];
}
