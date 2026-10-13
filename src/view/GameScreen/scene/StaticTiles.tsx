/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { StageDefinition } from '../../../content/types';
import { GameMap } from '../../../model/gameItem';
import { toWorld } from './sceneSpace';
import {
  buildStaticTileLayers,
  firstChangedTile,
  getMapCellCount,
  getStaticTileLayerStyles,
  STATIC_TILE_LAYER_IDS,
  StaticTileFeatures,
  StaticTileInstance,
  StaticTileLayerStyle,
  StaticTileShape,
} from './staticTiles';

type TileShape = { geometry: THREE.BufferGeometry; elevation: number; vertexColors?: boolean };

// Faces shaded by their normal (lit top, darker sides), like the walls.
function normalShade(x: number, y: number, z: number): number {
  if (y > 0.5) return 1.22;
  if (y < -0.5) return 0.62;
  if (x > 0.5) return 0.82;
  if (z > 0.5) return 0.92;
  return 0.72;
}

type ShadedPart = { geometry: THREE.BufferGeometry; shade?: number };

// Merges parts into one vertex-coloured shape. A part with `shade` is a
// flat-toned detail (a dark crack or seam); the rest shade by face normal.
function mergeShaded(parts: ShadedPart[], name: string): THREE.BufferGeometry {
  parts.forEach(({ geometry, shade }) => {
    const normals = geometry.getAttribute('normal');
    const colors = new Float32Array(normals.count * 3);
    for (let index = 0; index < normals.count; index += 1) {
      const tone = shade
        ?? normalShade(normals.getX(index), normals.getY(index), normals.getZ(index));
      colors[index * 3] = tone;
      colors[index * 3 + 1] = tone;
      colors[index * 3 + 2] = tone;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  });
  const geometry = mergeGeometries(parts.map((part) => part.geometry));
  parts.forEach((part) => part.geometry.dispose());
  if (!geometry) throw new Error(`Could not build ${name} geometry`);
  return geometry;
}

function box(
  size: [number, number, number],
  at: [number, number, number],
  rotY = 0
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  if (rotY) geometry.rotateY(rotY);
  geometry.translate(at[0], at[1], at[2]);
  return geometry;
}

function createMasonryGeometry(size: number, height: number, lip: number) {
  return mergeShaded([
    { geometry: box([size, height - lip, size], [0, (height - lip) / 2, 0]) },
    { geometry: box([size + 0.09, lip, size + 0.09], [0, height - lip / 2, 0]) },
  ], 'masonry');
}

const SEAM_SHADE = 0.3;
const WALL_SIZE = 0.83;
const WALL_HEIGHT = 0.94;
const WALL_LIP = 0.13;
// Details sit just proud of the face that looks at the camera (+z).
const FRONT = WALL_SIZE / 2 + 0.006;

// A secret room's cracked wall: wall masonry whose cap is split in two by a
// jagged dark crack running down the camera-facing side, with rubble at its
// foot. The split cap and rubble are the tell; the colour stays the wall's.
function createCrackedGeometry() {
  const shaft = WALL_HEIGHT - WALL_LIP;
  const half = WALL_SIZE / 2 + 0.02;
  const capDepth = WALL_SIZE + 0.09;
  const capShift = WALL_SIZE / 4 + 0.035;
  const capY = shaft + WALL_LIP / 2;
  return mergeShaded([
    { geometry: box([WALL_SIZE, shaft, WALL_SIZE], [0, shaft / 2, 0]) },
    { geometry: box([half, WALL_LIP, capDepth], [-capShift, capY - 0.02, 0]) },
    { geometry: box([half, WALL_LIP, capDepth], [capShift, capY + 0.01, 0.02]) },
    { geometry: box([0.05, 0.3, 0.02], [0.03, WALL_HEIGHT - 0.28, FRONT]), shade: SEAM_SHADE },
    { geometry: box([0.2, 0.05, 0.02], [-0.04, WALL_HEIGHT - 0.44, FRONT]), shade: SEAM_SHADE },
    { geometry: box([0.05, 0.32, 0.02], [-0.12, WALL_HEIGHT - 0.62, FRONT]), shade: SEAM_SHADE },
    { geometry: box([0.14, 0.09, 0.12], [-0.1, 0.045, FRONT + 0.075], 0.5) },
    { geometry: box([0.1, 0.07, 0.09], [0.08, 0.035, FRONT + 0.065], -0.3) },
  ], 'cracked wall');
}

// A hidden passage: a false wall with no cap lip, a little lower than its
// neighbours, and a dark door-shaped seam on its camera-facing side.
function createPassageGeometry() {
  const height = 0.88;
  return mergeShaded([
    { geometry: box([WALL_SIZE, height, WALL_SIZE], [0, height / 2, 0]) },
    { geometry: box([0.04, 0.62, 0.02], [-0.2, 0.31, FRONT]), shade: SEAM_SHADE },
    { geometry: box([0.04, 0.62, 0.02], [0.2, 0.31, FRONT]), shade: SEAM_SHADE },
    { geometry: box([0.44, 0.04, 0.02], [0, 0.62, FRONT]), shade: SEAM_SHADE },
  ], 'passage');
}

// A shut arena gate: a narrower pillar wrapped in two raised seal bands, with
// a round seal on top, in the stage's accent colour.
function createGateGeometry() {
  const size = 0.74;
  const seal = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 10);
  seal.translate(0, WALL_HEIGHT + 0.04, 0);
  return mergeShaded([
    { geometry: box([size, WALL_HEIGHT, size], [0, WALL_HEIGHT / 2, 0]) },
    { geometry: box([size + 0.12, 0.12, size + 0.12], [0, WALL_HEIGHT * 0.62, 0]) },
    { geometry: box([size + 0.12, 0.08, size + 0.12], [0, WALL_HEIGHT * 0.3, 0]) },
    { geometry: seal },
  ], 'gate');
}

// Shared by every layer and every match; never mutated after creation.
const TILE_SHAPES: Record<StaticTileShape, TileShape> = {
  ground: {
    geometry: new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
    elevation: 0,
  },
  wall: {
    geometry: createMasonryGeometry(WALL_SIZE, WALL_HEIGHT, WALL_LIP),
    elevation: 0,
    vertexColors: true,
  },
  crate: { geometry: createMasonryGeometry(0.72, 0.66, 0.12), elevation: 0, vertexColors: true },
  cracked: { geometry: createCrackedGeometry(), elevation: 0, vertexColors: true },
  passage: { geometry: createPassageGeometry(), elevation: 0, vertexColors: true },
  gate: { geometry: createGateGeometry(), elevation: 0, vertexColors: true },
};

// Campaign features are a handful of cells per map (three secret doors, a few
// gate cells), so their layers get a small fixed buffer, not one per cell.
const FEATURE_SHAPES: ReadonlySet<StaticTileShape> = new Set(['cracked', 'passage', 'gate']);
const FEATURE_CAPACITY = 32;

// Ground is the lowest translucent surface, so draw it before every other
// translucent object instead of depth-sorting one map-sized instance batch.
const GROUND_RENDER_ORDER = -1;

const TILE_MATRIX = new THREE.Matrix4();
// A handful of palette and fog colours: parse each hex string once.
const TILE_COLORS = new Map<string, THREE.Color>();

function tileColor(hex: string): THREE.Color {
  let color = TILE_COLORS.get(hex);
  if (!color) {
    color = new THREE.Color(hex);
    TILE_COLORS.set(hex, color);
  }
  return color;
}

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
  // What this mesh last received, so a fog step rewrites only what changed.
  const written = useRef<{ mesh: THREE.InstancedMesh; cells: StaticTileInstance[] } | null>(null);
  const { geometry, elevation, vertexColors } = TILE_SHAPES[style.shape];

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const count = Math.min(cells.length, capacity);
    const previous = written.current?.mesh === mesh ? written.current.cells : null;
    const from = previous ? firstChangedTile(previous, cells) : 0;
    written.current = { mesh, cells };
    if (from < 0) return;
    for (let index = from; index < count; index += 1) {
      const cell = cells[index];
      const [wx, , wz] = toWorld(cell.x, cell.y);
      TILE_MATRIX.makeTranslation(wx, elevation, wz);
      mesh.setMatrixAt(index, TILE_MATRIX);
      mesh.setColorAt(index, tileColor(cell.color));
    }
    mesh.count = count;
    mesh.visible = count > 0;
    if (count === 0) return;
    if (count > from) {
      mesh.instanceMatrix.addUpdateRange(from * 16, (count - from) * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.addUpdateRange(from * 3, (count - from) * 3);
        mesh.instanceColor.needsUpdate = true;
      }
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
  features,
}: {
  map: GameMap;
  palette: StageDefinition['palette'];
  visibleCells: ReadonlySet<string>;
  exploredCells: ReadonlySet<string>;
  destroyedCells: ReadonlySet<string>;
  features: StaticTileFeatures;
}) {
  const capacity = Math.max(1, getMapCellCount(map));
  const styles = useMemo(() => getStaticTileLayerStyles(palette), [palette]);
  const layers = useMemo(
    () => buildStaticTileLayers(
      map,
      palette,
      visibleCells,
      exploredCells,
      destroyedCells,
      features
    ),
    [destroyedCells, exploredCells, features, map, palette, visibleCells]
  );

  return (
    <>
      {STATIC_TILE_LAYER_IDS.map((id) => (
        <StaticTileLayer
          key={id}
          cells={layers[id]}
          style={styles[id]}
          capacity={FEATURE_SHAPES.has(styles[id].shape) ? FEATURE_CAPACITY : capacity}
        />
      ))}
    </>
  );
}
