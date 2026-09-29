import { BOUNDARY_COUNT } from '../data/scale.js';
import { INTERIOR_COUNT, LAYERS } from '../data/earth.js';

// GLSL shared by every planet shader: noise, colour ramps, the cutaway wedge,
// and the physical ↔ display radius mapping.

export const defines = /* glsl */ `
#define BOUNDS ${BOUNDARY_COUNT}
#define INTERIOR ${INTERIOR_COUNT}
#define LAYER_COUNT ${LAYERS.length}
#define PI 3.14159265359
#define TAU 6.28318530718
`;

export const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

// Ashima / Stefan Gustavson 3D simplex noise, range ≈ [-1, 1].
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

// Cellular noise: returns (F1, F2) distances.
vec2 voronoi(vec3 p) {
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = vec3(hash13(ip + g), hash13(ip + g + 17.1), hash13(ip + g + 43.7));
    float d = length(g + o - fp);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
  }
  return vec2(f1, f2);
}
`;

// Stylised incandescence: dark red → orange → yellow → white, scaled so hot
// regions exceed 1.0 and feed the bloom pass.
export const blackbody = /* glsl */ `
vec3 blackbody(float kelvin) {
  float x = clamp((kelvin - 700.0) / 5000.0, 0.0, 1.0);
  vec3 c = mix(vec3(0.45, 0.015, 0.0), vec3(1.0, 0.22, 0.02), smoothstep(0.0, 0.25, x));
  c = mix(c, vec3(1.0, 0.58, 0.14), smoothstep(0.2, 0.55, x));
  c = mix(c, vec3(1.0, 0.93, 0.75), smoothstep(0.55, 1.0, x));
  return c * (x * x * 2.6 + x * 0.35);
}
`;

// Colour ramps for the data views. Temperature uses inferno (heat convention);
// the others are single-hue sequential ramps, dark → light on the dark scene.
export const ramps = /* glsl */ `
vec3 inferno(float t) {
  t = clamp(t, 0.0, 1.0);
  const vec3 c0 = vec3(0.0002189403691192265, 0.001651004631001012, -0.01948089843709184);
  const vec3 c1 = vec3(0.1065134194856116, 0.5639564367884091, 3.932712388889277);
  const vec3 c2 = vec3(11.60249308247187, -3.972853965665698, -15.9423941062914);
  const vec3 c3 = vec3(-41.70399613139459, 17.43639888205313, 44.35414519872813);
  const vec3 c4 = vec3(77.162935699427, -33.40235894210092, -81.80730925738993);
  const vec3 c5 = vec3(-71.31942824499214, 32.62606426397723, 73.20951985803202);
  const vec3 c6 = vec3(25.13112622477341, -12.24266895238567, -23.07032500287172);
  return c0 + t * (c1 + t * (c2 + t * (c3 + t * (c4 + t * (c5 + t * c6)))));
}

vec3 hueRamp(float t, vec3 dark, vec3 mid, vec3 light) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(dark, mid, t * 2.0) : mix(mid, light, t * 2.0 - 1.0);
}

vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

// mode: 1 temperature, 2 density, 3 pressure, 4 P-wave speed.
vec3 dataRamp(int mode, float t) {
  vec3 c;
  if (mode == 1) c = inferno(t);
  else if (mode == 2) c = hueRamp(t, vec3(0.03, 0.09, 0.12), vec3(0.05, 0.47, 0.52), vec3(0.72, 0.97, 0.93));
  else if (mode == 3) c = hueRamp(t, vec3(0.08, 0.04, 0.16), vec3(0.45, 0.28, 0.78), vec3(0.93, 0.87, 1.0));
  else c = hueRamp(t, vec3(0.04, 0.07, 0.18), vec3(0.16, 0.42, 0.85), vec3(0.85, 0.93, 1.0));
  return srgbToLinear(c);
}
`;

// Cutaway + radius mapping. Positions are in the planet frame (world space,
// since the planet sits at the origin unrotated).
export const planet = /* glsl */ `
uniform float uCut;          // wedge opening, radians
uniform float uWedgeCenter;  // azimuth of the wedge's centre line
uniform float uDisplay[BOUNDS];
uniform float uReal[BOUNDS];
uniform float uVis[INTERIOR];
uniform float uTime;

bool inWedge(vec3 p) {
  if (uCut < 0.001) return false;
  float phi = atan(p.z, p.x) - uWedgeCenter;
  phi = mod(phi + PI, TAU) - PI;
  return abs(phi) < uCut * 0.5;
}

// Layer index and fractional position within it for a display radius.
void layerAt(float r, out int index, out float frac) {
  index = LAYER_COUNT - 1;
  frac = 1.0;
  for (int i = 0; i < LAYER_COUNT; i++) {
    if (r <= uDisplay[i + 1]) {
      index = i;
      frac = clamp((r - uDisplay[i]) / max(uDisplay[i + 1] - uDisplay[i], 1e-6), 0.0, 1.0);
      return;
    }
  }
}

float realRadius(int index, float frac) {
  float lo = 0.0, hi = 0.0;
  for (int i = 0; i < LAYER_COUNT; i++) {
    if (i == index) { lo = uReal[i]; hi = uReal[i + 1]; }
  }
  return mix(lo, hi, frac);
}

float visOf(int index) {
  float v = 1.0;
  for (int i = 0; i < INTERIOR; i++) if (i == index) v = uVis[i];
  return v;
}

// Noise-driven dissolve used when peeling layers away. Returns the glow of the
// burning edge, or -1 when the fragment should be discarded.
float dissolve(vec3 p, float vis) {
  if (vis >= 0.999) return 0.0;
  float n = snoise(p * 7.0) * 0.5 + 0.5;
  float edge = vis * 1.2 - 0.1;
  if (n > edge) return -1.0;
  return 1.0 - smoothstep(0.0, 0.08, edge - n);
}
`;

export const outputChunks = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;
