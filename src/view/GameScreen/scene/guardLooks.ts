import * as THREE from 'three';
import { StageId } from '../../../content/types';
import { FigurePart, part } from './figureGeometry';

/**
 * Mini-boss gate guards: the stage's archetype body under original guard
 * regalia, so a guard never reads as one more patrol of its kind. Each guard
 * adds one shape on the head (crest), one on the back and, for some, one on
 * the shoulders, in its own body colour and regalia colour. Render-only.
 */

export type GuardCrest =
  | 'crescent'
  | 'threeSpikes'
  | 'tallFinial'
  | 'twinHorns'
  | 'haloRing'
  | 'plumeArc'
  | 'fanCrest';

export type GuardBack =
  | 'tallBanner'
  | 'sunWheel'
  | 'wideCape'
  | 'drumOnBack'
  | 'rodBundle'
  | 'longScarf'
  | 'crossedPoles';

export type GuardShoulders = 'roundPauldrons' | 'squarePlates' | 'none';

export type GuardLook = {
  crest: GuardCrest;
  back: GuardBack;
  shoulders: GuardShoulders;
  /** Replaces the archetype's main body colour. */
  body: string;
  /** The regalia: crest, back piece and shoulders. */
  regalia: string;
};

export const GUARD_LOOKS: Record<StageId, GuardLook> = {
  hiddenLeaf: {
    crest: 'crescent', back: 'tallBanner', shoulders: 'roundPauldrons', body: '#2f5d3a', regalia: '#e5b93a',
  },
  hiddenSand: {
    crest: 'threeSpikes', back: 'sunWheel', shoulders: 'squarePlates', body: '#7c2d12', regalia: '#e8c98a',
  },
  hiddenMist: {
    crest: 'tallFinial', back: 'wideCape', shoulders: 'none', body: '#1e3a46', regalia: '#9fc5d3',
  },
  hiddenCloud: {
    crest: 'twinHorns', back: 'drumOnBack', shoulders: 'squarePlates', body: '#1e2a5a', regalia: '#f2c94c',
  },
  hiddenStone: {
    crest: 'haloRing', back: 'rodBundle', shoulders: 'roundPauldrons', body: '#5a4636', regalia: '#c08a3e',
  },
  akatsukiHideout: {
    crest: 'plumeArc', back: 'longScarf', shoulders: 'none', body: '#3b1f3f', regalia: '#d0344b',
  },
  greatShinobiWar: {
    crest: 'fanCrest', back: 'crossedPoles', shoulders: 'squarePlates', body: '#1f2a2e', regalia: '#e2e8f0',
  },
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const rod = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 5);
const HALF_TURN = Math.PI / 2;

/** The crest stands on `top`, the highest point of the archetype's head. */
function crestParts(crest: GuardCrest, top: number): FigurePart[] {
  switch (crest) {
    case 'crescent':
      return [part(
        new THREE.TorusGeometry(0.12, 0.03, 4, 10, Math.PI),
        [0, top + 0.1, 0.03],
        [0, 0, Math.PI]
      )];
    case 'threeSpikes':
      return [
        part(box(0.26, 0.05, 0.22), [0, top, 0]),
        part(cone(0.045, 0.16, 4), [-0.08, top + 0.1, 0]),
        part(cone(0.05, 0.22, 4), [0, top + 0.13, 0]),
        part(cone(0.045, 0.16, 4), [0.08, top + 0.1, 0]),
      ];
    case 'tallFinial':
      return [
        part(new THREE.CylinderGeometry(0.06, 0.08, 0.04, 6), [0, top + 0.02, 0]),
        part(rod(0.02, 0.1), [0, top + 0.08, 0]),
        part(cone(0.055, 0.1, 6), [0, top + 0.16, 0]),
      ];
    case 'twinHorns':
      return [-1, 1].map((side) => (
        part(cone(0.04, 0.22, 5), [side * 0.1, top + 0.06, 0.02], [0, 0, -side * 0.5])
      ));
    case 'haloRing':
      return [part(new THREE.TorusGeometry(0.17, 0.024, 4, 14), [0, top - 0.12, -0.13])];
    case 'plumeArc':
      return [
        part(box(0.045, 0.12, 0.06), [0, top + 0.05, 0.02], [-0.3, 0, 0]),
        part(box(0.045, 0.12, 0.06), [0, top + 0.13, -0.05], [-0.8, 0, 0]),
        part(box(0.045, 0.12, 0.06), [0, top + 0.17, -0.14], [-1.3, 0, 0]),
      ];
    case 'fanCrest':
    default:
      return [part(
        new THREE.CylinderGeometry(0.17, 0.17, 0.025, 8, 1, false, -HALF_TURN, Math.PI),
        [0, top, 0],
        [-HALF_TURN, 0, 0]
      )];
  }
}

function backParts(back: GuardBack): FigurePart[] {
  switch (back) {
    case 'tallBanner':
      return [
        part(rod(0.016, 0.95), [-0.12, 0.25, -0.18]),
        part(box(0.2, 0.28, 0.02), [-0.01, 0.56, -0.19]),
      ];
    case 'sunWheel':
      return [
        part(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 10), [0, 0.12, -0.2], [HALF_TURN, 0, 0]),
        part(new THREE.TorusGeometry(0.2, 0.026, 4, 12), [0, 0.12, -0.22]),
      ];
    case 'wideCape':
      return [part(
        new THREE.CylinderGeometry(0.22, 0.32, 0.5, 6, 1, false, HALF_TURN, Math.PI),
        [0, -0.05, -0.02]
      )];
    case 'drumOnBack':
      return [
        part(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 10), [0, 0.1, -0.25], [HALF_TURN, 0, 0]),
        part(new THREE.TorusGeometry(0.145, 0.02, 4, 12), [0, 0.1, -0.17]),
        part(new THREE.TorusGeometry(0.145, 0.02, 4, 12), [0, 0.1, -0.33]),
      ];
    case 'rodBundle':
      return [
        ...[-0.05, 0, 0.05, 0.1].map((x, index) => (
          part(rod(0.02, 0.6), [x - 0.02, 0.25, -0.2], [0, 0, (index - 1.5) * 0.12])
        )),
        part(box(0.16, 0.05, 0.07), [0, 0.12, -0.2]),
      ];
    case 'longScarf':
      return [
        part(new THREE.TorusGeometry(0.12, 0.035, 4, 10), [0, 0.2, 0], [HALF_TURN, 0, 0]),
        part(box(0.07, 0.42, 0.02), [-0.06, 0.02, -0.2], [0.35, 0, 0.12]),
        part(box(0.07, 0.38, 0.02), [0.06, 0.0, -0.22], [0.45, 0, -0.1]),
      ];
    case 'crossedPoles':
    default:
      return [-1, 1].flatMap((side) => [
        part(rod(0.016, 0.9), [0, 0.25, -0.18], [0, 0, side * 0.45]),
        part(box(0.13, 0.1, 0.02), [side * 0.25, 0.6, -0.18]),
      ]);
  }
}

function shoulderParts(shoulders: GuardShoulders): FigurePart[] {
  if (shoulders === 'none') return [];
  return [-1, 1].map((side) => (shoulders === 'roundPauldrons'
    ? part(
      new THREE.SphereGeometry(0.09, 8, 4, 0, Math.PI * 2, 0, HALF_TURN),
      [side * 0.2, 0.16, 0],
      [0, 0, -side * 0.4]
    )
    : part(box(0.14, 0.04, 0.16), [side * 0.21, 0.18, 0], [0, 0, -side * 0.35])));
}

/** The guard's regalia parts over a head whose top is at `headTop`. */
export function guardRegaliaParts(look: GuardLook, headTop: number): FigurePart[] {
  return [
    ...crestParts(look.crest, headTop),
    ...backParts(look.back),
    ...shoulderParts(look.shoulders),
  ];
}

/** Guards stand a little taller than their elite size, and so does their nameplate. */
export const GUARD_FIGURE_SCALE = 1.08;
export const GUARD_NAMEPLATE_Y = 1.25;
