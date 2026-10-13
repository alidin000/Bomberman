/* eslint-disable react/no-unknown-property */
import React, {
  useEffect, useLayoutEffect, useMemo, useRef,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { GameEngineState } from '../../../engine/types';
import type { GameMap } from '../../../model/gameItem';
import type { StageId } from '../../../content/types';
import {
  RepairStage, ReputationTierId, VillageInteractable, VillageSquareLayout, presentInteractables,
  reachableInteractable,
} from '../../../content/villageSquare';
import { isCastId } from '../../../content/animeCast';
import { VillageDressing } from './village/VillageDressing';
import { FIGHTER_INK_MATERIAL } from './fighterInk';
import { CastFigure } from './cast/CastFigure';
import { castFigureMesh } from './cast/castGeometry';
import { tokenToonMaterial } from './inkedToken';
import { PLAYER_TAG_SPRITES, PlayerTagSprite, chipKey } from './playerTags';
import {
  MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE, toWorld,
} from './sceneSpace';
import { HighContrastOverride, useHighContrastMaterials } from './highContrast';
import {
  KEEPSAKE_BOB, KEEPSAKE_LIFT, PROMPT_HEIGHT, VillageMarks, chalkMarkGeometry,
  createPavingGeometry, fixedPropsToken, keepsakeRingGeometry, keepsakeToken, promptFor, propYaw,
  villagerToken,
} from './VillageSquareModels';

/**
 * The village square in the map (content/villageSquare.ts): paving, the
 * props standing at this visit's tier, a prompt over the prop each local
 * player can use, and the marks of accepted requests out in the map. It
 * draws from the layout and the state and never writes engine state. Live
 * positions come from `readState` in useFrame, so walking around the square
 * re-renders nothing. Everything uses programs the shader warmup compiles:
 * the token toon look (plain and instanced), the fighters' ink line (plain
 * and instanced), the instanced see-through floor marks and label sprites.
 */

const TOKEN_MATERIAL = tokenToonMaterial();

const CHALK_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#f8fafc', transparent: true, opacity: 0.82, depthWrite: false,
});
const KEEPSAKE_RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#fbbf24', transparent: true, opacity: 0.62, depthWrite: false,
});

export const VILLAGE_HIGH_CONTRAST: readonly HighContrastOverride[] = [
  { material: CHALK_MATERIAL, opacity: 1 },
  { material: KEEPSAKE_RING_MATERIAL, opacity: 0.95 },
];

const PROMPT_CHIP_HEIGHT = 0.36;
// ...but never under this many pixels: a phone's camera stands far back.
const PROMPT_MIN_PIXELS = 20;
const PROMPT_BOB = 0.04;
// Villagers turn to whoever comes this close (cells, any direction).
const VILLAGER_NOTICE = 2;
const VILLAGER_TURN_RATE = 6;
const MARK_CAPACITY = 24;
const MAX_PROMPTS = 4;

const MATRIX = new THREE.Matrix4();
const POSITION = new THREE.Vector3();
const QUATERNION = new THREE.Quaternion();
const SCALE = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

// toWorld without the array: these run every frame.
const worldX = (x: number) => (x + MAP_OFFSET_X) * TILE_SIZE;
const worldZ = (y: number) => (y + MAP_OFFSET_Z) * TILE_SIZE;

type PromptSlot = {
  cellX: number;
  cellY: number;
  target: VillageInteractable | null;
};

function showInstances(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  const target = mesh;
  target.count = count;
  target.visible = count > 0;
  target.instanceMatrix.needsUpdate = true;
}

/** The chip's world height: its usual size, or PROMPT_MIN_PIXELS tall on screen. */
function promptHeight(camera: THREE.Camera, viewportHeight: number, at: THREE.Vector3): number {
  const perspective = camera as THREE.PerspectiveCamera;
  if (!perspective.isPerspectiveCamera || viewportHeight <= 0) return PROMPT_CHIP_HEIGHT;
  const distance = perspective.position.distanceTo(at);
  const perPixel = (2 * distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2))
    / viewportHeight;
  return Math.max(PROMPT_CHIP_HEIGHT, PROMPT_MIN_PIXELS * perPixel);
}

function findPlayer(state: GameEngineState, id: string): GameEngineState['players'][number] | null {
  for (let index = 0; index < state.players.length; index += 1) {
    if (state.players[index].id === id) return state.players[index];
  }
  return null;
}

function samePlayerIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * The square's wall cells as one key, so the square re-renders (and its
 * paving rebuilds) only if one changes, not on every bomb or crate.
 */
export function closedCellsKey(square: VillageSquareLayout, map: GameMap): string {
  const {
    x0, y0, x1, y1
  } = square.bounds;
  let key = '';
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (map[y]?.[x] === undefined || map[y][x] === 'Wall') key += `${x},${y};`;
    }
  }
  return key;
}

// A cast villager is shrunk, if need be, to stand under their prompt.
const CAST_VILLAGER_TOP = PROMPT_HEIGHT.villager - 0.06;

/**
 * A villager: a canon cast member (content/animeCast.ts SQUARE_CAST) is
 * drawn as their anime figure; anyone else keeps the square's token figure.
 */
function Villager({
  item,
  square,
  groupRef,
}: {
  item: VillageInteractable;
  square: VillageSquareLayout;
  groupRef: (group: THREE.Group | null) => void;
}) {
  const id = item.villagerId ?? item.id;
  const cast = isCastId(id) ? castFigureMesh(id) : null;
  const token = cast ? null : villagerToken(id);
  const [wx, , wz] = toWorld(item.x, item.y);
  const marks = useMemo(() => ({
    villageProp: 'villager', interactable: item.id, castFigure: cast ? id : undefined,
  }), [cast, id, item.id]);
  const fit = cast ? Math.min(1, CAST_VILLAGER_TOP / (cast.body.boundingBox?.max.y ?? 1)) : 1;
  return (
    <group
      ref={groupRef}
      position={[wx, 0, wz]}
      rotation={[0, propYaw(item, square), 0]}
    >
      {cast && <CastFigure figure={cast} scale={fit} bodyMark={marks} />}
      {token && (
        <mesh geometry={token.body} material={TOKEN_MATERIAL} castShadow userData={marks} />
      )}
      {token?.ink && <mesh geometry={token.ink} material={FIGHTER_INK_MATERIAL} />}
    </group>
  );
}

const PAVING_MARK = { villageProp: 'paving' };
const FIXED_MARK = { villageProp: 'fixed' };
const PROMPT_MARK = { villagePrompt: true };

function VillageSquareBase({
  square,
  stageId,
  tier,
  closedCells,
  groundTint,
  readState,
  promptPlayerIds,
  reducedMotion,
  repairStage = 1,
}: {
  square: VillageSquareLayout;
  stageId: StageId;
  tier: ReputationTierId;
  /** How far the village has rebuilt (config.village.repairStage); missing draws 1. */
  // eslint-disable-next-line react/require-default-props -- defaulted in the signature
  repairStage?: RepairStage;
  /** closedCellsKey(square, map) */
  closedCells: string;
  groundTint: string;
  readState: () => GameEngineState | null;
  /** The local players who see a prompt over the prop they can use. */
  promptPlayerIds: readonly string[];
  reducedMotion: boolean;
}) {
  const present = useMemo(() => presentInteractables(square, tier), [square, tier]);
  const villagers = useMemo(() => present.filter((item) => item.kind === 'villager'), [present]);
  const fixed = useMemo(() => fixedPropsToken(square, present), [present, square]);

  const paving = useMemo(() => {
    const closed = new Set(closedCells.split(';'));
    const lamps = present.filter((item) => item.kind === 'shrine');
    return createPavingGeometry(square, (x, y) => !closed.has(`${x},${y}`), groundTint, lamps);
  }, [closedCells, groundTint, present, square]);
  useEffect(() => () => paving?.dispose(), [paving]);

  // One chip per present prop, retained while the square is up.
  const chips = useMemo(() => {
    const byId = new Map<string, { key: string; sprite: PlayerTagSprite }>();
    present.forEach((item) => {
      const { label, color } = promptFor(item, stageId);
      const key = chipKey(label, color, 'pickup');
      byId.set(item.id, { key, sprite: PLAYER_TAG_SPRITES.get(key) });
    });
    return byId;
  }, [present, stageId]);
  const gl = useThree((three) => three.gl);
  useEffect(() => {
    chips.forEach(({ key, sprite }) => {
      PLAYER_TAG_SPRITES.retain(key, sprite);
      // Upload now (the countdown), not when the first prompt shows. Best
      // effort, as cueChips does: without it the first draw uploads it.
      try {
        gl.initTexture(sprite.texture);
      } catch {
        // No 2D canvas (tests): the first draw uploads it.
      }
    });
    return () => chips.forEach(({ key, sprite }) => PLAYER_TAG_SPRITES.release(key, sprite));
  }, [chips, gl]);
  const firstChip = chips.values().next().value as { sprite: PlayerTagSprite } | undefined;

  const villagerGroups = useRef<(THREE.Group | null)[]>([]);
  const villagerRefs = useMemo(
    () => villagers.map((_, index) => (group: THREE.Group | null) => {
      villagerGroups.current[index] = group;
    }),
    [villagers]
  );
  const promptSprites = useRef<(THREE.Sprite | null)[]>([]);
  const promptRefs = useMemo(
    () => Array.from({ length: MAX_PROMPTS }, (_, index) => (sprite: THREE.Sprite | null) => {
      promptSprites.current[index] = sprite;
    }),
    []
  );
  const players = useRef(promptPlayerIds);
  if (!samePlayerIds(players.current, promptPlayerIds)) players.current = promptPlayerIds;
  const slots = useRef<PromptSlot[]>(Array.from({ length: MAX_PROMPTS }, () => ({
    cellX: NaN, cellY: NaN, target: null,
  })));
  const promptCount = Math.min(MAX_PROMPTS, promptPlayerIds.length);

  useFrame(({ clock, camera, size }, delta) => {
    const live = readState();
    const playing = !!live && live.phase === 'playing';
    const ids = players.current;
    for (let index = 0; index < MAX_PROMPTS; index += 1) {
      const slot = slots.current[index];
      const player = playing && live && index < ids.length
        ? findPlayer(live, ids[index])
        : null;
      if (!player || !player.alive) {
        slot.target = null;
        slot.cellX = NaN;
      } else {
        const cellX = Math.round(player.x);
        const cellY = Math.round(player.y);
        // The shared rule, asked again only when the player changes cell.
        if (cellX !== slot.cellX || cellY !== slot.cellY) {
          slot.cellX = cellX;
          slot.cellY = cellY;
          slot.target = reachableInteractable(square, cellX, cellY, tier);
        }
      }
      const sprite = promptSprites.current[index];
      const chip = slot.target ? chips.get(slot.target.id)?.sprite : undefined;
      if (sprite && slot.target && chip) {
        if (sprite.material !== chip.material) sprite.material = chip.material;
        const bob = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 2.4) * PROMPT_BOB;
        sprite.position.set(
          worldX(slot.target.x),
          PROMPT_HEIGHT[slot.target.kind] + bob,
          worldZ(slot.target.y)
        );
        const height = promptHeight(camera, size.height, sprite.position);
        sprite.scale.set(height * chip.aspect, height, 1);
        sprite.visible = true;
      } else if (sprite) {
        sprite.visible = false;
      }
    }

    // Villagers turn toward the nearest local player who comes close.
    for (let index = 0; index < villagers.length; index += 1) {
      const group = villagerGroups.current[index];
      const item = villagers[index];
      let yaw = propYaw(item, square);
      let nearest = VILLAGER_NOTICE + 1;
      if (playing && live) {
        for (let at = 0; at < live.players.length; at += 1) {
          const other = live.players[at];
          const distance = Math.max(Math.abs(other.x - item.x), Math.abs(other.y - item.y));
          if (other.alive && distance <= VILLAGER_NOTICE && distance < nearest) {
            nearest = distance;
            yaw = Math.atan2(other.x - item.x, other.y - item.y);
          }
        }
      }
      if (group) {
        let turn = yaw - group.rotation.y;
        turn = Math.atan2(Math.sin(turn), Math.cos(turn));
        const ease = reducedMotion ? 1 : 1 - Math.exp(-delta * VILLAGER_TURN_RATE);
        group.rotation.y += turn * ease;
        const breath = Math.sin(clock.elapsedTime * 1.7 + index * 2.1) * 0.015;
        group.scale.y = reducedMotion ? 1 : 1 + breath;
      }
    }
  });

  return (
    <group userData={{ villageSquare: true }}>
      {/* eslint-disable-next-line max-len -- one-line mount (scene/village) */}
      <VillageDressing square={square} stageId={stageId} repairStage={repairStage} closedCells={closedCells} present={present} readState={readState} reducedMotion={reducedMotion} />
      {paving && (
        <mesh geometry={paving} material={TOKEN_MATERIAL} receiveShadow userData={PAVING_MARK} />
      )}
      {fixed && (
        <>
          <mesh
            geometry={fixed.body}
            material={TOKEN_MATERIAL}
            castShadow
            receiveShadow
            userData={FIXED_MARK}
          />
          {fixed.ink && <mesh geometry={fixed.ink} material={FIGHTER_INK_MATERIAL} />}
        </>
      )}
      {villagers.map((item, index) => (
        <Villager key={item.id} item={item} square={square} groupRef={villagerRefs[index]} />
      ))}
      {firstChip && Array.from({ length: promptCount }, (_, index) => (
        <sprite
          // eslint-disable-next-line react/no-array-index-key -- one sprite per local player slot
          key={`prompt-${index}`}
          ref={promptRefs[index]}
          visible={false}
          material={firstChip.sprite.material}
          renderOrder={11}
          userData={PROMPT_MARK}
        />
      ))}
    </group>
  );
}

export const VillageSquare = React.memo(VillageSquareBase);

/**
 * Accepted requests' marks out in the map: keepsakes (a cloth bundle over a
 * solid ring) on visible cells, as the power-ups show, and chalk on marked
 * crates wherever the crate itself is drawn (visible or explored). Instanced:
 * four draw calls at most, however many marks.
 */
function VillageRequestMarksBase({
  marks,
  visibleCells,
  explored,
  reducedMotion,
  highContrast,
}: {
  marks: VillageMarks;
  visibleCells: ReadonlySet<string>;
  /** The fog's explored cells (crates stay drawn there, so their chalk does). */
  explored: readonly string[] | undefined;
  reducedMotion: boolean;
  highContrast: boolean;
}) {
  useHighContrastMaterials(highContrast, VILLAGE_HIGH_CONTRAST);
  const keepsake = keepsakeToken();
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const inkRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const chalkRef = useRef<THREE.InstancedMesh>(null);
  const shown = useRef<{ x: number; y: number }[]>([]);

  const keepsakes = useMemo(
    () => marks.keepsakes
      .filter((cell) => visibleCells.has(`${cell.x},${cell.y}`))
      .slice(0, MARK_CAPACITY),
    [marks.keepsakes, visibleCells]
  );
  const crates = useMemo(() => {
    if (!marks.crates.length) return marks.crates;
    const exploredCells = new Set(explored ?? []);
    return marks.crates.filter((cell) => {
      const key = `${cell.x},${cell.y}`;
      return visibleCells.has(key) || exploredCells.has(key);
    }).slice(0, MARK_CAPACITY);
  }, [explored, marks.crates, visibleCells]);

  // Every frame while keepsakes show: plain loops, no allocation.
  const writeKeepsakes = (seconds: number) => {
    const cells = shown.current;
    const body = bodyRef.current;
    const ink = inkRef.current;
    for (let index = 0; index < cells.length; index += 1) {
      const cell = cells[index];
      const phase = cell.x * 1.3 + cell.y * 0.7;
      const bob = reducedMotion ? 0 : Math.sin(seconds * 2 + phase) * KEEPSAKE_BOB;
      QUATERNION.setFromAxisAngle(UP, reducedMotion ? phase : seconds * 0.8 + phase);
      MATRIX.compose(
        POSITION.set(worldX(cell.x), KEEPSAKE_LIFT + bob, worldZ(cell.y)),
        QUATERNION,
        SCALE
      );
      body?.setMatrixAt(index, MATRIX);
      ink?.setMatrixAt(index, MATRIX);
    }
    showInstances(body, cells.length);
    showInstances(ink, cells.length);
  };

  useLayoutEffect(() => {
    shown.current = keepsakes;
    writeKeepsakes(0);
    const ringMesh = ringRef.current;
    if (ringMesh) {
      keepsakes.forEach((cell, index) => {
        const [wx, , wz] = toWorld(cell.x, cell.y);
        ringMesh.setMatrixAt(index, MATRIX.makeTranslation(wx, 0, wz));
      });
    }
    showInstances(ringMesh, keepsakes.length);
    const chalk = chalkRef.current;
    if (chalk) {
      crates.forEach((cell, index) => {
        const [wx, , wz] = toWorld(cell.x, cell.y);
        chalk.setMatrixAt(index, MATRIX.makeTranslation(wx, 0, wz));
      });
    }
    showInstances(chalk, crates.length);
  // writeKeepsakes reads only refs and reducedMotion.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crates, keepsakes, reducedMotion]);

  useFrame(({ clock }) => {
    if (reducedMotion || shown.current.length === 0) return;
    writeKeepsakes(clock.elapsedTime);
  });

  return (
    <group userData={{ villageMarks: true }}>
      <instancedMesh
        ref={bodyRef}
        args={[keepsake.body, TOKEN_MATERIAL, MARK_CAPACITY]}
        frustumCulled={false}
        visible={false}
        userData={{ villageMark: 'keepsake' }}
      />
      {keepsake.ink && (
        <instancedMesh
          ref={inkRef}
          args={[keepsake.ink, FIGHTER_INK_MATERIAL, MARK_CAPACITY]}
          frustumCulled={false}
          visible={false}
          userData={{ villageMark: 'keepsakeInk' }}
        />
      )}
      <instancedMesh
        ref={ringRef}
        args={[keepsakeRingGeometry(), KEEPSAKE_RING_MATERIAL, MARK_CAPACITY]}
        frustumCulled={false}
        visible={false}
        renderOrder={2}
        userData={{ villageMark: 'keepsakeRing' }}
      />
      <instancedMesh
        ref={chalkRef}
        args={[chalkMarkGeometry(), CHALK_MATERIAL, MARK_CAPACITY]}
        frustumCulled={false}
        visible={false}
        renderOrder={2}
        userData={{ villageMark: 'chalk' }}
      />
    </group>
  );
}

export const VillageRequestMarks = React.memo(VillageRequestMarksBase);
