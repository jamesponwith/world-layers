import * as THREE from 'three';
import { noise } from '../shaders/common.js';
import { shared } from './uniforms.js';

// Background: twinkling stars, a faint Milky Way band and the Sun.

const STAR_COUNT = 7000;
const SKY_RADIUS = 600;

function starColor(t) {
  // Rough stellar colours from cool (orange) to hot (blue-white).
  const stops = [
    [1.0, 0.72, 0.45],
    [1.0, 0.9, 0.78],
    [1.0, 1.0, 1.0],
    [0.78, 0.85, 1.0],
  ];
  const x = t * (stops.length - 1);
  const i = Math.min(Math.floor(x), stops.length - 2);
  const f = x - i;
  return stops[i].map((c, k) => c + (stops[i + 1][k] - c) * f);
}

function createStars() {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);
  const galacticNormal = new THREE.Vector3(0.3, 0.85, -0.42).normalize();
  const v = new THREE.Vector3();
  for (let i = 0; i < STAR_COUNT; i++) {
    // Concentrate a share of the stars toward the galactic plane.
    do {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.01);
    v.normalize();
    if (i % 3 === 0) {
      const h = v.dot(galacticNormal);
      v.addScaledVector(galacticNormal, -h * 0.85).normalize();
    }
    v.multiplyScalar(SKY_RADIUS);
    positions.set([v.x, v.y, v.z], i * 3);
    colors.set(starColor(Math.random() ** 0.8), i * 3);
    sizes[i] = Math.random() ** 6 * 5 + 0.8;
    phases[i] = Math.random() * Math.PI * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vColor = color;
        vTwinkle = 0.75 + 0.25 * sin(uTime * (0.6 + aPhase * 0.4) + aPhase * 10.0);
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a * a * vTwinkle * 1.3, 1.0);
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, material);
}

function createMilkyWay() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uNormal: { value: new THREE.Vector3(0.3, 0.85, -0.42).normalize() } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      ${noise}
      uniform vec3 uNormal;
      varying vec3 vDir;
      void main() {
        float h = dot(vDir, uNormal);
        float band = exp(-h * h * 28.0);
        float n = fbm(vDir * 3.5) * 0.5 + 0.5;
        float dust = smoothstep(0.35, 0.75, fbm(vDir * 7.0 + 4.0) * 0.5 + 0.5);
        vec3 col = mix(vec3(0.05, 0.06, 0.12), vec3(0.16, 0.13, 0.2), n) * band * (1.0 - dust * 0.7);
        col += vec3(0.012, 0.01, 0.03) * (fbm(vDir * 2.0) * 0.5 + 0.5);
        gl_FragColor = vec4(col * 0.8, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS * 1.05, 64, 32), material);
}

function createSun() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.08, 'rgba(255,248,225,1)');
  grad.addColorStop(0.2, 'rgba(255,200,120,0.35)');
  grad.addColorStop(0.5, 'rgba(255,140,60,0.06)');
  grad.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color: new THREE.Color(3, 2.8, 2.5),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.setScalar(90);
  sprite.position.copy(shared.uSunDir.value).multiplyScalar(SKY_RADIUS * 0.9);
  return sprite;
}

export function createSpace() {
  const group = new THREE.Group();
  group.add(createMilkyWay(), createStars(), createSun());
  return { group };
}
