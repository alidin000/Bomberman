import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import type {
  CampaignRequestKind, VillageInteractable, VillageInteractableKind, VillageSquareLayout,
} from '../../../content/villageSquare';
import { WANDERING_VILLAGER } from '../../../content/villageSquare';
import { VILLAGE_REQUESTS } from '../../../content/villageRequests';
import { HUB_MERCHANT, getHubVillage } from '../../../content/hubVillages';
import type { StageId } from '../../../content/types';
import type { CampaignRuntimeState, GameConfig } from '../../../engine/types';
import { CAMPAIGN_STAGE_LAYOUTS } from '../../../content/campaignLayouts';
import {
  HALF_TURN, InkedToken, TokenPart, ball, box, buildInkedToken, cone, cylinder, dome, gem,
  ring, rock, tokenPart as p,
} from './inkedToken';
import { toWorld } from './sceneSpace';
import {
  getActiveVillageSquare,
  squareBlastStop as engineSquareBlastStop,
} from '../../../engine/villageSquare';

/**
 * The village square's looks, in the fighters' inked toon style: flagstone
 * paving, the villagers, Pell's stall cart, the request board, the stone
 * lantern shrine and the gate signpost, the keepsakes a request scatters in
 * the map, the chalk marks on marked crates, and the Honored scarf. Every
 * figure is an original design built from primitives. Props are inked tokens
 * (inkedToken.ts) on the token toon program the shader warmup compiles, and
 * the fixed props are merged into one body and one ink hull for the whole
 * square, so the square costs a handful of draw calls. Coordinates are in
 * cell units with y = 0 on the floor and the front facing +z (the camera).
 */

const INK = '#211d1a';
const WOOD = '#8b5e34';
const DARK_WOOD = '#5b3a1f';
const PAPER = '#f4ead2';
const PAPER_WARM = '#fde68a';
const STONE = '#b4aca1';
const STONE_DARK = '#7c746b';
const PALE_STONE = '#d6d0c6';
const SIGN_WOOD = '#c08a4e';
const MOSS = '#6b8e23';
const ROPE = '#d6b98c';
const RED = '#b91c1c';
const CANVAS = '#fef3c7';
const IRON = '#475569';
const LAMP = '#ffe9a8';
const SKIN = '#f2c7a2';
const EMBER = '#f97316';
const GOLD = '#f59e0b';

const flat = (part: TokenPart): TokenPart => ({ ...part, ink: false });

// --- Which matches have a square ---------------------------------------------

type SquareConfig = GameConfig;

/**
 * The match's village square layout, where the engine has one
 * (getActiveVillageSquare): every campaign mission (mode 'solo', online co-op
 * included) played on its village's own campaign map. Null elsewhere (arenas,
 * training, a test's small board).
 */
export function activeSquareLayout(config: SquareConfig): VillageSquareLayout | null {
  if (!getActiveVillageSquare(config) || !config.stageId) return null;
  return CAMPAIGN_STAGE_LAYOUTS[config.stageId].square;
}

/**
 * The cells no blast enters (engine squareBlastStop): the square's bounds, or
 * undefined without a square. Stable per config, so it can sit in memo props.
 */
export function squareBlastStop(
  config: SquareConfig
): ((x: number, y: number) => boolean) | undefined {
  return engineSquareBlastStop({ config });
}

// --- Fixed props -------------------------------------------------------------

const LEAN_EULER = new THREE.Euler();
const LEAN_TURN = new THREE.Quaternion();
const LEAN_OWN = new THREE.Quaternion();
const LEAN_AT = new THREE.Vector3();

/** `parts` tipped back by `angle` about a sideways axis at height `pivot`. */
function leanBack(parts: TokenPart[], angle: number, pivot: number): TokenPart[] {
  LEAN_TURN.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -angle);
  return parts.map((part) => {
    LEAN_AT.set(...(part.at ?? [0, 0, 0])).setY((part.at?.[1] ?? 0) - pivot)
      .applyQuaternion(LEAN_TURN);
    LEAN_EULER.set(...(part.rotate ?? [0, 0, 0]));
    LEAN_OWN.setFromEuler(LEAN_EULER).premultiply(LEAN_TURN);
    LEAN_EULER.setFromQuaternion(LEAN_OWN);
    return {
      ...part,
      at: [LEAN_AT.x, LEAN_AT.y + pivot, LEAN_AT.z],
      rotate: [LEAN_EULER.x, LEAN_EULER.y, LEAN_EULER.z],
    };
  });
}

/**
 * The request board: a roofed plank panel with papers pinned to it, tipped
 * back on its posts so the papers face the camera.
 */
function boardParts(): TokenPart[] {
  const papers: [number, number, number, string][] = [
    [-0.21, 0.76, 0.07, PAPER], [0.03, 0.8, -0.05, PAPER_WARM], [0.24, 0.72, 0.09, PAPER],
  ];
  const panel = leanBack([
    p(box(0.76, 0.5, 0.06), WOOD, [0, 0.74, 0]),
    p(box(0.86, 0.06, 0.1), DARK_WOOD, [0, 1.01, 0]),
    p(box(0.86, 0.05, 0.1), DARK_WOOD, [0, 0.47, 0]),
    ...papers.flatMap(([x, y, tilt, color]) => [
      flat(p(box(0.19, 0.23, 0.012), color, [x, y, 0.037], [0, 0, tilt])),
      flat(p(box(0.12, 0.016, 0.006), STONE_DARK, [x, y + 0.03, 0.045], [0, 0, tilt])),
      flat(p(box(0.1, 0.016, 0.006), STONE_DARK, [x, y - 0.02, 0.045], [0, 0, tilt])),
      flat(p(ball(0.024, 5, 4), RED, [x, y + 0.1, 0.05])),
    ]),
  ], 0.45, 0.45);
  return [
    p(box(0.08, 0.9, 0.08), DARK_WOOD, [-0.4, 0.45, 0]),
    p(box(0.08, 0.9, 0.08), DARK_WOOD, [0.4, 0.45, 0]),
    ...panel,
    // A shallow plank roof over the panel's top edge.
    p(box(0.96, 0.04, 0.26), '#7c2d12', [0, 1.0, -0.2], [-0.25, 0, 0]),
  ];
}

/** Pell's painted cart: a wheeled bed of wares under a striped awning. */
function stallParts(): TokenPart[] {
  const stripes = [-0.36, -0.18, 0, 0.18, 0.36].map((x, index) => (
    p(box(0.18, 0.025, 0.6), index % 2 ? CANVAS : RED, [x, 1.1, 0.02], [0.32, 0, 0])
  ));
  return [
    p(box(0.86, 0.2, 0.5), WOOD, [0, 0.36, 0]),
    p(box(0.92, 0.05, 0.56), DARK_WOOD, [0, 0.48, 0]),
    p(cylinder(0.2, 0.2, 0.05, 12), DARK_WOOD, [0, 0.2, 0.28], [HALF_TURN, 0, 0]),
    p(cylinder(0.06, 0.06, 0.07, 6), IRON, [0, 0.2, 0.29], [HALF_TURN, 0, 0]),
    p(cylinder(0.2, 0.2, 0.05, 12), DARK_WOOD, [0, 0.2, -0.28], [HALF_TURN, 0, 0]),
    p(box(0.14, 0.04, 0.04), DARK_WOOD, [-0.5, 0.42, 0.16]),
    p(box(0.14, 0.04, 0.04), DARK_WOOD, [-0.5, 0.42, -0.16]),
    // Awning posts: the back pair stands taller, so the canvas slopes to the front.
    p(box(0.04, 0.72, 0.04), DARK_WOOD, [-0.42, 0.86, -0.22]),
    p(box(0.04, 0.72, 0.04), DARK_WOOD, [0.42, 0.86, -0.22]),
    p(box(0.04, 0.52, 0.04), DARK_WOOD, [-0.42, 0.76, 0.24]),
    p(box(0.04, 0.52, 0.04), DARK_WOOD, [0.42, 0.76, 0.24]),
    ...stripes,
    p(box(0.92, 0.07, 0.02), RED, [0, 0.99, 0.31]),
    // The wares: a ward paper, a powder pouch, a fuse coil, a lodestone, a flask.
    p(box(0.12, 0.16, 0.02), PAPER, [-0.3, 0.6, 0.12], [-0.3, 0, 0]),
    flat(p(box(0.05, 0.05, 0.01), RED, [-0.3, 0.6, 0.135], [-0.3, 0, 0])),
    p(ball(0.07, 8, 6), '#3f3f46', [-0.12, 0.57, 0.08]),
    p(ring(0.06, 0.02, 4, 10), '#a16207', [0.06, 0.53, 0.1], [HALF_TURN, 0, 0]),
    p(gem(0.07), '#64748b', [0.22, 0.57, 0.06]),
    p(cylinder(0.05, 0.06, 0.12, 8), '#dc2626', [0.34, 0.57, -0.05]),
    p(cylinder(0.02, 0.02, 0.05, 6), '#e5e7eb', [0.34, 0.65, -0.05]),
    p(box(0.2, 0.1, 0.14), CANVAS, [0.02, 0.55, -0.14]),
  ];
}

/**
 * The codex shrine: a stone lantern whose lamp glows on every side under a
 * pale six-sided cap, with paper streamers, moss and an offering stone. The
 * paving round it is warmed as if lit (createPavingGeometry), at no cost.
 */
function shrineParts(): TokenPart[] {
  const streamers = [-1, 1].flatMap((side) => [0, 1, 2].map((step) => flat(p(
    box(0.05, 0.06, 0.008),
    PAPER,
    [side * 0.17, 0.66 - step * 0.065, 0.19 + step * 0.004],
    [0, 0, (step % 2 ? -1 : 1) * 0.5]
  ))));
  const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => (
    p(box(0.05, 0.26, 0.05), STONE, [x * 0.13, 0.69, z * 0.13])
  ));
  return [
    p(box(0.58, 0.08, 0.58), STONE_DARK, [0, 0.04, 0]),
    p(cylinder(0.1, 0.15, 0.38, 6), STONE, [0, 0.27, 0]),
    p(cylinder(0.22, 0.2, 0.07, 6), STONE, [0, 0.5, 0]),
    p(box(0.2, 0.22, 0.2), LAMP, [0, 0.67, 0]),
    ...posts,
    p(cone(0.27, 0.17, 6), PALE_STONE, [0, 0.89, 0]),
    p(cylinder(0.25, 0.25, 0.03, 6), STONE_DARK, [0, 0.81, 0]),
    p(ball(0.05, 6, 5), PALE_STONE, [0, 1.0, 0]),
    p(cone(0.035, 0.08, 6), STONE_DARK, [0, 1.07, 0]),
    ...streamers,
    p(dome(0.07, 6), MOSS, [-0.22, 0.08, 0.2]),
    p(dome(0.05, 6), MOSS, [0.2, 0.08, -0.2]),
    p(rock(0.07), STONE, [0.24, 0.12, 0.22]),
  ];
}

/** The village gate's signpost: arrows to the ways out, a lamp and a gate banner. */
function gateParts(): TokenPart[] {
  return [
    p(box(0.09, 1.0, 0.09), DARK_WOOD, [0, 0.5, 0]),
    // East arrow: plank, point and a painted stroke.
    p(box(0.46, 0.13, 0.04), SIGN_WOOD, [0.2, 0.86, 0.06]),
    p(box(0.1, 0.1, 0.04), SIGN_WOOD, [0.43, 0.86, 0.06], [0, 0, Math.PI / 4]),
    flat(p(box(0.26, 0.03, 0.005), INK, [0.17, 0.86, 0.083])),
    // South arrow, toward the camera, a little lower.
    p(box(0.04, 0.13, 0.42), SIGN_WOOD, [0.06, 0.66, 0.18]),
    p(box(0.04, 0.1, 0.1), SIGN_WOOD, [0.06, 0.66, 0.39], [Math.PI / 4, 0, 0]),
    flat(p(box(0.005, 0.03, 0.24), INK, [0.083, 0.66, 0.16])),
    // A paper lamp on top.
    p(cylinder(0.08, 0.08, 0.14, 8), LAMP, [0, 1.1, 0]),
    p(cone(0.07, 0.06, 8), DARK_WOOD, [0, 1.2, 0]),
    p(cylinder(0.09, 0.09, 0.025, 8), RED, [0, 1.02, 0]),
    p(ring(0.07, 0.016, 4, 10), ROPE, [0, 0.52, 0], [HALF_TURN, 0, 0]),
    flat(p(box(0.14, 0.3, 0.012), RED, [-0.07, 0.5, 0.06], [0, 0.15, 0.04])),
    flat(p(box(0.07, 0.07, 0.006), GOLD, [-0.07, 0.56, 0.068], [0, 0.15, Math.PI / 4])),
    p(rock(0.1), STONE, [0.1, 0.06, 0.08]),
    p(rock(0.08), STONE_DARK, [-0.09, 0.05, -0.07]),
  ];
}

const FIXED_PROP_PARTS: Partial<Record<VillageInteractableKind, () => TokenPart[]>> = {
  board: boardParts,
  shop: stallParts,
  shrine: shrineParts,
  gate: gateParts,
};

/** Prop yaw: everything faces the camera, but a prop on the west edge turns east. */
export function propYaw(item: Pick<VillageInteractable, 'x'>, square: VillageSquareLayout): number {
  return item.x === square.bounds.x0 ? HALF_TURN : 0;
}

const PLACE = new THREE.Matrix4();
const PLACE_EULER = new THREE.Euler();
const PLACE_QUATERNION = new THREE.Quaternion();
const PLACE_POSITION = new THREE.Vector3();
const PLACE_SCALE = new THREE.Vector3();
const PART_EULER = new THREE.Euler();
const PART_QUATERNION = new THREE.Quaternion();

/** `parts` moved to world cell (x, y) and turned by `yaw` (baked into each part). */
function placeParts(parts: TokenPart[], x: number, y: number, yaw: number): TokenPart[] {
  const [wx, , wz] = toWorld(x, y);
  PLACE_EULER.set(0, yaw, 0);
  PLACE_QUATERNION.setFromEuler(PLACE_EULER);
  PLACE.compose(PLACE_POSITION.set(wx, 0, wz), PLACE_QUATERNION, PLACE_SCALE.set(1, 1, 1));
  return parts.map((part) => {
    // The part's own transform goes into its geometry; then the placement.
    const geometry = part.geometry.clone();
    part.geometry.dispose();
    PART_EULER.set(...(part.rotate ?? [0, 0, 0]));
    PART_QUATERNION.setFromEuler(PART_EULER);
    const own = new THREE.Matrix4().compose(
      new THREE.Vector3(...(part.at ?? [0, 0, 0])),
      PART_QUATERNION,
      new THREE.Vector3(...(part.scale ?? [1, 1, 1]))
    );
    geometry.applyMatrix4(own).applyMatrix4(PLACE);
    return {
      geometry, color: part.color, ink: part.ink,
    };
  });
}

const FIXED_PROPS = new Map<string, InkedToken | null>();

/**
 * The square's fixed props that `present` lists (stall, board, shrine,
 * gate), merged in world space into one body and one ink hull: two draw
 * calls whatever the tier. Villagers are left out; they turn to face you.
 * Cached per layout and prop list, for the session.
 */
export function fixedPropsToken(
  square: VillageSquareLayout,
  present: readonly VillageInteractable[]
): InkedToken | null {
  const fixed = present.filter((item) => FIXED_PROP_PARTS[item.kind]);
  const key = fixed.map((item) => `${item.kind}@${item.x},${item.y}`).join('|');
  if (FIXED_PROPS.has(key)) return FIXED_PROPS.get(key) ?? null;
  const parts = fixed.flatMap((item) => placeParts(
    FIXED_PROP_PARTS[item.kind]?.() ?? [],
    item.x,
    item.y,
    propYaw(item, square)
  ));
  const token = parts.length ? buildInkedToken(parts) : null;
  FIXED_PROPS.set(key, token);
  return token;
}

// --- Villagers ---------------------------------------------------------------

type Headwear = 'hair' | 'headscarf' | 'cap' | 'straw';
type Carry = 'none' | 'staff' | 'basket' | 'pack' | 'apron';

export type VillagerLook = {
  robe: string;
  sash: string;
  hair: string;
  headwear: Headwear;
  headwearColor: string;
  carry: Carry;
};

const ROBES = ['#5b7fa6', '#8a5a44', '#6e8b5a', '#9b6b9e', '#c08a3e', '#4f7b78', '#a3564a'];
const SASHES = ['#e9dcc0', '#b45309', '#1f2937', '#f2b544', '#7c2d12'];
const HAIRS = ['#3f2a1d', '#1f1a17', '#8a8178', '#6b3f22', '#c9b48a'];
const HEADWEAR: Headwear[] = ['hair', 'headscarf', 'cap', 'hair'];
const CARRY: Carry[] = ['none', 'basket', 'apron', 'staff', 'none'];

/** A stable number from an id (no randomness: every visit looks the same). */
function hashId(id: string): number {
  let hash = 17;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 131 + id.charCodeAt(index) * 7919) % 2147483629;
  }
  return hash;
}

/** One base-7 digit of `hash`, as an index into a list of `size`. */
function digit(hash: number, place: number, size: number): number {
  return Math.floor(hash / 7 ** place) % size;
}

/**
 * Each villager's look, fixed by their id so they look the same in every
 * village and every visit. Tamsin, the Road Teller, travels: straw hat,
 * walking staff and pack.
 */
export function villagerLook(villagerId: string): VillagerLook {
  if (villagerId === WANDERING_VILLAGER.id) {
    return {
      robe: '#7a6a4f', sash: '#b45309', hair: '#3f2a1d', headwear: 'straw', headwearColor: '#d9b56c', carry: 'pack',
    };
  }
  const hash = hashId(villagerId);
  const pick = <T>(list: readonly T[], place: number) => list[digit(hash, place, list.length)];
  return {
    robe: pick(ROBES, 0),
    sash: pick(SASHES, 1),
    hair: pick(HAIRS, 2),
    headwear: pick(HEADWEAR, 3),
    headwearColor: pick(SASHES, 4),
    carry: pick(CARRY, 5),
  };
}

function villagerParts(look: VillagerLook): TokenPart[] {
  const parts: TokenPart[] = [
    p(cone(0.21, 0.52, 8), look.robe, [0, 0.27, 0]),
    p(cylinder(0.105, 0.115, 0.05, 8), look.sash, [0, 0.33, 0]),
    p(ball(0.125, 8, 6), SKIN, [0, 0.62, 0]),
    flat(p(box(0.025, 0.025, 0.02), INK, [-0.042, 0.62, 0.118])),
    flat(p(box(0.025, 0.025, 0.02), INK, [0.042, 0.62, 0.118])),
    p(box(0.06, 0.24, 0.06), look.robe, [0.14, 0.4, 0.03], [0, 0, -0.22]),
    p(box(0.06, 0.24, 0.06), look.robe, [-0.14, 0.4, 0.03], [0, 0, 0.22]),
  ];
  switch (look.headwear) {
    case 'straw':
      parts.push(
        p(dome(0.13, 8), look.hair, [0, 0.635, -0.01], [-0.35, 0, 0]),
        p(cone(0.27, 0.12, 12), look.headwearColor, [0, 0.79, 0]),
        flat(p(cylinder(0.11, 0.12, 0.025, 10), '#7c2d12', [0, 0.745, 0]))
      );
      break;
    case 'headscarf':
      parts.push(
        p(dome(0.135, 8), look.headwearColor, [0, 0.635, -0.01], [-0.3, 0, 0]),
        p(ball(0.045, 5, 4), look.headwearColor, [0, 0.66, -0.13])
      );
      break;
    case 'cap':
      parts.push(
        p(dome(0.13, 8), look.hair, [0, 0.63, -0.012], [-0.35, 0, 0]),
        p(cylinder(0.1, 0.12, 0.07, 8), look.headwearColor, [0, 0.75, 0])
      );
      break;
    default:
      parts.push(
        p(dome(0.13, 8), look.hair, [0, 0.635, -0.012], [-0.35, 0, 0]),
        p(ball(0.05, 5, 4), look.hair, [0, 0.74, -0.06])
      );
  }
  switch (look.carry) {
    case 'staff':
      parts.push(
        p(cylinder(0.018, 0.018, 0.86, 5), WOOD, [0.21, 0.43, 0.05]),
        flat(p(ring(0.035, 0.01, 3, 8), GOLD, [0.21, 0.87, 0.05]))
      );
      break;
    case 'pack':
      parts.push(
        p(cylinder(0.018, 0.018, 0.9, 5), WOOD, [0.22, 0.45, 0.05]),
        p(box(0.2, 0.22, 0.11), '#7c5a3a', [0, 0.45, -0.15]),
        p(cylinder(0.05, 0.05, 0.2, 6), '#5b7fa6', [0, 0.59, -0.16], [0, 0, HALF_TURN])
      );
      break;
    case 'basket':
      parts.push(p(cylinder(0.09, 0.07, 0.09, 8), '#c8a165', [-0.2, 0.3, 0.06]));
      break;
    case 'apron':
      parts.push(flat(p(box(0.18, 0.2, 0.012), CANVAS, [0, 0.22, 0.12], [-0.38, 0, 0])));
      break;
    default:
      break;
  }
  return parts;
}

const VILLAGERS = new Map<string, InkedToken>();

/** Villagers stand a little taller than the hub tokens, near a fighter's height. */
export const VILLAGER_SCALE = 1.3;

/** `parts` scaled about the origin, baked in so the ink keeps its width. */
function grown(factor: number, parts: TokenPart[]): TokenPart[] {
  const grow = (v: number) => v * factor;
  return parts.map((part) => ({
    ...part,
    at: (part.at ?? [0, 0, 0]).map(grow) as [number, number, number],
    scale: (part.scale ?? [1, 1, 1]).map(grow) as [number, number, number],
  }));
}

/**
 * One shared inked figure per villager id, for the session. The scale is
 * baked into the parts, so the ink line keeps the fighters' width.
 */
export function villagerToken(villagerId: string): InkedToken {
  let token = VILLAGERS.get(villagerId);
  if (!token) {
    token = buildInkedToken(grown(VILLAGER_SCALE, villagerParts(villagerLook(villagerId))));
    VILLAGERS.set(villagerId, token);
  }
  return token;
}

// --- Paving --------------------------------------------------------------------

const PAVING_STONES = ['#d8d0c2', '#cec5b5', '#e2dbcf', '#c6bcab'];
const PAVING_TINT = new THREE.Color();
const PAVING_MIX = new THREE.Color();
export const PAVING_TOP = 0.026;
const PAVING_SIDE_TONE = 0.72;
const LAMP_GLOW = new THREE.Color('#ffd27a');
const LAMP_REACH = 1.7;
// A stone's top and its four sides (nothing ever sees under the paving), as
// [normal, four corners] with corners as signs of (half width, height, half depth).
const STONE_FACES: [[number, number, number], [number, number, number][]][] = [
  [[0, 1, 0], [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [[0, 0, 1], [[-1, 0, 1], [1, 0, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, 0, -1], [-1, 0, -1], [-1, 1, -1], [1, 1, -1]]],
  [[1, 0, 0], [[1, 0, 1], [1, 0, -1], [1, 1, -1], [1, 1, 1]]],
  [[-1, 0, 0], [[-1, 0, -1], [-1, 0, 1], [-1, 1, 1], [-1, 1, -1]]],
];
const STONE_VERTICES = STONE_FACES.length * 6;
type Stone = [number, number, number, number, number];

/** The stones of one cell, [centre x, centre z, width, depth, tone index]. */
function cellStones(x: number, y: number): Stone[] {
  const hash = hashId(`${x},${y}`);
  const tone = (place: number) => digit(hash, place, PAVING_STONES.length);
  switch (hash % 5) {
    case 0:
      return [[-0.24, 0, 0.44, 0.92, tone(1)], [0.24, 0, 0.44, 0.92, tone(2)]];
    case 1:
      return [[0, -0.24, 0.92, 0.44, tone(1)], [0, 0.24, 0.92, 0.44, tone(2)]];
    case 2:
      return [
        [-0.24, -0.24, 0.44, 0.44, tone(1)], [0.24, -0.24, 0.44, 0.44, tone(2)],
        [-0.24, 0.24, 0.44, 0.44, tone(3)], [0.24, 0.24, 0.44, 0.44, tone(4)],
      ];
    default:
      return [[0, 0, 0.92, 0.92, tone(1)]];
  }
}

/**
 * Flagstones over every open cell of the square: each cell is one, two or
 * four stones (fixed by the cell, so every visit looks the same), lightly
 * toned toward the stage's ground. One vertex-coloured mesh, written
 * straight into its buffers.
 */
export function createPavingGeometry(
  square: VillageSquareLayout,
  isOpen: (x: number, y: number) => boolean,
  groundTint: string,
  lamps: readonly { x: number; y: number }[] = []
): THREE.BufferGeometry | null {
  const {
    x0, y0, x1, y1
  } = square.bounds;
  const stones: { stone: Stone; x: number; y: number }[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (isOpen(x, y)) cellStones(x, y).forEach((stone) => stones.push({ stone, x, y }));
    }
  }
  if (!stones.length) return null;
  PAVING_TINT.set(groundTint);
  const count = stones.length * STONE_VERTICES;
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let vertex = 0;
  stones.forEach(({ stone: [cx, cz, w, d, tone], x, y }) => {
    const [wx, , wz] = toWorld(x, y);
    PAVING_MIX.set(PAVING_STONES[tone]).lerp(PAVING_TINT, 0.22);
    // Lamplight: stones near a lit lantern warm toward its glow.
    lamps.forEach((lamp) => {
      const reach = 1 - Math.hypot(x + cx - lamp.x, y + cz - lamp.y) / LAMP_REACH;
      if (reach > 0) PAVING_MIX.lerp(LAMP_GLOW, reach * 0.5);
    });
    STONE_FACES.forEach(([normal, corners]) => {
      const shade = normal[1] > 0 ? 1 : PAVING_SIDE_TONE;
      [0, 1, 2, 0, 2, 3].forEach((corner) => {
        const [sx, sy, sz] = corners[corner];
        const at = vertex * 3;
        positions[at] = wx + cx + (sx * w) / 2;
        positions[at + 1] = sy * PAVING_TOP;
        positions[at + 2] = wz + cz + (sz * d) / 2;
        normals.set(normal, at);
        colors[at] = PAVING_MIX.r * shade;
        colors[at + 1] = PAVING_MIX.g * shade;
        colors[at + 2] = PAVING_MIX.b * shade;
        vertex += 1;
      });
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

// --- Request marks -------------------------------------------------------------

/** Built on first use and kept for the session (arena matches never build it). */
function lazy<T>(build: () => T): () => T {
  let value: T | undefined;
  return () => {
    if (value === undefined) value = build();
    return value;
  };
}

const KEEPSAKE_SCALE = 1.35;

/** A keepsake from a request: a cloth bundle tied with a cord, with a tag. */
export const keepsakeToken = lazy((): InkedToken => buildInkedToken(grown(KEEPSAKE_SCALE, [
  p(ball(0.13, 8, 6), '#e0c48a', [0, 0, 0], undefined, [1, 0.82, 1]),
  p(ball(0.05, 6, 4), '#b45309', [0, 0.1, 0]),
  p(cone(0.04, 0.09, 5), '#e0c48a', [-0.045, 0.16, 0], [0, 0, 0.5]),
  p(cone(0.04, 0.09, 5), '#e0c48a', [0.045, 0.16, 0], [0, 0, -0.5]),
  flat(p(box(0.06, 0.08, 0.008), CANVAS, [0.09, 0.02, 0.1], [0, 0.4, 0.2])),
  flat(p(box(0.03, 0.03, 0.01), RED, [0.09, 0.03, 0.105], [0, 0.4, 0.2])),
])));
/** How high a keepsake floats over its cell, and how far it bobs. */
export const KEEPSAKE_LIFT = 0.36;
export const KEEPSAKE_BOB = 0.05;

function dashedRing(
  inner: number,
  outer: number,
  dashes: number,
  y: number
): THREE.BufferGeometry[] {
  const step = (Math.PI * 2) / dashes;
  return Array.from({ length: dashes }, (_, index) => (
    new THREE.RingGeometry(inner, outer, 3, 1, index * step, step * 0.62)
      .rotateX(-HALF_TURN)
      .translate(0, y, 0)
  ));
}

function merged(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  if (!geometry) throw new Error(`Could not build ${name}`);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Chalk on a marked crate: a dashed circle round its foot and a ring on its lid. */
export const chalkMarkGeometry = lazy(() => merged([
  ...dashedRing(0.47, 0.53, 12, 0.02),
  new THREE.RingGeometry(0.16, 0.22, 18).rotateX(-HALF_TURN).translate(0, 0.668, 0),
  ...[1, -1].map((turn) => new THREE.PlaneGeometry(0.05, 0.3)
    .rotateX(-HALF_TURN)
    .rotateY((turn * Math.PI) / 4)
    .translate(0, 0.669, 0)),
], 'chalk mark'));

/** The keepsake's floor ring: solid, so it is not mistaken for crate chalk. */
export const keepsakeRingGeometry = lazy(() => merged([
  new THREE.RingGeometry(0.3, 0.42, 20).rotateX(-HALF_TURN).translate(0, 0.02, 0),
], 'keepsake ring'));

export type VillageMarks = {
  keepsakes: { x: number; y: number }[];
  crates: { x: number; y: number }[];
};

const NO_MARKS: VillageMarks = { keepsakes: [], crates: [] };

const MARK_KINDS: Partial<Record<CampaignRequestKind, keyof VillageMarks>> = {
  collectMarked: 'keepsakes',
  breakMarked: 'crates',
};

/**
 * The marked cells of the requests accepted this mission, by look: keepsakes
 * still lying in the map, and marked crates still standing. A request the
 * catalogue does not know draws nothing.
 */
export function villageMarks(campaign: CampaignRuntimeState | null | undefined): VillageMarks {
  const requests = campaign?.village?.requests;
  if (!campaign || !requests?.length) return NO_MARKS;
  const catalogue = VILLAGE_REQUESTS[campaign.stageId] ?? [];
  const marks: VillageMarks = { keepsakes: [], crates: [] };
  requests.forEach((request) => {
    if (request.status !== 'accepted' || !request.cells?.length) return;
    const kind = catalogue.find((definition) => definition.id === request.id)?.kind;
    const into = kind ? MARK_KINDS[kind] : undefined;
    if (!into) return;
    request.cells.forEach((cell) => marks[into].push({ x: cell.x, y: cell.y }));
  });
  return marks.keepsakes.length || marks.crates.length ? marks : NO_MARKS;
}

/**
 * The marks as one string, so the scene re-lays them only when one changes,
 * not whenever the engine hands over a new campaign object.
 */
export function villageMarksKey(marks: VillageMarks): string {
  if (marks === NO_MARKS) return '';
  const cells = (list: { x: number; y: number }[]) => list.map((cell) => `${cell.x},${cell.y}`).join(';');
  return `${cells(marks.keepsakes)}|${cells(marks.crates)}`;
}

export function villageMarksFromKey(key: string): VillageMarks {
  if (!key) return NO_MARKS;
  const cells = (part: string) => (part ? part.split(';') : []).map((cell) => {
    const [x, y] = cell.split(',').map(Number);
    return { x, y };
  });
  const [keepsakes, crates] = key.split('|');
  return { keepsakes: cells(keepsakes), crates: cells(crates) };
}

// --- Prompt ------------------------------------------------------------------------

const PROMPT_EDGES: Record<VillageInteractableKind, string> = {
  villager: '#d97706',
  board: '#a16207',
  shop: '#dc2626',
  shrine: '#7c3aed',
  gate: '#0284c7',
};

/** How high each prop's prompt floats: just over its top. */
export const PROMPT_HEIGHT: Record<VillageInteractableKind, number> = {
  villager: 1.42,
  board: 1.5,
  shop: 1.5,
  shrine: 1.42,
  gate: 1.5,
};

function villagerName(stageId: StageId, villagerId: string | undefined): string {
  if (villagerId === WANDERING_VILLAGER.id) return WANDERING_VILLAGER.name;
  const npc = getHubVillage(stageId).npcs.find((entry) => entry.id === villagerId);
  return npc?.name ?? 'villager';
}

/**
 * What the floating prompt over a prop says, and its edge colour. "[Bomb]"
 * names the button that uses it on every device: in the square the bomb key,
 * pad A and the touch bomb button talk, trade and read instead.
 */
export function promptFor(
  item: VillageInteractable,
  stageId: StageId
): { label: string; color: string } {
  const color = PROMPT_EDGES[item.kind];
  switch (item.kind) {
    case 'villager':
      return { label: `[Bomb] Talk · ${villagerName(stageId, item.villagerId)}`, color };
    case 'board':
      return { label: '[Bomb] Request board', color };
    case 'shop':
      return { label: `[Bomb] ${HUB_MERCHANT.name}'s stall`, color };
    case 'shrine':
      return { label: '[Bomb] Shrine · Codex', color };
    default:
      return { label: '[Bomb] Gate · Head out', color };
  }
}

// --- Honored scarf -------------------------------------------------------------------

/**
 * The ember-thread scarf (Honored standing): a wrap round the fighter's neck,
 * a knot at the back and two tails with gold thread and glowing ember tips.
 * In fighter units, on the figure's own origin (head centre at y 0.32).
 */
export const scarfToken = lazy((): InkedToken => buildInkedToken([
  p(ring(0.19, 0.05, 6, 18), '#b91c1c', [0, 0.13, 0], [HALF_TURN, 0, 0], [1, 1, 0.9]),
  flat(p(ring(0.19, 0.012, 3, 18), GOLD, [0, 0.13, 0], [HALF_TURN, 0, 0], [1.06, 1.06, 1])),
  p(ball(0.06, 6, 5), '#991b1b', [0.05, 0.12, -0.2]),
  p(box(0.09, 0.3, 0.025), '#b91c1c', [0.02, -0.02, -0.25], [0.45, 0, 0.12]),
  p(box(0.08, 0.24, 0.025), '#b91c1c', [0.12, 0.0, -0.24], [0.6, 0, -0.18]),
  flat(p(box(0.092, 0.02, 0.03), GOLD, [0.02, -0.08, -0.28], [0.45, 0, 0.12])),
  flat(p(box(0.082, 0.02, 0.03), GOLD, [0.125, -0.05, -0.28], [0.6, 0, -0.18])),
  flat(p(box(0.08, 0.035, 0.03), EMBER, [0.0, -0.15, -0.32], [0.45, 0, 0.12])),
  flat(p(box(0.07, 0.035, 0.03), EMBER, [0.15, -0.1, -0.31], [0.6, 0, -0.18])),
]));
