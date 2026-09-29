import { EARTH_RADIUS_KM as R, LAYERS, INTERIOR_COUNT, layerBottom, layerIndexAtRadius, propertiesAt } from '../data/earth.js';

// Depth-profile chart for the info panel: one physical quantity against depth
// (interior) or altitude (atmosphere), with the layers shaded behind it and a
// crosshair synced to the 3D probe.

const W = 320;
const H = 156;
const M = { left: 42, right: 14, top: 10, bottom: 24 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const TABS = {
  interior: {
    temperature: {
      label: 'Temperature',
      domain: [0, 6000],
      ticks: [0, 2000, 4000, 6000],
      series: [{ label: 'Temperature', color: '#ff9f5a', value: (p) => p.temperature, format: (v) => `${fmt(v)} K` }],
    },
    density: {
      label: 'Density',
      domain: [0, 14],
      ticks: [0, 5, 10],
      series: [{ label: 'Density', color: '#5fd4c4', value: (p) => p.density / 1000, format: (v) => `${v.toFixed(2)} g/cm³` }],
    },
    pressure: {
      label: 'Pressure',
      domain: [0, 380],
      ticks: [0, 100, 200, 300],
      series: [{ label: 'Pressure', color: '#b89bff', value: (p) => p.pressure / 1e9, format: (v) => `${v.toFixed(1)} GPa` }],
    },
    seismic: {
      label: 'Wave speed',
      domain: [0, 14],
      ticks: [0, 5, 10],
      series: [
        { label: 'P-wave', color: '#ffc857', value: (p) => p.vp, format: (v) => `${v.toFixed(2)} km/s` },
        { label: 'S-wave', color: '#4cc9f0', value: (p) => p.vs, format: (v) => `${v.toFixed(2)} km/s` },
      ],
    },
  },
  atmosphere: {
    temperature: {
      label: 'Temperature',
      domain: [150, 1100],
      ticks: [200, 600, 1000],
      series: [{ label: 'Temperature', color: '#ff9f5a', value: (p) => p.temperature, format: (v) => `${fmt(v)} K` }],
    },
    pressure: {
      label: 'Pressure',
      log: true,
      domain: [-8, 5.2],
      ticks: [-8, -4, 0, 4],
      series: [{ label: 'Pressure', color: '#b89bff', value: (p) => p.pressure, format: fmtPressure }],
    },
    density: {
      label: 'Density',
      log: true,
      domain: [-14, 0.5],
      ticks: [-12, -8, -4, 0],
      series: [{ label: 'Density', color: '#5fd4c4', value: (p) => p.density, format: (v) => `${v.toExponential(1)} kg/m³` }],
    },
  },
};

const ATMOSPHERE_TOP = 700; // km of altitude plotted

function fmt(v) {
  return Math.round(v).toLocaleString();
}

function fmtPressure(pa) {
  if (pa >= 1e3) return `${(pa / 1e3).toFixed(1)} kPa`;
  if (pa >= 1) return `${pa.toFixed(1)} Pa`;
  return `${pa.toExponential(1)} Pa`;
}

// x position is always depth (interior) or altitude (atmosphere) in km.
function extent(kind) {
  return kind === 'interior' ? [0, R] : [0, ATMOSPHERE_TOP];
}
function radiusAt(kind, x) {
  return kind === 'interior' ? R - x : R + x;
}
function xOf(kind, rKm) {
  return kind === 'interior' ? R - rKm : rKm - R;
}

export function createChart(root, { onHover }) {
  root.innerHTML = `
    <div class="chart-tabs" role="tablist"></div>
    <div class="chart-readout" aria-live="polite"></div>
    <svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img"></svg>
    <div class="chart-axis-label"></div>
  `;
  const tabsEl = root.querySelector('.chart-tabs');
  const readout = root.querySelector('.chart-readout');
  const svg = root.querySelector('.chart-svg');
  const axisLabel = root.querySelector('.chart-axis-label');

  let kind = 'interior';
  let tab = 'temperature';
  let selected = -1;
  let samples = [];
  let crosshair = null; // radius km

  function spec() {
    return TABS[kind][tab];
  }

  function sample() {
    const [x0, x1] = extent(kind);
    const n = 480;
    samples = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      samples.push({ x, p: propertiesAt(radiusAt(kind, x)) });
    }
  }

  const sx = (x) => {
    const [x0, x1] = extent(kind);
    return M.left + ((x - x0) / (x1 - x0)) * PW;
  };
  const sy = (v) => {
    const { domain, log } = spec();
    const y = log ? Math.log10(Math.max(v, 1e-30)) : v;
    const t = (y - domain[0]) / (domain[1] - domain[0]);
    return M.top + PH - Math.min(Math.max(t, 0), 1) * PH;
  };

  function renderTabs() {
    tabsEl.innerHTML = Object.entries(TABS[kind])
      .map(
        ([key, t]) =>
          `<button role="tab" class="chip ${key === tab ? 'active' : ''}" aria-selected="${key === tab}" data-tab="${key}">${t.label}</button>`,
      )
      .join('');
  }

  function renderReadout() {
    const s = spec();
    if (crosshair == null) {
      readout.innerHTML = s.series
        .map((ser) => `<span class="legend-item"><i style="background:${ser.color}"></i>${ser.label}</span>`)
        .join('');
      return;
    }
    const p = propertiesAt(crosshair);
    const layer = LAYERS[layerIndexAtRadius(crosshair)];
    const x = xOf(kind, crosshair);
    const where = kind === 'interior' ? `${fmt(x)} km deep` : `${fmt(x)} km up`;
    readout.innerHTML =
      `<span class="readout-where">${where} · ${layer.name}</span>` +
      s.series
        .map((ser) => `<span class="legend-item"><i style="background:${ser.color}"></i>${ser.format(ser.value(p))}</span>`)
        .join('');
  }

  function render() {
    const s = spec();
    const [x0, x1] = extent(kind);
    const parts = [];

    // Layer bands.
    const indices = kind === 'interior' ? [...Array(INTERIOR_COUNT).keys()] : [...Array(LAYERS.length).keys()].slice(INTERIOR_COUNT);
    indices.forEach((i, k) => {
      const a = Math.max(x0, Math.min(x1, xOf(kind, layerBottom(i))));
      const b = Math.max(x0, Math.min(x1, xOf(kind, LAYERS[i].top)));
      const left = sx(Math.min(a, b));
      const width = Math.abs(sx(b) - sx(a));
      if (width < 0.2) return;
      const fill = i === selected ? LAYERS[i].color : '#ffffff';
      const opacity = i === selected ? 0.2 : k % 2 ? 0.035 : 0.0;
      parts.push(`<rect x="${left}" y="${M.top}" width="${width}" height="${PH}" fill="${fill}" fill-opacity="${opacity}"/>`);
      parts.push(`<line x1="${sx(b)}" x2="${sx(b)}" y1="${M.top}" y2="${M.top + PH}" class="chart-boundary"/>`);
    });

    // Grid + y ticks.
    for (const t of s.ticks) {
      const y = sy(s.log ? 10 ** t : t);
      parts.push(`<line x1="${M.left}" x2="${W - M.right}" y1="${y}" y2="${y}" class="chart-grid"/>`);
      const label = s.log ? `10<tspan dy="-4" font-size="7">${t}</tspan>` : t.toLocaleString();
      parts.push(`<text x="${M.left - 6}" y="${y + 3}" class="chart-tick" text-anchor="end">${label}</text>`);
    }
    // X ticks.
    const xticks = kind === 'interior' ? [0, 2000, 4000, 6000] : [0, 200, 400, 600];
    for (const t of xticks) {
      parts.push(`<text x="${sx(t)}" y="${H - 8}" class="chart-tick" text-anchor="middle">${t.toLocaleString()}</text>`);
    }
    parts.push(`<line x1="${M.left}" x2="${W - M.right}" y1="${M.top + PH}" y2="${M.top + PH}" class="chart-axis"/>`);

    // Series.
    for (const ser of s.series) {
      const d = samples.map((smp, i) => `${i ? 'L' : 'M'}${sx(smp.x).toFixed(1)},${sy(ser.value(smp.p)).toFixed(1)}`).join('');
      parts.push(`<path d="${d}" fill="none" stroke="${ser.color}" stroke-width="2" stroke-linejoin="round"/>`);
    }

    // Crosshair.
    if (crosshair != null) {
      const x = sx(xOf(kind, crosshair));
      if (x >= M.left - 0.5 && x <= W - M.right + 0.5) {
        parts.push(`<line x1="${x}" x2="${x}" y1="${M.top}" y2="${M.top + PH}" class="chart-crosshair"/>`);
        const p = propertiesAt(crosshair);
        for (const ser of s.series) {
          parts.push(`<circle cx="${x}" cy="${sy(ser.value(p))}" r="4" fill="${ser.color}" stroke="var(--surface-solid)" stroke-width="2"/>`);
        }
      }
    }

    parts.push(`<rect class="chart-hit" x="${M.left}" y="${M.top}" width="${PW}" height="${PH}" fill="transparent"/>`);
    svg.innerHTML = parts.join('');
    svg.setAttribute('aria-label', `${s.label} versus ${kind === 'interior' ? 'depth' : 'altitude'}`);
    axisLabel.textContent = kind === 'interior' ? 'Depth below surface (km) →' : 'Altitude above surface (km) →';
    renderReadout();
  }

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    tab = btn.dataset.tab;
    renderTabs();
    render();
  });

  function pointerRadius(e) {
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const [x0, x1] = extent(kind);
    const x = x0 + ((px - M.left) / PW) * (x1 - x0);
    if (x < x0 || x > x1) return null;
    return radiusAt(kind, x);
  }
  svg.addEventListener('pointermove', (e) => {
    crosshair = pointerRadius(e);
    render();
    onHover?.(crosshair);
  });
  svg.addEventListener('pointerleave', () => {
    crosshair = null;
    render();
    onHover?.(null);
  });

  sample();
  renderTabs();
  render();

  return {
    setLayer(index) {
      selected = index;
      const nextKind = index >= INTERIOR_COUNT ? 'atmosphere' : 'interior';
      if (nextKind !== kind) {
        kind = nextKind;
        if (!TABS[kind][tab]) tab = 'temperature';
        sample();
        renderTabs();
      }
      render();
    },
    setCrosshair(rKm) {
      if (rKm != null) {
        const nextKind = rKm > R ? 'atmosphere' : 'interior';
        if (nextKind !== kind) {
          kind = nextKind;
          if (!TABS[kind][tab]) tab = 'temperature';
          sample();
          renderTabs();
        }
      }
      crosshair = rKm;
      render();
    },
  };
}
