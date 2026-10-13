/* eslint-disable max-len -- part tables: one part per line, as the landmark tables */
import * as THREE from 'three';
import type { StageId } from '../../../../content/types';
import type { RepairStage, VillageSquareLayout } from '../../../../content/villageSquare';
import { STAGE_SYMBOL, VillageSymbolId } from '../../../../content/villageSymbols';
import {
  HALF_TURN, InkedToken, TokenPart, ball, box, buildInkedToken, cone, cylinder, rock,
  tokenPart as p,
} from '../inkedToken';
import { toWorld } from '../sceneSpace';
import { symbolGeometries } from './glyphs';

/**
 * The village square's dressing: the house fronts, stalls, banners and
 * lanterns that line it, in each village's own look, as rebuilt as the
 * player has helped it (config.village.repairStage; missing draws 1):
 *
 * - 0 damaged: two houses in ruins, scorched walls and paving, rubble,
 *   broken awnings and torn lanterns, smoke from the ruins.
 * - 1 rebuilt: every house stands again; fresh timber, plain lanterns.
 * - 2 thriving: the village's banners, lit lanterns, flower boxes.
 * - 3 festival: lantern strings, bunting, pole flags and festival stalls.
 *
 * Everything stands on the square's wall ring (row y0 - 1, column x0 - 1,
 * and low pieces on the east and south walls) or lies flat on the paving,
 * so it never blocks a cell or hides a player: tall pieces only stand north
 * and west of the square, where they can only cover what is behind them.
 * The static pieces merge into one inked token per (village, stage): two
 * draw calls. Lanterns, smoke and birds are instanced (VillageLife).
 */

export type SquareRoof = 'hip' | 'dome' | 'slab' | 'flat' | 'rock' | 'leanTo' | 'tent';

export type SquareStyle = {
  wall: string;
  beam: string;
  roof: string;
  roofEdge: string;
  door: string;
  window: string;
  roofShape: SquareRoof;
  lantern: string;
  lanternBand: string;
  cloth: string;
  mark: string;
  flagA: string;
  flagB: string;
  awning: string;
  awningAlt: string;
  /** Leaf houses carry round water tanks on their roofs. */
  tanks?: boolean;
  symbol: VillageSymbolId;
};

const STYLES: Record<StageId, Omit<SquareStyle, 'symbol'>> = {
  hiddenLeaf: {
    wall: '#efe1c1',
    beam: '#7b4b2a',
    roof: '#c4432b',
    roofEdge: '#8f2e1f',
    door: '#4a3427',
    window: '#3d5560',
    roofShape: 'hip',
    lantern: '#e9483b',
    lanternBand: '#2b2220',
    cloth: '#f08a24',
    mark: '#2b2b2b',
    flagA: '#f08a24',
    flagB: '#f5efe0',
    awning: '#c4432b',
    awningAlt: '#f5efe0',
    tanks: true,
  },
  hiddenSand: {
    wall: '#dcb98a',
    beam: '#a77b52',
    roof: '#d2ab7b',
    roofEdge: '#a77b52',
    door: '#5a3b26',
    window: '#3b2a20',
    roofShape: 'dome',
    lantern: '#f1dfb8',
    lanternBand: '#7a4b2a',
    cloth: '#9e2b25',
    mark: '#f3e3c3',
    flagA: '#9e2b25',
    flagB: '#e6cfa0',
    awning: '#b5452f',
    awningAlt: '#efe0c0',
  },
  hiddenMist: {
    wall: '#a3b5b8',
    beam: '#4d5f66',
    roof: '#3f5965',
    roofEdge: '#2c3f48',
    door: '#2f3a40',
    window: '#d7e7e9',
    roofShape: 'slab',
    lantern: '#e7f2f4',
    lanternBand: '#2c3f48',
    cloth: '#7fb3c9',
    mark: '#1d2d36',
    flagA: '#7fb3c9',
    flagB: '#e7f2f4',
    awning: '#55788a',
    awningAlt: '#e7f2f4',
  },
  hiddenCloud: {
    wall: '#eceff3',
    beam: '#9aa3ad',
    roof: '#d4d9df',
    roofEdge: '#b2bac3',
    door: '#4b5563',
    window: '#334155',
    roofShape: 'flat',
    lantern: '#fbe7a1',
    lanternBand: '#7c6a2d',
    cloth: '#e8c04a',
    mark: '#1f2937',
    flagA: '#e8c04a',
    flagB: '#f8fafc',
    awning: '#e8c04a',
    awningAlt: '#f8fafc',
  },
  hiddenStone: {
    wall: '#ab987d',
    beam: '#6e5f4b',
    roof: '#8a7860',
    roofEdge: '#5f523f',
    door: '#3f352a',
    window: '#2f2a24',
    roofShape: 'rock',
    lantern: '#f3b562',
    lanternBand: '#5a3a1f',
    cloth: '#a3412b',
    mark: '#f3e7d3',
    flagA: '#a3412b',
    flagB: '#e9dcc4',
    awning: '#a3412b',
    awningAlt: '#e9dcc4',
  },
  akatsukiHideout: {
    wall: '#5a5062',
    beam: '#3a3040',
    roof: '#2f2836',
    roofEdge: '#1e1924',
    door: '#151118',
    window: '#d9c79a',
    roofShape: 'leanTo',
    lantern: '#c4161c',
    lanternBand: '#1e1924',
    cloth: '#1b1a1f',
    mark: '#c4161c',
    flagA: '#c4161c',
    flagB: '#1b1a1f',
    awning: '#3a3040',
    awningAlt: '#c4161c',
  },
  greatShinobiWar: {
    wall: '#cdbf9e',
    beam: '#5a4a40',
    roof: '#bba987',
    roofEdge: '#8f7f62',
    door: '#3a3128',
    window: '#3a3128',
    roofShape: 'tent',
    lantern: '#f4ead2',
    lanternBand: '#5a4a40',
    cloth: '#f4f1e8',
    mark: '#15171c',
    flagA: '#f4f1e8',
    flagB: '#5a6b3c',
    awning: '#5a6b3c',
    awningAlt: '#cdbf9e',
  },
};

export function squareStyle(stageId: StageId): SquareStyle {
  return { ...STYLES[stageId], symbol: STAGE_SYMBOL[stageId] };
}

const CHAR = '#2a2420';
const RUBBLE = '#8b8278';
const RUBBLE_DARK = '#5f5850';
const FRESH_WOOD = '#d9b07a';
const FLOWERS = ['#e5484d', '#f5d90a', '#f5f5f4', '#e879f9'];
const LEAVES = '#4d7c3a';

const MIX = new THREE.Color();
const MIX_TO = new THREE.Color();

/** `hex` moved `amount` of the way toward `toward`. */
export function mixColor(hex: string, toward: string, amount: number): string {
  return `#${MIX.set(hex).lerp(MIX_TO.set(toward), amount).getHexString()}`;
}

const flat = (part: TokenPart): TokenPart => ({ ...part, ink: false });

// --- One building ------------------------------------------------------------------

type HouseState = 'whole' | 'charred' | 'ruined' | 'mended';

type HouseSpec = {
  width: number;
  depth: number;
  height: number;
  state: HouseState;
  /** A round water tank on the roof (Leaf). */
  tank?: boolean;
  chimney?: boolean;
  awning?: 'whole' | 'broken';
};

/** A house in local space: footprint centred on the origin, front facing +z. */
function houseParts(style: SquareStyle, spec: HouseSpec): TokenPart[] {
  const {
    width, depth, height, state,
  } = spec;
  const charred = state === 'charred' || state === 'ruined';
  const wall = charred ? mixColor(style.wall, CHAR, state === 'ruined' ? 0.45 : 0.22) : style.wall;
  const roof = charred ? mixColor(style.roof, CHAR, 0.35) : style.roof;
  const beam = state === 'mended' ? FRESH_WOOD : style.beam;
  const front = depth / 2;
  const parts: TokenPart[] = [];

  if (style.roofShape === 'tent') {
    // A canvas ridge tent: no walls, the roof comes down to the ground.
    const ridge = new THREE.CylinderGeometry(1, 1, width, 3, 1);
    ridge.rotateZ(HALF_TURN);
    ridge.rotateX(-HALF_TURN);
    ridge.scale(1, (height + 0.3) / 1.5, depth / 1.732);
    const tentHeight = state === 'ruined' ? 0.55 : 1;
    parts.push(p(ridge, wall, [0, ((height + 0.3) / 3) * tentHeight, 0], undefined, [1, tentHeight, 1]));
    parts.push(flat(p(box(0.34, height * 0.6 * tentHeight, 0.02), style.door, [0, height * 0.3 * tentHeight, front * 0.55])));
    [-width / 2, width / 2].forEach((x) => parts.push(
      p(box(0.05, height + 0.4, 0.05), beam, [x, (height + 0.4) / 2, 0])
    ));
    return parts;
  }

  if (state === 'ruined') {
    // Broken walls: a jagged stub, the roof gone, a charred beam across.
    const stubs: [number, number][] = [[-0.36, 0.9], [-0.05, 0.55], [0.3, 0.75]];
    stubs.forEach(([x, share]) => parts.push(p(box(width / 3 + 0.02, height * share, depth), wall, [x * width, (height * share) / 2, 0])));
    parts.push(p(box(width * 0.9, 0.08, 0.08), CHAR, [0, height * 0.62, front - 0.1], [0, 0.2, 0.28]));
    parts.push(p(box(0.08, height * 0.8, 0.08), CHAR, [width * 0.42, height * 0.35, front - 0.05], [0, 0, -0.35]));
    return parts;
  }

  parts.push(p(box(width, height, depth), wall, [0, height / 2, 0]));
  // Timber frame and openings on the front.
  parts.push(flat(p(box(0.06, height, 0.02), beam, [-width / 2 + 0.04, height / 2, front + 0.01])));
  parts.push(flat(p(box(0.06, height, 0.02), beam, [width / 2 - 0.04, height / 2, front + 0.01])));
  parts.push(flat(p(box(width, 0.05, 0.02), beam, [0, height * 0.62, front + 0.01])));
  parts.push(flat(p(box(0.32, 0.56, 0.02), style.door, [-width * 0.18, 0.28, front + 0.012])));
  parts.push(flat(p(box(0.3, 0.2, 0.02), style.window, [width * 0.22, height * 0.42, front + 0.012])));
  if (width > 1.4) {
    parts.push(flat(p(box(0.26, 0.18, 0.02), style.window, [width * 0.22, height * 0.8, front + 0.012])));
  }
  if (charred) {
    // Soot streaks up the front.
    [-0.3, 0.05, 0.32].forEach((x, index) => parts.push(flat(p(
      box(0.12 + index * 0.03, height * (0.5 + index * 0.15), 0.02),
      CHAR,
      [x * width, height * (0.25 + index * 0.07), front + 0.014],
      [0, 0, (index - 1) * 0.12]
    ))));
  }
  if (spec.awning) {
    const broken = spec.awning === 'broken';
    parts.push(p(
      box(0.62, 0.035, 0.24),
      broken ? mixColor(style.awning, CHAR, 0.4) : style.awning,
      [-width * 0.18 + (broken ? 0.12 : 0), broken ? 0.6 : 0.7, front + (broken ? 0.03 : 0.07)],
      broken ? [1.3, 0, 0.35] : [0.38, 0, 0]
    ));
    if (!broken) {
      parts.push(flat(p(box(0.62, 0.05, 0.02), style.awningAlt, [-width * 0.18, 0.66, front + 0.15], [0.38, 0, 0])));
    }
  }

  // The roof.
  const eave = 0.12;
  switch (style.roofShape) {
    case 'hip': {
      parts.push(p(box(width + eave * 2, 0.07, depth + eave * 2), style.roofEdge, [0, height + 0.035, 0]));
      const pyramid = cone(0.71, 0.5, 4);
      pyramid.rotateY(Math.PI / 4);
      parts.push(p(pyramid, roof, [0, height + 0.32, 0], undefined, [width + eave, 1, depth + eave]));
      break;
    }
    case 'dome': {
      parts.push(p(box(width + 0.06, 0.08, depth + 0.06), style.roofEdge, [0, height + 0.04, 0]));
      const dome = new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, HALF_TURN);
      parts.push(p(dome, roof, [0, height + 0.06, 0], undefined, [width * 0.92, 0.9, depth * 0.92]));
      [-0.26, 0.26].forEach((x) => parts.push(flat(p(cylinder(0.07, 0.07, 0.02, 8), style.window, [x * width, height * 0.78, front + 0.012], [HALF_TURN, 0, 0]))));
      break;
    }
    case 'slab': {
      // Two tiers of dark tiled roof, tipped toward the camera.
      parts.push(p(box(width + 0.24, 0.07, depth + 0.24), roof, [0, height + 0.08, 0.05], [0.22, 0, 0]));
      parts.push(p(box(width * 0.7, 0.32, depth * 0.6), style.wall, [0, height + 0.3, -0.12]));
      parts.push(p(box(width * 0.82, 0.07, depth * 0.78), roof, [0, height + 0.5, -0.06], [0.22, 0, 0]));
      parts.push(flat(p(box(width + 0.26, 0.03, 0.03), style.roofEdge, [0, height + 0.04, front + 0.17])));
      break;
    }
    case 'flat': {
      parts.push(p(box(width + 0.08, 0.08, depth + 0.08), style.roofEdge, [0, height + 0.04, 0]));
      parts.push(p(cylinder(0.22, 0.24, 0.36, 10), roof, [width * 0.22, height + 0.26, -0.1]));
      parts.push(p(cylinder(0.25, 0.25, 0.05, 10), style.roofEdge, [width * 0.22, height + 0.46, -0.1]));
      parts.push(p(cylinder(0.04, 0.04, 0.5, 5), style.beam, [-width * 0.28, height + 0.25, -0.15]));
      break;
    }
    case 'rock': {
      parts.push(p(box(width + 0.06, 0.1, depth + 0.06), style.roofEdge, [0, height + 0.05, 0]));
      parts.push(p(rock(0.42), roof, [-width * 0.2, height + 0.2, -0.05], [0.3, 0.5, 0], [width * 0.55, 0.45, 1.05]));
      parts.push(p(rock(0.34), roof, [width * 0.22, height + 0.18, 0.05], [0.1, 1.2, 0.2], [width * 0.5, 0.42, 0.95]));
      break;
    }
    case 'leanTo':
    default: {
      parts.push(p(box(width + 0.3, 0.06, depth + 0.16), roof, [0, height + 0.12, 0], [0.32, 0, 0]));
      [-width / 2 - 0.1, width / 2 + 0.1].forEach((x) => parts.push(
        p(box(0.06, height + 0.05, 0.06), style.beam, [x, (height + 0.05) / 2, front + 0.04])
      ));
      break;
    }
  }
  if (spec.tank) {
    const tx = width * 0.3;
    parts.push(p(cylinder(0.17, 0.17, 0.28, 8), '#7d8c96', [tx, height + 0.62, -0.18]));
    parts.push(p(cylinder(0.18, 0.18, 0.04, 8), '#5b6670', [tx, height + 0.78, -0.18]));
    parts.push(p(box(0.04, 0.3, 0.04), style.beam, [tx - 0.12, height + 0.4, -0.18]));
    parts.push(p(box(0.04, 0.3, 0.04), style.beam, [tx + 0.12, height + 0.4, -0.18]));
  }
  if (spec.chimney) {
    parts.push(p(box(0.16, 0.42, 0.16), mixColor(style.wall, '#000000', 0.25), [-width * 0.3, height + 0.42, -0.2]));
  }
  return parts;
}

/** Where a house's chimney smoke leaves it, in local space (see houseParts). */
function chimneyTop(spec: HouseSpec): [number, number, number] {
  return [-spec.width * 0.3, spec.height + 0.68, -0.2];
}

// --- Smaller pieces ----------------------------------------------------------------

function rubbleParts(seed: number): TokenPart[] {
  return [0, 1, 2, 3].map((index) => p(
    rock(0.09 + ((seed + index) % 3) * 0.035),
    index % 2 ? RUBBLE : RUBBLE_DARK,
    [((index * 37 + seed * 11) % 9) / 9 - 0.45, 0.07, ((index * 23 + seed * 7) % 5) / 25],
    [index, seed, 0]
  ));
}

/** A banner with the village's mark, hung flat on a wall (front +z). */
function bannerParts(style: SquareStyle, height: number): TokenPart[] {
  const parts: TokenPart[] = [
    flat(p(box(0.42, 0.7, 0.02), style.cloth, [0, height - 0.35, 0])),
    p(box(0.5, 0.04, 0.04), style.beam, [0, height + 0.02, 0]),
    flat(p(box(0.42, 0.06, 0.021), style.flagB, [0, height - 0.68, 0.001])),
  ];
  const mark = new THREE.Matrix4().makeTranslation(0, height - 0.32, 0.012);
  symbolGeometries(style.symbol, { size: 0.34, width: 10, depth: 0.012 }, mark).forEach((geometry) => {
    parts.push(flat({ geometry, color: style.mark }));
  });
  return parts;
}

function flowerBoxParts(width: number, seed: number): TokenPart[] {
  const parts: TokenPart[] = [p(box(width, 0.1, 0.14), '#7b4b2a', [0, 0.05, 0])];
  for (let index = 0; index < 4; index += 1) {
    const x = (index / 3 - 0.5) * (width - 0.12);
    parts.push(flat(p(ball(0.05, 5, 4), LEAVES, [x, 0.13, 0])));
    parts.push(flat(p(ball(0.035, 5, 4), FLOWERS[(index + seed) % FLOWERS.length], [x + 0.03, 0.17, 0.03])));
  }
  return parts;
}

/** A low fence run along x, `broken` leaves gaps and leans. */
function fenceParts(style: SquareStyle, length: number, broken: boolean): TokenPart[] {
  const parts: TokenPart[] = [];
  const posts = Math.max(2, Math.round(length / 0.45));
  for (let index = 0; index < posts; index += 1) {
    const x = (index / (posts - 1) - 0.5) * length;
    const gap = broken && index % 3 === 1;
    if (!gap) parts.push(p(box(0.06, 0.5, 0.06), style.beam, [x, 0.25, 0], broken ? [0, 0, (index % 2 ? 1 : -1) * 0.3] : undefined));
  }
  parts.push(p(box(length, 0.05, 0.04), style.beam, [0, 0.36, 0], broken ? [0, 0, 0.1] : undefined));
  if (!broken) parts.push(p(box(length, 0.05, 0.04), style.beam, [0, 0.18, 0]));
  return parts;
}

/** A festival stall: a counter under a striped awning (front +z, low enough for the east wall). */
function festivalStallParts(style: SquareStyle): TokenPart[] {
  const parts: TokenPart[] = [
    p(box(0.84, 0.42, 0.5), style.beam, [0, 0.21, 0]),
    p(box(0.9, 0.05, 0.56), mixColor(style.beam, '#000000', 0.3), [0, 0.44, 0]),
    p(box(0.04, 0.82, 0.04), style.beam, [-0.42, 0.41, -0.22]),
    p(box(0.04, 0.82, 0.04), style.beam, [0.42, 0.41, -0.22]),
    p(box(0.04, 0.62, 0.04), style.beam, [-0.42, 0.31, 0.24]),
    p(box(0.04, 0.62, 0.04), style.beam, [0.42, 0.31, 0.24]),
    p(ball(0.08, 6, 5), '#f97316', [-0.22, 0.52, 0.1]),
    p(ball(0.07, 6, 5), '#fde047', [0, 0.51, 0.12]),
    p(cylinder(0.05, 0.06, 0.12, 6), '#dc2626', [0.22, 0.52, 0.08]),
  ];
  [-0.36, -0.18, 0, 0.18, 0.36].forEach((x, index) => parts.push(
    p(box(0.18, 0.025, 0.6), index % 2 ? style.awningAlt : style.awning, [x, 0.79, 0.02], [0.32, 0, 0])
  ));
  return parts;
}

/** A Leaf ramen stand on the west wall: counter, stools and short noren curtains. */
function ramenStandParts(style: SquareStyle, length: number, state: HouseState): TokenPart[] {
  const wall = state === 'charred' ? mixColor(style.wall, CHAR, 0.25) : style.wall;
  const parts: TokenPart[] = [
    p(box(length, 1.15, 0.5), wall, [0, 0.575, -0.22]),
    p(box(length + 0.1, 0.4, 0.3), style.beam, [0, 0.2, 0.15]),
    p(box(length + 0.16, 0.05, 0.36), mixColor(style.beam, '#000000', 0.25), [0, 0.42, 0.15]),
    p(box(length + 0.3, 0.06, 0.8), style.roofEdge, [0, 1.22, 0], [0.18, 0, 0]),
  ];
  const curtains = Math.max(3, Math.round(length / 0.32));
  for (let index = 0; index < curtains; index += 1) {
    const x = (index / (curtains - 1) - 0.5) * (length - 0.2);
    parts.push(flat(p(box(length / curtains - 0.03, 0.3, 0.015), index % 2 ? '#f3ecdb' : '#efe6d0', [x, 1.0, 0.36])));
  }
  parts.push(flat(p(box(length - 0.1, 0.05, 0.016), style.roof, [0, 0.88, 0.361])));
  if (state !== 'ruined') {
    [-0.3, 0.3].forEach((x) => parts.push(p(cylinder(0.08, 0.08, 0.3, 8), '#a16207', [x * length, 0.15, 0.4])));
  }
  return parts;
}

/** A flat scorch mark on the paving. */
function scorchParts(x: number, y: number, size: number, turn: number): TokenPart[] {
  const [wx, , wz] = toWorld(x, y);
  return [
    // Soot, not a hole: a little darker than the paving, so it never reads as a block.
    flat(p(new THREE.CircleGeometry(size, 9).rotateX(-HALF_TURN), '#a0968a', [wx, 0.031, wz], [0, turn, 0], [1.4, 1, 0.8])),
    flat(p(new THREE.CircleGeometry(size * 0.55, 7).rotateX(-HALF_TURN), '#8c8277', [wx + size * 0.3, 0.032, wz - size * 0.1], [0, turn * 2, 0], [1.3, 1, 0.7])),
  ];
}

/** Bunting: small triangle flags along a sagging line from a to b (world space). */
function buntingParts(
  style: SquareStyle,
  a: [number, number, number],
  b: [number, number, number],
  flags: number
): TokenPart[] {
  const parts: TokenPart[] = [];
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const yaw = -Math.atan2(b[2] - a[2], b[0] - a[0]);
  for (let index = 0; index <= flags; index += 1) {
    const t = index / flags;
    const sag = Math.sin(Math.PI * t) * 0.22;
    const x = a[0] + (b[0] - a[0]) * t;
    const y = a[1] + (b[1] - a[1]) * t - sag;
    const z = a[2] + (b[2] - a[2]) * t;
    if (index < flags) {
      const flag = new THREE.ConeGeometry(0.12, 0.26, 3);
      flag.rotateZ(Math.PI);
      parts.push(flat(p(flag, index % 2 ? style.flagA : style.flagB, [x + ((b[0] - a[0]) / flags) / 2, y - 0.15, z + ((b[2] - a[2]) / flags) / 2], [0, yaw, 0], [1, 1, 0.25])));
    }
  }
  parts.push(flat(p(box(length, 0.012, 0.012), '#3f3a36', [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.14, (a[2] + b[2]) / 2], [0, yaw, 0])));
  return parts;
}

// --- Placement ---------------------------------------------------------------------

const PLACE = new THREE.Matrix4();
const PLACE_QUATERNION = new THREE.Quaternion();
const PLACE_EULER = new THREE.Euler();
const OWN = new THREE.Matrix4();
const OWN_QUATERNION = new THREE.Quaternion();
const OWN_POSITION = new THREE.Vector3();
const OWN_SCALE = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const ORIGIN = new THREE.Vector3();

/** Bakes each part's own transform, then `placement` if given, into its geometry. */
function bake(parts: TokenPart[], placement?: THREE.Matrix4): TokenPart[] {
  return parts.map((part) => {
    PLACE_EULER.set(...(part.rotate ?? [0, 0, 0]));
    OWN_QUATERNION.setFromEuler(PLACE_EULER);
    OWN.compose(
      OWN_POSITION.set(...(part.at ?? [0, 0, 0])),
      OWN_QUATERNION,
      OWN_SCALE.set(...(part.scale ?? [1, 1, 1]))
    );
    part.geometry.applyMatrix4(OWN);
    if (placement) part.geometry.applyMatrix4(placement);
    return { geometry: part.geometry, color: part.color, ink: part.ink };
  });
}

/** `parts` (local space) baked into world space at cell (x, y), turned by `yaw`. */
function placed(parts: TokenPart[], x: number, y: number, yaw = 0, lift = 0): TokenPart[] {
  const [wx, , wz] = toWorld(x, y);
  PLACE_EULER.set(0, yaw, 0);
  PLACE_QUATERNION.setFromEuler(PLACE_EULER);
  PLACE.compose(ORIGIN.set(wx, lift, wz), PLACE_QUATERNION, ONE);
  return bake(parts, PLACE);
}

export type LanternAnchor = { x: number; y: number; z: number; phase: number };
export type SmokeSource = { x: number; y: number; z: number; dark: boolean };

export type SquareAmbience = {
  /** Hang points (world space); the lantern hangs below. */
  lanterns: LanternAnchor[];
  lit: boolean;
  smoke: SmokeSource[];
  /** Perches for the birds under reduced motion, and the centre they circle. */
  perches: [number, number, number][];
  birdCount: number;
  birdDark: boolean;
};

export type SquareDressing = {
  token: InkedToken;
  ambience: SquareAmbience;
};

// Centres measured from the square's north-west corner (its outer edge).
const NORTH_HOUSES = [
  { x: 1, width: 1.9, height: 1.25 },
  { x: 3, width: 1.9, height: 1.45 },
  { x: 5, width: 1.9, height: 1.3 },
  { x: 7, width: 1.9, height: 1.5 },
  { x: 9, width: 1.9, height: 1.2 },
];
const WEST_HOUSES = [
  { y: 1.4, width: 2.1, height: 1.3 },
  { y: 3.8, width: 1.5, height: 1.15 },
  { y: 6.4, width: 2.1, height: 1.4 },
];
const HOUSE_DEPTH = 1.0;
/** Eave lanterns hang this far out from a front: clear of the cells players stand in. */
const LANTERN_OUT = 0.05;
// House fronts stand on the wall ring's inner face, half a cell from the square.
const FRONT_INSET = 0.45;

function awningFor(state: HouseState, repair: RepairStage): HouseSpec['awning'] {
  if (state === 'ruined') return undefined;
  return repair === 0 ? 'broken' : 'whole';
}

function stateFor(repair: RepairStage, index: number, ruinedAt: number[]): HouseState {
  if (repair === 0) return ruinedAt.includes(index) ? 'ruined' : 'charred';
  if (repair === 1 && ruinedAt.includes(index)) return 'mended';
  return 'whole';
}

/**
 * The dressing for one square: the merged static pieces and where the
 * animated ones go. Pure apart from building geometry; the same village,
 * stage and layout always give the same result.
 */
export function buildSquareDressing(
  stageId: StageId,
  repair: RepairStage,
  square: VillageSquareLayout,
  /** Wall cells inside the bounds (the plan's two pillars). */
  pillars: readonly (readonly [number, number])[] = []
): SquareDressing {
  const style = squareStyle(stageId);
  const {
    x0, y0, x1, y1,
  } = square.bounds;
  const north = y0 - 1;
  const west = x0 - 1;
  const parts: TokenPart[] = [];
  const lanterns: LanternAnchor[] = [];
  const smoke: SmokeSource[] = [];
  const perches: [number, number, number][] = [];
  const thriving = repair >= 2;
  const festival = repair >= 3;

  NORTH_HOUSES.forEach((house, index) => {
    const state = stateFor(repair, index, [1, 3]);
    const spec: HouseSpec = {
      width: house.width,
      depth: HOUSE_DEPTH,
      height: house.height,
      state,
      tank: style.tanks && (index === 0 || index === 3) && state !== 'ruined',
      chimney: (index === 2 || index === 4) && state !== 'ruined',
      awning: awningFor(state, repair),
    };
    const cx = x0 - 0.5 + house.x;
    const cy = north + FRONT_INSET - HOUSE_DEPTH / 2;
    parts.push(...placed(houseParts(style, spec), cx, cy));
    const [wx, , wz] = toWorld(cx, cy);
    const front = wz + HOUSE_DEPTH / 2;
    if (state === 'ruined') {
      parts.push(...placed(rubbleParts(index), cx, north + 0.2));
      smoke.push({
        x: wx, y: house.height * 0.7, z: wz, dark: true
      });
    } else if (spec.chimney && repair >= 1) {
      const [hx, hy, hz] = chimneyTop(spec);
      smoke.push({
        x: wx + hx, y: hy, z: wz + hz, dark: false
      });
    }
    if (repair === 0 && state !== 'ruined' && index % 2 === 0) {
      parts.push(...placed(rubbleParts(index + 5), cx + 0.5, north + 0.25));
    }
    if (repair === 1 && state === 'mended') {
      // Rebuilt: a ladder still leans on the fresh timber.
      parts.push(...placed([
        p(box(0.04, 1.3, 0.04), FRESH_WOOD, [-0.12, 0.65, 0.56], [-0.12, 0, 0]),
        p(box(0.04, 1.3, 0.04), FRESH_WOOD, [0.12, 0.65, 0.56], [-0.12, 0, 0]),
        ...[0.25, 0.55, 0.85].map((h) => p(box(0.26, 0.03, 0.03), FRESH_WOOD, [0, h, 0.6 - (h - 0.65) * 0.12])),
      ], cx + 0.55, cy));
    }
    if (repair >= 1 && state !== 'ruined') {
      // Lanterns at the eave over each door; two from thriving.
      lanterns.push({
        x: wx - house.width * 0.18, y: house.height - 0.02, z: front + LANTERN_OUT, phase: index * 1.7
      });
      if (thriving) {
        lanterns.push({
          x: wx + house.width * 0.08, y: house.height - 0.02, z: front + LANTERN_OUT, phase: index * 1.7 + 0.9
        });
      }
    }
    if (repair === 0 && index === 2) {
      // A torn lantern hangs still from the scorched eave.
      parts.push(...placed([
        p(cylinder(0.09, 0.07, 0.14, 8), mixColor(style.lantern, CHAR, 0.5), [-0.35, house.height - 0.28, HOUSE_DEPTH / 2 + 0.05], [0.2, 0, 0.6]),
      ], cx, cy));
    }
    if ((thriving && index % 2 === 0) || festival) {
      parts.push(...placed(bannerParts(style, house.height - 0.12), cx + house.width * 0.38, cy + HOUSE_DEPTH / 2 + 0.02));
    }
    if (thriving) {
      parts.push(...placed(flowerBoxParts(0.5, index), cx + house.width * 0.22, cy + HOUSE_DEPTH / 2 + 0.08, 0, house.height * 0.42 - 0.18));
    }
    if (festival && index % 2 === 1) {
      parts.push(...placed([
        p(box(0.04, 1.1, 0.04), style.beam, [0, house.height + 0.95, -0.2]),
        flat(p(box(0.5, 0.32, 0.015), style.flagA, [0.27, house.height + 1.32, -0.2])),
        flat(p(box(0.5, 0.08, 0.016), style.flagB, [0.27, house.height + 1.2, -0.19])),
      ], cx, cy));
    }
    perches.push([wx - 0.2 + (index % 2) * 0.4, house.height + 0.55, wz - 0.1]);
  });

  WEST_HOUSES.forEach((house, index) => {
    const state = stateFor(repair, index, [1]);
    const cx = west + FRONT_INSET - HOUSE_DEPTH / 2;
    const cy = y0 - 0.5 + house.y;
    const yaw = HALF_TURN;
    const [wx, , wz] = toWorld(cx, cy);
    const front = wx + HOUSE_DEPTH / 2;
    if (index === 2 && stageId === 'hiddenLeaf') {
      // The Leaf's ramen stand, where the west wall meets the shrine.
      parts.push(...placed(ramenStandParts(style, house.width, state === 'ruined' ? 'charred' : state), cx + 0.15, cy, yaw));
      if (repair >= 1) {
        lanterns.push({
          x: front + LANTERN_OUT, y: 1.12, z: wz - house.width * 0.42, phase: 4.1
        });
        lanterns.push({
          x: front + LANTERN_OUT, y: 1.12, z: wz + house.width * 0.42, phase: 5.3
        });
      }
      return;
    }
    const spec: HouseSpec = {
      width: house.width,
      depth: HOUSE_DEPTH,
      height: house.height,
      state,
      chimney: index === 0 && state !== 'ruined',
      awning: awningFor(state, repair),
    };
    parts.push(...placed(houseParts(style, spec), cx, cy, yaw));
    if (state === 'ruined') {
      parts.push(...placed(rubbleParts(index + 9), west + 0.25, cy, yaw));
    } else if (spec.chimney && repair >= 1) {
      // Local (x, z) turned a quarter: z becomes -x.
      const [hx, hy, hz] = chimneyTop(spec);
      smoke.push({
        x: wx + hz, y: hy, z: wz - hx, dark: false
      });
    }
    if (repair >= 1 && state !== 'ruined') {
      lanterns.push({
        x: front + LANTERN_OUT, y: house.height - 0.02, z: wz + house.width * 0.18, phase: 2.3 + index
      });
    }
    if (thriving) {
      parts.push(...placed(bannerParts(style, house.height - 0.12), cx + HOUSE_DEPTH / 2 + 0.02, cy - house.width * 0.38, yaw));
    }
  });

  // The east wall (low pieces only: they stand beside the way out).
  const eastX = x1 + 1;
  [[y0 + 0.5, 2], [y1 - 1, 3]].forEach(([cy, length], index) => {
    if (festival) {
      parts.push(...placed(festivalStallParts(style), eastX - 0.15, cy, -HALF_TURN));
      lanterns.push({
        x: toWorld(eastX - 0.15, cy)[0] - 0.36, y: 0.98, z: toWorld(eastX, cy)[2], phase: 6 + index
      });
    } else {
      parts.push(...placed(fenceParts(style, length - 0.3, repair === 0), eastX - 0.4, cy, HALF_TURN));
      if (repair === 0) parts.push(...placed(rubbleParts(index + 13), eastX, cy + 0.4));
      else {
        parts.push(...placed([
          p(cylinder(0.14, 0.16, 0.34, 8), '#8b5e34', [0, 0.17, 0]),
          p(cylinder(0.15, 0.15, 0.03, 8), '#5b3a1f', [0, 0.34, 0]),
          p(box(0.3, 0.26, 0.3), '#a47148', [0.05, 0.13, 0.36], [0, 0.3, 0]),
        ], eastX - 0.15, cy - 0.3));
      }
    }
  });

  // The south wall: planters, low lanterns at the festival, rubble when damaged.
  const southY = y1 + 1;
  [x0 + 0.5, x1 - 1].forEach((cx, index) => {
    if (repair === 0) {
      parts.push(...placed(rubbleParts(index + 17), cx, southY - 0.3));
      return;
    }
    if (thriving) parts.push(...placed(flowerBoxParts(1.4, index + 2), cx, southY - 0.42, 0, 0.94));
    if (festival) {
      [-0.7, 0.7].forEach((dx, at) => {
        parts.push(...placed([p(box(0.05, 0.22, 0.05), style.beam, [0, 1.05, 0])], cx + dx, southY - 0.3));
        const [lx, , lz] = toWorld(cx + dx, southY - 0.3);
        lanterns.push({
          x: lx, y: 1.14, z: lz, phase: 7 + index * 2 + at
        });
      });
    }
  });

  // The pillars inside the square: scorched when damaged, notices when rebuilt.
  pillars.forEach(([px, py], index) => {
    if (repair === 0) {
      parts.push(...placed([
        flat(p(box(0.5, 0.5, 0.01), CHAR, [0.05, 0.5, 0.455], [0, 0, 0.3])),
        ...rubbleParts(index + 21).map((part) => ({ ...part, at: [part.at![0] * 0.6, part.at![1], 0.4] as [number, number, number] })),
      ], px, py));
    } else {
      parts.push(...placed([
        flat(p(box(0.3, 0.38, 0.012), '#f4ead2', [-0.12 + index * 0.24, 0.55, 0.455], [0, 0, 0.05 - index * 0.1])),
        flat(p(box(0.18, 0.03, 0.013), '#475569', [-0.12 + index * 0.24, 0.62, 0.463], [0, 0, 0.05 - index * 0.1])),
        flat(p(box(0.14, 0.03, 0.013), '#475569', [-0.12 + index * 0.24, 0.54, 0.463], [0, 0, 0.05 - index * 0.1])),
      ], px, py));
    }
    if (festival) {
      parts.push(...placed([flat(p(box(0.86, 0.1, 0.86), style.flagA, [0, 0.72, 0]))], px, py));
      const [lx, , lz] = toWorld(px, py);
      lanterns.push({
        x: lx, y: 1.32, z: lz, phase: 9 + index
      });
      parts.push(...placed([p(box(0.05, 0.36, 0.05), style.beam, [0, 1.1, 0])], px, py));
    }
  });

  if (repair === 0) {
    // Scorch marks on the paving: flat, so they block and hide nothing.
    [[x0 + 2, y0 + 1.6, 0.42, 0.4], [x0 + 7.4, y0 + 2.3, 0.36, 1.1], [x0 + 4.6, y0 + 5.1, 0.5, 2.0],
      [x0 + 1.3, y0 + 4.6, 0.32, 0.7], [x0 + 8.2, y0 + 5.6, 0.4, 2.6]].forEach(([x, y, size, turn]) => {
      parts.push(...bake(scorchParts(x, y, size, turn)));
    });
  }

  if (festival) {
    // Lantern strings and bunting along the north eaves, and down the west.
    const [ax, , az] = toWorld(x0 - 0.4, north + FRONT_INSET);
    const [bx, , bz] = toWorld(x1 + 0.4, north + FRONT_INSET);
    parts.push(...buntingParts(style, [ax, 1.95, az], [bx, 1.95, bz], 18));
    // ...and a higher one over the roofs, from the first house to the last.
    const [rx, , rz] = toWorld(x0 + 0.5, north - 0.1);
    const [sx, , sz] = toWorld(x1 - 0.5, north - 0.1);
    parts.push(...buntingParts(style, [rx, 2.75, rz], [sx, 2.75, sz], 16));
    for (let index = 0; index < 9; index += 1) {
      const t = (index + 0.5) / 9;
      lanterns.push({
        x: ax + (bx - ax) * t,
        y: 1.78 - Math.sin(Math.PI * t) * 0.22,
        z: az + 0.02,
        phase: 11 + index * 0.7,
      });
    }
    const [cx, , cz] = toWorld(west + 0.3, y0 - 0.2);
    const [dx, , dz] = toWorld(west + 0.3, y1 + 0.2);
    parts.push(...buntingParts(style, [cx, 1.6, cz], [dx, 1.6, dz], 14));
  }

  return {
    token: buildInkedToken(parts),
    ambience: {
      lanterns,
      lit: thriving,
      smoke,
      perches,
      birdCount: repair === 0 ? 2 : 4,
      birdDark: repair === 0,
    },
  };
}

const DRESSINGS = new Map<string, SquareDressing>();

/** The square's dressing for this village and repair stage, built once and kept. */
export function squareDressing(
  stageId: StageId,
  repair: RepairStage,
  square: VillageSquareLayout,
  pillars: readonly (readonly [number, number])[] = []
): SquareDressing {
  const { bounds } = square;
  const key = `${stageId}|${repair}|${bounds.x0},${bounds.y0},${bounds.x1},${bounds.y1}|${pillars.join(';')}`;
  let dressing = DRESSINGS.get(key);
  if (!dressing) {
    dressing = buildSquareDressing(stageId, repair, square, pillars);
    DRESSINGS.set(key, dressing);
  }
  return dressing;
}

// --- Animated pieces' looks --------------------------------------------------------

function lazyByKey<T>(build: (key: string) => T): (key: string) => T {
  const cache = new Map<string, T>();
  return (key) => {
    let value = cache.get(key);
    if (value === undefined) {
      value = build(key);
      cache.set(key, value);
    }
    return value;
  };
}

/** A hanging paper lantern, its hang point at the origin. Per village colours. */
export const lanternToken = lazyByKey((stageId: string): InkedToken => {
  const style = squareStyle(stageId as StageId);
  return buildInkedToken([
    p(box(0.012, 0.08, 0.012), '#3f3a36', [0, -0.04, 0], undefined, undefined, false),
    p(cylinder(0.06, 0.06, 0.03, 8), style.lanternBand, [0, -0.09, 0]),
    p(ball(0.11, 8, 6), style.lantern, [0, -0.2, 0], undefined, [1, 1.15, 1]),
    flat(p(cylinder(0.112, 0.112, 0.025, 8), style.lanternBand, [0, -0.2, 0])),
    p(cylinder(0.055, 0.055, 0.03, 8), style.lanternBand, [0, -0.33, 0]),
  ]);
});

/** One smoke puff (soft, unlit grey), scaled per instance. */
export const smokeToken = lazyByKey((tone: string): InkedToken => buildInkedToken([
  flat(p(new THREE.IcosahedronGeometry(0.16, 1), tone)),
]));

/** A bird with spread wings: flapping scales it in y. */
export const birdToken = lazyByKey((tone: string): InkedToken => buildInkedToken([
  flat(p(box(0.08, 0.05, 0.16), tone)),
  flat(p(box(0.22, 0.015, 0.08), tone, [-0.12, 0.03, 0], [0, 0, 0.35])),
  flat(p(box(0.22, 0.015, 0.08), tone, [0.12, 0.03, 0], [0, 0, -0.35])),
]));
