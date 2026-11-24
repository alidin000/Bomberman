/* eslint-disable no-param-reassign -- fills caller-owned typed arrays, once per frame */
import * as THREE from 'three';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';

// The city buildings' cut-away. The camera looks north and down, so a
// building in the rows just south of a player, a bomb or a blast stands
// between it and the camera. Those cells sink to CUTAWAY_SQUASH of their
// height, below today's walls; everything else keeps its full height.
//
// Rendering only, on the CPU: each vertex keeps its full height and scales by
// a factor blended bilinearly between cell centres, so the buildings dip
// smoothly with no seams and no new shader program.

/** A sunk building's share of its height: 2.5 units become 0.9, under today's 0.94 walls. */
export const CUTAWAY_SQUASH = 0.36;
/** Rows toward the camera that sink, past the focus cell's own row. */
export const CUTAWAY_REACH = 2;
/** Columns either side that sink too. */
export const CUTAWAY_SPREAD = 1;

export type FocusCell = { x: number; y: number };

/** Each cell's target height share: 1, or CUTAWAY_SQUASH where something must be seen. */
export function cutawayTargets(
  width: number,
  height: number,
  focus: readonly FocusCell[],
  out = new Float32Array(width * height)
): Float32Array {
  out.fill(1);
  focus.forEach(({ x, y }) => {
    const cx = Math.round(x);
    const cy = Math.round(y);
    for (let dy = 0; dy <= CUTAWAY_REACH; dy += 1) {
      for (let dx = -CUTAWAY_SPREAD; dx <= CUTAWAY_SPREAD; dx += 1) {
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx >= 0 && gy >= 0 && gx < width && gy < height) out[gy * width + gx] = CUTAWAY_SQUASH;
      }
    }
  });
  return out;
}

/** For each vertex: where it was built and the four cell centres it blends between. */
export type CutawayWeights = {
  base: Float32Array;
  baseX: Float32Array;
  baseZ: Float32Array;
  cells: Uint32Array;
  weights: Float32Array;
};

export function cutawayWeights(
  geometry: THREE.BufferGeometry,
  width: number,
  height: number
): CutawayWeights {
  const position = geometry.getAttribute('position');
  const { count } = position;
  const base = new Float32Array(count);
  const baseX = new Float32Array(count);
  const baseZ = new Float32Array(count);
  const cells = new Uint32Array(count * 4);
  const weights = new Float32Array(count * 4);
  const clampX = (x: number) => Math.min(width - 1, Math.max(0, x));
  const clampY = (y: number) => Math.min(height - 1, Math.max(0, y));
  for (let index = 0; index < count; index += 1) {
    base[index] = position.getY(index);
    baseX[index] = position.getX(index);
    baseZ[index] = position.getZ(index);
    // Centre space: cell (x, y)'s centre sits at u = x, v = y.
    const u = position.getX(index) / TILE_SIZE - MAP_OFFSET_X;
    const v = position.getZ(index) / TILE_SIZE - MAP_OFFSET_Z;
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    const fx = u - x0;
    const fy = v - y0;
    const corners = [
      [clampX(x0), clampY(y0), (1 - fx) * (1 - fy)],
      [clampX(x0 + 1), clampY(y0), fx * (1 - fy)],
      [clampX(x0), clampY(y0 + 1), (1 - fx) * fy],
      [clampX(x0 + 1), clampY(y0 + 1), fx * fy],
    ];
    corners.forEach(([cx, cy, w], corner) => {
      cells[index * 4 + corner] = cy * width + cx;
      weights[index * 4 + corner] = w;
    });
  }
  return {
    base, baseX, baseZ, cells, weights,
  };
}

// Where a vertex goes while fog hides its object: every hidden vertex on one
// point far under the board, so their triangles have no area and draw nothing.
const GONE_Y = -50;

/**
 * Rewrites the geometry's heights for the given per-cell height shares. With
 * `present` (one flag per vertex), a vertex whose object fog hides collapses
 * to a point, and comes back exactly where it was built.
 */
export function applyCutaway(
  geometry: THREE.BufferGeometry,
  weights: CutawayWeights,
  shares: Float32Array,
  present?: Uint8Array
) {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const array = position.array as Float32Array;
  const {
    base, baseX, baseZ, cells, weights: w,
  } = weights;
  for (let index = 0; index < base.length; index += 1) {
    if (present) {
      const shown = present[index] === 1;
      array[index * 3] = shown ? baseX[index] : 0;
      array[index * 3 + 2] = shown ? baseZ[index] : 0;
      if (!shown) {
        array[index * 3 + 1] = GONE_Y;
        continue; // eslint-disable-line no-continue
      }
    }
    const k = index * 4;
    const s0 = shares[cells[k]];
    const s1 = shares[cells[k + 1]];
    const s2 = shares[cells[k + 2]];
    const s3 = shares[cells[k + 3]];
    // At full height, exactly the built height: no drift from the weights' rounding.
    array[index * 3 + 1] = s0 === 1 && s1 === 1 && s2 === 1 && s3 === 1
      ? base[index]
      : base[index] * (w[k] * s0 + w[k + 1] * s1 + w[k + 2] * s2 + w[k + 3] * s3);
  }
  position.needsUpdate = true;
}

/**
 * Moves the shown shares toward their targets: about a sixth of a second to
 * sink or rise, or at once under reduced motion. Returns whether anything moved.
 */
export function stepCutaway(
  shown: Float32Array,
  target: Float32Array,
  dt: number,
  instant: boolean
): boolean {
  const rate = instant ? 1 : Math.min(1, dt * 7);
  let moved = false;
  for (let index = 0; index < shown.length; index += 1) {
    const gap = target[index] - shown[index];
    if (Math.abs(gap) > 1e-4) {
      shown[index] = Math.abs(gap) < 1e-3 ? target[index] : shown[index] + gap * rate;
      moved = true;
    }
  }
  return moved;
}
