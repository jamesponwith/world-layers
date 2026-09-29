import {
  DATA_MODES,
  EARTH_RADIUS_KM as R,
  INTERIOR_COUNT,
  LAYERS,
  formatDensity,
  formatPressure,
  layerBottom,
} from '../data/earth.js';
import { TOUR } from '../data/tour.js';
import { WAVES } from '../scene/seismic.js';
import { createChart } from './chart.js';
import { icon } from './icons.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (v) => Math.round(v).toLocaleString();

export function layerRange(i) {
  const layer = LAYERS[i];
  const bottom = layerBottom(i);
  if (layer.kind === 'interior') return { from: R - layer.top, to: R - bottom, word: 'Depth' };
  return { from: bottom - R, to: layer.top - R, word: 'Altitude' };
}

function rangeText(i) {
  const { from, to } = layerRange(i);
  return `${fmt(from)}–${fmt(to)} km`;
}

// Colour ramps mirrored from the shaders, for the legend (sRGB 0–1).
function inferno(t) {
  const c = [
    [0.0002189403691192265, 0.001651004631001012, -0.01948089843709184],
    [0.1065134194856116, 0.5639564367884091, 3.932712388889277],
    [11.60249308247187, -3.972853965665698, -15.9423941062914],
    [-41.70399613139459, 17.43639888205313, 44.35414519872813],
    [77.162935699427, -33.40235894210092, -81.80730925738993],
    [-71.31942824499214, 32.62606426397723, 73.20951985803202],
    [25.13112622477341, -12.24266895238567, -23.07032500287172],
  ];
  return [0, 1, 2].map((k) => c.reduceRight((acc, row) => acc * t + row[k], 0));
}
const HUE_RAMPS = {
  density: [
    [0.03, 0.09, 0.12],
    [0.05, 0.47, 0.52],
    [0.72, 0.97, 0.93],
  ],
  pressure: [
    [0.08, 0.04, 0.16],
    [0.45, 0.28, 0.78],
    [0.93, 0.87, 1.0],
  ],
  vp: [
    [0.04, 0.07, 0.18],
    [0.16, 0.42, 0.85],
    [0.85, 0.93, 1.0],
  ],
};
function rampColor(mode, t) {
  let c;
  if (mode === 'temperature') c = inferno(t);
  else {
    const [a, b, d] = HUE_RAMPS[mode];
    const [x, y, u] = t < 0.5 ? [a, b, t * 2] : [b, d, t * 2 - 1];
    c = x.map((v, k) => v + (y[k] - v) * u);
  }
  return `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
}

const MODE_BUTTONS = [
  ['material', 'Material'],
  ['temperature', 'Temperature'],
  ['density', 'Density'],
  ['pressure', 'Pressure'],
  ['vp', 'Velocity'],
];

const TOGGLES = [
  ['atmosphere', 'wind', 'Atmosphere (A)'],
  ['clouds', 'cloud', 'Clouds (C)'],
  ['aurora', 'sparkles', 'Aurora'],
  ['magnetosphere', 'magnet', 'Magnetosphere (M)'],
  ['labels', 'tag', 'Labels (L)'],
  ['rotate', 'rotate', 'Rotate (Space)'],
];

export function createUI(store, actions) {
  const { state } = store;

  // Layers panel ----------------------------------------------------------
  const layersPanel = $('#layers-panel');
  const row = (i) => `
    <button class="layer-row" data-layer="${i}">
      <span class="swatch" style="background:${LAYERS[i].color}"></span>
      <span class="name">${LAYERS[i].name}</span>
      <span class="range">${rangeText(i)}</span>
    </button>`;
  const atmosphereRows = LAYERS.map((_, i) => i).filter((i) => i >= INTERIOR_COUNT).reverse();
  const interiorRows = LAYERS.map((_, i) => i).filter((i) => i < INTERIOR_COUNT).reverse();
  layersPanel.innerHTML = `
    <div class="group-title"><span>Atmosphere</span><span>altitude</span></div>
    ${atmosphereRows.map(row).join('')}
    <div class="surface-divider">Surface</div>
    <div class="group-title"><span>Interior</span><span>depth</span></div>
    ${interiorRows.map(row).join('')}
  `;
  const rows = [...layersPanel.querySelectorAll('.layer-row')];
  layersPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-layer]');
    if (btn) actions.selectLayer(Number(btn.dataset.layer), { fly: true });
  });
  layersPanel.addEventListener('pointerover', (e) => {
    const btn = e.target.closest('[data-layer]');
    if (btn) store.set({ hover: Number(btn.dataset.layer) });
  });
  layersPanel.addEventListener('pointerleave', () => store.set({ hover: -1 }));

  // Info panel ------------------------------------------------------------
  const infoPanel = $('#info-panel');
  infoPanel.innerHTML = `
    <div class="info-content"></div>
    <div class="chart">
      <div class="chart-heading">Profile</div>
      <div class="chart-root"></div>
    </div>`;
  const infoContent = infoPanel.querySelector('.info-content');
  const chart = createChart(infoPanel.querySelector('.chart-root'), {
    onHover: (rKm) => actions.probeRadius(rKm),
  });

  function renderInfo() {
    const i = state.selected;
    infoPanel.classList.toggle('overview', i < 0);
    if (i < 0) {
      infoContent.innerHTML = `
        <div class="eyebrow">Planet Earth</div>
        <h2 class="info-title">Journey to the centre</h2>
        <div class="hero-stats">
          <div class="stat"><div class="stat-label">Radius</div><div class="stat-value">6,371 km</div></div>
          <div class="stat"><div class="stat-label">Core heat</div><div class="stat-value">5,700 K</div></div>
          <div class="stat"><div class="stat-label">Layers</div><div class="stat-value">${LAYERS.length}</div></div>
        </div>
        <p class="info-blurb">From the edge of space to a solid iron heart, Earth is a stack of layers, each with its own physics. Hover the cross-section to probe temperature, pressure and density at any depth.</p>
        <ul class="tips">
          <li><kbd>Drag</kbd><span>Orbit · scroll to zoom</span></li>
          <li><kbd>Click</kbd><span>a layer to learn about it</span></li>
          <li><kbd>Q</kbd><span>Trigger an earthquake and watch the waves</span></li>
          <li><kbd>T</kbd><span>Take the guided tour</span></li>
        </ul>
        <div class="info-actions">
          <button class="btn primary" data-action="tour">${icon('play', 15)}Start the tour</button>
          <button class="btn" data-action="quake">${icon('activity', 15)}Earthquake</button>
        </div>`;
      chart.setLayer(-1);
      return;
    }
    const layer = LAYERS[i];
    const { from, to, word } = layerRange(i);
    const interior = layer.kind === 'interior';
    const position = interior
      ? `Interior · layer ${INTERIOR_COUNT - i} of ${INTERIOR_COUNT} from the surface`
      : `Atmosphere · layer ${i - INTERIOR_COUNT + 1} of ${LAYERS.length - INTERIOR_COUNT}`;
    infoContent.innerHTML = `
      <button class="close" data-action="deselect" aria-label="Close">${icon('x', 16)}</button>
      <div class="eyebrow">${position}</div>
      <h2 class="info-title"><span class="swatch" style="background:${layer.color}"></span>${layer.name}</h2>
      <div class="info-range">${word} ${fmt(from)} – ${fmt(to)} km · ${fmt(to - from)} km thick</div>
      <div class="stats">
        <div class="stat"><div class="stat-label">State</div><div class="stat-value">${layer.state}</div></div>
        <div class="stat"><div class="stat-label">Temperature</div><div class="stat-value">${layer.temperature}</div></div>
        <div class="stat"><div class="stat-label">Density</div><div class="stat-value">${layer.density}</div></div>
        <div class="stat wide"><div class="stat-label">Made of</div><div class="stat-value">${layer.composition}</div></div>
      </div>
      <p class="info-blurb">${layer.blurb}</p>
      <div class="fact">${icon('bulb', 16)}<span>${layer.fact}</span></div>
      <div class="info-actions">
        <button class="btn" data-action="fly">${icon('target', 15)}Fly to</button>
        ${interior && i < INTERIOR_COUNT - 1 ? `<button class="btn" data-action="peel">${icon('peel', 15)}Peel down to here</button>` : ''}
      </div>`;
    chart.setLayer(i);
  }

  infoPanel.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    if (act === 'deselect') actions.selectLayer(-1);
    if (act === 'fly') actions.flyToLayer(state.selected);
    if (act === 'peel') store.set({ peel: state.selected });
    if (act === 'tour') actions.startTour();
    if (act === 'quake') actions.triggerQuake();
  });

  // Dock ------------------------------------------------------------------
  const dock = $('#dock');
  dock.innerHTML = `
    <div class="dock-group segmented" role="radiogroup" aria-label="View mode">
      ${MODE_BUTTONS.map(([k, label], n) => `<button role="radio" data-mode="${k}" title="${label} (${n + 1})">${label}</button>`).join('')}
    </div>
    <div class="dock-sep"></div>
    <label class="slider">
      ${icon('scissors', 16)}
      <span class="slider-body">
        <span class="slider-label">Cutaway <b data-out="cut"></b></span>
        <input type="range" min="0" max="270" step="1" data-input="cut" aria-label="Cutaway angle" />
      </span>
    </label>
    <label class="slider">
      ${icon('layers', 16)}
      <span class="slider-body">
        <span class="slider-label">Reveal <b data-out="peel"></b></span>
        <input type="range" min="0" max="${INTERIOR_COUNT - 1}" step="1" data-input="peel" aria-label="Peel layers" />
      </span>
    </label>
    <div class="dock-sep"></div>
    <div class="dock-group">
      <button class="icon-btn" data-scale title="True scale (S)" aria-label="True scale">${icon('ruler')}</button>
      ${TOGGLES.map(([k, ic, tip]) => `<button class="icon-btn" data-toggle="${k}" title="${tip}" aria-label="${tip}">${icon(ic)}</button>`).join('')}
      <button class="icon-btn" data-action="snapshot" title="Save image (P)" aria-label="Save image">${icon('camera')}</button>
      <button class="icon-btn" data-action="help" title="Shortcuts (?)" aria-label="Keyboard shortcuts">${icon('keyboard')}</button>
    </div>
    <div class="dock-sep"></div>
    <div class="dock-group">
      <button class="action-btn quake" data-action="quake" title="Trigger an earthquake (Q)">${icon('activity', 16)}<span>Earthquake</span></button>
      <button class="action-btn primary" data-action="tour" title="Guided tour (T)">${icon('play', 14)}Tour</button>
    </div>`;

  const cutInput = dock.querySelector('[data-input="cut"]');
  const peelInput = dock.querySelector('[data-input="peel"]');
  const setFill = (input) => {
    const t = (input.value - input.min) / (input.max - input.min);
    input.style.setProperty('--fill', `${t * 100}%`);
  };
  cutInput.addEventListener('input', () => store.set({ cut: Number(cutInput.value) }));
  peelInput.addEventListener('input', () => store.set({ peel: INTERIOR_COUNT - 1 - Number(peelInput.value) }));

  dock.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) store.set({ mode: t.dataset.mode });
    if ('scale' in t.dataset) store.set({ schematic: !state.schematic });
    if (t.dataset.toggle) store.toggle(t.dataset.toggle);
    const act = t.dataset.action;
    if (act === 'quake') actions.triggerQuake();
    if (act === 'tour') (state.touring ? actions.stopTour : actions.startTour)();
    if (act === 'snapshot') actions.snapshot();
    if (act === 'help') toggleHelp();
  });

  function renderDock() {
    dock.querySelectorAll('[data-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === state.mode);
      b.setAttribute('aria-checked', b.dataset.mode === state.mode);
    });
    dock.querySelector('[data-scale]').setAttribute('aria-pressed', !state.schematic);
    dock.querySelectorAll('[data-toggle]').forEach((b) => b.setAttribute('aria-pressed', state.toggles[b.dataset.toggle]));
    cutInput.value = state.cut;
    peelInput.value = INTERIOR_COUNT - 1 - state.peel;
    setFill(cutInput);
    setFill(peelInput);
    dock.querySelector('[data-out="cut"]').textContent = `${state.cut}°`;
    dock.querySelector('[data-out="peel"]').textContent = LAYERS[state.peel].name;
    const tourBtn = dock.querySelector('[data-action="tour"]');
    tourBtn.innerHTML = state.touring ? `${icon('x', 14)}<span>End tour</span>` : `${icon('play', 14)}<span>Tour</span>`;
  }

  // Legend ----------------------------------------------------------------
  const legend = $('#legend');
  function renderLegend() {
    const mode = DATA_MODES[state.mode];
    legend.classList.toggle('visible', state.mode !== 'material');
    if (state.mode === 'material') return;
    const stops = Array.from({ length: 17 }, (_, k) => `${rampColor(state.mode, k / 16)} ${(k / 16) * 100}%`);
    const [lo, hi] = mode.range;
    const mid = (lo + hi) / 2;
    legend.innerHTML = `
      <div class="legend-title">${mode.label}<span>${mode.unit}</span></div>
      <div class="legend-ramp" style="background:linear-gradient(90deg, ${stops.join(',')})"></div>
      <div class="legend-scale"><span>${fmt(lo)}</span><span>${fmt(mid)}</span><span>${fmt(hi)}</span></div>`;
  }

  // Probe tooltip -----------------------------------------------------------
  const tooltip = $('#tooltip');
  function showProbe(probe, x, y) {
    if (!probe) {
      tooltip.classList.remove('visible');
      return;
    }
    const layer = LAYERS[probe.layer];
    const p = probe.props;
    const rows = [];
    if (p.region === 'interior') {
      rows.push(['Depth', `${fmt(p.depth)} km`]);
      rows.push(['Temperature', `${fmt(p.temperature)} K`]);
      rows.push(['Pressure', formatPressure(p.pressure)]);
      rows.push(['Density', formatDensity(p.density)]);
      rows.push(['P / S waves', `${p.vp.toFixed(1)} / ${p.vs.toFixed(1)} km/s`]);
    } else {
      rows.push(['Altitude', `${fmt(p.altitude)} km`]);
      rows.push(['Temperature', `${fmt(p.temperature)} K`]);
      rows.push(['Pressure', formatPressure(p.pressure)]);
      rows.push(['Density', formatDensity(p.density)]);
    }
    tooltip.innerHTML = `
      <div class="tt-head"><i style="background:${layer.color}"></i>${layer.name}</div>
      ${rows.map(([k, v]) => `<div class="tt-row"><span>${k}</span><b>${v}</b></div>`).join('')}
      <div class="tt-hint">${probe.surface ? 'Top of layer · ' : ''}Click to learn more</div>`;
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    const left = x + 18 + w > innerWidth ? x - w - 18 : x + 18;
    const top = Math.min(Math.max(8, y - h / 2), innerHeight - h - 8);
    tooltip.style.transform = `translate(${left}px, ${top}px)`;
    tooltip.classList.add('visible');
  }

  // Seismic HUD -------------------------------------------------------------
  const hud = $('#seismic-hud');
  let hudShadows = null;
  function renderHud(seismic) {
    const visible = seismic.group.visible;
    hud.classList.toggle('visible', visible);
    if (!visible) return;
    if (hudShadows !== seismic.shadows) {
      hudShadows = seismic.shadows;
      const { P, S } = seismic.shadows;
      hud.innerHTML = `
        <div>
          <div class="eyebrow">Earthquake · since rupture</div>
          <div class="hud-clock"></div>
        </div>
        <div class="hud-keys">
          <div class="hud-row"><i style="background:${WAVES.P.color.getStyle()}"></i>${WAVES.P.label}</div>
          <div class="hud-row shadow"><i style="background:${WAVES.P.color.getStyle()}"></i>P shadow ${Math.round(P.from)}°–${Math.round(P.to)}°</div>
          <div class="hud-row"><i style="background:${WAVES.S.color.getStyle()}"></i>${WAVES.S.label}</div>
          <div class="hud-row shadow"><i style="background:${WAVES.S.color.getStyle()}"></i>S shadow beyond ${Math.round(S.from)}°</div>
        </div>
        <div class="hud-note">Rays are traced through this model’s velocity profile. The liquid outer core stops S-waves and bends P-waves, leaving the shadow zones that revealed the core in 1914.</div>`;
    }
    const t = seismic.state.clock;
    const mm = String(Math.floor(t / 60)).padStart(2, '0');
    const ss = String(Math.floor(t % 60)).padStart(2, '0');
    hud.querySelector('.hud-clock').textContent = `T + ${mm}:${ss}`;
  }

  // Tour card ---------------------------------------------------------------
  const tourCard = $('#tour-card');
  function renderTour(step) {
    tourCard.classList.toggle('visible', state.touring);
    if (!state.touring) return;
    const s = TOUR[step];
    tourCard.innerHTML = `
      <div class="eyebrow">Guided tour · ${step + 1} / ${TOUR.length}</div>
      <h2>${s.title}</h2>
      <p>${s.text}</p>
      <div class="tour-foot">
        <div class="tour-dots">${TOUR.map((_, k) => `<span class="${k === step ? 'on' : ''}"></span>`).join('')}</div>
        <div class="tour-nav">
          <button class="btn" data-tour="exit">Exit</button>
          <button class="btn" data-tour="prev" ${step === 0 ? 'disabled' : ''} aria-label="Previous">${icon('left', 15)}</button>
          <button class="btn primary" data-tour="next">${step === TOUR.length - 1 ? 'Finish' : 'Next'}${icon('right', 15)}</button>
        </div>
      </div>`;
  }
  tourCard.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tour]');
    if (!b) return;
    if (b.dataset.tour === 'exit') actions.stopTour();
    if (b.dataset.tour === 'prev') actions.tourStep(-1);
    if (b.dataset.tour === 'next') actions.tourStep(1);
  });

  // Help --------------------------------------------------------------------
  const help = $('#help');
  const shortcuts = [
    ['1 – 5', 'View mode: material, temperature, density, pressure, P-wave velocity'],
    ['[  ]', 'Peel layers away / restore them'],
    ['←  →', 'Narrow / widen the cutaway'],
    ['Q', 'Trigger an earthquake'],
    ['T', 'Start or stop the guided tour'],
    ['S', 'Toggle schematic / true scale'],
    ['A C M L', 'Atmosphere, clouds, magnetosphere, labels'],
    ['Space', 'Pause rotation'],
    ['P', 'Save a PNG snapshot'],
    ['Esc', 'Clear selection · exit tour'],
  ];
  help.innerHTML = `
    <button class="close" data-action="close-help" aria-label="Close">${icon('x', 16)}</button>
    <h2>Keyboard shortcuts</h2>
    <div class="help-grid">${shortcuts.map(([k, d]) => `<kbd>${k}</kbd><span>${d}</span>`).join('')}</div>`;
  help.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="close-help"]')) toggleHelp(false);
  });
  function toggleHelp(force) {
    help.hidden = force === undefined ? !help.hidden : !force;
  }

  // Wiring -------------------------------------------------------------------
  function renderRows() {
    rows.forEach((el) => {
      const i = Number(el.dataset.layer);
      el.classList.toggle('selected', i === state.selected);
      el.classList.toggle('hover', i === state.hover);
      const peeled = i < INTERIOR_COUNT ? i > state.peel : !state.toggles.atmosphere || state.peel < INTERIOR_COUNT - 1;
      el.classList.toggle('peeled', peeled);
    });
  }

  store.subscribe((_, changed) => {
    if (changed.selected) renderInfo();
    if (changed.selected || changed.hover || changed.peel || changed.toggles) renderRows();
    if (changed.mode || changed.cut || changed.peel || changed.schematic || changed.toggles || changed.touring) renderDock();
    if (changed.mode) renderLegend();
    if (changed.touring && !state.touring) renderTour(0);
  });

  renderInfo();
  renderRows();
  renderDock();
  renderLegend();

  return { chart, showProbe, renderHud, renderTour, toggleHelp, helpOpen: () => !help.hidden };
}
