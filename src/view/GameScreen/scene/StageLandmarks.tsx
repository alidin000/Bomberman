/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { StageLandmarkKind, StageLook } from '../../../content/stageLooks';
import { toWorld } from './sceneSpace';
import { StagePropInstance, StagePropSector, placeStageProps } from './landmarkPlacement';
import { LANDMARK_MATERIAL, LandmarkColors, getLandmarkGeometry } from './landmarkGeometry';
import { useScenery } from './scenery';

/** Landmark bases sit at the slab's underside, so they rise out of the mist. */
export const PROP_BASE_Y = -0.5;

const PROP_MATRIX = new THREE.Matrix4();
const PROP_POSITION = new THREE.Vector3();
const PROP_QUATERNION = new THREE.Quaternion();
const PROP_SCALE = new THREE.Vector3();
const PROP_COLOR = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/** Open water sits just under the slab's top, so it laps at the arena's sides. */
export const WATER_Y = -0.4;
const WATER_REACH = 90;
// One per water colour, for the session. Plain standard (the floor's own
// program): no new shader, and fog fades it into the mist.
const WATER_MATERIALS = new Map<string, THREE.MeshStandardMaterial>();
const WATER_GEOMETRY = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

function waterMaterial(color: string): THREE.MeshStandardMaterial {
  let material = WATER_MATERIALS.get(color);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    WATER_MATERIALS.set(color, material);
  }
  return material;
}

type PropLayer = {
  key: string;
  kind: StageLandmarkKind;
  instances: StagePropInstance[];
  /** The village's famous places: one merged draw for all of them. */
  famous?: boolean;
};

/**
 * One draw per landmark kind and margin: the far skyline per kind, and each
 * side kind split left and right so a camera at one edge culls the other.
 */
export function stagePropLayers(props: StagePropInstance[]): PropLayer[] {
  const layers = new Map<string, PropLayer>();
  props.forEach((prop) => {
    const side: StagePropSector | 'far' = prop.sector;
    const key = prop.famous ? 'famous' : `${prop.kind}:${side}`;
    const layer = layers.get(key);
    if (layer) layer.instances.push(prop);
    else {
      layers.set(key, {
        key, kind: prop.kind, instances: [prop], famous: prop.famous || undefined,
      });
    }
  });
  return [...layers.values()];
}

// The famous places each stand once, so they are merged into one geometry
// (placed round the first of them) instead of one instanced draw per kind.
const FAMOUS_GEOMETRY = new Map<string, THREE.BufferGeometry>();
const FAMOUS_EULER = new THREE.Euler();

function famousGeometry(
  key: string,
  instances: StagePropInstance[],
  colorsFor: (kind: StageLandmarkKind) => LandmarkColors | undefined
): THREE.BufferGeometry | null {
  const cached = FAMOUS_GEOMETRY.get(key);
  if (cached) return cached;
  const [origin] = instances;
  const parts: THREE.BufferGeometry[] = [];
  instances.forEach((prop) => {
    const colors = colorsFor(prop.kind);
    if (!colors) return;
    const geometry = getLandmarkGeometry(prop.kind, colors).clone();
    const tone = geometry.getAttribute('color');
    for (let index = 0; index < tone.count; index += 1) {
      tone.setXYZ(
        index,
        tone.getX(index) * prop.shade,
        tone.getY(index) * prop.shade,
        tone.getZ(index) * prop.shade
      );
    }
    PROP_QUATERNION.setFromEuler(FAMOUS_EULER.set(0, prop.rotation, 0));
    PROP_MATRIX.compose(
      PROP_POSITION.set(prop.x - origin.x, 0, prop.y - origin.y),
      PROP_QUATERNION,
      PROP_SCALE.setScalar(prop.scale)
    );
    geometry.applyMatrix4(PROP_MATRIX);
    parts.push(geometry);
  });
  const merged = parts.length ? mergeGeometries(parts) : null;
  parts.forEach((geometry) => geometry.dispose());
  if (merged) FAMOUS_GEOMETRY.set(key, merged);
  return merged;
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
 * per frame), never casting shadows, all on one shared material. Not drawn
 * at all with the scenery setting off; their material shares the wall and
 * crate program, so turning them back on mid-match compiles nothing.
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
  const scenery = useScenery();
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

  if (!scenery) return null;
  const [centerX, , centerZ] = toWorld((width - 1) / 2, (height - 1) / 2);
  return (
    <>
      {look.water && (
        <mesh
          geometry={WATER_GEOMETRY}
          material={waterMaterial(look.water)}
          position={[centerX, WATER_Y, centerZ]}
          scale={[width + WATER_REACH, 1, height + WATER_REACH]}
          receiveShadow
          userData={{ stageWater: true }}
        />
      )}
      {layers.map((layer) => {
        if (layer.famous) {
          const geometry = famousGeometry(
            `${look.stageId}|${width}x${height}|${slabColor}`,
            layer.instances,
            (kind) => colorsByKind.get(kind)
          );
          const [origin] = layer.instances;
          return geometry && (
            <LandmarkLayer
              key={layer.key}
              instances={[{
                ...origin, rotation: 0, scale: 1, shade: 1,
              }]}
              geometry={geometry}
            />
          );
        }
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
