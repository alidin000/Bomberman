/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { StageDefinition } from '../../../content/types';
import { GameMap } from '../../../model/gameItem';
import { toWorld } from './sceneSpace';
import {
  buildStaticTileLayers,
  getMapCellCount,
  getStaticTileLayerStyles,
  STATIC_TILE_LAYER_IDS,
  StaticTileInstance,
  StaticTileLayerStyle,
  StaticTileShape,
} from './staticTiles';

type TileShape = { geometry: THREE.BufferGeometry; elevation: number; vertexColors?: boolean };

function createMasonryGeometry(size: number, height: number, lip: number) {
  const shaft = new THREE.BoxGeometry(size, height - lip, size);
  shaft.translate(0, (height - lip) / 2, 0);
  const cap = new THREE.BoxGeometry(size + 0.09, lip, size + 0.09);
  cap.translate(0, height - lip / 2, 0);
  const geometry = mergeGeometries([shaft, cap]);
  shaft.dispose();
  cap.dispose();
  if (!geometry) throw new Error('Could not build masonry geometry');

  const normals = geometry.getAttribute('normal');
  const colors = new Float32Array(normals.count * 3);
  for (let index = 0; index < normals.count; index += 1) {
    const x = normals.getX(index);
    const y = normals.getY(index);
    const z = normals.getZ(index);
    let shade = 0.72;
    if (y > 0.5) shade = 1.22;
    else if (y < -0.5) shade = 0.62;
    else if (x > 0.5) shade = 0.82;
    else if (z > 0.5) shade = 0.92;
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Shared by every layer and every match; never mutated after creation.
const TILE_SHAPES: Record<StaticTileShape, TileShape> = {
  ground: {
    geometry: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
    elevation: 0,
  },
  wall: { geometry: createMasonryGeometry(0.83, 0.94, 0.13), elevation: 0, vertexColors: true },
  crate: { geometry: createMasonryGeometry(0.72, 0.66, 0.12), elevation: 0, vertexColors: true },
};

// Ground is the lowest translucent surface, so draw it before every other
// translucent object instead of depth-sorting one map-sized instance batch.
const GROUND_RENDER_ORDER = -1;

const TILE_MATRIX = new THREE.Matrix4();
const TILE_COLOR = new THREE.Color();

function StaticTileLayer({
  cells,
  style,
  capacity,
}: {
  cells: StaticTileInstance[];
  style: StaticTileLayerStyle;
  capacity: number;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { geometry, elevation, vertexColors } = TILE_SHAPES[style.shape];

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const count = Math.min(cells.length, capacity);
    for (let index = 0; index < count; index += 1) {
      const cell = cells[index];
      const [wx, , wz] = toWorld(cell.x, cell.y);
      TILE_MATRIX.makeTranslation(wx, elevation, wz);
      mesh.setMatrixAt(index, TILE_MATRIX);
      mesh.setColorAt(index, TILE_COLOR.set(cell.color));
    }
    mesh.count = count;
    mesh.visible = count > 0;
    if (count === 0) return;
    mesh.instanceMatrix.addUpdateRange(0, count * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.addUpdateRange(0, count * 3);
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.computeBoundingSphere();
  }, [capacity, cells, elevation]);

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, undefined, capacity]}
      castShadow={style.castShadow}
      receiveShadow={style.receiveShadow}
      renderOrder={style.shape === 'ground' ? GROUND_RENDER_ORDER : 0}
    >
      <meshStandardMaterial
        color="#ffffff"
        vertexColors={vertexColors}
        emissive={style.emissive ?? '#000000'}
        emissiveIntensity={style.emissiveIntensity ?? 1}
        metalness={style.metalness ?? 0}
        roughness={style.roughness}
        transparent={style.opacity !== undefined}
        opacity={style.opacity ?? 1}
      />
    </instancedMesh>
  );
}

/**
 * Ground tiles, walls, crates and player obstacles for the whole map, drawn as
 * a handful of instanced meshes. Instances are rewritten only when the map,
 * palette, fog sets or destroyed crates change, never per frame.
 */
export function StaticTiles({
  map,
  palette,
  visibleCells,
  exploredCells,
  destroyedCells,
}: {
  map: GameMap;
  palette: StageDefinition['palette'];
  visibleCells: ReadonlySet<string>;
  exploredCells: ReadonlySet<string>;
  destroyedCells: ReadonlySet<string>;
}) {
  const capacity = Math.max(1, getMapCellCount(map));
  const styles = useMemo(() => getStaticTileLayerStyles(palette), [palette]);
  const layers = useMemo(
    () => buildStaticTileLayers(map, palette, visibleCells, exploredCells, destroyedCells),
    [destroyedCells, exploredCells, map, palette, visibleCells]
  );

  return (
    <>
      {STATIC_TILE_LAYER_IDS.map((id) => (
        <StaticTileLayer key={id} cells={layers[id]} style={styles[id]} capacity={capacity} />
      ))}
    </>
  );
}
