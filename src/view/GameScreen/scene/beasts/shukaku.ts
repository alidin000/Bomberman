/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import * as THREE from 'three';
import { Vec3, part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, disc, limb, onFront, pair, pairs, spike, tailPiece,
} from './beastKit';

// The One-Tail: a sand tanuki with a huge round belly, short arms raised,
// round ears, indigo markings swirled over its sand-coloured hide, golden
// eyes with black star pupils ringed in black, a wide fanged grin, and one
// enormous tail.
const EYE_TILT = 0.95;
const HEAD = { at: [0, 0.34, 0.1] as Vec3, radii: [0.297, 0.243, 0.27] as Vec3 };
const EYE_Y = 0.42;
const eyeZ = (side: 1 | -1) => onFront(HEAD.at, HEAD.radii, side * 0.12, EYE_Y, 0.004)[2];
const arc = (r: number, length: number) => new THREE.TorusGeometry(r, 0.026, 4, 12, length);

export const SHUKAKU: BeastRecipe = {
  look: {
    outline: 'tanuki',
    body: '#dcc08a',
    trim: '#24348f',
    mark: '#fffbeb',
    core: '#f7c531',
    veil: '#e7c88f',
    tail: 'tanukiTail',
  },
  parts: () => ({
    body: [
      part(ball(0.4, 12, 9), [0, -0.09, 0.02], undefined, [1.12, 1, 1]),
      part(ball(0.27), HEAD.at, undefined, [1.1, 0.9, 1]),
      ...pair((side) => part(ball(0.08), [side * 0.2, 0.55, 0.02], undefined, [1, 1.1, 0.6])),
      ...pair((side) => limb([side * 0.36, 0.06, 0.06], [side * 0.46, -0.1, 0.2], 0.09, 0.08)),
      ...pair((side) => part(ball(0.075), [side * 0.46, -0.13, 0.24])),
      ...pair((side) => part(ball(0.1), [side * 0.24, -0.41, 0.27], undefined, [1, 0.6, 1.3])),
    ],
    trim: [
      // Inner ears, dark sockets round the eyes and the grin.
      ...pair((side) => part(ball(0.045), [side * 0.2, 0.55, 0.06], undefined, [1, 1.1, 0.5])),
      ...pair((side) => part(disc(0.105, 0.012, 12), [side * 0.12, EYE_Y - 0.007, eyeZ(side) - 0.012], [EYE_TILT, 0, 0])),
      part(box(0.3, 0.06, 0.03), [0, 0.24, 0.33], [-0.45, 0, 0]),
      // Swirled markings on the belly, arms and brow.
      part(arc(0.2, Math.PI), [0, -0.12, 0.415], [0, 0, Math.PI]),
      part(arc(0.12, Math.PI), [0, -0.02, 0.43], [0, 0, Math.PI]),
      ...pair((side) => part(arc(0.14, Math.PI * 0.8), [side * 0.3, -0.2, 0.33], [0, side * 0.7, side * 0.9])),
      ...pair((side) => part(box(0.12, 0.022, 0.02), [side * 0.41, -0.03, 0.16], [0, side * -0.6, side * -0.6])),
      ...pair((side) => part(box(0.12, 0.022, 0.02), [side * 0.12, 0.54, 0.24], [-1, 0, side * -0.4])),
      // Crown and brow swirls, seen from above.
      part(arc(0.13, Math.PI * 1.2), [0, 0.6, 0.06], [-Math.PI / 2 + 0.35, 0, Math.PI * 0.9]),
      ...pair((side) => part(arc(0.1, Math.PI * 0.9), [side * 0.2, 0.47, 0.25], [-0.8, side * 0.5, side * 1.2])),
      ...pair((side) => part(new THREE.TorusGeometry(0.085, 0.022, 4, 12), [side * 0.415, -0.04, 0.14], [0, side * 1.1, 0])),
    ],
    mark: [-0.1, -0.05, 0, 0.05, 0.1].map((x) => (
      spike([x, 0.265, 0.355], [x, 0.225, 0.37], 0.016, 4)
    )),
    face: pair((side) => part(disc(0.075, 0.02, 12), [side * 0.12, EYE_Y, eyeZ(side)], [EYE_TILT, 0, 0])),
    // Four-pointed star pupils.
    pupil: pairs((side) => [Math.PI / 4, -Math.PI / 4].map((turn) => (
      part(box(0.075, 0.014, 0.008), [side * 0.12, EYE_Y + 0.007, eyeZ(side) + 0.012], [EYE_TILT - Math.PI / 2, 0, turn])
    ))),
  }),
  // One enormous tail of swelling sand rolls.
  tail: () => [0.1, 0.3, 0.5, 0.7, 0.88].map((t, index) => (
    tailPiece(ball([0.14, 0.17, 0.18, 0.16, 0.12][index], 9, 7), 0.62, -0.15, t, [1, 1.2, 1])
  )),
  layout: {
    rootRadius: 0.22, rootY: -0.15, spread: 0, lean: 0.4, tone: 'body', turn: 0.65,
  },
};
