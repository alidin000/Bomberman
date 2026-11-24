import * as THREE from 'three';
import {
  GeometryBuilder, V3, hashString, pick, seeded, shadeHex, wx, wz,
} from './cityGeometry';
import type { CityBuildingStyle } from './cityBuildings';

/**
 * The city past the board: a band of low roofs on a street-level ground all
 * round the floor slab, so a city reads as one district of a larger city
 * instead of a board in the sky. Rendering only and off the board, so it is
 * not in the cut-away, casts no shadow and hides with the scenery setting;
 * the scene's fog fades its far rows. Blocks of two by two lots with a
 * street between them, a ring road along the slab, low enough behind the
 * board that the skyline landmark rises over it, and a clearing round each
 * landmark so its footprint and silhouette stay free.
 */

/** A prop off the board the outskirts keep clear of (landmarkPlacement.ts), in map cells. */
export type OutskirtsClearing = {
  x: number;
  y: number;
  radius: number;
  /** A famous place: the band in front of and behind it stays empty too. */
  famous: boolean;
};

/** How many cells the outskirts reach past the floor slab. */
export const OUTSKIRTS_DEPTH = 5;
/** Highest roof behind the board; the sides stay lower and the camera side lowest. */
export const OUTSKIRTS_TOP = 1.4;
const SIDE_TOP = 1.1;
/** Roofs on the camera's side of the board, ridges included (cityOutskirts.test.ts). */
export const OUTSKIRTS_NEAR_TOP = 0.5;
const NEAR_TOP = 0.4;
/** The floor slab reaches this far past the board (GameScene3D's Floor: width + 1.1). */
const SLAB_LIP = 0.55;
const GROUND_Y = -0.06;
/** The river past the board: just over the floor slab's top, under the board's own water. */
const RIVER_Y = -0.02;
const EMBANKMENT = 0.12;

function clear(cx: number, cy: number, clearings: readonly OutskirtsClearing[]): boolean {
  return clearings.every(({
    x, y, radius, famous,
  }) => {
    const dx = Math.abs(cx - x);
    if (famous) {
      // Its footprint, a cell round it, and its column behind and in front.
      return dx > radius + 1.2 || cy > y + radius + 1;
    }
    return Math.hypot(dx, cy - y) > radius * 0.7 + 0.4;
  });
}

/** The columns a river leaves the board by, on a border row of the mask. */
function riverColumns(row: string | undefined): [number, number] | null {
  if (!row) return null;
  const xs = Array.from(row).flatMap((cls, x) => (cls === 'w' ? [x] : []));
  return xs.length ? [Math.min(...xs), Math.max(...xs) + 1] : null;
}

export function buildCityOutskirts(
  rows: readonly string[],
  style: CityBuildingStyle,
  seedText: string,
  clearings: readonly OutskirtsClearing[],
  water: string
): THREE.BufferGeometry {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const mass = new GeometryBuilder();
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
  // The ground: four strips round the slab, in the kerb's tone.
  const ground = shadeHex(style.kerb, 0.85);
  const outer = OUTSKIRTS_DEPTH + SLAB_LIP + 1;
  const flat = (u0: number, u1: number, v0: number, v1: number) => {
    const g = (u: number, v: number) => c(u, v, GROUND_Y);
    mass.quad(g(u0, v0), g(u1, v0), g(u1, v1), g(u0, v1), ground, [0, 1, 0], 1);
  };
  flat(-outer, width + outer, -outer, -SLAB_LIP);
  flat(-outer, width + outer, height + SLAB_LIP, height + outer);
  flat(-outer, -SLAB_LIP, -SLAB_LIP, height + SLAB_LIP);
  flat(width + SLAB_LIP, width + outer, -SLAB_LIP, height + SLAB_LIP);

  // A river that leaves the board runs on through the outskirts, between
  // granite embankments. North of the board it bends aside from a famous
  // place in its way, so the place stands on its bank (the Parliament).
  type Knot = { v: number; west: number; east: number };
  const paths: Knot[][] = [];
  const north = riverColumns(rows[0]);
  if (north) {
    const [w, e] = north;
    const blocker = clearings.find(({ x, radius, famous }) => (
      famous && x + 0.5 - radius < e && x + 0.5 + radius > w
    ));
    // Bend west to end clear of its west end, or east past its east end.
    const westShift = blocker ? blocker.x + 0.5 - blocker.radius - 0.2 - e : 0;
    const eastShift = blocker ? blocker.x + 0.5 + blocker.radius + 0.2 - w : 0;
    const shift = Math.abs(westShift) <= Math.abs(eastShift) ? westShift : eastShift;
    paths.push([
      { v: 0, west: w, east: e },
      { v: -0.7, west: w, east: e },
      { v: -1.5, west: w + shift, east: e + shift },
      { v: -outer, west: w + shift, east: e + shift },
    ]);
  }
  const south = riverColumns(rows[height - 1]);
  if (south) {
    const [w, e] = south;
    paths.push([
      { v: height, west: w, east: e },
      { v: height + outer, west: w, east: e },
    ]);
  }
  const bank = (path: Knot[], v: number): [number, number] => {
    for (let index = 0; index + 1 < path.length; index += 1) {
      const a = path[index];
      const b = path[index + 1];
      const lo = Math.min(a.v, b.v);
      const hi = Math.max(a.v, b.v);
      if (v >= lo && v <= hi) {
        const t = hi === lo ? 0 : (v - a.v) / (b.v - a.v);
        return [a.west + (b.west - a.west) * t, a.east + (b.east - a.east) * t];
      }
    }
    return [Infinity, -Infinity];
  };
  paths.forEach((path) => {
    for (let index = 0; index + 1 < path.length; index += 1) {
      const a = path[index];
      const b = path[index + 1];
      const y = RIVER_Y;
      const w = (u: number, v: number) => c(u, v, y);
      const sky: V3 = [0, 1, 0];
      mass.quad(w(a.west, a.v), w(a.east, a.v), w(b.east, b.v), w(b.west, b.v), water, sky, 1);
      // Embankments, off the floor slab (the board's parapet marks its edge).
      // North of the board v <= 0; south of it v >= height.
      const clip = (v: number) => (
        v <= 0 ? Math.min(v, -SLAB_LIP) : Math.max(v, height + SLAB_LIP)
      );
      const [v0, v1] = [clip(a.v), clip(b.v)];
      if (Math.abs(v1 - v0) < 1e-6) continue; // eslint-disable-line no-continue
      const at = (v: number) => bank(path, v);
      [[0, -0.1], [1, 0.1]].forEach(([side, out]) => {
        const p0 = at(v0)[side];
        const p1 = at(v1)[side];
        const outer0 = p0 + out;
        const outer1 = p1 + out;
        const top = EMBANKMENT;
        const granite = shadeHex(style.quay, 1.1);
        const up = (u: number, v: number) => c(u, v, top);
        const down = (u: number, v: number) => c(u, v, GROUND_Y);
        mass.quad(up(p0, v0), up(outer0, v0), up(outer1, v1), up(p1, v1), granite, [0, 1, 0]);
        const facing: V3 = [side ? -1 : 1, 0, 0];
        mass.quad(down(p0, v0), down(p1, v1), up(p1, v1), up(p0, v0), style.quay, facing);
      });
    }
  });
  const inRiver = (cx: number, cy: number) => paths.some((path) => (
    [cy, cy + 0.5, cy + 1].some((v) => {
      const [west, east] = bank(path, v);
      return cx + 1 > west - 0.15 && cx < east + 0.15;
    })
  ));

  const inset = 0.06;
  for (let cy = -OUTSKIRTS_DEPTH - 1; cy < height + OUTSKIRTS_DEPTH + 1; cy += 1) {
    for (let cx = -OUTSKIRTS_DEPTH - 1; cx < width + OUTSKIRTS_DEPTH + 1; cx += 1) {
      // The slab and the ring road along it stay open.
      const onSlab = cx >= -1 && cx <= width && cy >= -1 && cy <= height;
      // Streets every third row and column, in step with the board.
      const street = ((cx % 3) + 3) % 3 === 2 || ((cy % 3) + 3) % 3 === 2;
      if (!onSlab && !street && !inRiver(cx, cy) && clear(cx, cy, clearings)) {
        const rnd = seeded(hashString(`${seedText}|outskirts|${cx},${cy}`));
        let top: number;
        if (cy < 0) top = 0.7 + rnd() * (OUTSKIRTS_TOP - 0.7 - 0.2);
        else if (cy >= height) top = 0.2 + rnd() * (NEAR_TOP - 0.2);
        else if (cy > height * 0.62) top = 0.3 + rnd() * 0.3;
        else top = 0.55 + rnd() * (SIDE_TOP - 0.55 - 0.2);
        const wall = pick(rnd, style.facades);
        const roof = pick(rnd, style.roofs);
        const u0 = cx + inset;
        const u1 = cx + 1 - inset;
        const v0 = cy + inset;
        const v1 = cy + 1 - inset;
        mass.box(u0, u1, v0, v1, GROUND_Y, top, wall, shadeHex(roof, 0.9));
        if (style.roof !== 'flat') {
          // A low hip: four slopes to a point.
          // Never above the band's cap, and lowest on the camera's side.
          const rise = Math.min(0.12 + rnd() * 0.08, top * 0.25);
          const peak: V3 = c((u0 + u1) / 2, (v0 + v1) / 2, top + rise);
          mass.tri(c(u0, v1, top), c(u1, v1, top), peak, roof, [0, 1, 1]);
          mass.tri(c(u1, v0, top), c(u0, v0, top), peak, roof, [0, 1, -1]);
          mass.tri(c(u1, v1, top), c(u1, v0, top), peak, roof, [1, 1, 0]);
          mass.tri(c(u0, v0, top), c(u0, v1, top), peak, roof, [-1, 1, 0]);
        }
        if (top > 0.5) {
          // A band of windows on the face the camera sees.
          const y = top * 0.55;
          const front = v1 + 0.003;
          const [a, b] = [u0 + 0.08, u1 - 0.08];
          const p = (u: number, h: number) => c(u, front, h);
          mass.quad(p(a, y), p(b, y), p(b, y + 0.1), p(a, y + 0.1), style.window, [0, 0, 1]);
        }
      }
    }
  }
  return mass.build('city outskirts');
}
