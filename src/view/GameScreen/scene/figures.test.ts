import * as THREE from 'three';
import { ENEMY_ARCHETYPE_DEFINITIONS, EnemyArchetype } from '../../../content/enemies';
import { BOSS_DEFINITIONS } from '../../../content/bosses';
import {
  MAX_MONSTER_LIFT,
  MAX_MONSTER_REACH,
  MONSTER_LOOKS,
  MonsterMotionProfile,
  MonsterPose,
  monsterLookFor,
} from './monsterLooks';
import {
  MONSTER_FIGURE_SCALE,
  MONSTER_FIGURE_TONES,
  getMonsterFigureGeometries,
  getMonsterFigureMaterials,
} from './MonsterFigure';
import {
  BOSS_FIGURE_BOUNDS,
  BOSS_FIGURE_TONES,
  getBossFigureGeometries,
  getBossFigureMaterials,
} from './BossFigure';

const ARCHETYPES = Object.keys(ENEMY_ARCHETYPE_DEFINITIONS) as EnemyArchetype[];

function bounds(geometries: (THREE.BufferGeometry | undefined)[]): THREE.Box3 {
  const box = new THREE.Box3();
  geometries.forEach((geometry) => {
    if (!geometry) return;
    geometry.computeBoundingBox();
    if (geometry.boundingBox) box.union(geometry.boundingBox);
  });
  return box;
}

function reach(geometries: (THREE.BufferGeometry | undefined)[]): number {
  let farthest = 0;
  geometries.forEach((geometry) => {
    const positions = geometry?.getAttribute('position');
    if (!positions) return;
    for (let index = 0; index < positions.count; index += 1) {
      farthest = Math.max(farthest, Math.hypot(positions.getX(index), positions.getZ(index)));
    }
  });
  return farthest;
}

describe('enemy silhouettes', () => {
  it('gives every archetype its own head shape, carried shape and motion pairing', () => {
    const looks = ARCHETYPES.map((archetype) => MONSTER_LOOKS[archetype]);
    expect(new Set(looks.map((look) => look.head)).size).toBe(ARCHETYPES.length);
    expect(new Set(looks.map((look) => look.carry)).size).toBe(ARCHETYPES.length);
    // Motion alone cannot tell two archetypes apart, the full triple must.
    expect(new Set(looks.map((look) => `${look.head}/${look.carry}/${look.motion}`)).size)
      .toBe(ARCHETYPES.length);
    // Before: one look per movement kind, so three fork-kind archetypes drew alike.
    const forkKind = ['anbu', 'cloudNinja', 'blackZetsu'] as EnemyArchetype[];
    const forkHeads = forkKind.map((archetype) => monsterLookFor({ archetype, kind: 'fork' }).head);
    expect(new Set(forkHeads).size).toBe(forkKind.length);
  });

  it('draws each archetype from distinct shared geometry that keeps under its nameplate', () => {
    // MonsterNameplate hangs at 0.95; its lower bar reaches 0.1 below that.
    const nameplateBottom = 0.95 - 0.1;
    const headgear = new Set<string>();
    ARCHETYPES.forEach((archetype) => {
      const geometries = getMonsterFigureGeometries(archetype);
      // Shared: the second monster of an archetype reuses the first one's buffers.
      expect(getMonsterFigureGeometries(archetype)).toBe(geometries);
      const box = bounds(MONSTER_FIGURE_TONES.map((tone) => geometries[tone]));
      expect((box.max.y * MONSTER_FIGURE_SCALE) + MAX_MONSTER_LIFT).toBeLessThan(nameplateBottom);
      expect(reach(MONSTER_FIGURE_TONES.map((tone) => geometries[tone])) * MONSTER_FIGURE_SCALE)
        .toBeLessThan(0.62);
      const trim = geometries.trim.getAttribute('position');
      headgear.add(`${trim.count}:${geometries.trim.boundingBox?.max.y.toFixed(3)}`);
    });
    expect(headgear.size).toBe(ARCHETYPES.length);
  });

  it('reuses one material per look instead of creating them per monster', () => {
    const first = getMonsterFigureMaterials('anbu', false);
    const second = getMonsterFigureMaterials('anbu', false);
    MONSTER_FIGURE_TONES.forEach((tone) => expect(second[tone]).toBe(first[tone]));
    const ghost = getMonsterFigureMaterials('anbu', true);
    expect(ghost.body).not.toBe(first.body);
    expect(ghost.body.transparent).toBe(true);
    // Translucent figures stay on the transparent standard program ShaderWarmup compiles.
    expect(ghost.body.flatShading).toBe(false);
  });

  it('moves by profile, stays within bounds, and holds still under reduced motion', () => {
    const pose = new MonsterPose();
    const profiles: MonsterMotionProfile[] = ['dart', 'glide', 'float', 'stomp', 'twitch', 'lunge'];
    const traces = profiles.map((profile) => {
      let lift = 0;
      let forward = 0;
      let roll = 0;
      for (let step = 0; step < 400; step += 1) {
        const t = step / 60;
        pose.sample(profile, t, 1.35, false);
        expect(pose.lift).toBeGreaterThanOrEqual(-1e-9);
        expect(pose.lift).toBeLessThanOrEqual(MAX_MONSTER_LIFT + 1e-9);
        expect(pose.reach).toBeLessThanOrEqual(MAX_MONSTER_REACH + 1e-9);
        lift = Math.max(lift, pose.lift);
        forward = Math.max(forward, pose.reach);
        roll = Math.max(roll, Math.abs(pose.roll));
        pose.sample(profile, t, 1.35, true);
        expect([pose.lift, pose.reach, pose.roll, pose.squash]).toEqual([0, 0, 0, 1]);
      }
      return {
        profile, lift, forward, roll,
      };
    });
    const byProfile = Object.fromEntries(traces.map((trace) => [trace.profile, trace]));
    expect(byProfile.glide.lift).toBe(0);
    expect(byProfile.dart.lift).toBeGreaterThan(0.03);
    expect(byProfile.lunge.forward).toBeGreaterThan(0.08);
    expect(byProfile.lunge.lift).toBe(0);
    expect(byProfile.twitch.roll).toBeGreaterThan(0.04);
  });
});

describe('boss bases', () => {
  it('gives all nine bosses a different base inside the boss footprint', () => {
    const shapes = new Set<string>();
    BOSS_DEFINITIONS.forEach((boss) => {
      const geometries = getBossFigureGeometries(boss.id);
      const parts = BOSS_FIGURE_TONES.map((tone) => geometries[tone]);
      const box = bounds(parts);
      expect({ boss: boss.id, reach: reach(parts) <= BOSS_FIGURE_BOUNDS.radius })
        .toEqual({ boss: boss.id, reach: true });
      expect(box.max.y).toBeLessThanOrEqual(BOSS_FIGURE_BOUNDS.top);
      expect(box.min.y).toBeGreaterThanOrEqual(BOSS_FIGURE_BOUNDS.bottom);
      // Every base carries an emissive focal point (eyes, windows, cracks).
      expect(geometries.core?.getAttribute('position').count).toBeGreaterThan(0);
      expect(getBossFigureMaterials(boss.id).core.emissiveIntensity).toBeGreaterThan(0.5);
      const size = box.getSize(new THREE.Vector3());
      shapes.add([size.x, size.y, size.z].map((value) => value.toFixed(2)).join('x'));
    });
    expect(shapes.size).toBe(BOSS_DEFINITIONS.length);
  });
});
