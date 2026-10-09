import * as THREE from 'three';
import { BOSS_DEFINITIONS } from '../../../content/bosses';
import { BossId } from '../../../content/types';
import {
  BOSS_FIGURE_BOUNDS,
  BOSS_FIGURE_LOOKS,
  BOSS_FIGURE_TONES,
  BOSS_TAIL_SWAY,
  bossTailCount,
  bossTailMatrix,
  getBossFaceGeometry,
  getBossFigureGeometries,
  getBossFigureMaterials,
  getBossTailGeometry,
} from './BossFigure';
import { CAMERA_BACK, CAMERA_FOV_DEG, CAMERA_HEIGHT } from './cameraFraming';

// Each boss is its own creature: its base silhouette, its own features, and
// a fan of tails (as many as it has, in its own shape). The model must keep
// to its footprint in every pose it takes, and leave its glowing face, its
// weak point, in view of the camera.

const IDS = BOSS_DEFINITIONS.map((boss) => boss.id);

/** Every vertex of every tail, placed for one pose of the fan. */
function tailVertices(id: BossId, sway: number, flare: number, droop: number): THREE.Vector3[] {
  const geometry = getBossTailGeometry(id);
  const positions = geometry.getAttribute('position');
  const matrix = new THREE.Matrix4();
  const out: THREE.Vector3[] = [];
  for (let tail = 0; tail < bossTailCount(id); tail += 1) {
    bossTailMatrix(id, tail, sway, flare, droop, matrix);
    for (let index = 0; index < positions.count; index += 1) {
      out.push(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(matrix));
    }
  }
  return out;
}

function baseVertices(id: BossId): THREE.Vector3[] {
  const geometries = getBossFigureGeometries(id);
  const out: THREE.Vector3[] = [];
  BOSS_FIGURE_TONES.forEach((tone) => {
    const positions = geometries[tone]?.getAttribute('position');
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      out.push(new THREE.Vector3().fromBufferAttribute(positions, index));
    }
  });
  return out;
}

// Every pose the presentation can ask for: sway either way, the roar's flare,
// the seal's droop.
const POSES = [-BOSS_TAIL_SWAY, 0, BOSS_TAIL_SWAY].flatMap((sway) => (
  [[0, 0], [1, 0], [0, 1], [1, 1]].map(([flare, droop]) => ({ sway, flare, droop }))
));

describe('boss models', () => {
  it('gives every boss its own creature: its tail shape, its tail count, its body', () => {
    const tailShapes = new Set<string>();
    const bodies = new Set<string>();
    BOSS_DEFINITIONS.forEach((boss) => {
      // One tail per tail the boss has: Shukaku 1 ... Kurama 9.
      expect({ boss: boss.id, tails: bossTailCount(boss.id) })
        .toEqual({ boss: boss.id, tails: boss.tails });
      const tail = getBossTailGeometry(boss.id);
      tail.computeBoundingBox();
      const size = tail.boundingBox!.getSize(new THREE.Vector3());
      tailShapes.add(`${BOSS_FIGURE_LOOKS[boss.id].tail}:${tail.getAttribute('position').count}:${size.toArray().map((v) => v.toFixed(2))}`);
      const box = new THREE.Box3().setFromPoints([
        ...baseVertices(boss.id), ...tailVertices(boss.id, 0, 0, 0),
      ]);
      bodies.add(box.getSize(new THREE.Vector3()).toArray().map((v) => v.toFixed(2)).join('x'));
    });
    expect(tailShapes.size).toBe(IDS.length);
    expect(bodies.size).toBe(IDS.length);
  });

  it('keeps every boss inside its footprint and under its label in every pose', () => {
    const { radius, bottom, top } = BOSS_FIGURE_BOUNDS;
    IDS.forEach((id) => {
      const posed = POSES.flatMap(({ sway, flare, droop }) => tailVertices(id, sway, flare, droop));
      const all = [...baseVertices(id), ...posed];
      const reach = Math.max(...all.map((point) => Math.hypot(point.x, point.z)));
      const box = new THREE.Box3().setFromPoints(all);
      expect({
        id, reach: reach <= radius, top: box.max.y <= top, bottom: box.min.y >= bottom,
      }).toEqual({
        id, reach: true, top: true, bottom: true,
      });
    });
  });

  it('leaves the glowing face in view of the camera, tails and all', () => {
    // From the play camera's pitch, straight on and from the top and bottom
    // of the screen (the field of view either side).
    const pitch = Math.atan2(CAMERA_HEIGHT, CAMERA_BACK);
    const half = (CAMERA_FOV_DEG * Math.PI) / 360;
    const views = [pitch - half, pitch, pitch + half]
      .map((angle) => new THREE.Vector3(0, Math.sin(angle), Math.cos(angle)));
    const raycaster = new THREE.Raycaster();
    IDS.forEach((id) => {
      const geometries = getBossFigureGeometries(id);
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const blockers = (['body', 'trim', 'veil'] as const)
        .map((tone) => geometries[tone])
        .filter((geometry): geometry is THREE.BufferGeometry => !!geometry)
        .map((geometry) => new THREE.Mesh(geometry, material));
      const tails = new THREE.InstancedMesh(getBossTailGeometry(id), material, bossTailCount(id));
      const matrix = new THREE.Matrix4();
      for (let tail = 0; tail < bossTailCount(id); tail += 1) {
        tails.setMatrixAt(tail, bossTailMatrix(id, tail, BOSS_TAIL_SWAY, 1, 0, matrix));
      }
      tails.updateMatrixWorld();
      blockers.push(tails);
      // The eyes: the weak point, drawn in the glowing core material.
      const face = getBossFaceGeometry(id);
      expect(face.getAttribute('position').count).toBeGreaterThan(0);
      const positions = face.getAttribute('position');
      const normals = face.getAttribute('normal');
      views.forEach((view) => {
        let facing = 0;
        let seen = 0;
        for (let index = 0; index < positions.count; index += 1) {
          const normal = new THREE.Vector3().fromBufferAttribute(normals, index);
          if (normal.dot(view) > 0.2) {
            facing += 1;
            const from = new THREE.Vector3().fromBufferAttribute(positions, index)
              .addScaledVector(view, 0.004);
            raycaster.set(from, view);
            if (raycaster.intersectObjects(blockers, false).length === 0) seen += 1;
          }
        }
        expect({ id, faceInView: facing > 0 && seen / facing >= 0.6 })
          .toEqual({ id, faceInView: true });
      });
    });
  });

  it('shares one material set per boss, its see-through twins on transparent programs', () => {
    IDS.forEach((id) => {
      const first = getBossFigureMaterials(id);
      expect(getBossFigureMaterials(id)).toBe(first);
      expect(first.core.emissiveIntensity).toBeGreaterThan(0.5);
      (['body', 'trim', 'core'] as const).forEach((tone) => {
        const twin = first.seeThrough[tone];
        expect(first[tone].transparent).toBe(false);
        expect(twin.transparent).toBe(true);
        // Same flat-shaded program family ShaderWarmup compiles.
        expect(twin.flatShading).toBe(first[tone].flatShading);
      });
    });
  });
});
