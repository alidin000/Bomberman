/* eslint-disable no-bitwise -- the seeded hash and generator, as in engine/random.ts */
import * as THREE from 'three';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';

// Shared geometry for the board's city buildings and landmarks: a builder of
// vertex-coloured triangles in board lattice units (cell (x, y) is the square
// [x, x+1] x [y, y+1]), a seeded random, and the outline tracing that turns a
// block of cells into its inset, chamfered walls.

export const MIN_CHAMFER = 0.12;

export const STREET_CLASSES = new Set(['r', 'x', 't', 'd', 'p']);

/** A colour scaled in linear light, as the renderer mixes it. */
export function shadeHex(hex: string, factor: number): string {
  const color = new THREE.Color(hex);
  color.multiplyScalar(factor);
  return `#${color.getHexString()}`;
}

export type V3 = [number, number, number];
export type V2 = { u: number; v: number };

export const wx = (u: number) => (u - 0.5 + MAP_OFFSET_X) * TILE_SIZE;
export const wz = (v: number) => (v - 0.5 + MAP_OFFSET_Z) * TILE_SIZE;
export const world = (p: V2, y: number, normal?: V2, off = 0): V3 => [
  wx(p.u + (normal ? normal.u * off : 0)), y, wz(p.v + (normal ? normal.v * off : 0)),
];

/** Light comes from -x, +y, +z (StageAtmosphere KEY_LIGHT_POSITION); bake a little form. */
export function shadeFor(n: V3): number {
  if (n[1] > 0.995) return 1.04;
  if (n[1] > 0.25) return 0.95 + 0.12 * n[2] - 0.07 * n[0];
  if (n[1] < -0.5) return 0.6;
  return 0.8 + 0.13 * Math.max(0, n[2]) + 0.06 * Math.max(0, -n[0]) - 0.06 * Math.max(0, -n[2]);
}

export class GeometryBuilder {
  readonly positions: number[] = [];

  readonly normals: number[] = [];

  readonly colors: number[] = [];

  /**
   * The object the next triangles belong to, so fog can show or hide whole
   * objects (scene/city/CityBuildings.tsx). 0 is "always shown".
   */
  owner = 0;

  readonly owners: number[] = [];

  private readonly scratch = new THREE.Color();

  private readonly cache = new Map<string, [number, number, number]>();

  private linear(hex: string): [number, number, number] {
    let rgb = this.cache.get(hex);
    if (!rgb) {
      this.scratch.set(hex);
      rgb = [this.scratch.r, this.scratch.g, this.scratch.b];
      this.cache.set(hex, rgb);
    }
    return rgb;
  }

  /** One triangle facing `facing` (winding fixed to match), shaded by its normal. */
  tri(a: V3, b: V3, c: V3, hex: string, facing: V3, shade?: number) {
    let p = b;
    let q = c;
    const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
    const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length < 1e-10) return;
    nx /= length; ny /= length; nz /= length;
    if (nx * facing[0] + ny * facing[1] + nz * facing[2] < 0) {
      p = c; q = b; nx = -nx; ny = -ny; nz = -nz;
    }
    const tone = shade ?? shadeFor([nx, ny, nz]);
    const [r, g, bl] = this.linear(hex);
    [a, p, q].forEach((point) => {
      this.positions.push(point[0], point[1], point[2]);
      this.normals.push(nx, ny, nz);
      this.colors.push(r * tone, g * tone, bl * tone);
      this.owners.push(this.owner);
    });
  }

  quad(a: V3, b: V3, c: V3, d: V3, hex: string, facing: V3, shade?: number) {
    this.tri(a, b, c, hex, facing, shade);
    this.tri(a, c, d, hex, facing, shade);
  }

  /** A flat polygon (with holes) at height y, facing up. */
  cap(contour: V2[], holes: V2[][], y: number, hex: string) {
    const flat = (loop: V2[]) => loop.map((p) => new THREE.Vector2(p.u, p.v));
    const all = [contour, ...holes].flat();
    const faces = THREE.ShapeUtils.triangulateShape(flat(contour), holes.map(flat));
    faces.forEach(([i, j, k]) => {
      this.tri(world(all[i], y), world(all[j], y), world(all[k], y), hex, [0, 1, 0]);
    });
  }

  /** An axis-aligned box in lattice coordinates, without its bottom. */
  box(
    u0: number,
    u1: number,
    v0: number,
    v1: number,
    y0: number,
    y1: number,
    side: string,
    top: string
  ) {
    const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
    this.quad(c(u0, v0, y1), c(u1, v0, y1), c(u1, v1, y1), c(u0, v1, y1), top, [0, 1, 0]);
    this.quad(c(u0, v1, y0), c(u1, v1, y0), c(u1, v1, y1), c(u0, v1, y1), side, [0, 0, 1]);
    this.quad(c(u1, v0, y0), c(u0, v0, y0), c(u0, v0, y1), c(u1, v0, y1), side, [0, 0, -1]);
    this.quad(c(u1, v1, y0), c(u1, v0, y0), c(u1, v0, y1), c(u1, v1, y1), side, [1, 0, 0]);
    this.quad(c(u0, v0, y0), c(u0, v1, y0), c(u0, v1, y1), c(u0, v0, y1), side, [-1, 0, 0]);
  }

  get triangles(): number {
    return this.positions.length / 9;
  }

  build(name: string): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = name;
    return geometry;
  }
}

// --- Random, seeded per block so a map always looks the same ------------------------
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rnd: () => number, list: readonly T[]): T => (
  list[Math.floor(rnd() * list.length) % list.length]
);

// --- Outline tracing ------------------------------------------------------------------
// Lattice (u, v): cell (x, y) is the square [x, x+1] x [y, y+1]. Directions:
// 0 +u, 1 +v, 2 -u, 3 -v. Loops keep the block on their left.
export const DU = [1, 0, -1, 0];
export const DV = [0, 1, 0, -1];
export const leftOf = (dir: number): V2 => ({ u: -DV[dir], v: DU[dir] });
export const rightOf = (dir: number): V2 => ({ u: DV[dir], v: -DU[dir] });

export type UnitEdge = {
  a: number; b: number; dir: number;
  /** The cell inside the block and the one outside. */
  ix: number; iy: number; ox: number; oy: number;
};

export type Cell = { x: number; y: number };
export const cellId = (x: number, y: number) => y * 1024 + x;
export const latticeId = (a: number, b: number) => b * 1024 + a;

export function unitEdges(
  cells: readonly Cell[],
  has: (x: number, y: number) => boolean
): UnitEdge[] {
  const edges: UnitEdge[] = [];
  cells.forEach(({ x, y }) => {
    if (!has(x, y - 1)) {
      edges.push({
        a: x, b: y, dir: 0, ix: x, iy: y, ox: x, oy: y - 1
      });
    }
    if (!has(x + 1, y)) {
      edges.push({
        a: x + 1, b: y, dir: 1, ix: x, iy: y, ox: x + 1, oy: y
      });
    }
    if (!has(x, y + 1)) {
      edges.push({
        a: x + 1, b: y + 1, dir: 2, ix: x, iy: y, ox: x, oy: y + 1
      });
    }
    if (!has(x - 1, y)) {
      edges.push({
        a: x, b: y + 1, dir: 3, ix: x, iy: y, ox: x - 1, oy: y
      });
    }
  });
  return edges;
}

/** Closed loops of unit edges; at a pinch (cells touching diagonally) turn left. */
export function chainLoops(edges: UnitEdge[]): UnitEdge[][] {
  const byStart = new Map<number, UnitEdge[]>();
  edges.forEach((edge) => {
    const key = latticeId(edge.a, edge.b);
    const list = byStart.get(key);
    if (list) list.push(edge); else byStart.set(key, [edge]);
  });
  const used = new Set<UnitEdge>();
  const loops: UnitEdge[][] = [];
  // Start loops away from pinches, so the closing step is never ambiguous.
  const starts = [
    ...edges.filter((edge) => (byStart.get(latticeId(edge.a, edge.b))?.length ?? 0) === 1),
    ...edges,
  ];
  starts.forEach((first) => {
    if (used.has(first)) return;
    const loop: UnitEdge[] = [];
    let edge: UnitEdge | undefined = first;
    while (edge && !used.has(edge)) {
      used.add(edge);
      loop.push(edge);
      const current: UnitEdge = edge;
      const end = latticeId(current.a + DU[current.dir], current.b + DV[current.dir]);
      const options = (byStart.get(end) ?? [])
        .filter((option) => option === first || !used.has(option));
      const order = [(current.dir + 1) % 4, current.dir, (current.dir + 3) % 4];
      edge = order.map((dir) => options.find((option) => option.dir === dir)).find(Boolean);
      if (edge === first) break;
    }
    loops.push(loop);
  });
  return loops;
}

export type Run = {
  dir: number; a: number; b: number; length: number;
  ix: number; iy: number; ox: number; oy: number;
  lot: number;
};

/** Merges straight stretches with the same lot behind them into runs. */
export function loopRuns(loop: UnitEdge[], lotOf: (x: number, y: number) => number): Run[] {
  const sameRun = (p: UnitEdge, q: UnitEdge) => (
    p.dir === q.dir && lotOf(p.ix, p.iy) === lotOf(q.ix, q.iy)
  );
  let start = loop.findIndex((edge, index) => (
    !sameRun(loop[(index + loop.length - 1) % loop.length], edge)
  ));
  if (start < 0) start = 0;
  const ordered = [...loop.slice(start), ...loop.slice(0, start)];
  const runs: Run[] = [];
  ordered.forEach((edge) => {
    const last = runs[runs.length - 1];
    const lot = lotOf(edge.ix, edge.iy);
    if (last && last.dir === edge.dir && last.lot === lot) {
      last.length += 1;
    } else {
      runs.push({
        dir: edge.dir,
        a: edge.a,
        b: edge.b,
        length: 1,
        ix: edge.ix,
        iy: edge.iy,
        ox: edge.ox,
        oy: edge.oy,
        lot,
      });
    }
  });
  return runs;
}

export type OutlineEdge = { normal: V2; lot: number; chamfer: boolean; street: boolean };
export type Outline = { points: V2[]; edges: OutlineEdge[]; area: number };

export function signedArea(points: V2[]): number {
  let area = 0;
  points.forEach((p, index) => {
    const q = points[(index + 1) % points.length];
    area += p.u * q.v - q.u * p.v;
  });
  return area / 2;
}

export function offsetPoint(p: V2, nIn: V2, nOut: V2, distance: number): V2 {
  const dot = nIn.u * nOut.u + nIn.v * nOut.v;
  const scale = distance / (1 + dot);
  return { u: p.u + (nIn.u + nOut.u) * scale, v: p.v + (nIn.v + nOut.v) * scale };
}

export function unitLeft(p: V2, q: V2): V2 {
  const du = q.u - p.u;
  const dv = q.v - p.v;
  const length = Math.hypot(du, dv) || 1;
  return { u: -dv / length, v: du / length };
}

/** Moves every edge of a closed outline `distance` to its left (into the block). */
export function insetOutline(outline: Outline, distance: number): V2[] {
  const { points } = outline;
  return points.map((p, index) => {
    const prev = points[(index + points.length - 1) % points.length];
    const next = points[(index + 1) % points.length];
    const nIn = unitLeft(prev, p);
    const nOut = unitLeft(p, next);
    return offsetPoint(p, nIn, nOut, distance);
  });
}

/**
 * A block's loops, inset from the cell edges and, at street corners,
 * chamfered: the outlines its walls stand on.
 */
export function blockOutlines(
  loops: UnitEdge[][],
  inBlock: (x: number, y: number) => boolean,
  classAt: (x: number, y: number) => string,
  lotOf: (x: number, y: number) => number,
  inset: number,
  chamfer: number
): Outline[] {
  return loops.map((loop) => {
    const runs = loopRuns(loop, lotOf);
    const corners = runs.map((run, index) => {
      const prev = runs[(index + runs.length - 1) % runs.length];
      const p = { u: run.a, v: run.b };
      return {
        p, prev, run, at: offsetPoint(p, leftOf(prev.dir), leftOf(run.dir), inset)
      };
    });
    const runLength = (index: number) => {
      const p = corners[index].at;
      const q = corners[(index + 1) % corners.length].at;
      return Math.hypot(q.u - p.u, q.v - p.v);
    };
    const cuts = corners.map(({ p, prev, run }, index) => {
      if (chamfer <= 0 || run.dir !== (prev.dir + 1) % 4) return 0;
      const around = [[p.u - 1, p.v - 1], [p.u, p.v - 1], [p.u - 1, p.v], [p.u, p.v]]
        .filter(([x, y]) => !inBlock(x, y));
      const allStreet = around.every(([x, y]) => STREET_CLASSES.has(classAt(x, y)));
      if (around.length !== 3 || !allStreet) return 0;
      const before = runLength((index + corners.length - 1) % corners.length);
      const room = 0.42 * Math.min(before, runLength(index));
      const cut = Math.min(chamfer, room);
      return cut >= MIN_CHAMFER ? cut : 0;
    });
    const points: V2[] = [];
    const edges: OutlineEdge[] = [];
    corners.forEach(({ prev, run, at }, index) => {
      const street = STREET_CLASSES.has(classAt(run.ox, run.oy));
      const cut = cuts[index];
      if (cut > 0) {
        points.push({ u: at.u - DU[prev.dir] * cut, v: at.v - DV[prev.dir] * cut });
        const n = {
          u: rightOf(prev.dir).u + rightOf(run.dir).u,
          v: rightOf(prev.dir).v + rightOf(run.dir).v,
        };
        const length = Math.hypot(n.u, n.v);
        edges.push({
          normal: { u: n.u / length, v: n.v / length }, lot: run.lot, chamfer: true, street: true
        });
        points.push({ u: at.u + DU[run.dir] * cut, v: at.v + DV[run.dir] * cut });
      } else {
        points.push(at);
      }
      edges.push({
        normal: rightOf(run.dir), lot: run.lot, chamfer: false, street
      });
    });
    return { points, edges, area: signedArea(points) };
  });
}

// --- Lots: a block cut into buildings (greedy rectangles) ---------------------------
export type Lot = { x: number; y: number; w: number; h: number; cells: Cell[] };

export function cutLots(
  cells: readonly Cell[],
  maxW: number,
  maxH: number,
  rnd: () => number
): Lot[] {
  const free = new Set(cells.map(({ x, y }) => cellId(x, y)));
  const sorted = [...cells].sort((p, q) => (p.y - q.y) || (p.x - q.x));
  const lots: Lot[] = [];
  sorted.forEach(({ x, y }) => {
    if (!free.has(cellId(x, y))) return;
    const wantW = 1 + Math.floor(rnd() * maxW);
    const wantH = 1 + Math.floor(rnd() * maxH);
    let w = 1;
    while (w < wantW && free.has(cellId(x + w, y))) w += 1;
    let h = 1;
    const rowFree = (row: number) => {
      for (let i = 0; i < w; i += 1) if (!free.has(cellId(x + i, row))) return false;
      return true;
    };
    while (h < wantH && rowFree(y + h)) h += 1;
    const lotCells: Cell[] = [];
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        free.delete(cellId(x + i, y + j));
        lotCells.push({ x: x + i, y: y + j });
      }
    }
    lots.push({
      x, y, w, h, cells: lotCells
    });
  });
  return lots;
}
