import {
  GeometryBuilder, V3, hashString, lathe, pick, seeded, shadeHex, wx, wz,
} from './cityGeometry';
import type { VillageBuildingStyle } from './villageBuildings';

/**
 * A village's border ring as one continuous edge instead of a prop per cell
 * (after the stage atlas): cliffs with a wandering top, strata and boulders
 * for the rock villages; overlapping broadleaf crowns with taller conifers
 * behind them for Leaf. Each cell builds its own slice, so fog still shows
 * and hides the border cell by cell, but the slices meet: heights and the
 * cliff's lean are sampled on the shared edges. Nothing reaches inward past
 * its cell; trees overhang only outward, off the board.
 */

type Builders = { mass: GeometryBuilder; detail: GeometryBuilder };

export type BorderSide = 'north' | 'south' | 'west' | 'east';

/** Which run of the ring a border cell is on; corners belong to the north and south rows. */
export function borderSide(x: number, y: number, width: number, height: number): BorderSide {
  if (y === 0) return 'north';
  if (y === height - 1) return 'south';
  // Only ring cells reach here: x is 0 or width - 1.
  return x === 0 ? 'west' : 'east';
}

/** Highest rock or crown on the border away from the camera (VILLAGE_TREE_CAP). */
const BORDER_TOP = 2.1;
/** The border row nearest the camera (VILLAGE_SOUTH_CAP). */
const SOUTH_TOP = 0.94;

/**
 * A cell's slice in border space: `s` runs along the border (0 to 1), `d`
 * across it, from 0 at the map's edge to 1 where the board begins.
 */
function borderSpace(side: BorderSide, x: number, y: number) {
  const uv = (s: number, d: number) => {
    switch (side) {
      case 'north': return { u: x + s, v: y + d };
      case 'south': return { u: x + s, v: y + 1 - d };
      case 'west': return { u: x + d, v: y + s };
      default: return { u: x + 1 - d, v: y + s };
    }
  };
  const at = (s: number, d: number, h: number): V3 => {
    const { u, v } = uv(s, d);
    return [wx(u), h, wz(v)];
  };
  return { uv, at };
}

const INWARD: Record<BorderSide, V3> = {
  north: [0, 0.3, 1],
  south: [0, 0.3, -1],
  west: [1, 0.3, 0],
  east: [-1, 0.3, 0],
};

/**
 * A slice of cliff. North and side runs show the board a battered rock face
 * leaning back from its foot, two darker strata and now and then a boulder at
 * the foot, under a lip of `cliffTop`. The south run stays low and shows the
 * camera its outer face. Returns the slice's top.
 */
export function cliffCell(
  { mass, detail }: Builders,
  x: number,
  y: number,
  side: BorderSide,
  style: VillageBuildingStyle,
  seedText: string
): number {
  const { uv, at } = borderSpace(side, x, y);
  const along = side === 'north' || side === 'south' ? x : y;
  // Sampled on half cells along the whole run, so neighbouring slices meet.
  const sample = (key: string, g: number) => seeded(
    hashString(`${seedText}|cliff|${side}|${key}|${Math.round(g * 2)}`)
  )();
  const south = side === 'south';
  const low = south ? 0.55 : 1.45;
  const high = south ? SOUTH_TOP - 0.04 : BORDER_TOP - 0.06;
  const height = (g: number) => low + sample('h', g) * (high - low);
  // How far back the face leans at its top, and where its foot stands.
  const lean = (g: number) => 0.66 + sample('lean', g) * 0.1;
  const foot = (g: number) => 0.88 + sample('foot', g) * 0.06;
  const toneRnd = seeded(hashString(`${seedText}|tone|${side}|${Math.floor(along / 3)}`));
  const face = pick(toneRnd, style.borderTones);
  const lip = style.cliffTop ?? shadeHex(face, 1.12);
  const band = shadeHex(face, 0.78);
  const samples = [0, 0.5, 1];
  let top = 0;
  for (let index = 0; index + 1 < samples.length; index += 1) {
    const a = samples[index];
    const b = samples[index + 1];
    const ha = height(along + a);
    const hb = height(along + b);
    // The north and side runs' lip rises 0.05 to the map's edge; the south row's is flat.
    const lift = south ? 0 : 0.05;
    top = Math.max(top, ha + lift, hb + lift);
    if (south) {
      // A low lip of rock: its top, and the outer face the camera sees.
      mass.quad(at(a, 0.1, ha), at(b, 0.1, hb), at(b, 0.86, hb), at(a, 0.86, ha), lip, [0, 1, 0]);
      mass.quad(at(a, 0.02, 0), at(b, 0.02, 0), at(b, 0.1, hb), at(a, 0.1, ha), face, [0, 0.3, 1]);
      const mid = (h: number) => h * 0.5;
      detail.quad(
        at(a, 0.05, mid(ha)),
        at(b, 0.05, mid(hb)),
        at(b, 0.055, mid(hb) + 0.05),
        at(a, 0.055, mid(ha) + 0.05),
        band,
        [0, 0.3, 1]
      );
    } else {
      const la = lean(along + a);
      const lb = lean(along + b);
      const fa = foot(along + a);
      const fb = foot(along + b);
      const facing = INWARD[side];
      mass.quad(at(a, fa, 0), at(b, fb, 0), at(b, lb, hb), at(a, la, ha), face, facing);
      const back = (s: number, h: number) => at(s, 0, h + 0.05);
      mass.quad(at(a, la, ha), at(b, lb, hb), back(b, hb), back(a, ha), lip, [0, 1, 0]);
      // Strata: two darker courses across the face, just proud of it.
      [0.34, 0.66].forEach((f) => {
        const g = f + 0.06;
        const on = (s: number, fo: number, le: number, h: number, k: number) => (
          at(s, fo + (le - fo) * k + 0.01, h * k)
        );
        const p0 = on(a, fa, la, ha, f);
        const p1 = on(b, fb, lb, hb, f);
        detail.quad(p0, p1, on(b, fb, lb, hb, g), on(a, fa, la, ha, g), band, facing);
      });
    }
  }
  if (!south) {
    // A boulder at the foot, now and then.
    const rnd = seeded(hashString(`${seedText}|boulder|${x},${y}`));
    if (rnd() < 0.45) {
      const radius = 0.08 + rnd() * 0.04;
      const { u, v } = uv(0.2 + rnd() * 0.6, 0.84);
      const tall = 0.13 + rnd() * 0.08;
      lathe(mass, u, v, [
        { r: radius, y: 0 },
        { r: radius * 0.9, y: tall * 0.6 },
        { r: radius * 0.4, y: tall },
      ], shadeHex(face, 0.92), rnd() * Math.PI, 5);
    }
  }
  return top;
}

/** The +z face that closes a side run's cliff where it meets the south row. */
export function cliffEnd(
  { mass }: Builders,
  x: number,
  y: number,
  side: 'west' | 'east',
  style: VillageBuildingStyle,
  seedText: string
) {
  const { at } = borderSpace(side, x, y);
  const sample = (key: string, g: number) => seeded(
    hashString(`${seedText}|cliff|${side}|${key}|${Math.round(g * 2)}`)
  )();
  const g = y + 1;
  const h = 1.45 + sample('h', g) * (BORDER_TOP - 0.06 - 1.45);
  const lean = 0.66 + sample('lean', g) * 0.1;
  const foot = 0.88 + sample('foot', g) * 0.06;
  const toneRnd = seeded(hashString(`${seedText}|tone|${side}|${Math.floor(y / 3)}`));
  const face = shadeHex(pick(toneRnd, style.borderTones), 0.9);
  mass.quad(at(1, foot, 0), at(1, 0, 0), at(1, 0, h + 0.05), at(1, lean, h), face, [0, 0, 1]);
}

/**
 * A slice of forest: a broadleaf crown set a little outward, wide enough to
 * overlap its neighbours along the ring, and often a taller conifer behind it,
 * off the board. Returns the slice's top.
 */
export function forestCell(
  { mass }: Builders,
  x: number,
  y: number,
  side: BorderSide,
  width: number,
  height: number,
  style: VillageBuildingStyle,
  rnd: () => number
): number {
  // Outward: off the board, diagonally at the corners.
  let ou = 0;
  let ov = 0;
  if (side === 'north') ov = -1;
  if (side === 'west' || (side === 'north' && x === 0)) ou = -1;
  if (side === 'east' || (side === 'north' && x === width - 1)) ou = 1;
  const length = Math.hypot(ou, ov) || 1;
  ou /= length;
  ov /= length;
  const jitter = (rnd() - 0.5) * 0.14;
  const alongU = side === 'north' ? jitter : 0;
  const alongV = side === 'north' ? 0 : jitter;
  const cu = x + 0.5 + ou * 0.15 + alongU;
  const cv = y + 0.5 + ov * 0.15 + alongV;
  const radius = 0.5 + rnd() * 0.08;
  const top = 1.35 + rnd() * 0.4;
  const trunkTop = top * 0.34;
  const { trunk } = style;
  mass.box(cu - 0.05, cu + 0.05, cv - 0.05, cv + 0.05, 0, trunkTop + 0.05, trunk, trunk);
  const crown = top - trunkTop;
  lathe(mass, cu, cv, [
    { r: radius * 0.5, y: trunkTop },
    { r: radius, y: trunkTop + crown * 0.3 },
    { r: radius * 0.84, y: trunkTop + crown * 0.62 },
    { r: radius * 0.35, y: top },
  ], pick(rnd, style.borderTones), rnd() * Math.PI, 7);
  let peak = top;
  if (rnd() < 0.6 && height > 2) {
    // A conifer off the board, behind the crowns: tiered, and taller.
    const pu = x + 0.5 + ou * 0.75;
    const pv = y + 0.5 + ov * 0.75;
    const tall = 1.8 + rnd() * (BORDER_TOP - 0.05 - 1.8);
    mass.box(pu - 0.04, pu + 0.04, pv - 0.04, pv + 0.04, 0, 0.4, trunk, trunk);
    lathe(mass, pu, pv, [
      { r: 0.36, y: 0.32 },
      { r: 0.13, y: tall * 0.55 },
      { r: 0.27, y: tall * 0.52 },
      { r: 0, y: tall },
    ], shadeHex(pick(rnd, style.borderTones), 0.85), rnd() * Math.PI, 6);
    peak = Math.max(peak, tall);
  }
  return peak;
}
