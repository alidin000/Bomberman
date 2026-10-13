/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, cone, eye, limb, pair, pairs, spike, tailPiece,
} from './beastKit';

// The Nine-Tails: a crouching orange fox with long pointed ears, black
// markings that run from its eyes up into its ears, red slit-pupilled eyes,
// a wide fanged grin, clawed hands, and nine thick tails fanned behind it.
export const KURAMA: BeastRecipe = {
  look: {
    outline: 'fox',
    body: '#e8611c',
    trim: '#1c1210',
    mark: '#fff7ed',
    core: '#ef2b2b',
    veil: '#fdba74',
    tail: 'foxTail',
  },
  parts: () => ({
    body: [
      part(ball(0.3), [0, -0.08, -0.06], undefined, [1.15, 1, 1]),
      ...pair((side) => part(ball(0.17), [side * 0.27, -0.3, -0.12])),
      ...pair((side) => part(ball(0.09), [side * 0.3, -0.42, 0.04], undefined, [1, 0.6, 1.4])),
      ...pair((side) => limb([side * 0.27, 0.06, 0.06], [side * 0.33, -0.32, 0.24], 0.09, 0.07)),
      ...pair((side) => part(ball(0.09), [side * 0.34, -0.4, 0.28], undefined, [1.2, 0.7, 1.3])),
      part(ball(0.25), [0, 0.33, 0.1], undefined, [1.2, 0.9, 1]),
      // Cheek ruffs and the muzzle.
      ...pair((side) => spike([side * 0.2, 0.27, 0.13], [side * 0.37, 0.19, 0.1], 0.075)),
      part(ball(0.13), [0, 0.25, 0.33], undefined, [0.85, 0.6, 1.15]),
      // Tall rabbit-long ears.
      ...pair((side) => spike([side * 0.16, 0.5, 0.06], [side * 0.28, 0.87, -0.03], 0.085)),
    ],
    trim: [
      // Inner ears and the black markings from the eyes into them.
      ...pair((side) => spike([side * 0.165, 0.53, 0.11], [side * 0.265, 0.8, 0.035], 0.05)),
      ...pair((side) => part(box(0.16, 0.05, 0.02), [side * 0.17, 0.46, 0.27], [-0.65, 0, side * 0.75])),
      part(ball(0.035), [0, 0.3, 0.47]),
      ...pair((side) => part(box(0.12, 0.018, 0.02), [side * 0.065, 0.2, 0.42], [-0.3, 0, side * 0.3])),
      // Black claws.
      ...pairs((side) => [-0.05, 0, 0.05].map((dx) => (
        spike([side * 0.34 + dx, -0.41, 0.38], [side * 0.34 + dx * 1.2, -0.45, 0.44], 0.018, 4)
      ))),
    ],
    mark: pair((side) => spike([side * 0.06, 0.21, 0.43], [side * 0.06, 0.165, 0.445], 0.017, 4)),
    face: pair((side) => eye(side, [0.11, 0.405, 0.318], [0.11, 0.05], 0.35)),
    // Slit pupils.
    pupil: pair((side) => part(box(0.014, 0.046, 0.01), [side * 0.11, 0.407, 0.333], [-0.6, 0, side * 0.35])),
  }),
  // Thick, fluffy tails that swell then taper to a point.
  tail: () => [
    tailPiece(ball(0.1, 8, 6), 0.56, 0.1, 0.12, [1, 1.3, 1]),
    tailPiece(ball(0.13, 8, 6), 0.56, 0.1, 0.4, [1.1, 1.45, 1]),
    tailPiece(ball(0.11, 8, 6), 0.56, 0.1, 0.68, [1, 1.4, 1]),
    tailPiece(cone(0.075, 0.2, 6), 0.56, 0.1, 0.9),
  ],
  layout: {
    rootRadius: 0.15, rootY: -0.02, spread: 3.1, lean: 0.52, tone: 'body',
  },
};
