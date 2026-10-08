import * as THREE from 'three';
import { shareSkeletons } from './sharedSkeletons';

// Two meshes skinned to the same two-bone chain, each with its own Skeleton
// object, the way GLTFLoader and SkeletonUtils.clone build a split character.
function buildRig(inverseOffset = 0) {
  const root = new THREE.Group();
  const hip = new THREE.Bone();
  const knee = new THREE.Bone();
  knee.position.y = 1;
  hip.add(knee);
  root.add(hip);
  root.updateMatrixWorld(true);

  const makeMesh = (offset: number) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0.2, 1.5, 0, -0.2, 0.5, 0], 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 0, 1, 0, 0], 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 0.5, 0.5, 0, 0], 4));
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    const inverses = [hip, knee].map((bone) => bone.matrixWorld.clone().invert());
    inverses[1].elements[13] += offset;
    root.add(mesh);
    mesh.bind(new THREE.Skeleton([hip, knee], inverses), new THREE.Matrix4());
    return mesh;
  };
  const a = makeMesh(0);
  const b = makeMesh(inverseOffset);
  return {
    root, knee, a, b,
  };
}

function posedVertices(mesh: THREE.SkinnedMesh): number[] {
  mesh.skeleton.update();
  const out: number[] = [];
  for (let index = 0; index < 2; index += 1) {
    const { position } = mesh.geometry.attributes;
    const vertex = new THREE.Vector3().fromBufferAttribute(position, index);
    mesh.applyBoneTransform(index, vertex);
    out.push(...vertex.toArray().map((value) => Number(value.toFixed(5))));
  }
  return out;
}

describe('shareSkeletons', () => {
  it('binds meshes of one skin to a single skeleton without changing the pose', () => {
    const separate = buildRig();
    separate.knee.rotation.z = 0.7;
    separate.root.updateMatrixWorld(true);
    const expected = [posedVertices(separate.a), posedVertices(separate.b)];

    const shared = buildRig();
    expect(shareSkeletons(shared.root)).toBe(1);
    expect(shared.b.skeleton).toBe(shared.a.skeleton);
    shared.knee.rotation.z = 0.7;
    shared.root.updateMatrixWorld(true);
    expect([posedVertices(shared.a), posedVertices(shared.b)]).toEqual(expected);
  });

  it('keeps separate skeletons when the bind inverses differ', () => {
    const rig = buildRig(0.25);
    expect(shareSkeletons(rig.root)).toBe(2);
    expect(rig.b.skeleton).not.toBe(rig.a.skeleton);
  });
});
