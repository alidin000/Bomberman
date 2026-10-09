import * as THREE from 'three';
import {
  STRUCTURE_DAMAGE_STATES, StructureDamage, allObjectiveModels, arenaModel, gateModel,
  gateStateFor, rescueModel, sampleObjectiveIdle, structureDamageFor, structureFlagFor,
  structureModel,
} from './objectiveModels';

const triangles = (geometry: THREE.BufferGeometry) => (
  (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3
);

// Damage per hit as the engine deals it (campaignObjectives.ts): 50, plus the
// stage event's bonus, times the difficulty's scale, against 100 HP.
function hpAfterHits(perHit: number, hits: number): number {
  return Math.max(0, 100 - perHit * hits);
}

describe('defended structure damage', () => {
  it('shows every real hit, and the one-more-hit danger, as HP falls', () => {
    expect(structureDamageFor(100, 100, 'active')).toBe('intact');
    // Normal, Hidden Leaf (Nine Tails Alert +10): one hit leaves 40 of 100.
    expect(structureDamageFor(hpAfterHits(60, 1), 100, 'active')).toBe('critical');
    // Normal, Hidden Sand: one hit leaves 50.
    expect(structureDamageFor(hpAfterHits(50, 1), 100, 'active')).toBe('cracked');
    // Story (half damage), Hidden Leaf: 70, 40, 10, then down.
    expect([1, 2, 3, 4].map((hits) => structureDamageFor(hpAfterHits(30, hits), 100, 'active')))
      .toEqual(['cracked', 'critical', 'critical', 'ruined']);
    // A failed defense is a ruin whatever HP it reports; a held one keeps its scars.
    expect(structureDamageFor(20, 100, 'failed')).toBe('ruined');
    expect(structureDamageFor(55, 100, 'complete')).toBe('cracked');
    // Missing numbers (an old save) read as undamaged, not as a ruin.
    expect(structureDamageFor(undefined, undefined, 'locked')).toBe('intact');
  });

  it('never looks less damaged at lower HP', () => {
    const order = (damage: StructureDamage) => STRUCTURE_DAMAGE_STATES.indexOf(damage);
    let previous = 0;
    for (let hp = 100; hp >= 0; hp -= 1) {
      const step = order(structureDamageFor(hp, 100, 'active'));
      expect(step).toBeGreaterThanOrEqual(previous);
      previous = step;
    }
    expect(previous).toBe(order('ruined'));
  });

  it('draws each damage state as its own shared model, flag aside', () => {
    const bodies = STRUCTURE_DAMAGE_STATES.map((damage) => structureModel(damage, 'alert').body);
    expect(new Set(bodies.map((body) => body.getAttribute('position').count)).size)
      .toBe(STRUCTURE_DAMAGE_STATES.length);
    expect(structureModel('cracked', 'alert')).toBe(structureModel('cracked', 'alert'));
    // The pennant tells locked, held and secured apart; a ruin flies none.
    expect(structureModel('intact', 'alert').body).not.toBe(structureModel('intact', 'secured').body);
    expect(structureModel('ruined', 'alert')).toBe(structureModel('ruined', 'none'));
    expect(structureFlagFor('active')).toBe('alert');
    expect(structureFlagFor('complete')).toBe('secured');
    expect(structureFlagFor('locked')).toBe('none');
  });
});

describe('objective models', () => {
  it('gives rescue, structure, mini-boss gate and arena gate states their own shapes', () => {
    const shapes = [
      rescueModel('waiting'), rescueModel('safe'),
      structureModel('intact', 'alert'),
      gateModel(gateStateFor('locked')), gateModel(gateStateFor('active')),
      gateModel(gateStateFor('complete')),
      arenaModel('sealed'), arenaModel('open'),
    ].map((model) => {
      const size = (model.body.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
      return `${model.body.getAttribute('position').count}:${size.toArray().map((v) => v.toFixed(2))}`;
    });
    expect(new Set(shapes).size).toBe(shapes.length);
    expect(gateStateFor('complete')).toBe('open');
    expect(gateStateFor('active')).toBe('sealed');
  });

  it('keeps every objective model inside its cell, inked and under budget', () => {
    Object.entries(allObjectiveModels()).forEach(([key, model]) => {
      const box = model.body.boundingBox as THREE.Box3;
      expect({ key, footprint: Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) <= 0.53 })
        .toEqual({ key, footprint: true });
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
      // Under the label each marker hangs at 1.3 cells.
      expect(box.max.y).toBeLessThan(1.2);
      expect(model.ink).not.toBeNull();
      expect({ key, triangles: triangles(model.body) <= 420 }).toEqual({ key, triangles: true });
    });
  });

  it('lets a waiting villager and an open arena move, and holds them still under reduced motion', () => {
    const pose = { lift: 0, yaw: 0 };
    const seen = { villager: new Set<string>(), arena: new Set<string>() };
    for (let step = 0; step < 120; step += 1) {
      const t = step / 30;
      (['villager', 'arena'] as const).forEach((motion) => {
        sampleObjectiveIdle(motion, t, 0.4, false, pose);
        seen[motion].add(`${pose.lift.toFixed(3)}/${pose.yaw.toFixed(3)}`);
        expect(pose.lift).toBeLessThanOrEqual(0.03 + 1e-9);
        sampleObjectiveIdle(motion, t, 0.4, true, pose);
        expect(pose).toEqual({ lift: 0, yaw: 0 });
      });
      sampleObjectiveIdle('none', t, 0.4, false, pose);
      expect(pose).toEqual({ lift: 0, yaw: 0 });
    }
    expect(seen.villager.size).toBeGreaterThan(30);
    expect(seen.arena.size).toBeGreaterThan(30);
  });
});
