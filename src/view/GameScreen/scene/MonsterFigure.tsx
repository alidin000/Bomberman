/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CastId } from '../../../content/animeCast';
import { EnemyArchetype } from '../../../content/enemies';
import { StageId } from '../../../content/types';
import { MonsterState } from '../../../engine/types';
import {
  MONSTER_LOOKS, MonsterPose, monsterArchetypeOf, monsterMotionPhase,
} from './monsterLooks';
import { GUARD_CAST, GUARD_FIGURE_SCALE } from './guardLooks';
import { CastFigure } from './cast/CastFigure';
import type { CastMesh } from './cast/castMesh';
import { ENEMY_CAST_SCALE, castFigureMesh, enemyFigureMesh } from './cast/castGeometry';
import { castMaterial } from './cast/castMaterial';

/**
 * One enemy figure per archetype, drawn from the anime cast
 * (content/animeCast.ts): the kind's outfit, hair, headband and face, plus
 * the head and hand shapes it reads by at a distance (monsterLooks.ts). Each
 * look is one merged geometry shared by the whole pack, with the fighters'
 * ink line: two draw calls an enemy. A mini-boss gate guard is drawn as its
 * stage's canon mini-boss (guardLooks.ts). The pose group plays the
 * archetype's motion profile on top of the engine-driven position.
 */

/** The figure's feet, in its pose group (the group stands 0.45 over the floor). */
export const MONSTER_FEET_Y = -0.45;

/** The figure drawn for an enemy kind. */
export function monsterFigureMesh(archetype: EnemyArchetype): CastMesh {
  return enemyFigureMesh(archetype);
}

/** The figure drawn for a stage's gate guard. */
export function guardFigureMesh(stageId: StageId): CastMesh {
  return castFigureMesh(GUARD_CAST[stageId], ENEMY_CAST_SCALE);
}

// Water clones and crate-phasing monsters: see-through, a cool glow (pooled).
const SEE_THROUGH = { translucent: true, glow: '#7dd3fc', glowIntensity: 0.22 };

const POSE = new MonsterPose();

/**
 * Figures are drawn a little larger than their parts' unit size, so the head
 * and carried shapes stay readable at the zoomed-out shared-screen camera.
 * The nameplate sits above the tallest figure at this scale.
 */
export const MONSTER_FIGURE_SCALE = 1.12;

/** Water clones and crate-phasing monsters draw see-through. */
export function monsterIsTranslucent(monster: Pick<MonsterState, 'kind' | 'clone'>): boolean {
  return monster.kind === 'ghost' || !!monster.clone;
}

export function MonsterFigure({
  monster,
  reducedMotion,
  guard,
}: {
  monster: MonsterState;
  reducedMotion: boolean;
  /** The stage whose mini-boss gate this monster guards, if it does. */
  guard?: StageId;
}) {
  const poseRef = useRef<THREE.Group>(null);
  const archetype = monsterArchetypeOf(monster);
  const look = MONSTER_LOOKS[archetype];
  const translucent = monsterIsTranslucent(monster);
  // A guard's water clone keeps the patrol look: only the guard is the mini-boss.
  const guardStage = guard && !translucent ? guard : undefined;
  const figure = guardStage ? guardFigureMesh(guardStage) : monsterFigureMesh(archetype);
  const castId: CastId = guardStage ? GUARD_CAST[guardStage] : archetype;
  const marks = useMemo(() => ({
    body: { castFigure: castId, guardFigure: guardStage },
    ink: { castInk: castId },
  }), [castId, guardStage]);
  const phase = useMemo(() => monsterMotionPhase(monster.id), [monster.id]);
  const figureScale = MONSTER_FIGURE_SCALE * (guardStage ? GUARD_FIGURE_SCALE : 1);

  useFrame(({ clock }) => {
    const group = poseRef.current;
    if (!group) return;
    POSE.sample(look.motion, clock.elapsedTime + phase, look.tempo, reducedMotion);
    group.position.set(0, POSE.lift, POSE.reach);
    group.rotation.set(POSE.lean, 0, POSE.roll);
    group.scale.set(figureScale, figureScale * POSE.squash, figureScale);
  });

  return (
    <group ref={poseRef} scale={figureScale}>
      <CastFigure
        figure={figure}
        seeThrough={translucent}
        material={translucent ? castMaterial(SEE_THROUGH) : undefined}
        position={[0, MONSTER_FEET_Y, 0]}
        bodyMark={marks.body}
        inkMark={marks.ink}
      />
    </group>
  );
}
