/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Power } from '../../../model/gameItem';
import { CharacterId } from '../../../content/types';
import { FIGHTER_INK_MATERIAL } from './fighterInk';
import {
  PICKUP_HOVER, PICKUP_REST_YAW, PICKUP_RING_GEOMETRY, PICKUP_SCALE, PICKUP_TILT, PickupIdlePose,
  getPickupModel, samplePickupIdle,
} from './pickupModels';

const POSE: PickupIdlePose = { lift: 0, yaw: 0 };

/**
 * A pickup standing on its cell: the type's floor ring, and the inked token
 * hovering above it. Three draw calls and one shadow caster, from geometry
 * and materials shared by every pickup of the type. The ring stays on the
 * floor; only the token bobs and sways (held still under reduced motion).
 */
export function PickupFigure({
  power,
  characterId,
  reducedMotion,
  phase = 0,
}: {
  power: Power;
  characterId?: CharacterId;
  reducedMotion: boolean;
  phase?: number;
}) {
  const tokenRef = useRef<THREE.Group>(null);
  const model = getPickupModel(power, characterId);

  useFrame(({ clock }) => {
    const token = tokenRef.current;
    if (!token) return;
    samplePickupIdle(clock.elapsedTime, phase, reducedMotion, POSE);
    token.position.y = PICKUP_HOVER + POSE.lift;
    token.rotation.y = POSE.yaw;
  });

  return (
    <>
      <mesh
        position={[0, 0.03, 0]}
        geometry={PICKUP_RING_GEOMETRY}
        material={model.ringMaterial}
        userData={{ pickupRing: power }}
      />
      <group ref={tokenRef} position={[0, PICKUP_HOVER, 0]} rotation={[0, PICKUP_REST_YAW, 0]}>
        <group rotation={[PICKUP_TILT, 0, model.lean]} scale={PICKUP_SCALE}>
          <mesh
            geometry={model.body}
            material={model.material}
            castShadow
            userData={{ pickupToken: power, silhouette: model.silhouette }}
          />
          {model.ink && <mesh geometry={model.ink} material={FIGHTER_INK_MATERIAL} />}
        </group>
      </group>
    </>
  );
}
