import * as THREE from 'three';
import type { HeroLandmarkKind } from '../../../../content/stageLooks';
import type { LandmarkPart, Tone } from '../landmarkGeometry';
import { GlyphId, glyphGeometries, placeAt } from './glyphs';

/**
 * The villages' famous places, as landmark silhouettes on the far skyline
 * and the margins (landmarkGeometry.ts bakes and merges them; one instanced
 * draw per kind). Each is an original low-poly build in the anime's
 * likeness: the Hokage Rock with its four carved faces and the round red
 * residence under 火, the Kazekage's dome (風), the Mizukage's tower (水),
 * the Raikage's tower on its peak (雷), the Tsuchikage's spire (土), the
 * hideout's sealed cave and the Demonic Statue, the alliance's tents (忍).
 * Kanji are this game's own brush strokes (village/glyphs.ts), no font.
 *
 * Origin is the footprint centre at ground level, the front faces +z (the
 * camera), and nothing reaches past LANDMARK_EXTENTS.
 */

type Vec3 = [number, number, number];

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cylinder = (top: number, bottom: number, h: number, segments: number) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const clump = (r: number) => new THREE.DodecahedronGeometry(r, 0);
const HALF_PI = Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const halfDome = (r: number, segments = 10, rings = 4) => (
  new THREE.SphereGeometry(r, segments, rings, 0, FULL_TURN, 0, HALF_PI)
);
const disc = (r: number, depth: number, segments = 12) => {
  const geometry = new THREE.CylinderGeometry(r, r, depth, segments);
  geometry.rotateX(Math.PI / 2);
  return geometry;
};

function at(
  geometry: THREE.BufferGeometry,
  tone: Tone,
  position: Vec3,
  rotate?: Vec3,
  color?: string
): LandmarkPart {
  return {
    geometry, tone, at: position, rotate, color,
  };
}

/** A part whose bottom sits at `y` (boxes, cones and cylinders are centred). */
function standing(
  geometry: THREE.BufferGeometry,
  tone: Tone,
  height: number,
  x: number,
  y: number,
  z: number,
  rotate?: Vec3,
  color?: string
): LandmarkPart {
  return at(geometry, tone, [x, y + height / 2, z], rotate, color);
}

function pad(radius: number, height: number): LandmarkPart {
  return standing(cylinder(radius, radius * 1.05, height, 6), 'pad', height, 0, 0, 0);
}

/**
 * A round sign plate facing the camera (tipped back by `tilt`) with a kanji
 * on it: `plate` and `ink` colours, the plate's radius, its centre.
 */
function kanjiSign(
  glyph: GlyphId,
  centre: Vec3,
  radius: number,
  plate: string,
  ink: string,
  tilt = -0.25
): LandmarkPart[] {
  const [x, y, z] = centre;
  const base = placeAt(x, y, z, tilt);
  const plateGeometry = disc(radius, 0.06);
  plateGeometry.applyMatrix4(base);
  const front = placeAt(x, y, z, tilt).multiply(placeAt(0, 0, 0.03));
  return [
    { geometry: plateGeometry, tone: 'trim', color: plate },
    ...glyphGeometries(glyph, { size: radius * 1.45, width: 10, depth: 0.03 }, front)
      .map((geometry): LandmarkPart => ({ geometry, tone: 'trim', color: ink })),
  ];
}

// --- Hidden Leaf -------------------------------------------------------------------

const ROCK_FACE = '#bdb096';
const ROCK_HAIR = '#a69878';
const ROCK_LINE = '#3b3329';
const FOLIAGE = '#3d6a3a';
const FOLIAGE_DARK = '#2f5530';

type HokageHair = 'long' | 'spiky' | 'elder' | 'bangs';

/** One carved face of the Hokage Rock, centred at (x, y) on the cliff front `z`. */
function carvedFace(x: number, y: number, z: number, hair: HokageHair): LandmarkPart[] {
  const feature = (w: number, h: number, dx: number, dy: number, turn = 0): LandmarkPart => (
    at(box(w, h, 0.06), 'trim', [x + dx, y + dy, z + 0.27], [0, 0, turn], ROCK_LINE)
  );
  const parts: LandmarkPart[] = [
    at(box(1.2, 1.45, 0.5), 'trim', [x, y, z], undefined, ROCK_FACE),
    at(box(0.86, 0.38, 0.46), 'trim', [x, y - 0.84, z - 0.02], undefined, ROCK_FACE),
    at(box(0.15, 0.32, 0.14), 'trim', [x, y - 0.08, z + 0.3], undefined, ROCK_FACE),
    feature(0.26, 0.09, -0.27, 0.16),
    feature(0.26, 0.09, 0.27, 0.16),
    feature(0.32, 0.06, -0.27, 0.33, -0.12),
    feature(0.32, 0.06, 0.27, 0.33, 0.12),
    feature(0.38, 0.05, 0, -0.5),
  ];
  if (hair === 'long') {
    // The First: long straight hair falling past the jaw on both sides.
    parts.push(
      at(box(1.42, 0.34, 0.6), 'trim', [x, y + 0.86, z - 0.04], undefined, ROCK_HAIR),
      at(box(0.24, 1.7, 0.52), 'trim', [x - 0.72, y - 0.12, z - 0.04], undefined, ROCK_HAIR),
      at(box(0.24, 1.7, 0.52), 'trim', [x + 0.72, y - 0.12, z - 0.04], undefined, ROCK_HAIR)
    );
  } else if (hair === 'spiky') {
    // The Second: short hair swept up in points, marks under the eyes.
    parts.push(at(box(1.3, 0.3, 0.56), 'trim', [x, y + 0.84, z - 0.04], undefined, ROCK_HAIR));
    [-0.45, -0.15, 0.15, 0.45].forEach((dx, index) => parts.push(at(cone(0.2, 0.55, 4), 'trim', [x + dx, y + 1.18, z - 0.08], [-0.25, 0, (index - 1.5) * -0.28], ROCK_HAIR)));
    parts.push(feature(0.05, 0.3, -0.27, -0.12), feature(0.05, 0.3, 0.27, -0.12));
  } else if (hair === 'elder') {
    // The Third: a smooth crown and a short goatee, lines at the cheeks.
    parts.push(
      at(box(1.26, 0.32, 0.56), 'trim', [x, y + 0.84, z - 0.06], undefined, ROCK_HAIR),
      at(box(0.3, 0.32, 0.3), 'trim', [x, y - 1.12, z + 0.04], undefined, ROCK_HAIR),
      feature(0.05, 0.22, -0.42, -0.3, 0.2),
      feature(0.05, 0.22, 0.42, -0.3, -0.2)
    );
  } else {
    // The Fourth: spiky bangs over the brow and long side bangs.
    parts.push(at(box(1.34, 0.3, 0.58), 'trim', [x, y + 0.86, z - 0.05], undefined, ROCK_HAIR));
    [-0.5, -0.25, 0, 0.25, 0.5].forEach((dx, index) => parts.push(at(cone(0.17, 0.62, 4), 'trim', [x + dx, y + 0.62, z + 0.18], [Math.PI - 0.5, 0, (index - 2) * 0.22], ROCK_HAIR)));
    [-1, 1].forEach((side) => parts.push(at(cone(0.16, 1.1, 4), 'trim', [x + side * 0.66, y + 0.05, z + 0.02], [Math.PI, 0, side * -0.12], ROCK_HAIR)));
  }
  return parts;
}

function hokageRockParts(): LandmarkPart[] {
  const front = 1.1;
  const parts: LandmarkPart[] = [
    standing(box(10, 3.4, 2.4), 'body', 3.4, 0, 0, -0.1),
    standing(box(8.8, 1.5, 2.0), 'body', 1.5, 0, 3.4, -0.3),
    standing(box(10.04, 0.12, 2.44), 'trim', 0.12, 0, 1.15, -0.1),
    standing(box(10.04, 0.1, 2.44), 'trim', 0.1, 0, 2.2, -0.1),
    at(rock(0.95), 'body', [-4.3, 3.6, -0.3], [0.3, 0.4, 0]),
    at(rock(0.85), 'body', [4.35, 3.55, -0.2], [0.1, 0.8, 0.2]),
    at(rock(0.7), 'trim', [-4.6, 0.6, 0.6], [0.4, 0.2, 0]),
    at(rock(0.6), 'trim', [4.6, 0.5, 0.5], [0.1, 0.5, 0.3]),
  ];
  // Trees along the top.
  [-3.6, -2.2, -0.9, 0.6, 2.0, 3.4].forEach((x, index) => {
    parts.push(at(clump(0.62 + (index % 3) * 0.08), 'trim', [x, 5.0, -0.7 + (index % 2) * 0.35], [index, index * 0.7, 0], index % 2 ? FOLIAGE : FOLIAGE_DARK));
  });
  const hair: HokageHair[] = ['long', 'spiky', 'elder', 'bangs'];
  [-3.45, -1.15, 1.15, 3.45].forEach((x, index) => {
    parts.push(...carvedFace(x, 3.05, front + 0.05, hair[index]));
  });
  return parts;
}

/** The Hokage's residence: the round red building with 火 on its upper drum. */
function hokageTowerParts(): LandmarkPart[] {
  const dark = '#3b2a22';
  const roof = '#5c6d58';
  return [
    pad(1.7, 0.4),
    standing(cylinder(1.5, 1.55, 1.6, 14), 'body', 1.6, 0, 0.4, 0),
    standing(cylinder(1.515, 1.53, 0.18, 14), 'trim', 0.18, 0, 1.05, 0, undefined, dark),
    standing(cylinder(1.64, 1.64, 0.12, 14), 'trim', 0.12, 0, 2.0, 0),
    standing(cylinder(1.12, 1.15, 0.95, 14), 'body', 0.95, 0, 2.12, 0),
    standing(cylinder(1.13, 1.13, 0.12, 14), 'trim', 0.12, 0, 2.4, 0, undefined, dark),
    standing(cylinder(1.3, 1.3, 0.1, 14), 'trim', 0.1, 0, 3.07, 0),
    standing(cylinder(1.15, 1.28, 0.22, 14), 'trim', 0.22, 0, 3.17, 0, undefined, roof),
    standing(box(0.5, 0.25, 0.4), 'trim', 0.25, -0.4, 3.39, -0.3, undefined, roof),
    standing(cylinder(0.03, 0.03, 0.4, 4), 'trim', 0.4, 0.5, 3.39, 0.1, undefined, dark),
    standing(box(0.5, 0.7, 0.08), 'trim', 0.7, 0, 0.4, 1.52, undefined, dark),
    ...kanjiSign('fire', [0, 2.6, 1.12], 0.5, '#f5eedd', '#b3121b', -0.2),
  ];
}

/** A Leaf house: cream walls, a red hip roof and a water tank on the eaves. */
function leafHouseParts(): LandmarkPart[] {
  const dark = '#4a3a30';
  return [
    pad(0.98, 0.42),
    standing(box(1.3, 0.85, 1.0), 'body', 0.85, 0, 0.42, 0),
    standing(box(1.5, 0.1, 1.2), 'trim', 0.1, 0, 1.27, 0),
    standing(cone(0.92, 0.4, 4), 'trim', 0.4, 0, 1.37, 0, [0, Math.PI / 4, 0]),
    standing(box(0.26, 0.48, 0.04), 'trim', 0.48, -0.32, 0.42, 0.51, undefined, dark),
    standing(box(0.34, 0.2, 0.04), 'trim', 0.2, 0.28, 0.82, 0.51, undefined, dark),
    standing(cylinder(0.2, 0.2, 0.32, 8), 'trim', 0.32, 0.42, 1.62, -0.24, undefined, '#7d8c96'),
    standing(cylinder(0.21, 0.21, 0.05, 8), 'trim', 0.05, 0.42, 1.94, -0.24, undefined, '#5b6670'),
  ];
}

// --- Hidden Sand -------------------------------------------------------------------

const SAND_WINDOW = '#3b2a20';

/** Round dark windows on a dome of `radius` centred at height `base`. */
function domeWindows(
  radius: number,
  base: number,
  rows: [number, number[]][],
  size: number
): LandmarkPart[] {
  return rows.flatMap(([elevation, angles]) => angles.map((angle) => {
    const ring = radius * Math.cos(elevation);
    const geometry = disc(size, 0.05, 8);
    geometry.rotateX(-elevation);
    geometry.rotateY(angle);
    return at(
      geometry,
      'trim',
      [Math.sin(angle) * ring, base + radius * Math.sin(elevation), Math.cos(angle) * ring],
      undefined,
      SAND_WINDOW
    );
  }));
}

/** The Kazekage's great dome, with 風 on a banner panel at its front. */
function kazekageDomeParts(): LandmarkPart[] {
  return [
    standing(cylinder(1.82, 1.86, 0.9, 14), 'body', 0.9, 0, 0, 0),
    standing(cylinder(1.86, 1.86, 0.1, 14), 'trim', 0.1, 0, 0.88, 0),
    at(halfDome(1.75, 14, 5), 'body', [0, 0.95, 0]),
    at(halfDome(0.45, 8, 3), 'trim', [0, 2.6, 0]),
    standing(cylinder(0.04, 0.04, 0.5, 4), 'trim', 0.5, 0, 3.0, 0),
    ...domeWindows(1.76, 0.95, [[0.35, [-1.1, -0.55, 0.55, 1.1]], [0.85, [-0.6, 0.6]]], 0.16),
    ...domeWindows(1.84, 0.2, [[0, [-1.2, -0.7, 0.7, 1.2]]], 0.13),
    standing(box(0.95, 0.95, 0.06), 'trim', 0.95, 0, 1.0, 1.62, [-0.32, 0, 0], '#efe3c6'),
    ...glyphGeometries('wind', { size: 0.8, width: 10, depth: 0.03 }, placeAt(0, 1.47, 1.66, -0.32))
      .map((geometry): LandmarkPart => ({ geometry, tone: 'trim', color: '#8f1d1d' })),
  ];
}

/** The rock wall that rings the Sand village: layered sandstone. */
function sandCliffParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(8.2, 2.2, 2.0), 'body', 2.2, 0, 0, 0),
    standing(box(7.4, 1.4, 1.8), 'body', 1.4, -0.2, 2.2, -0.1, [0, 0.03, 0]),
    standing(box(5.4, 0.9, 1.5), 'body', 0.9, 0.4, 3.6, -0.2, [0, -0.04, 0]),
    standing(box(8.24, 0.12, 2.04), 'trim', 0.12, 0, 0.8, 0),
    standing(box(7.44, 0.12, 1.84), 'trim', 0.12, -0.2, 2.9, -0.1, [0, 0.03, 0]),
  ];
  [-3.3, -1.4, 1.8, 3.4].forEach((x, index) => parts.push(
    at(rock(0.55 + (index % 2) * 0.15), 'trim', [x, 4.2 - (index % 2) * 0.6, -0.2], [index, 0.4, 0])
  ));
  return parts;
}

/** A Sand house: a round sandstone drum under a dome, with round windows. */
function sandHouseParts(): LandmarkPart[] {
  return [
    pad(0.92, 0.4),
    standing(cylinder(0.72, 0.75, 0.75, 10), 'body', 0.75, 0, 0.4, 0),
    at(halfDome(0.72, 10, 4), 'body', [0, 1.15, 0]),
    standing(cylinder(0.75, 0.75, 0.07, 10), 'trim', 0.07, 0, 1.12, 0),
    ...domeWindows(0.73, 0.55, [[0, [-0.6, 0.6]]], 0.11),
    standing(box(0.26, 0.42, 0.06), 'trim', 0.42, 0, 0.4, 0.71, undefined, SAND_WINDOW),
    standing(cylinder(0.05, 0.05, 0.42, 5), 'trim', 0.42, 0.3, 1.6, -0.3),
  ];
}

// --- Hidden Mist -------------------------------------------------------------------

/** The Mizukage's tower: a pale drum under a broad green dome, 水 at its front. */
function mizukageTowerParts(): LandmarkPart[] {
  const dark = '#24343d';
  return [
    standing(cylinder(1.25, 1.35, 2.3, 14), 'body', 2.3, 0, 0, 0),
    standing(cylinder(1.27, 1.3, 0.16, 14), 'trim', 0.16, 0, 0.9, 0, undefined, dark),
    standing(cylinder(1.45, 1.45, 0.12, 14), 'trim', 0.12, 0, 2.28, 0),
    at(halfDome(1.38, 14, 5).scale(1, 0.72, 1), 'trim', [0, 2.38, 0]),
    standing(cylinder(0.18, 0.24, 0.42, 8), 'body', 0.42, 0, 3.34, 0),
    at(halfDome(0.2, 8, 3), 'trim', [0, 3.76, 0]),
    standing(box(0.46, 0.66, 0.08), 'trim', 0.66, 0, 0, 1.3, undefined, dark),
    ...kanjiSign('water', [0, 1.62, 1.33], 0.48, '#f1f5f4', '#1b3a4b', -0.08),
  ];
}

/** A wooden bridge arching over the marsh water. */
function mistBridgeParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [];
  const span = 4.4;
  const steps = 6;
  for (let index = 0; index < steps; index += 1) {
    const a = -span / 2 + (span * index) / steps;
    const b = a + span / steps;
    const ya = 0.95 * (1 - ((2 * a) / span) ** 2);
    const yb = 0.95 * (1 - ((2 * b) / span) ** 2);
    const tilt = Math.atan2(yb - ya, b - a);
    const length = Math.hypot(b - a, yb - ya) + 0.04;
    parts.push(at(box(length, 0.12, 0.9), 'body', [(a + b) / 2, (ya + yb) / 2 + 0.3, 0], [0, 0, tilt]));
    [-0.42, 0.42].forEach((z) => parts.push(at(box(length, 0.06, 0.06), 'trim', [(a + b) / 2, (ya + yb) / 2 + 0.72, z], [0, 0, tilt])));
  }
  [-1.8, -0.9, 0, 0.9, 1.8].forEach((x) => {
    const y = 0.95 * (1 - ((2 * x) / span) ** 2);
    [-0.42, 0.42].forEach((z) => parts.push(standing(box(0.07, 0.46, 0.07), 'trim', 0.46, x, y + 0.3, z)));
  });
  [-2.15, 2.15].forEach((x) => parts.push(standing(box(0.2, 0.5, 1.0), 'body', 0.5, x, 0, 0)));
  return parts;
}

// --- Hidden Cloud ------------------------------------------------------------------

/** The Raikage's tower: a white drum stacked on a rock peak, 雷 at its front. */
function raikageTowerParts(): LandmarkPart[] {
  const gold = '#d6ab35';
  return [
    standing(cone(1.4, 2.4, 6), 'body', 2.4, 0, 0, 0),
    at(rock(0.7), 'body', [0.75, 0.5, 0.5], [0.3, 0.2, 0]),
    standing(cylinder(0.78, 0.82, 2.4, 12), 'trim', 2.4, 0, 1.75, 0),
    standing(cylinder(0.84, 0.84, 0.1, 12), 'trim', 0.1, 0, 2.6, 0, undefined, gold),
    standing(cylinder(0.92, 0.92, 0.14, 12), 'trim', 0.14, 0, 4.15, 0, undefined, gold),
    standing(cylinder(0.62, 0.7, 0.55, 12), 'trim', 0.55, 0, 4.29, 0),
    at(halfDome(0.6, 10, 3), 'trim', [0, 4.84, 0]),
    standing(cylinder(0.08, 0.08, 0.5, 5), 'trim', 0.5, 0.45, 4.6, -0.2, undefined, '#7a8494'),
    ...kanjiSign('lightning', [0, 3.35, 0.83], 0.46, '#f8fafc', '#1e293b', -0.1),
  ];
}

/** A Cloud house: a white drum on a thin rock spire. */
function cloudSpireParts(): LandmarkPart[] {
  return [
    standing(cone(0.82, 2.9, 5), 'body', 2.9, 0, 0, 0),
    standing(cone(0.4, 1.6, 5), 'body', 1.6, 0.42, 0, 0.2, [0, 0.4, -0.08]),
    standing(cylinder(0.42, 0.45, 0.65, 10), 'trim', 0.65, 0, 2.55, 0),
    standing(cylinder(0.5, 0.5, 0.08, 10), 'trim', 0.08, 0, 3.2, 0, undefined, '#d6ab35'),
    at(halfDome(0.36, 8, 3), 'trim', [0, 3.28, 0]),
    standing(cylinder(0.05, 0.05, 0.4, 5), 'trim', 0.4, 0.25, 3.4, 0, undefined, '#7a8494'),
  ];
}

// --- Hidden Stone ------------------------------------------------------------------

/** The Tsuchikage's spire: strata stacked into a tower, its hall on top under 土. */
function tsuchikageTowerParts(): LandmarkPart[] {
  const layers: [number, number, number][] = [
    [2.2, 1.0, 0], [1.8, 0.9, 0.3], [1.5, 0.9, -0.2], [1.2, 0.8, 0.4],
  ];
  const parts: LandmarkPart[] = [];
  let y = 0;
  layers.forEach(([size, height, turn], index) => {
    parts.push(standing(box(size, height, size * 0.85), index % 2 ? 'trim' : 'body', height, 0, y, 0, [0, turn, 0]));
    y += height;
  });
  parts.push(
    standing(cylinder(0.85, 0.9, 0.85, 10), 'body', 0.85, 0, y, 0),
    standing(cone(1.0, 0.55, 10), 'trim', 0.55, 0, y + 0.85, 0),
    standing(cylinder(0.06, 0.06, 0.4, 4), 'trim', 0.4, 0, y + 1.4, 0),
    ...kanjiSign('earth', [0, y + 0.42, 0.88], 0.36, '#efe7d6', '#5a1a12', -0.1)
  );
  return parts;
}

/** Two rock spires joined by a stone bridge. */
function rockBridgeParts(): LandmarkPart[] {
  return [
    standing(box(0.95, 3.4, 0.9), 'body', 3.4, -2.0, 0, 0, [0, 0.2, 0]),
    standing(box(0.9, 3.1, 0.85), 'body', 3.1, 2.05, 0, 0, [0, -0.15, 0]),
    standing(box(1.1, 0.3, 1.0), 'trim', 0.3, -2.0, 3.4, 0, [0, 0.2, 0]),
    standing(box(1.05, 0.3, 0.95), 'trim', 0.3, 2.05, 3.1, 0, [0, -0.15, 0]),
    at(box(2.2, 0.22, 0.62), 'trim', [-1.0, 3.42, 0], [0, 0, -0.08]),
    at(box(2.2, 0.22, 0.62), 'trim', [1.0, 3.28, 0], [0, 0, -0.06]),
    at(rock(0.5), 'body', [-1.6, 0.3, 0.4]),
  ];
}

// --- Akatsuki hideout --------------------------------------------------------------

const STATUE = '#6c6477';
const STATUE_DARK = '#4a4352';
const BINDING = '#2a2430';

/** The Demonic Statue rising from the ground: bound mouth and eyes, hands raised. */
function demonStatueParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(2.3, 2.3, 1.4), 'body', 2.3, 0, 0, -0.1, undefined, STATUE),
    standing(box(3.3, 0.6, 1.3), 'body', 0.6, 0, 2.2, -0.1, undefined, STATUE),
    standing(box(1.3, 1.45, 1.2), 'body', 1.45, 0, 2.8, 0, undefined, STATUE),
    standing(box(1.0, 0.4, 0.9), 'body', 0.4, 0, 4.25, -0.05, undefined, STATUE_DARK),
    // The blindfold and the gag.
    standing(box(1.36, 0.26, 1.26), 'trim', 0.26, 0, 3.75, 0, undefined, BINDING),
    standing(box(1.36, 0.3, 1.26), 'trim', 0.3, 0, 3.05, 0, undefined, BINDING),
    // Horns of the brow.
    at(cone(0.16, 0.6, 4), 'body', [-0.45, 4.6, 0], [0, 0, 0.35], STATUE_DARK),
    at(cone(0.16, 0.6, 4), 'body', [0.45, 4.6, 0], [0, 0, -0.35], STATUE_DARK),
  ];
  [-1, 1].forEach((side) => {
    parts.push(
      at(box(0.55, 1.4, 0.6), 'body', [side * 1.72, 3.2, -0.1], [0, 0, side * 0.35], STATUE),
      at(box(0.5, 1.2, 0.55), 'body', [side * 2.0, 4.3, 0.05], [0, 0, side * -0.12], STATUE),
      at(box(0.62, 0.45, 0.32), 'body', [side * 2.08, 5.05, 0.1], undefined, STATUE_DARK),
      // Rope round the wrist.
      at(box(0.56, 0.12, 0.6), 'trim', [side * 2.02, 4.75, 0.06], undefined, BINDING)
    );
    [-0.22, -0.07, 0.08, 0.23].forEach((dx) => parts.push(standing(box(0.1, 0.42, 0.12), 'body', 0.42, side * 2.08 + dx, 5.25, 0.1, undefined, STATUE)));
    parts.push(at(box(0.11, 0.32, 0.12), 'body', [side * 1.78, 5.22, 0.12], [0, 0, side * 0.6], STATUE));
  });
  return parts;
}

/** The hideout's mouth: a rock face, the cave, and its sealed boulder. */
function hideoutCaveParts(): LandmarkPart[] {
  const parts: LandmarkPart[] = [
    standing(box(3.8, 2.6, 2.2), 'body', 2.6, 0, 0, -0.2),
    at(rock(1.3), 'body', [-1.3, 2.7, -0.4], [0.2, 0.5, 0]),
    at(rock(1.1), 'body', [1.2, 2.5, -0.5], [0.6, 0.1, 0.3]),
    at(disc(1.05, 0.06, 12), 'trim', [0, 1.1, 0.92], undefined, '#120e16'),
    at(rock(0.9), 'trim', [0, 0.92, 1.0], [0.2, 0.3, 0], '#77707f'),
    standing(box(0.28, 0.72, 0.03), 'trim', 0.72, 0, 0.62, 1.66, [-0.25, 0, 0], '#efe6d2'),
  ];
  const strokes = [[0, 0.06, 0.08, 0.4], [-0.06, -0.12, 0.06, 0.16], [0.06, -0.12, 0.06, 0.16]];
  strokes.forEach(([dx, dy, w, h]) => {
    parts.push(at(box(w, h, 0.02), 'trim', [dx, 1.0 + dy, 1.69], [-0.25, 0, 0], '#2a2124'));
  });
  return parts;
}

// --- The war front -----------------------------------------------------------------

const CANVAS = '#cfc2a0';
const CANVAS_DARK = '#a8987a';

/** A ridge tent: a triangular canvas roof along x. */
function tent(width: number, depth: number, height: number, x: number, z: number): LandmarkPart[] {
  const roof = new THREE.CylinderGeometry(1, 1, width, 3, 1);
  roof.rotateZ(Math.PI / 2);
  roof.rotateX(-Math.PI / 2);
  roof.scale(1, height / 1.5, depth / 1.732);
  return [
    at(roof, 'trim', [x, height / 3, z], undefined, CANVAS),
    standing(box(0.32, height * 0.62, 0.04), 'trim', height * 0.62, x, 0, z + depth * 0.32, undefined, '#3a3128'),
  ];
}

/** `parts` raised by `y` (onto a plinth). */
function lifted(parts: LandmarkPart[], y: number): LandmarkPart[] {
  return parts.map((part) => {
    const [x, py, z] = part.at ?? [0, 0, 0];
    return { ...part, at: [x, py + y, z] as Vec3 };
  });
}

/** The alliance command tent with its 忍 standard. */
function commandTentParts(): LandmarkPart[] {
  return [
    pad(1.6, 0.35),
    ...lifted(tent(2.6, 2.0, 1.5, 0, 0), 0.35),
    standing(box(2.66, 0.08, 0.08), 'trim', 0.08, 0, 1.85, 0, undefined, CANVAS_DARK),
    standing(cylinder(0.05, 0.05, 3.0, 5), 'body', 3.0, 1.15, 0.35, 0.6),
    standing(box(0.95, 0.75, 0.03), 'trim', 0.75, 0.66, 2.45, 0.6, undefined, '#f4f1e8'),
    ...glyphGeometries('endure', { size: 0.62, width: 11, depth: 0.025 }, placeAt(0.66, 2.83, 0.62))
      .map((geometry): LandmarkPart => ({ geometry, tone: 'trim', color: '#15171c' })),
  ];
}

/** An alliance field tent. */
function allianceTentParts(): LandmarkPart[] {
  return [
    pad(1.0, 0.3),
    ...lifted(tent(1.5, 1.2, 1.05, 0, 0), 0.3),
    standing(box(0.05, 0.4, 0.05), 'body', 0.4, 0.8, 0.3, 0.5),
    standing(box(0.05, 0.4, 0.05), 'body', 0.4, -0.8, 0.3, 0.5),
  ];
}

export const HERO_LANDMARK_PARTS: Record<HeroLandmarkKind, () => LandmarkPart[]> = {
  hokageRock: hokageRockParts,
  hokageTower: hokageTowerParts,
  leafHouse: leafHouseParts,
  kazekageDome: kazekageDomeParts,
  sandCliff: sandCliffParts,
  sandHouse: sandHouseParts,
  mizukageTower: mizukageTowerParts,
  mistBridge: mistBridgeParts,
  raikageTower: raikageTowerParts,
  cloudSpire: cloudSpireParts,
  tsuchikageTower: tsuchikageTowerParts,
  rockBridge: rockBridgeParts,
  demonStatue: demonStatueParts,
  hideoutCave: hideoutCaveParts,
  commandTent: commandTentParts,
  allianceTent: allianceTentParts,
};
