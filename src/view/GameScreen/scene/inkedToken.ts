import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { FIGHTER_TOON_RAMP } from './fighterInk';
import type { Vec3 } from './figureGeometry';

/**
 * Small props drawn in the fighters' illustrated look: toon light bands and
 * the shared ink line. Each prop (a pickup, a villager, a structure) is one
 * merged geometry whose parts carry their colour as vertex colours, plus one
 * welded ink hull, so it costs two draw calls (and one shadow caster) however
 * many parts it has. The geometries are built once per look and shared.
 */

export type TokenPart = {
  geometry: THREE.BufferGeometry;
  color: string;
  at?: Vec3;
  rotate?: Vec3;
  scale?: Vec3;
  /** False keeps the part out of the ink line (eyes, marks, thin rods). */
  ink?: boolean;
};

export type InkedToken = {
  /** Positions, normals and vertex colours: one draw call. */
  body: THREE.BufferGeometry;
  /** Welded back-face hull for FIGHTER_INK_MATERIAL, or null. */
  ink: THREE.BufferGeometry | null;
};

export const tokenPart = (
  geometry: THREE.BufferGeometry,
  color: string,
  at?: Vec3,
  rotate?: Vec3,
  scale?: Vec3,
  ink?: boolean
): TokenPart => ({
  geometry, color, at, rotate, scale, ink,
});

/** Parts this small get no line of their own; one would swallow them. */
const TOKEN_INK_MIN_PART = 0.045;

const PART_MATRIX = new THREE.Matrix4();
const PART_EULER = new THREE.Euler();
const PART_QUATERNION = new THREE.Quaternion();
const PART_POSITION = new THREE.Vector3();
const PART_SCALE = new THREE.Vector3();
const PART_COLOR = new THREE.Color();

function partMatrix(entry: TokenPart): THREE.Matrix4 {
  PART_EULER.set(...(entry.rotate ?? [0, 0, 0]));
  PART_QUATERNION.setFromEuler(PART_EULER);
  PART_POSITION.set(...(entry.at ?? [0, 0, 0]));
  PART_SCALE.set(...(entry.scale ?? [1, 1, 1]));
  return PART_MATRIX.compose(PART_POSITION, PART_QUATERNION, PART_SCALE);
}

function coloredPart(entry: TokenPart, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const source = entry.geometry.index ? entry.geometry.toNonIndexed() : entry.geometry.clone();
  source.deleteAttribute('uv');
  source.applyMatrix4(matrix);
  const { count } = source.getAttribute('position');
  // Colours in the working (linear) space, as three.js reads vertex colours.
  PART_COLOR.set(entry.color);
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = PART_COLOR.r;
    colors[index * 3 + 1] = PART_COLOR.g;
    colors[index * 3 + 2] = PART_COLOR.b;
  }
  source.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return source;
}

/** One part's hull, as the fighters build theirs: welded, smoothed normals. */
function hullPart(entry: TokenPart, matrix: THREE.Matrix4): THREE.BufferGeometry | null {
  if (entry.ink === false) return null;
  const { geometry } = entry;
  if (!geometry.boundingSphere) geometry.computeBoundingSphere();
  PART_SCALE.setFromMatrixScale(matrix);
  const radius = (geometry.boundingSphere?.radius ?? 0)
    * Math.max(PART_SCALE.x, PART_SCALE.y, PART_SCALE.z);
  if (radius < TOKEN_INK_MIN_PART) return null;
  const placed = new THREE.BufferGeometry();
  placed.setAttribute('position', geometry.getAttribute('position').clone().applyMatrix4(matrix));
  if (geometry.index) placed.setIndex(geometry.index.clone());
  const welded = mergeVertices(placed, 1e-4);
  placed.dispose();
  welded.computeVertexNormals();
  return welded;
}

/** Merges `parts` into a coloured body and an ink hull (sources are disposed). */
export function buildInkedToken(parts: TokenPart[]): InkedToken {
  const bodies: THREE.BufferGeometry[] = [];
  const hulls: THREE.BufferGeometry[] = [];
  parts.forEach((entry) => {
    const matrix = partMatrix(entry).clone();
    bodies.push(coloredPart(entry, matrix));
    const hull = hullPart(entry, matrix);
    if (hull) hulls.push(hull);
    entry.geometry.dispose();
  });
  const body = mergeGeometries(bodies);
  bodies.forEach((geometry) => geometry.dispose());
  if (!body) throw new Error('Could not merge token parts');
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

/**
 * Toon material for token bodies: the fighters' light bands with vertex
 * colours. One program for every token (ShaderWarmup compiles it); the
 * emissive tint is a uniform, so each look's material is just a pooled copy.
 */
const TOKEN_MATERIALS = new Map<string, THREE.MeshToonMaterial>();

export function tokenToonMaterial(glow = '#000000', glowIntensity = 0): THREE.MeshToonMaterial {
  const key = `${glow}|${glowIntensity}`;
  let material = TOKEN_MATERIALS.get(key);
  if (!material) {
    material = new THREE.MeshToonMaterial({
      gradientMap: FIGHTER_TOON_RAMP,
      vertexColors: true,
      emissive: glow,
      emissiveIntensity: glowIntensity,
    });
    TOKEN_MATERIALS.set(key, material);
  }
  return material;
}

/** The token look for ShaderWarmup (same program as every token body). */
export function createTokenWarmupMaterial(): THREE.Material {
  return new THREE.MeshToonMaterial({ gradientMap: FIGHTER_TOON_RAMP, vertexColors: true });
}

// Primitive helpers shared by the token catalogues. Low segment counts: the
// tokens are a third of a cell wide, and the ink line carries the outline.
export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cylinder = (top: number, bottom: number, h: number, segments = 8) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
export const cone = (r: number, h: number, segments = 8) => new THREE.ConeGeometry(r, h, segments);
export const ball = (r: number, width = 10, height = 8) => (
  new THREE.SphereGeometry(r, width, height)
);
export const dome = (r: number, segments = 10) => (
  new THREE.SphereGeometry(r, segments, 5, 0, Math.PI * 2, 0, Math.PI / 2)
);
export const ring = (r: number, tube: number, radial = 5, tubular = 16) => (
  new THREE.TorusGeometry(r, tube, radial, tubular)
);
export const gem = (r: number) => new THREE.OctahedronGeometry(r, 0);
export const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
export const HALF_TURN = Math.PI / 2;
