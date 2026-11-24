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

/**
 * A deck's towers: its `m` cells where the map has them (the Chain Bridge),
 * otherwise one tower in the river at each bank, on the water cells either
 * side of the deck (they are walls, so a tower stands on nothing walkable).
 */
function towersFor(rows: readonly string[], deck: Deck): Tower[] {
  const top = deck.rows[0] - 1;
  const bottom = deck.rows[deck.rows.length - 1] + 1;
  const columns = [...new Set(deck.cells.map(({ x }) => x))].sort((p, q) => p - q);
  const pair = (cls: string) => columns.filter((x) => (
    rows[top]?.[x] === cls && rows[bottom]?.[x] === cls
  ));
  const marked = pair('m');
  if (marked.length >= 2) return marked.map((x) => ({ x, top, bottom }));
  const water = pair('w');
  if (water.length < 2 || water[water.length - 1] - water[0] < 2) return [];
  return [water[0], water[water.length - 1]].map((x) => ({ x, top, bottom }));
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
  deckCells.forEach(({ x, y }) => {
    [[y - 1, y + 0.03], [y + 1, y + 0.97]].forEach(([ny, v]) => {
      const beyond = rows[ny]?.[x];
      if (beyond !== 'w' && beyond !== 'm') return;
      bar(detail, c(x, v, RAIL_HEIGHT), c(x + 1, v, RAIL_HEIGHT), 0.035, IRON);
      if (beyond !== 'w') return;
      // The iron girder under the deck's edge, standing in the river.
      const out = ny < y ? -0.07 : 0.07;
      const [g0, g1] = out < 0 ? [y + out, y] : [y + 1, y + 1 + out];
      mass.box(x, x + 1, g0, g1, -0.02, 0.07, IRON, shadeHex(IRON, 1.3));
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
    });
  });
  return TOWER_TOP + TOWER_CAP;
}

/**
 * Budapest's bridges, after the Chain Bridge: each deck over the river has two
 * stone towers, each a pair of pylons joined over the road by an arched
 * lintel; chains swing from the banks over both towers and sag across the
 * river, with hangers down to iron railings along the deck's water edges.
 */
function chainBridge(
  builders: Builders,
  rows: readonly string[],
  style: CityBuildingStyle
): number {
  let top = 0;
  deckGroups(rows).forEach((deck) => {
    const towers = towersFor(rows, deck);
    if (towers.length < 2) return;
    top = Math.max(top, suspensionBridge(builders, rows, style, towers, deck));
  });
  return top;
}

/**
 * The Colosseum: its `m` cells as arcaded walls, three tiers of arches and an
 * attic of small windows, in the landmark stone. Open arches (the grid's gaps)
 * stay walkable as before.
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
  const dark = shadeHex(stone, 0.5);
  const members = new Set(ring.map(({ x, y }) => cellId(x, y)));
  const inRing = (x: number, y: number) => members.has(cellId(x, y));
  const classAt = (x: number, y: number) => rows[y]?.[x] ?? 'e';
  const tiers = [[0.04, 0.5], [0.56, 1.0], [1.06, 1.46]];
  const attic = [1.52, 1.74];
  const loops = chainLoops(unitEdges(ring, inRing));
  const outlines = blockOutlines(loops, inRing, classAt, () => 0, 0.05, 0);
  outlines.forEach((outline) => outline.points.forEach((p0, index) => {
    const p1 = outline.points[(index + 1) % outline.points.length];
    const { normal } = outline.edges[index];
    const facing: V3 = [normal.u, 0, normal.v];
    const length = Math.hypot(p1.u - p0.u, p1.v - p0.v);
    const at = (t: number): V2 => ({
      u: p0.u + ((p1.u - p0.u) * t) / length,
      v: p0.v + ((p1.v - p0.v) * t) / length,
    });
    const band = (
      builder: GeometryBuilder,
      y0: number,
      y1: number,
      hex: string,
      off = 0,
      t0 = 0,
      t1 = length
    ) => {
      builder.quad(
        world(at(t0), y0, normal, off),
        world(at(t1), y0, normal, off),
        world(at(t1), y1, normal, off),
        world(at(t0), y1, normal, off),
        hex,
        facing
      );
    };
    band(mass, 0, attic[1], stone);
    if (normal.v < -0.35 || length < 0.2) return;
    tiers.forEach(([y0, y1]) => {
      band(detail, y1, y1 + 0.03, trim, 0.004);
      const bays = Math.max(1, Math.round(length / 0.28));
      const bay = length / bays;
      for (let bayIndex = 0; bayIndex < bays; bayIndex += 1) {
        const centre = (bayIndex + 0.5) * bay;
        const half = bay * 0.3;
        // An arch: a dark opening with a pointed-round head.
        band(detail, y0 + 0.04, y1 - 0.11, dark, 0.006, centre - half, centre + half);
        detail.quad(
          world(at(centre - half), y1 - 0.11, normal, 0.006),
          world(at(centre + half), y1 - 0.11, normal, 0.006),
          world(at(centre + half * 0.45), y1 - 0.05, normal, 0.006),
          world(at(centre - half * 0.45), y1 - 0.05, normal, 0.006),
          dark,
          facing
        );
        // Half-columns between the arches.
        band(detail, y0, y1, trim, 0.004, centre + bay / 2 - 0.016, centre + bay / 2 + 0.016);
      }
    });
    const windows = Math.max(1, Math.round(length / 0.56));
    for (let w = 0; w < windows; w += 1) {
      const centre = ((w + 0.5) * length) / windows;
      band(detail, attic[0] + 0.06, attic[0] + 0.14, dark, 0.006, centre - 0.05, centre + 0.05);
    }
  }));
  const outer = outlines.findIndex((outline) => outline.area > 0);
  outlines.forEach((outline, index) => {
    if (index !== outer && outline.area > 0) mass.cap(outline.points, [], attic[1], trim);
  });
  if (outer >= 0) {
    const holes = outlines.filter((o, i) => i !== outer && o.area < 0).map((o) => o.points);
    mass.cap(outlines[outer].points, holes, attic[1], trim);
  }
  return attic[1];
}

/** Stone rims inside each water cell where it meets the bank: the river's quays. */
function quays(mass: GeometryBuilder, rows: readonly string[], style: CityBuildingStyle) {
  const rim = 0.08;
  const top = 0.05;
  rows.forEach((row, y) => Array.from(row).forEach((cls, x) => {
    if (cls !== 'w') return;
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
