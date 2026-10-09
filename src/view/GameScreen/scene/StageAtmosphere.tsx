/* eslint-disable react/no-unknown-property */
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StageLook } from '../../../content/stageLooks';

/** Where the scene's one directional light sits (and casts its shadow from). */
export const KEY_LIGHT_POSITION: [number, number, number] = [-8, 15, 9];

/**
 * Fog starts this far past the view depth of the board's far edge. The slab's
 * underside dips 0.52 below the board, so a little more than that keeps every
 * part of the board out of the fog.
 */
export const FOG_NEAR_PAD = 0.6;

const FORWARD = new THREE.Vector3();

/**
 * View depth (what linear fog measures) of the point on the board's far edge
 * straight ahead of the camera. Every playable cell, and everything standing
 * on one, is nearer than this, so a fog that starts here never touches them.
 */
export function farEdgeViewDepth(camera: THREE.Camera, farEdgeZ: number): number {
  camera.getWorldDirection(FORWARD);
  return (farEdgeZ - camera.position.z) * FORWARD.z - camera.position.y * FORWARD.y;
}

/**
 * The stage's three scene lights, recoloured from its look (same count, kinds
 * and key-light position as before, so no shader changes), and one linear fog
 * that exists from the first frame and only fades the far landmarks into the
 * sky. The fog follows the camera every frame by moving two uniforms.
 */
function StageAtmosphereBase({ look, farEdgeZ }: { look: StageLook; farEdgeZ: number }) {
  const fogRef = useRef<THREE.Fog>(null);

  useFrame(({ camera }) => {
    const fog = fogRef.current;
    if (!fog) return;
    fog.near = Math.max(0, farEdgeViewDepth(camera, farEdgeZ) + FOG_NEAR_PAD);
    fog.far = fog.near + look.fog.range;
  });

  return (
    <>
      {/* Starts out of reach; the first frame moves it to the board edge. */}
      <fog ref={fogRef} attach="fog" args={[look.fog.color, 1000, 1000 + look.fog.range]} />
      <ambientLight color={look.ambient.color} intensity={look.ambient.intensity} />
      <hemisphereLight
        color={look.hemisphere.sky}
        groundColor={look.hemisphere.ground}
        intensity={look.hemisphere.intensity}
      />
      <directionalLight
        position={KEY_LIGHT_POSITION}
        intensity={look.directional.intensity}
        color={look.directional.color}
        castShadow
      />
    </>
  );
}

// SceneContent re-renders every tick; the lights only change with the stage.
export const StageAtmosphere = React.memo(StageAtmosphereBase);
