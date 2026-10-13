/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, chain, eye, onFront, pair, pairs, tailPiece,
} from './beastKit';

// The Seven-Tails: a blue rhinoceros beetle with a long curved horn, orange
// eyes, six dark legs, and its tails as wings: six long green wings and its
// abdomen, all fanned out behind its shell.
export const CHOMEI: BeastRecipe = {
  look: {
    outline: 'beetle',
    body: '#2a8bd8',
    trim: '#5ccf70',
    mark: '#142f55',
    core: '#fb923c',
    veil: '#bbf7d0',
    tail: 'beetleWing',
  },
  parts: () => ({
    body: [
      part(ball(0.32, 12, 8), [0, -0.05, -0.1], undefined, [1, 0.72, 1.2]),
      part(ball(0.2), [0, 0.02, 0.27], undefined, [1.15, 0.8, 0.9]),
      part(ball(0.15), [0, 0.02, 0.42], undefined, [1, 0.85, 0.9]),
      // The great horn, sweeping up and back from its head.
      ...chain([[0, 0.1, 0.5], [0, 0.22, 0.55], [0, 0.38, 0.53], [0, 0.5, 0.45]], 0.06, 0.022, 7),
      part(ball(0.03), [0, 0.51, 0.44]),
    ],
    mark: [
      part(box(0.018, 0.02, 0.7), [0, 0.18, -0.1]),
      part(box(0.42, 0.02, 0.018), [0, 0.15, 0.17]),
      // Six legs.
      ...pairs((side) => [0.3, 0.05, -0.25].flatMap((z) => chain([
        [side * 0.24, -0.12, z], [side * 0.4, -0.27, z + 0.05], [side * 0.43, -0.48, z + 0.08],
      ], 0.03, 0.022, 5))),
    ],
    face: pair((side) => eye(side, onFront([0, 0.02, 0.42], [0.15, 0.1275, 0.135], side * 0.085, 0.06), [0.065, 0.045], 0.25)),
  }),
  // A long insect wing.
  tail: () => [
    tailPiece(ball(0.1, 8, 6), 0.6, 0.18, 0.45, [1.25, 2.9, 0.12]),
    tailPiece(box(0.012, 0.5, 0.02), 0.6, 0.18, 0.42),
  ],
  layout: {
    rootRadius: 0.08, rootY: 0.1, spread: 3.6, lean: 1.1, tone: 'trim',
  },
};
