import * as THREE from 'three';
import { Power, powerUpOptions } from '../../../model/gameItem';
import { CHARACTER_DEFINITIONS } from '../../../content/characters';
import { getCampaignPickupPool } from '../../../content/characterPowerups';
import { CharacterId } from '../../../content/types';
import {
  PICKUP_BOB, PICKUP_MODELS, PICKUP_REST_YAW, PICKUP_SCALE, PICKUP_SWAY, PickupIdlePose,
  getPickupModel, samplePickupIdle,
} from './pickupModels';
import { allObjectiveModels } from './objectiveModels';
import { createWarmupMaterials } from './ShaderWarmup';
import { FIGHTER_TOON_RAMP } from './fighterInk';

const CHARACTERS = CHARACTER_DEFINITIONS.map((character) => character.id as CharacterId);

const triangles = (geometry: THREE.BufferGeometry) => (
  (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3
);

function outline(geometry: THREE.BufferGeometry): string {
  geometry.computeBoundingBox();
  const size = (geometry.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
  return `${geometry.getAttribute('position').count}:${[size.x, size.y, size.z].map((v) => v.toFixed(2)).join('x')}`;
}

describe('pickup models', () => {
  it('gives every pickup type its own outline, whoever is playing', () => {
    expect(Object.keys(PICKUP_MODELS).sort()).toEqual([...powerUpOptions].sort());
    expect(new Set(powerUpOptions.map((power) => PICKUP_MODELS[power].silhouette)).size)
      .toBe(powerUpOptions.length);
    CHARACTERS.forEach((characterId) => {
      const outlines = powerUpOptions
        .map((power) => outline(getPickupModel(power, characterId).body));
      expect({ characterId, distinct: new Set(outlines).size })
        .toEqual({ characterId, distinct: powerUpOptions.length });
    });
    // A character's campaign pool, signature pickup included, never shares an outline.
    CHARACTERS.forEach((characterId) => {
      const pool = getCampaignPickupPool(characterId);
      expect(new Set(pool.map((power) => getPickupModel(power, characterId).silhouette)).size)
        .toBe(pool.length);
    });
  });

  it('tints a type by character theme without changing its shape', () => {
    const power: Power = 'AddBomb';
    const deidara = getPickupModel(power, 'deidara');
    const itachi = getPickupModel(power, 'itachi');
    expect(Array.from(deidara.body.getAttribute('position').array))
      .toEqual(Array.from(itachi.body.getAttribute('position').array));
    expect(Array.from(deidara.body.getAttribute('color').array))
      .not.toEqual(Array.from(itachi.body.getAttribute('color').array));
    // Built once per look, then shared.
    expect(getPickupModel(power, 'deidara')).toBe(deidara);
  });

  it('keeps each pickup small: one inked body under a fixed triangle budget', () => {
    CHARACTERS.forEach((characterId) => powerUpOptions.forEach((power) => {
      const model = getPickupModel(power, characterId);
      expect(model.ink).not.toBeNull();
      expect({ power, body: triangles(model.body) <= 320 }).toEqual({ power, body: true });
      expect({ power, ink: triangles(model.ink as THREE.BufferGeometry) <= 320 })
        .toEqual({ power, ink: true });
      // The token stays inside its cell and under the fighter's pickup label.
      const box = model.body.boundingBox as THREE.Box3;
      const reach = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) * PICKUP_SCALE;
      expect(reach).toBeLessThan(0.36);
      expect((box.max.y - box.min.y) * PICKUP_SCALE).toBeLessThan(0.66);
    }));
  });

  it('bobs and sways gently, and holds the rest pose under reduced motion', () => {
    const pose: PickupIdlePose = { lift: 0, yaw: 0 };
    const lifts = new Set<string>();
    for (let step = 0; step < 240; step += 1) {
      const t = step / 30;
      samplePickupIdle(t, 1.2, false, pose);
      expect(Math.abs(pose.lift)).toBeLessThanOrEqual(PICKUP_BOB + 1e-9);
      expect(Math.abs(pose.yaw - PICKUP_REST_YAW)).toBeLessThanOrEqual(PICKUP_SWAY + 1e-9);
      lifts.add(pose.lift.toFixed(3));
      samplePickupIdle(t, 1.2, true, pose);
      expect(pose).toEqual({ lift: 0, yaw: PICKUP_REST_YAW });
    }
    expect(lifts.size).toBeGreaterThan(20);
  });
});

describe('token looks are compiled before play', () => {
  it('warms the toon vertex-colour program every pickup and objective model draws with', () => {
    const warm = createWarmupMaterials();
    const tokenWarm = warm.filter((material) => (
      (material as THREE.MeshToonMaterial).isMeshToonMaterial
      && material.vertexColors
      && !material.transparent
      && (material as THREE.MeshToonMaterial).gradientMap === FIGHTER_TOON_RAMP
    ));
    expect(tokenWarm).toHaveLength(1);
    const used = [
      ...powerUpOptions.map((power) => getPickupModel(power, 'naruto').material),
      ...Object.values(allObjectiveModels()).map((model) => model.material),
    ];
    used.forEach((material) => {
      expect(material.isMeshToonMaterial).toBe(true);
      expect(material.vertexColors).toBe(true);
      expect(material.transparent).toBe(false);
      expect(material.gradientMap).toBe(FIGHTER_TOON_RAMP);
      expect(material.side).toBe(tokenWarm[0].side);
    });
    warm.forEach((material) => material.dispose());
  });
});
