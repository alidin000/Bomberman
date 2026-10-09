import * as THREE from 'three';
import { STAGE_DEFINITIONS } from '../../../content/stages';
import { EnemyArchetype } from '../../../content/enemies';
import { StageId } from '../../../content/types';
import { GUARD_FIGURE_SCALE, GUARD_LOOKS, GUARD_NAMEPLATE_Y } from './guardLooks';
import {
  MONSTER_FIGURE_SCALE, MONSTER_FIGURE_TONES, getGuardFigureMaterials, getGuardRegaliaGeometry,
  getMonsterFigureGeometries, getMonsterFigureMaterials,
} from './MonsterFigure';
import { MAX_MONSTER_LIFT } from './monsterLooks';

const STAGES = STAGE_DEFINITIONS.map((stage) => stage.id as StageId);

// The archetype each stage's guard spawns as (engine/campaignObjectives.ts).
const GUARD_ARCHETYPES: Record<StageId, EnemyArchetype> = {
  hiddenLeaf: 'anbu',
  hiddenSand: 'sandNinja',
  hiddenMist: 'mistNinja',
  hiddenCloud: 'cloudNinja',
  hiddenStone: 'anbu',
  akatsukiHideout: 'blackZetsu',
  greatShinobiWar: 'blackZetsu',
};

describe('mini-boss guard looks', () => {
  it('dresses each stage guard in its own crest, back piece and colours', () => {
    expect(Object.keys(GUARD_LOOKS).sort()).toEqual([...STAGES].sort());
    const looks = STAGES.map((stage) => GUARD_LOOKS[stage]);
    expect(new Set(looks.map((look) => look.crest)).size).toBe(STAGES.length);
    expect(new Set(looks.map((look) => look.back)).size).toBe(STAGES.length);
    expect(new Set(looks.map((look) => look.body)).size).toBe(STAGES.length);
  });

  it('sets guards that share an archetype apart, and apart from its patrols', () => {
    const regalia = STAGES.map((stage) => getGuardRegaliaGeometry(stage, GUARD_ARCHETYPES[stage]));
    const shapes = regalia.map((geometry) => {
      const size = (geometry.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
      return `${geometry.getAttribute('position').count}:${size.toArray().map((v) => v.toFixed(2))}`;
    });
    expect(new Set(shapes).size).toBe(STAGES.length);
    // Shared per stage and archetype, like the patrol figures.
    expect(getGuardRegaliaGeometry('hiddenLeaf', 'anbu')).toBe(regalia[0]);
    STAGES.forEach((stage) => {
      const archetype = GUARD_ARCHETYPES[stage];
      const guard = getGuardFigureMaterials(stage, archetype);
      const patrol = getMonsterFigureMaterials(archetype, false);
      expect(guard.body.color.getHexString()).not.toBe(patrol.body.color.getHexString());
      // Opaque flat-shaded standard: the program the patrols already use.
      expect(guard.regalia.flatShading).toBe(true);
      expect(guard.regalia.transparent).toBe(false);
    });
  });

  it('keeps the regalia under the raised guard nameplate and inside the cell', () => {
    STAGES.forEach((stage) => {
      const archetype = GUARD_ARCHETYPES[stage];
      const box = new THREE.Box3();
      const figure = getMonsterFigureGeometries(archetype);
      const parts = MONSTER_FIGURE_TONES.map((tone) => figure[tone]);
      [...parts, getGuardRegaliaGeometry(stage, archetype)]
        .forEach((geometry) => {
          geometry.computeBoundingBox();
          box.union(geometry.boundingBox as THREE.Box3);
        });
      const scale = MONSTER_FIGURE_SCALE * GUARD_FIGURE_SCALE;
      // The nameplate's lower bar hangs 0.1 under its centre.
      expect({ stage, clear: box.max.y * scale + MAX_MONSTER_LIFT < GUARD_NAMEPLATE_Y - 0.1 })
        .toEqual({ stage, clear: true });
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z) * scale).toBeLessThan(0.7);
    });
  });
});
