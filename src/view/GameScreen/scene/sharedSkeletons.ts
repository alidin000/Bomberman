import * as THREE from 'three';

function sameSkeleton(a: THREE.Skeleton, b: THREE.Skeleton): boolean {
  return a.bones.length === b.bones.length
    && a.bones.every((bone, index) => (
      bone === b.bones[index] && a.boneInverses[index].equals(b.boneInverses[index])
    ));
}

/**
 * GLTFLoader (and SkeletonUtils.clone) give every skinned mesh its own
 * Skeleton even when the meshes share one skin, so an eight-mesh character
 * updated and uploaded eight identical bone textures every frame. Rebinds
 * meshes that use the same bones and bind inverses to one Skeleton; each mesh
 * keeps its own bind matrix. Returns how many skeletons remain.
 */
export function shareSkeletons(root: THREE.Object3D): number {
  const skeletons: THREE.Skeleton[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const match = skeletons.find((skeleton) => sameSkeleton(skeleton, mesh.skeleton));
    if (match) mesh.bind(match, mesh.bindMatrix);
    else skeletons.push(mesh.skeleton);
  });
  return skeletons.length;
}
