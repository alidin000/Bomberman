/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { StageLandmarkKind, StageLook } from '../../../content/stageLooks';
import { toWorld } from './sceneSpace';
import { StagePropInstance, StagePropSector, placeStageProps } from './landmarkPlacement';
import { LANDMARK_MATERIAL, LandmarkColors, getLandmarkGeometry } from './landmarkGeometry';

/** Landmark bases sit at the slab's underside, so they rise out of the mist. */
export const PROP_BASE_Y = -0.5;

const PROP_MATRIX = new THREE.Matrix4();
const PROP_POSITION = new THREE.Vector3();
const PROP_QUATERNION = new THREE.Quaternion();
const PROP_SCALE = new THREE.Vector3();
const PROP_COLOR = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

type PropLayer = {
  key: string;
  kind: StageLandmarkKind;
  instances: StagePropInstance[];
};

/**
 * One draw per landmark kind and margin: the far skyline per kind, and each
 * side kind split left and right so a camera at one edge culls the other.
 */
export function stagePropLayers(props: StagePropInstance[]): PropLayer[] {
  const layers = new Map<string, PropLayer>();
  props.forEach((prop) => {
    const side: StagePropSector | 'far' = prop.sector;
    const key = `${prop.kind}:${side}`;
    const layer = layers.get(key);
    if (layer) layer.instances.push(prop);
    else layers.set(key, { key, kind: prop.kind, instances: [prop] });
  });
  return [...layers.values()];
}

function LandmarkLayer({
  instances,
  geometry,
}: {
  instances: StagePropInstance[];
  geometry: THREE.BufferGeometry;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    instances.forEach((prop, index) => {
      const [wx, , wz] = toWorld(prop.x, prop.y);
      PROP_POSITION.set(wx, PROP_BASE_Y, wz);
      PROP_QUATERNION.setFromAxisAngle(UP, prop.rotation);
      PROP_SCALE.setScalar(prop.scale);
      PROP_MATRIX.compose(PROP_POSITION, PROP_QUATERNION, PROP_SCALE);
      mesh.setMatrixAt(index, PROP_MATRIX);
      mesh.setColorAt(index, PROP_COLOR.setScalar(prop.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, LANDMARK_MATERIAL, instances.length]}
      castShadow={false}
      receiveShadow={false}
    />
  );
}

/**
 * The stage's off-grid landmarks. Placed once per stage and map size (never
 * per frame), never casting shadows, all on one shared material.
 */
function StageLandmarksBase({
  look,
  slabColor,
  width,
  height,
}: {
  look: StageLook;
  slabColor: string;
  width: number;
  height: number;
}) {
  const layers = useMemo(
    () => stagePropLayers(placeStageProps(look, width, height)),
    [height, look, width]
  );
  const colorsByKind = useMemo(() => {
    const map = new Map<StageLandmarkKind, LandmarkColors>();
    look.landmarks.forEach((set) => {
      map.set(set.kind, {
        body: set.body, trim: set.trim, accent: look.accent, pad: slabColor,
      });
    });
    return map;
  }, [look, slabColor]);

  return (
    <>
      {layers.map((layer) => {
        const colors = colorsByKind.get(layer.kind);
        if (!colors) return null;
        return (
          <LandmarkLayer
            key={layer.key}
            instances={layer.instances}
            geometry={getLandmarkGeometry(layer.kind, colors)}
          />
        );
      })}
    </>
  );
}

export const StageLandmarks = React.memo(StageLandmarksBase);
