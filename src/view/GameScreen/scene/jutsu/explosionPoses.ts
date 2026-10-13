import * as THREE from 'three';
import {
  JUTSU_COLORS, JutsuEffect, LIGHTNING_FORKS_PER_S, RASENSHURIKEN_TURNS_PER_S, TOMOE_TURNS_PER_S,
} from './jutsuLooks';

/**
 * How one burning cell draws its jutsu, as pure numbers: for each instanced
 * layer of the blast (ExplosionField), where its piece sits (relative to the
 * cell), how big it is, how it turns and what colour it wears. Written in
 * place every frame for every burning cell, so nothing here allocates.
 *
 * The first five layers draw for every cell (a piece too small to see when
 * the jutsu has no use for it, as before); the jutsu layers draw only for the
 * cells that use them. Only `progress` (the flame's age) and the reduced
 * motion flag shape a pose, plus the frame clock for the few shapes that
 * spin or crackle, at the beats jutsuLooks keeps under three a second.
 * Reduced motion holds them still: nothing spins, forks or flies, and
 * pieces grow and shrink instead.
 */
export const BASE_LAYERS = ['flame', 'shockwave', 'ring', 'accent', 'debris'] as const;
export const JUTSU_LAYERS = ['bolt', 'puff', 'blade', 'bird', 'sigil'] as const;
export type BaseLayer = (typeof BASE_LAYERS)[number];
export type JutsuLayer = (typeof JUTSU_LAYERS)[number];
export type ExplosionLayer = BaseLayer | JutsuLayer;

export type LayerPose = {
  on: boolean;
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  /** Euler angles, applied in YXZ order: yaw, then pitch, then roll. */
  rx: number; ry: number; rz: number;
  color: THREE.Color;
};

export type CellPose = Record<ExplosionLayer, LayerPose>;

export function createCellPose(): CellPose {
  const make = (): LayerPose => ({
    on: false, x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0, color: new THREE.Color(),
  });
  return Object.fromEntries(
    [...BASE_LAYERS, ...JUTSU_LAYERS].map((layer) => [layer, make()])
  ) as CellPose;
}

const HIDDEN = 0.001;
const TAU = Math.PI * 2;
/** Golden angle: neighbouring cells' pieces point different ways. */
const SPREAD = 2.39996;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (from: number, to: number, value: number) => {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

function set(
  pose: LayerPose,
  color: THREE.Color,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  rx = 0,
  ry = 0,
  rz = 0
): void {
  const target = pose;
  target.on = true;
  target.x = x; target.y = y; target.z = z;
  target.sx = sx; target.sy = sy; target.sz = sz;
  target.rx = rx; target.ry = ry; target.rz = rz;
  target.color.copy(color);
}

function hide(pose: LayerPose, y: number): void {
  const target = pose;
  target.on = false;
  target.x = 0; target.y = y; target.z = 0;
  target.sx = HIDDEN; target.sy = HIDDEN; target.sz = HIDDEN;
  target.rx = 0; target.ry = 0; target.rz = 0;
}

/** Debris scattering out from the cell: sparks, grains, chunks, feathers. */
function scatter(
  out: CellPose,
  color: THREE.Color,
  index: number,
  p: number,
  reducedMotion: boolean,
  size: number,
  lift = 0.32
): void {
  const pulse = Math.sin(p * Math.PI);
  const grown = size + pulse * 0.09;
  set(
    out.debris,
    color,
    Math.sin(index * 1.8) * (0.2 + p * 0.4),
    0.18 + pulse * lift,
    Math.cos(index * 1.8) * (0.2 + p * 0.4),
    grown,
    grown,
    grown,
    reducedMotion ? 0 : p * Math.PI,
    index * 0.9,
    reducedMotion ? 0 : p * Math.PI * 0.5
  );
}

/** The Rasenshuriken's blade angle (radians) at `seconds`; fixed under reduced motion. */
export function rasenshurikenSpin(seconds: number, index: number, reducedMotion: boolean): number {
  return (reducedMotion ? 0 : seconds * TAU * RASENSHURIKEN_TURNS_PER_S) + index * 0.4;
}

/** The tomoe's angle (radians) at `seconds`; fixed under reduced motion. */
export function tomoeSpin(seconds: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : seconds * TAU * TOMOE_TURNS_PER_S;
}

/** Which fork of the lightning shows at `seconds`; one fork under reduced motion. */
export function lightningFork(seconds: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : Math.floor(seconds * LIGHTNING_FORKS_PER_S);
}

/**
 * Poses every layer of one burning cell. `progress` is the flame's age over
 * its life (0..1), `index` the cell's place in the blast, `seconds` the
 * frame clock.
 */
export function poseJutsuCell(
  effect: JutsuEffect,
  progress: number,
  index: number,
  seconds: number,
  reducedMotion: boolean,
  out: CellPose
): CellPose {
  const p = clamp01(progress);
  const pulse = Math.sin(p * Math.PI);
  const grow = 1 - (1 - p) * (1 - p);
  // Pieces that linger shrink away over the last stretch of the flame.
  const ebb = 1 - 0.6 * smoothstep(0.72, 1, p);
  const c = JUTSU_COLORS[effect];
  const angle = index * SPREAD;
  for (let layer = 0; layer < JUTSU_LAYERS.length; layer += 1) hide(out[JUTSU_LAYERS[layer]], 0);

  // The danger marks under every jutsu: an expanding shockwave and the hex ring.
  const shock = 0.65 + p * 1.4;
  set(out.shockwave, c.danger, 0, 0.16, 0, shock, shock, shock, -Math.PI / 2, 0, p * Math.PI);
  const ring = 0.7 + pulse * 0.25;
  set(out.ring, c.danger, 0, 0.14, 0, ring, ring, ring, -Math.PI / 2);
  hide(out.accent, 0.52);
  hide(out.debris, 0.14);
  switch (effect) {
    case 'smoke':
    case 'barrage': {
      // A clone bursts: an orange chakra flash inside a white puff of smoke.
      const big = effect === 'barrage' ? 1.18 : 1;
      const flame = (0.55 + pulse * 0.3) * big;
      set(out.flame, c.body, 0, 0.38, 0, flame, flame, flame, 0, p * TAU);
      const puff = (0.75 + grow * 0.55) * ebb * big;
      set(out.puff, c.extra, 0, 0.3 + grow * 0.25, 0, puff, puff * 0.8, puff, 0, index * 1.3);
      scatter(out, c.debris, index, p, reducedMotion, 0.08, 0.4);
      if (effect === 'barrage') {
        set(out.accent, c.accent, 0, 0.6 + pulse * 0.2, 0, 0.18, 0.9 + pulse * 0.4, 0.18, 0, angle);
      }
      break;
    }
    case 'rasengan': {
      // The blue sphere and the four wind blades turning round it.
      const core = 0.5 + pulse * 0.35;
      set(out.flame, c.body, 0, 0.45, 0, core, core, core);
      const blade = (0.8 + pulse * 0.45) * ebb;
      const spin = rasenshurikenSpin(seconds, index, reducedMotion);
      set(out.blade, c.extra, 0, 0.46, 0, blade, 1, blade, 0, spin);
      const orbit = (reducedMotion ? 0 : p * TAU) + index;
      set(
        out.accent,
        c.accent,
        Math.sin(orbit) * 0.3,
        0.44 + pulse * 0.2,
        Math.cos(orbit) * 0.3,
        0.1,
        0.7 + pulse * 0.3,
        0.1,
        Math.PI / 2,
        orbit + Math.PI / 2
      );
      scatter(out, c.debris, index, p, reducedMotion, 0.075);
      break;
    }
    case 'chidori':
    case 'kirin': {
      // A crackling column with a forked bolt; Kirin's comes down from the sky.
      const tall = effect === 'kirin' ? 1.3 : 1;
      set(
        out.flame,
        c.body,
        0,
        (0.7 + pulse * 0.18) * tall,
        0,
        0.3 + pulse * 0.08,
        (1.4 + pulse * 0.6) * tall,
        0.3 + pulse * 0.08
      );
      const fork = lightningFork(seconds, reducedMotion);
      const reach = effect === 'kirin' ? 2.3 + pulse * 0.4 : 0.75 + pulse * 0.45;
      const width = effect === 'kirin' ? 1.5 : 1;
      const yaw = fork * 2.4 + index * 1.7;
      set(out.bolt, c.extra, 0, 0.04, 0, width * ebb, reach, width * ebb, 0, yaw);
      set(
        out.accent,
        c.accent,
        0,
        0.68 + pulse * 0.28,
        0,
        0.13,
        1.25 + pulse * 0.85,
        0.13,
        reducedMotion ? 0 : p * Math.PI,
        reducedMotion ? index : p * Math.PI + index,
        index * 0.7
      );
      scatter(out, c.debris, index, p, reducedMotion, 0.085);
      break;
    }
    case 'sand':
    case 'tsunami': {
      // Sand heaves up in a dome, spikes close in on the cell, dust rolls out.
      const wave = effect === 'tsunami' ? 1.15 : 1;
      set(
        out.flame,
        c.body,
        0,
        0.24 + pulse * 0.12,
        0,
        (1.2 + pulse * 0.35) * wave,
        (0.46 + pulse * 0.22) * wave,
        (1.2 + pulse * 0.35) * wave
      );
      set(
        out.accent,
        c.accent,
        Math.sin(angle) * 0.3,
        0.25 + grow * 0.15,
        Math.cos(angle) * 0.3,
        0.13 * ebb,
        (0.5 + grow * 0.5) * ebb,
        0.13 * ebb,
        -0.6,
        angle
      );
      const dust = (1.1 + grow * 0.4) * ebb;
      const crest = effect === 'tsunami' ? 0.5 + grow * 0.25 : 0.18 + grow * 0.1;
      set(out.puff, c.extra, 0, crest, 0, dust, effect === 'tsunami' ? 0.6 : 0.45, dust, 0, index * 1.3);
      scatter(out, c.debris, index, p, reducedMotion, 0.14);
      break;
    }
    case 'clay':
    case 'c3': {
      // "Katsu!": a cream-white blast, orange smoke, clay chunks; the giant
      // bomb's smoke rises into a mushroom cap.
      const giant = effect === 'c3' ? 1.2 : 1;
      set(
        out.flame,
        c.body,
        0,
        0.5 + pulse * 0.16,
        0,
        (1.28 + pulse * 0.35) * giant,
        (1.18 + pulse * 0.45) * giant,
        (1.28 + pulse * 0.35) * giant
      );
      if (effect === 'c3') {
        const cap = (1.1 + grow * 0.6) * ebb;
        set(out.puff, c.extra, 0, 0.95 + grow * 0.55, 0, cap, 0.55, cap, 0, index * 1.3);
        set(out.accent, c.accent, 0, 0.6 + grow * 0.25, 0, 0.3, 1.2 + grow * 0.5, 0.3, 0, angle);
      } else {
        const smoke = (0.6 + grow * 0.6) * ebb;
        set(out.puff, c.extra, 0, 0.62 + grow * 0.45, 0, smoke, smoke * 0.8, smoke, 0, index * 1.3);
        set(
          out.accent,
          c.accent,
          0,
          0.72 + pulse * 0.24,
          0,
          0.2 + pulse * 0.06,
          1 + pulse * 0.45,
          0.2 + pulse * 0.06,
          0,
          reducedMotion ? index * 0.5 : p * Math.PI + index * 0.5
        );
      }
      scatter(out, c.debris, index, p, reducedMotion, 0.1);
      break;
    }
    case 'amaterasu':
    case 'tsukuyomi': {
      // A red haze with Amaterasu's black flames; crows scatter from a burst
      // clone, the Sharingan's tomoe turn on the floor of Tsukuyomi.
      const haze = 0.74 + pulse * 0.18;
      set(out.flame, c.body, 0, 0.42 + pulse * 0.12, 0, haze, 1.15 + pulse * 0.4, haze);
      set(
        out.accent,
        c.accent,
        0,
        0.45 + pulse * 0.2,
        0,
        0.24 + pulse * 0.08,
        0.95 + pulse * 0.5,
        0.24 + pulse * 0.08,
        0,
        angle,
        0
      );
      if (effect === 'amaterasu') {
        const out1 = reducedMotion ? 0.28 : 0.12 + grow * 0.55;
        const rise = reducedMotion ? 0.45 : 0.35 + grow * 0.55;
        const crow = 0.9 * ebb;
        const [bx, bz] = [Math.sin(angle) * out1, Math.cos(angle) * out1];
        set(out.bird, c.extra, bx, rise, bz, crow, crow, crow, -0.3, angle);
      } else {
        const tomoe = 0.85 + grow * 0.25;
        set(out.sigil, c.extra, 0, 0.12, 0, tomoe, 1, tomoe, 0, tomoeSpin(seconds, reducedMotion));
      }
      set(
        out.debris,
        c.debris,
        Math.sin(index * 2.6 + (reducedMotion ? 0 : p * 4)) * 0.34,
        0.32 + pulse * 0.24,
        Math.cos(index * 2.6 + (reducedMotion ? 0 : p * 4)) * 0.34,
        0.16 + pulse * 0.08,
        0.28,
        0.08,
        0.5,
        index * 1.1,
        0
      );
      break;
    }
    case 'hiraishin': {
      // The yellow flash: a bright core and streaks shooting out from the mark.
      const core = 0.62 + pulse * 0.32;
      set(out.flame, c.body, 0, 0.34 + pulse * 0.2, 0, core, 0.82 + pulse * 0.4, core);
      const length = 0.5 + pulse;
      const from = 0.15 + length * 0.3;
      set(
        out.accent,
        c.accent,
        Math.sin(angle) * from,
        0.38,
        Math.cos(angle) * from,
        0.08,
        length,
        0.08,
        Math.PI / 2,
        angle
      );
      break;
    }
    default: {
      // An explosive tag's fireball.
      set(
        out.flame,
        c.body,
        0,
        0.45 + p * 0.08,
        0,
        0.95 - p * 0.18,
        1.05 + pulse * 0.32,
        0.95 - p * 0.18,
        0,
        p * TAU
      );
      break;
    }
  }
  return out;
}
