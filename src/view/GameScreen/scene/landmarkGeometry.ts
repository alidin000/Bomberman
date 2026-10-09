import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { StageLandmarkKind } from '../../../content/stageLooks';

/**
 * Low-poly landmark silhouettes. Every part is flat-shaded by splitting its
 * faces, and its colour is baked into a vertex colour (with a little extra
 * shading per face, like the masonry tiles), so one landmark kind is one
 * merged geometry and one instanced draw. Origin is the footprint centre at
 * ground level; nothing reaches past LANDMARK_EXTENTS.
 */

export type LandmarkColors = {
  body: string;
  trim: string;
  accent: string;
  /** Plinth pieces under side landmarks: the arena slab's colour. */
  pad: string;
};

type Tone = keyof LandmarkColors;
type Vec3 = [number, number, number];
type Part = {
  geometry: THREE.BufferGeometry;
  tone: Tone;
  at?: Vec3;
  rotate?: Vec3;
};

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const cylinder = (top: number, bottom: number, h: number, segments: number) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const QUARTER = Math.PI / 4;

/** A part whose bottom sits at `y` (cones, boxes and cylinders are centred). */
function standing(
  geometry: THREE.BufferGeometry,
  tone: Tone,
  height: number,
  x: number,
  y: number,
  z: number,
  rotate?: Vec3
): Part {
  return {
    geometry, tone, at: [x, y + height / 2, z], rotate,
  };
}

function pad(radius: number, height: number): Part {
  return standing(cylinder(radius, radius * 1.05, height, 6), 'pad', height, 0, 0, 0);
}

const LANDMARK_PARTS: Record<StageLandmarkKind, () => Part[]> = {
  marketStall: () => [
    pad(0.98, 0.45),
    standing(box(1.4, 0.55, 0.8), 'body', 0.55, 0, 0.45, 0),
    ...[-0.62, 0.62].flatMap((x) => [-0.32, 0.32].map((z) => (
      standing(box(0.08, 0.45, 0.08), 'trim', 0.45, x, 1, z)
    ))),
    standing(cone(1, 0.45, 4), 'trim', 0.45, 0, 1.45, 0, [0, QUARTER, 0]),
    standing(box(1.42, 0.12, 0.06), 'accent', 0.12, 0, 1.34, 0.43),
  ],
  rootArch: () => [
    pad(1.4, 0.4),
    {
      geometry: new THREE.TorusGeometry(1.1, 0.26, 5, 9, Math.PI), tone: 'body', at: [0, 0.4, 0],
    },
    {
      geometry: new THREE.TorusGeometry(0.7, 0.2, 5, 7, Math.PI),
      tone: 'trim',
      at: [0.25, 0.4, 0.1],
      rotate: [0, 1.2, 0],
    },
    { geometry: rock(0.32), tone: 'trim', at: [-1.05, 0.55, 0.15] },
  ],
  cedar: () => [
    pad(1.05, 0.4),
    standing(cylinder(0.2, 0.32, 2.4, 6), 'body', 2.4, 0, 0.4, 0),
    standing(cone(1.15, 1.5, 7), 'trim', 1.5, 0, 1.9, 0),
    standing(cone(0.9, 1.35, 7), 'trim', 1.35, 0, 2.9, 0, [0, 0.3, 0]),
    standing(cone(0.62, 1.4, 7), 'trim', 1.4, 0, 3.9, 0, [0, 0.6, 0]),
  ],
  terraceBlock: () => [
    standing(box(2.2, 0.62, 1.8), 'body', 0.62, 0, 0, 0),
    standing(box(1.6, 0.62, 1.3), 'body', 0.62, -0.15, 0.62, -0.1),
    standing(box(1, 0.62, 0.8), 'body', 0.62, -0.25, 1.24, -0.2),
    standing(box(2.26, 0.06, 1.86), 'trim', 0.06, 0, 0.6, 0),
    standing(box(1.66, 0.06, 1.36), 'trim', 0.06, -0.15, 1.22, -0.1),
    standing(box(0.3, 0.4, 0.04), 'trim', 0.4, 0.45, 0, 0.91),
    standing(box(0.28, 0.36, 0.04), 'trim', 0.4, 0.2, 0.62, 0.56),
  ],
  kilnDome: () => [
    pad(1.02, 0.35),
    {
      geometry: new THREE.SphereGeometry(0.82, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      tone: 'body',
      at: [0, 0.35, 0],
    },
    standing(cylinder(0.85, 0.87, 0.12, 7), 'trim', 0.12, 0, 0.36, 0),
    standing(cylinder(0.11, 0.15, 0.62, 6), 'trim', 0.62, 0.32, 1, -0.1),
    standing(box(0.34, 0.34, 0.12), 'trim', 0.34, 0, 0.36, 0.76),
  ],
  clothTower: () => [
    standing(box(0.5, 3.7, 0.5), 'body', 3.7, 0, 0, 0),
    standing(cone(0.52, 0.6, 4), 'body', 0.6, 0, 3.7, 0, [0, QUARTER, 0]),
    standing(box(0.42, 2, 0.04), 'trim', 2, 0, 1.55, 0.27),
    standing(box(0.04, 1.8, 0.42), 'trim', 1.8, 0.27, 1.7, 0),
    standing(box(0.3, 1.4, 0.04), 'accent', 1.4, 0, 2, -0.27),
  ],
  dockPier: () => [
    ...[-0.95, 0.95].flatMap((x) => [-0.36, 0.36].map((z) => (
      standing(box(0.12, 0.78, 0.12), 'trim', 0.78, x, 0, z)
    ))),
    standing(box(2.2, 0.12, 0.9), 'body', 0.12, 0, 0.72, 0),
    standing(box(0.14, 0.3, 0.14), 'trim', 0.3, 0.95, 0.84, 0.36),
    standing(box(0.14, 0.14, 0.14), 'accent', 0.14, 0.95, 0.94, -0.36),
  ],
  reedScreen: () => [
    pad(0.92, 0.3),
    ...[-0.8, -0.52, -0.25, 0, 0.26, 0.53, 0.8].map((x, index) => (
      standing(box(0.07, 1.8 + ((index * 5) % 7) * 0.16, 0.07), 'body', 1.8 + ((index * 5) % 7) * 0.16, x, 0, ((index % 3) - 1) * 0.08, [0, 0, (index % 2 ? 1 : -1) * 0.05])
    )),
    standing(box(1.8, 0.07, 0.08), 'trim', 0.07, 0, 1.05, 0.06),
    standing(box(1.8, 0.07, 0.08), 'trim', 0.07, 0, 1.65, 0.06),
  ],
  stiltHut: () => [
    ...[-0.5, 0.5].flatMap((x) => [-0.42, 0.42].map((z) => (
      standing(box(0.1, 1.1, 0.1), 'trim', 1.1, x, 0, z)
    ))),
    standing(box(1.2, 0.85, 1), 'body', 0.85, 0, 1.1, 0),
    standing(cone(1.05, 0.95, 4), 'trim', 0.95, 0, 1.95, 0, [0, QUARTER, 0]),
    standing(box(0.12, 0.16, 0.12), 'trim', 0.16, 0, 2.9, 0),
    standing(box(0.14, 0.18, 0.14), 'accent', 0.18, 0.66, 1.3, 0.55),
  ],
  snowTemple: () => [
    standing(box(2, 0.4, 1.9), 'pad', 0.4, 0, 0, 0),
    standing(box(1.3, 1, 1.15), 'body', 1, 0, 0.4, 0),
    standing(box(0.36, 0.6, 0.04), 'accent', 0.6, 0, 0.4, 0.59),
    standing(cone(1.38, 0.72, 4), 'trim', 0.72, 0, 1.4, 0, [0, QUARTER, 0]),
    standing(box(0.84, 0.7, 0.76), 'body', 0.7, 0, 2.05, 0),
    standing(cone(0.98, 0.62, 4), 'trim', 0.62, 0, 2.75, 0, [0, QUARTER, 0]),
    standing(cylinder(0.05, 0.05, 0.75, 4), 'body', 0.75, 0, 3.35, 0),
  ],
  ropeSpan: () => [
    ...[-1.7, 1.7].flatMap((x) => [
      standing(box(0.56, 0.32, 0.56), 'pad', 0.32, x, 0, 0),
      standing(box(0.2, 1.95, 0.2), 'body', 1.95, x, 0.32, 0),
      standing(box(0.3, 0.06, 0.3), 'trim', 0.06, x, 2.2, 0),
    ]),
    // A sagging rope: four straight runs dipping to the middle.
    ...[
      [-1.27, 2.0, -0.42], [-0.42, 1.73, -0.2], [0.42, 1.73, 0.2], [1.27, 2.0, 0.42],
    ].map(([x, y, tilt]) => ({
      geometry: box(0.9, 0.05, 0.05), tone: 'trim' as const, at: [x, y, 0] as Vec3, rotate: [0, 0, tilt] as Vec3,
    })),
    ...[-0.85, 0, 0.85].map((x) => (
      standing(box(0.12, 0.26, 0.02), 'accent', 0.26, x, 1.42 + Math.abs(x) * 0.22, 0)
    )),
  ],
  snowPeak: () => [
    standing(cone(1.45, 5, 5), 'body', 5, 0, 0, 0),
    standing(cone(0.85, 3, 5), 'body', 3, 0.62, 0, 0.3, [0, 0.5, -0.08]),
    standing(cone(0.48, 1.4, 5), 'trim', 1.4, 0, 3.92, 0),
    standing(cone(0.32, 0.95, 5), 'trim', 0.95, 0.66, 2.3, 0.3, [0, 0.5, -0.08]),
  ],
  strataPillar: () => [
    [1.1, 0.8, 1, 0, 'body'], [0.95, 0.7, 0.9, 0.3, 'trim'], [1, 0.85, 0.95, -0.2, 'body'],
    [0.85, 0.6, 0.8, 0.45, 'trim'], [0.8, 0.75, 0.75, 0.1, 'body'],
  ].reduce<{ parts: Part[]; y: number }>((stack, [w, h, d, turn, tone]) => ({
    parts: [...stack.parts, standing(
      box(w as number, h as number, d as number),
      tone as Tone,
      h as number,
      ((stack.parts.length % 2) - 0.5) * 0.08,
      stack.y,
      0,
      [0, turn as number, 0]
    )],
    y: stack.y + (h as number),
  }), { parts: [], y: 0 }).parts,
  quarryStep: () => [
    standing(box(2.4, 0.7, 1.6), 'body', 0.7, 0, 0, 0),
    standing(box(1.6, 0.7, 1.6), 'body', 0.7, -0.4, 0.7, 0),
    standing(box(0.8, 0.7, 1.6), 'body', 0.7, -0.8, 1.4, 0),
    standing(box(2.44, 0.08, 1.64), 'trim', 0.08, 0, 0.32, 0),
    standing(box(1.64, 0.08, 1.64), 'trim', 0.08, -0.4, 1.02, 0),
    standing(box(0.84, 0.08, 1.64), 'trim', 0.08, -0.8, 1.72, 0),
  ],
  boulder: () => [
    pad(0.8, 0.3),
    { geometry: rock(0.68).scale(1, 0.8, 1), tone: 'body', at: [0, 0.56, 0] },
    { geometry: rock(0.36), tone: 'trim', at: [0.42, 0.37, 0.26] },
  ],
  inkSpire: () => [
    standing(cone(0.7, 4, 5), 'body', 4, 0, 0, 0),
    standing(cone(0.44, 2.6, 5), 'trim', 2.6, 0.6, 0, 0.25, [0, 0.4, -0.06]),
    standing(cone(0.34, 1.8, 5), 'body', 1.8, -0.55, 0, -0.2, [0, 0.9, 0.08]),
  ],
  ruinedScreen: () => [
    pad(0.95, 0.3),
    standing(box(0.1, 1.95, 0.1), 'body', 1.95, -0.8, 0, 0),
    standing(box(0.1, 1.6, 0.1), 'body', 1.6, 0.8, 0, 0, [0, 0, -0.06]),
    standing(box(1.7, 0.09, 0.09), 'body', 0.09, 0, 1.0, 0),
    standing(box(1.2, 0.09, 0.09), 'body', 0.09, -0.25, 1.86, 0, [0, 0, 0.08]),
    ...[-0.27, 0.27].map((x) => standing(box(0.06, 1.7, 0.06), 'body', 1.7, x, 0.05, 0)),
    standing(box(0.48, 0.8, 0.02), 'trim', 0.8, -0.54, 1.04, 0),
    standing(box(0.48, 0.55, 0.02), 'trim', 0.55, 0, 0.2, 0),
    standing(box(0.44, 0.38, 0.02), 'trim', 0.38, 0.54, 1.05, 0, [0, 0, 0.12]),
  ],
  cavernArch: () => [
    standing(box(0.6, 3, 0.7), 'body', 3, -1.1, 0, 0, [0, 0.12, 0.04]),
    standing(box(0.6, 2.9, 0.7), 'body', 2.9, 1.1, 0, 0, [0, -0.1, -0.04]),
    standing(box(2.8, 0.58, 0.8), 'trim', 0.58, 0, 2.95, 0, [0, 0, 0.04]),
    { geometry: rock(0.42), tone: 'body', at: [0.45, 0.3, 0.3] },
  ],
  warBanner: () => [
    standing(box(0.4, 0.2, 0.4), 'body', 0.2, 0, 0, 0),
    standing(box(0.08, 3.25, 0.08), 'body', 3.25, 0, 0.2, 0),
    standing(box(0.66, 0.06, 0.06), 'body', 0.06, 0.29, 3.2, 0),
    standing(box(0.56, 1.95, 0.03), 'trim', 1.95, 0.32, 1.25, 0),
    standing(box(0.56, 0.2, 0.04), 'accent', 0.2, 0.32, 3.0, 0),
  ],
  paperShard: () => [
    [0.9, 1.85, -0.25, 0, 0.18, 0.12],
    [0.7, 1.35, 0.42, 0.3, -0.22, 0.9],
    [0.6, 1.0, -0.1, -0.42, 0.3, -0.7],
  ].flatMap(([w, h, x, z, lean, turn]) => [
    standing(box(w, h, 0.05), 'body', h, x, 0, z, [0, turn, lean]),
    standing(box(w + 0.02, h * 0.32, 0.07), 'trim', h * 0.32, x - Math.sin(lean) * h * 0.16, 0, z, [0, turn, lean]),
  ]),
  stakeFence: () => [
    pad(1.2, 0.3),
    ...[-1, -0.5, 0, 0.5, 1].map((x, index) => (
      standing(box(0.12, 1.3, 0.12), 'body', 1.3, x, 0, 0, [(index % 2 ? 1 : -1) * 0.3, 0, (index - 2) * 0.05])
    )),
    standing(box(2.3, 0.08, 0.08), 'trim', 0.08, 0, 0.6, 0),
    standing(box(0.22, 0.3, 0.02), 'accent', 0.3, 0.25, 0.3, 0.08),
  ],
};

const PART_MATRIX = new THREE.Matrix4();
const PART_EULER = new THREE.Euler();
const PART_QUATERNION = new THREE.Quaternion();
const PART_POSITION = new THREE.Vector3();
const PART_SCALE = new THREE.Vector3(1, 1, 1);
const TONE_COLOR = new THREE.Color();

function faceShade(normalY: number, normalX: number, normalZ: number): number {
  if (normalY > 0.6) return 1.1;
  if (normalY < -0.6) return 0.58;
  return 0.8 + Math.max(0, normalZ) * 0.12 + Math.max(0, -normalX) * 0.06;
}

/** Splits faces (flat shading), drops UVs and bakes the tone into vertex colours. */
function bakePart(part: Part, colors: LandmarkColors): THREE.BufferGeometry {
  const source = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
  part.geometry.dispose();
  source.deleteAttribute('uv');
  PART_EULER.set(...(part.rotate ?? [0, 0, 0]));
  PART_QUATERNION.setFromEuler(PART_EULER);
  PART_POSITION.set(...(part.at ?? [0, 0, 0]));
  PART_MATRIX.compose(PART_POSITION, PART_QUATERNION, PART_SCALE);
  source.applyMatrix4(PART_MATRIX);
  source.computeVertexNormals();
  const normals = source.getAttribute('normal');
  const colorsOut = new Float32Array(normals.count * 3);
  TONE_COLOR.set(colors[part.tone]);
  for (let index = 0; index < normals.count; index += 1) {
    const shade = faceShade(normals.getY(index), normals.getX(index), normals.getZ(index));
    colorsOut[index * 3] = TONE_COLOR.r * shade;
    colorsOut[index * 3 + 1] = TONE_COLOR.g * shade;
    colorsOut[index * 3 + 2] = TONE_COLOR.b * shade;
  }
  source.setAttribute('color', new THREE.BufferAttribute(colorsOut, 3));
  return source;
}

/** A fresh merged geometry for one landmark in the given colours. */
export function buildLandmarkGeometry(
  kind: StageLandmarkKind,
  colors: LandmarkColors
): THREE.BufferGeometry {
  const baked = LANDMARK_PARTS[kind]().map((part) => bakePart(part, colors));
  const merged = mergeGeometries(baked);
  baked.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error(`Could not build landmark geometry: ${kind}`);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// Built on first use and kept for the session: at most a few per stage, and
// never mutated, so every match on a stage reuses them.
const LANDMARK_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry>();

export function getLandmarkGeometry(
  kind: StageLandmarkKind,
  colors: LandmarkColors
): THREE.BufferGeometry {
  const key = `${kind}|${colors.body}|${colors.trim}|${colors.accent}|${colors.pad}`;
  let geometry = LANDMARK_GEOMETRY_CACHE.get(key);
  if (!geometry) {
    geometry = buildLandmarkGeometry(kind, colors);
    LANDMARK_GEOMETRY_CACHE.set(key, geometry);
  }
  return geometry;
}

/**
 * The one material every landmark uses. Its options match the instanced wall
 * and crate layers (standard, opaque, vertex and instance colours), so it
 * reuses their shader program instead of adding one.
 */
export const LANDMARK_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  roughness: 1,
  metalness: 0,
});
