import * as THREE from 'three';
import { VILLAGE_SYMBOLS, VillageSymbolId } from '../../../../content/villageSymbols';

/**
 * Painted marks as geometry: the village symbols (content/villageSymbols.ts
 * path data, read with a small SVG path reader) and the six brush kanji the
 * villages hang on their great buildings, from this game's own stroke data.
 * No font and no texture: every mark is a few flat strips merged into the
 * landmark or square geometry it sits on, so it costs no draw call and no
 * shader program of its own.
 *
 * All marks live in the symbols' 100x100 box, y down. `markGeometries`
 * centres them on a plate of the given size, facing +z.
 */

export type Point = [number, number];
export type Subpath = { points: Point[]; closed: boolean };

/** The kanji the great buildings carry: 火 風 水 雷 土, and the alliance's 忍. */
export type GlyphId = 'fire' | 'wind' | 'water' | 'lightning' | 'earth' | 'endure';

const open = (...points: Point[]): Subpath => ({ points, closed: false });
const loop = (...points: Point[]): Subpath => ({ points, closed: true });

export const GLYPH_STROKES: Record<GlyphId, Subpath[]> = {
  // 火: two dots, the falling stroke from the top, the sweep to the right.
  fire: [
    open([27, 37], [35, 52]),
    open([74, 32], [64, 50]),
    open([50, 12], [50, 52], [44, 68], [22, 90]),
    open([52, 58], [66, 76], [84, 90]),
  ],
  // 風: the wind frame with its hooked right leg, and the insect inside.
  wind: [
    open([24, 12], [24, 64], [14, 90]),
    open([24, 12], [74, 12], [74, 78], [80, 88], [90, 86]),
    open([38, 26], [62, 22]),
    loop([36, 38], [62, 38], [62, 58], [36, 58]),
    open([49, 30], [49, 74]),
    open([34, 74], [64, 74]),
    open([58, 64], [66, 72]),
  ],
  // 水: the hooked spine, the left turn, the two strokes on the right.
  water: [
    open([50, 10], [50, 88], [42, 82]),
    open([20, 36], [40, 36], [30, 60], [16, 76]),
    open([78, 28], [58, 46]),
    open([54, 46], [68, 68], [86, 86]),
  ],
  // 雷: rain (roof, frame, spine and four drops) over the field 田.
  lightning: [
    open([30, 10], [70, 10]),
    open([20, 22], [20, 40]),
    open([20, 22], [80, 22], [80, 40]),
    open([50, 10], [50, 42]),
    open([30, 28], [38, 32]),
    open([30, 36], [38, 40]),
    open([62, 28], [70, 32]),
    open([62, 36], [70, 40]),
    loop([28, 50], [72, 50], [72, 90], [28, 90]),
    open([28, 70], [72, 70]),
    open([50, 50], [50, 90]),
  ],
  // 土: two levels and the post between them.
  earth: [
    open([26, 42], [74, 42]),
    open([50, 14], [50, 82]),
    open([14, 82], [86, 82]),
  ],
  // 忍: the blade 刃 over the heart 心.
  endure: [
    open([22, 14], [76, 14], [72, 52], [62, 46]),
    open([48, 14], [42, 36], [20, 56]),
    open([30, 26], [40, 36]),
    open([18, 72], [24, 86]),
    open([36, 60], [36, 84], [42, 90], [70, 90], [78, 80]),
    open([52, 60], [58, 72]),
    open([72, 62], [84, 76]),
  ],
};

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const TOKEN = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
const CURVE_STEPS = 8;
const ARC_STEP = Math.PI / 14;

function arcPoints(
  from: Point,
  rxIn: number,
  ryIn: number,
  rotation: number,
  large: boolean,
  sweep: boolean,
  to: Point
): Point[] {
  // SVG arc, endpoint to centre form (SVG 1.1, appendix F.6.5).
  let rx = Math.abs(rxIn);
  let ry = Math.abs(ryIn);
  if (rx === 0 || ry === 0) return [to];
  const phi = (rotation * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (from[0] - to[0]) / 2;
  const dy = (from[1] - to[1]) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numerator = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const denominator = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const root = Math.sqrt(Math.max(0, numerator / denominator)) * (large === sweep ? -1 : 1);
  const cx1 = (root * rx * y1) / ry;
  const cy1 = (-root * ry * x1) / rx;
  const cx = cos * cx1 - sin * cy1 + (from[0] + to[0]) / 2;
  const cy = sin * cx1 + cos * cy1 + (from[1] + to[1]) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(
    ux * vy - uy * vx,
    ux * vx + uy * vy
  );
  const start = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry);
  let delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sweep && delta > 0) delta -= Math.PI * 2;
  if (sweep && delta < 0) delta += Math.PI * 2;
  const steps = Math.max(2, Math.ceil(Math.abs(delta) / ARC_STEP));
  const points: Point[] = [];
  for (let step = 1; step <= steps; step += 1) {
    const t = start + (delta * step) / steps;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    points.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]);
  }
  points[points.length - 1] = to;
  return points;
}

function bezier(points: Point[], t: number): Point {
  let row = points;
  while (row.length > 1) {
    const next: Point[] = [];
    for (let index = 0; index < row.length - 1; index += 1) {
      next.push([
        row[index][0] + (row[index + 1][0] - row[index][0]) * t,
        row[index][1] + (row[index + 1][1] - row[index][1]) * t,
      ]);
    }
    row = next;
  }
  return row[0];
}

/**
 * SVG path data as polylines: M L H V C S Q T A Z, absolute and relative,
 * with implicit repeats. Curves and arcs are sampled into short segments.
 */
export function parsePathData(d: string): Subpath[] {
  const paths: Subpath[] = [];
  let current: Subpath | null = null;
  let at: Point = [0, 0];
  let start: Point = [0, 0];
  let lastControl: Point | null = null;
  let lastCommand = '';
  const lineTo = (point: Point) => {
    if (!current) {
      current = { points: [at], closed: false };
      paths.push(current);
    }
    current.points.push(point);
    at = point;
  };
  const curveTo = (controls: Point[]) => {
    const all = [at, ...controls];
    for (let step = 1; step <= CURVE_STEPS; step += 1) lineTo(bezier(all, step / CURVE_STEPS));
  };
  TOKEN.lastIndex = 0;
  let match = TOKEN.exec(d);
  while (match) {
    const command = match[1];
    const values = (match[2].match(NUMBER) ?? []).map(Number);
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const from = at;
    const rel = (x: number, y: number): Point => (relative ? [from[0] + x, from[1] + y] : [x, y]);
    let index = 0;
    const take = (count: number) => {
      const slice = values.slice(index, index + count);
      index += count;
      return slice;
    };
    do {
      if (upper === 'Z') {
        if (current) {
          (current as Subpath).closed = true;
          at = start;
        }
        current = null;
        lastControl = null;
        break;
      }
      if (upper === 'M' && values.length - index >= 2) {
        const [x, y] = take(2);
        // Later pairs after a moveto are linetos.
        if (index > 2 && current) {
          lineTo(rel(x, y));
        } else {
          at = rel(x, y);
          start = at;
          current = { points: [at], closed: false };
          paths.push(current);
        }
        lastControl = null;
      } else if (upper === 'L' && values.length - index >= 2) {
        const [x, y] = take(2);
        lineTo(rel(x, y));
        lastControl = null;
      } else if (upper === 'H' && values.length - index >= 1) {
        const [x] = take(1);
        lineTo([relative ? at[0] + x : x, at[1]]);
        lastControl = null;
      } else if (upper === 'V' && values.length - index >= 1) {
        const [y] = take(1);
        lineTo([at[0], relative ? at[1] + y : y]);
        lastControl = null;
      } else if (upper === 'C' && values.length - index >= 6) {
        const [x1, y1, x2, y2, x, y] = take(6);
        const c2 = rel(x2, y2);
        curveTo([rel(x1, y1), c2, rel(x, y)]);
        lastControl = c2;
      } else if (upper === 'S' && values.length - index >= 4) {
        const [x2, y2, x, y] = take(4);
        const reflected: Point = lastControl && /[CS]/.test(lastCommand)
          ? [2 * at[0] - lastControl[0], 2 * at[1] - lastControl[1]]
          : at;
        const c2 = rel(x2, y2);
        curveTo([reflected, c2, rel(x, y)]);
        lastControl = c2;
      } else if (upper === 'Q' && values.length - index >= 4) {
        const [x1, y1, x, y] = take(4);
        const c1 = rel(x1, y1);
        curveTo([c1, rel(x, y)]);
        lastControl = c1;
      } else if (upper === 'T' && values.length - index >= 2) {
        const [x, y] = take(2);
        const c1: Point = lastControl && /[QT]/.test(lastCommand)
          ? [2 * at[0] - lastControl[0], 2 * at[1] - lastControl[1]]
          : at;
        curveTo([c1, rel(x, y)]);
        lastControl = c1;
      } else if (upper === 'A' && values.length - index >= 7) {
        const [rx, ry, rotation, large, sweep, x, y] = take(7);
        arcPoints(at, rx, ry, rotation, !!large, !!sweep, rel(x, y)).forEach(lineTo);
        lastControl = null;
      } else {
        break;
      }
      lastCommand = upper;
    } while (index < values.length);
    lastCommand = upper;
    match = TOKEN.exec(d);
  }
  return paths.filter((path) => path.points.length > 1);
}

/** A village symbol's marks: lines to stroke and shapes to fill. */
export function symbolMarks(id: VillageSymbolId): { strokes: Subpath[]; fills: Subpath[] } {
  const symbol = VILLAGE_SYMBOLS[id];
  if (symbol.mode === 'glyph') {
    return { strokes: symbol.glyph === '忍' ? GLYPH_STROKES.endure : [], fills: [] };
  }
  const paths = symbol.d ? parsePathData(symbol.d) : [];
  return symbol.mode === 'fill' ? { strokes: [], fills: paths } : { strokes: paths, fills: [] };
}

export type MarkOptions = {
  /** Plate size in cells: the 100-unit box maps onto it. */
  size: number;
  /** Stroke width in box units. */
  width?: number;
  /** Strip thickness, in cells. */
  depth?: number;
};

const SEGMENT_AXIS = new THREE.Vector3(0, 0, 1);
const SEGMENT_QUATERNION = new THREE.Quaternion();
const SEGMENT_MATRIX = new THREE.Matrix4();
const SEGMENT_POSITION = new THREE.Vector3();
const SEGMENT_SCALE = new THREE.Vector3(1, 1, 1);

/**
 * Flat strips (and round joints) for `strokes`, solids for `fills`, centred
 * on the origin in the xy plane facing +z, then moved by `placement`.
 */
export function markGeometries(
  strokes: Subpath[],
  fills: Subpath[],
  options: MarkOptions,
  placement: THREE.Matrix4
): THREE.BufferGeometry[] {
  const unit = options.size / 100;
  const width = (options.width ?? 9) * unit;
  const depth = options.depth ?? 0.03;
  const local = ([x, y]: Point): [number, number] => [(x - 50) * unit, (50 - y) * unit];
  const out: THREE.BufferGeometry[] = [];
  strokes.forEach((path) => {
    const points = path.closed ? [...path.points, path.points[0]] : path.points;
    for (let index = 0; index < points.length - 1; index += 1) {
      const [ax, ay] = local(points[index]);
      const [bx, by] = local(points[index + 1]);
      const length = Math.hypot(bx - ax, by - ay);
      if (length >= 1e-6) {
        const strip = new THREE.BoxGeometry(length, width, depth);
        SEGMENT_QUATERNION.setFromAxisAngle(SEGMENT_AXIS, Math.atan2(by - ay, bx - ax));
        SEGMENT_MATRIX.compose(
          SEGMENT_POSITION.set((ax + bx) / 2, (ay + by) / 2, depth / 2),
          SEGMENT_QUATERNION,
          SEGMENT_SCALE
        );
        strip.applyMatrix4(SEGMENT_MATRIX).applyMatrix4(placement);
        out.push(strip);
      }
    }
    // Round joints and ends: the brush's turns.
    points.forEach((point, index) => {
      if (path.closed && index === points.length - 1) return;
      const [x, y] = local(point);
      const joint = new THREE.CylinderGeometry(width / 2, width / 2, depth, 6);
      joint.rotateX(Math.PI / 2);
      joint.translate(x, y, depth / 2);
      joint.applyMatrix4(placement);
      out.push(joint);
    });
  });
  fills.forEach((path) => {
    const shape = new THREE.Shape(path.points.map((point) => {
      const [x, y] = local(point);
      return new THREE.Vector2(x, y);
    }));
    const solid = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: false, curveSegments: 4,
    });
    solid.applyMatrix4(placement);
    out.push(solid);
  });
  return out;
}

/** markGeometries for a kanji. */
export function glyphGeometries(
  id: GlyphId,
  options: MarkOptions,
  placement: THREE.Matrix4
): THREE.BufferGeometry[] {
  return markGeometries(GLYPH_STROKES[id], [], options, placement);
}

/** markGeometries for a village symbol. */
export function symbolGeometries(
  id: VillageSymbolId,
  options: MarkOptions,
  placement: THREE.Matrix4
): THREE.BufferGeometry[] {
  const { strokes, fills } = symbolMarks(id);
  return markGeometries(strokes, fills, options, placement);
}

/** A placement matrix: at (x, y, z), turned by (rx, ry, rz). */
export function placeAt(
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(1, 1, 1)
  );
}
