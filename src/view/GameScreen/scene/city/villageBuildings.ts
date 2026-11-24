import type { StageId } from '../../../../content/types';
import {
  Cell, GeometryBuilder, Lot, V3, cellId, cutLots, hashString, lathe, pick, seeded, shadeHex,
  wx, wz,
} from './cityGeometry';
import {
  borderSide, cliffCell, cliffEnd, forestCell, palisadeCell,
} from './villageBorder';
import type { CityBuildingGeometry, CrateStyle } from './cityBuildings';

/**
 * A village arena's walls drawn as the village itself, after the stage
 * atlas (src/assets/ninja-bomber-stage-atlas.png): the border ring as forest
 * or rock, the walls inside as houses, round huts and mossy stone blocks.
 * Rendering only, like the city buildings: the grid's `W` cells stay walls,
 * and the same two geometries (mass, detail) draw on the walls' program
 * through scene/city/CityBuildings.tsx, with its cut-away.
 */

type Builders = { mass: GeometryBuilder; detail: GeometryBuilder };

export type VillageBorder = 'forest' | 'rocks' | 'spires' | 'palisade';

/** A village's signature building, after the atlas (up to four stand inside the board). */
export type VillageHero = 'tallHut' | 'domeTower' | 'podiumDome' | 'drums' | 'pagoda';

export interface VillageBuildingStyle {
  /** The border ring: forest, rock outcrops, or a cave's stalagmites. */
  border: VillageBorder;
  /** Houses under a thatched gable, or flat-roofed adobe and stone. */
  houseRoof: 'thatch' | 'flat';
  /** Round huts under a cone of thatch, or a dome. */
  hutRoof: 'cone' | 'dome';
  /** Canopy greens for a forest, rock tones for rocks and spires. */
  borderTones: readonly string[];
  trunk: string;
  /** The border cells' ground: undergrowth or scree. */
  borderGround: string;
  /** The top of a rock border's cliffs: a grass lip, moss or paler stone. */
  cliffTop?: string;
  /** House walls (timber or plaster), picked per house. */
  walls: readonly string[];
  /** Posts, beams and door frames. */
  frame: string;
  /** Roof colours (thatch, shingle), picked per house. */
  roofs: readonly string[];
  window: string;
  /** Stone blocks and their moss caps. */
  stone: string;
  moss: string;
  /** A yard of beaten earth under each building. */
  yard: string;
  /** The open ground away from walls: a dirt path; absent, the palette floor everywhere. */
  path?: string;
  /** How the village's crates look. */
  crate: CrateStyle;
  /** The village's signature building. */
  hero: VillageHero;
}

export const VILLAGE_BUILDING_STYLES: Readonly<Partial<Record<StageId, VillageBuildingStyle>>> = {
  hiddenLeaf: {
    border: 'forest',
    houseRoof: 'thatch',
    hutRoof: 'cone',
    borderTones: ['#2f5d2a', '#3a6b2f', '#2b5326', '#447833'],
    trunk: '#5b3d26',
    borderGround: '#2c4a26',
    walls: ['#6e4a2c', '#654328', '#77502f'],
    frame: '#3e2817',
    roofs: ['#9a7a45', '#9c7c4c', '#8f7444'],
    window: '#2a1f18',
    stone: '#7d8078',
    moss: '#6a8a3e',
    yard: '#c7b48f',
    path: '#d3bf98',
    crate: 'logs',
    hero: 'tallHut',
  },
  // Colours fitted to each village's floor and today's wall, like the cities'
  // (villageBuildings.test.ts): every surface stands off the floor at least
  // as well as the wall did, and as far from flame orange.
  hiddenSand: {
    border: 'rocks',
    houseRoof: 'flat',
    hutRoof: 'dome',
    borderTones: ['#9c7448', '#8e6a42', '#a67c4e'],
    trunk: '#6b4a2c',
    borderGround: '#c9a77a',
    cliffTop: '#a87e52',
    walls: ['#a87e52', '#a3744a', '#ab8154'],
    frame: '#6b4a2c',
    roofs: ['#a7835c', '#a68257'],
    window: '#3a2a1c',
    stone: '#9c7448',
    moss: '#8e6a42',
    yard: '#d9b98c',
    crate: 'jars',
    hero: 'domeTower',
  },
  hiddenMist: {
    border: 'rocks',
    houseRoof: 'flat',
    hutRoof: 'dome',
    borderTones: ['#4f6470', '#5a6f7c', '#55657a'],
    trunk: '#3e4a52',
    borderGround: '#4a6a72',
    cliffTop: '#6a8a3e',
    walls: ['#6f7f88', '#62717a', '#76858e'],
    frame: '#3e4a52',
    roofs: ['#3f6f9c', '#4a7aa8'],
    window: '#1f2a33',
    stone: '#62717a',
    moss: '#6a8a3e',
    yard: '#8fa9ae',
    crate: 'crateStack',
    hero: 'podiumDome',
  },
  hiddenCloud: {
    border: 'rocks',
    houseRoof: 'thatch',
    hutRoof: 'dome',
    borderTones: ['#6f7f66', '#7d8f6a', '#848c7f'],
    trunk: '#4f574b',
    borderGround: '#6a8a5a',
    cliffTop: '#5c7a38',
    walls: ['#848c7f', '#7f8a7a', '#828a7d'],
    frame: '#4f574b',
    roofs: ['#5c7a38', '#6a8a3e'],
    window: '#2b3328',
    stone: '#7f8a7a',
    moss: '#5c7a38',
    yard: '#b9c7a8',
    crate: 'barrels',
    hero: 'pagoda',
  },
  hiddenStone: {
    border: 'rocks',
    houseRoof: 'flat',
    hutRoof: 'dome',
    borderTones: ['#7a6550', '#6d5a48', '#8a7560'],
    trunk: '#4f4134',
    borderGround: '#8f8068',
    cliffTop: '#8a7560',
    walls: ['#8a7560', '#93806a', '#9b866d'],
    frame: '#4f4134',
    roofs: ['#6d5a48', '#7a6550'],
    window: '#2e261f',
    stone: '#7a6550',
    moss: '#5f6a5a',
    yard: '#bfb69a',
    crate: 'casks',
    hero: 'drums',
  },
  akatsukiHideout: {
    border: 'spires',
    houseRoof: 'flat',
    hutRoof: 'dome',
    borderTones: ['#4a3f4f', '#3f3644', '#5d5162'],
    trunk: '#2c242f',
    borderGround: '#3a3140',
    walls: ['#5d5162', '#6a5c6e', '#5a4a4f'],
    frame: '#2c242f',
    roofs: ['#4a3f4f', '#3f3644'],
    // Lantern-lit openings: the hideout's one warm note, kept off flame orange.
    window: '#7a2f35',
    stone: '#5d5162',
    moss: '#4a3f4f',
    yard: '#8f7d92',
    crate: 'crateStack',
    hero: 'drums',
  },
  // The war front's camp: a stake palisade, canvas tents and supply crates.
  greatShinobiWar: {
    border: 'palisade',
    houseRoof: 'thatch',
    hutRoof: 'cone',
    borderTones: ['#5d4a3a', '#6b5644', '#54463a'],
    trunk: '#3f342b',
    borderGround: '#6f6a66',
    walls: ['#5f5a4e', '#6a6456', '#57534a'],
    frame: '#3a332b',
    roofs: ['#77705d', '#79705d', '#6f6a58'],
    window: '#2a2622',
    stone: '#5e6266',
    moss: '#4c5a3a',
    yard: '#9b978f',
    crate: 'crateStack',
    hero: 'tallHut',
  },
};

/** Highest tree crown on the border away from the camera. */
export const VILLAGE_TREE_CAP = 2.1;
/** The tallest building inside the board: a village's signature towers. */
export const VILLAGE_BODY_CAP = 1.8;
/** Houses, huts and blocks inside the board. */
export const VILLAGE_HOUSE_CAP = 1.3;
/** The border row nearest the camera: as low as today's walls. */
export const VILLAGE_SOUTH_CAP = 0.94;

const SIDES = 8;

const at = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];

/** A flat quad on a cell's ground, just above the floor tiles. */
function pad(
  builder: GeometryBuilder,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  hex: string
) {
  const y = 0.006;
  builder.quad(at(u0, v0, y), at(u1, v0, y), at(u1, v1, y), at(u0, v1, y), hex, [0, 1, 0], 1);
}

/** A panel on a south face (+z) at `v`: a door, a window, a beam. */
function panel(
  builder: GeometryBuilder,
  v: number,
  u0: number,
  u1: number,
  y0: number,
  y1: number,
  hex: string
) {
  builder.quad(at(u0, v, y0), at(u1, v, y0), at(u1, v, y1), at(u0, v, y1), hex, [0, 0, 1]);
}

/** A low bush for the border row nearest the camera. */
function bush(
  { mass }: Builders,
  cu: number,
  cv: number,
  top: number,
  hex: string,
  rnd: () => number
) {
  const radius = 0.36 + rnd() * 0.08;
  lathe(mass, cu, cv, [
    { r: radius * 0.7, y: 0 },
    { r: radius, y: top * 0.4 },
    { r: radius * 0.75, y: top * 0.8 },
    { r: radius * 0.25, y: top },
  ], hex, rnd() * Math.PI);
}

/** Stalagmites: a tall spire and a shorter one leaning on it. */
function spires(
  { mass }: Builders,
  cu: number,
  cv: number,
  top: number,
  tones: readonly string[],
  rnd: () => number
) {
  const turn = rnd() * Math.PI;
  lathe(mass, cu, cv, [
    { r: 0.36, y: 0 },
    { r: 0.24, y: top * 0.35 },
    { r: 0.11, y: top * 0.75 },
    { r: 0, y: top },
  ], pick(rnd, tones), turn, 6);
  const angle = rnd() * Math.PI * 2;
  const su = cu + Math.cos(angle) * 0.2;
  const sv = cv + Math.sin(angle) * 0.2;
  const low = top * (0.45 + rnd() * 0.2);
  lathe(mass, su, sv, [
    { r: 0.2, y: 0 },
    { r: 0.1, y: low * 0.6 },
    { r: 0, y: low },
  ], shadeHex(pick(rnd, tones), 1.12), turn + 0.5, 6);
}

/** A timber house on a 1x2 or 2x1 lot: posts, a door, windows, a thatched gable. */
function house(
  { mass, detail }: Builders,
  lot: { x: number; y: number; w: number; h: number },
  style: VillageBuildingStyle,
  rnd: () => number
): number {
  const inset = 0.09;
  const u0 = lot.x + inset;
  const u1 = lot.x + lot.w - inset;
  const v0 = lot.y + inset;
  const v1 = lot.y + lot.h - inset;
  const eave = 0.56 + rnd() * 0.08;
  const wall = pick(rnd, style.walls);
  const roof = pick(rnd, style.roofs);
  mass.box(u0, u1, v0, v1, 0, eave, wall, wall);
  // Corner posts and a sill beam, in the frame's dark timber.
  const post = 0.045;
  [[u0, v0], [u1, v0], [u0, v1], [u1, v1]].forEach(([u, v]) => {
    mass.box(u - post, u + post, v - post, v + post, 0, eave + 0.01, style.frame, style.frame);
  });
  const c = at;
  const front = v1 + 0.004;
  const beam = eave * 0.52;
  panel(detail, front, u0, u1, beam - 0.025, beam + 0.025, style.frame);
  // A door on the south front, windows beside it.
  const span = u1 - u0;
  const door = u0 + span * (0.2 + rnd() * 0.5);
  panel(detail, front, door - 0.08, door + 0.08, 0, beam - 0.03, style.window);
  for (let w = u0 + 0.16; w < u1 - 0.12; w += 0.32) {
    if (Math.abs(w - door) >= 0.2) {
      panel(detail, front, w - 0.06, w + 0.06, beam + 0.06, eave - 0.07, style.window);
    }
  }
  if (style.houseRoof === 'flat') {
    // Adobe or stone: a flat roof slab with a low parapet, beam ends under it.
    const roof0 = eave;
    const slab = 0.07;
    const [ra, rb, ta, tb] = [u0 - 0.025, u1 + 0.025, v0 - 0.025, v1 + 0.025];
    mass.box(ra, rb, ta, tb, roof0, roof0 + slab, roof, roof);
    const lip = 0.05;
    const parapet = roof0 + slab + 0.07;
    const base = roof0 + slab;
    mass.box(ra, rb, tb - lip, tb, base, parapet, roof, roof);
    mass.box(ra, rb, ta, ta + lip, base, parapet, roof, roof);
    mass.box(ra, ra + lip, v0, v1, base, parapet, roof, roof);
    mass.box(rb - lip, rb, v0, v1, base, parapet, roof, roof);
    for (let w = u0 + 0.12; w < u1 - 0.06; w += 0.22) {
      const { frame } = style;
      mass.box(w - 0.02, w + 0.02, v1, v1 + 0.06, eave - 0.07, eave - 0.03, frame, frame);
    }
    return parapet;
  }
  // The roof: a gable along the long side, overhanging the walls.
  const over = 0.07;
  const rise = 0.42 + rnd() * 0.08;
  const ridge = eave + rise;
  const ra = u0 - over;
  const rb = u1 + over;
  const ta = v0 - over;
  const tb = v1 + over;
  if (lot.w >= lot.h) {
    // Ridge east-west: slopes face north and south; gables east and west.
    const mid = (ta + tb) / 2;
    const top = ridge - 0.04;
    const hiA = c(ra, mid, ridge);
    const hiB = c(rb, mid, ridge);
    mass.quad(c(ra, tb, eave), c(rb, tb, eave), hiB, hiA, roof, [0, 1, 1]);
    mass.quad(c(rb, ta, eave), c(ra, ta, eave), hiA, hiB, roof, [0, 1, -1]);
    [[u0, -1], [u1, 1]].forEach(([u, side]) => {
      mass.tri(c(u, v0, eave), c(u, v1, eave), c(u, (v0 + v1) / 2, top), wall, [side, 0, 0]);
    });
    panel(mass, tb, ra, rb, eave - 0.03, eave, shadeHex(roof, 0.7));
    // Thatch courses across both slopes.
    const band = shadeHex(roof, 0.8);
    [[tb, 1], [ta, -1]].forEach(([edge, side]) => {
      [0.3, 0.62].forEach((t) => {
        const v = (k: number) => edge + (mid - edge) * k;
        const y = (k: number) => eave + rise * k + 0.006;
        const q0 = c(ra, v(t), y(t));
        const q1 = c(rb, v(t), y(t));
        const t1 = t + 0.07;
        mass.quad(q0, q1, c(rb, v(t1), y(t1)), c(ra, v(t1), y(t1)), band, [0, 1, side]);
      });
    });
  } else {
    // Ridge north-south: slopes face east and west; the gable faces the camera.
    const mid = (ra + rb) / 2;
    const top = ridge - 0.04;
    const hiN = c(mid, ta, ridge);
    const hiS = c(mid, tb, ridge);
    mass.quad(c(rb, tb, eave), c(rb, ta, eave), hiN, hiS, roof, [1, 1, 0]);
    mass.quad(c(ra, ta, eave), c(ra, tb, eave), hiS, hiN, roof, [-1, 1, 0]);
    [[v0, -1], [v1, 1]].forEach(([v, side]) => {
      mass.tri(c(u0, v, eave), c(u1, v, eave), c((u0 + u1) / 2, v, top), wall, [0, 0, side]);
    });
    const band = shadeHex(roof, 0.8);
    [[rb, 1], [ra, -1]].forEach(([edge, side]) => {
      [0.3, 0.62].forEach((t) => {
        const u = (k: number) => edge + (mid - edge) * k;
        const y = (k: number) => eave + rise * k + 0.006;
        const t1 = t + 0.07;
        const q0 = c(u(t), ta, y(t));
        const q1 = c(u(t), tb, y(t));
        mass.quad(q0, q1, c(u(t1), tb, y(t1)), c(u(t1), ta, y(t1)), band, [side, 1, 0]);
      });
    });
    // The thatch's edge over the gable the camera sees.
    const edge = shadeHex(roof, 0.7);
    const lift = (u: number, y: number) => c(u, tb + 0.001, y + 0.03);
    mass.quad(c(ra, tb, eave), hiS, lift(mid, ridge), lift(ra, eave), edge, [0, 0, 1]);
    mass.quad(hiS, c(rb, tb, eave), lift(rb, eave), lift(mid, ridge), edge, [0, 0, 1]);
  }
  return ridge + 0.03;
}

/** A round hut on one cell: a timber drum under a conical thatch with a finial. */
function hut(
  { mass, detail }: Builders,
  cell: Cell,
  style: VillageBuildingStyle,
  rnd: () => number
): number {
  const cu = cell.x + 0.5;
  const cv = cell.y + 0.5;
  const radius = 0.34;
  const eave = 0.5 + rnd() * 0.06;
  const wall = pick(rnd, style.walls);
  const roof = pick(rnd, style.roofs);
  lathe(mass, cu, cv, [{ r: radius, y: 0 }, { r: radius, y: eave }], wall, Math.PI / SIDES);
  let apex: number;
  if (style.hutRoof === 'dome') {
    // A dome on a moulded ring.
    const dome = 0.37;
    lathe(mass, cu, cv, [
      { r: 0.4, y: eave },
      { r: 0.4, y: eave + 0.05 },
    ], shadeHex(roof, 0.85), Math.PI / SIDES);
    const rings = [0, 0.35, 0.7, 1.05, 1.4].map((angle) => ({
      r: dome * Math.cos(angle), y: eave + 0.05 + dome * Math.sin(angle),
    }));
    lathe(mass, cu, cv, rings, roof, Math.PI / SIDES);
    apex = eave + 0.05 + dome;
  } else {
    apex = eave + 0.55;
    lathe(mass, cu, cv, [
      { r: 0.46, y: eave - 0.06 },
      { r: 0.44, y: eave - 0.02 },
      { r: 0.2, y: eave + 0.32 },
      { r: 0, y: apex },
    ], roof, Math.PI / SIDES);
    // A darker thatch course a third of the way up the cone.
    lathe(mass, cu, cv, [
      { r: 0.355, y: eave + 0.1 },
      { r: 0.32, y: eave + 0.15 },
    ], shadeHex(roof, 0.8), Math.PI / SIDES);
  }
  const finial = 0.025;
  const { frame } = style;
  const [fu0, fu1, fv0, fv1] = [cu - finial, cu + finial, cv - finial, cv + finial];
  mass.box(fu0, fu1, fv0, fv1, apex - 0.05, apex + 0.1, frame, frame);
  panel(detail, cv + radius + 0.004, cu - 0.08, cu + 0.08, 0, eave * 0.62, style.window);
  return apex + 0.1;
}

/** A mossy stone block on one cell, like the atlas's standing stones. */
function stoneBlock(
  { mass, detail }: Builders,
  cell: Cell,
  style: VillageBuildingStyle,
  rnd: () => number
): number {
  const inset = 0.1;
  const u0 = cell.x + inset;
  const u1 = cell.x + 1 - inset;
  const v0 = cell.y + inset;
  const v1 = cell.y + 1 - inset;
  const top = 0.68 + rnd() * 0.08;
  mass.box(u0, u1, v0, v1, 0, top - 0.08, style.stone, shadeHex(style.stone, 1.1));
  mass.box(u0 - 0.02, u1 + 0.02, v0 - 0.02, v1 + 0.02, top - 0.08, top, style.moss, style.moss);
  // A carved joint across the face the camera sees.
  const front = v1 + 0.004;
  const joint = top * 0.45;
  panel(detail, front, u0, u1, joint - 0.012, joint + 0.012, shadeHex(style.stone, 0.6));
  return top;
}

/**
 * A village's signature building on one cell (after the atlas): Leaf's
 * two-storey round hut, Sand's domed tower with its outside stair, Mist's
 * blue dome on a stone podium, Cloud's two-tier pagoda, or three stacked
 * drums. Up to VILLAGE_BODY_CAP tall; the cut-away sinks it like the rest.
 */
function heroTower(
  { mass, detail }: Builders,
  cell: Cell,
  style: VillageBuildingStyle,
  rnd: () => number
): number {
  const cu = cell.x + 0.5;
  const cv = cell.y + 0.5;
  const wall = pick(rnd, style.walls);
  const roof = pick(rnd, style.roofs);
  const turn = Math.PI / SIDES;
  const dome = (r: number, y: number, hex: string) => {
    const rings = [0, 0.4, 0.8, 1.15, 1.45].map((angle) => ({
      r: r * Math.cos(angle), y: y + r * Math.sin(angle),
    }));
    lathe(mass, cu, cv, rings, hex, turn);
    return y + r;
  };
  const finial = (y0: number, y1: number) => {
    const f = 0.025;
    mass.box(cu - f, cu + f, cv - f, cv + f, y0, y1, style.frame, style.frame);
    return y1;
  };
  const door = (radius: number, top: number) => {
    panel(detail, cv + radius + 0.004, cu - 0.07, cu + 0.07, 0, top, style.window);
  };
  switch (style.hero) {
    case 'tallHut': {
      lathe(mass, cu, cv, [{ r: 0.38, y: 0 }, { r: 0.38, y: 0.72 }], wall, turn);
      lathe(mass, cu, cv, [{ r: 0.45, y: 0.72 }, { r: 0.45, y: 0.78 }], style.frame, turn);
      lathe(mass, cu, cv, [{ r: 0.3, y: 0.78 }, { r: 0.3, y: 1.1 }], wall, turn);
      lathe(mass, cu, cv, [
        { r: 0.46, y: 1.06 }, { r: 0.22, y: 1.42 }, { r: 0, y: 1.68 },
      ], roof, turn);
      lathe(mass, cu, cv, [{ r: 0.355, y: 1.2 }, { r: 0.32, y: 1.25 }], shadeHex(roof, 0.8), turn);
      door(0.38, 0.46);
      return finial(1.6, 1.78);
    }
    case 'domeTower': {
      mass.box(cell.x + 0.08, cell.x + 0.92, cell.y + 0.08, cell.y + 0.92, 0, 0.45, wall, wall);
      // The outside stair up the front of the base.
      const front = cell.y + 0.92 + 0.004;
      const c = (u: number, y: number): V3 => [wx(u), y, wz(front)];
      const { x } = cell;
      const stair = [c(x + 0.14, 0), c(x + 0.34, 0), c(x + 0.86, 0.45), c(x + 0.66, 0.45)] as const;
      detail.quad(stair[0], stair[1], stair[2], stair[3], style.frame, [0, 0, 1]);
      lathe(mass, cu, cv, [{ r: 0.33, y: 0.45 }, { r: 0.33, y: 1.02 }], shadeHex(wall, 1.05), turn);
      panel(detail, cv + 0.334, cu - 0.05, cu + 0.05, 0.6, 0.82, style.window);
      return finial(dome(0.33, 1.02, roof) - 0.02, 1.52);
    }
    case 'podiumDome': {
      const { stone } = style;
      mass.box(cell.x + 0.05, cell.x + 0.95, cell.y + 0.05, cell.y + 0.95, 0, 0.3, stone, stone);
      lathe(mass, cu, cv, [{ r: 0.34, y: 0.3 }, { r: 0.34, y: 1.04 }], wall, turn);
      lathe(mass, cu, cv, [{ r: 0.4, y: 1.04 }, { r: 0.4, y: 1.1 }], style.frame, turn);
      panel(detail, cv + 0.344, cu - 0.12, cu - 0.04, 0.55, 0.85, style.window);
      panel(detail, cv + 0.344, cu + 0.04, cu + 0.12, 0.55, 0.85, style.window);
      return finial(dome(0.37, 1.1, roof) - 0.02, 1.75);
    }
    case 'pagoda': {
      mass.box(cell.x + 0.12, cell.x + 0.88, cell.y + 0.12, cell.y + 0.88, 0, 0.5, wall, wall);
      lathe(mass, cu, cv, [{ r: 0.64, y: 0.5 }, { r: 0.34, y: 0.74 }], roof, Math.PI / 4, 4);
      mass.box(cu - 0.22, cu + 0.22, cv - 0.22, cv + 0.22, 0.74, 1.06, wall, wall);
      lathe(mass, cu, cv, [{ r: 0.52, y: 1.06 }, { r: 0, y: 1.5 }], roof, Math.PI / 4, 4);
      door(0.38, 0.36);
      return finial(1.45, 1.68);
    }
    default: {
      // Three stacked drums, narrowing.
      [[0.42, 0, 0.55], [0.34, 0.55, 1.05], [0.25, 1.05, 1.48]].forEach(([r, y0, y1], tier) => {
        const tone = tier % 2 ? shadeHex(wall, 1.08) : wall;
        lathe(mass, cu, cv, [{ r, y: y0 }, { r, y: y1 }], tone, turn);
        lathe(mass, cu, cv, [{ r: r + 0.03, y: y1 - 0.04 }, { r: r + 0.03, y: y1 }], roof, turn);
        panel(detail, cv + r + 0.004, cu - 0.05, cu + 0.05, y0 + 0.15, y0 + 0.32, style.window);
      });
      return 1.48;
    }
  }
}

/**
 * Merged village scenery for a village arena's synthetic mask: `e` cells
 * (the border ring) as forest or rock, `b` cells (walls inside) cut into
 * lots of houses, round huts and stone blocks.
 */
export function buildVillageBuildings(
  rows: readonly string[],
  style: VillageBuildingStyle,
  seedText: string
): CityBuildingGeometry {
  const builders: Builders = { mass: new GeometryBuilder(), detail: new GeometryBuilder() };
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  // One object per tree or rock, and per house, hut or block, for the fog.
  const ownerCells: number[][] = [[]];
  const own = (cells: readonly Cell[]) => {
    ownerCells.push(cells.map(({ x, y }) => y * width + x));
    builders.mass.owner = ownerCells.length - 1;
    builders.detail.owner = ownerCells.length - 1;
  };
  const classAt = (x: number, y: number) => rows[y]?.[x] ?? '.';
  let bodyTop = 0;
  let southRowTop = 0;
  let featureTop = 0;
  let blocks = 0;
  let cells = 0;

  // The border ring.
  rows.forEach((row, y) => Array.from(row).forEach((cls, x) => {
    if (cls !== 'e') return;
    cells += 1;
    const rnd = seeded(hashString(`${seedText}|edge|${x},${y}`));
    own([{ x, y }]);
    pad(builders.mass, x, x + 1, y, y + 1, style.borderGround);
    const south = y === height - 1;
    const side = borderSide(x, y, width, height);
    let top: number;
    if (style.border === 'rocks') {
      top = cliffCell(builders, x, y, side, style, seedText);
      // A side run's last cell closes the cliff where the low south row begins.
      if ((side === 'west' || side === 'east') && y === height - 2) {
        cliffEnd(builders, x, y, side, style, seedText);
      }
    } else if (style.border === 'forest' && !south) {
      top = forestCell(builders, x, y, side, width, height, style, rnd);
    } else if (style.border === 'palisade') {
      top = palisadeCell(builders, x, y, side, style, rnd);
    } else {
      const cu = x + 0.5 + (rnd() - 0.5) * 0.12;
      const cv = y + 0.5 + (rnd() - 0.5) * 0.12;
      top = south
        ? 0.62 + rnd() * (VILLAGE_SOUTH_CAP - 0.66)
        : 1.45 + rnd() * (VILLAGE_TREE_CAP - 1.45);
      if (style.border === 'forest') bush(builders, cu, cv, top, pick(rnd, style.borderTones), rnd);
      else spires(builders, cu, cv, top, style.borderTones, rnd);
    }
    if (south) southRowTop = Math.max(southRowTop, top);
    featureTop = Math.max(featureTop, top);
  }));

  // Walls inside: each 4-connected group cut into lots, drawn once all are cut.
  const seen = new Set<number>();
  const pending: { lot: Lot; rnd: () => number }[] = [];
  rows.forEach((row, y0) => Array.from(row).forEach((cls, x0) => {
    if (cls !== 'b' || seen.has(cellId(x0, y0))) return;
    const group: Cell[] = [];
    const stack: Cell[] = [{ x: x0, y: y0 }];
    seen.add(cellId(x0, y0));
    while (stack.length) {
      const cell = stack.pop() as Cell;
      group.push(cell);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        if (classAt(nx, ny) === 'b' && !seen.has(cellId(nx, ny))) {
          seen.add(cellId(nx, ny));
          stack.push({ x: nx, y: ny });
        }
      });
    }
    blocks += 1;
    cells += group.length;
    const rnd = seeded(hashString(`${seedText}|${x0},${y0}`));
    cutLots(group, 2, 2, rnd).forEach((lot) => pending.push({ lot, rnd }));
  }));
  // The village's signature buildings: the lots nearest each quarter of the board.
  const heroes = new Set<number>();
  [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].forEach(([fx, fy]) => {
    const ax = width * fx;
    const ay = height * fy;
    let best = -1;
    let bestDistance = Math.min(width, height) * 0.2;
    pending.forEach(({ lot }, index) => {
      if (heroes.has(index) || lot.cells.length > 2) return;
      const distance = Math.hypot(lot.x + lot.w / 2 - ax, lot.y + lot.h / 2 - ay);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    if (best >= 0) heroes.add(best);
  });
  pending.forEach(({ lot, rnd }, index) => {
    own(lot.cells);
    const yard = 0.03;
    const [u1, v1] = [lot.x + lot.w - yard, lot.y + lot.h - yard];
    pad(builders.mass, lot.x + yard, u1, lot.y + yard, v1, style.yard);
    let top = 0;
    if (heroes.has(index)) {
      const [tower, ...rest] = lot.cells;
      top = heroTower(builders, tower, style, rnd);
      rest.forEach((cell) => { top = Math.max(top, stoneBlock(builders, cell, style, rnd)); });
    } else if (lot.cells.length === 2) {
      top = house(builders, lot, style, rnd);
    } else if (lot.cells.length === 1) {
      const [cell] = lot.cells;
      const draw = rnd() < 0.5 ? hut : stoneBlock;
      top = draw(builders, cell, style, rnd);
    } else {
      // A bigger lot: a hut on each cell, as a little compound.
      lot.cells.forEach((cell) => { top = Math.max(top, hut(builders, cell, style, rnd)); });
    }
    bodyTop = Math.max(bodyTop, top);
  });
  featureTop = Math.max(featureTop, bodyTop);
  return {
    mass: builders.mass.build('village mass'),
    detail: builders.detail.build('village detail'),
    blocks,
    cells,
    bodyTop,
    southRowTop,
    featureTop,
    owners: {
      mass: Uint32Array.from(builders.mass.owners),
      detail: Uint32Array.from(builders.detail.owners),
      cells: ownerCells,
    },
  };
}

/**
 * A village map's synthetic mask, from its authored rows (`W`) or a live
 * map (`Wall`): the border ring `e`, other walls `b`; floor beside a wall
 * stays grass `g`, open ground is the path `p`. Cells in `skip` (a campaign's
 * boss gates, which open) stay out of the buildings, as floor.
 */
export function villageMaskRows(
  grid: readonly (readonly unknown[])[],
  skip: ReadonlySet<string> = new Set()
): string[] {
  const height = grid.length;
  const isWall = (cell: unknown) => cell === 'W' || cell === 'Wall';
  const wall = (x: number, y: number) => isWall(grid[y]?.[x]) && !skip.has(`${x},${y}`);
  return grid.map((row, y) => row.map((cell, x) => {
    if (wall(x, y)) {
      const edge = y === 0 || x === 0 || y === height - 1 || x === row.length - 1;
      return edge ? 'e' : 'b';
    }
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (wall(x + dx, y + dy)) return 'g';
      }
    }
    return 'p';
  }).join(''));
}
