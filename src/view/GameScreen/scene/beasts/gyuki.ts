/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import * as THREE from 'three';
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, chain, eye, limb, onFront, pair, pairs, tailPiece,
} from './beastKit';

// The Eight-Tails: an ox above and an octopus below. A bull's head with two
// great curved horns ringed with dark bands, a muscled chest and arms, and
// eight sucker-lined tentacles for tails.
const HORN: [number, number, number][] = [
  [0.13, 0.43, 0.18], [0.27, 0.5, 0.15], [0.39, 0.64, 0.09], [0.41, 0.8, 0.02],
];

export const GYUKI: BeastRecipe = {
  look: {
    outline: 'ox',
    body: '#6b5779',
    trim: '#33263d',
    mark: '#ece2cf',
    core: '#fde68a',
    veil: '#c4b5fd',
    tail: 'tentacle',
  },
  parts: () => ({
    body: [
      part(ball(0.25), [0, 0.05, 0], undefined, [1.3, 1, 0.9]),
      ...pair((side) => part(ball(0.13), [side * 0.12, 0.11, 0.17])),
      part(ball(0.3), [0, -0.28, -0.05], undefined, [1.2, 0.7, 1.1]),
      ...pair((side) => limb([side * 0.3, 0.14, 0.05], [side * 0.42, -0.1, 0.2], 0.1, 0.08)),
      ...pair((side) => part(ball(0.09), [side * 0.43, -0.18, 0.24])),
      part(ball(0.17), [0, 0.33, 0.2], undefined, [1.1, 1, 1]),
      ...pair((side) => part(ball(0.05), [side * 0.18, 0.38, 0.17], undefined, [1.6, 0.6, 0.7])),
    ],
    trim: [
      part(ball(0.11), [0, 0.26, 0.33], undefined, [1.25, 0.8, 0.9]),
      // Bands round the horns.
      ...pairs((side) => [1, 2].map((index) => {
        const [x, y, z] = HORN[index];
        return part(new THREE.TorusGeometry(0.048, 0.014, 4, 10), [side * x, y, z], [Math.PI / 2, 0, side * (index === 1 ? 0.9 : 0.25)]);
      })),
    ],
    mark: pairs((side) => chain(HORN.map(([x, y, z]) => [side * x, y, z]), 0.065, 0.024, 7)),
    face: pair((side) => eye(side, onFront([0, 0.33, 0.2], [0.187, 0.17, 0.17], side * 0.08, 0.39), [0.07, 0.04], 0.25)),
  }),
  // A tentacle: tapering links curling at the tip, suckers underneath.
  tail: () => [
    tailPiece(new THREE.CylinderGeometry(0.06, 0.08, 0.2, 7), 0.45, 0.2, 0.17),
    tailPiece(new THREE.CylinderGeometry(0.045, 0.06, 0.2, 7), 0.45, 0.2, 0.48),
    tailPiece(new THREE.CylinderGeometry(0.025, 0.045, 0.18, 7), 0.45, 0.2, 0.77),
    tailPiece(ball(0.028), 0.45, 0.2, 0.94),
  ],
  layout: {
    rootRadius: 0.2, rootY: -0.3, spread: 3.6, lean: 0.5, tone: 'body',
  },
};
