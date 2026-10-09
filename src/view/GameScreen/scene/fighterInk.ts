/* eslint-disable no-param-reassign -- shader sources are patched in place by three.js hooks */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';

/**
 * The fighters' illustrated look: toon light bands and a dark indigo ink
 * line. Terrain, enemies and floor marks keep their own materials and no line.
 *
 * The line is an inverted hull: the fighter's parts, welded into one
 * geometry per character with smoothed normals, drawn back faces only in one
 * unlit material that pushes each vertex out along its normal. That is one
 * extra draw call per fighter, not one per part, and the hull sits in the
 * fighter's pose group, so the lean, squash, KO fall and hide all carry it.
 */

/** Light bands, dark to lit: each texel covers a third of the N·L range. */
const TOON_BANDS = [82, 165, 255];

/** Shared by every fighter toon material (one texture, one program define). */
const FIGHTER_TOON_RAMP = (() => {
  const texture = new THREE.DataTexture(
    new Uint8Array(TOON_BANDS),
    TOON_BANDS.length,
    1,
    THREE.RedFormat
  );
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
})();

const FIGHTER_INK_COLOR = '#1b1640';
/** High contrast inks the line black (a uniform: no new program). */
export const FIGHTER_INK_HIGH_CONTRAST = '#000000';
/** How far the line stands off the parts, in fighter units (about 1.3 tall). */
const FIGHTER_INK_WIDTH = 0.034;
/**
 * ...but never thinner than this many drawn pixels: on a phone the world
 * width alone falls under half a pixel and the line breaks up as it moves.
 */
const FIGHTER_INK_MIN_PIXELS = 1.1;
/**
 * Parts smaller than this get no hull of their own: a line round an eye or a
 * face mark would swallow it.
 */
const FIGHTER_INK_MIN_PART = 0.06;

/** Shared by every ink material, so the warm-up copy and the live one agree. */
const INK_UNIFORMS = {
  inkWidth: { value: FIGHTER_INK_WIDTH },
  inkMinPixels: { value: FIGHTER_INK_MIN_PIXELS },
  inkViewportHeight: { value: 768 },
};

/** The drawing buffer's height in pixels; the min-width rule measures in it. */
export function setInkViewportHeight(pixels: number): void {
  INK_UNIFORMS.inkViewportHeight.value = pixels;
}

function injectInk(shader: THREE.WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, INK_UNIFORMS);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
uniform float inkWidth;
uniform float inkMinPixels;
uniform float inkViewportHeight;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
  // World units one drawn pixel spans at this vertex's depth.
  float inkDepth = -( modelViewMatrix * vec4( transformed, 1.0 ) ).z;
  float inkPixel = 2.0 * inkDepth / ( projectionMatrix[ 1 ][ 1 ] * inkViewportHeight );
  transformed += normalize( normal ) * max( inkWidth, inkMinPixels * inkPixel );`);
}

/** Back faces only, unlit, opaque, fogged like the rest of the scene. */
function createInkMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: FIGHTER_INK_COLOR,
    side: THREE.BackSide,
  });
  material.onBeforeCompile = injectInk;
  material.customProgramCacheKey = () => 'fighter-ink';
  return material;
}

export const FIGHTER_INK_MATERIAL = createInkMaterial();

const FIGHTER_GHOST_OPACITY = 0.55;

type ToonOptions = {
  /** Ghost power: see-through, as the standard fighter materials were. */
  ghost?: boolean;
  glow?: string;
  glowIntensity?: number;
};

/** Every toon fighter material, shared by look; a few dozen per session at most. */
const TOON_MATERIALS = new Map<string, THREE.MeshToonMaterial>();

export function fighterToonMaterial(
  color: string,
  options: ToonOptions = {}
): THREE.MeshToonMaterial {
  const ghost = !!options.ghost;
  const key = `${color}|${ghost ? 1 : 0}|${options.glow ?? ''}|${options.glowIntensity ?? 0}`;
  let material = TOON_MATERIALS.get(key);
  if (!material) {
    material = new THREE.MeshToonMaterial({
      color,
      gradientMap: FIGHTER_TOON_RAMP,
      emissive: options.glow ?? '#000000',
      emissiveIntensity: options.glow ? options.glowIntensity ?? 0.08 : 0,
      transparent: ghost,
      opacity: ghost ? FIGHTER_GHOST_OPACITY : 1,
    });
    TOON_MATERIALS.set(key, material);
  }
  return material;
}

/** Each look a fighter takes in a match (solid, Ghost, ink), for ShaderWarmup. */
export function createFighterWarmupMaterials(): THREE.Material[] {
  return [
    new THREE.MeshToonMaterial({ gradientMap: FIGHTER_TOON_RAMP }),
    new THREE.MeshToonMaterial({ gradientMap: FIGHTER_TOON_RAMP, transparent: true }),
    createInkMaterial(),
  ];
}

const TO_ROOT = new THREE.Matrix4();
const PART_SCALE = new THREE.Vector3();

/** `object`'s transform in `root`'s space, from local matrices (any pose). */
function matrixToRoot(
  object: THREE.Object3D,
  root: THREE.Object3D,
  target: THREE.Matrix4
): boolean {
  target.identity();
  let node: THREE.Object3D | null = object;
  while (node && node !== root) {
    node.updateMatrix();
    target.premultiply(node.matrix);
    node = node.parent;
  }
  return node === root;
}

/** One part's hull in root space: positions welded, normals smoothed. */
function partHull(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry {
  const source = mesh.geometry;
  const placed = new THREE.BufferGeometry();
  placed.setAttribute('position', source.getAttribute('position').clone().applyMatrix4(matrix));
  if (source.index) placed.setIndex(source.index.clone());
  // Primitive seams, poles and box edges repeat positions; welding them
  // gives one averaged normal per corner, so the pushed-out shell is closed.
  const welded = mergeVertices(placed, 1e-4);
  placed.dispose();
  welded.computeVertexNormals();
  return welded;
}

/**
 * Merges the ink hull of every mesh under `root` (in `root`'s space). Parts
 * under FIGHTER_INK_MIN_PART are left out. Null if nothing qualifies.
 */
function buildInkHull(root: THREE.Object3D): THREE.BufferGeometry | null {
  const hulls: THREE.BufferGeometry[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh === root || !matrixToRoot(mesh, root, TO_ROOT)) return;
    const { geometry } = mesh;
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    PART_SCALE.setFromMatrixScale(TO_ROOT);
    const radius = (geometry.boundingSphere?.radius ?? 0)
      * Math.max(PART_SCALE.x, PART_SCALE.y, PART_SCALE.z);
    if (radius < FIGHTER_INK_MIN_PART) return;
    hulls.push(partHull(mesh, TO_ROOT));
  });
  if (!hulls.length) return null;
  const merged = mergeGeometries(hulls);
  hulls.forEach((hull) => hull.dispose());
  if (!merged) return null;
  merged.computeBoundingSphere();
  // The shader pushes vertices out (under 0.1 even at phone size); keep
  // them inside the culling sphere.
  if (merged.boundingSphere) merged.boundingSphere.radius += 0.15;
  return merged;
}

/**
 * One hull per character for the session (the figure only depends on the
 * character), built from the first mounted figure and never disposed.
 */
const INK_HULLS = new Map<string, THREE.BufferGeometry | null>();

export function inkHullFor(key: string, root: THREE.Object3D | null): THREE.BufferGeometry | null {
  if (INK_HULLS.has(key)) return INK_HULLS.get(key) ?? null;
  if (!root) return null;
  const hull = buildInkHull(root);
  INK_HULLS.set(key, hull);
  return hull;
}

export function cachedInkHull(key: string): THREE.BufferGeometry | null {
  return INK_HULLS.get(key) ?? null;
}
