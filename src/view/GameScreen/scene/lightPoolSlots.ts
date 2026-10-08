import * as THREE from 'three';

/**
 * Point lights that every match keeps mounted. three.js writes the point-light
 * count into every lit shader (and keys its program cache on it), so mounting
 * or unmounting a light recompiles every lit material in the scene. Entities
 * borrow a slot from this fixed pool instead, so the count never changes.
 */
export const POOLED_POINT_LIGHT_COUNT = 5;

/** Higher wins a slot first when more lights are requested than the pool holds. */
export const LIGHT_PRIORITY = {
  explosion: 4,
  bomb: 3,
  player: 2,
  marker: 1,
} as const;

/** Mutable like a THREE.PointLight, so existing useFrame code keeps working. */
export type PooledLightHandle = {
  intensity: number;
  distance: number;
  decay: number;
  color: THREE.Color;
  /** Local position of the anchor; mutate it like `light.position`. */
  position: THREE.Vector3;
};

export type PooledLightRequest = PooledLightHandle & {
  anchor: THREE.Object3D;
  priority: number;
};

/** True when the anchor and every ancestor are visible and it is in a scene. */
export function isAnchorRendered(anchor: THREE.Object3D): boolean {
  let node: THREE.Object3D | null = anchor;
  let root: THREE.Object3D = anchor;
  while (node) {
    if (!node.visible) return false;
    root = node;
    node = node.parent;
  }
  return (root as THREE.Scene).isScene === true;
}

/**
 * Picks which requests get a pool slot this frame: lit, rendered requests,
 * highest priority first, oldest first within a priority. Writes into `out`
 * to avoid per-frame allocation and returns how many slots are used.
 */
export function selectPooledLights(
  requests: Iterable<PooledLightRequest>,
  capacity: number,
  out: PooledLightRequest[],
  isRendered: (anchor: THREE.Object3D) => boolean = isAnchorRendered
): number {
  // eslint-disable-next-line no-param-reassign
  out.length = 0;
  // eslint-disable-next-line no-restricted-syntax
  for (const request of requests) {
    if (request.intensity > 0 && isRendered(request.anchor)) out.push(request);
  }
  if (out.length > capacity) {
    // Array#sort is stable, so insertion (mount) order breaks ties.
    out.sort((a, b) => b.priority - a.priority);
  }
  return Math.min(out.length, capacity);
}
