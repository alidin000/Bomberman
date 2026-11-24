import * as THREE from 'three';
import type { CityBuildingStyle } from './cityBuildings';
import {
  Cell, GeometryBuilder, V2, V3, blockOutlines, cellId, chainLoops, shadeHex, unitEdges, world,
  wx, wz,
} from './cityGeometry';

// The board's own landmark, drawn on the render mask's `m` cells (still grid
// walls: collision is unchanged), and the stone quays along any river.
// Stylised massing only: no statues, lions, reliefs or inscriptions.

export type BoardLandmark = 'chainBridge' | 'colosseum';

type Builders = { mass: GeometryBuilder; detail: GeometryBuilder };

const TOWER_TOP = 2.3;
const TOWER_CAP = 0.14;
const CROSSING_TOP = 1.72;
const CHAIN_TOP = 2.12;
const CHAIN_SAG = 0.95;
const CHAIN_ANCHOR = 0.22;
const CHAIN_GAP = 0.13;
const RAIL_HEIGHT = 0.15;
const IRON = '#363c40';
/** The parapet where the river crosses the board's edge. */
const PARAPET = 0.16;

function cellsOf(rows: readonly string[], cls: string): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, y) => Array.from(row).forEach((c, x) => {
    if (c === cls) cells.push({ x, y });
  }));
  return cells;
}

/** A thin bar between two points, seen from above and from the camera's side. */
function bar(builder: GeometryBuilder, a: V3, b: V3, thick: number, hex: string) {
  builder.quad(
    [a[0], a[1] + thick / 2, a[2] - thick / 2],
    [b[0], b[1] + thick / 2, b[2] - thick / 2],
    [b[0], b[1] + thick / 2, b[2] + thick / 2],
    [a[0], a[1] + thick / 2, a[2] + thick / 2],
    hex,
    [0, 1, 0]
  );
  builder.quad(
    [a[0], a[1] - thick / 2, a[2] + thick / 2],
    [b[0], b[1] - thick / 2, b[2] + thick / 2],
    [b[0], b[1] + thick / 2, b[2] + thick / 2],
    [a[0], a[1] + thick / 2, a[2] + thick / 2],
    hex,
    [0, 0, 1]
  );
}

/**
 * A blind arch on a south face (+z): a dark panel with a round head, centred
 * on `u`, from `y0` up to the crown at `y1`.
 */
function blindArch(
  builder: GeometryBuilder,
  u: number,
  v: number,
  half: number,
  y0: number,
  y1: number,
  hex: string
) {
  const spring = y1 - half;
  const c = (du: number, y: number): V3 => [wx(u + du), y, wz(v)];
  builder.quad(c(-half, y0), c(half, y0), c(half, spring), c(-half, spring), hex, [0, 0, 1]);
  const steps = 8;
  for (let step = 0; step < steps; step += 1) {
    const a0 = Math.PI * (1 - step / steps);
    const a1 = Math.PI * (1 - (step + 1) / steps);
    builder.tri(
      c(0, spring),
      c(Math.cos(a0) * half, spring + Math.sin(a0) * half),
      c(Math.cos(a1) * half, spring + Math.sin(a1) * half),
      hex,
      [0, 0, 1]
    );
  }
}

type Tower = { x: number; top: number; bottom: number };
type Deck = { cells: Cell[]; rows: number[] };

/** Every 4-connected group of deck (`d`) cells: one bridge each. */
function deckGroups(rows: readonly string[]): Deck[] {
  const seen = new Set<string>();
  const decks: Deck[] = [];
  cellsOf(rows, 'd').forEach((start) => {
    if (seen.has(`${start.x},${start.y}`)) return;
    const cells: Cell[] = [];
    const stack = [start];
    seen.add(`${start.x},${start.y}`);
    while (stack.length) {
      const cell = stack.pop() as Cell;
      cells.push(cell);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const next = { x: cell.x + dx, y: cell.y + dy };
        const key = `${next.x},${next.y}`;
        if (rows[next.y]?.[next.x] === 'd' && !seen.has(key)) {
          seen.add(key);
          stack.push(next);
        }
      });
    }
    const deckRows = [...new Set(cells.map(({ y }) => y))].sort((p, q) => p - q);
    decks.push({ cells, rows: deckRows });
  });
  return decks;
}

/** A deck's towers on its marked `m` cells (the Chain Bridge), or none. */
function markedTowers(rows: readonly string[], deck: Deck): Tower[] {
  const top = deck.rows[0] - 1;
  const bottom = deck.rows[deck.rows.length - 1] + 1;
  const columns = [...new Set(deck.cells.map(({ x }) => x))].sort((p, q) => p - q);
  const marked = columns.filter((x) => rows[top]?.[x] === 'm' && rows[bottom]?.[x] === 'm');
  return marked.length >= 2 ? marked.map((x) => ({ x, top, bottom })) : [];
}

/** The columns where a deck has river on both sides: it crosses the water there. */
function waterColumns(rows: readonly string[], deck: Deck): number[] {
  const top = deck.rows[0] - 1;
  const bottom = deck.rows[deck.rows.length - 1] + 1;
  const columns = [...new Set(deck.cells.map(({ x }) => x))].sort((p, q) => p - q);
  return columns.filter((x) => rows[top]?.[x] === 'w' && rows[bottom]?.[x] === 'w');
}

/** Iron railings where a deck meets the river or a pylon, and girders in the water under them. */
function deckRailings(
  { mass, detail }: Builders,
  rows: readonly string[],
  deckCells: readonly Cell[]
) {
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
  deckCells.forEach(({ x, y }) => {
    [[y - 1, y + 0.03], [y + 1, y + 0.97]].forEach(([ny, v]) => {
      const beyond = rows[ny]?.[x];
      if (beyond !== 'w' && beyond !== 'm') return;
      bar(detail, c(x, v, RAIL_HEIGHT), c(x + 1, v, RAIL_HEIGHT), 0.035, IRON);
      for (let post = 0.125; post < 1; post += 0.25) {
        detail.quad(
          c(x + post - 0.008, v, 0),
          c(x + post + 0.008, v, 0),
          c(x + post + 0.008, v, RAIL_HEIGHT),
          c(x + post - 0.008, v, RAIL_HEIGHT),
          IRON,
          [0, 0, 1]
        );
      }
      if (beyond !== 'w') return;
      // The iron girder under the deck's edge, standing in the river.
      const out = ny < y ? -0.07 : 0.07;
      const [g0, g1] = out < 0 ? [y + out, y] : [y + 1, y + 1 + out];
      mass.box(x, x + 1, g0, g1, -0.02, 0.07, IRON, shadeHex(IRON, 1.3));
    });
  });
}

/** Painted steel, as on Budapest's other Danube bridges. */
const STEEL = '#4f6f5f';
const TRUSS_RISE = 0.36;

/**
 * Any other deck over the river: a steel arch truss either side of the
 * deck, standing in the water beside it, with the deck's railings. Not a
 * copy of the Chain Bridge, which keeps the towers and chains. Returns its top.
 */
function steelBridge(builders: Builders, rows: readonly string[], deck: Deck): number {
  const columns = waterColumns(rows, deck);
  if (columns.length < 2) return 0;
  const { mass } = builders;
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
  const u0 = columns[0];
  const u1 = columns[columns.length - 1] + 1;
  const chord = 0.06;
  const arch = (u: number) => (
    chord + 0.06 + TRUSS_RISE * Math.sin((Math.PI * (u - u0)) / (u1 - u0))
  );
  const top = deck.rows[0] - 1;
  const bottom = deck.rows[deck.rows.length - 1] + 1;
  [top + 0.92, bottom + 0.08].forEach((v) => {
    const step = 0.25;
    for (let u = u0; u < u1 - 1e-6; u += step) {
      const n = Math.min(u1, u + step);
      bar(mass, c(u, v, arch(u)), c(n, v, arch(n)), 0.05, STEEL);
      bar(mass, c(u, v, chord), c(n, v, chord), 0.04, STEEL);
      // A post and a diagonal in each panel.
      // Kept inside the river: the first post stands just in from the bank.
      const post = Math.max(u, u0 + 0.012);
      const end = Math.min(n, u1 - 0.012);
      const low = (du: number) => c(post + du, v, chord);
      const high = (at: number, du: number) => c(at + du, v, arch(at));
      mass.quad(low(-0.012), low(0.012), high(post, 0.012), high(post, -0.012), STEEL, [0, 0, 1]);
      mass.quad(low(-0.01), low(0.01), high(end, 0.01), high(end, -0.01), STEEL, [0, 0, 1]);
    }
  });
  deckRailings(builders, rows, deck.cells);
  return chord + 0.06 + TRUSS_RISE + 0.03;
}

function suspensionBridge(
  { mass, detail }: Builders,
  rows: readonly string[],
  style: CityBuildingStyle,
  towers: readonly Tower[],
  deck: Deck
): number {
  const stone = style.landmarkStone;
  const trim = shadeHex(stone, 1.25);
  const shadow = shadeHex(stone, 0.6);
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];

  towers.forEach(({ x, top, bottom }) => {
    // Pylons: a wider plinth, the shaft, a cornice and an attic; on the face
    // the camera sees, the tall blind arch the towers are known by.
    [top, bottom].forEach((y) => {
      mass.box(x + 0.05, x + 0.95, y + 0.04, y + 0.96, 0, 0.26, shadeHex(stone, 0.9), trim);
      mass.box(x + 0.12, x + 0.88, y + 0.1, y + 0.9, 0.26, TOWER_TOP, stone, stone);
      mass.box(x + 0.08, x + 0.92, y + 0.06, y + 0.94, TOWER_TOP, TOWER_TOP + 0.06, trim, trim);
      const cap = TOWER_TOP + TOWER_CAP;
      mass.box(x + 0.2, x + 0.8, y + 0.18, y + 0.82, TOWER_TOP + 0.06, cap, stone, trim);
      blindArch(detail, x + 0.5, y + 0.9 + 0.004, 0.2, 0.42, 1.68, shadow);
    });
    // The crossing over the road, lower than the pylons: a lintel whose
    // spandrels follow a round arch, open underneath.
    const v0 = top + 0.9;
    const v1 = bottom + 0.1;
    const spring = 0.95;
    const crown = 1.3;
    const lintel = 1.42;
    mass.box(x + 0.16, x + 0.84, v0, v1, lintel, CROSSING_TOP, stone, trim);
    const steps = 10;
    const archY = (t: number) => spring + (crown - spring) * Math.sin(Math.PI * t);
    for (let step = 0; step < steps; step += 1) {
      const t0 = step / steps;
      const t1 = (step + 1) / steps;
      const va = v0 + (v1 - v0) * t0;
      const vb = v0 + (v1 - v0) * t1;
      [x + 0.16, x + 0.84].forEach((u, side) => {
        const facing: V3 = [side ? 1 : -1, 0, 0];
        const low0 = c(u, va, archY(t0));
        const low1 = c(u, vb, archY(t1));
        mass.quad(low0, low1, c(u, vb, lintel), c(u, va, lintel), stone, facing);
      });
      // The arch's underside.
      mass.quad(
        c(x + 0.16, va, archY(t0)),
        c(x + 0.84, va, archY(t0)),
        c(x + 0.84, vb, archY(t1)),
        c(x + 0.16, vb, archY(t1)),
        shadow,
        [0, -1, 0]
      );
    }
  });

  // The deck: its rows run between the towers' pylons.
  const deckRows = deck.rows;
  const deckCells = deck.cells;
  // The chains run along the deck's two edge rows, only as far as both reach.
  const edgeRows = [deckRows[0], deckRows[deckRows.length - 1]];
  const edgeXs = edgeRows.map((row) => deckCells.filter(({ y }) => y === row).map(({ x }) => x));
  const uA = Math.max(...edgeXs.map((xs) => Math.min(...xs))) + 0.25;
  const uB = Math.min(...edgeXs.map((xs) => Math.max(...xs))) + 0.75;
  const towerU = towers.map(({ x }) => x + 0.5);
  const chainHeight = (u: number): number => {
    if (u <= towerU[0]) {
      const t = (u - uA) / (towerU[0] - uA);
      return CHAIN_ANCHOR + (CHAIN_TOP - CHAIN_ANCHOR) * t * t;
    }
    const last = towerU[towerU.length - 1];
    if (u >= last) {
      const t = (uB - u) / (uB - last);
      return CHAIN_ANCHOR + (CHAIN_TOP - CHAIN_ANCHOR) * t * t;
    }
    const span = towerU.findIndex((tu) => tu >= u);
    const a = towerU[span - 1];
    const b = towerU[span];
    const t = (u - a) / (b - a);
    return CHAIN_TOP - (CHAIN_TOP - CHAIN_SAG) * 4 * t * (1 - t);
  };
  const edges = [deckRows[0] + 0.04, deckRows[deckRows.length - 1] + 0.96];
  const stepU = 0.2;
  edges.forEach((v) => {
    // Two chains a side, one above the other, as on the real bridge.
    [0, CHAIN_GAP].forEach((drop) => {
      for (let u = uA; u < uB - 1e-6; u += stepU) {
        const next = Math.min(uB, u + stepU);
        const ha = Math.max(CHAIN_ANCHOR, chainHeight(u) - drop);
        const hb = Math.max(CHAIN_ANCHOR, chainHeight(next) - drop);
        bar(detail, c(u, v, ha), c(next, v, hb), 0.06, IRON);
      }
    });
    // Hangers down to the railing, wherever the chain is high enough.
    for (let u = uA + 0.4; u < uB - 0.3; u += 0.4) {
      const h = chainHeight(u);
      if (h > RAIL_HEIGHT + 0.12 && !towerU.some((tu) => Math.abs(tu - u) < 0.45)) {
        detail.quad(
          c(u - 0.01, v + 0.001, RAIL_HEIGHT),
          c(u + 0.01, v + 0.001, RAIL_HEIGHT),
          c(u + 0.01, v + 0.001, h),
          c(u - 0.01, v + 0.001, h),
          IRON,
          [0, 0, 1]
        );
      }
    }
  });
  // Railings where the deck meets the river (walkable on one side only).
  deckRailings({ mass, detail }, rows, deckCells);
  return TOWER_TOP + TOWER_CAP;
}

/**
 * Budapest's bridges: the Chain Bridge on its marked pylons (two stone
 * towers, each a pair of pylons joined over the road by an arched lintel,
 * chains swinging from the banks over both and sagging across the river,
 * hangers down to iron railings), and a steel arch truss for any other deck
 * over the river.
 */
function chainBridge(
  builders: Builders,
  rows: readonly string[],
  style: CityBuildingStyle
): number {
  let top = 0;
  deckGroups(rows).forEach((deck) => {
    const towers = markedTowers(rows, deck);
    const span = towers.length >= 2
      ? suspensionBridge(builders, rows, style, towers, deck)
      : steelBridge(builders, rows, deck);
    top = Math.max(top, span);
  });
  return top;
}

/** The Colosseum's inner wall round the arena, and the outer ring's height on its south arc. */
const ARENA_WALL = 0.62;
const SOUTH_RING_TOP = 1.06;

/** The seating tiers' floor heights, from the arena wall up. */
const SEAT_LEVELS = [ARENA_WALL, ARENA_WALL + 0.373, ARENA_WALL + 0.746];

/** The tier a height falls in: its floor. */
function tierOf(f: number): number {
  let level = SEAT_LEVELS[0];
  SEAT_LEVELS.forEach((floor) => { if (f >= floor - 1e-6) level = floor; });
  return level;
}

type FieldPoint = { u: number; v: number; f: number };

/** Clips a polygon to one side of the level line `f = level` of its linear field. */
function clipToLevel(poly: readonly FieldPoint[], level: number, above: boolean): FieldPoint[] {
  const inside = (p: FieldPoint) => (above ? p.f >= level : p.f <= level);
  const out: FieldPoint[] = [];
  poly.forEach((p, index) => {
    const q = poly[(index + 1) % poly.length];
    if (inside(p)) out.push(p);
    if (inside(p) !== inside(q)) {
      const t = (level - p.f) / (q.f - p.f);
      out.push({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t, f: level });
    }
  });
  return out;
}

/**
 * Terraces over one triangle of a sloping top: each band of the height field
 * between two levels drawn flat at its lower level, and a riser along each
 * level line from the tier below up to it, facing down the slope.
 */
function seatingTiers(
  builder: GeometryBuilder,
  triangle: readonly FieldPoint[],
  levels: readonly number[],
  seat: string,
  riser: string
) {
  const c = (p: FieldPoint, y: number): V3 => [wx(p.u), y, wz(p.v)];
  levels.forEach((level, index) => {
    let band = clipToLevel(triangle, level, true);
    const next = levels[index + 1];
    if (next !== undefined) band = clipToLevel(band, next, false);
    if (index === 0) band = clipToLevel(triangle, next ?? Infinity, false);
    for (let k = 1; k + 1 < band.length; k += 1) {
      builder.tri(c(band[0], level), c(band[k], level), c(band[k + 1], level), seat, [0, 1, 0]);
    }
    if (index === 0) return;
    // The level line across the triangle, and the slope's downhill direction.
    const cut: FieldPoint[] = [];
    triangle.forEach((p, i) => {
      const q = triangle[(i + 1) % triangle.length];
      if ((p.f - level) * (q.f - level) < 0) {
        const t = (level - p.f) / (q.f - p.f);
        cut.push({ u: p.u + (q.u - p.u) * t, v: p.v + (q.v - p.v) * t, f: level });
      }
    });
    if (cut.length !== 2) return;
    const [a, b, d] = triangle;
    const det = (b.u - a.u) * (d.v - a.v) - (d.u - a.u) * (b.v - a.v);
    if (Math.abs(det) < 1e-9) return;
    const gu = ((b.f - a.f) * (d.v - a.v) - (d.f - a.f) * (b.v - a.v)) / det;
    const gv = ((d.f - a.f) * (b.u - a.u) - (b.f - a.f) * (d.u - a.u)) / det;
    const below = levels[index - 1];
    const [p0, p1] = cut;
    builder.quad(c(p0, below), c(p1, below), c(p1, level), c(p0, level), riser, [-gu, 0, -gv]);
  });
}

/**
 * The Colosseum: its `m` cells as one oval stadium in the landmark stone.
 * The outer wall carries three tiers of arches and an attic on the north
 * arc and drops to two tiers on the south, as the ruin stands (which also
 * hides less of the board). Its top falls inward as a bank of seating to a
 * low wall round the arena. Open arches (the grid's gaps) stay walkable.
 */
function colosseum(
  { mass, detail }: Builders,
  rows: readonly string[],
  style: CityBuildingStyle
): number {
  const ring = cellsOf(rows, 'm');
  if (!ring.length) return 0;
  const stone = style.landmarkStone;
  const trim = shadeHex(stone, 1.18);
  const seats = shadeHex(stone, 1.06);
  const riser = shadeHex(stone, 0.6);
  const dark = shadeHex(stone, 0.5);
  const members = new Set(ring.map(({ x, y }) => cellId(x, y)));
  const inRing = (x: number, y: number) => members.has(cellId(x, y));
  const classAt = (x: number, y: number) => rows[y]?.[x] ?? 'e';
  const tiers = [[0.04, 0.5], [0.56, 1.0], [1.06, 1.46]];
  const attic = [1.52, 1.74];
  // The ring's centre and half extents, to tell its outer face from its inner.
  const us = ring.map(({ x }) => x + 0.5);
  const vs = ring.map(({ y }) => y + 0.5);
  const cu = (Math.min(...us) + Math.max(...us)) / 2;
  const cv = (Math.min(...vs) + Math.max(...vs)) / 2;
  const ru = (Math.max(...us) - Math.min(...us)) / 2 + 0.5;
  const rv = (Math.max(...vs) - Math.min(...vs)) / 2 + 0.5;
  /** The outer wall's top: full on the north arc, two tiers on the south. */
  const outerTop = (point: V2) => {
    const north = Math.min(1, Math.max(0, 0.5 - (point.v - cv) / (rv * 1.2)));
    const t = north * north * (3 - 2 * north);
    return SOUTH_RING_TOP + (attic[1] - SOUTH_RING_TOP) * t;
  };
  const loops = chainLoops(unitEdges(ring, inRing));
  const outlines = blockOutlines(loops, inRing, classAt, () => 0, 0.05, 0);
  outlines.forEach((outline) => {
    const count = outline.points.length;
    const looksIn = outline.edges.map(({ normal }, index) => {
      const p0 = outline.points[index];
      const p1 = outline.points[(index + 1) % count];
      const mu = (p0.u + p1.u) / 2 - cu;
      const mv = (p0.v + p1.v) / 2 - cv;
      return normal.u * (mu / ru) + normal.v * (mv / rv) < 0;
    });
    // A corner on the outer face stands at the outer wall's height; one
    // between two inner faces at the arena wall's.
    const topAt = outline.points.map((point, index) => (
      looksIn[index] && looksIn[(index + count - 1) % count] ? ARENA_WALL : outerTop(point)
    ));
    outline.points.forEach((p0, index) => {
      const next = (index + 1) % count;
      const p1 = outline.points[next];
      const { normal } = outline.edges[index];
      const facing: V3 = [normal.u, 0, normal.v];
      const top0 = topAt[index];
      const top1 = topAt[next];
      const on = (point: V2, y: number) => world(point, y, normal, 0);
      mass.quad(on(p0, 0), on(p1, 0), on(p1, top1), on(p0, top0), stone, facing);
      const length = Math.hypot(p1.u - p0.u, p1.v - p0.v);
      if (normal.v < -0.35 || length < 0.2) return;
      const at = (t: number): V2 => ({
        u: p0.u + ((p1.u - p0.u) * t) / length,
        v: p0.v + ((p1.v - p0.v) * t) / length,
      });
      const band = (y0: number, y1: number, hex: string, off: number, t0 = 0, t1 = length) => {
        detail.quad(
          world(at(t0), y0, normal, off),
          world(at(t1), y0, normal, off),
          world(at(t1), y1, normal, off),
          world(at(t0), y1, normal, off),
          hex,
          facing
        );
      };
      if (looksIn[index]) {
        // The arena wall's coping.
        band(ARENA_WALL - 0.05, ARENA_WALL - 0.02, trim, 0.004);
        return;
      }
      const wallTop = Math.min(top0, top1);
      tiers.forEach(([y0, y1]) => {
        if (y1 + 0.03 > wallTop + 1e-6) return;
        band(y1, y1 + 0.03, trim, 0.004);
        const bays = Math.max(1, Math.round(length / 0.28));
        const bay = length / bays;
        for (let bayIndex = 0; bayIndex < bays; bayIndex += 1) {
          const centre = (bayIndex + 0.5) * bay;
          const half = bay * 0.3;
          // An arch: a dark opening with a pointed-round head.
          band(y0 + 0.04, y1 - 0.11, dark, 0.006, centre - half, centre + half);
          detail.quad(
            world(at(centre - half), y1 - 0.11, normal, 0.006),
            world(at(centre + half), y1 - 0.11, normal, 0.006),
            world(at(centre + half * 0.45), y1 - 0.05, normal, 0.006),
            world(at(centre - half * 0.45), y1 - 0.05, normal, 0.006),
            dark,
            facing
          );
          // Half-columns between the arches.
          band(y0, y1, trim, 0.004, centre + bay / 2 - 0.016, centre + bay / 2 + 0.016);
        }
      });
      if (wallTop >= attic[1] - 0.02) {
        const windows = Math.max(1, Math.round(length / 0.56));
        for (let w = 0; w < windows; w += 1) {
          const centre = ((w + 0.5) * length) / windows;
          band(attic[0] + 0.06, attic[0] + 0.14, dark, 0.006, centre - 0.05, centre + 0.05);
        }
      }
    });
    // The seating: three tiers stepping down from the outer rim to the arena
    // wall, with dark risers between them.
    const contour = outline.points.map(({ u, v }) => new THREE.Vector2(u, v));
    THREE.ShapeUtils.triangulateShape(contour, []).forEach((corners) => {
      const triangle = corners.map((index) => ({ ...outline.points[index], f: topAt[index] }));
      seatingTiers(mass, triangle, SEAT_LEVELS, seats, riser);
    });
    // Where the outer wall stands above the top tier, its inner face.
    outline.points.forEach((p0, index) => {
      if (looksIn[index]) return;
      const next = (index + 1) % count;
      const p1 = outline.points[next];
      const { normal } = outline.edges[index];
      const seat = Math.min(tierOf(topAt[index]), tierOf(topAt[next]));
      const on = (point: V2, y: number) => world(point, y, normal, -0.002);
      const inward: V3 = [-normal.u, 0, -normal.v];
      const [t0, t1] = [topAt[index], topAt[next]];
      mass.quad(on(p0, seat), on(p1, seat), on(p1, t1), on(p0, t0), stone, inward);
    });
  });
  return attic[1];
}

/**
 * The Colosseum's real arena is 83 by 48 m inside an outer ring of 189 by
 * 156 m: the sand covers that share of the ring, not all its inside.
 */
const ARENA_SHARE = { u: 83 / 189, v: 48 / 156 };

/**
 * The cells of a stadium's arena (the Colosseum's): open floor inside the
 * ellipse its ring's bounds give, scaled to the real arena's size.
 */
export function ringInterior(rows: readonly string[]): Set<string> {
  const ring = cellsOf(rows, 'm');
  const inside = new Set<string>();
  if (!ring.length) return inside;
  const x0 = Math.min(...ring.map(({ x }) => x));
  const x1 = Math.max(...ring.map(({ x }) => x));
  const y0 = Math.min(...ring.map(({ y }) => y));
  const y1 = Math.max(...ring.map(({ y }) => y));
  const cu = (x0 + x1) / 2;
  const cv = (y0 + y1) / 2;
  const au = ((x1 - x0) / 2 + 0.5) * ARENA_SHARE.u;
  const av = ((y1 - y0) / 2 + 0.5) * ARENA_SHARE.v;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cls = rows[y][x];
      if (!'mbew'.includes(cls) && Math.hypot((x - cu) / au, (y - cv) / av) <= 1) {
        inside.add(`${x},${y}`);
      }
    }
  }
  return inside;
}

/** Stone rims inside each water cell where it meets the bank: the river's quays. */
function quays(mass: GeometryBuilder, rows: readonly string[], style: CityBuildingStyle) {
  const rim = 0.08;
  const top = 0.05;
  rows.forEach((row, y) => Array.from(row).forEach((cls, x) => {
    if (cls !== 'w') return;
    // Where the river leaves the board, a low granite parapet marks the edge.
    const coping = shadeHex(style.quay, 1.1);
    if (y === 0) mass.box(x, x + 1, y, y + 0.1, -0.01, PARAPET, style.quay, coping);
    const south = y === rows.length - 1;
    if (south) mass.box(x, x + 1, y + 0.9, y + 1, -0.01, PARAPET, style.quay, coping);
    const bank = (nx: number, ny: number) => {
      const beyond = rows[ny]?.[nx];
      return beyond !== undefined && beyond !== 'w' && beyond !== 'e';
    };
    const rim3 = (u0: number, u1: number, v0: number, v1: number) => {
      mass.box(u0, u1, v0, v1, -0.01, top, style.quay, style.quay);
    };
    if (bank(x, y - 1)) rim3(x, x + 1, y, y + rim);
    if (bank(x, y + 1)) rim3(x, x + 1, y + 1 - rim, y + 1);
    if (bank(x - 1, y)) rim3(x, x + rim, y, y + 1);
    if (bank(x + 1, y)) rim3(x + 1 - rim, x + 1, y, y + 1);
  }));
}

/** The style's landmark on the mask's `m` cells (when drawn), and the quays. Returns its top. */
export function buildBoardLandmarks(
  builders: Builders,
  rows: readonly string[],
  style: CityBuildingStyle,
  drawLandmark: boolean
): number {
  quays(builders.mass, rows, style);
  if (!drawLandmark || !style.landmark) return 0;
  return style.landmark === 'chainBridge'
    ? chainBridge(builders, rows, style)
    : colosseum(builders, rows, style);
}
