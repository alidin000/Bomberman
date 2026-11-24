import * as THREE from 'three';
import type { CityLookId } from '../../../../content/cityColors';
import {
  Cell, GeometryBuilder, Lot, Outline, STREET_CLASSES, V2, V3, blockOutlines, cellId, chainLoops,
  cutLots, hashString, insetOutline, pick, seeded, shadeHex, unitEdges, world, wx, wz,
} from './cityGeometry';
import { buildBoardLandmarks, type BoardLandmark } from './boardLandmarks';

/**
 * A city's building cells drawn as merged buildings instead of one wall cube
 * per cell (docs/CITY_BUILDINGS_PLAN.md). Rendering only: the grid's `W`
 * cells stay walls. Built once per map from the render mask, as two
 * geometries drawn on the wall layer's program (scene/city/CityBuildings.tsx):
 * - `mass`: what casts shadows (kerb slab, walls with their bands, cornices,
 *   parapets, roofs, dormers, turrets, the board's landmark);
 * - `detail`: what does not (windows, shutters, balconies, terraces,
 *   crossing stripes, tram rails, chains and railings).
 *
 * Buildings rise to several storeys. What they would hide is handled by the
 * cut-away (scene/city/cutaway.ts): near a player, a bomb or a blast they
 * sink below today's wall height. The border row nearest the camera stays low,
 * so the board's last row is never hidden.
 */

/** Highest point of any building body: parapet, mansard or ridge. */
export const BODY_CAP = 2.1;
/** Highest point anywhere: corner turrets, stair towers, the bridge's towers. */
export const FEATURE_CAP = 2.5;
/** The border row nearest the camera: as low as today's walls. */
export const SOUTH_ROW_CAP = 0.94;

export type CityRoof = 'flat' | 'hipped' | 'mansard';

/** A city's crates drawn as small street buildings (StaticTiles.tsx). */
export type CrateStyle = 'logs' | 'jars' | 'barrels' | 'casks' | 'crateStack' | 'produce' | 'boxes';

export interface CityBuildingStyle {
  roof: CityRoof;
  /**
   * Facade colours, picked per lot. Each keeps at least the floor contrast
   * today's wall has and stays as far from flame orange (cityBuildings.test.ts).
   */
  facades: readonly string[];
  /** Roof colours (tiles or slate), under the same rules as facades. */
  roofs: readonly string[];
  /** Cornices, frames, string courses and balcony slabs. */
  trim: string;
  /** Window glass: dark, but never near flame orange. */
  window: string;
  /** Window shutters (Rome's green ones); none when absent. */
  shutter?: string;
  /** Balcony railings. */
  railing: string;
  /** Flat-roof terraces, a roof surface: the facade rules apply. */
  terrace: string;
  /** Corner turret caps (Budapest's slate cones). */
  turretRoof: string;
  pavement: string;
  kerb: string;
  stripe: string;
  rail: string;
  /** Eaves height range: the top of the facade, below the parapet or roof. */
  eaves: readonly [number, number];
  /** Extra height for border buildings away from the camera (north and sides). */
  ringBoost: number;
  /** Hipped roofs' rise above the eaves. */
  rise: readonly [number, number];
  /** Storey heights: the ground floor, then the floors above. */
  groundFloor: number;
  floor: number;
  /** Street-corner chamfer (Barcelona's xamfrans); 0 keeps corners square. */
  chamfer: number;
  /** Balconies on street fronts: on every floor, the first floor only, or none. */
  balconies: 'all' | 'first' | 'none';
  /** Pilasters between bays (Budapest's eclectic fronts). */
  pilasters: boolean;
  /** Joint lines on the ground floor's stone base. */
  rustication: boolean;
  /** Chance a street corner carries a turret. */
  turrets: number;
  /** The board's landmark on its `m` cells, and the stone it is built of. */
  landmark?: BoardLandmark;
  landmarkStone: string;
  /** Stone rims where the river meets the bank. */
  quay: string;
  /** What the city's crates look like: its goods, never small buildings. */
  crate: CrateStyle;
}

export const CITY_BUILDING_STYLES: Readonly<Record<CityLookId, CityBuildingStyle>> = {
  barcelona: {
    roof: 'flat',
    facades: ['#b3855a', '#a87b52', '#9f7550'],
    roofs: ['#965c40', '#8f5a3e'],
    trim: '#d9b88a',
    window: '#3b3f46',
    railing: '#2f3133',
    terrace: '#9c7a5a',
    turretRoof: '#6f5a48',
    pavement: '#d8d3c8',
    kerb: '#aaa498',
    stripe: '#f7f5ef',
    rail: '#6d6a66',
    eaves: [1.15, 1.4],
    ringBoost: 0.25,
    rise: [0, 0],
    groundFloor: 0.3,
    floor: 0.25,
    chamfer: 0.34,
    balconies: 'all',
    pilasters: false,
    rustication: false,
    turrets: 0,
    landmarkStone: '#9c7650',
    quay: '#c9bfae',
    crate: 'boxes',
  },
  rome: {
    roof: 'hipped',
    facades: ['#a9664a', '#9e5d4a', '#a3634e'],
    roofs: ['#9c5236', '#86462f'],
    trim: '#d8cbb0',
    window: '#3a3534',
    shutter: '#4f6146',
    railing: '#33302e',
    terrace: '#9e5d4a',
    turretRoof: '#86462f',
    pavement: '#d9cdb6',
    kerb: '#b0a48e',
    stripe: '#f4f0e6',
    rail: '#6b645c',
    eaves: [0.95, 1.2],
    ringBoost: 0.25,
    rise: [0.18, 0.24],
    groundFloor: 0.28,
    floor: 0.24,
    chamfer: 0,
    balconies: 'first',
    pilasters: false,
    rustication: true,
    turrets: 0,
    landmark: 'colosseum',
    landmarkStone: '#877254',
    quay: '#cdbf9f',
    crate: 'produce',
  },
  budapest: {
    roof: 'mansard',
    facades: ['#7b7d90', '#7f7a6d', '#77738a', '#6f7284'],
    roofs: ['#4e5163', '#3f4250', '#8f4a3f'],
    trim: '#c9c6bd',
    window: '#2f3341',
    railing: '#2c2e34',
    terrace: '#6d6f7c',
    turretRoof: '#3f4250',
    pavement: '#cfd1d6',
    kerb: '#a3a6ad',
    stripe: '#f2f3f5',
    rail: '#5d5f66',
    eaves: [1.1, 1.35],
    ringBoost: 0.25,
    rise: [0.07, 0.1],
    groundFloor: 0.3,
    floor: 0.25,
    chamfer: 0,
    balconies: 'first',
    pilasters: true,
    rustication: true,
    turrets: 0.55,
    landmark: 'chainBridge',
    landmarkStone: '#837c6d',
    quay: '#a9a59b',
    crate: 'casks',
  },
};

/** The wall classes a style's buildings draw: building and border walls, and its landmark. */
export function buildingClasses(style: CityBuildingStyle): string {
  return style.landmark ? 'bem' : 'be';
}

// --- Sizes (world units; a cell is 1) ---------------------------------------------
const INSET = 0.07; // facade back from the cell edge: the street stays wide
const KERB_INSET = 0.012;
const KERB_HEIGHT = 0.022;
const PARAPET_HEIGHT = 0.06;
const PARAPET_WIDTH = 0.045;
const CORNICE = 0.045;
const CORNICE_DEPTH = 0.03;
const BAY = 0.3;
const DECAL = 0.004;
const BALCONY_DEPTH = 0.05;
const OVERHANG = 0.035;
const GUTTER = 0.018;
const MANSARD_HEIGHT = 0.3;
const MANSARD_INSET = 0.12;
const SOUTH_EAVE = 0.78;

type Builders = { mass: GeometryBuilder; detail: GeometryBuilder };

// --- Facades --------------------------------------------------------------------------
type Facing = 'front' | 'side' | 'back';

function facingOf(normal: V2): Facing {
  if (normal.v > 0.35) return 'front';
  if (normal.v < -0.35) return 'back';
  return 'side';
}

type FacadeColors = { wall: string; plinth: string; joint: string };

type FacadeEdge = { p0: V2; p1: V2; normal: V2; street: boolean };

/**
 * One wall of a building: a stone base, the storeys with framed windows
 * (shutters, balconies, pilasters by style) and a cornice. North faces, which
 * the camera never sees, stay plain.
 */
function facade(
  { mass, detail }: Builders,
  {
    p0, p1, normal, street
  }: FacadeEdge,
  heights: { base: number; eave: number; top: number },
  colors: FacadeColors,
  style: CityBuildingStyle,
  rnd: () => number
) {
  const { base, eave, top } = heights;
  const facing: V3 = [normal.u, 0, normal.v];
  const length = Math.hypot(p1.u - p0.u, p1.v - p0.v);
  if (length < 1e-6) return;
  const along = { u: (p1.u - p0.u) / length, v: (p1.v - p0.v) / length };
  const at = (t: number): V2 => ({ u: p0.u + along.u * t, v: p0.v + along.v * t });
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
  // A shelf standing off the wall: its top, then its front.
  const ledge = (y: number, depth: number, hex: string, t0 = 0, t1 = length) => {
    mass.quad(
      world(at(t0), y, normal, 0),
      world(at(t1), y, normal, 0),
      world(at(t1), y, normal, depth),
      world(at(t0), y, normal, depth),
      hex,
      [0, 1, 0]
    );
    band(mass, y - 0.02, y, hex, depth, t0, t1);
  };
  const kind = facingOf(normal);
  if (kind === 'back') {
    band(mass, base, top, colors.wall);
    return;
  }
  const groundTop = Math.min(base + style.groundFloor, eave - CORNICE - 0.12);
  band(mass, base, groundTop, colors.plinth);
  band(mass, groundTop, eave - CORNICE, colors.wall);
  band(mass, eave - CORNICE, eave, style.trim);
  if (top > eave) band(mass, eave, top, colors.wall);
  ledge(eave, CORNICE_DEPTH, style.trim);
  band(detail, groundTop, groundTop + 0.022, style.trim, DECAL);
  if (style.rustication) {
    for (let y = base + 0.07; y < groundTop - 0.03; y += 0.07) {
      band(detail, y, y + 0.009, colors.joint, DECAL);
    }
  }
  if (length < 0.24) return;

  const bays = Math.max(1, Math.round(length / BAY));
  const bay = length / bays;
  const upperTop = eave - CORNICE - 0.02;
  const floors = Math.max(1, Math.round((upperTop - groundTop) / style.floor));
  const floor = (upperTop - groundTop) / floors;
  const half = bay * (kind === 'front' ? 0.2 : 0.17);
  const balconyFloors = kind === 'front' && street
    ? { all: floors, first: 1, none: 0 }[style.balconies]
    : 0;
  for (let index = 0; index < bays; index += 1) {
    const centre = (index + 0.5) * bay;
    if (style.pilasters && index > 0) {
      const t = index * bay;
      band(detail, groundTop + 0.022, upperTop, style.trim, DECAL, t - 0.016, t + 0.016);
    }
    // Ground floor: shopfronts and doors on a street, small windows elsewhere.
    if (street && kind === 'front') {
      const shop = (bay * (rnd() < 0.3 ? 0.34 : 0.6)) / 2;
      const shopTop = groundTop - 0.04;
      band(detail, base + 0.03, shopTop, style.window, DECAL, centre - shop, centre + shop);
    } else {
      const low = half * 0.8;
      band(detail, base + 0.1, groundTop - 0.07, style.window, DECAL, centre - low, centre + low);
    }
    for (let level = 0; level < floors; level += 1) {
      const y0 = groundTop + level * floor + floor * 0.2;
      const y1 = y0 + floor * 0.58;
      const frame = half + 0.018;
      band(detail, y0 - 0.018, y1 + 0.018, style.trim, DECAL, centre - frame, centre + frame);
      band(detail, y0, y1, style.window, DECAL * 2, centre - half, centre + half);
      if (style.shutter) {
        band(detail, y0, y1, style.shutter, DECAL * 2, centre - half - 0.075, centre - half - 0.02);
        band(detail, y0, y1, style.shutter, DECAL * 2, centre + half + 0.02, centre + half + 0.075);
      }
      if (level < balconyFloors) {
        const reach = half + 0.035;
        const slab = y0 - 0.02;
        const p = at(centre - reach);
        const q = at(centre + reach);
        detail.quad(
          world(p, slab, normal, 0.001),
          world(q, slab, normal, 0.001),
          world(q, slab, normal, BALCONY_DEPTH),
          world(p, slab, normal, BALCONY_DEPTH),
          style.trim,
          [0, 1, 0]
        );
        detail.quad(
          world(p, slab, normal, BALCONY_DEPTH),
          world(q, slab, normal, BALCONY_DEPTH),
          world(q, slab + 0.07, normal, BALCONY_DEPTH),
          world(p, slab + 0.07, normal, BALCONY_DEPTH),
          style.railing,
          facing
        );
      }
    }
  }
}

// --- Roofs ----------------------------------------------------------------------------
/** A flat roof inside a parapet; holes are courtyards. */
function flatRoof(
  mass: GeometryBuilder,
  outlines: Outline[],
  eave: number,
  wallFor: (lot: number) => string,
  roofHex: string,
  style: CityBuildingStyle
) {
  const top = eave + PARAPET_HEIGHT;
  const inner = outlines.map((outline) => insetOutline(outline, PARAPET_WIDTH));
  outlines.forEach((outline, loopIndex) => {
    const ring = inner[loopIndex];
    outline.points.forEach((p, index) => {
      const next = (index + 1) % outline.points.length;
      const q = outline.points[next];
      mass.quad(
        world(p, top),
        world(q, top),
        world(ring[next], top),
        world(ring[index], top),
        style.trim,
        [0, 1, 0]
      );
      const n = outline.edges[index].normal;
      mass.quad(
        world(ring[index], eave),
        world(ring[next], eave),
        world(ring[next], top),
        world(ring[index], top),
        shadeHex(wallFor(outline.edges[index].lot), 0.92),
        [-n.u, 0, -n.v]
      );
    });
  });
  const outer = outlines.findIndex((outline) => outline.area > 0);
  if (outer < 0) return;
  const holes = inner.filter((_ring, index) => index !== outer && outlines[index].area < 0);
  mass.cap(inner[outer], holes, eave, roofHex);
}

/** A hipped cap over a rectangle: a ridge along its long side. */
function hipCap(
  mass: GeometryBuilder,
  rect: { u0: number; u1: number; v0: number; v1: number },
  y: number,
  rise: number,
  hex: string
) {
  const {
    u0, u1, v0, v1,
  } = rect;
  const c = (u: number, v: number, h: number): V3 => [wx(u), h, wz(v)];
  const ridge = y + rise;
  const up: V3 = [0, 1, 0];
  if (u1 - u0 >= v1 - v0) {
    const half = (v1 - v0) / 2;
    const vm = (v0 + v1) / 2;
    const ra = c(u0 + half, vm, ridge);
    const rb = c(u1 - half, vm, ridge);
    mass.quad(c(u0, v1, y), c(u1, v1, y), rb, ra, hex, up);
    mass.quad(c(u1, v0, y), c(u0, v0, y), ra, rb, hex, up);
    mass.tri(c(u0, v0, y), c(u0, v1, y), ra, hex, up);
    mass.tri(c(u1, v1, y), c(u1, v0, y), rb, hex, up);
  } else {
    const half = (u1 - u0) / 2;
    const um = (u0 + u1) / 2;
    const ra = c(um, v0 + half, ridge);
    const rb = c(um, v1 - half, ridge);
    mass.quad(c(u0, v0, y), c(u0, v1, y), rb, ra, hex, up);
    mass.quad(c(u1, v1, y), c(u1, v0, y), ra, rb, hex, up);
    mass.tri(c(u0, v1, y), c(u1, v1, y), rb, hex, up);
    mass.tri(c(u1, v0, y), c(u0, v0, y), ra, hex, up);
  }
}

/** A lot's roof footprint: overhanging its street sides, a gutter on shared ones. */
function roofRect(lot: Lot, external: (dir: number) => boolean) {
  const edge = (outside: boolean) => (outside ? INSET - OVERHANG : GUTTER);
  return {
    u0: lot.x + edge(external(2)),
    u1: lot.x + lot.w - edge(external(0)),
    v0: lot.y + edge(external(3)),
    v1: lot.y + lot.h - edge(external(1)),
  };
}

/** The eaves' fascia around a roof rectangle: a roof with some thickness. */
function fascia(
  mass: GeometryBuilder,
  rect: ReturnType<typeof roofRect>,
  eave: number,
  hex: string
) {
  const {
    u0, u1, v0, v1,
  } = rect;
  const low = eave - 0.022;
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
  const side = (ua: number, va: number, ub: number, vb: number, facing: V3) => {
    mass.quad(c(ua, va, low), c(ub, vb, low), c(ub, vb, eave), c(ua, va, eave), hex, facing);
  };
  side(u0, v1, u1, v1, [0, 0, 1]);
  side(u1, v0, u0, v0, [0, 0, -1]);
  side(u1, v1, u1, v0, [1, 0, 0]);
  side(u0, v0, u0, v1, [-1, 0, 0]);
}

/**
 * A mansard: a steep slate slope with dormers on the street front, then a
 * low hip on top (Budapest's Pest blocks).
 */
function mansardRoof(
  { mass, detail }: Builders,
  lot: Lot,
  external: (dir: number) => boolean,
  eave: number,
  rise: number,
  hex: string,
  style: CityBuildingStyle
) {
  const rect = roofRect(lot, external);
  fascia(mass, rect, eave, shadeHex(hex, 0.7));
  const top = eave + MANSARD_HEIGHT;
  const inner = {
    u0: rect.u0 + MANSARD_INSET,
    u1: rect.u1 - MANSARD_INSET,
    v0: rect.v0 + MANSARD_INSET,
    v1: rect.v1 - MANSARD_INSET,
  };
  const c = (u: number, v: number, y: number): V3 => [wx(u), y, wz(v)];
  // Corners at the eaves (o) and at the top of the slope (i); +v is south.
  const o = {
    sw: c(rect.u0, rect.v1, eave),
    se: c(rect.u1, rect.v1, eave),
    ne: c(rect.u1, rect.v0, eave),
    nw: c(rect.u0, rect.v0, eave),
  };
  const i = {
    sw: c(inner.u0, inner.v1, top),
    se: c(inner.u1, inner.v1, top),
    ne: c(inner.u1, inner.v0, top),
    nw: c(inner.u0, inner.v0, top),
  };
  mass.quad(o.sw, o.se, i.se, i.sw, hex, [0, 0.4, 1]);
  mass.quad(o.ne, o.nw, i.nw, i.ne, hex, [0, 0.4, -1]);
  mass.quad(o.se, o.ne, i.ne, i.se, hex, [1, 0.4, 0]);
  mass.quad(o.nw, o.sw, i.sw, i.nw, hex, [-1, 0.4, 0]);
  hipCap(mass, inner, top, rise, shadeHex(hex, 1.12));
  if (!external(1)) return;
  // Dormers on the front slope, each a small box with a window and a cap.
  const count = Math.max(1, Math.floor((rect.u1 - rect.u0) / 0.42));
  const step = (rect.u1 - rect.u0) / count;
  for (let index = 0; index < count; index += 1) {
    const u = rect.u0 + (index + 0.5) * step;
    const v1 = rect.v1 - 0.03;
    const v0 = v1 - 0.1;
    mass.box(u - 0.07, u + 0.07, v0, v1, eave, eave + 0.2, style.trim, style.trim);
    hipCap(mass, {
      u0: u - 0.085, u1: u + 0.085, v0: v0 - 0.01, v1: v1 + 0.015,
    }, eave + 0.2, 0.06, hex);
    detail.quad(
      [wx(u - 0.045), eave + 0.04, wz(v1) + DECAL],
      [wx(u + 0.045), eave + 0.04, wz(v1) + DECAL],
      [wx(u + 0.045), eave + 0.16, wz(v1) + DECAL],
      [wx(u - 0.045), eave + 0.16, wz(v1) + DECAL],
      style.window,
      [0, 0, 1]
    );
  }
}

/** An octagonal corner turret with a pointed slate cap (Budapest's corner towers). */
function turret(
  mass: GeometryBuilder,
  centre: V2,
  eave: number,
  wall: string,
  style: CityBuildingStyle
) {
  const radius = 0.15;
  const y0 = eave - 0.3;
  const y1 = eave + 0.3;
  const apex = y1 + 0.32;
  const sides = 8;
  const point = (index: number, r: number, y: number): V3 => {
    const angle = (index / sides) * Math.PI * 2 + Math.PI / sides;
    return [wx(centre.u + Math.cos(angle) * r), y, wz(centre.v + Math.sin(angle) * r)];
  };
  for (let index = 0; index < sides; index += 1) {
    const a = (index / sides) * Math.PI * 2 + Math.PI / sides + Math.PI / sides;
    const facing: V3 = [Math.cos(a), 0, Math.sin(a)];
    const foot0 = point(index, radius, y0);
    const foot1 = point(index + 1, radius, y0);
    const head0 = point(index, radius, y1);
    const head1 = point(index + 1, radius, y1);
    const eave0 = point(index, radius + 0.02, y1 + 0.03);
    const eave1 = point(index + 1, radius + 0.02, y1 + 0.03);
    const peak: V3 = [wx(centre.u), apex, wz(centre.v)];
    mass.quad(foot0, foot1, head1, head0, wall, facing);
    mass.quad(head0, head1, eave1, eave0, style.trim, [facing[0], 1, facing[2]]);
    mass.tri(eave0, eave1, peak, style.turretRoof, [facing[0], 0.6, facing[2]]);
  }
}

// --- Street details -------------------------------------------------------------------
function streetDetails(detail: GeometryBuilder, rows: readonly string[], style: CityBuildingStyle) {
  const classAt = (x: number, y: number) => rows[y]?.[x] ?? 'e';
  const roadLike = (x: number, y: number) => ['r', 'x', 't'].includes(classAt(x, y));
  const y = 0.004;
  const c = (u: number, v: number): V3 => [wx(u), y, wz(v)];
  // A flat mark on the floor, unshaded so stripes stay as bright as painted.
  const flat = (u0: number, u1: number, v0: number, v1: number, hex: string) => {
    detail.quad(c(u0, v0), c(u1, v0), c(u1, v1), c(u0, v1), hex, [0, 1, 0], 1);
  };
  rows.forEach((row, cy) => {
    Array.from(row).forEach((cls, cx) => {
      if (cls === 'x') {
        // Zebra bars run with the traffic: along the axis with more road beside it.
        const across = Number(roadLike(cx - 1, cy)) + Number(roadLike(cx + 1, cy));
        const down = Number(roadLike(cx, cy - 1)) + Number(roadLike(cx, cy + 1));
        for (let bar = 0; bar < 4; bar += 1) {
          const s0 = cx + 0.14 + bar * 0.2;
          const t0 = cy + 0.14 + bar * 0.2;
          if (across >= down) flat(cx + 0.08, cx + 0.92, t0, t0 + 0.11, style.stripe);
          else flat(s0, s0 + 0.11, cy + 0.08, cy + 0.92, style.stripe);
        }
      } else if (cls === 't') {
        const across = Number(classAt(cx - 1, cy) === 't') + Number(classAt(cx + 1, cy) === 't');
        const down = Number(classAt(cx, cy - 1) === 't') + Number(classAt(cx, cy + 1) === 't');
        [0.36, 0.64].forEach((offset) => {
          const r0 = offset - 0.018;
          const r1 = offset + 0.018;
          if (across >= down) flat(cx, cx + 1, cy + r0, cy + r1, style.rail);
          else flat(cx + r0, cx + r1, cy, cy + 1, style.rail);
        });
      }
    });
  });
}

// --- The whole map --------------------------------------------------------------------
export type CityBuildingGeometry = {
  mass: THREE.BufferGeometry;
  detail: THREE.BufferGeometry;
  blocks: number;
  cells: number;
  /** Highest building body (parapet, mansard or ridge) over all blocks. */
  bodyTop: number;
  /** Highest body top in the border row nearest the camera. */
  southRowTop: number;
  /** Highest point anywhere, features and the landmark included. */
  featureTop: number;
  /**
   * For fog of war: each vertex's object (0: always shown), and each
   * object's cells as `y * width + x`. Absent, everything always shows.
   */
  owners?: { mass: Uint32Array; detail: Uint32Array; cells: readonly (readonly number[])[] };
  /** A city's roofs past the board (cityOutskirts.ts): no cut-away, no fog, no shadow. */
  outskirts?: THREE.BufferGeometry;
};

/**
 * Merged buildings for every 4-connected group of `b` cells in a city's
 * render mask (b cells are always grid walls: maskFitsGrid), the border ring
 * (`e`) cut into runs of houses, the style's landmark on its `m` cells, and
 * the street details. Deterministic for a map and style.
 */
export function buildCityBuildings(
  rows: readonly string[],
  style: CityBuildingStyle,
  seedText: string,
  classes = buildingClasses(style)
): CityBuildingGeometry {
  const builders: Builders = { mass: new GeometryBuilder(), detail: new GeometryBuilder() };
  const { mass } = builders;
  const classAt = (x: number, y: number) => rows[y]?.[x] ?? 'e';
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  // The border ring is cut into runs of 2-5 cells, so its row of houses varies.
  const ringGroup = new Map<number, number>();
  if (classes.includes('e')) {
    const ring: Cell[] = [];
    for (let x = 0; x < width; x += 1) ring.push({ x, y: 0 });
    for (let y = 1; y < height; y += 1) ring.push({ x: width - 1, y });
    for (let x = width - 2; x >= 0; x -= 1) ring.push({ x, y: height - 1 });
    for (let y = height - 2; y >= 1; y -= 1) ring.push({ x: 0, y });
    const ringRnd = seeded(hashString(`${seedText}|ring`));
    let group = 0;
    let left = 0;
    ring.forEach(({ x, y }) => {
      if (left <= 0) {
        group += 1;
        left = 2 + Math.floor(ringRnd() * 4);
      }
      left -= 1;
      if (classAt(x, y) === 'e') ringGroup.set(cellId(x, y), group);
    });
  }
  const groupOf = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return -1;
    const cls = classAt(x, y);
    if (cls === 'b' && classes.includes('b')) return 0;
    if (cls === 'e' && classes.includes('e')) return ringGroup.get(cellId(x, y)) ?? -1;
    return -1;
  };
  const isBuilding = (x: number, y: number) => groupOf(x, y) >= 0;
  const seen = new Set<number>();
  let blocks = 0;
  let cellCount = 0;
  let bodyTop = 0;
  let southRowTop = 0;
  let featureTop = 0;

  rows.forEach((row, y0) => Array.from(row).forEach((_cls, x0) => {
    if (!isBuilding(x0, y0) || seen.has(cellId(x0, y0))) return;
    // One block: flood the 4-connected cells of one group.
    const cells: Cell[] = [];
    const stack: Cell[] = [{ x: x0, y: y0 }];
    seen.add(cellId(x0, y0));
    while (stack.length) {
      const cell = stack.pop() as Cell;
      cells.push(cell);
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
        const nx = cell.x + dx;
        const ny = cell.y + dy;
        const sameGroup = isBuilding(nx, ny) && groupOf(nx, ny) === groupOf(x0, y0);
        if (sameGroup && !seen.has(cellId(nx, ny))) {
          seen.add(cellId(nx, ny));
          stack.push({ x: nx, y: ny });
        }
      });
    }
    blocks += 1;
    cellCount += cells.length;
    const members = new Set(cells.map(({ x, y }) => cellId(x, y)));
    const inBlock = (x: number, y: number) => members.has(cellId(x, y));
    const rnd = seeded(hashString(`${seedText}|${x0},${y0}`));
    const lots = cutLots(cells, 2, 2, rnd);
    const lotIndex = new Map<number, number>();
    lots.forEach((lot, index) => lot.cells.forEach(({ x, y }) => {
      lotIndex.set(cellId(x, y), index);
    }));
    const lotOf = (x: number, y: number) => lotIndex.get(cellId(x, y)) ?? -1;
    const lotWalls = lots.map(() => {
      const wall = pick(rnd, style.facades);
      return { wall, plinth: shadeHex(wall, 0.82), joint: shadeHex(wall, 0.66) };
    });
    const wallFor = (lot: number) => (lotWalls[lot] ?? lotWalls[0]).wall;

    // Height: the border row nearest the camera stays low; the rest of the
    // ring stands a little taller than the blocks inside it.
    const south = cells.some(({ y }) => y === height - 1);
    const ring = classAt(x0, y0) === 'e';
    let eave = style.eaves[0] + rnd() * (style.eaves[1] - style.eaves[0]);
    if (ring && !south) eave += style.ringBoost;
    if (south) eave = SOUTH_EAVE;
    const roof: CityRoof = south ? 'flat' : style.roof;
    const loops = chainLoops(unitEdges(cells, inBlock));

    // Kerb: a low pavement slab on the whole cells, square-cornered.
    const kerbs = blockOutlines(loops, inBlock, classAt, () => 0, KERB_INSET, 0);
    kerbs.forEach((outline) => outline.points.forEach((p, index) => {
      const q = outline.points[(index + 1) % outline.points.length];
      const n = outline.edges[index].normal;
      mass.quad(
        world(p, 0),
        world(q, 0),
        world(q, KERB_HEIGHT),
        world(p, KERB_HEIGHT),
        style.kerb,
        [n.u, 0, n.v]
      );
    }));
    const kerbOuter = kerbs.findIndex((outline) => outline.area > 0);
    if (kerbOuter >= 0) {
      const kerbHoles = kerbs.filter((o, i) => i !== kerbOuter && o.area < 0).map((o) => o.points);
      mass.cap(kerbs[kerbOuter].points, kerbHoles, KERB_HEIGHT, style.pavement);
    }

    // The block's walls on its inset, chamfered outline.
    const outlines = blockOutlines(loops, inBlock, classAt, lotOf, INSET, style.chamfer);
    const wallTop = roof === 'flat' ? eave + PARAPET_HEIGHT : eave;
    outlines.forEach((outline) => outline.points.forEach((p, index) => {
      const q = outline.points[(index + 1) % outline.points.length];
      const edge = outline.edges[index];
      facade(
        builders,
        {
          p0: p, p1: q, normal: edge.normal, street: edge.street,
        },
        { base: KERB_HEIGHT, eave, top: wallTop },
        lotWalls[edge.lot] ?? lotWalls[0],
        style,
        rnd
      );
    }));

    let blockTop = wallTop;
    if (roof === 'flat') {
      flatRoof(mass, outlines, eave, wallFor, pick(rnd, style.roofs), style);
      if (!south) {
        // Roof life: a set-back attic or stair house per lot, now and then.
        lots.forEach((lot, index) => {
          if (rnd() > 0.55) return;
          const cell = pick(rnd, lot.cells);
          const size = 0.2 + rnd() * 0.16;
          const u = cell.x + 0.2 + rnd() * (0.6 - size);
          const v = cell.y + 0.2 + rnd() * (0.6 - size);
          const lift = 0.12 + rnd() * 0.1;
          const wall = shadeHex(lotWalls[index].wall, 1.04);
          mass.box(u, u + size, v, v + size, eave, eave + lift, wall, style.trim);
          featureTop = Math.max(featureTop, eave + lift);
        });
      }
    } else {
      const outer = outlines.findIndex((outline) => outline.area > 0);
      if (outer >= 0) {
        const holes = outlines.filter((o, i) => i !== outer && o.area < 0).map((o) => o.points);
        mass.cap(outlines[outer].points, holes, eave, shadeHex(style.roofs[0], 0.62));
      }
      lots.forEach((lot) => {
        const external = (dir: number) => {
          const along = dir === 0 || dir === 2
            ? Array.from({ length: lot.h }, (_unused, j) => ({
              x: dir === 0 ? lot.x + lot.w : lot.x - 1, y: lot.y + j,
            }))
            : Array.from({ length: lot.w }, (_unused, i) => ({
              x: lot.x + i, y: dir === 1 ? lot.y + lot.h : lot.y - 1,
            }));
          return along.some(({ x, y }) => !inBlock(x, y));
        };
        const rise = style.rise[0] + rnd() * (style.rise[1] - style.rise[0]);
        const hex = pick(rnd, style.roofs);
        if (roof === 'mansard') {
          mansardRoof(builders, lot, external, eave, rise, hex, style);
          blockTop = Math.max(blockTop, eave + MANSARD_HEIGHT + rise);
        } else {
          const rect = roofRect(lot, external);
          fascia(mass, rect, eave, shadeHex(hex, 0.7));
          hipCap(mass, rect, eave, rise, hex);
          blockTop = Math.max(blockTop, eave + rise);
        }
      });
    }
    bodyTop = Math.max(bodyTop, blockTop);
    if (south) southRowTop = Math.max(southRowTop, blockTop);

    // Corner turrets where two street fronts meet (convex corners only).
    if (style.turrets > 0 && !south) {
      outlines.filter((outline) => outline.area > 0).forEach((outline) => {
        const count = outline.points.length;
        outline.points.forEach((p, index) => {
          const prev = outline.points[(index + count - 1) % count];
          const next = outline.points[(index + 1) % count];
          const inEdge = outline.edges[(index + count - 1) % count];
          const outEdge = outline.edges[index];
          const turn = (p.u - prev.u) * (next.v - p.v) - (p.v - prev.v) * (next.u - p.u);
          if (turn <= 0 || !inEdge.street || !outEdge.street || rnd() > style.turrets) return;
          // Inward from the corner along both walls' normals.
          const centre = {
            u: p.u - (inEdge.normal.u + outEdge.normal.u) * 0.13,
            v: p.v - (inEdge.normal.v + outEdge.normal.v) * 0.13,
          };
          turret(mass, centre, eave, wallFor(outEdge.lot), style);
          featureTop = Math.max(featureTop, eave + 0.62);
        });
      });
    }
  }));

  const landmarkTop = buildBoardLandmarks(builders, rows, style, classes.includes('m'));
  featureTop = Math.max(featureTop, bodyTop, landmarkTop);
  streetDetails(builders.detail, rows, style);
  return {
    mass: mass.build('city building mass'),
    detail: builders.detail.build('city building detail'),
    blocks,
    cells: cellCount,
    bodyTop,
    southRowTop,
    featureTop,
  };
}

export { STREET_CLASSES };
