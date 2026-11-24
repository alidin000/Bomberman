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
  StaticTileLayerId,
  StaticTileLayerStyle,
  StaticTileShape,
  TileMask,
  WallStyle,
  maskWaterCount,
  wallStyleForPalette,
} from './staticTiles';
import type { CrateStyle } from './city/cityBuildings';

export type TileShape = {
  geometry: THREE.BufferGeometry;
  elevation: number;
  vertexColors?: boolean;
};

// Faces shaded by their normal (lit top, darker sides), like the walls.
function normalShade(x: number, y: number, z: number): number {
  if (y > 0.5) return 1.22;
  if (y < -0.5) return 0.62;
  if (x > 0.5) return 0.82;
  if (z > 0.5) return 0.92;
  return 0.72;
}

type ShadedPart = { geometry: THREE.BufferGeometry; shade?: number; tone?: number };

// Merges parts into one vertex-coloured shape. A part with `shade` is a
// flat-toned detail (a dark crack or seam); the rest shade by face normal,
// scaled by `tone` (a darker roof over lighter walls).
function mergeShaded(input: ShadedPart[], name: string): THREE.BufferGeometry {
  // Polyhedra come without an index: then merge everything unindexed.
  const plain = input.some((part) => !part.geometry.index);
  const parts = plain
    ? input.map((part) => {
      if (!part.geometry.index) return part;
      const geometry = part.geometry.toNonIndexed();
      part.geometry.dispose();
      return { ...part, geometry };
    })
    : input;
  parts.forEach(({ geometry, shade, tone: scale = 1 }) => {
    const normals = geometry.getAttribute('normal');
    const colors = new Float32Array(normals.count * 3);
    for (let index = 0; index < normals.count; index += 1) {
      const tone = shade
        ?? scale * normalShade(normals.getX(index), normals.getY(index), normals.getZ(index));
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

// --- Village walls (staticTiles.ts WallStyle) -------------------------------------

function cylinder(top: number, bottom: number, height: number, segments: number, y: number) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, segments);
  geometry.translate(0, y, 0);
  return geometry;
}

// A ridge roof along x: a triangular prism of the given width, depth, height.
function ridge(width: number, depth: number, height: number, y: number) {
  const geometry = new THREE.CylinderGeometry(1, 1, width, 3, 1);
  geometry.rotateZ(Math.PI / 2);
  geometry.rotateX(-Math.PI / 2);
  geometry.scale(1, height / 1.5, depth / 1.732);
  geometry.translate(0, y + height / 3, 0);
  return geometry;
}

const WALL_BUILDERS: Record<Exclude<WallStyle, 'masonry'>, () => ShadedPart[]> = {
  // Leaf: a timber-framed block under a little ridged roof.
  timber: () => [
    { geometry: box([WALL_SIZE, 0.76, WALL_SIZE], [0, 0.38, 0]) },
    { geometry: box([0.06, 0.62, 0.02], [-0.3, 0.38, FRONT]), shade: 0.45 },
    { geometry: box([0.06, 0.62, 0.02], [0.3, 0.38, FRONT]), shade: 0.45 },
    { geometry: box([0.66, 0.06, 0.02], [0, 0.46, FRONT]), shade: 0.45 },
    { geometry: box([WALL_SIZE + 0.1, 0.05, WALL_SIZE + 0.1], [0, 0.785, 0]) },
    { geometry: ridge(WALL_SIZE + 0.08, WALL_SIZE + 0.1, 0.17, 0.81) },
  ],
  // Sand: sandstone with a rounded crown and a dark window slot.
  sandstone: () => [
    { geometry: box([WALL_SIZE, 0.7, WALL_SIZE], [0, 0.35, 0]) },
    { geometry: box([WALL_SIZE + 0.05, 0.06, WALL_SIZE + 0.05], [0, 0.7, 0]) },
    {
      geometry: new THREE.SphereGeometry(0.43, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2)
        .scale(1, 0.5, 1).translate(0, 0.72, 0),
    },
    { geometry: box([0.14, 0.2, 0.02], [0, 0.42, FRONT]), shade: 0.35 },
  ],
  // Mist: a slate block under an overhanging slab, darker where it is wet.
  slate: () => [
    { geometry: box([0.8, 0.8, 0.8], [0, 0.4, 0]) },
    { geometry: box([0.81, 0.14, 0.81], [0, 0.07, 0]), shade: 0.55 },
    { geometry: box([0.96, 0.09, 0.96], [0, 0.845, 0]) },
    { geometry: box([0.5, 0.05, 0.5], [0, 0.915, 0]) },
  ],
  // Cloud: a white drum with a ringed cap.
  drum: () => [
    { geometry: cylinder(0.43, 0.45, 0.8, 8, 0.4) },
    { geometry: cylinder(0.47, 0.47, 0.09, 8, 0.845) },
    { geometry: cylinder(0.3, 0.36, 0.08, 8, 0.93) },
    { geometry: box([0.04, 0.5, 0.02], [0, 0.4, 0.447]), shade: 0.5 },
  ],
  // Stone: two layers of strata, a little askew.
  strata: () => [
    { geometry: box([0.86, 0.5, 0.84], [0, 0.25, 0]) },
    { geometry: box([0.8, 0.42, 0.82], [0.02, 0.71, -0.01], 0.12) },
    { geometry: box([0.87, 0.03, 0.02], [0, 0.5, 0.43]), shade: SEAM_SHADE },
  ],
  // Hideout: rough rock with a jagged crown.
  rough: () => [
    { geometry: box([0.82, 0.72, 0.82], [0, 0.36, 0]) },
    { geometry: new THREE.IcosahedronGeometry(0.27, 0).translate(-0.16, 0.76, 0.05) },
    { geometry: new THREE.IcosahedronGeometry(0.22, 0).translate(0.2, 0.74, -0.08) },
    { geometry: new THREE.IcosahedronGeometry(0.17, 0).translate(0.05, 0.86, 0.2) },
  ],
  // War front: an earth bank topped by a row of sharpened stakes.
  palisade: () => [
    { geometry: box([WALL_SIZE, 0.6, WALL_SIZE], [0, 0.3, 0]) },
    { geometry: box([WALL_SIZE + 0.04, 0.05, 0.06], [0, 0.72, 0.18]), shade: 0.55 },
    ...[-0.3, -0.1, 0.1, 0.3].map((x) => ({
      geometry: new THREE.ConeGeometry(0.085, 0.42, 5).translate(x, 0.81, 0.12),
    })),
    ...[-0.2, 0, 0.2].map((x) => ({
      geometry: new THREE.ConeGeometry(0.08, 0.36, 5).translate(x, 0.78, -0.14),
    })),
  ],
};

const WALL_SHAPES = new Map<WallStyle, TileShape>();

// A place's crates as its goods: log piles, jars, barrels, casks, lashed
// crates, market produce and boxes. They are no taller than today's crate
// and read as things, never as smaller copies of the walls' buildings. Their
// colour is still the crate colour (the instance colour), so breaking, high
// contrast and player obstacles tint them as before. Each stays under about a
// hundred triangles: a map draws two or three hundred of them.

/** A cylinder lying along x (a log or a cask), its centre at `at`. */
function lying(radius: number, length: number, at: [number, number, number], segments = 6) {
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, true);
  geometry.rotateZ(Math.PI / 2);
  geometry.translate(at[0], at[1], at[2]);
  return geometry;
}

/** A flat disc facing ±x: a log's end grain or a cask's head. */
function head(radius: number, at: [number, number, number], side: number, segments = 6) {
  const geometry = new THREE.CircleGeometry(radius, segments);
  geometry.rotateY((side * Math.PI) / 2);
  geometry.translate(at[0], at[1], at[2]);
  return geometry;
}

/** A turned jar on the ground at (x, z): a lathe of its profile. */
function jar(x: number, z: number, scale: number) {
  const profile = [[0, 0], [0.13, 0.02], [0.18, 0.2], [0.09, 0.42], [0, 0.45]]
    .map(([r, y]) => new THREE.Vector2(r * scale, y * scale));
  const geometry = new THREE.LatheGeometry(profile, 6);
  geometry.translate(x, 0, z);
  return geometry;
}

/** A log or cask with its two ends: an open tube and two discs. */
function withEnds(radius: number, length: number, at: [number, number, number], shade: number) {
  const [x, y, z] = at;
  return [
    { geometry: lying(radius, length, at) },
    { geometry: head(radius, [x + length / 2, y, z], 1), shade },
    { geometry: head(radius, [x - length / 2, y, z], -1), shade },
  ];
}

const CRATE_BUILDERS: Record<CrateStyle, () => ShadedPart[]> = {
  // Leaf: a pile of logs, pale end grain toward the street.
  logs: () => [
    ...withEnds(0.14, 0.66, [0, 0.14, -0.15], 1.18),
    ...withEnds(0.14, 0.66, [0, 0.14, 0.15], 1.18),
    ...withEnds(0.14, 0.6, [0, 0.4, 0], 1.18),
  ],
  // Sand: two clay jars, a tall one and a short one.
  jars: () => [
    { geometry: jar(-0.1, -0.05, 1.3) },
    { geometry: jar(0.2, 0.14, 0.95), tone: 0.9 },
  ],
  // Cloud: a hooped barrel beside a small box.
  barrels: () => {
    const barrel = new THREE.CylinderGeometry(0.2, 0.2, 0.52, 8, 2);
    // Bulge the middle ring of staves.
    const position = barrel.getAttribute('position');
    for (let index = 0; index < position.count; index += 1) {
      if (Math.abs(position.getY(index)) < 1e-6) {
        position.setX(index, position.getX(index) * 1.14);
        position.setZ(index, position.getZ(index) * 1.14);
      }
    }
    barrel.computeVertexNormals();
    barrel.translate(-0.1, 0.26, -0.04);
    const hoop = new THREE.CylinderGeometry(0.215, 0.215, 0.04, 8, 1, true)
      .translate(-0.1, 0.42, -0.04);
    return [
      { geometry: barrel },
      { geometry: hoop, shade: 0.45 },
      { geometry: box([0.26, 0.24, 0.26], [0.2, 0.12, 0.17]), tone: 0.9 },
    ];
  },
  // Budapest and Stone: three casks, two below and one on top, dark heads.
  casks: () => [
    ...withEnds(0.15, 0.62, [0, 0.15, -0.16], 0.5),
    ...withEnds(0.15, 0.62, [0, 0.15, 0.16], 0.5),
    ...withEnds(0.15, 0.56, [0, 0.41, 0], 0.5),
  ],
  // Mist and the hideout: two crates, the smaller one turned, lashed with rope.
  crateStack: () => [
    { geometry: box([0.62, 0.34, 0.56], [0, 0.17, 0]) },
    { geometry: box([0.64, 0.05, 0.58], [0, 0.2, 0]), shade: 0.45 },
    { geometry: box([0.42, 0.26, 0.4], [0.04, 0.47, -0.02], 0.35), tone: 0.92 },
    { geometry: box([0.07, 0.27, 0.42], [0.04, 0.47, -0.02], 0.35), shade: 0.45 },
  ],
  // Rome: two slatted produce crates under a striped awning on one pole.
  produce: () => [
    { geometry: box([0.3, 0.26, 0.48], [-0.16, 0.13, 0.04]) },
    { geometry: box([0.3, 0.26, 0.48], [0.17, 0.13, 0.04]), tone: 0.92 },
    { geometry: box([0.66, 0.04, 0.5], [0, 0.17, 0.04]), shade: 0.45 },
    { geometry: box([0.04, 0.6, 0.04], [0, 0.3, -0.3]), shade: 0.5 },
    { geometry: box([0.72, 0.03, 0.17], [0, 0.6, -0.22]), shade: 1.1 },
    { geometry: box([0.72, 0.03, 0.17], [0, 0.56, -0.05]), shade: 0.72 },
  ],
  // Barcelona: taped boxes stacked on a pallet.
  boxes: () => [
    { geometry: box([0.7, 0.07, 0.62], [0, 0.035, 0]), tone: 0.7 },
    { geometry: box([0.32, 0.26, 0.28], [-0.17, 0.2, -0.14]) },
    { geometry: box([0.32, 0.26, 0.28], [0.17, 0.2, 0.14]), tone: 0.94 },
    { geometry: box([0.3, 0.24, 0.3], [-0.1, 0.45, 0.02], 0.25), tone: 1.06 },
    { geometry: box([0.31, 0.03, 0.06], [-0.1, 0.575, 0.02], 0.25), shade: 0.5 },
  ],
};

const CRATE_SHAPES = new Map<CrateStyle, TileShape>();

/** The crate shape for a city's crate style, or the plain crate. */
export function crateShape(style: CrateStyle | undefined): TileShape {
  // eslint-disable-next-line no-use-before-define -- only called after module load
  if (!style) return TILE_SHAPES.crate;
  let shape = CRATE_SHAPES.get(style);
  if (!shape) {
    shape = {
      geometry: mergeShaded(CRATE_BUILDERS[style](), `${style} crate`),
      elevation: 0,
      vertexColors: true,
    };
    CRATE_SHAPES.set(style, shape);
  }
  return shape;
}

/** The wall shape for a village style: built once per style and kept. */
export function wallShape(style: WallStyle): TileShape {
  let shape = WALL_SHAPES.get(style);
  if (!shape) {
    shape = style === 'masonry'
      // eslint-disable-next-line no-use-before-define -- only called after module load
      ? TILE_SHAPES.wall
      : {
        geometry: mergeShaded(WALL_BUILDERS[style](), `${style} wall`),
        elevation: 0,
        vertexColors: true,
      };
    WALL_SHAPES.set(style, shape);
  }
  return shape;
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
  // A whole cell, so a river reads as one surface instead of tiles, a little
  // under the ground so its banks keep their edge.
  water: {
    geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    elevation: -0.012,
  },
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
  layer,
  cells,
  style,
  capacity,
  shape,
}: {
  layer: StaticTileLayerId;
  cells: StaticTileInstance[];
  style: StaticTileLayerStyle;
  capacity: number;
  shape: TileShape;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // What this mesh last received, so a fog step rewrites only what changed.
  const written = useRef<{ mesh: THREE.InstancedMesh; cells: StaticTileInstance[] } | null>(null);
  const { geometry, elevation, vertexColors } = shape;

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
      renderOrder={style.shape === 'ground' || style.shape === 'water' ? GROUND_RENDER_ORDER : 0}
      userData={{ tileLayer: layer }}
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

function tileShapeFor(shape: StaticTileShape, wall: TileShape, crate: TileShape): TileShape {
  if (shape === 'wall') return wall;
  if (shape === 'crate') return crate;
  return TILE_SHAPES[shape];
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
  mask = null,
}: {
  map: GameMap;
  palette: StageDefinition['palette'];
  visibleCells: ReadonlySet<string>;
  exploredCells: ReadonlySet<string>;
  destroyedCells: ReadonlySet<string>;
  features: StaticTileFeatures;
  /** A city's render mask; villages and the campaign have none. */
  // eslint-disable-next-line react/require-default-props -- defaulted to null in the signature
  mask?: TileMask | null;
}) {
  const capacity = Math.max(1, getMapCellCount(map));
  const styles = useMemo(() => getStaticTileLayerStyles(palette), [palette]);
  // The village's walls: explored ones keep the shape, only their colour dims.
  const wall = wallShape(wallStyleForPalette(palette));
  // A city or village with buildings shows its crates as small buildings.
  const crate = crateShape(mask?.buildings?.crate);
  // Only a map whose mask has water gets the water layer at all.
  const waterCapacity = useMemo(() => maskWaterCount(map, mask), [map, mask]);
  const layers = useMemo(
    () => buildStaticTileLayers(
      map,
      palette,
      visibleCells,
      exploredCells,
      destroyedCells,
      features,
      mask
    ),
    [destroyedCells, exploredCells, features, map, mask, palette, visibleCells]
  );
  const layerCapacity = (id: StaticTileLayerId) => {
    if (id === 'waterVisible') return waterCapacity;
    return FEATURE_SHAPES.has(styles[id].shape) ? FEATURE_CAPACITY : capacity;
  };

  return (
    <>
      {STATIC_TILE_LAYER_IDS.filter((id) => layerCapacity(id) > 0).map((id) => (
        <StaticTileLayer
          key={id}
          layer={id}
          cells={layers[id]}
          style={styles[id]}
          capacity={layerCapacity(id)}
          shape={tileShapeFor(styles[id].shape, wall, crate)}
        />
      ))}
    </>
  );
}
