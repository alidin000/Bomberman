import * as THREE from 'three';

/**
 * Frees the GPU memory a per-mount model clone owns by itself. SkeletonUtils
 * clones every skeleton, and three.js gives each one a bone texture the first
 * time it draws; R3F never disposes `<primitive>` objects, so without this each
 * remount of a rigged character (every death and rematch) leaked one texture
 * per skinned mesh. Geometry and material textures are shared with the cached
 * asset and stay. A disposed skeleton rebuilds its texture if it draws again.
 */
export function disposeModelSkeletons(root: THREE.Object3D): void {
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) mesh.skeleton?.dispose();
  });
}
