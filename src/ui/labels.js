import * as THREE from 'three';
import { INTERIOR_COUNT, LAYERS } from '../data/earth.js';
import { scale } from '../data/scale.js';
import { shared } from '../scene/uniforms.js';

// Callout labels: an anchor dot on cut face A for each layer, with leader lines
// running to a tidy column of names beside the planet.

const ANCHOR_POLAR = THREE.MathUtils.degToRad(58);
const ROW = 23;

export function createLabels(root, svg, { onSelect, onHover }) {
  const items = LAYERS.map((layer, i) => {
    const el = document.createElement('button');
    el.className = 'callout';
    el.innerHTML = `<i style="background:${layer.color}"></i><span>${layer.name}</span>`;
    el.addEventListener('click', () => onSelect(i));
    el.addEventListener('pointerenter', () => onHover(i));
    el.addEventListener('pointerleave', () => onHover(-1));
    root.appendChild(el);
    return { i, el, anchor: new THREE.Vector3(), screen: new THREE.Vector2(), y: 0, shown: false };
  });

  const v = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  let opacity = 0;

  return {
    update(camera, width, height, state, dt, bounds = { left: 0, right: width }) {
      const vis = shared.uVis.value;
      const cut = shared.uCut.value;
      const phiA = shared.uWedgeCenter.value - cut / 2;
      normal.set(-Math.sin(phiA), 0, Math.cos(phiA));
      toCamera.copy(camera.position);

      const wanted = state.toggles.labels && cut > 0.25 && !state.touring;
      opacity += ((wanted ? 1 : 0) - opacity) * Math.min(1, dt * 6);
      root.style.opacity = svg.style.opacity = opacity.toFixed(3);
      if (opacity < 0.01) {
        root.style.visibility = svg.style.visibility = 'hidden';
        return;
      }
      root.style.visibility = svg.style.visibility = 'visible';

      const visible = [];
      for (const item of items) {
        const i = item.i;
        const r = (scale.display[i] + scale.display[i + 1]) / 2;
        item.anchor.set(r * Math.sin(ANCHOR_POLAR) * Math.cos(phiA), r * Math.cos(ANCHOR_POLAR), r * Math.sin(ANCHOR_POLAR) * Math.sin(phiA));
        const layerVisible =
          i < INTERIOR_COUNT ? vis[i] > 0.5 : state.toggles.atmosphere && vis[INTERIOR_COUNT - 1] > 0.5;
        const facing = normal.dot(v.copy(toCamera).sub(item.anchor)) > 0;
        v.copy(item.anchor).project(camera);
        const onScreen = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
        item.shown = layerVisible && facing && onScreen;
        item.el.style.display = item.shown ? '' : 'none';
        if (!item.shown) continue;
        item.screen.set(((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height);
        visible.push(item);
      }

      if (!visible.length) {
        svg.innerHTML = '';
        return;
      }

      // Put the column on whichever side of the planet the anchors lean toward.
      v.set(0, 0, 0).project(camera);
      const cx = ((v.x + 1) / 2) * width;
      const avgX = visible.reduce((s, it) => s + it.screen.x, 0) / visible.length;
      const side = avgX >= cx ? 1 : -1;
      // Planet silhouette radius on screen, so the column clears the atmosphere.
      const outerR = scale.display[scale.display.length - 1];
      const fov = THREE.MathUtils.degToRad(camera.fov);
      const planetPx = (outerR / (camera.position.length() * Math.tan(fov / 2))) * (height / 2);
      const pad = width < 700 ? 8 : 24;
      const labelWidth = 150;
      let colX = cx + side * (Math.min(planetPx, width) + 36);
      colX = side > 0 ? Math.min(colX, bounds.right - labelWidth) : Math.max(colX, bounds.left + labelWidth);

      // Spread rows vertically so they never overlap, preserving order.
      visible.sort((a, b) => a.screen.y - b.screen.y);
      visible.forEach((it) => (it.y = it.screen.y));
      for (let k = 1; k < visible.length; k++) visible[k].y = Math.max(visible[k].y, visible[k - 1].y + ROW);
      const overflow = visible[visible.length - 1].y - (height - 140);
      if (overflow > 0) visible.forEach((it) => (it.y -= overflow));
      for (let k = visible.length - 2; k >= 0; k--) visible[k].y = Math.min(visible[k].y, visible[k + 1].y - ROW);

      const lines = [];
      for (const it of visible) {
        const hovered = state.hover === it.i || state.selected === it.i;
        const elbow = colX - side * 16;
        lines.push(
          `<path d="M${it.screen.x.toFixed(1)},${it.screen.y.toFixed(1)} L${elbow.toFixed(1)},${it.y.toFixed(1)} L${(colX - side * 4).toFixed(1)},${it.y.toFixed(1)}" class="leader ${hovered ? 'hot' : ''}"/>`,
          `<circle cx="${it.screen.x.toFixed(1)}" cy="${it.screen.y.toFixed(1)}" r="${hovered ? 3.5 : 2.5}" class="leader-dot ${hovered ? 'hot' : ''}" style="--c:${LAYERS[it.i].color}"/>`,
        );
        it.el.classList.toggle('hot', hovered);
        it.el.classList.toggle('left', side < 0);
        const x = side > 0 ? colX : colX - it.el.offsetWidth;
        it.el.style.transform = `translate(${Math.max(pad, x).toFixed(1)}px, ${(it.y - 11).toFixed(1)}px)`;
      }
      svg.innerHTML = lines.join('');
    },
  };
}
