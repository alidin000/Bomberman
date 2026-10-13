/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, chain, drum, eye, limb, onFront, pair, pairs, tailPiece,
} from './beastKit';

// The Six-Tails: an upright white slug glistening with slime, its foot a
// blue-grey sole, two soft feelers on its head, round yellow eyes, a wide
// orange mouth, two pairs of stubby arms, and six oozing tails.
export const SAIKEN: BeastRecipe = {
  look: {
    outline: 'slug',
    body: '#e9eff2',
    trim: '#8ea3b6',
    mark: '#f08a3c',
    core: '#facc15',
    veil: '#d9f99d',
    tail: 'slugTail',
  },
  parts: () => ({
    body: [
      part(drum(0.24, 0.36, 0.56, 12), [0, -0.2, 0]),
      part(ball(0.26), [0, 0.17, 0.05], undefined, [1.1, 0.9, 1]),
      ...pairs((side) => [
        limb([side * 0.26, 0.0, 0.1], [side * 0.42, -0.07, 0.22], 0.06, 0.05),
        limb([side * 0.3, -0.2, 0.12], [side * 0.45, -0.27, 0.24], 0.06, 0.05),
      ]),
      ...pairs((side) => chain([
        [side * 0.1, 0.36, 0.06], [side * 0.15, 0.48, 0.04], [side * 0.2, 0.56, -0.02],
      ], 0.035, 0.025, 6)),
    ],
    trim: [
      part(drum(0.4, 0.42, 0.08, 12), [0, -0.45, 0]),
      ...pair((side) => part(ball(0.04), [side * 0.205, 0.58, -0.03])),
      ...pair((side) => part(ball(0.035), [side * 0.43, -0.08, 0.23])),
      ...pair((side) => part(ball(0.035), [side * 0.46, -0.28, 0.25])),
    ],
    mark: [part(ball(0.08), [0, 0.06, 0.32], undefined, [1.7, 0.55, 0.6])],
    face: pair((side) => eye(side, onFront([0, 0.17, 0.05], [0.286, 0.234, 0.26], side * 0.105, 0.25), [0.08, 0.075], 0)),
    pupil: pair((side) => {
      const [x, y, z] = onFront([0, 0.17, 0.05], [0.286, 0.234, 0.26], side * 0.105, 0.25, 0.024);
      return part(drum(0.018, 0.018, 0.006, 8), [x, y, z], [1.0, 0, 0]);
    }),
    // Slime drops on its body.
    veil: [
      part(ball(0.05), [0.18, -0.05, 0.27], undefined, [1, 1.5, 0.7]),
      part(ball(0.04), [-0.2, -0.22, 0.29], undefined, [1, 1.5, 0.7]),
      part(ball(0.035), [0.06, -0.32, 0.34], undefined, [1, 1.5, 0.7]),
    ],
  }),
  // A soft tail that thins to a drop of slime.
  tail: () => [
    tailPiece(ball(0.075, 8, 6), 0.44, 0.25, 0.14, [1, 1.5, 1]),
    tailPiece(ball(0.062, 8, 6), 0.44, 0.25, 0.42, [1, 1.5, 1]),
    tailPiece(ball(0.05, 8, 6), 0.44, 0.25, 0.68, [1, 1.5, 1]),
    tailPiece(ball(0.045, 8, 6), 0.44, 0.25, 0.92, [1, 1.3, 1]),
  ],
  layout: {
    rootRadius: 0.22, rootY: -0.32, spread: 3, lean: 0.45, tone: 'body',
  },
};
