import * as THREE from 'three';
import { FigurePart, Vec3, part } from '../figureGeometry';

/**
 * Shape helpers for the tailed beasts. Every beast is a handful of
 * primitives per material (merged once per beast by BossFigure) and one tail
 * shape that its fan of tails instances. Units are the figure's local ones
 * (BOSS_FIGURE_BOUNDS): x right, y up, +z toward the camera.
 */

export type BeastTone = 'body' | 'trim' | 'mark' | 'core' | 'veil';

/**
 * A beast's parts by material. `face` is its eyes, its weak point, drawn in
 * the glowing core material where the play camera always sees it.
 */
export type BeastParts = Partial<Record<BeastTone | 'face' | 'pupil', FigurePart[]>>;
// `pupil`: dark pupils drawn over the eyes, in the trim material. They are
// part of the eye, so they never count as hiding it.

/** How a beast's tails grow from it and fan round its back. */
export type BeastTailLayout = {
  /** Root distance from the figure's axis, and root height. */
  rootRadius: number;
  rootY: number;
  /** Fan width (radians) round the back; a lone tail points straight back. */
  spread: number;
  /** Lean away from vertical (radians): 0 straight up, past π/2 droops. */
  lean: number;
  /** Which of the figure's opaque materials the tails wear. */
  tone: 'body' | 'trim' | 'mark';
  /** Turns the whole fan round the figure (radians from straight back). */
  turn?: number;
};

export type BeastLook = {
  /** The animal, in one word: for tests and the manual. */
  outline: string;
  body: string;
  trim: string;
  /** A third surface colour: teeth, horns, markings, a second eye. */
  mark: string;
  /** Emissive eyes: the readable "face" and the weak point. */
  core: string;
  /** Translucent extras (flames, slime, wing membranes). */
  veil: string;
  /** The tail's shape, one per beast. */
  tail: string;
};

export type BeastRecipe = {
  look: BeastLook;
  parts: () => BeastParts;
  /** One tail, root at the origin pointing up (+y), bending toward +z (away from the body). */
  tail: () => FigurePart[];
  layout: BeastTailLayout;
};

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const drum = (top: number, bottom: number, h: number, segments = 8) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
export const cone = (r: number, h: number, segments = 6) => new THREE.ConeGeometry(r, h, segments);
export const ball = (r: number, width = 10, height = 8) => (
  new THREE.SphereGeometry(r, width, height)
);
export const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
export const disc = (r: number, h = 0.02, segments = 12) => (
  new THREE.CylinderGeometry(r, r, h, segments)
);

/** Tilts that point a disc's face (its +y) along the camera-facing direction (0, sin, cos). */
export const FACE_TILT = 1.05;

/** A left/right pair: `make` builds the right one (side 1, x > 0); the left mirrors it. */
export const pair = (make: (side: 1 | -1) => FigurePart): FigurePart[] => [make(-1), make(1)];
export const pairs = (make: (side: 1 | -1) => FigurePart[]): FigurePart[] => (
  [...make(-1), ...make(1)]
);

const UP = new THREE.Vector3(0, 1, 0);
const DIRECTION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const EULER = new THREE.Euler();

/**
 * A tapered rod from `from` to `to`: arms, legs, horns, tentacle links.
 * `r0` is the radius at `from`, `r1` at `to`.
 */
export function limb(from: Vec3, to: Vec3, r0: number, r1: number, segments = 7): FigurePart {
  DIRECTION.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  const length = DIRECTION.length();
  QUATERNION.setFromUnitVectors(UP, DIRECTION.normalize());
  EULER.setFromQuaternion(QUATERNION);
  return part(
    drum(r1, r0, length, segments),
    [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2],
    [EULER.x, EULER.y, EULER.z]
  );
}

/** A cone whose tip points from `base` toward `tip`: claws, fangs, spikes, horns. */
export function spike(base: Vec3, tip: Vec3, r: number, segments = 5): FigurePart {
  DIRECTION.set(tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]);
  const length = DIRECTION.length();
  QUATERNION.setFromUnitVectors(UP, DIRECTION.normalize());
  EULER.setFromQuaternion(QUATERNION);
  return part(
    cone(r, length, segments),
    [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2],
    [EULER.x, EULER.y, EULER.z]
  );
}

/** Rods along a polyline, tapering from `r0` to `r1`: curved horns, tentacles, eye stalks. */
export function chain(points: Vec3[], r0: number, r1: number, segments = 6): FigurePart[] {
  const parts: FigurePart[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const t0 = index / (points.length - 1);
    const t1 = (index + 1) / (points.length - 1);
    const from = r0 + (r1 - r0) * t0;
    const to = r0 + (r1 - r0) * t1;
    parts.push(limb(points[index], points[index + 1], from, to, segments));
  }
  return parts;
}

/**
 * Points along a tail rising from the origin: `bend` > 0 falls away from the
 * body (+z), < 0 curls back over it. Returns the place and the tilt that
 * follows the curve at `t` (0 root, 1 tip).
 */
export function along(length: number, bend: number, t: number): { at: Vec3; tilt: number } {
  return {
    at: [0, length * t, bend * length * t * t],
    tilt: Math.atan2(2 * bend * t, 1),
  };
}

/** One piece of a tail at `t` along it, tilted to follow its curve. */
export function tailPiece(
  geometry: THREE.BufferGeometry,
  length: number,
  bend: number,
  t: number,
  scale?: Vec3,
  twist = 0
): FigurePart {
  const { at, tilt } = along(length, bend, t);
  return part(geometry, at, [tilt, twist, 0], scale);
}

/**
 * The point on the front of an ellipsoid (centre, radii) at (x, y), lifted
 * `lift` off its surface: where an eye sits on a head.
 */
export function onFront(center: Vec3, radii: Vec3, x: number, y: number, lift = 0.01): Vec3 {
  const dx = (x - center[0]) / radii[0];
  const dy = (y - center[1]) / radii[1];
  const dz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
  return [x, y, center[2] + radii[2] * dz + lift];
}

/**
 * A slanted eye slab on the face, tipped back so it faces the play camera
 * (which looks down at about 54°). `slant` raises its outer corner.
 */
export function eye(
  side: 1 | -1,
  at: Vec3,
  size: [number, number],
  slant = 0,
  tilt = -0.6
): FigurePart {
  return part(box(size[0], size[1], 0.025), [side * at[0], at[1], at[2]], [tilt, 0, side * slant]);
}
