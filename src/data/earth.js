// Physical model of the Earth's layers.
// Radii are in kilometres from the centre of the Earth. Interior profiles are a
// simplified version of PREM (Dziewonski & Anderson, 1981) with a representative
// geotherm; the atmosphere follows the 1976 US Standard Atmosphere.

export const EARTH_RADIUS_KM = 6371;

// Ordered from the centre outward. `top` is the outer radius (km); `schematicTop`
// is the outer radius in the exaggerated "schematic" view (Earth radius = 1).
export const LAYERS = [
  {
    id: 'inner-core',
    name: 'Inner Core',
    kind: 'interior',
    top: 1221,
    schematicTop: 0.19,
    color: '#fff2c4',
    state: 'Solid',
    composition: 'Iron–nickel alloy with a few percent light elements',
    temperature: '≈ 5,400 – 5,700 K',
    density: '12.8 – 13.1 g/cm³',
    blurb:
      'A ball of iron hotter than the surface of the Sun, kept solid only by crushing pressure — over 3.3 million times atmospheric pressure. It grows about 1 mm per year as the outer core slowly freezes onto it.',
    fact: 'Seismic waves travel faster pole-to-pole than across the equator here: the iron crystals are aligned.',
  },
  {
    id: 'outer-core',
    name: 'Outer Core',
    kind: 'interior',
    top: 3480,
    schematicTop: 0.5,
    color: '#ff9a2e',
    state: 'Liquid',
    composition: 'Molten iron and nickel, ~10% oxygen, sulfur and silicon',
    temperature: '≈ 4,000 – 5,400 K',
    density: '9.9 – 12.2 g/cm³',
    blurb:
      'A churning ocean of liquid metal 2,260 km deep. Convection and Earth’s spin twist its currents into the geodynamo that generates our magnetic field.',
    fact: 'S-waves cannot cross liquid, which is how Richard Oldham and Beno Gutenberg discovered this layer.',
  },
  {
    id: 'd-double-prime',
    name: 'D″ Layer',
    kind: 'interior',
    top: 3671,
    schematicTop: 0.545,
    color: '#8c2f4b',
    state: 'Solid (partially molten patches)',
    composition: 'Post-perovskite, iron-rich silicate piles',
    temperature: '≈ 2,700 – 3,700 K',
    density: '5.5 – 5.6 g/cm³',
    blurb:
      'The graveyard and birthplace of plumes: a thermal boundary layer where subducted slabs come to rest and continent-sized “blobs” (LLSVPs) sit above the core.',
    fact: 'Temperature jumps by over 1,000 K across just a couple hundred kilometres here.',
  },
  {
    id: 'lower-mantle',
    name: 'Lower Mantle',
    kind: 'interior',
    top: 5711,
    schematicTop: 0.74,
    color: '#c2412d',
    state: 'Solid (flows over geologic time)',
    composition: 'Bridgmanite (Mg,Fe)SiO₃ and ferropericlase',
    temperature: '≈ 1,900 – 2,700 K',
    density: '4.4 – 5.5 g/cm³',
    blurb:
      'More than half of Earth’s volume. Hot rock creeps at centimetres per year, carrying heat outward in slow convection cells that drive plate tectonics.',
    fact: 'Bridgmanite, which exists only at these pressures, is the most abundant mineral on Earth.',
  },
  {
    id: 'transition-zone',
    name: 'Transition Zone',
    kind: 'interior',
    top: 5961,
    schematicTop: 0.82,
    color: '#d9683a',
    state: 'Solid',
    composition: 'Wadsleyite and ringwoodite (high-pressure olivine)',
    temperature: '≈ 1,800 – 1,900 K',
    density: '3.7 – 4.0 g/cm³',
    blurb:
      'Between 410 and 660 km deep, olivine collapses into denser crystal structures, producing sharp seismic boundaries.',
    fact: 'Ringwoodite can hold water in its crystals — this zone may store more water than all the oceans.',
  },
  {
    id: 'asthenosphere',
    name: 'Asthenosphere',
    kind: 'interior',
    top: 6271,
    schematicTop: 0.895,
    color: '#ec8b3f',
    state: 'Ductile, ~1% partial melt',
    composition: 'Peridotite (olivine, pyroxene)',
    temperature: '≈ 1,500 – 1,800 K',
    density: '3.4 – 3.5 g/cm³',
    blurb:
      'A weak, slightly molten zone of the upper mantle. The rigid tectonic plates glide over it like rafts.',
    fact: 'It is the source of the basalt magma that erupts at mid-ocean ridges.',
  },
  {
    id: 'lithospheric-mantle',
    name: 'Lithospheric Mantle',
    kind: 'interior',
    top: 6336,
    schematicTop: 0.955,
    color: '#9a6a4a',
    state: 'Rigid solid',
    composition: 'Peridotite',
    temperature: '≈ 800 – 1,500 K',
    density: '3.3 – 3.4 g/cm³',
    blurb:
      'The cold, stiff uppermost mantle, welded to the crust above it. Together they form the tectonic plates.',
    fact: 'Beneath old continents, this keel can reach 250 km deep and be 3 billion years old.',
  },
  {
    id: 'crust',
    name: 'Crust',
    kind: 'interior',
    top: 6371,
    schematicTop: 1,
    color: '#c9b08a',
    state: 'Rigid solid',
    composition: 'Granite (continents) and basalt (ocean floor)',
    temperature: '≈ 290 – 800 K',
    density: '2.7 – 3.0 g/cm³',
    blurb:
      'The thin outer skin we live on: 5–10 km beneath oceans, 30–70 km under continents. Proportionally thinner than an eggshell.',
    fact: 'The deepest hole ever drilled, the Kola Superdeep Borehole, reached just 12.3 km.',
  },
  {
    id: 'troposphere',
    name: 'Troposphere',
    kind: 'atmosphere',
    top: 6383,
    schematicTop: 1.02,
    color: '#7cc4ff',
    state: 'Gas',
    composition: '78% N₂, 21% O₂, ~1% Ar, water vapour',
    temperature: '≈ 217 – 288 K',
    density: '0.36 – 1.2 kg/m³',
    blurb:
      'Where weather happens. Holds ~80% of the atmosphere’s mass and nearly all its water vapour; temperature falls ~6.5 °C per km.',
    fact: 'Cruising airliners fly near its top, the tropopause.',
  },
  {
    id: 'stratosphere',
    name: 'Stratosphere',
    kind: 'atmosphere',
    top: 6421,
    schematicTop: 1.042,
    color: '#5b8cff',
    state: 'Gas',
    composition: 'Dry air with the ozone layer (15–35 km)',
    temperature: '≈ 217 – 271 K',
    density: '0.001 – 0.09 kg/m³',
    blurb:
      'Calm and layered. Ozone absorbs ultraviolet light and warms it from above, so temperature rises with altitude.',
    fact: 'Felix Baumgartner jumped from 39 km, in the middle of the stratosphere.',
  },
  {
    id: 'mesosphere',
    name: 'Mesosphere',
    kind: 'atmosphere',
    top: 6456,
    schematicTop: 1.062,
    color: '#8a6bff',
    state: 'Gas',
    composition: 'Thin air',
    temperature: '≈ 187 – 271 K',
    density: '10⁻⁵ – 10⁻³ kg/m³',
    blurb:
      'The coldest place in the atmosphere. Most meteors burn up here, and glowing noctilucent clouds form near its top.',
    fact: 'At about −90 °C, the mesopause is colder than anywhere on Earth’s surface.',
  },
  {
    id: 'thermosphere',
    name: 'Thermosphere',
    kind: 'atmosphere',
    top: 6971,
    schematicTop: 1.1,
    color: '#c46bff',
    state: 'Ionised gas (ionosphere)',
    composition: 'Atomic oxygen, nitrogen, ions',
    temperature: '≈ 500 – 2,000 K',
    density: '10⁻¹² – 10⁻⁶ kg/m³',
    blurb:
      'Solar X-rays heat it to over 1,000 K, yet it would feel freezing — there are too few molecules to carry heat. Auroras glow and the ISS orbits here.',
    fact: 'Its top expands and contracts by hundreds of kilometres with the solar cycle.',
  },
  {
    id: 'exosphere',
    name: 'Exosphere',
    kind: 'atmosphere',
    top: 16371,
    schematicTop: 1.16,
    color: '#6f7cff',
    state: 'Near-vacuum',
    composition: 'Hydrogen and helium',
    temperature: 'Up to ≈ 2,000 K',
    density: '< 10⁻¹² kg/m³',
    blurb:
      'The fringe where atoms travel on ballistic arcs and can escape to space. It fades gradually into the solar wind.',
    fact: 'Most satellites, including GPS and weather satellites, orbit within or beyond it.',
  },
];

export const INTERIOR_COUNT = LAYERS.filter((l) => l.kind === 'interior').length;
export const SURFACE_INDEX = INTERIOR_COUNT - 1;

export function layerBottom(i) {
  return i === 0 ? 0 : LAYERS[i - 1].top;
}

export function layerIndexAtRadius(rKm) {
  for (let i = 0; i < LAYERS.length; i++) if (rKm <= LAYERS[i].top) return i;
  return LAYERS.length - 1;
}

// Depth (km) → density g/cm³, Vp km/s, Vs km/s, pressure GPa, temperature K.
// Consecutive rows at the same depth describe a discontinuity.
const INTERIOR_PROFILE = [
  [0, 2.6, 5.8, 3.2, 0, 288],
  [20, 2.9, 6.5, 3.75, 0.5, 600],
  [35, 2.9, 6.8, 3.9, 1.0, 800],
  [35, 3.38, 8.11, 4.49, 1.0, 800],
  [100, 3.37, 8.07, 4.47, 3.2, 1500],
  [220, 3.36, 7.99, 4.42, 7.1, 1650],
  [220, 3.44, 8.56, 4.64, 7.1, 1650],
  [410, 3.54, 8.91, 4.77, 13.4, 1800],
  [410, 3.72, 9.13, 4.93, 13.4, 1800],
  [660, 3.99, 10.2, 5.52, 23.8, 1900],
  [660, 4.38, 10.75, 5.95, 23.8, 1900],
  [1000, 4.58, 11.46, 6.38, 38.9, 2050],
  [1500, 4.84, 12.1, 6.62, 61.1, 2250],
  [2000, 5.07, 12.64, 6.82, 84.7, 2450],
  [2700, 5.49, 13.68, 7.27, 124.0, 2700],
  [2891, 5.57, 13.72, 7.26, 135.8, 3700],
  [2891, 9.9, 8.06, 0, 135.8, 3900],
  [3500, 10.9, 9.0, 0, 198, 4300],
  [4500, 11.87, 9.95, 0, 294, 5000],
  [5150, 12.17, 10.36, 0, 329, 5400],
  [5150, 12.76, 11.03, 3.5, 329, 5400],
  [6371, 13.09, 11.26, 3.67, 364, 5700],
];

// Altitude (km) → temperature K, pressure Pa, density kg/m³.
const ATMOSPHERE_PROFILE = [
  [0, 288, 101325, 1.225],
  [5, 256, 54020, 0.736],
  [11, 217, 22632, 0.364],
  [20, 217, 5475, 0.088],
  [32, 229, 868, 0.0132],
  [47, 271, 111, 0.00143],
  [51, 271, 67, 0.00086],
  [71, 214, 4, 6.4e-5],
  [85, 187, 0.37, 7e-6],
  [100, 195, 0.032, 5.6e-7],
  [150, 634, 4.5e-4, 2.1e-9],
  [200, 855, 8.5e-5, 2.5e-10],
  [300, 976, 8.8e-6, 1.9e-11],
  [400, 996, 1.45e-6, 2.8e-12],
  [600, 1000, 8e-8, 1.1e-13],
  [1000, 1000, 7.5e-9, 3e-15],
  [10000, 1000, 1e-12, 1e-19],
];

// Finds the bracketing rows for x in a table sorted by column 0. With duplicate
// x values (discontinuities) `below` picks the row approached from smaller x.
function bracket(table, x) {
  if (x <= table[0][0]) return [table[0], table[0], 0];
  for (let i = 1; i < table.length; i++) {
    if (x < table[i][0] || (x === table[i][0] && i === table.length - 1)) {
      const a = table[i - 1];
      const b = table[i];
      const span = b[0] - a[0];
      return [a, b, span > 0 ? (x - a[0]) / span : 0];
    }
  }
  const last = table[table.length - 1];
  return [last, last, 0];
}

const lerp = (a, b, t) => a + (b - a) * t;
const logLerp = (a, b, t) => Math.exp(lerp(Math.log(a), Math.log(b), t));

// Physical properties at a radius (km). Returns SI-ish values with units noted.
export function propertiesAt(rKm) {
  if (rKm <= EARTH_RADIUS_KM) {
    const depth = EARTH_RADIUS_KM - rKm;
    const [a, b, t] = bracket(INTERIOR_PROFILE, depth);
    return {
      region: 'interior',
      depth,
      density: lerp(a[1], b[1], t) * 1000, // kg/m³
      vp: lerp(a[2], b[2], t),
      vs: lerp(a[3], b[3], t),
      pressure: lerp(a[4], b[4], t) * 1e9, // Pa
      temperature: lerp(a[5], b[5], t),
    };
  }
  const altitude = rKm - EARTH_RADIUS_KM;
  const [a, b, t] = bracket(ATMOSPHERE_PROFILE, altitude);
  return {
    region: 'atmosphere',
    altitude,
    temperature: lerp(a[1], b[1], t),
    pressure: logLerp(a[2], b[2], t),
    density: logLerp(a[3], b[3], t),
    vp: 0,
    vs: 0,
  };
}

// Seismic velocities used by the ray tracer (km/s). The liquid outer core has Vs = 0.
export function seismicVelocity(rKm, wave) {
  const p = propertiesAt(Math.min(rKm, EARTH_RADIUS_KM));
  return wave === 'P' ? p.vp : p.vs;
}

// Data view modes for the cross-section. `value` extracts the plotted quantity
// and `range` fixes the colour scale so the legend is stable.
export const DATA_MODES = {
  material: { label: 'Material' },
  temperature: {
    label: 'Temperature',
    unit: 'K',
    range: [0, 6000],
    value: (p) => p.temperature,
    format: (v) => `${Math.round(v).toLocaleString()} K`,
  },
  density: {
    label: 'Density',
    unit: 'g/cm³',
    range: [0, 13.5],
    value: (p) => p.density / 1000,
    format: (v) => `${v.toFixed(2)} g/cm³`,
  },
  pressure: {
    label: 'Pressure',
    unit: 'GPa',
    range: [0, 370],
    value: (p) => p.pressure / 1e9,
    format: (v) => `${v.toFixed(1)} GPa`,
  },
  vp: {
    label: 'P-wave speed',
    unit: 'km/s',
    range: [0, 14],
    value: (p) => p.vp,
    format: (v) => `${v.toFixed(2)} km/s`,
  },
};

export function formatPressure(pa) {
  if (pa >= 1e9) return `${(pa / 1e9).toFixed(1)} GPa`;
  if (pa >= 1e6) return `${(pa / 1e6).toFixed(1)} MPa`;
  if (pa >= 1e3) return `${(pa / 1e3).toFixed(1)} kPa`;
  if (pa >= 1) return `${pa.toFixed(2)} Pa`;
  return `${pa.toExponential(1)} Pa`;
}

export function formatDensity(kgm3) {
  if (kgm3 >= 100) return `${(kgm3 / 1000).toFixed(2)} g/cm³`;
  if (kgm3 >= 0.01) return `${kgm3.toFixed(3)} kg/m³`;
  return `${kgm3.toExponential(1)} kg/m³`;
}
