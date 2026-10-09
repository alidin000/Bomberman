/* eslint-disable react/no-unknown-property */
import React, {
  useEffect, useLayoutEffect, useMemo, useRef
} from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TICK_MS } from '../../../engine/constants';
import { getWaveTelegraphCells, waveTelegraphRemainingMs } from '../../../engine/campaignWaves';
import { CampaignWaveRuntimeState, GameEngineState } from '../../../engine/types';
import { MotionStore } from '../../../hooks/motionStore';
import { LABEL_SPRITES, labelSpriteKey } from './labelSprites';
import { toWorld } from './sceneSpace';
import {
  WAVE_MARK_GEOMETRY,
  WAVE_MARK_HALO_MATERIAL,
  WAVE_MARK_INK_MATERIAL,
  waveMarkScale,
} from './waveTelegraph';

// A defense wave's spawn points, marked while the wave is on its way (see
// waveTelegraph.ts). Two instanced meshes stay mounted all match and leave
// the render list while nothing is marked. They are rewritten when the
// engine marks or sends a wave; in between only the closing scale moves,
// read from the live engine state each frame (no React work, no allocation).

export const WAVE_MARK_CAPACITY = 8;
const HALO_Y = 0.041;
const INK_Y = 0.042;
const LABEL_Y = 0.95;
const LABEL_COLOR = '#fff7ed';
// Drawn before the hazard telegraphs (renderOrder 0), so a hazard on the
// same cell stays on top.
const HALO_ORDER = -2;
const INK_ORDER = -1;

const DUMMY = new THREE.Object3D();
const HALO_TAG = { waveMark: 'halo' };
const INK_TAG = { waveMark: 'ink' };

function writeMark(
  mesh: THREE.InstancedMesh,
  index: number,
  x: number,
  z: number,
  y: number,
  scale: number
) {
  DUMMY.position.set(x, y, z);
  DUMMY.rotation.set(0, 0, 0);
  DUMMY.scale.set(scale, 1, scale);
  DUMMY.updateMatrix();
  mesh.setMatrixAt(index, DUMMY.matrix);
}

function MarkLabel({ x, z, text }: { x: number; z: number; text: string }) {
  const key = labelSpriteKey(text, LABEL_COLOR);
  const sprite = useMemo(() => LABEL_SPRITES.get(key), [key]);
  useEffect(() => {
    LABEL_SPRITES.retain(key, sprite);
    return () => LABEL_SPRITES.release(key, sprite);
  }, [key, sprite]);
  return <sprite position={[x, LABEL_Y, z]} scale={[0.82, 0.2, 1]} material={sprite.material} />;
}

function WaveTelegraphsBase({
  waves,
  readLive,
  motion,
}: {
  waves: CampaignWaveRuntimeState | null;
  readLive: () => GameEngineState | null;
  motion: MotionStore | null;
}) {
  const haloRef = useRef<THREE.InstancedMesh>(null);
  const inkRef = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => getWaveTelegraphCells(waves), [waves]);
  const world = useMemo(() => cells.slice(0, WAVE_MARK_CAPACITY).map((cell) => {
    const [x, , z] = toWorld(cell.x, cell.y);
    return { x, z };
  }), [cells]);
  const leadMs = waves?.telegraphMs ?? 1;
  const label = waves && world.length > 0
    ? `Wave ${waves.opened + 1}${waves.held ? ' held' : ''}`
    : '';
  // Interpolates between engine ticks, like the hazard telegraphs.
  const clock = useRef({ remaining: -1, at: 0, scale: -1 });

  useLayoutEffect(() => {
    const halo = haloRef.current;
    const ink = inkRef.current;
    if (!halo || !ink) return;
    const remaining = waveTelegraphRemainingMs(readLive());
    const scale = waveMarkScale(remaining, leadMs);
    world.forEach((cell, index) => {
      writeMark(halo, index, cell.x, cell.z, HALO_Y, scale);
      writeMark(ink, index, cell.x, cell.z, INK_Y, scale);
    });
    [halo, ink].forEach((mesh) => {
      const target = mesh;
      target.count = world.length;
      target.visible = world.length > 0;
      if (world.length > 0) target.instanceMatrix.needsUpdate = true;
    });
    clock.current.scale = scale;
  }, [leadMs, readLive, world]);

  useFrame(() => {
    const halo = haloRef.current;
    const ink = inkRef.current;
    if (!halo || !ink || world.length === 0) return;
    const live = waveTelegraphRemainingMs(readLive());
    const now = motion?.simTimeMs ?? 0;
    const tracked = clock.current;
    if (live !== tracked.remaining) {
      tracked.remaining = live ?? -1;
      tracked.at = now;
    }
    const ahead = Math.min(Math.max(now - tracked.at, 0), TICK_MS);
    const scale = waveMarkScale(live === null ? null : Math.max(0, live - ahead), leadMs);
    if (scale === tracked.scale) return;
    tracked.scale = scale;
    for (let index = 0; index < world.length; index += 1) {
      writeMark(halo, index, world[index].x, world[index].z, HALO_Y, scale);
      writeMark(ink, index, world[index].x, world[index].z, INK_Y, scale);
    }
    halo.instanceMatrix.needsUpdate = true;
    ink.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh
        ref={haloRef}
        args={[WAVE_MARK_GEOMETRY.halo, WAVE_MARK_HALO_MATERIAL, WAVE_MARK_CAPACITY]}
        count={0}
        frustumCulled={false}
        renderOrder={HALO_ORDER}
        userData={HALO_TAG}
      />
      <instancedMesh
        ref={inkRef}
        args={[WAVE_MARK_GEOMETRY.ink, WAVE_MARK_INK_MATERIAL, WAVE_MARK_CAPACITY]}
        count={0}
        frustumCulled={false}
        renderOrder={INK_ORDER}
        userData={INK_TAG}
      />
      {label && world.map((cell) => (
        <MarkLabel key={`${cell.x},${cell.z}`} x={cell.x} z={cell.z} text={label} />
      ))}
    </>
  );
}

// Re-renders only when the engine marks, holds or sends a wave: the wave
// state keeps its identity across ticks otherwise.
export const WaveTelegraphs = React.memo(WaveTelegraphsBase);
