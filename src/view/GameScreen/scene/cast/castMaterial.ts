import * as THREE from 'three';
import { FIGHTER_TOON_RAMP } from '../fighterInk';
import { castAtlasTexture } from './castAtlas';

/**
 * The cast's cel-shaded look: the fighters' three toon bands, vertex colours
 * for flat cloth and skin, and the painted atlas for faces, plates and
 * prints. Two programs in all (solid and see-through), both compiled by
 * ShaderWarmup; glow tints are uniforms on pooled copies.
 */

/** Ghost and water clones: see-through, as the fighters' Ghost look was. */
export const CAST_SEE_THROUGH_OPACITY = 0.55;

type CastMaterialOptions = {
  translucent?: boolean;
  glow?: string;
  glowIntensity?: number;
};

const MATERIALS = new Map<string, THREE.MeshToonMaterial>();

function createCastMaterial(options: CastMaterialOptions = {}): THREE.MeshToonMaterial {
  const translucent = !!options.translucent;
  return new THREE.MeshToonMaterial({
    gradientMap: FIGHTER_TOON_RAMP,
    map: castAtlasTexture(),
    vertexColors: true,
    emissive: options.glow ?? '#000000',
    emissiveIntensity: options.glow ? options.glowIntensity ?? 0.1 : 0,
    transparent: translucent,
    opacity: translucent ? CAST_SEE_THROUGH_OPACITY : 1,
  });
}

/** A pooled cast material (never disposed; a handful per session). */
export function castMaterial(options: CastMaterialOptions = {}): THREE.MeshToonMaterial {
  const key = `${options.translucent ? 1 : 0}|${options.glow ?? ''}|${options.glowIntensity ?? ''}`;
  let material = MATERIALS.get(key);
  if (!material) {
    material = createCastMaterial(options);
    MATERIALS.set(key, material);
  }
  return material;
}

/** Both cast looks for ShaderWarmup: the same programs every figure uses. */
export function createCastWarmupMaterials(): THREE.Material[] {
  return [createCastMaterial(), createCastMaterial({ translucent: true })];
}
