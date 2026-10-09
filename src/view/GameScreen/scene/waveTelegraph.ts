import * as THREE from 'three';
import { TELEGRAPH_EDGE_MATERIAL, telegraphClosingScale } from './hazardTelegraph';

// Floor marks for a defense wave's spawn points. Their own shape: four
// corner brackets around the cell ("something arrives here"), which no
// hazard family, blast preview or target square uses. The ink brackets are
// the hazard telegraph's own edge material; under them a light halo of the
// same shape keeps them readable on dark fogged ground as well as on every
// arena floor. Both are transparent instanced MeshBasicMaterials, the
// variant ShaderWarmup already compiles, so marks never compile a program.
//
// While the wave is on its way the brackets close from 1.6x the cell down
// to the cell edge, reaching it as the wave arrives (the hazard telegraph's
// closing rule); a wave held at the enemy cap keeps them closed and still.

export const WAVE_MARK_HALO_COLOR = '#fff7ed';
export const WAVE_MARK_HALO_OPACITY = 0.85;

export const WAVE_MARK_HALO_MATERIAL = new THREE.MeshBasicMaterial({
  color: WAVE_MARK_HALO_COLOR,
  transparent: true,
  opacity: WAVE_MARK_HALO_OPACITY,
  depthWrite: false,
});

export const WAVE_MARK_INK_MATERIAL = TELEGRAPH_EDGE_MATERIAL;

function rect(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  return shape;
}

/** Four L-shaped corners of a square `half` from the centre. */
export function cornerBrackets(half: number, arm: number, width: number): THREE.BufferGeometry {
  const shapes: THREE.Shape[] = [];
  [-1, 1].forEach((sx) => [-1, 1].forEach((sy) => {
    const cx = sx * half;
    const cy = sy * half;
    // Along x, then along y, both from the corner inward.
    shapes.push(rect(
      Math.min(cx, cx - sx * arm),
      Math.min(cy, cy - sy * width),
      Math.max(cx, cx - sx * arm),
      Math.max(cy, cy - sy * width)
    ));
    shapes.push(rect(
      Math.min(cx, cx - sx * width),
      Math.min(cy - sy * width, cy - sy * arm),
      Math.max(cx, cx - sx * width),
      Math.max(cy - sy * width, cy - sy * arm)
    ));
  }));
  return new THREE.ShapeGeometry(shapes).rotateX(-Math.PI / 2);
}

export const WAVE_MARK_GEOMETRY = {
  ink: cornerBrackets(0.44, 0.2, 0.07),
  halo: cornerBrackets(0.475, 0.255, 0.14),
};

/** Bracket scale for `remainingMs` of a `leadMs` telegraph (1 once it lands). */
export function waveMarkScale(remainingMs: number | null, leadMs: number): number {
  if (remainingMs === null) return 1;
  return telegraphClosingScale(remainingMs, leadMs);
}
