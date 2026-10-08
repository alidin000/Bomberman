import { vi } from 'vitest';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils';
import { disposeModelSkeletons } from './modelDisposal';

function riggedModel(): THREE.Group {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  const spine = new THREE.Bone();
  hip.add(spine);
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  mesh.add(hip);
  mesh.bind(new THREE.Skeleton([hip, spine]));
  root.add(mesh);
  return root;
}

function skeletonOf(root: THREE.Object3D): THREE.Skeleton {
  let skeleton: THREE.Skeleton | undefined;
  root.traverse((object) => {
    const mesh = object as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) skeleton = mesh.skeleton;
  });
  if (!skeleton) throw new Error('no skeleton');
  return skeleton;
}

describe('disposeModelSkeletons', () => {
  it("frees a remounted clone's bone texture and leaves the cached asset's skeleton alone", () => {
    const asset = riggedModel();
    skeletonOf(asset).computeBoneTexture();
    const assetTexture = skeletonOf(asset).boneTexture!;
    const assetDisposed = vi.fn();
    assetTexture.addEventListener('dispose', assetDisposed);

    // What LoadedSceneModel does per mount; the renderer then builds a bone texture.
    const mounted = cloneSkeleton(asset);
    const cloneSkeletonRef = skeletonOf(mounted);
    expect(cloneSkeletonRef).not.toBe(skeletonOf(asset));
    cloneSkeletonRef.computeBoneTexture();
    const cloneDisposed = vi.fn();
    cloneSkeletonRef.boneTexture!.addEventListener('dispose', cloneDisposed);

    disposeModelSkeletons(mounted);

    // A 'dispose' event is what makes WebGLTextures delete the GPU texture.
    expect(cloneDisposed).toHaveBeenCalledTimes(1);
    expect(cloneSkeletonRef.boneTexture).toBeNull();
    expect(assetDisposed).not.toHaveBeenCalled();
    expect(skeletonOf(asset).boneTexture).toBe(assetTexture);
  });
});
