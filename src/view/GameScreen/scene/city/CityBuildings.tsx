/* eslint-disable react/no-unknown-property */
import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameEngineState } from '../../../../engine/types';
import { isPower } from '../../../../model/gameItem';
import type { BuildingContrast, TileMask } from '../staticTiles';
import { useScenery } from '../scenery';
import { CityBuildingGeometry, buildCityBuildings } from './cityBuildings';
import { buildVillageBuildings } from './villageBuildings';
import { buildCityOutskirts } from './cityOutskirts';
import {
  CutawayWeights, FocusCell, applyCutaway, cutawayTargets, cutawayWeights, stepCutaway,
} from './cutaway';

// One geometry pair per mask object. sceneTileMask keeps one mask per map,
// look and contrast setting, so a rematch or a remount builds nothing, and
// bombs or broken crates never rebuild the buildings.
const BUILT = new WeakMap<TileMask, CityBuildingGeometry>();
// Each geometry's colours as built: fog darkens a copy of these, never itself.
const BASE_COLORS = new WeakMap<THREE.BufferGeometry, Float32Array>();

const LUMA = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * High contrast: every colour of a geometry moved into the walls' hue, its
 * light kept in order (a window still darker than its facade) but squeezed
 * into the dark band, no lighter than `maxLuminance` (linear light, the same
 * measure as the contrast rules).
 */
export function retoneForContrast(geometry: THREE.BufferGeometry, contrast: BuildingContrast) {
  const color = geometry.getAttribute('color') as THREE.BufferAttribute;
  const array = color.array as Float32Array;
  const tone = new THREE.Color(contrast.tone);
  const toneLight = Math.max(1e-4, LUMA(tone.r, tone.g, tone.b));
  let brightest = 0;
  for (let index = 0; index < array.length; index += 3) {
    brightest = Math.max(brightest, LUMA(array[index], array[index + 1], array[index + 2]));
  }
  const darkest = contrast.maxLuminance * 0.15;
  for (let index = 0; index < array.length; index += 3) {
    const light = LUMA(array[index], array[index + 1], array[index + 2]);
    const share = brightest > 0 ? (light / brightest) ** 0.8 : 0;
    const target = darkest + (contrast.maxLuminance - darkest) * share;
    const scale = target / toneLight;
    array[index] = Math.min(1, tone.r * scale);
    array[index + 1] = Math.min(1, tone.g * scale);
    array[index + 2] = Math.min(1, tone.b * scale);
  }
  color.needsUpdate = true;
}

/** A mask's buildings, built on first use; null when it draws none. */
export function cityBuildingGeometry(mask: TileMask | null): CityBuildingGeometry | null {
  if (!mask?.buildings) return null;
  let built = BUILT.get(mask);
  if (!built) {
    const plan = mask.buildings;
    if (plan.kind === 'city') {
      built = buildCityBuildings(mask.rows, plan.style, plan.seed, plan.classes);
      built.outskirts = buildCityOutskirts(
        mask.rows,
        plan.style,
        plan.seed,
        plan.clearings,
        mask.water
      );
    } else {
      built = buildVillageBuildings(mask.rows, plan.style, plan.seed);
    }
    const { contrast } = plan;
    if (contrast) {
      [built.mass, built.detail, built.outskirts].forEach((geometry) => {
        if (geometry) retoneForContrast(geometry, contrast);
      });
    }
    [built.mass, built.detail].forEach((geometry) => {
      BASE_COLORS.set(geometry, Float32Array.from(geometry.getAttribute('color').array));
    });
    BUILT.set(mask, built);
  }
  return built;
}

/**
 * The wall layer's settings (StaticTiles.tsx): standard, opaque, vertex
 * colours, drawn as an instanced mesh with an instance colour. With exactly
 * these, the buildings render with the walls' program; a texture, flat
 * shading, transparency, RGBA colours or a plain Mesh would each link one of
 * their own (GameScene3D.city.test.tsx checks the program is shared).
 */
export const CITY_BUILDING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  vertexColors: true,
  roughness: 1,
  metalness: 0,
});
CITY_BUILDING_MATERIAL.name = 'city buildings';

const IDENTITY = new THREE.Matrix4();
const WHITE = new THREE.Color('#ffffff');

/** One merged geometry as the single instance of an instanced mesh. */
function MergedLayer({
  geometry,
  castShadow,
  visible,
  name,
}: {
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
  visible: boolean;
  name: string;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.setMatrixAt(0, IDENTITY);
    mesh.setColorAt(0, WHITE);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, CITY_BUILDING_MATERIAL, 1]}
      castShadow={castShadow}
      receiveShadow
      visible={visible}
      userData={{ tileLayer: name }}
    />
  );
}

// Pickups, found once per map snapshot: the map changes only when a crate
// breaks or a pickup is taken, not every frame.
let pickupMap: GameEngineState['map'] | null = null;
let pickupCells: FocusCell[] = [];

function pickups(map: GameEngineState['map']): FocusCell[] {
  if (map !== pickupMap) {
    pickupMap = map;
    pickupCells = [];
    map.forEach((row, y) => row.forEach((cell, x) => {
      if (isPower(cell)) pickupCells.push({ x, y });
    }));
  }
  return pickupCells;
}

/** The cells a bomb's blast will cross, up to the first wall each way. */
function blastLines(state: GameEngineState, out: FocusCell[]) {
  state.bombs.forEach(({ x, y, range }) => {
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      for (let step = 1; step <= range; step += 1) {
        const cx = Math.round(x) + dx * step;
        const cy = Math.round(y) + dy * step;
        if (state.map[cy]?.[cx] === undefined || state.map[cy][cx] === 'Wall') break;
        out.push({ x: cx, y: cy });
      }
    });
  });
}

/**
 * What must never stand behind a building: living fighters, bombs, the cells
 * their blasts will cross, blasts, pickups, monsters, the boss and its
 * hazards. Under fog only what is in sight counts, so a building never dips
 * over something the fog hides.
 */
export function cutawayFocus(
  state: GameEngineState | null,
  visible: ReadonlySet<string> | null = null
): FocusCell[] {
  if (!state) return [];
  const focus: FocusCell[] = [
    ...state.players.filter((player) => player.alive),
    ...state.bombs,
    ...state.explosions,
    ...state.monsters,
    ...state.hazards,
    ...pickups(state.map),
  ];
  blastLines(state, focus);
  if (state.boss && state.boss.health > 0) focus.push(state.boss);
  if (!visible) return focus;
  return focus.filter(({ x, y }) => visible.has(`${Math.round(x)},${Math.round(y)}`));
}

/** A building in explored but unseen ground: as dark as the fogged walls read. */
export const FOG_TONE = 0.5;

type FogLayer = { present: Uint8Array; owners: Uint32Array; base: Float32Array };

/**
 * Fog over a village's objects: an object shows once any of its cells has
 * been explored, darkened until one is in sight, and is gone while all are
 * hidden. Rewrites the colours; returns each vertex's presence flags.
 */
function applyFog(
  geometry: THREE.BufferGeometry,
  layer: FogLayer,
  shown: Uint8Array,
  tone: Float32Array
) {
  const color = geometry.getAttribute('color') as THREE.BufferAttribute;
  const array = color.array as Float32Array;
  const { present, owners, base } = layer;
  for (let index = 0; index < owners.length; index += 1) {
    const owner = owners[index];
    present[index] = shown[owner];
    const t = tone[owner];
    array[index * 3] = base[index * 3] * t;
    array[index * 3 + 1] = base[index * 3 + 1] * t;
    array[index * 3 + 2] = base[index * 3 + 2] * t;
  }
  color.needsUpdate = true;
}

const WEIGHTS = new WeakMap<THREE.BufferGeometry, CutawayWeights>();

function weightsFor(geometry: THREE.BufferGeometry, width: number, height: number): CutawayWeights {
  let weights = WEIGHTS.get(geometry);
  if (!weights) {
    weights = cutawayWeights(geometry, width, height);
    WEIGHTS.set(geometry, weights);
  }
  return weights;
}

/**
 * A city's buildings. The mass is the board's walls, so it always draws; the
 * detail (windows, balconies, terraces, crossings, rails, chains) follows the
 * scenery setting. Hiding a mesh links nothing. Every frame the cut-away sinks
 * the buildings in front of whatever must stay visible.
 */
function CityBuildingsBase({
  mask,
  readState,
  reducedMotion,
  visibleCells,
  exploredCells,
}: {
  mask: TileMask | null;
  readState: () => GameEngineState | null;
  reducedMotion: boolean;
  /** The fog's cells in sight and explored; null where there is no fog. */
  visibleCells: ReadonlySet<string> | null;
  exploredCells: ReadonlySet<string> | null;
}) {
  const scenery = useScenery();
  const built = useMemo(() => cityBuildingGeometry(mask), [mask]);
  const cut = useMemo(() => {
    if (!built || !mask) return null;
    const height = mask.rows.length;
    const width = mask.rows[0]?.length ?? 0;
    const shown = new Float32Array(width * height).fill(1);
    return {
      width,
      height,
      shown,
      target: new Float32Array(width * height),
      mass: weightsFor(built.mass, width, height),
      detail: weightsFor(built.detail, width, height),
    };
  }, [built, mask]);
  const fog = useMemo(() => {
    const owners = built?.owners;
    if (!built || !owners) return null;
    const layer = (geometry: THREE.BufferGeometry, list: Uint32Array): FogLayer => ({
      present: new Uint8Array(list.length).fill(1),
      owners: list,
      base: BASE_COLORS.get(geometry) as Float32Array,
    });
    return {
      mass: layer(built.mass, owners.mass),
      detail: layer(built.detail, owners.detail),
      shown: new Uint8Array(owners.cells.length),
      tone: new Float32Array(owners.cells.length),
    };
  }, [built]);
  // Set when the fog changes, so the next frame rewrites the positions.
  const dirty = useRef(true);
  const apply = () => {
    if (!built || !cut) return;
    applyCutaway(built.mass, cut.mass, cut.shown, fog?.mass.present);
    applyCutaway(built.detail, cut.detail, cut.shown, fog?.detail.present);
  };
  useLayoutEffect(() => {
    if (!built || !fog || !mask) return;
    const width = mask.rows[0]?.length ?? 0;
    built.owners!.cells.forEach((cells, owner) => {
      let lit = owner === 0 || !visibleCells;
      let seen = lit || !exploredCells;
      cells.forEach((cell) => {
        const key = `${cell % width},${Math.floor(cell / width)}`;
        if (visibleCells?.has(key)) lit = true;
        if (exploredCells?.has(key)) seen = true;
      });
      fog.shown[owner] = lit || seen ? 1 : 0;
      fog.tone[owner] = lit ? 1 : FOG_TONE;
    });
    applyFog(built.mass, fog.mass, fog.shown, fog.tone);
    applyFog(built.detail, fog.detail, fog.shown, fog.tone);
    dirty.current = true;
  }, [built, exploredCells, fog, mask, visibleCells]);
  useLayoutEffect(() => {
    // A fresh mount starts at full height, whatever an earlier match left.
    if (!built || !cut) return;
    cut.shown.fill(1);
    apply();
    dirty.current = false;
  }, [built, cut]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_frame, delta) => {
    if (!built || !cut) return;
    const focus = cutawayFocus(readState(), fog ? visibleCells : null);
    cutawayTargets(cut.width, cut.height, focus, cut.target);
    const moved = stepCutaway(cut.shown, cut.target, delta, reducedMotion);
    if (!moved && !dirty.current) return;
    dirty.current = false;
    apply();
  });
  if (!built) return null;
  return (
    <>
      <MergedLayer geometry={built.mass} castShadow visible name="cityBuildingMass" />
      <MergedLayer geometry={built.detail} castShadow={false} visible={scenery} name="cityBuildingDetail" />
      {built.outskirts && (
        <MergedLayer
          geometry={built.outskirts}
          castShadow={false}
          visible={scenery}
          name="cityOutskirts"
        />
      )}
    </>
  );
}

export const CityBuildings = React.memo(CityBuildingsBase);
