/* eslint-disable react/no-unknown-property, react/require-default-props */
import React from 'react';
import * as THREE from 'three';
import { FIGHTER_INK_MATERIAL } from '../fighterInk';
import type { CastMesh } from './castMesh';
import { castMaterial } from './castMaterial';

const SOLID = { translucent: false };
const SEE_THROUGH = { translucent: true };

/**
 * A cast figure: its merged body in the cel-shaded cast material and its
 * ink line, two draw calls. See-through (Ghost, water clones) drops the line
 * with the solid look. `position` places the feet.
 */
export function CastFigure({
  figure,
  seeThrough = false,
  material,
  position,
  scale,
  bodyMark,
  inkMark,
  castShadow = true,
}: {
  figure: CastMesh;
  seeThrough?: boolean;
  /** Overrides the pooled material (a glow tint; same programs). */
  material?: THREE.Material;
  position?: [number, number, number];
  scale?: number;
  bodyMark?: Record<string, unknown>;
  inkMark?: Record<string, unknown>;
  castShadow?: boolean;
}) {
  const body = material ?? castMaterial(seeThrough ? SEE_THROUGH : SOLID);
  return (
    <>
      <mesh
        geometry={figure.body}
        material={body}
        position={position}
        scale={scale}
        castShadow={castShadow}
        userData={bodyMark}
      />
      {figure.ink && (
        <mesh
          geometry={figure.ink}
          material={FIGHTER_INK_MATERIAL}
          position={position}
          scale={scale}
          visible={!seeThrough}
          userData={inkMark}
        />
      )}
    </>
  );
}
