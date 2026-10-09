import * as THREE from 'three';
import { BOSS_INTRO_MS } from '../../../engine/constants';
import { BOSS_FIGURE_BOUNDS } from './BossFigure';

// How a boss arrives, changes phase and falls, as render-only curves of time.
// None of it writes engine state: the entrance runs on the engine's frozen
// intro clock (bossIntroMsRemaining), the phase cue and the seal on frame
// time. Reduced motion keeps every cue but drops the movement: the camera
// cuts instead of gliding, nothing rears, sinks or tilts, and fades replace
// motion. Nothing here flashes: every colour or opacity change is one ramp.

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

// --- Entrance ---------------------------------------------------------------

/** The camera reaches the boss by here (ms into the intro)... */
export const INTRO_ARRIVE_MS = 600;
/** ...and heads back to the players from here, so play resumes on them. */
export const INTRO_RETURN_FROM_MS = BOSS_INTRO_MS - 650;
/**
 * Camera framing (1 = the closest play framing) on arrival and at the
 * closest push-in. The push-in stays gentle: zooming streams the far floor
 * grid's fine lines past the screen's top corners.
 */
export const INTRO_FRAMING = { arrive: 0.92, close: 0.82, steady: 0.86 };
/** Aim this far toward the camera from the boss, so it sits above the title card. */
export const INTRO_AIM_TOWARD_CAMERA = 0.9;
/** Follow rate (1/s) while the intro steers the camera, and just after it. */
export const INTRO_FOLLOW_RATE = 12;
export const INTRO_CATCH_UP_MS = 700;
/** The roar: the boss rears up and fans its tails. */
export const ROAR_FROM_MS = 700;
export const ROAR_MS = 700;

/**
 * The camera glides to a boss at most this many cells from the players'
 * framing; further, it cuts. A glide streams the floor grid past the view:
 * kept this short and slow, a grid line crosses a pixel at most about three
 * times a second (PULSE_HZ's limit), where a sweep across the board would
 * cross it twenty times.
 */
export const INTRO_GLIDE_MAX_CELLS = 2.5;

/** True when the camera should cut to the boss rather than glide. */
export function introCuts(
  boss: { x: number; y: number },
  framedX: number,
  framedY: number
): boolean {
  return Math.hypot(boss.x - framedX, boss.y - framedY) > INTRO_GLIDE_MAX_CELLS;
}

/**
 * How much the camera frames the boss instead of the players (0..1), `ms`
 * into the intro. A cut (reduced motion, or a far boss): 1 for the whole
 * intro.
 */
export function introCameraWeight(ms: number, cut: boolean): number {
  if (ms < 0 || ms >= BOSS_INTRO_MS) return 0;
  if (cut) return 1;
  const arrive = smoothstep(0, INTRO_ARRIVE_MS, ms);
  const leave = smoothstep(INTRO_RETURN_FROM_MS, BOSS_INTRO_MS, ms);
  return Math.min(arrive, 1 - leave);
}

/** The intro's camera framing: a slow push-in on the boss; steady under reduced motion. */
export function introFraming(ms: number, reducedMotion: boolean): number {
  if (reducedMotion) return INTRO_FRAMING.steady;
  const push = smoothstep(INTRO_ARRIVE_MS, INTRO_RETURN_FROM_MS, ms);
  return INTRO_FRAMING.arrive + (INTRO_FRAMING.close - INTRO_FRAMING.arrive) * push;
}

/** The roar's rise and fall (0..1..0), one swell; 0 under reduced motion. */
export function roarAmount(ms: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  const t = (ms - ROAR_FROM_MS) / ROAR_MS;
  if (t <= 0 || t >= 1) return 0;
  return Math.sin(Math.PI * t) ** 2;
}

// --- Phase change -----------------------------------------------------------

/** The hit-stop beat when a boss changes phase: it holds still this long... */
export const PHASE_HIT_STOP_MS = 200;
/** ...then its body glows toward its core colour over this long. */
export const PHASE_SHIFT_MS = 450;

export type PhaseCue = {
  /** Hold the figure still (sway, bob): the hit-stop beat. */
  hold: boolean;
  /** Colour shift toward the core (0..1), one ramp. */
  enrage: number;
  /** Size swell toward the phase-2 scale (0..1). */
  swell: number;
};

/**
 * The phase-change cue, `sinceMs` after the boss changed phase (null: no
 * change seen, so a boss already in phase 2 shows it fully). Reduced motion
 * keeps the colour ramp and swells at once, with no hold.
 */
export function phaseCue(
  phase: number,
  sinceMs: number | null,
  reducedMotion: boolean,
  // Written in place when given: the scene calls this every frame.
  target: PhaseCue = { hold: false, enrage: 0, swell: 0 }
): PhaseCue {
  const cue = target;
  cue.hold = false;
  if (phase <= 1) {
    cue.enrage = 0;
    cue.swell = 0;
  } else if (sinceMs === null) {
    cue.enrage = 1;
    cue.swell = 1;
  } else {
    cue.enrage = smoothstep(PHASE_HIT_STOP_MS, PHASE_HIT_STOP_MS + PHASE_SHIFT_MS, sinceMs);
    cue.swell = reducedMotion ? 1 : smoothstep(PHASE_HIT_STOP_MS, PHASE_HIT_STOP_MS + 300, sinceMs);
    cue.hold = !reducedMotion && sinceMs < PHASE_HIT_STOP_MS;
  }
  return cue;
}

// --- Seal -------------------------------------------------------------------

/** The deciding blast holds the boss still this long... */
export const SEAL_BEAT_MS = 250;
/** ...then it collapses and dissolves over this long. */
export const SEAL_COLLAPSE_MS = 1200;
/** Gone from here on: well inside the boss-seal hold, so the scene draws all of it. */
export const SEAL_DONE_MS = SEAL_BEAT_MS + SEAL_COLLAPSE_MS;

export type SealPose = {
  /** Sink below its float height (local units). */
  sink: number;
  /** Topple forward (radians). */
  tilt: number;
  /** Height squash (1 whole). */
  squash: number;
  /** Fade out and dim (0 whole .. 1 gone). */
  dissolve: number;
  /** Tails droop (0..1). */
  droop: number;
  /** Nothing left to draw. */
  gone: boolean;
};

export function sealPose(
  sinceMs: number,
  reducedMotion: boolean,
  // Written in place when given: the scene calls this every frame.
  target: SealPose = {
    sink: 0, tilt: 0, squash: 1, dissolve: 0, droop: 0, gone: false,
  }
): SealPose {
  const pose = target;
  const t = clamp01((sinceMs - SEAL_BEAT_MS) / SEAL_COLLAPSE_MS);
  const fall = reducedMotion ? 0 : smoothstep(0, 1, t);
  pose.dissolve = smoothstep(0.3, 1, t);
  pose.gone = sinceMs >= SEAL_DONE_MS;
  pose.sink = 0.75 * fall;
  pose.tilt = 0.42 * fall;
  pose.squash = 1 - 0.45 * fall;
  pose.droop = reducedMotion ? 0 : smoothstep(0, 0.5, t);
  return pose;
}

// --- Not hiding what stands behind ------------------------------------------

const CORNER = new THREE.Vector3();
const POINT = new THREE.Vector3();
const CENTRE = new THREE.Vector3();

/** The boss's silhouette box on screen (NDC) and how deep its middle sits. */
export type ScreenBox = {
  minX: number; maxX: number; minY: number; maxY: number;
  /** View-space distance of the box's middle. */
  depth: number;
};

export function createScreenBox(): ScreenBox {
  return {
    minX: 0, maxX: 0, minY: 0, maxY: 0, depth: 0,
  };
}

/**
 * Projects the figure's bounds (BOSS_FIGURE_BOUNDS under `matrixWorld`) onto
 * the screen. The box over-covers the figure a little, so it errs on the side
 * of letting the player see through it.
 */
export function bossScreenBox(
  matrixWorld: THREE.Matrix4,
  camera: THREE.Camera,
  target: ScreenBox
): ScreenBox {
  const box = target;
  const { radius, bottom, top } = BOSS_FIGURE_BOUNDS;
  box.minX = Infinity;
  box.maxX = -Infinity;
  box.minY = Infinity;
  box.maxY = -Infinity;
  for (let corner = 0; corner < 8; corner += 1) {
    CORNER.set(
      corner % 2 ? radius : -radius,
      Math.floor(corner / 2) % 2 ? top : bottom,
      corner >= 4 ? radius : -radius
    ).applyMatrix4(matrixWorld).project(camera);
    box.minX = Math.min(box.minX, CORNER.x);
    box.maxX = Math.max(box.maxX, CORNER.x);
    box.minY = Math.min(box.minY, CORNER.y);
    box.maxY = Math.max(box.maxY, CORNER.y);
  }
  CENTRE.set(0, (top + bottom) / 2, 0)
    .applyMatrix4(matrixWorld)
    .applyMatrix4(camera.matrixWorldInverse);
  box.depth = -CENTRE.z;
  return box;
}

/** True when the world point (x, y, z) is drawn inside the box and further away than the boss. */
export function behindScreenBox(
  box: ScreenBox,
  camera: THREE.Camera,
  x: number,
  y: number,
  z: number
): boolean {
  POINT.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
  if (-POINT.z <= box.depth) return false;
  POINT.applyMatrix4(camera.projectionMatrix);
  return POINT.x > box.minX && POINT.x < box.maxX && POINT.y > box.minY && POINT.y < box.maxY;
}

/** How fast the figure turns see-through and back (1/s). */
export const SEE_THROUGH_RATE = 12;
