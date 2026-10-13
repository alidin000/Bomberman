/* eslint-disable no-param-reassign -- shader sources are patched in place by three.js hooks */
import * as THREE from 'three';

/**
 * The fighters' illustrated look: toon light bands and a dark indigo ink
 * line. Terrain, enemies and floor marks keep their own materials and no line.
 *
 * The line is an inverted hull: a figure's parts, welded into one geometry
 * per look with smoothed normals (cast/castMesh.ts, inkedToken.ts), drawn
 * back faces only in one unlit material that pushes each vertex out along
 * its normal. That is one extra draw call per figure, not one per part, and
 * the hull sits in the figure's pose group, so the lean, squash, KO fall and
 * hide all carry it.
 */

/** Light bands, dark to lit: each texel covers a third of the N·L range. */
const TOON_BANDS = [82, 165, 255];

/**
 * Shared by every fighter toon material (one texture, one program define),
 * and by the inked tokens (pickups, objectives; see inkedToken.ts).
 */
export const FIGHTER_TOON_RAMP = (() => {
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

/** A fresh copy of the ink look, for ShaderWarmup's instanced variant. */
export function createInkWarmupMaterial(): THREE.MeshBasicMaterial {
  return createInkMaterial();
}

/** The fighters' ink line, for ShaderWarmup (their bodies: cast/castMaterial.ts). */
export function createFighterWarmupMaterials(): THREE.Material[] {
  return [createInkMaterial()];
}
