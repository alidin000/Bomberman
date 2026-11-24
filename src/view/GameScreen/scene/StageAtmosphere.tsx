/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { StageLook } from '../../../content/stageLooks';
import { isLikelyLowEndDevice } from '../gamePreferences';

/** Where the scene's one directional light sits (and casts its shadow from). */
export const KEY_LIGHT_POSITION: [number, number, number] = [-8, 15, 9];

/**
 * Fog starts this far past the view depth of the board's far edge. The slab's
 * underside dips 0.52 below the board, so a little more than that keeps every
 * part of the board out of the fog.
 */
export const FOG_NEAR_PAD = 0.6;

const FORWARD = new THREE.Vector3();
const AIM = new THREE.Vector3();

/** The key light's shadow box at its smallest (half a side, world units)... */
export const SHADOW_MIN_HALF = 9;
/** ...and at its largest, for the round-start overview's whole board. */
export const SHADOW_MAX_HALF = 28;

/**
 * Half the side of the shadow box for a camera this far from where it
 * looks: enough to cover the ground in view, so every crate, wall and
 * fighter on screen casts its shadow, not only those near the board's corner
 * (three's default box is 5 units round the origin).
 */
export function shadowHalfFor(distance: number): number {
  return Math.min(SHADOW_MAX_HALF, Math.max(SHADOW_MIN_HALF, distance * 0.8));
}

/** The ground point straight ahead of the camera (where it looks), into `out`. */
export function groundAim(camera: THREE.Camera, out: THREE.Vector3): THREE.Vector3 {
  camera.getWorldDirection(FORWARD);
  const t = FORWARD.y < -1e-3 ? -camera.position.y / FORWARD.y : 0;
  return out.copy(camera.position).addScaledVector(FORWARD, t).setY(0);
}

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
  const keyRef = useRef<THREE.DirectionalLight>(null);
  // A sharper shadow map, but a lighter one on low-end devices.
  const mapSize = useMemo(() => (isLikelyLowEndDevice() ? 1024 : 2048), []);

  useLayoutEffect(() => {
    const key = keyRef.current;
    if (!key) return;
    key.shadow.mapSize.set(mapSize, mapSize);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 80;
    // The light's target is not in the scene graph: update it by hand.
    key.target.updateMatrixWorld();
  }, [mapSize]);

  useFrame(({ camera }) => {
    const fog = fogRef.current;
    if (fog) {
      fog.near = Math.max(0, farEdgeViewDepth(camera, farEdgeZ) + FOG_NEAR_PAD);
      fog.far = fog.near + look.fog.range;
    }
    // The key light follows where the camera looks, its direction unchanged,
    // and its shadow box covers what is in view. Snapped to the shadow map's
    // texels, so shadows do not shimmer as the camera glides.
    const key = keyRef.current;
    if (!key) return;
    const aim = groundAim(camera, AIM);
    const half = shadowHalfFor(camera.position.distanceTo(aim));
    const texel = (half * 2) / mapSize;
    aim.set(Math.round(aim.x / texel) * texel, 0, Math.round(aim.z / texel) * texel);
    const [lx, ly, lz] = KEY_LIGHT_POSITION;
    key.position.set(aim.x + lx, ly, aim.z + lz);
    key.target.position.copy(aim);
    key.target.updateMatrixWorld();
    const shadow = key.shadow.camera;
    if (shadow.right !== half) {
      shadow.left = -half;
      shadow.right = half;
      shadow.top = half;
      shadow.bottom = -half;
      shadow.updateProjectionMatrix();
    }
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
        ref={keyRef}
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
