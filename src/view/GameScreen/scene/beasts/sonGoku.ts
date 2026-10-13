/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, cone, drum, eye, limb, onFront, pair, spike, tailPiece,
} from './beastKit';

// The Four-Tails: a hunched red-furred ape with a grey-green face, chest and
// hands, a crest of spiky fur, two long tusks rising from its upper jaw,
// amber eyes under a heavy brow, long arms on its knuckles, and four tails.
export const SON_GOKU: BeastRecipe = {
  look: {
    outline: 'ape',
    body: '#b3261e',
    trim: '#7f9469',
    mark: '#f1e8d0',
    core: '#fbbf24',
    veil: '#fb923c',
    tail: 'apeTail',
  },
  parts: () => ({
    body: [
      part(ball(0.33), [0, -0.02, -0.06], undefined, [1.2, 1, 0.95]),
      ...pair((side) => part(ball(0.2), [side * 0.32, 0.12, 0])),
      ...pair((side) => limb([side * 0.36, 0.06, 0.04], [side * 0.43, -0.3, 0.18], 0.1, 0.08)),
      ...pair((side) => part(ball(0.15), [side * 0.2, -0.34, -0.06])),
      part(ball(0.2), [0, 0.24, 0.22], undefined, [1.1, 0.95, 1]),
      // Spiky crest of fur from brow to nape.
      ...[-0.1, 0, 0.1].map((x) => spike([x, 0.38, 0.22], [x * 1.4, 0.56, 0.1], 0.06, 5)),
      ...pair((side) => spike([side * 0.17, 0.3, 0.2], [side * 0.3, 0.44, 0.12], 0.05, 5)),
    ],
    trim: [
      part(ball(0.2), [0, -0.02, 0.18], undefined, [1.1, 1, 0.5]),
      part(ball(0.15), [0, 0.2, 0.34], undefined, [1.1, 0.85, 0.6]),
      part(drum(0.07, 0.09, 0.05, 8), [0, 0.15, 0.42], [1.2, 0, 0]),
      ...pair((side) => part(ball(0.1), [side * 0.44, -0.39, 0.22], undefined, [1, 0.8, 1.1])),
      ...pair((side) => part(ball(0.07), [side * 0.22, -0.46, 0.06], undefined, [1, 0.5, 1.5])),
    ],
    mark: pair((side) => spike([side * 0.075, 0.15, 0.45], [side * 0.15, 0.36, 0.48], 0.022, 5)),
    face: pair((side) => eye(side, onFront([0, 0.2, 0.34], [0.165, 0.1275, 0.09], side * 0.065, 0.265), [0.075, 0.04], 0.32)),
  }),
  // A thick fur tail, tapering and curling at the tip.
  tail: () => [
    tailPiece(ball(0.1, 8, 6), 0.48, 0.3, 0.12, [1, 1.4, 1]),
    tailPiece(ball(0.085, 8, 6), 0.48, 0.3, 0.42, [1, 1.5, 1]),
    tailPiece(ball(0.065, 8, 6), 0.48, 0.3, 0.7, [1, 1.5, 1]),
    tailPiece(cone(0.05, 0.14, 6), 0.48, 0.3, 0.92),
  ],
  layout: {
    rootRadius: 0.19, rootY: -0.12, spread: 2.4, lean: 0.42, tone: 'body',
  },
};
