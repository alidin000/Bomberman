/* eslint-disable react/no-unknown-property */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TrainingGoal } from '../../../engine/types';
import { dojoLanternCells } from '../../../content/dojoRooms';
import { toWorld } from './sceneSpace';

// The Training Dojo's lantern: the cell a "reach" goal asks for. A paper
// lantern on a floor ring, so it reads by shape (a lit box under a roof), not
// colour alone, and nothing like the hazard marks. It uses only programs the
// shader warmup already compiles (an opaque and a transparent standard
// material, a transparent basic one) and adds no light, so it never compiles
// mid-match. Geometry and materials are shared module resources.

const RING_GEOMETRY = new THREE.RingGeometry(0.3, 0.44, 32);
const RING_EDGE_GEOMETRY = new THREE.RingGeometry(0.44, 0.49, 32);
const BODY_GEOMETRY = new THREE.BoxGeometry(0.44, 0.52, 0.44);
const ROOF_GEOMETRY = new THREE.ConeGeometry(0.4, 0.26, 4);
// Tall enough to stand clear of the wall row in front of it.
const POST_GEOMETRY = new THREE.BoxGeometry(0.07, 0.9, 0.07);

const RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#f2b544',
  transparent: true,
  opacity: 0.9,
});
const RING_EDGE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#211d1a',
  transparent: true,
  opacity: 0.85,
});
const BODY_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#fff1c9',
  emissive: '#f2b544',
  emissiveIntensity: 0.85,
  roughness: 0.6,
});
const INK_MATERIAL = new THREE.MeshStandardMaterial({ color: '#211d1a', roughness: 0.7 });

const BOB_HEIGHT = 0.04;
const BOB_SPEED = 2.2;

function Lantern({ x, y, reducedMotion }: { x: number; y: number; reducedMotion: boolean }) {
  const lamp = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(x, y);
  useFrame(({ clock }) => {
    const group = lamp.current;
    if (!group) return;
    // A slow sway, well under one cycle a second; held still with reduced motion.
    group.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * BOB_SPEED + x) * BOB_HEIGHT;
  });
  return (
    <group position={[wx, 0, wz]}>
      <mesh
        geometry={RING_GEOMETRY}
        material={RING_MATERIAL}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        renderOrder={2}
      />
      <mesh
        geometry={RING_EDGE_GEOMETRY}
        material={RING_EDGE_MATERIAL}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        renderOrder={2}
      />
      <mesh geometry={POST_GEOMETRY} material={INK_MATERIAL} position={[0, 0.45, 0]} />
      <group ref={lamp}>
        <mesh geometry={BODY_GEOMETRY} material={BODY_MATERIAL} position={[0, 1.12, 0]} />
        <mesh
          geometry={ROOF_GEOMETRY}
          material={INK_MATERIAL}
          position={[0, 1.51, 0]}
          rotation={[0, Math.PI / 4, 0]}
        />
      </group>
    </group>
  );
}

export function DojoMarkers({
  goals,
  reducedMotion,
}: {
  goals: readonly TrainingGoal[] | undefined;
  reducedMotion: boolean;
}) {
  const lanterns = dojoLanternCells(goals);
  if (lanterns.length === 0) return null;
  return (
    <>
      {lanterns.map((cell) => (
        <Lantern
          key={`lantern-${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  );
}
