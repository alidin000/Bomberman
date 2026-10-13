/* eslint-disable max-len -- one part per line reads best in these coordinate tables */
import * as THREE from 'three';
import { part } from '../figureGeometry';
import {
  BeastRecipe, ball, box, drum, eye, onFront, pair, spike, tailPiece,
} from './beastKit';

// The Three-Tails: a giant turtle under a spiked, crab-like shell, a beaked
// head with bony plates, one red eye open (its right eye stays shut under a
// plate), stubby flippers, and three segmented shrimp tails.
const shellCap = (r: number) => new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);

// Spikes on the shell: [round the shell, down from its crown] in radians.
const SHELL_SPIKES: [number, number][] = [
  [0, 0.15], [1.05, 0.62], [2.1, 0.62], [3.14, 0.62], [4.19, 0.62], [5.24, 0.62],
  [0.52, 1.05], [1.57, 1.05], [2.62, 1.05], [3.67, 1.05], [4.71, 1.05], [5.76, 1.05],
];
const SHELL = {
  r: 0.47, y: -0.27, z: -0.06, squash: 0.72
};

function shellSpike([around, down]: [number, number]) {
  const dir = [Math.sin(down) * Math.sin(around), Math.cos(down), Math.sin(down) * Math.cos(around)];
  const base: [number, number, number] = [
    dir[0] * SHELL.r * 0.97, SHELL.y + dir[1] * SHELL.r * SHELL.squash * 0.97, SHELL.z + dir[2] * SHELL.r * 0.97,
  ];
  const tip: [number, number, number] = [
    base[0] + dir[0] * 0.11, base[1] + 0.07 + dir[1] * 0.12, base[2] + dir[2] * 0.11,
  ];
  return spike(base, tip, 0.05, 5);
}

export const ISOBU: BeastRecipe = {
  look: {
    outline: 'turtle',
    body: '#7c9a91',
    trim: '#3f5650',
    mark: '#e6dfc4',
    core: '#ef3b3b',
    veil: '#a5f3fc',
    tail: 'shrimpTail',
  },
  parts: () => ({
    body: [
      part(ball(0.2), [0, -0.03, 0.4], undefined, [1.1, 0.85, 1]),
      part(ball(0.09), [0, -0.1, 0.54], undefined, [1.1, 0.7, 0.9]),
      ...pair((side) => part(ball(0.12), [side * 0.39, -0.38, 0.2], undefined, [1.3, 0.55, 1])),
      ...pair((side) => part(ball(0.11), [side * 0.37, -0.4, -0.24], undefined, [1.2, 0.55, 1])),
      part(drum(0.42, 0.42, 0.12, 12), [0, -0.33, -0.04]),
    ],
    trim: [
      part(shellCap(SHELL.r), [0, SHELL.y, SHELL.z], undefined, [1, SHELL.squash, 1]),
      part(drum(0.49, 0.49, 0.06, 12), [0, -0.26, -0.06]),
      // Bony brow plates, the shut right eye under one.
      part(box(0.11, 0.05, 0.04), [-0.08, 0.075, 0.53], [-0.6, 0, -0.25]),
      part(box(0.06, 0.04, 0.04), [0.09, 0.13, 0.47], [-0.6, 0, 0.3]),
    ],
    mark: [
      ...SHELL_SPIKES.map(shellSpike),
      part(box(0.08, 0.02, 0.02), [0, -0.13, 0.59], [0.3, 0, 0]),
      ...pair((side) => spike([side * 0.05, 0.12, 0.42], [side * 0.08, 0.24, 0.38], 0.03, 4)),
    ],
    face: [eye(1, onFront([0, -0.03, 0.4], [0.22, 0.17, 0.2], 0.08, 0.075), [0.075, 0.045], 0.15)],
  }),
  // A shrimp's tail: shell segments shrinking to a fan.
  tail: () => [
    ...[0.1, 0.32, 0.54, 0.74].map((t, index) => (
      tailPiece(ball(0.085 - index * 0.012, 8, 6), 0.45, 0.2, t, [1.25, 1.1, 0.8])
    )),
    tailPiece(box(0.16, 0.1, 0.02), 0.45, 0.2, 0.94),
  ],
  layout: {
    rootRadius: 0.22, rootY: -0.25, spread: 1.6, lean: 0.45, tone: 'trim',
  },
};
