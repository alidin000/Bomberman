/* eslint-disable react/no-unknown-property */
import React, {
  forwardRef, useImperativeHandle, useLayoutEffect, useRef,
} from 'react';
import * as THREE from 'three';
import { BossId } from '../../../content/types';
import { getBossDefinition } from '../../../content/bosses';
import {
  FigurePart, createFigureMaterial, mergeFigureParts, part,
} from './figureGeometry';

/**
 * One procedural creature per boss. Each is an original lacquer-spirit
 * construct built on its base silhouette (urn, lantern, bell, boulder
 * shoulders, kettle, spore cap, kite, drum, tiered shrine) with its own head
 * features and limbs, and a fan of spirit tails behind it: as many as the
 * boss's tail count, each boss with its own tail shape (sand coil, flame
 * tongues, coral, rock chain, steam puffs, tendrils, paper streamers, drum
 * cords, ember blades). Tails sway, flare on the entrance roar and droop at
 * the seal.
 *
 * Everything stays inside BOSS_FIGURE_BOUNDS (tails at full sway and flare
 * included), so the figure keeps to its footprint and stays under its phase
 * label, and its glowing core (the face) faces the camera unblocked. Base
 * parts merge into one geometry per material; the tails are one instanced
 * mesh. Materials are shared per boss; their see-through twins (for when
 * something stands behind the boss, and for the seal) and the instanced
 * tails are compiled by ShaderWarmup.
 */

export type BossFigureTone = 'body' | 'trim' | 'core' | 'veil';
export const BOSS_FIGURE_TONES: BossFigureTone[] = ['body', 'trim', 'core', 'veil'];

/** Local bounds before the boss group's scale (about 1.5). */
export const BOSS_FIGURE_BOUNDS = { radius: 0.62, bottom: -0.5, top: 0.95 };

export type BossTailStyle =
  | 'sandCoil' | 'flameTongue' | 'coralBranch' | 'rockChain' | 'steamPuff'
  | 'tendril' | 'streamer' | 'drumCord' | 'emberBlade';

export type BossFigureLook = {
  /** One word for the outline, for tests and the manual. */
  outline: string;
  body: string;
  trim: string;
  /** Emissive focal point: eyes, windows, cracks. The readable "face". */
  core: string;
  tail: BossTailStyle;
};

export const BOSS_FIGURE_LOOKS: Record<BossId, BossFigureLook> = {
  shukaku: {
    outline: 'urn', body: '#c48a4a', trim: '#6b3518', core: '#f59e0b', tail: 'sandCoil',
  },
  matatabi: {
    outline: 'lantern', body: '#9ec5fb', trim: '#16306e', core: '#38bdf8', tail: 'flameTongue',
  },
  isobu: {
    outline: 'bell', body: '#0e7490', trim: '#0b3b4a', core: '#67e8f9', tail: 'coralBranch',
  },
  sonGoku: {
    outline: 'boulder', body: '#9f2a22', trim: '#3a1512', core: '#fb923c', tail: 'rockChain',
  },
  kokuo: {
    outline: 'kettle', body: '#d2d6dc', trim: '#475569', core: '#93c5fd', tail: 'steamPuff',
  },
  saiken: {
    outline: 'sporeCap', body: '#7c3aed', trim: '#ddd6fe', core: '#bef264', tail: 'tendril',
  },
  chomei: {
    outline: 'kite', body: '#1f9d4e', trim: '#ecfdf3', core: '#86efac', tail: 'streamer',
  },
  gyuki: {
    outline: 'drum', body: '#4a1f24', trim: '#ead9f7', core: '#a855f7', tail: 'drumCord',
  },
  kurama: {
    outline: 'shrine', body: '#d9541e', trim: '#6b2a12', core: '#fdba74', tail: 'emberBlade',
  },
};

// `face` is the boss's eyes: its weak point, drawn in the core material. It
// sits where the play camera always sees it (getBossFaceGeometry, tests).
type ToneParts = Partial<Record<BossFigureTone | 'face', FigurePart[]>>;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const drum = (top: number, bottom: number, h: number, segments: number) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const ball = (r: number) => new THREE.SphereGeometry(r, 7, 5);
const cap = (r: number, segments = 8) => (
  new THREE.SphereGeometry(r, segments, 4, 0, Math.PI * 2, 0, Math.PI / 2)
);
const QUARTER = Math.PI / 4;
const HALF_TURN = Math.PI / 2;
const slitEyes = (y: number, z: number, spread = 0.12) => [
  part(box(0.1, 0.045, 0.03), [-spread, y, z]),
  part(box(0.1, 0.045, 0.03), [spread, y, z]),
];
/** A left/right pair: `make` builds the right one (x > 0), mirrored for the left. */
const pair = (make: (side: 1 | -1) => FigurePart): FigurePart[] => [make(-1), make(1)];

const BOSS_PARTS: Record<BossId, () => ToneParts> = {
  // Squat stepped urn: a lidded head, a brow over its eyes, clawed stub arms
  // and clay feet.
  shukaku: () => ({
    body: [
      part(drum(0.5, 0.56, 0.36, 8), [0, -0.28, 0]),
      part(drum(0.4, 0.48, 0.32, 8), [0, 0.06, 0]),
      part(drum(0.3, 0.38, 0.18, 8), [0, 0.31, 0]),
      part(box(0.16, 0.3, 0.16), [-0.5, -0.06, 0], [0, 0, 0.2]),
      part(box(0.16, 0.3, 0.16), [0.5, -0.06, 0], [0, 0, -0.2]),
      ...pair((side) => part(drum(0.1, 0.12, 0.1, 6), [side * 0.26, -0.45, 0.3])),
    ],
    trim: [
      part(drum(0.57, 0.57, 0.05, 8), [0, -0.1, 0]),
      part(drum(0.49, 0.49, 0.05, 8), [0, 0.22, 0]),
      part(rock(0.1), [0, 0.47, 0]),
      part(box(0.36, 0.05, 0.08), [0, 0.17, 0.35], [-0.3, 0, 0]),
      ...pair((side) => part(cone(0.06, 0.16, 4), [side * 0.55, -0.26, 0.04], [Math.PI, 0, 0])),
    ],
    face: slitEyes(0.08, 0.43),
  }),
  // Tall hexagonal paper lantern crowned with flame tongues, a carrying
  // hoop over it and paper fins at its sides.
  matatabi: () => ({
    body: [
      part(drum(0.32, 0.29, 0.66, 6), [0, 0.05, 0]),
      ...pair((side) => part(box(0.03, 0.34, 0.2), [side * 0.36, 0.02, 0], [0, 0, side * -0.25])),
    ],
    trim: [
      part(cone(0.36, 0.22, 6), [0, 0.49, 0]),
      part(drum(0.22, 0.31, 0.12, 6), [0, -0.34, 0]),
      part(drum(0.335, 0.335, 0.04, 6), [0, 0.24, 0]),
      part(drum(0.31, 0.31, 0.04, 6), [0, -0.12, 0]),
      part(new THREE.TorusGeometry(0.2, 0.025, 4, 10, Math.PI), [0, 0.6, -0.02]),
    ],
    face: slitEyes(0.08, 0.29, 0.1),
    veil: [0, 2.1, 4.2].map((angle) => (
      part(cone(0.08, 0.32, 6), [Math.sin(angle) * 0.12, 0.74, Math.cos(angle) * 0.12])
    )),
  }),
  // Temple bell with a hanging loop, a ring of shell spikes on its shoulder
  // and a glowing clapper.
  isobu: () => ({
    body: [part(new THREE.LatheGeometry([
      new THREE.Vector2(0.45, -0.42),
      new THREE.Vector2(0.55, -0.42),
      new THREE.Vector2(0.5, -0.32),
      new THREE.Vector2(0.4, -0.12),
      new THREE.Vector2(0.34, 0.15),
      new THREE.Vector2(0.3, 0.4),
      new THREE.Vector2(0.2, 0.57),
      new THREE.Vector2(0, 0.61),
    ], 8))],
    trim: [
      part(drum(0.565, 0.565, 0.05, 8), [0, -0.37, 0]),
      part(drum(0.35, 0.35, 0.04, 8), [0, 0.12, 0]),
      part(new THREE.TorusGeometry(0.1, 0.035, 4, 8), [0, 0.7, 0]),
      // Shell spikes round the shoulder's sides and back, leaning out.
      ...[1.15, 2.15, 3.14, 4.13, 5.13].map((angle) => part(
        cone(0.05, 0.16, 4),
        [Math.sin(angle) * 0.31, 0.34, Math.cos(angle) * 0.31],
        [Math.cos(angle) * 0.7, 0, -Math.sin(angle) * 0.7]
      )),
    ],
    core: [part(rock(0.13), [0, -0.36, 0])],
    face: slitEyes(0.22, 0.33, 0.1),
  }),
  // Heavy hunched mass: boulder shoulders much wider than the head, two rock
  // horns, and long arms whose knuckles rest on the ground.
  sonGoku: () => ({
    body: [
      part(rock(0.34), [0, -0.05, 0], undefined, [1.1, 0.9, 0.9]),
      part(rock(0.24), [-0.36, 0.18, 0]),
      part(rock(0.24), [0.36, 0.18, 0]),
      part(rock(0.17), [-0.42, -0.28, 0.14]),
      part(rock(0.17), [0.42, -0.28, 0.14]),
    ],
    trim: [
      part(rock(0.15), [0, 0.3, 0.12]),
      ...pair((side) => part(cone(0.05, 0.2, 4), [side * 0.11, 0.47, 0.1], [0, 0, side * -0.55])),
      ...pair((side) => part(rock(0.1), [side * 0.46, -0.38, 0.2])),
    ],
    core: [
      part(box(0.03, 0.3, 0.02), [-0.1, -0.02, 0.31], [0, 0, 0.45]),
      part(box(0.03, 0.26, 0.02), [0.12, -0.06, 0.31], [0, 0, -0.4]),
    ],
    face: slitEyes(0.33, 0.25, 0.06),
  }),
  // Round iron kettle on four stubby legs: pot, lid, forward spout and an
  // arched handle.
  kokuo: () => ({
    body: [
      part(new THREE.SphereGeometry(0.38, 8, 6), [0, -0.05, 0], undefined, [1, 0.8, 1]),
      part(drum(0.05, 0.09, 0.36, 6), [0, 0.02, 0.42], [1.0, 0, 0]),
    ],
    trim: [
      part(drum(0.2, 0.26, 0.08, 8), [0, 0.28, 0]),
      part(rock(0.06), [0, 0.36, 0]),
      part(new THREE.TorusGeometry(0.32, 0.03, 4, 10, Math.PI), [0, 0.1, 0]),
      ...[QUARTER, 3 * QUARTER, 5 * QUARTER, 7 * QUARTER].map((angle) => part(
        drum(0.05, 0.035, 0.2, 5),
        [Math.sin(angle) * 0.26, -0.39, Math.cos(angle) * 0.26]
      )),
    ],
    core: [part(box(0.2, 0.06, 0.03), [0, -0.2, 0.37])],
    face: slitEyes(0.06, 0.37, 0.1),
    veil: [
      part(cone(0.07, 0.26, 6), [-0.08, 0.5, 0.02]),
      part(cone(0.06, 0.22, 6), [0.09, 0.56, -0.04]),
    ],
  }),
  // A wide spore cap on a stalk, with two small caps at its foot and spore
  // vents along its rim.
  saiken: () => ({
    body: [
      part(cap(0.5), [0, 0.12, 0], undefined, [1, 0.55, 1]),
      part(cap(0.2, 7), [-0.38, -0.22, 0.12], undefined, [1, 0.6, 1]),
      part(cap(0.2, 7), [0.38, -0.22, 0.12], undefined, [1, 0.6, 1]),
    ],
    trim: [
      part(drum(0.5, 0.42, 0.06, 8), [0, 0.1, 0]),
      part(drum(0.16, 0.22, 0.5, 7), [0, -0.18, 0]),
      part(drum(0.07, 0.08, 0.2, 6), [-0.38, -0.32, 0.12]),
      part(drum(0.07, 0.08, 0.2, 6), [0.38, -0.32, 0.12]),
      ...[-0.9, 0, 0.9].map((angle) => part(
        drum(0.035, 0.05, 0.07, 5),
        [Math.sin(angle) * 0.34, 0.3, Math.cos(angle) * 0.34]
      )),
    ],
    core: [
      part(rock(0.06), [0.2, 0.36, 0.06]),
      part(rock(0.05), [-0.2, 0.36, -0.06]),
      part(rock(0.05), [0.02, 0.4, -0.2]),
    ],
    // Eyes on the cap's front slope, where the camera looks down on them.
    face: pair((side) => part(box(0.11, 0.05, 0.03), [side * 0.1, 0.28, 0.38], [-0.85, 0, 0])),
  }),
  // A diamond kite spirit with two wide paper wings on a crossed frame.
  chomei: () => ({
    body: [
      part(new THREE.OctahedronGeometry(0.24, 0), [0, 0.2, 0], undefined, [0.9, 1.5, 0.7]),
      part(box(0.5, 0.05, 0.32), [-0.32, 0.25, -0.02], [0, 0.2, 0.25]),
      part(box(0.5, 0.05, 0.32), [0.32, 0.25, -0.02], [0, -0.2, -0.25]),
      part(cone(0.05, 0.22, 4), [0, 0.66, 0]),
    ],
    trim: [
      // Pale spars along the wings' leading edges, like a kite's frame.
      part(box(0.54, 0.035, 0.035), [-0.3, 0.33, 0.13], [0, 0.2, 0.25]),
      part(box(0.54, 0.035, 0.035), [0.3, 0.33, 0.13], [0, -0.2, -0.25]),
      part(box(0.035, 0.6, 0.035), [0, 0.2, -0.16]),
      part(drum(0.04, 0.07, 0.12, 5), [0, -0.2, 0]),
    ],
    core: [part(rock(0.07), [0, 0.12, 0.15])],
    face: slitEyes(0.3, 0.14, 0.06),
  }),
  // A thunder drum on its side, on four short legs, with a mallet at each
  // flank.
  gyuki: () => ({
    body: [
      part(drum(0.36, 0.36, 0.62, 10), [0, 0.05, 0], [0, 0, HALF_TURN]),
      ...[-0.2, 0.2].flatMap((x) => [-0.18, 0.18].map((z) => (
        part(box(0.08, 0.25, 0.08), [x, -0.37, z])
      ))),
    ],
    trim: [
      part(drum(0.38, 0.38, 0.04, 10), [-0.32, 0.05, 0], [0, 0, HALF_TURN]),
      part(drum(0.38, 0.38, 0.04, 10), [0.32, 0.05, 0], [0, 0, HALF_TURN]),
      part(new THREE.TorusGeometry(0.37, 0.025, 4, 12), [-0.18, 0.05, 0], [0, HALF_TURN, 0]),
      part(new THREE.TorusGeometry(0.37, 0.025, 4, 12), [0.18, 0.05, 0], [0, HALF_TURN, 0]),
      ...pair((side) => part(
        drum(0.025, 0.025, 0.36, 4),
        [side * 0.42, 0.18, 0.12],
        [0.5, 0, side * 0.35]
      )),
      ...pair((side) => part(ball(0.06), [side * 0.48, 0.34, 0.22])),
    ],
    core: [part(box(0.3, 0.05, 0.03), [0, -0.1, 0.36])],
    face: slitEyes(0.14, 0.36, 0.09),
  }),
  // Three-tier square shrine with flared roofs, crossed ridge horns on top
  // and an ember door.
  kurama: () => ({
    body: [
      part(box(0.62, 0.2, 0.62), [0, -0.36, 0]),
      part(box(0.44, 0.28, 0.44), [0, -0.12, 0]),
      part(box(0.32, 0.22, 0.32), [0, 0.24, 0]),
      part(box(0.2, 0.16, 0.2), [0, 0.56, 0]),
    ],
    trim: [
      part(cone(0.6, 0.18, 4), [0, 0.11, 0], [0, QUARTER, 0]),
      part(cone(0.46, 0.16, 4), [0, 0.43, 0], [0, QUARTER, 0]),
      part(cone(0.32, 0.14, 4), [0, 0.71, 0], [0, QUARTER, 0]),
      part(drum(0.025, 0.025, 0.1, 4), [0, 0.8, 0]),
      ...pair((side) => part(box(0.03, 0.2, 0.03), [side * 0.06, 0.8, 0], [0, 0, side * -0.6])),
    ],
    core: [
      part(box(0.16, 0.16, 0.03), [0, -0.16, 0.225]),
      part(rock(0.05), [0, 0.86, 0]),
    ],
    // Eyes in the middle roof's front slope: a mask the camera looks down on.
    face: pair((side) => part(box(0.1, 0.045, 0.03), [side * 0.08, 0.43, 0.2], [-0.5, 0, 0])),
  }),
};

// --- Tails -----------------------------------------------------------------

/**
 * Where a boss's tails grow and how they fan. Each tail is the same shape,
 * built pointing up from its root; the fan places one per tail around the
 * figure's back.
 */
export type BossTailLayout = {
  /** Root distance from the figure's axis, and root height. */
  rootRadius: number;
  rootY: number;
  /** Fan width (radians) round the back; a lone tail points straight back. */
  spread: number;
  /** Lean away from vertical (radians): 0 straight up, past π/2 droops. */
  lean: number;
  /** Which of the figure's materials the tails wear. */
  tone: 'body' | 'trim';
  /** Turns the whole fan round the figure (radians from straight back). */
  turn?: number;
};

export const BOSS_TAIL_LAYOUTS: Record<BossId, BossTailLayout> = {
  shukaku: {
    rootRadius: 0.26, rootY: -0.05, spread: 0, lean: 0.42, tone: 'body', turn: 0.85,
  },
  matatabi: {
    rootRadius: 0.22, rootY: -0.1, spread: 2.4, lean: 0.55, tone: 'trim',
  },
  isobu: {
    rootRadius: 0.25, rootY: 0.1, spread: 2, lean: 0.4, tone: 'trim',
  },
  sonGoku: {
    rootRadius: 0.22, rootY: 0, spread: 2.4, lean: 0.45, tone: 'trim',
  },
  kokuo: {
    rootRadius: 0.2, rootY: 0.15, spread: 2.4, lean: 0.45, tone: 'body',
  },
  saiken: {
    rootRadius: 0.24, rootY: 0.34, spread: 3.2, lean: 0.62, tone: 'trim',
  },
  chomei: {
    rootRadius: 0.12, rootY: 0.15, spread: 2.2, lean: 0.7, tone: 'trim',
  },
  gyuki: {
    rootRadius: 0.18, rootY: 0.15, spread: 2.8, lean: 0.48, tone: 'trim',
  },
  kurama: {
    rootRadius: 0.22, rootY: 0.1, spread: 3, lean: 0.45, tone: 'body',
  },
};

/** Sway (radians each way) and how far the roar fans and lifts the tails. */
export const BOSS_TAIL_SWAY = 0.12;
export const BOSS_TAIL_FLARE = { spread: 0.25, lift: -0.15 };
/** The seal: tails droop this much further from vertical, and shrink toward their roots. */
export const BOSS_TAIL_DROOP = { lean: 0.15, shrink: 0.45 };

/**
 * Points along a tail, bending as it rises: `bend` > 0 falls away from the
 * body, < 0 curls back over it. Returns the place and the tilt that follows
 * the curve at `t` (0 root, 1 tip).
 */
function along(
  length: number,
  bend: number,
  t: number
): { at: [number, number, number]; tilt: number } {
  return {
    at: [0, length * t, bend * length * t * t],
    tilt: Math.atan2(2 * bend * t, 1),
  };
}

function tailSegment(
  geometry: THREE.BufferGeometry,
  length: number,
  bend: number,
  t: number,
  scale?: [number, number, number],
  twist = 0
): FigurePart {
  const { at, tilt } = along(length, bend, t);
  return part(geometry, at, [tilt, twist, 0], scale);
}

const TAIL_PARTS: Record<BossTailStyle, () => FigurePart[]> = {
  // One thick coil of stacked sand discs, curling back over the urn.
  sandCoil: () => [0.06, 0.24, 0.42, 0.6, 0.76, 0.9].map((t, index) => (
    tailSegment(drum(0.14 - index * 0.016, 0.15 - index * 0.016, 0.12, 7), 0.7, -0.3, t)
  )).concat(tailSegment(cone(0.05, 0.13, 6), 0.7, -0.3, 1.02)),
  // Flame tongues: three cones narrowing to the tip.
  flameTongue: () => [
    tailSegment(cone(0.1, 0.24, 5), 0.52, 0.15, 0.18),
    tailSegment(cone(0.08, 0.22, 5), 0.52, 0.15, 0.52),
    tailSegment(cone(0.055, 0.2, 5), 0.52, 0.15, 0.86),
  ],
  // A coral branch: a tapering trunk with two side spikes and a bud.
  coralBranch: () => [
    tailSegment(drum(0.035, 0.055, 0.42, 5), 0.42, 0.2, 0.5),
    part(cone(0.03, 0.14, 4), [0.06, 0.2, 0.02], [0, 0, -0.9]),
    part(cone(0.03, 0.12, 4), [-0.06, 0.3, 0.04], [0, 0, 0.9]),
    tailSegment(rock(0.05), 0.42, 0.2, 1),
  ],
  // A chain of shrinking lava rocks.
  rockChain: () => [0.12, 0.38, 0.64, 0.9].map((t, index) => (
    tailSegment(rock(0.1 - index * 0.015), 0.48, 0.2, t)
  )),
  // Steam puffs that swell as they rise.
  steamPuff: () => [0.2, 0.5, 0.85].map((t, index) => (
    tailSegment(ball(0.06 + index * 0.016), 0.4, 0.25, t, [1, 0.8, 1])
  )),
  // Spore tendrils rising from the cap, each ending in a drop.
  tendril: () => [
    tailSegment(drum(0.03, 0.045, 0.2, 5), 0.32, 0.3, 0.3),
    tailSegment(drum(0.022, 0.03, 0.14, 5), 0.32, 0.3, 0.68),
    tailSegment(ball(0.045), 0.32, 0.3, 0.95),
  ],
  // Paper streamers: thin strips that twist as they trail.
  streamer: () => [0.15, 0.48, 0.8].map((t, index) => (
    tailSegment(box(0.08 - index * 0.012, 0.17, 0.012), 0.5, 0.3, t, undefined, (index - 1) * 0.5)
  )),
  // A drum cord with a knot and a tassel.
  drumCord: () => [
    tailSegment(drum(0.018, 0.018, 0.32, 4), 0.42, 0.3, 0.38),
    tailSegment(rock(0.04), 0.42, 0.3, 0.76),
    part(cone(0.055, 0.13, 6), [0, 0.42, 0.3 * 0.42], [Math.PI + Math.atan2(0.6, 1), 0, 0]),
  ],
  // Ember blades: flat flames, an outer blade and an inner one.
  emberBlade: () => [
    tailSegment(cone(0.085, 0.4, 4), 0.5, 0.2, 0.42, [1, 1, 0.35]),
    tailSegment(cone(0.05, 0.22, 4), 0.5, 0.2, 0.82, [1, 1, 0.35]),
  ],
};

export type BossFigureGeometries = Partial<Record<BossFigureTone, THREE.BufferGeometry>>;

const GEOMETRY_CACHE = new Map<BossId, BossFigureGeometries>();
const TAIL_GEOMETRY_CACHE = new Map<BossTailStyle, THREE.BufferGeometry>();

export function getBossFigureGeometries(bossId: BossId): BossFigureGeometries {
  let geometries = GEOMETRY_CACHE.get(bossId);
  if (!geometries) {
    const parts = BOSS_PARTS[bossId]();
    geometries = {};
    BOSS_FIGURE_TONES.forEach((tone) => {
      const list = tone === 'core' ? [...(parts.core ?? []), ...(parts.face ?? [])] : parts[tone];
      if (list?.length && geometries) geometries[tone] = mergeFigureParts(list);
    });
    GEOMETRY_CACHE.set(bossId, geometries);
  }
  return geometries;
}

/** The boss's eyes alone (part of its core mesh): its weak point. For tests and tools. */
export function getBossFaceGeometry(bossId: BossId): THREE.BufferGeometry {
  return mergeFigureParts(BOSS_PARTS[bossId]().face ?? []);
}

/** One tail of this boss, root at the origin and pointing up; shared by its tails. */
export function getBossTailGeometry(bossId: BossId): THREE.BufferGeometry {
  const style = BOSS_FIGURE_LOOKS[bossId].tail;
  let geometry = TAIL_GEOMETRY_CACHE.get(style);
  if (!geometry) {
    geometry = mergeFigureParts(TAIL_PARTS[style]());
    TAIL_GEOMETRY_CACHE.set(style, geometry);
  }
  return geometry;
}

/** One tail per tail of the boss (Shukaku 1 ... Kurama 9). */
export function bossTailCount(bossId: BossId): number {
  return Math.max(1, getBossDefinition(bossId).tails);
}

const TAIL_POSITION = new THREE.Vector3();
const TAIL_QUATERNION = new THREE.Quaternion();
const TAIL_EULER = new THREE.Euler(0, 0, 0, 'YXZ');
const TAIL_SCALE = new THREE.Vector3(1, 1, 1);

/**
 * Tail `index`'s placement in the figure: its slot in the fan, swayed by
 * `sway` (radians), fanned and lifted by `flare` (roar, 0..1) and lowered by
 * `droop` (seal, 0..1).
 */
export function bossTailMatrix(
  bossId: BossId,
  index: number,
  sway: number,
  flare: number,
  droop: number,
  target: THREE.Matrix4
): THREE.Matrix4 {
  const layout = BOSS_TAIL_LAYOUTS[bossId];
  const count = bossTailCount(bossId);
  const spread = count > 1 ? layout.spread + BOSS_TAIL_FLARE.spread * flare : 0;
  const slot = count > 1 ? index / (count - 1) - 0.5 : 0;
  // Straight back is yaw π; the fan opens round it.
  const yaw = Math.PI + (layout.turn ?? 0) + slot * spread + sway * 0.6;
  const lean = layout.lean
    + BOSS_TAIL_FLARE.lift * flare
    + BOSS_TAIL_DROOP.lean * droop
    + sway * 0.25;
  TAIL_POSITION.set(
    Math.sin(yaw) * layout.rootRadius,
    layout.rootY,
    Math.cos(yaw) * layout.rootRadius
  );
  TAIL_EULER.set(lean, yaw, 0, 'YXZ');
  TAIL_QUATERNION.setFromEuler(TAIL_EULER);
  TAIL_SCALE.setScalar(1 - BOSS_TAIL_DROOP.shrink * droop);
  return target.compose(TAIL_POSITION, TAIL_QUATERNION, TAIL_SCALE);
}

/** Each tail's sway phase, so a fan ripples instead of moving as one block. */
export function bossTailPhase(index: number): number {
  return index * 1.3;
}

// --- Materials --------------------------------------------------------------

/** How see-through the figure gets while something it would hide stands behind it. */
export const BOSS_SEE_THROUGH_OPACITY = 0.34;
const VEIL_OPACITY = 0.66;

export type BossFigureMaterials = Record<BossFigureTone, THREE.MeshStandardMaterial> & {
  /** See-through twins of body, trim and core (flat, transparent). */
  seeThrough: Record<'body' | 'trim' | 'core', THREE.MeshStandardMaterial>;
};

const GLOW = { body: 0.08, trim: 0.05, core: 0.95 } as const;

function seeThroughTwin(material: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const twin = material.clone();
  twin.transparent = true;
  twin.depthWrite = false;
  return twin;
}

const MATERIAL_CACHE = new Map<BossId, BossFigureMaterials>();

/** One set per boss for the session (a handful), never disposed. */
export function getBossFigureMaterials(bossId: BossId): BossFigureMaterials {
  let materials = MATERIAL_CACHE.get(bossId);
  if (!materials) {
    const look = BOSS_FIGURE_LOOKS[bossId];
    const body = createFigureMaterial(look.body, { glow: look.core, glowIntensity: GLOW.body });
    const trim = createFigureMaterial(look.trim, { glow: look.core, glowIntensity: GLOW.trim });
    const core = createFigureMaterial(look.core, { glowIntensity: GLOW.core });
    const veil = createFigureMaterial('#eef6ff', { translucent: true, glow: look.core, glowIntensity: 0.9 });
    materials = {
      body,
      trim,
      core,
      veil,
      seeThrough: {
        body: seeThroughTwin(body),
        trim: seeThroughTwin(trim),
        core: seeThroughTwin(core),
      },
    };
    MATERIAL_CACHE.set(bossId, materials);
  }
  return materials;
}

// --- Figure -----------------------------------------------------------------

/** What the boss's presentation (BossMesh) asks of the figure each frame. */
export type BossFigurePose = {
  /** Tail sway angle source: seconds on a clock that stops for hit-stop. */
  swayTime: number;
  /** 0 holds the tails still (reduced motion, seal), 1 full sway. */
  swayAmount: number;
  /** Entrance roar: tails fan and lift (0..1). */
  flare: number;
  /** Seal: tails droop (0..1). */
  droop: number;
  /** Phase 2 colour shift: the body glows toward its core colour (0..1). */
  enrage: number;
  /** See-through while it would hide a player or a telegraph (0..1). */
  seeThrough: number;
  /** Seal: the figure dissolves and its core dims (0 whole .. 1 gone). */
  dissolve: number;
};

export type BossFigureHandle = {
  apply: (pose: BossFigurePose) => void;
};

/** Extra body and trim glow at full enrage (emissive toward the core colour). */
export const BOSS_ENRAGE_GLOW = 0.32;

const TAIL_MATRIX = new THREE.Matrix4();
const SOLID_TONES = ['body', 'trim', 'core'] as const;

function BossFigureBase({ bossId }: { bossId: BossId }, ref: React.Ref<BossFigureHandle>) {
  const geometries = getBossFigureGeometries(bossId);
  const materials = getBossFigureMaterials(bossId);
  const tailGeometry = getBossTailGeometry(bossId);
  const tailTone = BOSS_TAIL_LAYOUTS[bossId].tone;
  const tailCount = bossTailCount(bossId);
  const meshes = useRef<Partial<Record<BossFigureTone, THREE.Mesh | null>>>({});
  const tails = useRef<THREE.InstancedMesh>(null);
  const setters = useRef(Object.fromEntries(BOSS_FIGURE_TONES.map((tone) => [
    tone,
    (mesh: THREE.Mesh | null) => { meshes.current[tone] = mesh; },
  ])) as Record<BossFigureTone, (mesh: THREE.Mesh | null) => void>);

  const writeTails = (pose: BossFigurePose | null) => {
    const mesh = tails.current;
    if (!mesh) return;
    for (let index = 0; index < tailCount; index += 1) {
      const sway = pose
        ? Math.sin(pose.swayTime * 1.7 + bossTailPhase(index)) * BOSS_TAIL_SWAY * pose.swayAmount
        : 0;
      bossTailMatrix(bossId, index, sway, pose?.flare ?? 0, pose?.droop ?? 0, TAIL_MATRIX);
      mesh.setMatrixAt(index, TAIL_MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => { writeTails(null); });

  useImperativeHandle(ref, () => ({
    apply: (pose) => {
      const faded = pose.seeThrough > 0.001 || pose.dissolve > 0.001;
      const opacity = (1 - (1 - BOSS_SEE_THROUGH_OPACITY) * pose.seeThrough) * (1 - pose.dissolve);
      const glow = 1 - pose.dissolve * 0.85;
      SOLID_TONES.forEach((tone) => {
        const solid = materials[tone];
        const twin = materials.seeThrough[tone];
        const enrage = tone === 'core' ? 0 : BOSS_ENRAGE_GLOW * pose.enrage;
        solid.emissiveIntensity = (GLOW[tone] + enrage) * glow;
        twin.emissiveIntensity = solid.emissiveIntensity;
        twin.opacity = opacity;
        const mesh = meshes.current[tone];
        if (mesh) mesh.material = faded ? twin : solid;
      });
      materials.veil.opacity = VEIL_OPACITY * opacity;
      const tailMesh = tails.current;
      if (tailMesh) {
        tailMesh.material = faded ? materials.seeThrough[tailTone] : materials[tailTone];
      }
      writeTails(pose);
    },
  }));

  return (
    <>
      {BOSS_FIGURE_TONES.map((tone) => {
        const geometry = geometries[tone];
        if (!geometry) return null;
        return (
          <mesh
            key={tone}
            ref={setters.current[tone]}
            geometry={geometry}
            material={materials[tone]}
            castShadow={tone === 'body'}
          />
        );
      })}
      <instancedMesh
        ref={tails}
        args={[tailGeometry, materials[tailTone], tailCount]}
        frustumCulled={false}
        userData={{ bossTails: bossId }}
      />
    </>
  );
}

// BossMesh re-renders every tick; the figure only changes with the boss.
export const BossFigure = React.memo(forwardRef(BossFigureBase));
