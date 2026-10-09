import * as THREE from 'three';
import { Power, powerUpOptions } from '../../../model/gameItem';
import { CharacterId } from '../../../content/types';
import { getCharacterPowerTheme } from '../../../content/characterPowerups';
import { HighContrastOverride, relativeLuminance } from './highContrast';
import {
  HALF_TURN, InkedToken, TokenPart, ball, box, buildInkedToken, cone, cylinder, dome, gem,
  ring, rock, tokenPart as p, tokenToonMaterial,
} from './inkedToken';

/**
 * One small inked model per pickup type. The outline tells the type (a bomb
 * with a plus, a burst of arrows, a plunger, chevrons, a round shield...);
 * the character's theme colours only tint it. Every model is one merged
 * vertex-coloured body plus one ink hull, built once per look and shared by
 * every pickup of that type on the board.
 */

export type PickupSilhouette =
  | 'bombPlus'
  | 'arrowBurst'
  | 'plunger'
  | 'chevrons'
  | 'roundShield'
  | 'sheetWisp'
  | 'barricade'
  | 'clayCrawler'
  | 'ringedOrb'
  | 'eyeLens'
  | 'kunai'
  | 'featherPair'
  | 'platedDome'
  | 'hangingScroll'
  | 'crystalCluster';

type PickupColors = {
  /** The theme's main colour: the largest mass. */
  main: string;
  /** Secondary marks. */
  accent: string;
  /** Pale paper / clay tone. */
  paper: string;
};

const DARK = '#1f2937';
const STEEL = '#dfe5ec';

type PickupModelDefinition = {
  silhouette: PickupSilhouette;
  /** Roll of the whole token (radians), for diagonal props. */
  lean?: number;
  parts: (colors: PickupColors) => TokenPart[];
};

function arrowBurst({ main, accent }: PickupColors): TokenPart[] {
  const arrows = [0, 1, 2, 3].flatMap((index) => {
    const angle = index * HALF_TURN;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    return [
      p(box(0.1, 0.05, 0.05), main, [dx * 0.1, dy * 0.1, 0], [0, 0, angle]),
      p(cone(0.065, 0.1, 4), main, [dx * 0.19, dy * 0.19, 0], [0, 0, angle - HALF_TURN]),
    ];
  });
  return [p(ball(0.075, 10, 8), accent), ...arrows];
}

function chevron(tipX: number, color: string): TokenPart[] {
  return [
    p(box(0.18, 0.06, 0.07), color, [tipX - 0.06, 0.06, 0], [0, 0, -Math.PI / 4]),
    p(box(0.18, 0.06, 0.07), color, [tipX - 0.06, -0.06, 0], [0, 0, Math.PI / 4]),
  ];
}

function sideCrystal(side: number, color: string, tip: string): TokenPart[] {
  const tilt = 0.45 * side;
  const ux = -Math.sin(tilt);
  const uy = Math.cos(tilt);
  const base: [number, number, number] = [0.1 * side, -0.05, 0.02];
  return [
    p(cylinder(0.045, 0.05, 0.13, 6), color, base, [0, 0, tilt]),
    p(cone(0.045, 0.07, 6), tip, [base[0] + ux * 0.1, base[1] + uy * 0.1, base[2]], [0, 0, tilt]),
  ];
}

export const PICKUP_MODELS: Record<Power, PickupModelDefinition> = {
  // A round bomb with a raised plus beside it: one more charge.
  AddBomb: {
    silhouette: 'bombPlus',
    parts: ({ main, accent, paper }) => [
      p(ball(0.145, 10, 7), main, [-0.05, -0.04, 0]),
      p(cylinder(0.05, 0.06, 0.05), paper, [-0.05, 0.12, 0]),
      p(cylinder(0.014, 0.014, 0.09, 5), DARK, [-0.03, 0.18, 0], [0, 0, -0.5], undefined, false),
      p(gem(0.04), accent, [-0.005, 0.235, 0]),
      p(box(0.16, 0.055, 0.055), paper, [0.15, 0.1, 0.03]),
      p(box(0.055, 0.16, 0.055), paper, [0.15, 0.1, 0.03]),
    ],
  },
  // Four arrowheads flying out of a core: a longer blast.
  BlastRangeUp: { silhouette: 'arrowBurst', parts: arrowBurst },
  // A plunger box with a T-handle: manual release.
  Detonator: {
    silhouette: 'plunger',
    parts: ({ main, accent, paper }) => [
      p(box(0.26, 0.15, 0.17), main, [0, -0.08, 0]),
      p(box(0.29, 0.03, 0.2), DARK, [0, 0.005, 0]),
      p(cylinder(0.02, 0.02, 0.13, 6), paper, [0, 0.08, 0], undefined, undefined, false),
      p(box(0.24, 0.05, 0.06), paper, [0, 0.16, 0]),
      p(box(0.12, 0.06, 0.01), accent, [0, -0.08, 0.09], undefined, undefined, false),
    ],
  },
  // Two forward chevrons with speed lines: faster steps.
  RollerSkate: {
    silhouette: 'chevrons',
    parts: ({ main, paper }) => [
      ...chevron(0.06, main),
      ...chevron(0.2, main),
      ...[-0.07, 0, 0.07].map((y) => (
        p(box(0.09, 0.022, 0.022), paper, [-0.18, y, 0], undefined, undefined, false)
      )),
    ],
  },
  // A round shield with a rim and a boss: a timed guard.
  Invincibility: {
    silhouette: 'roundShield',
    parts: ({ main, accent, paper }) => [
      p(cylinder(0.19, 0.19, 0.05, 12), main, [0, 0, 0], [HALF_TURN, 0, 0]),
      p(ring(0.19, 0.026, 3, 14), paper),
      p(box(0.05, 0.3, 0.02), accent, [0, 0, 0.026], undefined, undefined, false),
      p(ball(0.06, 8, 6), accent, [0, 0, 0.035]),
    ],
  },
  // A sheet wisp with a ragged hem: walk through things.
  Ghost: {
    silhouette: 'sheetWisp',
    parts: ({ main, paper }) => [
      p(dome(0.14), paper, [0, 0.05, 0]),
      p(cylinder(0.14, 0.15, 0.13, 10), paper, [0, -0.015, 0]),
      ...[0, 1, 2, 3, 4].map((index) => {
        const angle = (index / 5) * Math.PI * 2 + 0.3;
        return p(
          cone(0.05, 0.08, 5),
          paper,
          [Math.cos(angle) * 0.1, -0.115, Math.sin(angle) * 0.1],
          [Math.PI, 0, 0]
        );
      }),
      p(ring(0.155, 0.018, 3, 12), main, [0, -0.04, 0], [HALF_TURN, 0, 0], undefined, false),
      p(box(0.035, 0.06, 0.02), DARK, [-0.05, 0.06, 0.135], undefined, undefined, false),
      p(box(0.035, 0.06, 0.02), DARK, [0.05, 0.06, 0.135], undefined, undefined, false),
    ],
  },
  // A small plank barricade on two posts: placeable cover.
  Obstacle: {
    silhouette: 'barricade',
    parts: ({ main, paper }) => [
      ...[-0.14, 0.14].flatMap((x) => [
        p(box(0.06, 0.32, 0.06), main, [x, -0.02, 0]),
        p(cone(0.045, 0.07, 4), main, [x, 0.175, 0], [0, Math.PI / 4, 0]),
      ]),
      ...[-0.1, 0, 0.1].map((y) => p(box(0.38, 0.065, 0.04), paper, [0, y, 0.04])),
      p(box(0.4, 0.04, 0.03), main, [0, 0, 0.07], [0, 0, 0.42]),
    ],
  },
  // A clay bead on six stubby legs.
  ClaySpider: {
    silhouette: 'clayCrawler',
    parts: ({ main, accent, paper }) => [
      p(ball(0.12, 8, 6), paper, [0, -0.02, -0.03], undefined, [1, 0.75, 1.1]),
      p(ball(0.07, 7, 5), paper, [0, 0, 0.1]),
      ...[-1, 1].flatMap((side) => [0, 1, 2].map((index) => (
        p(
          box(0.17, 0.035, 0.035),
          main,
          [side * 0.15, -0.07, -0.08 + index * 0.075],
          [0, side * (index - 1) * 0.45, side * -0.45]
        )
      ))),
      p(ball(0.022, 5, 3), DARK, [-0.03, 0.025, 0.162]),
      p(ball(0.022, 5, 3), DARK, [0.03, 0.025, 0.162]),
      p(ball(0.035, 5, 3), accent, [0, 0.075, -0.04]),
    ],
  },
  // A chakra orb inside two crossed orbit rings.
  Rasengan: {
    silhouette: 'ringedOrb',
    parts: ({ main, accent, paper }) => [
      p(ball(0.12, 8, 6), accent),
      p(ring(0.2, 0.022, 3, 12), main, [0, 0, 0], [1.2, 0, 0]),
      p(ring(0.2, 0.022, 3, 12), main, [0, 0, 0], [0.3, 0.95, 0]),
      p(gem(0.04), paper, [0.1, 0.11, 0.07]),
    ],
  },
  // A wide almond eye: a lens with an iris and a pupil.
  Sharingan: {
    silhouette: 'eyeLens',
    parts: ({ main, paper }) => [
      p(ring(0.2, 0.03, 3, 16), DARK, [0, 0, 0], undefined, [1, 0.55, 1]),
      ...[-1, 1].map((side) => (
        p(cone(0.032, 0.08, 4), DARK, [side * 0.235, 0, 0], [0, 0, -side * HALF_TURN])
      )),
      p(cylinder(0.19, 0.19, 0.03, 12), paper, [0, 0, -0.005], [HALF_TURN, 0, 0], [1, 1, 0.55]),
      p(cylinder(0.085, 0.085, 0.04, 10), main, [0, 0, 0.012], [HALF_TURN, 0, 0]),
      p(cylinder(0.034, 0.034, 0.045, 8), DARK, [0, 0, 0.02], [HALF_TURN, 0, 0], undefined, false),
    ],
  },
  // A kunai with a ring pommel and a paper tag, held on the diagonal.
  FTGKunai: {
    silhouette: 'kunai',
    lean: -0.6,
    parts: ({ main, accent, paper }) => [
      p(gem(0.1), STEEL, [0, 0.08, 0], undefined, [0.65, 1.9, 0.25]),
      p(box(0.09, 0.025, 0.045), DARK, [0, -0.1, 0]),
      p(cylinder(0.024, 0.024, 0.13, 6), main, [0, -0.17, 0]),
      p(ring(0.042, 0.013, 4, 10), main, [0, -0.27, 0], undefined, undefined, false),
      p(box(0.075, 0.12, 0.008), paper, [0.06, -0.19, 0.025], [0, 0, 0.2]),
      p(box(0.03, 0.05, 0.004), accent, [0.062, -0.18, 0.031], [0, 0, 0.2], undefined, false),
    ],
  },
  // Two long feathers fanned in a V.
  CrowFeather: {
    silhouette: 'featherPair',
    lean: -0.3,
    parts: ({ main, accent, paper }) => [
      p(ball(0.1, 8, 6), main, [0, 0.02, 0], undefined, [0.55, 2.2, 0.2]),
      p(box(0.012, 0.42, 0.012), paper, [0, 0.01, 0.022], undefined, undefined, false),
      p(ball(0.08, 8, 6), main, [0.11, -0.03, -0.03], [0, 0, -0.5], [0.5, 2, 0.2]),
      p(cone(0.02, 0.08, 4), accent, [0, -0.23, 0], [Math.PI, 0, 0], undefined, false),
    ],
  },
  // A low plated dome on a rim: a timed sand shell.
  SandArmor: {
    silhouette: 'platedDome',
    parts: ({ main, accent, paper }) => [
      p(dome(0.18, 10), main, [0, -0.08, 0], undefined, [1, 0.85, 1]),
      p(ring(0.17, 0.022, 3, 12), paper, [0, -0.03, 0], [HALF_TURN, 0, 0]),
      p(ring(0.125, 0.02, 3, 10), paper, [0, 0.03, 0], [HALF_TURN, 0, 0]),
      p(cylinder(0.205, 0.205, 0.04, 10), accent, [0, -0.1, 0]),
      p(ball(0.04, 5, 3), paper, [0, 0.075, 0]),
    ],
  },
  // A hanging scroll: the roll on top, the sheet and its weight rod below.
  ChakraScroll: {
    silhouette: 'hangingScroll',
    parts: ({ main, accent, paper }) => [
      p(cylinder(0.065, 0.065, 0.34, 10), paper, [0, 0.1, 0], [0, 0, HALF_TURN]),
      p(cylinder(0.08, 0.08, 0.035, 10), main, [-0.185, 0.1, 0], [0, 0, HALF_TURN]),
      p(cylinder(0.08, 0.08, 0.035, 10), main, [0.185, 0.1, 0], [0, 0, HALF_TURN]),
      p(box(0.26, 0.2, 0.012), paper, [0, -0.02, 0.05]),
      p(cylinder(0.022, 0.022, 0.3, 6), main, [0, -0.125, 0.05], [0, 0, HALF_TURN]),
      p(box(0.08, 0.08, 0.01), accent, [0, -0.02, 0.058], [0, 0, Math.PI / 4], undefined, false),
    ],
  },
  // A crystal cluster on a stone: the rare fragment.
  CharacterFragment: {
    silhouette: 'crystalCluster',
    parts: ({ main, accent, paper }) => [
      p(cylinder(0.065, 0.075, 0.2, 6), main),
      p(cone(0.065, 0.1, 6), paper, [0, 0.15, 0]),
      ...sideCrystal(-1, main, paper),
      ...sideCrystal(1, main, paper),
      p(rock(0.11), accent, [0, -0.12, 0], undefined, [1.3, 0.45, 1]),
    ],
  },
};

export type PickupModel = InkedToken & {
  silhouette: PickupSilhouette;
  lean: number;
  material: THREE.MeshToonMaterial;
  /** Floor ring under the pickup, in the type's own colour. */
  ringMaterial: THREE.MeshBasicMaterial;
};

function colorsFor(power: Power, characterId?: CharacterId): PickupColors {
  const theme = getCharacterPowerTheme(characterId, power);
  return { main: theme.color, accent: theme.accent, paper: theme.paper };
}

/** Under the hovering token: one shared ring, one material per type. */
export const PICKUP_RING_GEOMETRY = new THREE.RingGeometry(0.2, 0.36, 20).rotateX(-Math.PI / 2);
const PICKUP_RING_OPACITY = 0.45;
// A near-black type colour (the crow feather) would read as a shadow on the
// floor; its ring takes the accent instead.
function ringColor(power: Power): string {
  const { main, accent } = colorsFor(power);
  return relativeLuminance(main) < 0.05 ? accent : main;
}

export const PICKUP_RING_MATERIALS = Object.fromEntries(powerUpOptions.map((power) => [
  power,
  new THREE.MeshBasicMaterial({
    color: ringColor(power),
    transparent: true,
    opacity: PICKUP_RING_OPACITY,
    depthWrite: false,
  }),
])) as Record<Power, THREE.MeshBasicMaterial>;

/** High contrast draws the type rings near solid (opacity is a uniform). */
export const PICKUP_HIGH_CONTRAST: readonly HighContrastOverride[] = powerUpOptions
  .map((power) => ({ material: PICKUP_RING_MATERIALS[power], opacity: 0.85 }));

const MODEL_CACHE = new Map<string, PickupModel>();

/**
 * The pickup's shared model for this character's theme: built on first use,
 * then the same geometry and materials for every pickup of the type.
 */
export function getPickupModel(power: Power, characterId?: CharacterId): PickupModel {
  const colors = colorsFor(power, characterId);
  const key = `${power}|${colors.main}|${colors.accent}|${colors.paper}`;
  let model = MODEL_CACHE.get(key);
  if (!model) {
    const definition = PICKUP_MODELS[power];
    model = {
      ...buildInkedToken(definition.parts(colors)),
      silhouette: definition.silhouette,
      lean: definition.lean ?? 0,
      material: tokenToonMaterial(colors.main, 0.12),
      ringMaterial: PICKUP_RING_MATERIALS[power],
    };
    MODEL_CACHE.set(key, model);
  }
  return model;
}

/** Tokens draw a little over their unit size, for the zoomed-out phone camera. */
export const PICKUP_SCALE = 1.1;
/** Height of the token's centre above the floor, at rest. */
export const PICKUP_HOVER = 0.36;
/** Tipped back toward the high camera, so the face reads from above. */
export const PICKUP_TILT = -0.42;
/** The still three-quarter turn reduced motion holds. */
export const PICKUP_REST_YAW = -0.3;
export const PICKUP_BOB = 0.04;
export const PICKUP_SWAY = 0.38;

export type PickupIdlePose = { lift: number; yaw: number };

/**
 * A gentle bob and a slow sway around the three-quarter turn (never a full
 * spin, which turned flat props edge-on). Reduced motion holds the rest pose.
 * Writes into `out`, so it can run every frame without allocating.
 */
export function samplePickupIdle(
  seconds: number,
  phase: number,
  reducedMotion: boolean,
  out: PickupIdlePose
): PickupIdlePose {
  const pose = out;
  if (reducedMotion) {
    pose.lift = 0;
    pose.yaw = PICKUP_REST_YAW;
    return pose;
  }
  pose.lift = Math.sin(seconds * 2.4 + phase) * PICKUP_BOB;
  pose.yaw = PICKUP_REST_YAW + Math.sin(seconds * 0.9 + phase * 1.7) * PICKUP_SWAY;
  return pose;
}

/** A per-cell phase, so neighbouring pickups never bob in lockstep. */
export function pickupPhase(x: number, y: number): number {
  return ((x * 7.3 + y * 3.1) % (Math.PI * 2));
}
