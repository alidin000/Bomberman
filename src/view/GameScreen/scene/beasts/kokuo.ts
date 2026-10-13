/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, chain, eye, limb, onFront, pair, pairs, spike, tailPiece,
} from './beastKit';

// The Five-Tails: a white horse with a dolphin's head, red markings round its
// eyes and down its snout, three horns (a short one on the brow and two
// sweeping back), hooves, and five long white tails.
export const KOKUO: BeastRecipe = {
  look: {
    outline: 'horse',
    body: '#f1f5f9',
    trim: '#d9472b',
    mark: '#9aa6b8',
    core: '#fb7185',
    veil: '#e2e8f0',
    tail: 'brushTail',
  },
  parts: () => ({
    body: [
      part(ball(0.3), [0, -0.06, -0.12], undefined, [0.95, 0.8, 1.3]),
      ...pairs((side) => [
        limb([side * 0.14, -0.15, 0.14], [side * 0.15, -0.44, 0.19], 0.07, 0.05),
        limb([side * 0.15, -0.15, -0.36], [side * 0.16, -0.44, -0.33], 0.075, 0.05),
      ]),
      limb([0, 0.02, 0.16], [0, 0.28, 0.28], 0.14, 0.12),
      part(ball(0.17), [0, 0.34, 0.33], undefined, [0.95, 0.85, 1.1]),
      limb([0, 0.29, 0.44], [0, 0.25, 0.57], 0.075, 0.05),
    ],
    trim: [
      // Red markings round the eyes and down the snout.
      ...pair((side) => part(box(0.13, 0.05, 0.02), [side * 0.1, 0.4, 0.44], [-0.6, 0, side * 0.35])),
      part(box(0.04, 0.02, 0.15), [0, 0.33, 0.52], [-0.25, 0, 0]),
      ...pair((side) => part(box(0.07, 0.03, 0.02), [side * 0.13, 0.27, 0.42], [0, side * -0.6, 0])),
    ],
    mark: [
      spike([0, 0.47, 0.38], [0, 0.62, 0.44], 0.04, 5),
      ...pairs((side) => chain([
        [side * 0.1, 0.45, 0.3], [side * 0.17, 0.58, 0.24], [side * 0.21, 0.68, 0.12], [side * 0.2, 0.74, -0.02],
      ], 0.045, 0.018, 6)),
      ...pairs((side) => [0.19, -0.33].map((z) => (
        part(ball(0.055), [side * 0.155, -0.45, z], undefined, [1, 0.5, 1])
      ))),
    ],
    face: pair((side) => eye(side, onFront([0, 0.34, 0.33], [0.1615, 0.1445, 0.187], side * 0.085, 0.405), [0.07, 0.04], 0.2)),
  }),
  // A long flowing tail: soft lobes thinning out.
  tail: () => [0.12, 0.36, 0.6, 0.84].map((t, index) => (
    tailPiece(ball(0.1 - index * 0.016, 8, 6), 0.46, 0.3, t, [1.35, 1.6, 0.55])
  )),
  layout: {
    rootRadius: 0.27, rootY: -0.05, spread: 2.7, lean: 0.32, tone: 'body',
  },
};
