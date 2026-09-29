import * as THREE from 'three';
import { shared } from './uniforms.js';

// Smooth camera flights that cooperate with OrbitControls.

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// A point on cut face A (the face the earthquake rays are drawn on).
export function facePoint(rDisplay, polarDeg, cutRad = shared.uCut.value, target = new THREE.Vector3()) {
  const phi = shared.uWedgeCenter.value - cutRad / 2;
  const polar = THREE.MathUtils.degToRad(polarDeg);
  return target.set(
    rDisplay * Math.sin(polar) * Math.cos(phi),
    rDisplay * Math.cos(polar),
    rDisplay * Math.sin(polar) * Math.sin(phi),
  );
}

// Camera position looking at `target` from the open side of the wedge.
export function viewFrom(target, distance, elevationDeg = 15, azimuthOffsetDeg = 0) {
  const az = shared.uWedgeCenter.value + THREE.MathUtils.degToRad(azimuthOffsetDeg);
  const el = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el))
    .multiplyScalar(distance)
    .add(target);
}

export function createCameraRig(camera, controls) {
  let flight = null;
  const offset = new THREE.Vector3();
  return {
    flyTo(position, target, duration = 2.2) {
      const fromOffset = camera.position.clone().sub(controls.target);
      const toOffset = position.clone().sub(target);
      flight = {
        t: 0,
        duration,
        fromTarget: controls.target.clone(),
        toTarget: target.clone(),
        fromDir: fromOffset.clone().normalize(),
        toDir: toOffset.clone().normalize(),
        fromLen: fromOffset.length(),
        toLen: toOffset.length(),
      };
    },
    cancel() {
      flight = null;
    },
    get flying() {
      return flight !== null;
    },
    update(dt) {
      if (!flight) return;
      flight.t = Math.min(1, flight.t + dt / flight.duration);
      const e = ease(flight.t);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
      // Swing around the target on a great circle while the distance eases
      // geometrically, which feels natural across large zoom changes.
      const q = new THREE.Quaternion().setFromUnitVectors(flight.fromDir, flight.toDir);
      const partial = new THREE.Quaternion().slerp(q, e);
      offset.copy(flight.fromDir).applyQuaternion(partial);
      const len = flight.fromLen * (flight.toLen / flight.fromLen) ** e;
      camera.position.copy(controls.target).addScaledVector(offset, len);
      if (flight.t >= 1) flight = null;
    },
  };
}
