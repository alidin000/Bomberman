import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';

/**
 * Building blocks for monster and boss figures: each figure is a few merged
 * geometries (one per material), built once per look and shared by every
 * instance, instead of a dozen JSX geometries and materials per mount.
 */

export type Vec3 = [number, number, number];

export type FigurePart = {
  geometry: THREE.BufferGeometry;
  at?: Vec3;
  rotate?: Vec3;
  scale?: Vec3;
};

export const part = (
  geometry: THREE.BufferGeometry,
  at?: Vec3,
  rotate?: Vec3,
  scale?: Vec3
): FigurePart => ({
  geometry, at, rotate, scale,
});

const PART_MATRIX = new THREE.Matrix4();
const PART_EULER = new THREE.Euler();
const PART_QUATERNION = new THREE.Quaternion();
const PART_POSITION = new THREE.Vector3();
const PART_SCALE = new THREE.Vector3();

/** Merges parts into one geometry (positions and normals only). */
export function mergeFigureParts(parts: FigurePart[]): THREE.BufferGeometry {
  const placed = parts.map((entry) => {
    const source = entry.geometry.index ? entry.geometry.toNonIndexed() : entry.geometry.clone();
    entry.geometry.dispose();
    source.deleteAttribute('uv');
    PART_EULER.set(...(entry.rotate ?? [0, 0, 0]));
    PART_QUATERNION.setFromEuler(PART_EULER);
    PART_POSITION.set(...(entry.at ?? [0, 0, 0]));
    PART_SCALE.set(...(entry.scale ?? [1, 1, 1]));
    PART_MATRIX.compose(PART_POSITION, PART_QUATERNION, PART_SCALE);
    source.applyMatrix4(PART_MATRIX);
    return source;
  });
  const merged = mergeGeometries(placed);
  placed.forEach((geometry) => geometry.dispose());
  if (!merged) throw new Error('Could not merge figure parts');
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

/**
 * Opaque figure materials are flat-shaded standard (the floor slab keeps that
 * program alive all match); translucent ones are plain transparent standard,
 * which ShaderWarmup compiles. Neither adds a shader program.
 */
export function createFigureMaterial(
  color: string,
  options: { translucent?: boolean; glow?: string; glowIntensity?: number } = {}
): THREE.MeshStandardMaterial {
  const translucent = !!options.translucent;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness: 0,
    flatShading: !translucent,
    transparent: translucent,
    opacity: translucent ? 0.66 : 1,
    emissive: options.glow ?? color,
    emissiveIntensity: options.glowIntensity ?? (translucent ? 0.32 : 0.06),
  });
}

/** Shared, never-disposed materials keyed by look; a handful per session. */
export class FigureMaterialPool {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  get(
    color: string,
    options: { translucent?: boolean; glow?: string; glowIntensity?: number } = {}
  ): THREE.MeshStandardMaterial {
    const key = `${color}|${options.translucent ? 1 : 0}|${options.glow ?? ''}|${options.glowIntensity ?? ''}`;
    let material = this.materials.get(key);
    if (!material) {
      material = createFigureMaterial(color, options);
      this.materials.set(key, material);
    }
    return material;
  }

  get size(): number {
    return this.materials.size;
  }
}
