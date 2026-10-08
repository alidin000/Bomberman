import { Direction } from '../../../engine/types';

// Small, frame-rate independent helpers for how entities turn and bob and how
// the camera follows and shakes. Every rate is per second, applied as
// 1 - exp(-rate * delta), so 60, 120 and 144 Hz look the same.

/**
 * How fast models turn to face where they are going (1/s). A 90 degree turn
 * gets within 10 degrees in about 120 ms, under half a cell of travel.
 */
export const ENTITY_TURN_RATE = 18;

/** Model yaw for an engine facing: models look down +z, so 'down' is 0. */
export const FACING_HEADING: Record<Direction, number> = {
  down: 0,
  right: Math.PI / 2,
  up: Math.PI,
  left: -Math.PI / 2,
};

/** Eases `current` toward `target` along the shorter way round. */
export function turnToward(current: number, target: number, deltaSeconds: number): number {
  const turn = Math.PI * 2;
  const diff = ((((target - current) % turn) + turn * 1.5) % turn) - Math.PI;
  return current + diff * (1 - Math.exp(-deltaSeconds * ENTITY_TURN_RATE));
}

/**
 * Cells travelled per bob of the walk cycle. At the base walking speed this
 * keeps the old 13 rad/s cadence; faster characters step faster instead of
 * taking longer strides on the same beat.
 */
export const STRIDE_CELLS = 0.86;
/** A per-frame jump longer than this is a teleport or respawn, not a step. */
const MAX_STRIDE_ADVANCE_CELLS = 0.5;

/** Walk-cycle phase (radians) after travelling `distanceCells` this frame. */
export function advanceStride(phase: number, distanceCells: number): number {
  if (distanceCells <= 0 || distanceCells > MAX_STRIDE_ADVANCE_CELLS) return phase;
  return (phase + (distanceCells / STRIDE_CELLS) * Math.PI) % (Math.PI * 2);
}

/**
 * Camera follow rate (1/s): looser for one framed player, tighter once the
 * camera has zoomed out for spread players. It follows the smoothed zoom, so
 * the rate never steps from one frame to the next.
 */
export function cameraFollowRate(framing: number): number {
  const spread = Math.min(Math.max((framing - 1) / 0.1, 0), 1);
  return 5 + spread * 4;
}

/** How fast screen shake fades once the impact is over (1/s). */
export const SHAKE_DECAY_RATE = 14;

/** Shake level this frame: jumps up to a new impact, then fades out instead of cutting off. */
export function decayShake(level: number, impact: number, deltaSeconds: number): number {
  const faded = level * Math.exp(-deltaSeconds * SHAKE_DECAY_RATE);
  const next = Math.max(impact, faded);
  return next < 0.01 ? 0 : next;
}
