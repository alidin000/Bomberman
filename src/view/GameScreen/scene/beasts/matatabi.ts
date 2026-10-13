/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, cone, drum, eye, limb, pair, spike, tailPiece,
} from './beastKit';

// The Two-Tails: a sitting cat wreathed in blue flame, dark blue markings on
// its brow and cheeks, odd eyes (its right one gold, its left one green:
// the right sits on the viewer's left), and two long tails of fire.
export const MATATABI: BeastRecipe = {
  look: {
    outline: 'cat',
    body: '#2f62d8',
    trim: '#0c1a4d',
    mark: '#4ade80',
    core: '#facc15',
    veil: '#7dd3fc',
    tail: 'flameTail',
  },
  parts: () => ({
    body: [
      part(ball(0.28), [0, -0.12, -0.05], undefined, [1, 1.15, 1.1]),
      ...pair((side) => part(ball(0.16), [side * 0.2, -0.33, -0.1])),
      ...pair((side) => limb([side * 0.13, -0.1, 0.13], [side * 0.15, -0.44, 0.21], 0.065, 0.05)),
      ...pair((side) => part(ball(0.065), [side * 0.15, -0.45, 0.25], undefined, [1, 0.6, 1.3])),
      part(ball(0.22), [0, 0.28, 0.1], undefined, [1.15, 0.95, 1]),
      part(ball(0.08), [0, 0.2, 0.29], undefined, [1.25, 0.7, 0.9]),
      ...pair((side) => spike([side * 0.13, 0.42, 0.07], [side * 0.22, 0.67, 0], 0.08, 4)),
    ],
    trim: [
      ...pair((side) => spike([side * 0.135, 0.44, 0.11], [side * 0.21, 0.62, 0.05], 0.045, 4)),
      part(ball(0.026), [0, 0.235, 0.365]),
      // Flame-shaped brow marks and cheek stripes.
      part(cone(0.03, 0.14, 4), [0, 0.46, 0.22], [-0.7, 0, 0]),
      ...pair((side) => part(cone(0.025, 0.12, 4), [side * 0.07, 0.45, 0.21], [-0.7, 0, side * -0.4])),
      ...pair((side) => part(box(0.1, 0.016, 0.016), [side * 0.2, 0.22, 0.24], [0, side * -0.5, side * 0.25])),
      ...pair((side) => part(box(0.1, 0.016, 0.016), [side * 0.2, 0.18, 0.23], [0, side * -0.5, side * -0.1])),
    ],
    // Its left eye, green, on the viewer's right.
    mark: [eye(1, [0.095, 0.335, 0.296], [0.085, 0.05], 0.3)],
    face: [eye(-1, [0.095, 0.335, 0.296], [0.085, 0.05], 0.3)],
    pupil: pair((side) => part(box(0.012, 0.042, 0.01), [side * 0.095, 0.337, 0.311], [-0.6, 0, 0])),
    // Blue flame tongues licking up its back and crown.
    veil: [
      ...[-0.9, -0.3, 0.3, 0.9].map((angle) => part(
        cone(0.085, 0.36, 6),
        [Math.sin(angle) * 0.22, 0.06, -0.18 + Math.cos(angle) * 0.02],
        [-0.35, 0, -angle * 0.35]
      )),
      part(cone(0.07, 0.26, 6), [0, 0.5, 0.0], [-0.3, 0, 0]),
      ...pair((side) => part(drum(0.02, 0.07, 0.22, 6), [side * 0.22, -0.2, 0.05], [0, 0, side * -0.3])),
    ],
  }),
  // A tail of fire: tapering flame lobes ending in a tongue.
  tail: () => [
    tailPiece(drum(0.07, 0.085, 0.22, 7), 0.62, 0.15, 0.16),
    tailPiece(drum(0.055, 0.07, 0.2, 7), 0.62, 0.15, 0.45),
    tailPiece(drum(0.04, 0.055, 0.18, 7), 0.62, 0.15, 0.7),
    tailPiece(cone(0.06, 0.2, 6), 0.62, 0.15, 0.92),
  ],
  layout: {
    rootRadius: 0.2, rootY: -0.28, spread: 1.4, lean: 0.35, tone: 'body',
  },
};
