/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FIGHTER_INK_MATERIAL } from './fighterInk';
import {
  ARENA_RING_GEOMETRY, OBJECTIVE_RING_GEOMETRY, OBJECTIVE_RING_MATERIALS, ObjectiveModel,
  ObjectivePose, RingTone, sampleObjectiveIdle,
} from './objectiveModels';

const POSE: ObjectivePose = { lift: 0, yaw: 0 };

type Motion = 'villager' | 'arena' | 'none';

/**
 * An objective's inked model on its floor ring. The ring stays put; the
 * model may shuffle (a waiting villager) or turn (an open arena seal), and
 * holds still under reduced motion. `kind` tags the meshes for tests.
 */
export function ObjectiveFigure({
  model,
  ring,
  kind,
  variant,
  motion = 'none',
  phase = 0,
  reducedMotion,
  arenaRing = false,
}: {
  model: ObjectiveModel;
  ring: RingTone;
  kind: string;
  variant: string;
  motion?: Motion;
  phase?: number;
  reducedMotion: boolean;
  arenaRing?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;
    sampleObjectiveIdle(motion, clock.elapsedTime, phase, reducedMotion, POSE);
    group.position.y = POSE.lift;
    group.rotation.y = POSE.yaw;
  });

  return (
    <>
      <mesh
        position={[0, 0.02, 0]}
        geometry={arenaRing ? ARENA_RING_GEOMETRY : OBJECTIVE_RING_GEOMETRY}
        material={OBJECTIVE_RING_MATERIALS[ring]}
      />
      <group ref={ref}>
        <mesh
          geometry={model.body}
          material={model.material}
          castShadow
          receiveShadow
          userData={{ objectiveModel: kind, variant }}
        />
        {model.ink && <mesh geometry={model.ink} material={FIGHTER_INK_MATERIAL} />}
      </group>
    </>
  );
}
