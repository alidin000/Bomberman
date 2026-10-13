import * as THREE from 'three';
import { CAST, CastId } from '../../../../content/animeCast';
import type { EnemyArchetype } from '../../../../content/enemies';
import { MONSTER_LOOKS } from '../monsterLooks';
import { CastMesh, buildCastMesh } from './castMesh';
import { EnemyGear, castFigureParts } from './castParts';

/**
 * Cast figures by look, built once per session and shared by every mount
 * (two fighters on the same character, a pack of one enemy kind, the same
 * villager on every visit). Never disposed: about forty looks at most.
 */

const FIGURES = new Map<string, CastMesh>();

/**
 * Enemies stand a little smaller than the heroes, so the tallest hat or
 * hair stays under their nameplate (MonsterNameplate, 0.95 over the pose).
 */
export const ENEMY_CAST_SCALE = 0.84;

const ROOT = new THREE.Matrix4();

function build(key: string, make: () => CastMesh): CastMesh {
  let figure = FIGURES.get(key);
  if (!figure) {
    figure = make();
    FIGURES.set(key, figure);
  }
  return figure;
}

function scaled(scale: number): THREE.Matrix4 {
  return ROOT.makeScale(scale, scale, scale);
}

/** A cast member's figure, standing on y = 0 at their own scale. */
export function castFigureMesh(id: CastId, scale = 1): CastMesh {
  const member = CAST[id];
  return build(`${id}@${scale}`, () => buildCastMesh(
    castFigureParts(member).parts,
    scaled((member.look.scale ?? 1) * scale)
  ));
}

/** An enemy kind: its cast look plus the carried and worn shapes its kind reads by. */
export function enemyFigureMesh(archetype: EnemyArchetype): CastMesh {
  const member = CAST[archetype];
  const look = MONSTER_LOOKS[archetype];
  const gear: EnemyGear = {
    head: look.head, carry: look.carry, trim: look.trim, carried: look.carried,
  };
  return build(`enemy:${archetype}`, () => buildCastMesh(
    castFigureParts(member, gear).parts,
    scaled((member.look.scale ?? 1) * ENEMY_CAST_SCALE)
  ));
}
