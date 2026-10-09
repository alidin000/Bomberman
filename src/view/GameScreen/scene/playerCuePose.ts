/* eslint-disable no-param-reassign -- writes into a caller-owned scratch pose */
import { CUE_DURATION_MS, PlayerCue } from '../../../hooks/cueStore';

// Fast, short poses for player events, drawn on a child group of the fighter
// so the walk bob, facing turn and shield flicker on the outer group never
// fight them. Timings follow the shinobi motion memo: the cue starts on the
// first frame, leans in within 50 ms, a plant holds under 160 ms with no
// movement lock, a hit lands in 60-100 ms, and everything settles by 220 ms
// (the ultimate flourish by 300 ms). Reduced motion swaps each animation for
// one static pose held for the same window, so no event goes unseen.

export type PlayerPose = {
  /** Forward lean in radians (negative leans back). */
  lean: number;
  /** Turn about the vertical axis in radians. */
  spin: number;
  scaleY: number;
  scaleXZ: number;
  /** Vertical offset of the feet, world units. */
  lift: number;
  /** True once a fallen fighter's pose is over: hide the body. */
  hidden: boolean;
};

export function createPlayerPose(): PlayerPose {
  return {
    lean: 0, spin: 0, scaleY: 1, scaleXZ: 1, lift: 0, hidden: false,
  };
}

function rest(pose: PlayerPose): PlayerPose {
  pose.lean = 0;
  pose.spin = 0;
  pose.scaleY = 1;
  pose.scaleXZ = 1;
  pose.lift = 0;
  pose.hidden = false;
  return pose;
}

function smooth(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/** 0 -> 1 over `attack` ms, held to `hold`, back to 0 by `end`. */
function envelope(ageMs: number, attack: number, hold: number, end: number): number {
  if (ageMs < 0 || ageMs >= end) return 0;
  if (ageMs < attack) return 1 - (1 - ageMs / attack) ** 2;
  if (ageMs < hold) return 1;
  return 1 - smooth((ageMs - hold) / (end - hold));
}

export const PLANT_ATTACK_MS = 50;
export const PLANT_HOLD_MS = 110;
export const HIT_ATTACK_MS = 30;
export const HIT_HOLD_MS = 90;
const ULTIMATE_CROUCH_MS = 50;
const DEATH_FLINCH_MS = 80;

function plantPose(pose: PlayerPose, age: number, reduced: boolean): void {
  if (reduced) {
    if (age < PLANT_HOLD_MS) pose.scaleY = 0.9;
    return;
  }
  const k = envelope(age, PLANT_ATTACK_MS, PLANT_HOLD_MS, CUE_DURATION_MS.plant);
  if (k <= 0) return;
  pose.lean = 0.24 * k;
  pose.scaleY = 1 - 0.14 * k;
  pose.scaleXZ = 1 + 0.08 * k;
}

function hitPose(pose: PlayerPose, age: number, reduced: boolean): void {
  if (reduced) {
    if (age < 100) {
      pose.lean = -0.22;
      pose.scaleY = 0.86;
    }
    return;
  }
  const k = envelope(age, HIT_ATTACK_MS, HIT_HOLD_MS, CUE_DURATION_MS.hit);
  if (k <= 0) return;
  pose.lean = -0.34 * k;
  pose.scaleY = 1 - 0.18 * k;
  pose.scaleXZ = 1 + 0.1 * k;
}

function ultimatePose(pose: PlayerPose, age: number, reduced: boolean): void {
  if (reduced) {
    if (age < 160) {
      pose.scaleY = 1.12;
      pose.scaleXZ = 0.95;
    }
    return;
  }
  const end = CUE_DURATION_MS.ultimate;
  if (age >= end) return;
  if (age < ULTIMATE_CROUCH_MS) {
    const k = age / ULTIMATE_CROUCH_MS;
    pose.scaleY = 1 - 0.14 * k;
    pose.scaleXZ = 1 + 0.08 * k;
    return;
  }
  const t = (age - ULTIMATE_CROUCH_MS) / (end - ULTIMATE_CROUCH_MS);
  const rise = Math.sin(Math.PI * Math.min(1, t));
  pose.scaleY = 1 + 0.16 * rise;
  pose.scaleXZ = 1 - 0.05 * rise;
  pose.lift = 0.14 * rise;
  // One whole turn, easing out, so it ends facing where it started.
  pose.spin = Math.PI * 2 * (1 - (1 - Math.min(1, t)) ** 3);
}

function deathPose(pose: PlayerPose, age: number, reduced: boolean): void {
  if (age >= CUE_DURATION_MS.death) {
    pose.hidden = true;
    return;
  }
  if (reduced) {
    // Knocked down and held still, then gone.
    pose.lean = -0.62;
    pose.scaleY = 0.82;
    return;
  }
  if (age < DEATH_FLINCH_MS) {
    const k = 1 - (1 - age / DEATH_FLINCH_MS) ** 2;
    pose.lean = -0.36 * k;
    pose.scaleY = 1 - 0.2 * k;
    pose.scaleXZ = 1 + 0.12 * k;
    return;
  }
  const t = (age - DEATH_FLINCH_MS) / (CUE_DURATION_MS.death - DEATH_FLINCH_MS);
  const k = t * t;
  pose.lean = -0.36 * (1 - t);
  pose.spin = Math.PI * 3 * k;
  const shrink = 1 - 0.85 * k;
  pose.scaleY = 0.8 * shrink;
  pose.scaleXZ = 1.12 * shrink;
  pose.lift = -0.18 * k;
}

/**
 * Writes the pose `cue` shows at `nowMs` into `pose` and returns it. No cue,
 * or one that has run out, is the rest pose; a fallen fighter without a cue
 * (the store is off, or the fall predates it) is hidden at once.
 */
export function samplePlayerCuePose(
  cue: PlayerCue | null,
  nowMs: number,
  alive: boolean,
  reducedMotion: boolean,
  pose: PlayerPose
): PlayerPose {
  rest(pose);
  if (!alive && (!cue || cue.kind !== 'death')) {
    pose.hidden = true;
    return pose;
  }
  if (!cue) return pose;
  const age = Math.max(0, nowMs - cue.startMs);
  if (cue.kind === 'plant') plantPose(pose, age, reducedMotion);
  else if (cue.kind === 'hit') hitPose(pose, age, reducedMotion);
  else if (cue.kind === 'ultimate') ultimatePose(pose, age, reducedMotion);
  else deathPose(pose, age, reducedMotion);
  return pose;
}
