import * as THREE from 'three';
import { EARTH_RADIUS_KM, seismicVelocity } from '../data/earth.js';
import { toDisplay } from '../data/scale.js';

// Earthquake simulation. Rays are traced through the velocity model with a
// conserved ray parameter p = r·sin(i)/v, which refracts them at every
// discontinuity (Snell's law) and bends them in velocity gradients. The source
// sits at the north pole of cut face A, so every ray lies in that face.

const R = EARTH_RADIUS_KM;
const FOCAL_DEPTH = 15;
const STEP_KM = 6;
export const WAVES = {
  P: { color: new THREE.Color('#ffc857'), label: 'P-waves' },
  S: { color: new THREE.Color('#4cc9f0'), label: 'S-waves' },
};

// The shadow zone is the widest stretch of surface no direct ray reaches:
// for P it is bracketed by core refraction, for S it runs to the antipode.
function shadowZone(arrivals) {
  const sorted = [...arrivals].sort((a, b) => a.delta - b.delta);
  let best = { from: sorted[sorted.length - 1], to: null, gap: Math.PI - sorted[sorted.length - 1].delta };
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].delta - sorted[i - 1].delta;
    if (gap > best.gap) best = { from: sorted[i - 1], to: sorted[i], gap };
  }
  return {
    from: THREE.MathUtils.radToDeg(best.from.delta),
    to: best.to ? THREE.MathUtils.radToDeg(best.to.delta) : 180,
    revealAt: Math.max(best.from.t, best.to?.t ?? 0),
  };
}

function traceRay(wave, takeoff) {
  const r0 = R - FOCAL_DEPTH;
  const p = (r0 * Math.sin(takeoff)) / seismicVelocity(r0, wave);
  const points = [[r0, 0, 0]];
  let r = r0;
  let delta = 0;
  let t = 0;
  let down = true;
  for (let step = 0; step < 6000; step++) {
    const v = seismicVelocity(r, wave);
    if (v <= 0) break; // shear waves cannot enter the liquid outer core
    let s = (p * v) / r;
    if (s >= 1 && down) down = false; // turning point or total reflection
    s = Math.min(s, 1);
    const cos = Math.max(Math.sqrt(1 - s * s), down ? 0 : 0.04);
    r += (down ? -cos : cos) * STEP_KM;
    delta += (s * STEP_KM) / r;
    t += STEP_KM / v;
    if (delta > Math.PI) break;
    if (r >= R) {
      points.push([R, delta, t]);
      return { points, arrival: { delta, t } };
    }
    if (step % 2 === 0) points.push([r, delta, t]);
  }
  return { points, arrival: null };
}

function traceFan(wave) {
  const rays = [];
  for (let deg = 0.5; deg <= 46; deg += 0.55) rays.push(traceRay(wave, THREE.MathUtils.degToRad(deg)));
  return rays;
}

const rayVertex = /* glsl */ `
attribute float aTime;
varying float vTime;
void main() {
  vTime = aTime;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const rayFragment = /* glsl */ `
uniform float uClock;
uniform vec3 uColor;
uniform float uOpacity;
varying float vTime;
void main() {
  if (vTime > uClock) discard;
  float age = uClock - vTime;
  float head = exp(-age / 25.0) * 2.5;
  float trail = 0.3 + 0.5 * exp(-age / 260.0);
  gl_FragColor = vec4(uColor * (trail + head) * uOpacity, 1.0);
  #include <colorspace_fragment>
}
`;

function dotTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

const toPlane = (r, delta, target) => {
  const rd = toDisplay(r);
  return target.set(rd * Math.sin(delta), rd * Math.cos(delta), 0);
};

export function createSeismic() {
  const group = new THREE.Group();
  group.position.z = 0.004;
  const sprite = dotTexture();
  const tmp = new THREE.Vector3();
  const prev = new THREE.Vector3();

  const layers = Object.entries(WAVES).map(([wave, { color }]) => {
    const rays = traceFan(wave);
    const segCount = rays.reduce((n, ray) => n + ray.points.length - 1, 0);
    const positions = new Float32Array(segCount * 6);
    const times = new Float32Array(segCount * 2);
    const material = new THREE.ShaderMaterial({
      vertexShader: rayVertex,
      fragmentShader: rayFragment,
      uniforms: { uClock: { value: 0 }, uColor: { value: color }, uOpacity: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aTime', new THREE.BufferAttribute(times, 1));
    const lines = new THREE.LineSegments(geometry, material);
    lines.frustumCulled = false;

    // Wavefront: heads of neighbouring rays joined into a line, plus glowing dots.
    const frontPositions = new Float32Array(rays.length * 2 * 3);
    const front = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(frontPositions, 3)),
      new THREE.LineBasicMaterial({
        color: color.clone().multiplyScalar(2.2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    front.frustumCulled = false;
    const headPositions = new Float32Array(rays.length * 3);
    const heads = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(headPositions, 3)),
      new THREE.PointsMaterial({
        color: color.clone().multiplyScalar(2.5),
        size: 0.035,
        map: sprite,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    heads.frustumCulled = false;

    // Arrivals at the surface flash like seismometers triggering.
    const arrivals = rays
      .map((r) => r.arrival)
      .filter(Boolean)
      .sort((a, b) => a.t - b.t);
    const arrivalPositions = new Float32Array(arrivals.length * 3);
    const arrivalDots = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(arrivalPositions, 3)),
      new THREE.PointsMaterial({
        color: color.clone().multiplyScalar(3),
        size: 0.05,
        map: sprite,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    arrivalDots.frustumCulled = false;

    group.add(lines, front, heads, arrivalDots);
    return { wave, rays, lines, positions, times, front, frontPositions, heads, headPositions, arrivals, arrivalDots, arrivalPositions };
  });

  // Shadow-zone arcs just outside the surface.
  const shadows = {};
  const arcs = layers.map(({ wave, arrivals }, k) => {
    const zone = shadowZone(arrivals);
    shadows[wave] = zone;
    const { from, to } = zone;
    const pts = [];
    for (let d = from; d <= to; d += 1) {
      const a = THREE.MathUtils.degToRad(d);
      pts.push(new THREE.Vector3(Math.sin(a), Math.cos(a), 0));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({
        color: WAVES[wave].color.clone().multiplyScalar(1.6),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    group.add(line);
    return { wave, line, offset: 1.02 + k * 0.018, revealAt: zone.revealAt };
  });

  const epicenter = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: sprite,
      color: new THREE.Color(4, 1.6, 0.8),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(epicenter);

  let lastScaleKey = null;
  function rebuildGeometry() {
    for (const layer of layers) {
      let o = 0;
      for (const ray of layer.rays) {
        for (let i = 0; i < ray.points.length - 1; i++) {
          const [ra, da, ta] = ray.points[i];
          const [rb, db, tb] = ray.points[i + 1];
          toPlane(ra, da, tmp).toArray(layer.positions, o * 6);
          toPlane(rb, db, tmp).toArray(layer.positions, o * 6 + 3);
          layer.times[o * 2] = ta;
          layer.times[o * 2 + 1] = tb;
          o++;
        }
      }
      layer.lines.geometry.attributes.position.needsUpdate = true;
      layer.lines.geometry.attributes.aTime.needsUpdate = true;
      layer.arrivals.forEach((a, i) => toPlane(R, a.delta, tmp).toArray(layer.arrivalPositions, i * 3));
      layer.arrivalDots.geometry.attributes.position.needsUpdate = true;
    }
    epicenter.position.copy(toPlane(R - FOCAL_DEPTH, 0, tmp));
  }

  const state = { active: false, clock: 0, fade: 0, speed: 110 };
  const duration =
    Math.max(...layers.flatMap((l) => l.rays.map((r) => r.points[r.points.length - 1][2]))) + 120;

  function headAt(ray, clock, target) {
    const pts = ray.points;
    if (clock >= pts[pts.length - 1][2]) return null;
    let lo = 0;
    let hi = pts.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid][2] <= clock) lo = mid;
      else hi = mid;
    }
    const f = (clock - pts[lo][2]) / (pts[hi][2] - pts[lo][2]);
    const r = pts[lo][0] + (pts[hi][0] - pts[lo][0]) * f;
    const d = pts[lo][1] + (pts[hi][1] - pts[lo][1]) * f;
    return toPlane(r, d, target);
  }

  group.visible = false;

  return {
    group,
    state,
    duration,
    shadows,
    trigger() {
      state.active = true;
      state.clock = 0;
      state.fade = 1;
      group.visible = true;
    },
    stop() {
      state.active = false;
    },
    // `intact` is false once the outer layers are peeled away; the rays would
    // otherwise hang in empty space, so the quake ends and fades out quickly.
    update(dt, scaleKey, intact = true) {
      if (!group.visible) return;
      if (!intact) state.active = false;
      if (scaleKey !== lastScaleKey) {
        rebuildGeometry();
        lastScaleKey = scaleKey;
      }
      if (state.active) {
        state.clock += dt * state.speed;
        if (state.clock > duration) state.active = false;
      } else {
        state.fade = Math.max(0, state.fade - dt * (intact ? 0.5 : 3));
        if (state.fade <= 0) group.visible = false;
      }
      const clock = state.clock;

      const pulse = Math.max(0, 1 - clock / 240);
      epicenter.scale.setScalar(0.06 + 0.25 * (1 - pulse) * pulse * 4 + 0.03 * Math.sin(clock * 0.1));
      epicenter.material.opacity = (0.4 + pulse) * state.fade;

      for (const layer of layers) {
        layer.lines.material.uniforms.uClock.value = clock;
        layer.lines.material.uniforms.uOpacity.value = state.fade;

        let heads = 0;
        let segs = 0;
        let hasPrev = false;
        for (const ray of layer.rays) {
          const h = headAt(ray, clock, tmp);
          if (!h) {
            hasPrev = false;
            continue;
          }
          h.toArray(layer.headPositions, heads * 3);
          if (hasPrev && prev.distanceTo(h) < 0.12) {
            prev.toArray(layer.frontPositions, segs * 6);
            h.toArray(layer.frontPositions, segs * 6 + 3);
            segs++;
          }
          prev.copy(h);
          hasPrev = true;
          heads++;
        }
        layer.heads.geometry.setDrawRange(0, heads);
        layer.heads.geometry.attributes.position.needsUpdate = true;
        layer.heads.material.opacity = state.fade;
        layer.front.geometry.setDrawRange(0, segs * 2);
        layer.front.geometry.attributes.position.needsUpdate = true;
        layer.front.material.opacity = state.fade * 0.8;

        const arrived = layer.arrivals.filter((a) => a.t <= clock).length;
        layer.arrivalDots.geometry.setDrawRange(0, arrived);
        layer.arrivalDots.material.opacity = state.fade;
      }

      for (const arc of arcs) {
        const reveal = THREE.MathUtils.smoothstep(clock, arc.revealAt, arc.revealAt + 150);
        arc.line.material.opacity = reveal * state.fade;
        arc.line.scale.setScalar(toDisplay(R) * arc.offset);
      }
    },
  };
}

