import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';
import type { Vec3 } from '../figureGeometry';
import { CastCellName, WHITE_UV, castCellRect } from './castAtlas';

/**
 * A cast figure is one merged geometry (positions, normals, vertex colours
 * and atlas UVs: one draw call) plus one welded ink hull for the shared ink
 * line (one more). Parts are primitives placed by a matrix; painted parts
 * (faces, plates, prints) carry UVs into their atlas cell, every other part
 * samples the atlas's white block and shows its vertex colour.
 */

export type CastDecal = {
  cell: CastCellName;
  /**
   * 'native': the geometry's own 0-1 UVs span the cell. 'planar': the part's
   * local x and y, over `radius` about `center`, span it (faces on heads).
   */
  mode: 'native' | 'planar';
  radius?: number;
  center?: readonly [number, number];
};

export type CastPart = {
  geometry: THREE.BufferGeometry;
  color: string;
  at?: Vec3;
  rotate?: Vec3;
  scale?: Vec3;
  /** False keeps the part out of the ink line (decals, thin rods, marks). */
  ink?: boolean;
  decal?: CastDecal;
};

export type CastMesh = {
  body: THREE.BufferGeometry;
  ink: THREE.BufferGeometry | null;
};

/** Parts this small get no line of their own; one would swallow them. */
const INK_MIN_PART = 0.04;

const PART_MATRIX = new THREE.Matrix4();
const PART_EULER = new THREE.Euler();
const PART_QUATERNION = new THREE.Quaternion();
const PART_POSITION = new THREE.Vector3();
const PART_SCALE = new THREE.Vector3();
const PART_COLOR = new THREE.Color();

function partMatrix(part: CastPart, root: THREE.Matrix4): THREE.Matrix4 {
  PART_EULER.set(...(part.rotate ?? [0, 0, 0]));
  PART_QUATERNION.setFromEuler(PART_EULER);
  PART_POSITION.set(...(part.at ?? [0, 0, 0]));
  PART_SCALE.set(...(part.scale ?? [1, 1, 1]));
  return PART_MATRIX.compose(PART_POSITION, PART_QUATERNION, PART_SCALE).premultiply(root).clone();
}

function indexed(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geometry.index) return geometry;
  const { count } = geometry.getAttribute('position');
  const index = new Array<number>(count);
  for (let i = 0; i < count; i += 1) index[i] = i;
  geometry.setIndex(index);
  return geometry;
}

function decalUvs(source: THREE.BufferGeometry, decal: CastDecal | undefined): Float32Array {
  const positions = source.getAttribute('position');
  const { count } = positions;
  const uvs = new Float32Array(count * 2);
  if (!decal) {
    const [whiteU, whiteV] = WHITE_UV;
    for (let i = 0; i < count; i += 1) {
      uvs[i * 2] = whiteU;
      uvs[i * 2 + 1] = whiteV;
    }
    return uvs;
  }
  const rect = castCellRect(decal.cell);
  const native = source.getAttribute('uv');
  const radius = decal.radius ?? 1;
  const [cx, cy] = decal.center ?? [0, 0];
  for (let i = 0; i < count; i += 1) {
    let s: number;
    let t: number;
    if (decal.mode === 'native' && native) {
      s = native.getX(i);
      t = native.getY(i);
    } else {
      s = ((positions.getX(i) - cx) / radius + 1) / 2;
      t = ((positions.getY(i) - cy) / radius + 1) / 2;
    }
    s = THREE.MathUtils.clamp(s, 0, 1);
    t = THREE.MathUtils.clamp(t, 0, 1);
    uvs[i * 2] = rect.u0 + s * (rect.u1 - rect.u0);
    uvs[i * 2 + 1] = rect.v0 + t * (rect.v1 - rect.v0);
  }
  return uvs;
}

function bodyPart(part: CastPart, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const source = part.geometry.clone();
  // UVs come from the part's own (unplaced) coordinates.
  const uvs = decalUvs(source, part.decal);
  source.deleteAttribute('uv');
  source.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  source.applyMatrix4(matrix);
  const { count } = source.getAttribute('position');
  // A decal shows its paint as is; everything else its colour (linear, as
  // three.js reads vertex colours).
  PART_COLOR.set(part.decal ? '#ffffff' : part.color);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = PART_COLOR.r;
    colors[i * 3 + 1] = PART_COLOR.g;
    colors[i * 3 + 2] = PART_COLOR.b;
  }
  source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!source.getAttribute('normal')) source.computeVertexNormals();
  return indexed(source);
}

function hullPart(part: CastPart, matrix: THREE.Matrix4): THREE.BufferGeometry | null {
  if (part.ink === false) return null;
  const { geometry } = part;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  PART_SCALE.setFromMatrixScale(matrix);
  const radius = (geometry.boundingSphere?.radius ?? 0)
    * Math.max(PART_SCALE.x, PART_SCALE.y, PART_SCALE.z);
  if (radius < INK_MIN_PART) return null;
  const placed = new THREE.BufferGeometry();
  placed.setAttribute('position', geometry.getAttribute('position').clone().applyMatrix4(matrix));
  if (geometry.index) placed.setIndex(geometry.index.clone());
  // Primitive seams and poles repeat positions; welding gives one averaged
  // normal per corner, so the pushed-out shell stays closed.
  const welded = mergeVertices(placed, 1e-4);
  placed.dispose();
  welded.computeVertexNormals();
  return indexed(welded);
}

/**
 * Merges parts into a figure, scaled and placed by `root` (baked in, so the
 * ink keeps its screen width). Source geometries are disposed.
 */
export function buildCastMesh(parts: CastPart[], root = new THREE.Matrix4()): CastMesh {
  const bodies: THREE.BufferGeometry[] = [];
  const hulls: THREE.BufferGeometry[] = [];
  parts.forEach((part) => {
    const matrix = partMatrix(part, root);
    bodies.push(bodyPart(part, matrix));
    const hull = hullPart(part, matrix);
    if (hull) hulls.push(hull);
    part.geometry.dispose();
  });
  const body = mergeGeometries(bodies);
  bodies.forEach((geometry) => geometry.dispose());
  if (!body) throw new Error('Could not merge cast parts');
  body.computeBoundingBox();
  body.computeBoundingSphere();
  let ink: THREE.BufferGeometry | null = null;
  if (hulls.length) {
    ink = mergeGeometries(hulls);
    hulls.forEach((geometry) => geometry.dispose());
    if (ink) {
      ink.computeBoundingBox();
      ink.computeBoundingSphere();
      // The ink shader pushes vertices out; keep them inside the culling sphere.
      if (ink.boundingSphere) ink.boundingSphere.radius += 0.15;
    }
  }
  return { body, ink };
}

// --- Placement helpers ------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const BASIS = new THREE.Matrix4();
const AXIS_X = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3();
const AXIS_Z = new THREE.Vector3();

/**
 * `geometry` (built along +y about its centre) turned so +y runs along
 * `direction` and moved to `center`; `outward` picks which way its local +z
 * faces (flat hair spikes keep their thin side outward).
 */
export function aimAlong(
  geometry: THREE.BufferGeometry,
  center: THREE.Vector3,
  direction: THREE.Vector3,
  outward?: THREE.Vector3
): THREE.BufferGeometry {
  AXIS_Y.copy(direction).normalize();
  const hint = outward ?? (Math.abs(AXIS_Y.y) > 0.95 ? AXIS_Z.set(0, 0, 1) : UP);
  AXIS_Z.copy(hint).addScaledVector(AXIS_Y, -hint.dot(AXIS_Y));
  if (AXIS_Z.lengthSq() < 1e-6) AXIS_Z.set(1, 0, 0).addScaledVector(AXIS_Y, -AXIS_Y.x);
  AXIS_Z.normalize();
  AXIS_X.crossVectors(AXIS_Y, AXIS_Z).normalize();
  BASIS.makeBasis(AXIS_X, AXIS_Y, AXIS_Z).setPosition(center);
  return geometry.applyMatrix4(BASIS);
}

/** A capsule from `a` to `b`. */
export function limb(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radius: number,
  color: string,
  radial = 8
): CastPart {
  const length = Math.max(0.001, a.distanceTo(b));
  const geometry = new THREE.CapsuleGeometry(radius, length, 3, radial);
  const center = a.clone().add(b).multiplyScalar(0.5);
  return { geometry: aimAlong(geometry, center, b.clone().sub(a)), color };
}

/** A tapered tube (sleeve, scabbard) from `a` to `b`. */
export function tube(
  a: THREE.Vector3,
  b: THREE.Vector3,
  radiusA: number,
  radiusB: number,
  color: string,
  radial = 8,
  open = false
): CastPart {
  const length = Math.max(0.001, a.distanceTo(b));
  // CylinderGeometry's top (+y) is radiusTop: point it at b.
  const geometry = new THREE.CylinderGeometry(radiusB, radiusA, length, radial, 1, open);
  const center = a.clone().add(b).multiplyScalar(0.5);
  return { geometry: aimAlong(geometry, center, b.clone().sub(a)), color };
}

/**
 * The same surface seen from inside: mirrored (reversing its winding) with
 * inward normals, for the lining of open coats, collars and hoods.
 */
export function insideOut(geometry: THREE.BufferGeometry, shrink = 0.985): THREE.BufferGeometry {
  geometry.scale(-shrink, shrink, shrink);
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < normals.count; i += 1) {
    normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
  }
  return geometry;
}

export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
