import * as THREE from 'three';
import { hazardIsActive } from '../../../engine/bosses';
import { BossHazard, BossState, HazardKind } from '../../../engine/types';
import { hazardWarningRemainingMs } from './hazardWarning';

// Shape-coded floor telegraphs. Every hazard family keeps one floor shape, so
// a threat reads by shape before colour, and in grayscale:
//   line    - a sweep down a whole row or column (fire trail, water cannon,
//             steam charge): a lane, its cells join edge to edge.
//   cross   - a burst thrown out from a point (the shockwave around a boss,
//             an enemy's kunai).
//   ring    - an eruption from the ground under a target (tornado, lava,
//             acid, a beast bomb).
//   diamond - a point strike from above or below (air strike, lightning,
//             sand spikes, a tentacle slam).
// Squares stay what they already mean: a bomb's blast reach, an enemy's
// targeted cell and a sudden-death block.
//
// Timing is the engine's own: while `hazardIsActive` is false the shape is an
// ink outline closing on the cell (it meets the cell edge when the hit
// lands); once it is true the shape is filled, for as long as it can kill.

export type HazardFamily = 'line' | 'cross' | 'ring' | 'diamond';

export const HAZARD_FAMILIES: readonly HazardFamily[] = ['line', 'cross', 'ring', 'diamond'];

export const HAZARD_FAMILY: Record<HazardKind, HazardFamily> = {
  blueFireTrail: 'line',
  waterCannon: 'line',
  steamCharge: 'line',
  chakraShockwave: 'cross',
  sandTornado: 'ring',
  lavaBurst: 'ring',
  acidBubble: 'ring',
  beastBomb: 'ring',
  airStrike: 'diamond',
  sandSpikes: 'diamond',
  tentacleSlam: 'diamond',
};

export type TelegraphPhase = 'warning' | 'active';

/** The engine's lethal window decides the phase, never a copy of it. */
export function telegraphPhase(hazard: BossHazard): TelegraphPhase {
  return hazardIsActive(hazard) ? 'active' : 'warning';
}

/** How far the warning outline still has to close: 1.6x the cell, down to 1x. */
export const TELEGRAPH_CLOSE_FROM = 1.6;

export function telegraphClosingScale(remainingMs: number, leadMs: number): number {
  if (!(remainingMs > 0)) return 1;
  return 1 + (TELEGRAPH_CLOSE_FROM - 1) * Math.min(1, remainingMs / Math.max(leadMs, 1));
}

/** Warning time left, and the full lead it closes over. */
export function telegraphCountdown(hazard: BossHazard): { remainingMs: number; leadMs: number } {
  return {
    remainingMs: hazardWarningRemainingMs(hazard),
    leadMs: Math.max(hazard.warningTicks, 1),
  };
}

/**
 * Yaw of a line hazard's lane: 0 runs along x, PI/2 along z. A line attack
 * fills a whole row or column, so a same-kind neighbour gives the direction;
 * a lone cell (walls cut the rest) falls back to the boss's row or column.
 */
export function lineHeading(
  hazard: BossHazard,
  hazards: readonly BossHazard[],
  boss: Pick<BossState, 'x' | 'y'> | null
): number {
  let vertical = false;
  for (let index = 0; index < hazards.length; index += 1) {
    const other = hazards[index];
    if (other !== hazard && other.kind === hazard.kind) {
      if (other.y === hazard.y && Math.abs(other.x - hazard.x) === 1) return 0;
      if (other.x === hazard.x && Math.abs(other.y - hazard.y) === 1) vertical = true;
    }
  }
  if (vertical) return Math.PI / 2;
  if (boss && boss.x === hazard.x && boss.y !== hazard.y) return Math.PI / 2;
  return 0;
}

// Ink outline while warning; a deep red, near-opaque fill once lethal. Both
// are dark against every arena floor, so the cue survives grayscale and
// colour-blind views; the fill is red as well, so colour backs up shape.
export const TELEGRAPH_EDGE_COLOR = '#1c1917';
export const TELEGRAPH_EDGE_OPACITY = 0.9;
export const TELEGRAPH_FILL_COLOR = '#7f1d1d';
export const TELEGRAPH_FILL_OPACITY = 0.9;

// The variant every instanced floor preview already uses (transparent
// MeshBasicMaterial), so drawing these compiles no new program.
export const TELEGRAPH_EDGE_MATERIAL = new THREE.MeshBasicMaterial({
  color: TELEGRAPH_EDGE_COLOR,
  transparent: true,
  opacity: TELEGRAPH_EDGE_OPACITY,
  depthWrite: false,
});
export const TELEGRAPH_FILL_MATERIAL = new THREE.MeshBasicMaterial({
  color: TELEGRAPH_FILL_COLOR,
  transparent: true,
  opacity: TELEGRAPH_FILL_OPACITY,
  depthWrite: false,
});

function rect(x0: number, y0: number, x1: number, y1: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(x0, y0);
  shape.lineTo(x1, y0);
  shape.lineTo(x1, y1);
  shape.lineTo(x0, y1);
  shape.closePath();
  return shape;
}

function plus(arm: number, half: number): THREE.Shape {
  const path = new THREE.Shape();
  path.moveTo(-half, arm);
  path.lineTo(half, arm);
  path.lineTo(half, half);
  path.lineTo(arm, half);
  path.lineTo(arm, -half);
  path.lineTo(half, -half);
  path.lineTo(half, -arm);
  path.lineTo(-half, -arm);
  path.lineTo(-half, -half);
  path.lineTo(-arm, -half);
  path.lineTo(-arm, half);
  path.lineTo(-half, half);
  path.closePath();
  return path;
}

function flat(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return geometry.rotateX(-Math.PI / 2);
}

function crossOutline(): THREE.BufferGeometry {
  const outer = plus(0.46, 0.16);
  outer.holes.push(plus(0.39, 0.09));
  return flat(new THREE.ShapeGeometry(outer));
}

const LANE_HALF_WIDTH = 0.17;
const RAIL_WIDTH = 0.06;

/** Shared, module-level shapes: [warning outline, lethal fill] per family. */
export const TELEGRAPH_GEOMETRY: Record<HazardFamily, {
  edge: THREE.BufferGeometry;
  fill: THREE.BufferGeometry;
}> = {
  // Full cell length, so neighbouring cells draw one unbroken lane.
  line: {
    edge: flat(new THREE.ShapeGeometry([
      rect(-0.5, LANE_HALF_WIDTH - RAIL_WIDTH, 0.5, LANE_HALF_WIDTH),
      rect(-0.5, -LANE_HALF_WIDTH, 0.5, -LANE_HALF_WIDTH + RAIL_WIDTH),
    ])),
    fill: flat(new THREE.ShapeGeometry(rect(-0.5, -LANE_HALF_WIDTH, 0.5, LANE_HALF_WIDTH))),
  },
  cross: {
    edge: crossOutline(),
    fill: flat(new THREE.ShapeGeometry(plus(0.46, 0.16))),
  },
  ring: {
    edge: flat(new THREE.RingGeometry(0.33, 0.43, 32)),
    fill: flat(new THREE.CircleGeometry(0.43, 32)),
  },
  // A four-segment ring has its corners on the axes: a diamond.
  diamond: {
    edge: flat(new THREE.RingGeometry(0.34, 0.48, 4, 1)),
    fill: flat(new THREE.CircleGeometry(0.48, 4)),
  },
};
