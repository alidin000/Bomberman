/* eslint-disable react/no-unknown-property, react/no-array-index-key */
/* eslint-disable react/require-default-props, comma-dangle, max-len */
import React, {
  useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  Canvas, addEffect, useFrame, useThree,
} from '@react-three/fiber';
import * as THREE from 'three';
import {
  BombKind,
  BossHazard,
  CampaignObjectiveState,
  CampaignRescueTargetState,
  ExplosionCell,
  GameEngineState,
  HazardKind,
  MonsterKind,
  MonsterState,
  PlayerState,
} from '../../engine/types';
import {
  GameMap, isBomb, isObstacle, isPower, Power,
} from '../../model/gameItem';
import { isPowerUpActive } from '../../engine/players';
import { getUpcomingPressureCells, isBossIntroRunning } from '../../engine';
import { BOSS_INTRO_MS, EXPLOSION_MS } from '../../engine/constants';
import { hazardIsActive } from '../../engine/bosses';
import { getShadowCloneFormationCells } from '../../engine/characterAbilities';
import { cellKey } from '../../engine/fogOfWar';
import { getStageDefinition } from '../../content';
import { getStageLook, stageSkyBackground } from '../../content/stageLooks';
import {
  BossId, CharacterId, StageDefinition, StageId
} from '../../content/types';
import { GamePreferences, isLikelyLowEndDevice } from './gamePreferences';
import { PERF_PROBE_ENABLED, PerfProbe } from './scene/PerfProbe';
import { AdaptiveResolution } from './scene/AdaptiveResolution';
import {
  AdaptiveDprRuntime, initialCanvasDpr, reconcileAdaptiveDpr,
} from './scene/adaptiveResolution';
import { useViewportSize } from './useViewportSize';
import {
  MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE, toWorld
} from './scene/sceneSpace';
import { StaticTiles } from './scene/StaticTiles';
import {
  StaticTileFeatures,
  campaignTileFeatureKey,
  tileFeaturesFromKey,
} from './scene/staticTiles';
import {
  framingScaleFor,
  groupShift,
  maxFramingFor,
} from './scene/cameraFraming';
import { getVisibleAbilityWarnings } from './scene/abilityWarnings';
import {
  FUSE_URGENT_MS,
  blastPreviewCells,
  bombPulseScale,
  countdownNow,
  createCountdown,
  fuseRingRadius,
  shadowCloneCount,
} from './scene/bombFuse';
import { PLAYER_TAG_SPRITES, PlayerTagSprite, playerTagKey } from './scene/playerTags';
import { playerSlotColor } from './playerSlots';
import { isCpuSlot } from '../../ai/controllers';
import { HazardTelegraphs } from './scene/HazardTelegraphs';
import { WaveTelegraphs } from './scene/WaveTelegraphs';
import { KoMarkers } from './scene/KoMarkers';
import { useCueChips } from './scene/cueChips';
import { createPlayerPose, samplePlayerCuePose } from './scene/playerCuePose';
import { LightPool, PooledPointLight } from './scene/LightPool';
import { nextFlameAgeMs } from './scene/flameAge';
import { LIGHT_PRIORITY, PooledLightHandle } from './scene/lightPoolSlots';
import { LABEL_SPRITES, labelSpriteKey } from './scene/labelSprites';
import { ShaderWarmup } from './scene/ShaderWarmup';
import {
  FIGHTER_INK_HIGH_CONTRAST, FIGHTER_INK_MATERIAL, setInkViewportHeight,
} from './scene/fighterInk';
import { MAX_FRAME_DELTA_MS } from '../../hooks/engineLoop';
import {
  BOSS_MOTION_ID,
  MotionStore,
  isTrackMoving,
  monsterMotionId,
  playerMotionId,
  samplePosition,
  sampleTrack,
  trackProgress,
} from '../../hooks/motionStore';
import { PICKUP_CUE_MS, bodyCueAt, pickupCueAt } from '../../hooks/cueStore';
import {
  FACING_HEADING, advanceStride, cameraFollowRate, decayShake, turnToward,
} from './scene/motionFeel';
import { StageAtmosphere } from './scene/StageAtmosphere';
import { StageLandmarks } from './scene/StageLandmarks';
import { SceneryContext } from './scene/scenery';
import { BOARD_LIP } from './scene/landmarkPlacement';
import { MonsterFigure, monsterIsTranslucent } from './scene/MonsterFigure';
import { GUARD_NAMEPLATE_Y } from './scene/guardLooks';
import { PickupFigure } from './scene/PickupFigure';
import { PICKUP_HIGH_CONTRAST, pickupPhase } from './scene/pickupModels';
import { ObjectiveFigure } from './scene/ObjectiveFigures';
import {
  OBJECTIVE_HIGH_CONTRAST, arenaModel, gateModel, gateStateFor, rescueModel, structureDamageFor,
  structureFlagFor, structureModel,
} from './scene/objectiveModels';
import {
  BOSS_INK_HIGH_CONTRAST, BossFigure, BossFigureHandle, BossFigurePose,
} from './scene/BossFigure';
import {
  INTRO_AIM_TOWARD_CAMERA,
  INTRO_CATCH_UP_MS,
  introCuts,
  INTRO_FOLLOW_RATE,
  SEE_THROUGH_RATE,
  behindScreenBox,
  bossScreenBox,
  createScreenBox,
  introCameraWeight,
  introFraming,
  phaseCue,
  roarAmount,
  sealPose,
} from './scene/bossPresentation';
import { BombClockState, createBombClock, refreshBombClock } from './scene/bombClock';
import { ARENA_FRAME_PX, canvasHudInsets } from './scene/canvasInsets';
import { PuzzleMarkers } from './scene/PuzzleMarkers';
import { DojoMarkers } from './scene/DojoMarkers';
import { useHudDevice } from '../../input/touchMode';
import { PULSE_HZ, pulseRate } from './scene/flashSafety';
import {
  HighContrastOverride, highContrastPalette, useHighContrastMaterials,
} from './scene/highContrast';
import type { ScarfId } from '../../content/villageSquare';
import { VillageRequestMarks, VillageSquare, closedCellsKey } from './scene/VillageSquare';
import {
  activeSquareLayout, squareBlastStop, villageMarks, villageMarksFromKey, villageMarksKey,
} from './scene/VillageSquareModels';
import { VillageScarf } from './scene/VillageSquareScarf';
import { CastFigure } from './scene/cast/CastFigure';
import { castFigureMesh } from './scene/cast/castGeometry';
import { castMaterial } from './scene/cast/castMaterial';
import { CastPrewarm } from './scene/cast/CastPrewarm';
import { FIGHTER_EFFECT_COLORS } from './scene/cast/fighterLooks';
import { BOMB_SPIN_RAD_PER_S, JUTSU_COLORS, jutsuOf } from './scene/jutsu/jutsuLooks';
import {
  ChidoriSparks, ClayBird, HiraishinKunai, KunaiStrike, LightningStrike, RasenshurikenBlades, SandSpikes,
  WaterCloneSplash,
} from './scene/jutsu/JutsuModels';
import { enemyJutsuFor } from './scene/jutsu/enemyJutsu';
import {
  JUTSU_LAYERS, JutsuLayer, LayerPose, createCellPose, poseJutsuCell,
} from './scene/jutsu/explosionPoses';
import {
  birdGeometry, boltGeometry, puffGeometry, rasenshurikenGeometry, tomoeGeometry,
} from './scene/jutsu/jutsuGeometry';

const ENTITY_LERP_SPEED = 7.2;
const ENTITY_SNAP_EPSILON = 0.0016;
const ReducedMotionContext = React.createContext(false);
// Interpolated entity positions published by the engine loop (see motionStore).
const MotionContext = React.createContext<MotionStore | null>(null);
// The latest bombs and when each really goes off, refreshed from the live
// engine state before every frame (see refreshBombClock) and read by bombs and
// blast previews in useFrame. The scene does not re-render for a fuse tick.
type BombClock = BombClockState;
const BombClockContext = React.createContext<React.MutableRefObject<BombClock> | null>(null);
// The engine's newest state, for useFrame code. Render-time props come from
// the shared scene state (hooks/useRenderState), which skips ticks that only
// move clocks: a mesh that animates a timer, a cooldown or the exact ultimate
// charge must read it here, per frame, not from its props.
const LiveStateContext = React.createContext<() => GameEngineState | null>(() => null);
// The seat this browser plays in an online room; null plays every human seat
// here (solo and local matches). Only the village square's prompts read it.
const LocalSeatContext = React.createContext<number | null>(null);
const NO_PLAYER_IDS: readonly string[] = [];

/** The players who see the village square's prompt: this browser's humans. */
function promptPlayersKey(state: GameEngineState, localSeat: number | null): string {
  if (localSeat !== null) return state.players[localSeat]?.id ?? '';
  return state.players
    .filter((_, index) => !isCpuSlot(state.config, index))
    .map((player) => player.id)
    .join('|');
}

function lerpAngle(from: number, to: number, alpha: number): number {
  const turn = Math.PI * 2;
  const diff = ((((to - from) % turn) + turn * 1.5) % turn) - Math.PI;
  return from + diff * alpha;
}

function getMapDimensions(map: GameMap): { width: number; height: number } {
  return {
    width: Math.max(1, ...map.map((row) => row.length)),
    height: Math.max(1, map.length),
  };
}

function getMapWorldCenter(width: number, height: number): [number, number, number] {
  return toWorld((width - 1) / 2, (height - 1) / 2);
}

function cellVisibleInSet(visibleCells: Set<string>, x: number, y: number): boolean {
  return visibleCells.has(cellKey(Math.round(x), Math.round(y)));
}

// Per movement kind: the floor ring and nameplate bar colour, and size. The
// figure itself (head, carried shape, motion) comes from the archetype; see
// scene/monsterLooks.ts.
const MONSTER_VISUALS: Record<MonsterKind, { glow: string; scale: number }> = {
  basic: { glow: '#f29664', scale: 1.08 },
  smart: { glow: '#df9c6b', scale: 1.12 },
  ghost: { glow: '#8bcac9', scale: 1.06 },
  fork: { glow: '#c08ea8', scale: 1.16 },
};

// Glow (floor ring, pooled light, sensed marker) and size per boss. Each
// boss's base silhouette comes from scene/BossFigure.tsx.
const BOSS_VISUALS: Record<BossId, { glow: string; scale: number }> = {
  shukaku: { glow: '#f59e0b', scale: 1.5 },
  matatabi: { glow: '#38bdf8', scale: 1.42 },
  isobu: { glow: '#22d3ee', scale: 1.5 },
  sonGoku: { glow: '#fb923c', scale: 1.56 },
  kokuo: { glow: '#bfdbfe', scale: 1.48 },
  saiken: { glow: '#a3e635', scale: 1.42 },
  chomei: { glow: '#86efac', scale: 1.44 },
  gyuki: { glow: '#a855f7', scale: 1.54 },
  kurama: { glow: '#fb923c', scale: 1.58 },
};

const HAZARD_VISUALS: Record<HazardKind, {
  color: string;
  accent: string;
  effect: 'sand' | 'spikes' | 'fire' | 'water' | 'lava' | 'steam' | 'acid' | 'air' | 'tentacle' | 'bomb' | 'shockwave';
}> = {
  sandTornado: { color: '#d6a45d', accent: '#8b5e34', effect: 'sand' },
  sandSpikes: { color: '#f59e0b', accent: '#7c2d12', effect: 'spikes' },
  blueFireTrail: { color: '#38bdf8', accent: '#dbeafe', effect: 'fire' },
  waterCannon: { color: '#22d3ee', accent: '#cffafe', effect: 'water' },
  lavaBurst: { color: '#ef4444', accent: '#f97316', effect: 'lava' },
  steamCharge: { color: '#e5e7eb', accent: '#93c5fd', effect: 'steam' },
  acidBubble: { color: '#a3e635', accent: '#7c3aed', effect: 'acid' },
  airStrike: { color: '#86efac', accent: '#f8fafc', effect: 'air' },
  tentacleSlam: { color: '#6d28d9', accent: '#c084fc', effect: 'tentacle' },
  beastBomb: { color: '#581c87', accent: '#f97316', effect: 'bomb' },
  chakraShockwave: { color: '#fb923c', accent: '#fff7ed', effect: 'shockwave' },
};

const BOMB_STYLE: Record<BombKind, { color: string; emissive: string }> = {
  standard: { color: '#f5efe0', emissive: '#ff8a00' },
  claySpider: { color: '#f5efe0', emissive: '#ff8a00' },
  shadowClone: { color: '#ff9f1c', emissive: '#f97316' },
  shadowCloneBarrage: { color: '#ff9f1c', emissive: '#f97316' },
  chidoriMine: { color: '#93c5fd', emissive: '#2563eb' },
  sandCoffin: { color: '#c48a4a', emissive: '#f59e0b' },
  thunderMark: { color: '#fde68a', emissive: '#facc15' },
  crowClone: { color: '#1f2937', emissive: '#dc2626' },
  giantClay: { color: '#f5efe0', emissive: '#ef4444' },
  rasenshuriken: { color: '#bfdbfe', emissive: '#38bdf8' },
  kirin: { color: '#60a5fa', emissive: '#1d4ed8' },
  sandTsunami: { color: '#d6a45d', emissive: '#f97316' },
  instantTeleport: { color: '#fef3c7', emissive: '#facc15' },
  tsukuyomi: { color: '#111827', emissive: '#ef4444' },
};

function TextSprite({
  text,
  color,
  width = 0.7,
}: {
  text: string;
  color: string;
  width?: number;
}) {
  const key = labelSpriteKey(text, color);
  const sprite = useMemo(() => LABEL_SPRITES.get(key), [key]);

  useEffect(() => {
    LABEL_SPRITES.retain(key, sprite);
    return () => LABEL_SPRITES.release(key, sprite);
  }, [key, sprite]);

  return <sprite scale={[width, 0.18, 1]} material={sprite.material} />;
}

function Floor({
  palette,
  width,
  height,
}: {
  palette: StageDefinition['palette'];
  width: number;
  height: number;
}) {
  const [centerX, , centerZ] = getMapWorldCenter(width, height);
  return (
    <>
      <mesh position={[centerX, -0.28, centerZ]} receiveShadow castShadow>
        <boxGeometry args={[width + 1.1, 0.48, height + 1.1]} />
        <meshStandardMaterial color={palette.wall} roughness={1} flatShading />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.035, centerZ]} receiveShadow>
        <planeGeometry args={[width + 1.1, height + 1.1]} />
        <meshStandardMaterial color={palette.groundB} roughness={1} />
      </mesh>
    </>
  );
}

function useSmoothWorldPosition(
  ref: React.MutableRefObject<THREE.Group | null>,
  x: number,
  y: number,
  elevation: number,
  motionRef?: React.MutableRefObject<number>,
  motionId?: string,
  // Yaw to face (players: their engine facing); otherwise the last step's direction.
  heading?: number,
) {
  const initialized = useRef(false);
  const targetRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());
  const motion = React.useContext(MotionContext);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;

    if (motion && motionId) {
      // Draw exactly where the engine's step interpolation says, at simulation
      // time: continuous, frame-rate independent, at most one step behind.
      const point = samplePosition(motion, motionId, x, y);
      const [wx, , wz] = toWorld(point.x, point.y);
      group.position.set(wx, elevation, wz);
      initialized.current = true;
      const track = motion.tracks.get(motionId);
      const dx = track ? track.toX - track.fromX : 0;
      const dz = track ? track.toY - track.fromY : 0;
      const moving = !!track && trackProgress(track, motion.simTimeMs) < 1 && (dx !== 0 || dz !== 0);
      const blend = motionRef;
      if (blend) {
        // Same steady-state blend as the old chase: speed / ENTITY_LERP_SPEED.
        const speed = moving && track ? Math.hypot(dx, dz) / (track.durationMs / 1000) : 0;
        blend.current = THREE.MathUtils.lerp(
          blend.current,
          Math.min(speed / ENTITY_LERP_SPEED, 1),
          1 - Math.exp(-delta * 16),
        );
      }
      // Keep turning after the step ends: gating on `moving` froze a model
      // mid-turn whenever a step finished first (a tap, a wall, a monster hop).
      const faceTo = heading ?? (dx !== 0 || dz !== 0 ? Math.atan2(dx, dz) : undefined);
      if (faceTo !== undefined) {
        group.rotation.y = turnToward(group.rotation.y, faceTo, delta);
      }
      return;
    }

    const [wx, , wz] = toWorld(x, y);
    const target = targetRef.current.set(wx, elevation, wz);

    if (!initialized.current) {
      group.position.copy(target);
      initialized.current = true;
      return;
    }

    const direction = directionRef.current.copy(target).sub(group.position);
    const horizontalDistanceSq = direction.x * direction.x + direction.z * direction.z;
    const motionTarget = Math.min(Math.sqrt(horizontalDistanceSq) / TILE_SIZE, 1);
    const movement = motionRef;
    if (movement) {
      movement.current = THREE.MathUtils.lerp(
        movement.current,
        motionTarget,
        1 - Math.exp(-delta * 16),
      );
    }

    if (horizontalDistanceSq > 0.0001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      group.rotation.y = lerpAngle(
        group.rotation.y,
        targetRotation,
        1 - Math.exp(-delta * ENTITY_LERP_SPEED),
      );
    }

    if (horizontalDistanceSq <= ENTITY_SNAP_EPSILON) {
      group.position.copy(target);
      return;
    }

    group.position.lerp(target, 1 - Math.exp(-delta * ENTITY_LERP_SPEED));
  });
}

// Sensed-wall markers and shadow blobs never change their look, so every
// instance shares one geometry and one material.
const SENSED_WALL_RING_GEOMETRY = new THREE.RingGeometry(0.28, 0.5, 32);
const SENSED_WALL_RING_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.54, transparent: true, opacity: 0.36
});
const SENSED_WALL_BOX_GEOMETRY = new THREE.BoxGeometry(0.62, 0.34, 0.62);
const SENSED_WALL_BOX_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#d6a45d', emissive: '#f59e0b', emissiveIntensity: 0.22, transparent: true, opacity: 0.28, wireframe: true
});

function SensedWallMarker({
  x,
  y,
}: {
  x: number;
  y: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(x, y);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.7) * 0.05;
  });

  return (
    <group ref={ref} position={[wx, 0.17, wz]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        geometry={SENSED_WALL_RING_GEOMETRY}
        material={SENSED_WALL_RING_MATERIAL}
      />
      <mesh position={[0, 0.08, 0]} geometry={SENSED_WALL_BOX_GEOMETRY} material={SENSED_WALL_BOX_MATERIAL} />
    </group>
  );
}

// Sudden-death telegraph: the next pressure blocks hover over the cells they
// are about to crush, lowest first, so players can read the closing spiral.
const PRESSURE_RING_GEOMETRY = new THREE.RingGeometry(0.34, 0.5, 4, 1);
// Front side only: the ring lies flat facing up and the camera is always
// above it. A transparent DoubleSide material draws in two passes, and its
// back-face program compiled the moment the first warning appeared.
const PRESSURE_RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#ef4444', transparent: true, opacity: 0.8
});
const PRESSURE_BLOCK_GEOMETRY = new THREE.BoxGeometry(0.92, 1, 0.92);
const PRESSURE_BLOCK_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#7f1d1d', emissive: '#ef4444', emissiveIntensity: 0.4, transparent: true, opacity: 0.5
});

function PressureBlockWarning({ x, y, order }: { x: number; y: number; order: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(x, y);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.scale.setScalar(reducedMotion
      ? 1
      : 1 + Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.pressureRing) - order) * 0.1);
  });

  return (
    <group position={[wx, 0, wz]}>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, Math.PI / 4]}
        position={[0, 0.04, 0]}
        geometry={PRESSURE_RING_GEOMETRY}
        material={PRESSURE_RING_MATERIAL}
      />
      <mesh
        position={[0, 1.6 + order * 0.7, 0]}
        geometry={PRESSURE_BLOCK_GEOMETRY}
        material={PRESSURE_BLOCK_MATERIAL}
      />
    </group>
  );
}

// Fuse ring: a dark ring on the floor that closes on the bomb as its fuse
// burns (radius = time left), turning red and thick for the last stretch.
// Every bomb shares these; swapping between them never compiles a program.
const FUSE_RING_GEOMETRY = new THREE.RingGeometry(0.84, 1, 48).rotateX(-Math.PI / 2);
const FUSE_RING_URGENT_GEOMETRY = new THREE.RingGeometry(0.6, 1, 48).rotateX(-Math.PI / 2);
const FUSE_RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#1c1917', transparent: true, opacity: 0.72, depthWrite: false,
});
const FUSE_RING_URGENT_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#dc2626', transparent: true, opacity: 0.92, depthWrite: false,
});

/** Time until the bomb on (x, y) goes off, smoothed between ticks; Infinity if held or gone. */
function bombRemainingMs(
  clock: BombClock | undefined,
  x: number,
  y: number,
  countdown: ReturnType<typeof createCountdown>,
  simTimeMs: number | undefined,
): number {
  if (!clock) return Infinity;
  for (let index = 0; index < clock.bombs.length; index += 1) {
    const bomb = clock.bombs[index];
    if (bomb.x === x && bomb.y === y) {
      const at = clock.detonationMs.get(bomb.id) ?? bomb.ticksRemaining;
      return simTimeMs === undefined ? at : countdownNow(countdown, at, simTimeMs);
    }
  }
  return Infinity;
}

function bombAgeMs(clock: BombClock | undefined, x: number, y: number): number | null {
  if (!clock) return null;
  const bomb = clock.bombs.find((candidate) => candidate.x === x && candidate.y === y);
  return bomb?.ageMs ?? null;
}

// Naruto's shadow clones: his cast figure at three quarters of his height,
// lit with a chakra glow (a uniform on a pooled cast material, so no new
// shader program).
const SHADOW_CLONE_SCALE = 0.76;
const shadowCloneMaterial = () => castMaterial({ glow: '#f97316', glowIntensity: 0.32 });

function BombMesh({
  x, y, kind, cloneOffsets = [],
}: {
  x: number;
  y: number;
  kind: BombKind;
  cloneOffsets?: readonly { x: number; y: number }[];
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const cloneFormationRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<PooledLightHandle>(null);
  const clonePlacedAtRef = useRef<number | null>(null);
  const bombClock = React.useContext(BombClockContext);
  const motion = React.useContext(MotionContext);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const countdownRef = useRef(createCountdown());
  const ultimateScale = [
    'giantClay', 'shadowCloneBarrage', 'rasenshuriken', 'kirin',
    'sandTsunami', 'instantTeleport', 'tsukuyomi',
  ]
    .includes(kind)
    ? 1.35
    : 1;
  const giant = kind === 'giantClay';
  const baseScale = giant ? 1.72 : ultimateScale;
  const height = giant ? 0.48 : 0.36;
  useSmoothWorldPosition(groupRef, x, y, height);
  useFrame(({ clock }) => {
    const remaining = bombRemainingMs(bombClock?.current, x, y, countdownRef.current, motion?.simTimeMs);
    const simTimeMs = motion?.simTimeMs ?? clock.elapsedTime * 1000;
    if (clonePlacedAtRef.current === null) clonePlacedAtRef.current = simTimeMs;
    const cloneElapsedMs = bombAgeMs(bombClock?.current, x, y)
      ?? simTimeMs - clonePlacedAtRef.current;
    const urgent = remaining <= FUSE_URGENT_MS;
    const pulse = reducedMotion ? 1 : 1 + Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.bombCore)) * 0.08;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }
    if (cloneFormationRef.current) {
      cloneFormationRef.current.visible = shadowCloneCount(remaining, cloneElapsedMs) === 5;
    }
    // About to blow: the whole bomb swells and beats faster.
    const scale = baseScale * bombPulseScale(remaining, clock.elapsedTime, reducedMotion);
    if (groupRef.current) {
      groupRef.current.rotation.y = ['shadowClone', 'shadowCloneBarrage'].includes(kind)
        ? 0
        : clock.elapsedTime * BOMB_SPIN_RAD_PER_S;
      groupRef.current.scale.setScalar(scale);
    }
    if (lightRef.current) {
      lightRef.current.intensity = reducedMotion
        ? 0.7
        : 0.7 + Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.bombLight)) * 0.35;
    }
    const ring = ringRef.current;
    if (ring) {
      // The ring rides in the bomb's group: undo its scale and lift.
      ring.visible = Number.isFinite(remaining);
      ring.scale.setScalar(fuseRingRadius(remaining) / scale);
      ring.position.y = (0.05 - height) / scale;
      ring.geometry = urgent ? FUSE_RING_URGENT_GEOMETRY : FUSE_RING_GEOMETRY;
      ring.material = urgent ? FUSE_RING_URGENT_MATERIAL : FUSE_RING_MATERIAL;
    }
  });
  const style = BOMB_STYLE[kind];
  return (
    <group ref={groupRef} scale={baseScale}>
      <mesh ref={ringRef} geometry={FUSE_RING_GEOMETRY} material={FUSE_RING_MATERIAL} />
      <PooledPointLight ref={lightRef} priority={LIGHT_PRIORITY.bomb} color={style.emissive} distance={2.8} intensity={0.72} />

      {(kind === 'claySpider' || kind === 'giantClay') && (
        <>
          <mesh ref={coreRef} castShadow scale={[1.15, 0.72, 0.9]}>
            <sphereGeometry args={[0.26, 24, 24]} />
            <meshStandardMaterial color="#f5efe0" emissive={style.emissive} emissiveIntensity={0.24} roughness={0.52} />
          </mesh>
          {giant ? <ClayBird scale={2.4} /> : (
            <>
              <mesh position={[0, 0.18, 0.2]} castShadow>
                <sphereGeometry args={[0.12, 14, 14]} />
                <meshStandardMaterial color="#f7f0df" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.1, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.24, 0.12]} />
                <meshStandardMaterial color={style.emissive} emissive={style.emissive} emissiveIntensity={0.55} />
              </mesh>
              {[-0.22, -0.1, 0.1, 0.22].map((side) => (
                <React.Fragment key={`clay-leg-${side}`}>
                  <mesh position={[side, -0.04, 0.13]} rotation={[0, 0, side > 0 ? -0.75 : 0.75]}>
                    <capsuleGeometry args={[0.022, 0.25, 4, 6]} />
                    <meshStandardMaterial color="#f5efe0" roughness={0.55} />
                  </mesh>
                  <mesh position={[side, -0.04, -0.13]} rotation={[0, 0, side > 0 ? 0.75 : -0.75]}>
                    <capsuleGeometry args={[0.022, 0.25, 4, 6]} />
                    <meshStandardMaterial color="#f5efe0" roughness={0.55} />
                  </mesh>
                </React.Fragment>
              ))}
            </>
          )}
          {giant && (
            <mesh position={[0, 0.42, 0.02]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#ffdd55" emissive="#ff6600" emissiveIntensity={1.2} />
            </mesh>
          )}
        </>
      )}

      {(kind === 'shadowClone' || kind === 'shadowCloneBarrage') && (
        <>
          {/* The fuse ring: it pulses with the bomb, so danger reads as before. */}
          <mesh ref={coreRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
            <torusGeometry args={[0.33, 0.026, 8, 34]} />
            <meshStandardMaterial color="#fed7aa" emissive="#f97316" emissiveIntensity={0.64} transparent opacity={0.62} />
          </mesh>
          {/* The clone is Naruto's own cast figure, a little smaller and
              glowing with chakra, so it never reads as the player. */}
          <CastFigure
            figure={castFigureMesh('naruto')}
            material={shadowCloneMaterial()}
            position={[0, -height / baseScale, 0]}
            scale={SHADOW_CLONE_SCALE / baseScale}
          />
          {[-0.22, 0.22].map((side) => (
            <mesh key={`clone-smoke-${side}`} position={[side, -0.16, side > 0 ? -0.08 : 0.08]} scale={[1.2, 0.66, 1.2]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color="#f8fafc" emissive="#e5e7eb" emissiveIntensity={0.2} transparent opacity={0.62} />
            </mesh>
          ))}
          <group ref={cloneFormationRef} visible={false}>
            {cloneOffsets.map((offset, index) => (
              <group
                key={`shadow-clone-copy-${index}`}
                position={[offset.x / baseScale, 0, offset.y / baseScale]}
                rotation={[0, (index - 1) * 0.55, 0]}
              >
                <CastFigure
                  figure={castFigureMesh('naruto')}
                  material={shadowCloneMaterial()}
                  position={[0, -height / baseScale, 0]}
                  scale={SHADOW_CLONE_SCALE / baseScale}
                />
              </group>
            ))}
          </group>
        </>
      )}

      {(kind === 'chidoriMine' || kind === 'kirin') && (
        <>
          <ChidoriSparks reducedMotion={reducedMotion} size={kind === 'kirin' ? 0.44 : 0.34} />
          <mesh ref={coreRef} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[kind === 'kirin' ? 0.31 : 0.24, 0.028, 8, 32]} />
            <meshStandardMaterial color={style.color} emissive={style.emissive} emissiveIntensity={0.9} />
          </mesh>
          {[-0.2, 0, 0.2].map((side) => (
            <mesh key={`lightning-mark-${side}`} position={[side, 0.18, 0]} rotation={[0.4, 0, side > 0 ? -0.5 : 0.5]}>
              <coneGeometry args={[0.035, kind === 'kirin' ? 0.46 : 0.32, 4]} />
              <meshStandardMaterial color="#dbeafe" emissive={style.emissive} emissiveIntensity={1.1} />
            </mesh>
          ))}
          {kind === 'kirin' && (
            <mesh position={[0, 0.42, 0]}>
              <coneGeometry args={[0.1, 0.74, 5]} />
              <meshStandardMaterial color="#bfdbfe" emissive="#60a5fa" emissiveIntensity={1.15} transparent opacity={0.78} />
            </mesh>
          )}
        </>
      )}

      {(kind === 'sandCoffin' || kind === 'sandTsunami') && (
        <>
          <mesh ref={coreRef} castShadow scale={[1.18, 0.72, 1.18]}>
            <sphereGeometry args={[kind === 'sandTsunami' ? 0.32 : 0.25, 18, 18]} />
            <meshStandardMaterial color="#c48a4a" emissive="#d6a45d" emissiveIntensity={0.16} roughness={0.88} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
            <torusGeometry args={[kind === 'sandTsunami' ? 0.44 : 0.31, 0.036, 8, 34]} />
            <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.45} transparent opacity={0.62} />
          </mesh>
          {[-0.18, 0.18].map((side) => (
            <mesh key={`sand-grain-${side}`} position={[side, 0.2, 0.12]}>
              <dodecahedronGeometry args={[0.06, 0]} />
              <meshStandardMaterial color="#d6a45d" />
            </mesh>
          ))}
        </>
      )}

      {(kind === 'thunderMark' || kind === 'instantTeleport') && (
        <>
          <mesh ref={coreRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
            <ringGeometry args={[0.2, kind === 'instantTeleport' ? 0.45 : 0.35, 36]} />
            <meshStandardMaterial color="#fef3c7" emissive={style.emissive} emissiveIntensity={1.05} transparent opacity={0.78} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.215, 0]}>
            <ringGeometry args={[0.06, kind === 'instantTeleport' ? 0.18 : 0.14, 24]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.1} transparent opacity={0.7} />
          </mesh>
          <HiraishinKunai scale={kind === 'instantTeleport' ? 1.15 : 1} />
          {kind === 'instantTeleport' && (
            <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 4]}>
              <coneGeometry args={[0.16, 0.86, 4]} />
              <meshStandardMaterial color="#fef3c7" emissive="#facc15" emissiveIntensity={1.05} transparent opacity={0.44} />
            </mesh>
          )}
        </>
      )}

      {(kind === 'crowClone' || kind === 'tsukuyomi') && (
        <>
          <mesh ref={coreRef} castShadow scale={[1.1, 0.8, 0.95]}>
            <sphereGeometry args={[0.24, 16, 16]} />
            <meshStandardMaterial color="#050507" emissive={style.emissive} emissiveIntensity={kind === 'tsukuyomi' ? 0.6 : 0.24} roughness={0.42} />
          </mesh>
          {[-0.22, 0.22].map((side) => (
            <mesh key={`crow-wing-${side}`} position={[side, 0.02, 0]} rotation={[0, side > 0 ? -0.3 : 0.3, side > 0 ? -0.7 : 0.7]}>
              <coneGeometry args={[0.1, 0.38, 3]} />
              <meshStandardMaterial color="#111827" emissive="#dc2626" emissiveIntensity={0.18} />
            </mesh>
          ))}
          <mesh position={[0, 0.1, 0.22]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.2} />
          </mesh>
          {kind === 'tsukuyomi' && (
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.09, 0]}>
              <torusGeometry args={[0.42, 0.025, 8, 42]} />
              <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.05} transparent opacity={0.55} />
            </mesh>
          )}
        </>
      )}

      {kind === 'rasenshuriken' && (
        <>
          <mesh ref={coreRef}>
            <sphereGeometry args={[0.19, 24, 24]} />
            <meshStandardMaterial color="#dbeafe" emissive="#38bdf8" emissiveIntensity={1.05} transparent opacity={0.86} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.28, 0.025, 8, 36]} />
            <meshStandardMaterial color="#bfdbfe" emissive="#38bdf8" emissiveIntensity={0.95} />
          </mesh>
          <RasenshurikenBlades reducedMotion={reducedMotion} />
        </>
      )}

      {kind === 'standard' && (
        <mesh ref={coreRef} castShadow>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color={style.color} emissive={style.emissive} emissiveIntensity={0.24} roughness={0.52} />
        </mesh>
      )}
    </group>
  );
}

const EXPLOSION_INSTANCE_CAPACITY = 512;
const EXPLOSION_DUMMY = new THREE.Object3D();
EXPLOSION_DUMMY.rotation.order = 'YXZ';
const EXPLOSION_CELL_POSE = createCellPose();

function getExplosionKey(explosion: ExplosionCell): string {
  return `${explosion.x},${explosion.y},${explosion.kind ?? 'standard'}`;
}

function writeExplosionLayer(
  mesh: THREE.InstancedMesh | null,
  slot: number,
  pose: LayerPose,
  wx: number,
  wz: number,
) {
  if (!mesh) return;
  EXPLOSION_DUMMY.position.set(wx + pose.x, pose.y, wz + pose.z);
  EXPLOSION_DUMMY.scale.set(pose.sx, pose.sy, pose.sz);
  EXPLOSION_DUMMY.rotation.set(pose.rx, pose.ry, pose.rz);
  EXPLOSION_DUMMY.updateMatrix();
  mesh.setMatrixAt(slot, EXPLOSION_DUMMY.matrix);
  mesh.setColorAt(slot, pose.color);
}

/** Uploads only the live instances: flagging all 512 sent ~190 KB a frame, even with no explosions. */
function uploadInstances(mesh: THREE.InstancedMesh | null | undefined, live: number) {
  if (!mesh) return;
  const instancedMesh = mesh;
  instancedMesh.count = live;
  if (live === 0) return;
  instancedMesh.instanceMatrix.addUpdateRange(0, live * 16);
  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.addUpdateRange(0, live * 3);
    instancedMesh.instanceColor.needsUpdate = true;
  }
}

function pruneFlameAges(ages: Map<string, number>, ticks: Map<string, number>, active: Set<string>) {
  ages.forEach((_, key) => {
    if (active.has(key)) return;
    ages.delete(key);
    ticks.delete(key);
  });
}

// The jutsu layers (scene/jutsu) draw only for the cells whose jutsu uses
// them, packed from slot 0; they share the base layers' program.
const JUTSU_LAYER_GEOMETRY: Record<JutsuLayer, () => THREE.BufferGeometry> = {
  bolt: boltGeometry,
  puff: puffGeometry,
  blade: rasenshurikenGeometry,
  bird: birdGeometry,
  sigil: tomoeGeometry,
};
const JUTSU_LAYER_OPACITY: Record<JutsuLayer, number> = {
  bolt: 0.92, puff: 0.88, blade: 0.72, bird: 0.95, sigil: 0.9,
};

function ExplosionField({ explosions }: { explosions: ExplosionCell[] }) {
  const flameRef = useRef<THREE.InstancedMesh>(null);
  const shockwaveRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const accentRef = useRef<THREE.InstancedMesh>(null);
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const jutsuRefs = useRef<Partial<Record<JutsuLayer, THREE.InstancedMesh | null>>>({});
  const jutsuSetters = useRef(Object.fromEntries(JUTSU_LAYERS.map((layer) => [
    layer,
    (mesh: THREE.InstancedMesh | null) => { jutsuRefs.current[layer] = mesh; },
  ])) as Record<JutsuLayer, (mesh: THREE.InstancedMesh | null) => void>);
  const jutsuCounts = useRef(Object.fromEntries(JUTSU_LAYERS.map((layer) => [layer, 0])) as Record<JutsuLayer, number>);
  const lightRef = useRef<PooledLightHandle>(null);
  const agesRef = useRef(new Map<string, number>());
  const ticksRef = useRef(new Map<string, number>());
  const motion = React.useContext(MotionContext);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const simTimeRef = useRef<number | null>(null);
  const activeKeysRef = useRef(new Set<string>());
  const lightColorRef = useRef(new THREE.Color('#f97316'));

  // Allocate instance colours up front: setColorAt would otherwise create them
  // on the first explosion, which changes the shader variant and compiles a
  // new program mid-match. The layers take their colour from these alone: a
  // `vertexColors` material also multiplies by the geometry's colour
  // attribute, and these geometries have none, so WebGL read (0, 0, 0) and
  // every flame drew black.
  useLayoutEffect(() => {
    [
      flameRef.current, shockwaveRef.current, ringRef.current, accentRef.current, debrisRef.current,
      ...JUTSU_LAYERS.map((layer) => jutsuRefs.current[layer] ?? null),
    ].forEach((mesh) => {
      if (!mesh || mesh.instanceColor) return;
      const instancedMesh = mesh;
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(EXPLOSION_INSTANCE_CAPACITY * 3),
        3,
      );
    });
  }, []);

  useFrame(({ clock }, delta) => {
    // Flames age with the simulation while it runs, so they burn out with
    // the engine's own flame. When it is stopped (paused, round over) they
    // age by frame time, capped like the engine's frame step: a frame drawn
    // on demand after a long pause must not burn them out all at once.
    const simTimeMs = motion?.simTimeMs ?? null;
    const simStepMs = simTimeMs !== null && simTimeRef.current !== null
      ? simTimeMs - simTimeRef.current
      : 0;
    simTimeRef.current = simTimeMs;
    const stepMs = simStepMs > 0 ? simStepMs : Math.min(delta * 1000, MAX_FRAME_DELTA_MS);
    const activeKeys = activeKeysRef.current;
    activeKeys.clear();
    const count = Math.min(explosions.length, EXPLOSION_INSTANCE_CAPACITY);
    const counts = jutsuCounts.current;
    for (let layer = 0; layer < JUTSU_LAYERS.length; layer += 1) counts[JUTSU_LAYERS[layer]] = 0;
    let strongestLight = 0;
    let strongestX = 0;
    let strongestZ = 0;

    for (let index = 0; index < count; index += 1) {
      const explosion = explosions[index];
      const key = getExplosionKey(explosion);
      activeKeys.add(key);

      const ageMs = nextFlameAgeMs(
        agesRef.current.get(key),
        ticksRef.current.get(key),
        explosion.ticksRemaining,
        stepMs
      );
      agesRef.current.set(key, ageMs);
      ticksRef.current.set(key, explosion.ticksRemaining);

      const progress = ageMs / EXPLOSION_MS;
      const wx = (explosion.x + MAP_OFFSET_X) * TILE_SIZE;
      const wz = (explosion.y + MAP_OFFSET_Z) * TILE_SIZE;
      const effect = jutsuOf(explosion.kind);
      const pose = poseJutsuCell(effect, progress, index, clock.elapsedTime, reducedMotion, EXPLOSION_CELL_POSE);
      writeExplosionLayer(flameRef.current, index, pose.flame, wx, wz);
      writeExplosionLayer(shockwaveRef.current, index, pose.shockwave, wx, wz);
      writeExplosionLayer(ringRef.current, index, pose.ring, wx, wz);
      writeExplosionLayer(accentRef.current, index, pose.accent, wx, wz);
      writeExplosionLayer(debrisRef.current, index, pose.debris, wx, wz);
      for (let layer = 0; layer < JUTSU_LAYERS.length; layer += 1) {
        const name = JUTSU_LAYERS[layer];
        if (pose[name].on && counts[name] < EXPLOSION_INSTANCE_CAPACITY) {
          writeExplosionLayer(jutsuRefs.current[name] ?? null, counts[name], pose[name], wx, wz);
          counts[name] += 1;
        }
      }

      const pulse = Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
      if (pulse > strongestLight) {
        strongestLight = pulse;
        strongestX = wx;
        strongestZ = wz;
        lightColorRef.current.copy(JUTSU_COLORS[effect].danger);
      }
    }

    pruneFlameAges(agesRef.current, ticksRef.current, activeKeys);

    uploadInstances(flameRef.current, count);
    uploadInstances(shockwaveRef.current, count);
    uploadInstances(ringRef.current, count);
    uploadInstances(accentRef.current, count);
    uploadInstances(debrisRef.current, count);
    for (let layer = 0; layer < JUTSU_LAYERS.length; layer += 1) {
      const name = JUTSU_LAYERS[layer];
      const mesh = jutsuRefs.current[name];
      uploadInstances(mesh, counts[name]);
      // An idle jutsu layer leaves the render list; the base layers keep
      // its program alive.
      if (mesh) mesh.visible = counts[name] > 0;
    }

    if (lightRef.current) {
      lightRef.current.intensity = strongestLight * 2.1;
      lightRef.current.color.copy(lightColorRef.current);
      if (strongestLight > 0) {
        lightRef.current.position.set(strongestX, 1.1, strongestZ);
      }
    }
  });

  return (
    <>
      <PooledPointLight ref={lightRef} priority={LIGHT_PRIORITY.explosion} distance={5} intensity={1.8} color="#f97316" />
      <instancedMesh ref={shockwaveRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]} frustumCulled={false}>
        <torusGeometry args={[0.34, 0.035, 8, 24]} />
        <meshBasicMaterial transparent opacity={0.38} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={flameRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]} frustumCulled={false}>
        <sphereGeometry args={[0.34, 12, 12]} />
        <meshBasicMaterial transparent opacity={0.82} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]} frustumCulled={false}>
        <ringGeometry args={[0.18, 0.55, 6]} />
        <meshBasicMaterial transparent opacity={0.48} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={accentRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]} frustumCulled={false}>
        <coneGeometry args={[0.12, 0.58, 4]} />
        <meshBasicMaterial transparent opacity={0.78} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={debrisRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]} frustumCulled={false}>
        <tetrahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial transparent opacity={0.72} depthWrite={false} />
      </instancedMesh>
      {JUTSU_LAYERS.map((layer) => (
        <instancedMesh
          key={layer}
          ref={jutsuSetters.current[layer]}
          args={[JUTSU_LAYER_GEOMETRY[layer](), undefined, EXPLOSION_INSTANCE_CAPACITY]}
          frustumCulled={false}
          visible={false}
          userData={{ jutsuLayer: layer }}
        >
          <meshBasicMaterial transparent opacity={JUTSU_LAYER_OPACITY[layer]} depthWrite={false} />
        </instancedMesh>
      ))}
    </>
  );
}

const ExplosionFieldMemo = React.memo(ExplosionField);

const SHADOW_BLOB_GEOMETRY = new THREE.CircleGeometry(0.32, 24);
const SHADOW_BLOB_MATERIAL = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.26 });

function ShadowBlob() {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.43, 0]}
      geometry={SHADOW_BLOB_GEOMETRY}
      material={SHADOW_BLOB_MATERIAL}
    />
  );
}

function isTransformationActive(player: PlayerState): boolean {
  return player.ultimateCharge >= 100
    || player.specialState === 'Kurama Mode'
    || player.passiveState === 'Sand Armor Reinforced';
}

function TransformationOverlay({
  player,
  color,
}: {
  player: PlayerState;
  color: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const active = isTransformationActive(player);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 1.4;
    ref.current.position.y = 0.06 + Math.sin(clock.elapsedTime * 3) * 0.02;
  });

  if (!active) return null;

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.41, 0]}>
        <ringGeometry args={[0.56, 0.72, 42]} />
        <meshBasicMaterial color={color} transparent opacity={0.34} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.36, 0]}>
        <ringGeometry args={[0.24, 0.31, 30]} />
        <meshBasicMaterial color="#fff7ed" transparent opacity={0.52} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((index) => {
        const rotation = (Math.PI / 2) * index;
        return (
          <mesh
            key={`transform-spark-${index}`}
            position={[Math.sin(rotation) * 0.44, 0.3, Math.cos(rotation) * 0.44]}
          >
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color={index % 2 === 0 ? color : '#fff7ed'} transparent opacity={0.78} />
          </mesh>
        );
      })}
    </group>
  );
}

function MovementLockOverlay({ player }: { player: PlayerState }) {
  const ref = useRef<THREE.Group>(null);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const active = (player.movementLockMs ?? 0) > 0;
  let color = '#fb923c';
  if (player.movementLockReason === 'lightning') color = '#60a5fa';
  if (player.movementLockReason === 'genjutsu') color = '#ef4444';

  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    ref.current.rotation.y = clock.elapsedTime * 2.2;
  });
  if (!active) return null;

  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.35, 0]}>
        <torusGeometry args={[0.48, 0.045, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((index) => {
        const angle = (index * Math.PI) / 2;
        return (
          <mesh
            key={`movement-lock-${index}`}
            position={[Math.sin(angle) * 0.4, 0.05, Math.cos(angle) * 0.4]}
            rotation={[0, 0, index % 2 === 0 ? 0.18 : -0.18]}
          >
            <coneGeometry args={[0.04, 0.58, 4]} />
            <meshBasicMaterial color={color} transparent opacity={0.68} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// "P1"-style chip in the HUD card's colour, over the fighter's head. A CPU
// slot reads "P2 · CPU" on a square-cornered chip, so who is human shows by
// text and shape, not by colour.
function PlayerTag({ slot, color, cpu }: { slot: number; color: string; cpu: boolean }) {
  const key = playerTagKey(slot, color, cpu);
  const sprite = useMemo(() => PLAYER_TAG_SPRITES.get(key), [key]);

  useEffect(() => {
    PLAYER_TAG_SPRITES.retain(key, sprite);
    return () => PLAYER_TAG_SPRITES.release(key, sprite);
  }, [key, sprite]);

  return (
    <sprite
      position={[0, 0.98, 0]}
      scale={[0.39 * sprite.aspect, 0.39, 1]}
      material={sprite.material}
      renderOrder={10}
    />
  );
}

// Scratch pose shared by every fighter: each one writes and applies it in
// turn inside its own frame callback, so posing allocates nothing.
const CUE_POSE = createPlayerPose();
// Poses pivot on the feet: the body group's origin sits this far above them.
const FEET_Y = -0.55;
// Forward lean while running; it reaches 90% within ~50 ms of the first step.
const RUN_LEAN = 0.1;
const RUN_LEAN_RATE = 45;
const PICKUP_CHIP_HEIGHT = 0.34;
const PICKUP_LABEL_Y = 1.24;

function PlayerMesh({
  player,
  state,
  slot,
  cpu = false,
  pickupChips,
  scarf,
}: {
  player: PlayerState;
  state: GameEngineState;
  slot?: number;
  cpu?: boolean;
  pickupChips?: Map<Power, PlayerTagSprite>;
  /** The scarf the player chose to wear (GameConfig.village.scarf). */
  scarf?: ScarfId;
}) {
  const ref = useRef<THREE.Group>(null);
  // Everything that falls with the fighter; the pickup label stays outside.
  const bodyRef = useRef<THREE.Group>(null);
  // Cue poses (plant, hit, ultimate, fall) pivot on this child group, so the
  // walk bob, turn and shield flicker written to the outer groups never fight
  // them.
  const poseRef = useRef<THREE.Group>(null);
  const pickupRef = useRef<THREE.Sprite>(null);
  const shownPickupRef = useRef(0);
  const runLeanRef = useRef(0);
  // Stable tags for the scene graph (and tests): a new object each render
  // would be re-applied on every tick.
  const marks = useMemo(() => ({
    ring: { playerRing: player.id },
    pickup: { pickupLabel: player.id },
    body: { fighterBody: player.id, castFigure: player.characterId },
    ink: { fighterInk: player.id },
  }), [player.characterId, player.id]);
  const motionId = useMemo(() => playerMotionId(player.id), [player.id]);
  const motion = React.useContext(MotionContext);
  const motionRef = useRef(0);
  const ghost = isPowerUpActive(state, player.id, 'Ghost');
  const invincible = isPowerUpActive(state, player.id, 'Invincibility');
  const visual = FIGHTER_EFFECT_COLORS[player.characterId];
  // The anime figure (scene/cast): one merged body and its ink line, built
  // once per character and shared by every fighter who plays it.
  const figure = castFigureMesh(player.characterId);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const strideRef = useRef({ phase: 0, x: NaN, z: 0 });
  useSmoothWorldPosition(
    ref,
    player.x,
    player.y,
    0.55,
    motionRef,
    playerMotionId(player.id),
    player.facing ? FACING_HEADING[player.facing] : undefined,
  );

  const firstPickupChip = useMemo(
    () => (pickupChips ? pickupChips.values().next().value as PlayerTagSprite | undefined : undefined),
    [pickupChips],
  );

  useFrame(({ clock, size, viewport }, delta) => {
    const group = ref.current;
    const body = bodyRef.current;
    const pose = poseRef.current;
    if (!group || !body || !pose) return;
    setInkViewportHeight(size.height * viewport.dpr);
    const cues = motion?.cues ?? null;
    const now = cues ? cues.clockMs : 0;

    const running = !reducedMotion && player.alive
      && isTrackMoving(motion, motionId);
    runLeanRef.current = THREE.MathUtils.lerp(
      runLeanRef.current,
      running ? RUN_LEAN : 0,
      1 - Math.exp(-delta * RUN_LEAN_RATE),
    );
    samplePlayerCuePose(bodyCueAt(cues, player.id, now), now, player.alive, reducedMotion, CUE_POSE);
    pose.rotation.set(CUE_POSE.lean + runLeanRef.current, CUE_POSE.spin, 0);
    pose.scale.set(CUE_POSE.scaleXZ, CUE_POSE.scaleY, CUE_POSE.scaleXZ);
    pose.position.y = FEET_Y + CUE_POSE.lift;

    const label = pickupRef.current;
    if (label) {
      const pickup = player.alive ? pickupCueAt(cues, player.id, now) : null;
      const chip = pickup ? pickupChips?.get(pickup.power) : undefined;
      if (!pickup || !chip) {
        label.visible = false;
      } else {
        if (shownPickupRef.current !== pickup.seq) {
          label.material = chip.material;
          shownPickupRef.current = pickup.seq;
        }
        const t = Math.min(1, (now - pickup.startMs) / PICKUP_CUE_MS);
        // Rises and pops in; reduced motion holds it still, as long.
        const rise = reducedMotion ? 0.2 : 0.55 * (1 - (1 - t) ** 2);
        const pop = reducedMotion ? 1 : Math.min(1, 0.7 + t * 4);
        label.position.y = PICKUP_LABEL_Y + rise;
        label.scale.set(PICKUP_CHIP_HEIGHT * chip.aspect * pop, PICKUP_CHIP_HEIGHT * pop, 1);
        label.visible = true;
      }
    }

    if (CUE_POSE.hidden) {
      body.visible = false;
      return;
    }
    // A falling fighter holds its pose: no walk bob, no shield flicker.
    if (!player.alive) {
      body.visible = true;
      return;
    }
    if (reducedMotion) {
      group.rotation.z = 0;
      body.visible = true;
      return;
    }

    const movement = motionRef.current;
    // Step on distance travelled, not on the clock, so the cadence follows
    // the character's speed and the bob stops when the feet do.
    const walk = strideRef.current;
    const travelled = Number.isNaN(walk.x)
      ? 0
      : Math.hypot(group.position.x - walk.x, group.position.z - walk.z) / TILE_SIZE;
    walk.x = group.position.x;
    walk.z = group.position.z;
    walk.phase = advanceStride(walk.phase, travelled);
    const stride = Math.sin(walk.phase);
    group.position.y += Math.abs(stride) * 0.038 * movement;
    group.rotation.z = THREE.MathUtils.lerp(
      group.rotation.z,
      stride * 0.035 * movement,
      1 - Math.exp(-delta * 15),
    );

    // Shielded: the body blinks (steady under reduced motion; the shield
    // bubble and rings say it as well).
    if (invincible && !reducedMotion) {
      body.visible = Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.invincibleBlink)) > 0;
    } else {
      body.visible = true;
    }
  });

  // Local Arena rings take the slot colour (red, blue, yellow), like the tag
  // and the HUD card: two orange auras (Deidara vs Naruto) read as one. That
  // includes the wider "ultimate ready" ring, which is up from round start;
  // its extra ring and sparks, not its colour, say the ultimate is ready. The
  // campaign keeps the character's aura.
  const ringColor = slot !== undefined ? playerSlotColor(slot - 1) : visual.aura;

  return (
    <group ref={ref}>
      <group ref={bodyRef}>
        <ShadowBlob />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.39, 0]} userData={marks.ring}>
          <torusGeometry args={[0.42, 0.022, 8, 36]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringColor}
            emissiveIntensity={1.1}
            transparent
            opacity={ghost ? 0.25 : 0.46}
          />
        </mesh>
        <TransformationOverlay player={player} color={ringColor} />
        <MovementLockOverlay player={player} />
        {slot !== undefined && <PlayerTag slot={slot} color={playerSlotColor(slot - 1)} cpu={cpu} />}
        <group ref={poseRef} position={[0, FEET_Y, 0]}>
          <group position={[0, -FEET_Y, 0]}>
            {/* Ghost: see-through, and the ink line goes with the solid look. */}
            <CastFigure
              figure={figure}
              seeThrough={ghost}
              position={[0, FEET_Y, 0]}
              bodyMark={marks.body}
              inkMark={marks.ink}
            />
            {scarf && <VillageScarf scarf={scarf} hidden={ghost} />}
            {invincible && (
              <>
                <mesh position={[0, 0.04, 0]}>
                  <sphereGeometry args={[0.56, 18, 18]} />
                  <meshBasicMaterial color={visual.aura} transparent opacity={0.14} depthWrite={false} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
                  <torusGeometry args={[0.5, 0.03, 8, 36]} />
                  <meshBasicMaterial color={visual.aura} transparent opacity={0.74} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.08, 0]}>
                  <torusGeometry args={[0.42, 0.018, 8, 34]} />
                  <meshBasicMaterial color={visual.accent} transparent opacity={0.5} />
                </mesh>
              </>
            )}
          </group>
        </group>
      </group>
      {firstPickupChip && (
        <sprite
          ref={pickupRef}
          visible={false}
          position={[0, PICKUP_LABEL_Y, 0]}
          material={firstPickupChip.material}
          renderOrder={11}
          userData={marks.pickup}
        />
      )}
    </group>
  );
}

// Nameplates and floor rings: one geometry each and one material per kind,
// shared by every enemy instead of built per mount.
const NAMEPLATE_BACK_GEOMETRY = new THREE.BoxGeometry(0.72, 0.12, 0.025);
const NAMEPLATE_TRACK_GEOMETRY = new THREE.BoxGeometry(0.58, 0.035, 0.02);
const NAMEPLATE_BAR_GEOMETRY = new THREE.BoxGeometry(1, 0.035, 0.018);
const NAMEPLATE_BACK_MATERIAL = new THREE.MeshBasicMaterial({ color: '#0f172a', transparent: true, opacity: 0.72 });
const NAMEPLATE_TRACK_MATERIAL = new THREE.MeshBasicMaterial({ color: '#334155', transparent: true, opacity: 0.78 });
const MONSTER_RING_GEOMETRY = new THREE.TorusGeometry(0.5, 0.022, 6, 36).rotateX(-Math.PI / 2);
const NAMEPLATE_BAR_MATERIALS = new Map<MonsterKind, THREE.MeshBasicMaterial>();
const MONSTER_RING_MATERIALS = new Map<string, THREE.MeshStandardMaterial>();

function nameplateBarMaterial(kind: MonsterKind): THREE.MeshBasicMaterial {
  let material = NAMEPLATE_BAR_MATERIALS.get(kind);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color: MONSTER_VISUALS[kind].glow, transparent: true, opacity: 0.92 });
    NAMEPLATE_BAR_MATERIALS.set(kind, material);
  }
  return material;
}

function monsterRingMaterial(kind: MonsterKind, translucent: boolean): THREE.MeshStandardMaterial {
  const key = `${kind}:${translucent ? 1 : 0}`;
  let material = MONSTER_RING_MATERIALS.get(key);
  if (!material) {
    const { glow } = MONSTER_VISUALS[kind];
    material = new THREE.MeshStandardMaterial({
      color: glow, emissive: glow, emissiveIntensity: 0.9, transparent: true, opacity: translucent ? 0.58 : 0.4,
    });
    MONSTER_RING_MATERIALS.set(key, material);
  }
  return material;
}

function MonsterNameplate({ monster, height = 0.95 }: { monster: MonsterState; height?: number }) {
  let barWidth = 0.36;
  if (monster.kind === 'smart') barWidth = 0.44;
  if (monster.kind === 'fork') barWidth = 0.52;
  return (
    <group position={[0, height, 0]} rotation={[-0.25, 0, 0]}>
      <mesh geometry={NAMEPLATE_BACK_GEOMETRY} material={NAMEPLATE_BACK_MATERIAL} />
      <mesh position={[0, -0.085, 0.005]} geometry={NAMEPLATE_TRACK_GEOMETRY} material={NAMEPLATE_TRACK_MATERIAL} />
      <mesh
        position={[-(0.58 - barWidth) / 2, -0.085, 0.016]}
        scale={[barWidth, 1, 1]}
        geometry={NAMEPLATE_BAR_GEOMETRY}
        material={nameplateBarMaterial(monster.kind)}
      />
      <group position={[0, 0.008, 0.03]}>
        <TextSprite text={monster.name} color="#f8fafc" width={monster.name.length > 16 ? 0.82 : 0.7} />
      </group>
    </group>
  );
}

function MonsterAbilityWarning({
  monster,
  visual,
}: {
  monster: MonsterState;
  visual: typeof MONSTER_VISUALS[MonsterKind];
}) {
  if ((monster.abilityWarningTicks ?? 0) <= 0 || !monster.abilityKind) return null;
  const label = monster.abilityLabel ?? monster.abilityKind;
  return (
    <group position={[0, -0.42, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.52, 0.68, 30]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.72} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[0.28, 0.32, 22]} />
        <meshBasicMaterial color={visual.glow} transparent opacity={0.66} />
      </mesh>
      <group position={[0, 0.95, 0.08]} rotation={[-0.35, 0, 0]}>
        <TextSprite text={label} color="#facc15" width={label.length > 12 ? 0.82 : 0.64} />
      </group>
    </group>
  );
}

// Elites move faster, see 7 cells instead of 5 and strike more often, yet
// drew exactly like the rest. A gold octagon (a shape, not only a colour)
// under a slightly larger body marks them.
const ELITE_BADGE_GEOMETRY = new THREE.RingGeometry(0.54, 0.68, 8, 1).rotateX(-Math.PI / 2);
const ELITE_BADGE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#f59e0b', transparent: true, opacity: 0.9, depthWrite: false,
});

// A mini-boss gate guard also stands on a red diamond (a shape the patrols
// never have) and wears its stage's regalia; see scene/guardLooks.ts.
const GUARD_BADGE_GEOMETRY = new THREE.RingGeometry(0.66, 0.78, 4, 1).rotateX(-Math.PI / 2);
const GUARD_BADGE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#dc2626', transparent: true, opacity: 0.85, depthWrite: false,
});

function MonsterMeshBase({ monster, guardStage }: { monster: MonsterState; guardStage?: StageId }) {
  const ref = useRef<THREE.Group>(null);
  const visual = MONSTER_VISUALS[monster.kind];
  const translucent = monsterIsTranslucent(monster);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const guard = !!guardStage && !translucent;
  useSmoothWorldPosition(ref, monster.x, monster.y, 0.45, undefined, monsterMotionId(monster.id));

  return (
    <group ref={ref} scale={visual.scale * (monster.elite ? 1.12 : 1)}>
      <ShadowBlob />
      {monster.elite && (
        <mesh position={[0, -0.41, 0]} geometry={ELITE_BADGE_GEOMETRY} material={ELITE_BADGE_MATERIAL} />
      )}
      {guard && (
        <mesh position={[0, -0.415, 0]} geometry={GUARD_BADGE_GEOMETRY} material={GUARD_BADGE_MATERIAL} />
      )}
      <MonsterFigure monster={monster} reducedMotion={reducedMotion} guard={guard ? guardStage : undefined} />
      {monster.clone && <WaterCloneSplash />}
      <mesh
        position={[0, -0.39, 0]}
        geometry={MONSTER_RING_GEOMETRY}
        material={monsterRingMaterial(monster.kind, translucent)}
      />
      <MonsterAbilityWarning monster={monster} visual={visual} />
      <MonsterNameplate monster={monster} height={guard ? GUARD_NAMEPLATE_Y : undefined} />
    </group>
  );
}

const MonsterMesh = React.memo(MonsterMeshBase, (previous, next) => (
  previous.guardStage === next.guardStage
  && previous.monster.id === next.monster.id
  && previous.monster.x === next.monster.x
  && previous.monster.y === next.monster.y
  && previous.monster.kind === next.monster.kind
  && previous.monster.archetype === next.monster.archetype
  && previous.monster.clone === next.monster.clone
  && previous.monster.elite === next.monster.elite
  && previous.monster.abilityWarningTicks === next.monster.abilityWarningTicks
  && previous.monster.abilityTarget?.x === next.monster.abilityTarget?.x
  && previous.monster.abilityTarget?.y === next.monster.abilityTarget?.y
));

function SensedEnemyMarker({
  x,
  y,
  label,
  color,
  scale = 1,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  scale?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(x, y);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.32 + Math.sin(clock.elapsedTime * 3.2) * 0.04;
    ref.current.rotation.y = clock.elapsedTime * 0.4;
  });

  return (
    <group ref={ref} position={[wx, 0.32, wz]} scale={scale}>
      <PooledPointLight priority={LIGHT_PRIORITY.marker} color={color} distance={2.6} intensity={0.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <ringGeometry args={[0.24, 0.52, 34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={0.42} />
      </mesh>
      <mesh position={[0, 0.02, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 8, 14]} />
        <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={0.48} transparent opacity={0.38} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.34, 0.02]}>
        <sphereGeometry args={[0.16, 14, 14]} />
        <meshStandardMaterial color="#020617" emissive={color} emissiveIntensity={0.52} transparent opacity={0.42} />
      </mesh>
      <group position={[0, 0.78, 0]}>
        <TextSprite text={label} color="#e0f2fe" width={0.72} />
      </group>
    </group>
  );
}

const BOSS_FLOAT_Y = 0.92;
const BOSS_LIGHT_INTENSITY = 1.25;
// Above and in front of the beast: a light inside it burned a hot spot through its cel bands.
const BOSS_LIGHT_POSITION: [number, number, number] = [0, 1.25, 0.7];
const BOSS_RING_OPACITY = 0.38;
// One boss at a time: scratch for its per-frame screen box.
const BOSS_SCREEN_BOX = createScreenBox();

/**
 * Milliseconds into the boss's entrance, smoothed between engine ticks on the
 * simulation clock (which runs while the intro freezes the arena); null when
 * no intro is playing.
 */
function bossIntroMs(
  live: GameEngineState | null,
  countdown: ReturnType<typeof createCountdown>,
  motion: MotionStore | null,
): number | null {
  const remaining = live?.boss ? live.bossIntroMsRemaining ?? 0 : 0;
  if (remaining <= 0) return null;
  const smoothed = motion ? countdownNow(countdown, remaining, motion.simTimeMs) : remaining;
  return BOSS_INTRO_MS - smoothed;
}

/** Cell (x, y), `height` above the floor, drawn behind the boss's screen box. */
function behindBoss(camera: THREE.Camera, x: number, y: number, height: number): boolean {
  return behindScreenBox(
    BOSS_SCREEN_BOX,
    camera,
    (x + MAP_OFFSET_X) * TILE_SIZE,
    height,
    (y + MAP_OFFSET_Z) * TILE_SIZE,
  );
}

/**
 * Something the boss must not hide: a player (feet or head), a boss strike,
 * a flame, a bomb, or an enemy's warned cell, drawn inside the boss's screen
 * box and further from the camera than it. Runs every frame over a handful
 * of points, projecting into module scratch vectors.
 */
function bossHidesSomething(
  live: GameEngineState,
  motion: MotionStore | null,
  camera: THREE.Camera,
): boolean {
  for (let index = 0; index < live.players.length; index += 1) {
    const player = live.players[index];
    if (player.alive) {
      const track = motion?.tracks.get(playerMotionId(player.id));
      const drawn = track && motion ? sampleTrack(track, motion.simTimeMs) : player;
      if (behindBoss(camera, drawn.x, drawn.y, 0.1) || behindBoss(camera, drawn.x, drawn.y, 1.3)) {
        return true;
      }
    }
  }
  for (let index = 0; index < live.hazards.length; index += 1) {
    if (behindBoss(camera, live.hazards[index].x, live.hazards[index].y, 0.05)) return true;
  }
  for (let index = 0; index < live.bombs.length; index += 1) {
    if (behindBoss(camera, live.bombs[index].x, live.bombs[index].y, 0.05)) return true;
  }
  for (let index = 0; index < live.explosions.length; index += 1) {
    if (behindBoss(camera, live.explosions[index].x, live.explosions[index].y, 0.05)) return true;
  }
  for (let index = 0; index < live.monsters.length; index += 1) {
    const target = live.monsters[index].abilityTarget;
    if (target && behindBoss(camera, target.x, target.y, 0.05)) return true;
  }
  return false;
}

/**
 * The boss: its creature figure (scene/BossFigure) floating over its cell,
 * plus how it enters, changes phase and falls (scene/bossPresentation). It
 * always faces the camera, so its glowing face reads and its tails stay
 * behind it, and it turns see-through while it would hide a player or a
 * telegraph. Sealed, it stays drawn while it collapses and dissolves through
 * the boss-seal hold, then disappears.
 */
function BossMesh({ state }: { state: GameEngineState }) {
  const { boss } = state;
  const ref = useRef<THREE.Group>(null);
  const poseRef = useRef<THREE.Group>(null);
  const figureRef = useRef<BossFigureHandle>(null);
  const lightRef = useRef<PooledLightHandle>(null);
  const ringRef = useRef<THREE.MeshStandardMaterial>(null);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const motion = React.useContext(MotionContext);
  const readState = React.useContext(LiveStateContext);
  const camera = useThree((three) => three.camera);
  const trackRef = useRef({
    swayTime: 0,
    bobTime: 0,
    phase: boss?.phase ?? 1,
    phaseAt: null as number | null,
    sealedAt: null as number | null,
    seeThrough: 0,
    intro: createCountdown(),
  });
  const pose = useRef<BossFigurePose>({
    swayTime: 0, swayAmount: 1, flare: 0, droop: 0, enrage: 0, seeThrough: 0, dissolve: 0,
  });
  // Written in place each frame.
  const cueRef = useRef(phaseCue(1, null, false));
  const sealRef = useRef(sealPose(0, false));
  // Always faces the camera ('down'): its face is its weak point.
  useSmoothWorldPosition(ref, boss?.x ?? 0, boss?.y ?? 0, BOSS_FLOAT_Y, undefined, BOSS_MOTION_ID, FACING_HEADING.down);

  useFrame(({ clock }, delta) => {
    const group = ref.current;
    const inner = poseRef.current;
    if (!group || !inner || !boss) return;
    const track = trackRef.current;
    const now = clock.elapsedTime * 1000;
    const live = readState() ?? state;
    // A phase change starts its cue; a boss mounted already in phase 2 shows it fully.
    if (boss.phase !== track.phase) {
      track.phaseAt = boss.phase > track.phase ? now : null;
      track.phase = boss.phase;
    }
    const cue = phaseCue(
      boss.phase,
      track.phaseAt === null ? null : now - track.phaseAt,
      reducedMotion,
      cueRef.current,
    );
    if (boss.health <= 0) {
      if (track.sealedAt === null) track.sealedAt = now;
    } else {
      track.sealedAt = null;
    }
    const seal = track.sealedAt === null
      ? null
      : sealPose(now - track.sealedAt, reducedMotion, sealRef.current);
    const introMs = bossIntroMs(live, track.intro, motion);
    const roar = introMs === null ? 0 : roarAmount(introMs, reducedMotion);
    // The hit-stop beat and the seal hold the figure still.
    const still = cue.hold || seal !== null;
    if (!still) {
      track.swayTime += delta;
      track.bobTime += delta;
    }
    group.position.y = BOSS_FLOAT_Y + (reducedMotion ? 0 : Math.sin(track.bobTime * 2.2) * 0.05);
    group.rotation.z = reducedMotion ? 0 : Math.sin(track.bobTime * 1.8) * 0.025;

    const size = 1 + 0.08 * cue.swell + 0.1 * roar;
    inner.scale.set(size, size * (seal?.squash ?? 1), size);
    inner.position.y = -(seal?.sink ?? 0);
    // Rears back on the roar, topples forward as it falls.
    inner.rotation.x = (seal?.tilt ?? 0) - 0.2 * roar;
    inner.visible = !seal?.gone;

    let hides = false;
    if (!seal) {
      inner.updateWorldMatrix(true, false);
      bossScreenBox(inner.matrixWorld, camera, BOSS_SCREEN_BOX);
      hides = bossHidesSomething(live, motion, camera);
    }
    const want = hides ? 1 : 0;
    track.seeThrough = reducedMotion
      ? want
      : THREE.MathUtils.lerp(track.seeThrough, want, 1 - Math.exp(-delta * SEE_THROUGH_RATE));
    if (Math.abs(track.seeThrough - want) < 0.01) track.seeThrough = want;

    const next = pose.current;
    next.swayTime = track.swayTime;
    next.swayAmount = reducedMotion || seal ? 0 : 1;
    next.flare = roar;
    next.droop = seal?.droop ?? 0;
    next.enrage = cue.enrage;
    next.seeThrough = track.seeThrough;
    next.dissolve = seal?.dissolve ?? 0;
    figureRef.current?.apply(next);
    const fade = 1 - next.dissolve;
    if (lightRef.current) lightRef.current.intensity = BOSS_LIGHT_INTENSITY * fade;
    if (ringRef.current) ringRef.current.opacity = BOSS_RING_OPACITY * fade;
  });

  if (!boss) return null;

  const visual = BOSS_VISUALS[boss.id];

  return (
    <group ref={ref} scale={visual.scale}>
      <PooledPointLight ref={lightRef} priority={LIGHT_PRIORITY.player} color={visual.glow} distance={5.2} intensity={BOSS_LIGHT_INTENSITY} position={BOSS_LIGHT_POSITION} />
      {boss.health > 0 && <ShadowBlob />}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]}>
        <torusGeometry args={[0.62, 0.025, 8, 42]} />
        <meshStandardMaterial ref={ringRef} color={visual.glow} emissive={visual.glow} emissiveIntensity={1.05} transparent opacity={BOSS_RING_OPACITY} />
      </mesh>
      <group ref={poseRef}>
        <BossFigure ref={figureRef} bossId={boss.id} />
      </group>
      {boss.phase > 1 && boss.health > 0 && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
            <ringGeometry args={[0.68, 0.86, 36]} />
            <meshStandardMaterial color={visual.glow} emissive={visual.glow} emissiveIntensity={0.9} transparent opacity={0.22} />
          </mesh>
          <group position={[0, 1.08, 0]}>
            <TextSprite text={`Phase ${boss.phase}`} color="#fff7ed" width={0.88} />
          </group>
        </>
      )}
    </group>
  );
}

// Telegraph marks. An enemy's targeted cell is usually the cell a player
// stands on, so a floor mark alone hides under that player: a red pin hovers
// above the cell and a square closes on it, meeting the cell edge when the
// hit lands. Boss strikes close their family's floor shape instead (see
// scene/HazardTelegraphs), so the square keeps meaning "this cell".
const WARNING_PIN_GEOMETRY = new THREE.ConeGeometry(0.2, 0.46, 4).rotateX(Math.PI);
const WARNING_CLOSE_GEOMETRY = new THREE.RingGeometry(0.6, 0.68, 4, 1)
  .rotateZ(Math.PI / 4)
  .rotateX(-Math.PI / 2);
const WARNING_MARK_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#dc2626', transparent: true, opacity: 0.95, depthWrite: false,
});

function HazardMesh({ hazard }: { hazard: BossHazard }) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(hazard.x, hazard.y);
  const active = hazardIsActive(hazard);
  const visual = HAZARD_VISUALS[hazard.kind];
  const beastColored = hazard.kind === 'beastBomb' || hazard.kind === 'chakraShockwave';
  const effectColor = beastColored ? hazard.color : visual.color;
  const effectAccent = beastColored ? '#fff7ed' : visual.accent;
  const reducedMotion = React.useContext(ReducedMotionContext);
  // An enemy's kunai, sand spikes or lightning strike (scene/jutsu) stand
  // still: a thrown kunai or a bolt does not spin.
  const enemyJutsu = enemyJutsuFor(hazard);
  // The floor shape that says which family this is, and when it can kill,
  // is drawn by HazardTelegraphs; this draws the effect above it.

  useFrame(({ clock }) => {
    if (ref.current) {
      let scale = 1;
      if (!reducedMotion && active) scale = 1.15;
      if (!reducedMotion && !active) scale = 0.85 + Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.hazardPulse)) * 0.08;
      ref.current.rotation.y = reducedMotion || enemyJutsu ? 0 : clock.elapsedTime * (active ? 2.6 : 1.5);
      ref.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={ref} position={[wx, 0.06, wz]}>
      {visual.effect === 'sand' && (
        <>
          <mesh position={[0, 0.28, 0]} rotation={[0, 0, 0.18]}>
            <coneGeometry args={[0.18, active ? 0.92 : 0.52, 9]} />
            <meshStandardMaterial color="#d6a45d" emissive="#f59e0b" emissiveIntensity={0.38} transparent opacity={active ? 0.58 : 0.34} />
          </mesh>
          {[0.16, 0.36].map((height) => (
            <mesh key={`sand-ring-${hazard.id}-${height}`} position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.2 + height * 0.42, 0.018, 7, 28]} />
              <meshStandardMaterial color={visual.accent} emissive={effectColor} emissiveIntensity={0.45} transparent opacity={0.5} />
            </mesh>
          ))}
        </>
      )}

      {visual.effect === 'spikes' && <SandSpikes active={active} />}

      {visual.effect === 'fire' && [-0.22, 0, 0.22].map((offset) => (
        <mesh key={`blue-fire-${hazard.id}-${offset}`} position={[offset, active ? 0.28 : 0.12, 0]} rotation={[0.18, offset * 2, offset > 0 ? -0.18 : 0.18]}>
          <coneGeometry args={[0.08, active ? 0.72 : 0.38, 8]} />
          <meshStandardMaterial color={offset === 0 ? '#dbeafe' : visual.color} emissive={visual.color} emissiveIntensity={active ? 1 : 0.45} transparent opacity={active ? 0.72 : 0.45} />
        </mesh>
      ))}

      {visual.effect === 'water' && (
        <>
          <mesh position={[0, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.075, 0.12, active ? 0.92 : 0.48, 12]} />
            <meshStandardMaterial color={visual.color} emissive={visual.color} emissiveIntensity={0.62} transparent opacity={0.58} />
          </mesh>
          <mesh position={[0.33, 0.2, 0]}>
            <sphereGeometry args={[0.12, 14, 14]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.color} emissiveIntensity={0.64} transparent opacity={0.52} />
          </mesh>
        </>
      )}

      {visual.effect === 'lava' && (
        <>
          <mesh position={[0, active ? 0.34 : 0.12, 0]}>
            <coneGeometry args={[active ? 0.22 : 0.12, active ? 0.78 : 0.34, 8]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.color} emissiveIntensity={active ? 0.9 : 0.4} transparent opacity={0.78} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.32, 0.035, 8, 28]} />
            <meshStandardMaterial color="#7f1d1d" emissive={visual.accent} emissiveIntensity={0.58} transparent opacity={0.58} />
          </mesh>
        </>
      )}

      {visual.effect === 'steam' && [0.12, 0.3, 0.48].map((height) => (
        <mesh key={`steam-${hazard.id}-${height}`} position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.18 + height * 0.45, 0.02, 8, 30]} />
          <meshStandardMaterial color="#f8fafc" emissive={visual.accent} emissiveIntensity={0.56} transparent opacity={active ? 0.5 : 0.28} />
        </mesh>
      ))}

      {visual.effect === 'acid' && [-0.18, 0.08, 0.25].map((offset, index) => (
        <mesh key={`acid-${hazard.id}-${offset}`} position={[offset, 0.14 + index * 0.08, index % 2 ? -0.12 : 0.12]}>
          <sphereGeometry args={[active ? 0.12 : 0.08, 14, 14]} />
          <meshStandardMaterial color={visual.color} emissive={visual.color} emissiveIntensity={0.78} transparent opacity={0.55} />
        </mesh>
      ))}

      {enemyJutsu === 'lightning' && <LightningStrike active={active} />}
      {visual.effect === 'air' && (
        <>
          {enemyJutsu !== 'lightning' && (
            <mesh position={[0, 0.56, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.16, active ? 1.12 : 0.58, 7]} />
              <meshStandardMaterial color={visual.accent} emissive={visual.color} emissiveIntensity={0.68} transparent opacity={active ? 0.5 : 0.26} />
            </mesh>
          )}
          <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.28, 0.018, 8, 28]} />
            <meshStandardMaterial color={visual.color} emissive={visual.color} emissiveIntensity={0.7} transparent opacity={0.44} />
          </mesh>
        </>
      )}

      {visual.effect === 'tentacle' && [-0.16, 0.16].map((offset) => (
        <mesh key={`tentacle-${hazard.id}-${offset}`} position={[offset, 0.18, 0]} rotation={[Math.PI / 2, 0, offset > 0 ? -0.35 : 0.35]}>
          <capsuleGeometry args={[0.06, active ? 0.82 : 0.42, 5, 8]} />
          <meshStandardMaterial color="#4c1d95" emissive={visual.color} emissiveIntensity={0.46} />
        </mesh>
      ))}

      {visual.effect === 'bomb' && (
        <>
          <mesh position={[0, active ? 0.34 : 0.2, 0]}>
            <sphereGeometry args={[active ? 0.24 : 0.15, 18, 18]} />
            <meshStandardMaterial color="#1e1b4b" emissive={effectColor} emissiveIntensity={active ? 1 : 0.52} transparent opacity={0.82} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.36, 0.026, 8, 34]} />
            <meshStandardMaterial color={effectAccent} emissive={effectAccent} emissiveIntensity={0.7} transparent opacity={0.46} />
          </mesh>
        </>
      )}

      {enemyJutsu === 'kunai' && <KunaiStrike active={active} />}
      {visual.effect === 'shockwave' && [0.26, 0.42].map((radius) => (
        <mesh key={`shock-${hazard.id}-${radius}`} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.022, 8, 34]} />
          <meshStandardMaterial color={effectColor} emissive={effectColor} emissiveIntensity={0.82} transparent opacity={active ? 0.54 : 0.28} />
        </mesh>
      ))}
    </group>
  );
}

function PowerUpMesh({
  x,
  y,
  power,
  characterId,
}: {
  x: number;
  y: number;
  power: Power;
  characterId?: CharacterId;
}) {
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(x, y);
  return (
    <group position={[wx, 0, wz]}>
      <PickupFigure
        power={power}
        characterId={characterId}
        reducedMotion={reducedMotion}
        phase={pickupPhase(x, y)}
      />
    </group>
  );
}

function MissionRescueMarker({ target }: { target: CampaignRescueTargetState }) {
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(target.x, target.y);
  const { rescued } = target;
  const state = rescued ? 'safe' : 'waiting';
  const label = rescued ? 'Safe' : target.label;

  return (
    <group position={[wx, 0, wz]}>
      <PooledPointLight
        priority={LIGHT_PRIORITY.marker}
        color={rescued ? '#86efac' : '#f97316'}
        distance={2.2}
        intensity={rescued ? 0.55 : 1.05}
        position={[0, 0.8, 0]}
      />
      <ObjectiveFigure
        model={rescueModel(state)}
        ring={state}
        kind="rescue"
        variant={state}
        motion={rescued ? 'none' : 'villager'}
        phase={target.x + target.y}
        reducedMotion={reducedMotion}
      />
      <group position={[0, 1.3, 0]}>
        <TextSprite text={label} color={rescued ? '#bbf7d0' : '#fff7ed'} width={0.82} />
      </group>
    </group>
  );
}

function MissionDefenseMarker({ objective }: { objective: CampaignObjectiveState }) {
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(objective.x ?? 0, objective.y ?? 0);
  const active = objective.status === 'active';
  const damage = structureDamageFor(objective.structureHp, objective.structureMaxHp, objective.status);
  const flag = structureFlagFor(objective.status);
  let ring: 'locked' | 'alert' | 'safe' | 'danger' = 'locked';
  if (active) ring = damage === 'critical' ? 'danger' : 'alert';
  if (objective.status === 'complete') ring = 'safe';
  if (damage === 'ruined') ring = 'danger';
  let lightColor = '#94a3b8';
  if (active) lightColor = '#facc15';
  if (objective.status === 'complete') lightColor = '#22c55e';
  const label = objective.structureLabel ?? objective.label;

  return (
    <group position={[wx, 0, wz]}>
      <PooledPointLight
        priority={LIGHT_PRIORITY.marker}
        color={lightColor}
        distance={2.8}
        intensity={active ? 1.1 : 0.45}
        position={[0, 0.7, 0]}
      />
      <ObjectiveFigure
        model={structureModel(damage, flag)}
        ring={ring}
        kind="structure"
        variant={damage}
        reducedMotion={reducedMotion}
      />
      <group position={[0, 1.3, 0]}>
        <TextSprite text={label} color="#fff7ed" width={0.86} />
      </group>
    </group>
  );
}

function MissionMiniBossMarker({ objective }: { objective: CampaignObjectiveState }) {
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(objective.x ?? 0, objective.y ?? 0);
  const active = objective.status === 'active';
  const complete = objective.status === 'complete';
  const gate = gateStateFor(objective.status);
  let ring: 'locked' | 'danger' | 'safe' = 'locked';
  if (active) ring = 'danger';
  if (complete) ring = 'safe';
  const label = complete ? 'Gate Open' : objective.miniBossLabel ?? objective.label;

  return (
    <group position={[wx, 0, wz]}>
      <PooledPointLight
        priority={LIGHT_PRIORITY.marker}
        color={complete ? '#22c55e' : '#ef4444'}
        distance={2.4}
        intensity={active ? 1.1 : 0.45}
        position={[0, 0.8, 0]}
      />
      <ObjectiveFigure
        model={gateModel(gate)}
        ring={ring}
        kind="gate"
        variant={gate}
        reducedMotion={reducedMotion}
      />
      <group position={[0, 1.32, 0]}>
        <TextSprite text={label} color="#fff7ed" width={0.78} />
      </group>
    </group>
  );
}

function MissionBossArenaMarker({
  campaign,
  bossName,
  visibleCells,
}: {
  campaign: NonNullable<GameEngineState['campaign']>;
  bossName?: string;
  visibleCells: Set<string>;
}) {
  const reducedMotion = React.useContext(ReducedMotionContext);
  const { bossArena } = campaign;
  const [wx, , wz] = toWorld(bossArena.x, bossArena.y);
  const active = bossArena.unlocked;
  const visible = cellVisibleInSet(visibleCells, bossArena.x, bossArena.y);
  let label = campaign.bossGateLabel;
  if (active) {
    label = bossName ? `${bossName} Arena` : bossArena.label;
  }

  if (!visible) return null;

  const state = active ? 'open' : 'sealed';
  return (
    <group position={[wx, 0, wz]}>
      <PooledPointLight
        priority={LIGHT_PRIORITY.marker}
        color={active ? '#fb923c' : '#94a3b8'}
        distance={3.2}
        intensity={active ? 1.2 : 0.42}
        position={[0, 0.5, 0]}
      />
      <ObjectiveFigure
        model={arenaModel(state)}
        ring={active ? 'waiting' : 'locked'}
        kind="arena"
        variant={state}
        motion={active ? 'arena' : 'none'}
        reducedMotion={reducedMotion}
        arenaRing
      />
      <group position={[0, 0.82, 0]}>
        <TextSprite text={label} color="#fff7ed" width={0.9} />
      </group>
    </group>
  );
}

function MissionObjectiveMarkers({
  state,
  visibleCells,
}: {
  state: GameEngineState;
  visibleCells: Set<string>;
}) {
  if (!state.campaign) return null;

  return (
    <>
      {state.campaign.objectives.flatMap((objective) => {
        if (objective.kind === 'rescue') {
          return (objective.targets ?? [])
            .filter((target) => cellVisibleInSet(visibleCells, target.x, target.y))
            .map((target) => (
              <MissionRescueMarker key={target.id} target={target} />
            ));
        }
        if (
          objective.kind === 'miniBoss'
          && typeof objective.x === 'number'
          && typeof objective.y === 'number'
          && cellVisibleInSet(visibleCells, objective.x, objective.y)
        ) {
          return [(
            <MissionMiniBossMarker key={objective.id} objective={objective} />
          )];
        }
        if (
          objective.kind === 'defense'
          && typeof objective.x === 'number'
          && typeof objective.y === 'number'
          && cellVisibleInSet(visibleCells, objective.x, objective.y)
        ) {
          return [(
            <MissionDefenseMarker key={objective.id} objective={objective} />
          )];
        }
        return [];
      })}
      <MissionBossArenaMarker
        campaign={state.campaign}
        bossName={state.boss?.name}
        visibleCells={visibleCells}
      />
    </>
  );
}

function FlyingThunderMarker({ x, y }: { x: number; y: number }) {
  const [wx, , wz] = toWorld(x, y);
  return (
    <group position={[wx, 0.055, wz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.34, 24]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#f59e0b"
          emissiveIntensity={0.8}
          transparent
          opacity={0.82}
        />
      </mesh>
      <group position={[0, 0.36, 0]}>
        <HiraishinKunai lean={0.28} />
      </group>
      <PooledPointLight priority={LIGHT_PRIORITY.pickup} color="#facc15" distance={2.2} intensity={0.5} />
    </group>
  );
}

type MapTilesProps = {
  map: GameMap;
  bombs: GameEngineState['bombs'];
  destroyedBoxes: GameEngineState['destroyedBoxes'];
  palette: StageDefinition['palette'];
  fogOfWar: GameEngineState['fogOfWar'];
  features: StaticTileFeatures;
  powerTheme?: CharacterId;
  /** The village square's blast stop: Naruto's clones never form inside it. */
  blastStop?: (x: number, y: number) => boolean;
};

// Per-cell objects re-render only when their own props change: a bomb placed
// next to them rebuilds the cell list, not every bomb and pickup on the map.
const BombMeshMemo = React.memo(BombMesh);
const PowerUpMeshMemo = React.memo(PowerUpMesh);
const SensedWallMarkerMemo = React.memo(SensedWallMarker);
const StaticTilesMemo = React.memo(StaticTiles);

function sameBombCells(
  prev: GameEngineState['bombs'],
  next: GameEngineState['bombs']
): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((bomb, index) => {
    const nextBomb = next[index];
    return bomb.id === nextBomb.id
      && bomb.x === nextBomb.x
      && bomb.y === nextBomb.y
      && bomb.kind === nextBomb.kind;
  });
}

function sameTimedCells(
  prev: { x: number; y: number; kind?: string }[],
  next: { x: number; y: number; kind?: string }[]
): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((cell, index) => {
    const nextCell = next[index];
    return cell.x === nextCell.x
      && cell.y === nextCell.y
      && cell.kind === nextCell.kind;
  });
}

function sameCellKeys(prev: string[] = [], next: string[] = []): boolean {
  if (prev === next) return true;
  return prev.length === next.length
    && prev.every((cell, index) => cell === next[index]);
}

function sameFogCells(
  prev: GameEngineState['fogOfWar'],
  next: GameEngineState['fogOfWar']
): boolean {
  return sameCellKeys(prev.visible, next.visible)
    && sameCellKeys(prev.explored, next.explored)
    && sameCellKeys(prev.sensedEnemies, next.sensedEnemies)
    && sameCellKeys(prev.sensedWalls, next.sensedWalls);
}

function MapTilesBase({
  map,
  bombs,
  destroyedBoxes,
  palette,
  fogOfWar,
  features,
  powerTheme,
  blastStop,
}: MapTilesProps) {
  // Keyed on positions, not the array: a crate's break timer ticks every frame,
  // and rebuilding all eight instanced tile layers for that is wasted work.
  const destroyedKey = destroyedBoxes.map((b) => `${b.x},${b.y}`).join('|');
  const destroyedSet = useMemo(
    () => new Set(destroyedKey ? destroyedKey.split('|') : []),
    [destroyedKey],
  );
  const bombByCell = useMemo(
    () => new Map(bombs.map((bomb) => [`${bomb.x},${bomb.y}`, bomb])),
    [bombs],
  );
  const visibleCellSet = useMemo(
    () => new Set(fogOfWar.visible ?? []),
    [fogOfWar.visible],
  );
  const exploredCellSet = useMemo(
    () => new Set(fogOfWar.explored ?? []),
    [fogOfWar.explored],
  );

  // Walls, crates and ground are instanced in StaticTiles; only animated
  // per-cell objects stay as their own React elements. Those draw only on
  // visible cells (power-ups, bombs) or sensed hidden ones (Gaara's walls),
  // so walk those short lists instead of every cell of a 50x50 map.
  const cellObjects: React.ReactElement[] = [];
  (fogOfWar.sensedWalls ?? []).forEach((key) => {
    if (visibleCellSet.has(key) || exploredCellSet.has(key)) return;
    const [x, y] = key.split(',').map(Number);
    const cell = map[y]?.[x];
    if (cell === 'Wall' || cell === 'Box' || (cell !== undefined && isObstacle(cell))) {
      cellObjects.push(<SensedWallMarkerMemo key={`sensed-wall-${x}-${y}`} x={x} y={y} />);
    }
  });
  visibleCellSet.forEach((key) => {
    const [x, y] = key.split(',').map(Number);
    const cell = map[y]?.[x];
    if (cell === undefined) return;
    if (isPower(cell)) {
      cellObjects.push(
        <PowerUpMeshMemo key={`power-${x}-${y}`} x={x} y={y} power={cell} characterId={powerTheme} />
      );
    } else if (isBomb(cell)) {
      const bomb = bombByCell.get(`${x},${y}`);
      const cloneOffsets = bomb?.kind === 'shadowCloneBarrage'
        ? getShadowCloneFormationCells(bomb, map)
          .filter((point) => !blastStop?.(point.x, point.y))
          .map((point) => ({
            x: point.x - bomb.x,
            y: point.y - bomb.y,
          }))
        : [];
      cellObjects.push(
        <BombMeshMemo
          key={bomb?.id ?? `bomb-${x}-${y}`}
          x={x}
          y={y}
          kind={bomb?.kind ?? 'standard'}
          cloneOffsets={cloneOffsets}
        />
      );
    }
  });

  return (
    <>
      <StaticTilesMemo
        map={map}
        palette={palette}
        visibleCells={visibleCellSet}
        exploredCells={exploredCellSet}
        destroyedCells={destroyedSet}
        features={features}
      />
      {cellObjects}
    </>
  );
}

const MapTiles = React.memo(MapTilesBase, (prev, next) => (
  prev.map === next.map
  && prev.palette === next.palette
  && sameBombCells(prev.bombs, next.bombs)
  && sameTimedCells(prev.destroyedBoxes, next.destroyedBoxes)
  && sameFogCells(prev.fogOfWar, next.fogOfWar)
  && prev.features === next.features
  && prev.powerTheme === next.powerTheme
  && prev.blastStop === next.blastStop
));

const HazardMeshMemo = React.memo(HazardMesh);

// Hazards change every tick they exist (their warning closes on the engine's
// timer), so they render apart from the tiles and cell objects.
function HazardLayerBase({
  hazards,
  visibleCells,
}: {
  hazards: GameEngineState['hazards'];
  visibleCells: Set<string>;
}) {
  return (
    <>
      {hazards
        .filter((hazard) => cellVisibleInSet(visibleCells, hazard.x, hazard.y))
        .map((hazard) => <HazardMeshMemo key={hazard.id} hazard={hazard} />)}
    </>
  );
}

const HazardLayer = React.memo(HazardLayerBase);

function CameraRig({
  state,
  preferences,
  impact,
}: {
  state: GameEngineState;
  preferences: GamePreferences;
  impact: number;
}) {
  const { camera, size } = useThree();
  const motion = React.useContext(MotionContext);
  const readState = React.useContext(LiveStateContext);
  const lookAtRef = useRef(new THREE.Vector3());
  const lookTargetRef = useRef(new THREE.Vector3());
  const framingRef = useRef<number | null>(null);
  const shakeRef = useRef(0);
  // The touch controls and the safe area widen the HUD bands.
  const device = useHudDevice();
  const shakeStartRef = useRef(0);
  // The boss's entrance steers the camera: its smoothed clock, and when it
  // last did (the camera then catches up with the players quickly).
  const introRef = useRef({
    countdown: createCountdown(), lastMs: -Infinity, cut: false, onBoss: false,
  });
  // The HUD bands for this layout, and how far out this screen's shape
  // needs to zoom for the widest spread players can reach. The HUD is laid
  // out on the viewport; the canvas sits inside the arena frame.
  const frame = useMemo(() => {
    const insets = canvasHudInsets(
      preferences.hudScale,
      size.width,
      size.height,
      ARENA_FRAME_PX,
      device
    );
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
    return { insets, aspect, maxFraming: maxFramingFor(aspect, insets) };
  }, [preferences.hudScale, size.width, size.height, device]);

  useFrame(({ clock }, delta) => {
    const fallbackCenter = getMapWorldCenter(
      state.map[0]?.length ?? 15,
      state.map.length || 10,
    );
    let targetXCell = 0;
    let targetYCell = 0;
    let count = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    // Frame the drawn (interpolated) players, not their raw 0.1-cell steps.
    const framed = state.players.map((player) => ({
      alive: player.alive,
      ...samplePosition(motion, playerMotionId(player.id), player.x, player.y),
    }));
    framed.forEach((player) => {
      if (!player.alive) return;
      minX = Math.min(minX, player.x);
      maxX = Math.max(maxX, player.x);
      minY = Math.min(minY, player.y);
      maxY = Math.max(maxY, player.y);
      count += 1;
    });

    if (count === 0) {
      framed.forEach((player) => {
        minX = Math.min(minX, player.x);
        maxX = Math.max(maxX, player.x);
        minY = Math.min(minY, player.y);
        maxY = Math.max(maxY, player.y);
        count += 1;
      });
    }

    if (count > 0) {
      // Centre the players' bounding box, not their mean: with three players
      // the mean sits by the pair and pushes the third toward the edge.
      targetXCell = (minX + maxX) / 2;
      targetYCell = (minY + maxY) / 2;
    } else {
      targetXCell = fallbackCenter[0] - MAP_OFFSET_X;
      targetYCell = fallbackCenter[2] - MAP_OFFSET_Z;
    }

    const [targetX, , targetZ] = toWorld(targetXCell, targetYCell);
    const halfWidth = count > 1 ? (maxX - minX) / 2 : 0;
    const halfDepth = count > 1 ? (maxY - minY) / 2 : 0;
    const { insets, aspect, maxFraming } = frame;
    let framingScale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
    // Aim a little off the box centre when its edge would sit under a HUD band.
    const shiftZ = groupShift(framingScale, halfWidth, halfDepth, insets) * TILE_SIZE;
    let aimX = targetX;
    let aimZ = targetZ + shiftZ;
    // The boss's entrance: go to it, push in, and come back to the players
    // before the arena unfreezes. A nearby boss is glided to; a far one is
    // cut to and from, since sweeping the camera across the board would
    // stream the grid's lines past every pixel (a flicker); reduced motion
    // always cuts.
    const live = readState();
    const intro = introRef.current;
    const nowMs = clock.elapsedTime * 1000;
    const introMs = bossIntroMs(live, intro.countdown, motion);
    let followRate: number | null = null;
    let snap = false;
    if (introMs !== null && live?.boss) {
      const bossAt = samplePosition(motion, BOSS_MOTION_ID, live.boss.x, live.boss.y);
      const cut = preferences.reducedMotion || introCuts(bossAt, targetXCell, targetYCell);
      const weight = introCameraWeight(introMs, cut);
      const [bossX, , bossZ] = toWorld(bossAt.x, bossAt.y);
      aimX = THREE.MathUtils.lerp(aimX, bossX, weight);
      aimZ = THREE.MathUtils.lerp(aimZ, bossZ + INTRO_AIM_TOWARD_CAMERA, weight);
      framingScale = THREE.MathUtils.lerp(
        framingScale,
        introFraming(introMs, preferences.reducedMotion),
        weight,
      );
      intro.lastMs = nowMs;
      intro.cut = cut;
      snap = cut && (weight === 0 || !intro.onBoss);
      intro.onBoss = weight > 0;
      followRate = INTRO_FOLLOW_RATE;
    } else if (intro.onBoss) {
      // The entrance ended (or was skipped) with the camera on the boss.
      snap = intro.cut;
      intro.onBoss = false;
    } else if (nowMs - intro.lastMs < INTRO_CATCH_UP_MS) {
      followRate = INTRO_FOLLOW_RATE;
    }
    // `impact` holds for a moment and then drops to 0; fade out from it
    // instead of cutting off mid-swing.
    const shakeBefore = shakeRef.current;
    shakeRef.current = preferences.reducedMotion ? 0 : decayShake(shakeRef.current, impact, delta);
    // A jolt out of a still view starts its swing from the centre.
    if (shakeBefore === 0 && shakeRef.current > 0) shakeStartRef.current = clock.elapsedTime;
    const shakeStrength = shakeRef.current * (preferences.screenShake / 100) * 0.18;
    // One slow beat on both axes (PULSE_HZ.cameraShake): the old 13 Hz
    // shake flickered every high-contrast edge on screen.
    const shakePhase = (clock.elapsedTime - shakeStartRef.current) * pulseRate(PULSE_HZ.cameraShake);
    const shakeX = Math.sin(shakePhase) * shakeStrength;
    const shakeZ = Math.sin(shakePhase) * shakeStrength * 0.6;

    // Smooth one follow point and hang the camera off it, so position and aim
    // move together. Aiming at the raw target while easing only the position
    // turned every 0.1-cell step into a ~7 px whole-screen jump.
    const lookAt = lookAtRef.current;
    const lookTarget = lookTargetRef.current.set(aimX, 0, aimZ);
    if (framingRef.current === null) {
      // Start from wherever the camera is aimed so the opening glide is kept.
      framingRef.current = camera.position.y / 13.2;
      lookAt.set(camera.position.x, 0, camera.position.z - 9.6 * framingRef.current);
    }
    // The rate follows the smoothed zoom: switching it on the target framing
    // changed the camera's speed by 40% in a single frame.
    const followAlpha = preferences.reducedMotion || snap
      ? 1
      : 1 - Math.exp(-delta * Math.max(followRate ?? 0, cameraFollowRate(framingRef.current)));
    lookAt.lerp(lookTarget, followAlpha);
    framingRef.current = THREE.MathUtils.lerp(framingRef.current, framingScale, followAlpha);
    const framing = framingRef.current;
    camera.position.set(
      lookAt.x + shakeX,
      13.2 * framing,
      lookAt.z + 9.6 * framing + shakeZ,
    );
    // Shake the aim with the eye so the whole view jolts; shaking only the eye
    // pivoted around the aim point and left the middle of the screen still.
    camera.lookAt(lookAt.x + shakeX, 0, lookAt.z + shakeZ);
  });

  return null;
}

function TargetCellWarning({ monster }: { monster: MonsterState }) {
  const pinRef = useRef<THREE.Mesh>(null);
  const closeRef = useRef<THREE.Mesh>(null);
  const motion = React.useContext(MotionContext);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const countdownRef = useRef(createCountdown());
  // Each warning mounts fresh, so its first value is the full lead time.
  const leadRef = useRef(monster.abilityWarningTicks ?? 0);
  const ticks = monster.abilityWarningTicks ?? 0;
  useFrame(({ clock }) => {
    const remaining = motion ? countdownNow(countdownRef.current, ticks, motion.simTimeMs) : ticks;
    const lead = Math.max(leadRef.current, 1);
    if (closeRef.current) {
      closeRef.current.scale.setScalar(1 + 0.9 * Math.min(1, remaining / lead));
    }
    if (pinRef.current) {
      pinRef.current.position.y = 1.95 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * pulseRate(PULSE_HZ.warningPin)) * 0.07);
    }
  });
  const target = monster.abilityTarget;
  if (!target || ticks <= 0) return null;
  const [wx, , wz] = toWorld(target.x, target.y);
  const urgent = ticks < 320;
  return (
    <group position={[wx, 0.035, wz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial
          color={urgent ? '#ef4444' : '#facc15'}
          transparent
          opacity={urgent ? 0.34 : 0.16}
          depthWrite={false}
        />
      </mesh>
      {/* Square, like the closing mark: diamonds belong to a hazard family. */}
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.5, 0.57, 4]} />
        <meshBasicMaterial color={urgent ? '#ffffff' : '#facc15'} transparent opacity={0.9} />
      </mesh>
      <mesh ref={closeRef} position={[0, 0.02, 0]} geometry={WARNING_CLOSE_GEOMETRY} material={WARNING_MARK_MATERIAL} />
      <mesh ref={pinRef} position={[0, 1.95, 0]} geometry={WARNING_PIN_GEOMETRY} material={WARNING_MARK_MATERIAL} />
    </group>
  );
}

// Blast reach for the whole fuse: a dark outline on every visible cell a bomb
// will burn, plus a red fill once that cell's blast is under FUSE_URGENT_MS
// away. Outline vs fill is the cue (shape, not only hue). Two instanced
// meshes stay mounted all match: two draw calls for any number of cells, and
// their programs compile with the first frame.
const BLAST_PREVIEW_CAPACITY = 512;
const BLAST_PREVIEW_DUMMY = new THREE.Object3D();
const BLAST_PREVIEW_EDGE_GEOMETRY = new THREE.RingGeometry(0.47, 0.6, 4, 1)
  .rotateZ(Math.PI / 4)
  .rotateX(-Math.PI / 2);
const BLAST_PREVIEW_FILL_GEOMETRY = new THREE.PlaneGeometry(0.84, 0.84).rotateX(-Math.PI / 2);
const BLAST_PREVIEW_EDGE_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#1c1917', transparent: true, opacity: 0.42, depthWrite: false,
});
const BLAST_PREVIEW_FILL_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#ef4444', transparent: true, opacity: 0.4, depthWrite: false,
});

function writePreviewInstances(
  mesh: THREE.InstancedMesh | null,
  cells: { x: number; y: number }[],
  height: number,
) {
  if (!mesh) return;
  const target = mesh;
  const count = Math.min(cells.length, BLAST_PREVIEW_CAPACITY);
  for (let index = 0; index < count; index += 1) {
    const [wx, , wz] = toWorld(cells[index].x, cells[index].y);
    BLAST_PREVIEW_DUMMY.position.set(wx, height, wz);
    BLAST_PREVIEW_DUMMY.updateMatrix();
    target.setMatrixAt(index, BLAST_PREVIEW_DUMMY.matrix);
  }
  target.count = count;
  if (count === 0) return;
  target.instanceMatrix.addUpdateRange(0, count * 16);
  target.instanceMatrix.needsUpdate = true;
}

function previewSignature(cells: { x: number; y: number; imminent: boolean }[]): string {
  return cells.map((cell) => `${cell.x},${cell.y},${cell.imminent ? 1 : 0}`).join(';');
}

function BombBlastPreviews({ visibleCells }: { visibleCells: Set<string> }) {
  const edgeRef = useRef<THREE.InstancedMesh>(null);
  const fillRef = useRef<THREE.InstancedMesh>(null);
  const bombClock = React.useContext(BombClockContext);
  const drawnRef = useRef<{
    detonationMs: Map<string, number> | null;
    visibleCells: Set<string> | null;
    signature: string;
  }>({ detonationMs: null, visibleCells: null, signature: '' });

  // Reads the bomb clock, which follows every tick: the tier turns red when a
  // cell's blast is FUSE_URGENT_MS away without the scene re-rendering. The
  // clock gets new detonation times only when a tick changed the bombs, so
  // this rebuilds the cells at most once per tick and rewrites the instances
  // only when a cell or tier changed.
  useFrame(() => {
    const clock = bombClock?.current;
    if (!clock) return;
    const drawn = drawnRef.current;
    if (drawn.detonationMs === clock.detonationMs && drawn.visibleCells === visibleCells) return;
    drawn.detonationMs = clock.detonationMs;
    drawn.visibleCells = visibleCells;
    const cells = blastPreviewCells(
      clock.bombs,
      clock.map,
      clock.detonationMs,
      (x, y) => cellVisibleInSet(visibleCells, x, y),
      clock.stop,
    );
    const signature = previewSignature(cells);
    if (signature === drawn.signature) return;
    drawn.signature = signature;
    writePreviewInstances(edgeRef.current, cells, 0.03);
    writePreviewInstances(fillRef.current, cells.filter((cell) => cell.imminent), 0.026);
  });

  return (
    <>
      <instancedMesh
        ref={fillRef}
        args={[BLAST_PREVIEW_FILL_GEOMETRY, BLAST_PREVIEW_FILL_MATERIAL, BLAST_PREVIEW_CAPACITY]}
        count={0}
        frustumCulled={false}
      />
      <instancedMesh
        ref={edgeRef}
        args={[BLAST_PREVIEW_EDGE_GEOMETRY, BLAST_PREVIEW_EDGE_MATERIAL, BLAST_PREVIEW_CAPACITY]}
        count={0}
        frustumCulled={false}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Memo boundaries for SceneContent.
//
// The scene state (hooks/useRenderState: useSceneState) keeps the identity of
// every entity and list that did not change, so most layers skip with a
// shallow compare and a monster step re-renders that monster, not the arena.
// Layers handed the whole `state` compare only the parts they draw from it.
// ---------------------------------------------------------------------------

// Fields a shared scene state refreshes on any rebuild (clocks) or that
// change whenever some other entity does. A layer that skips them must not
// read them during render.
const SCENE_CLOCK_KEYS = [
  'tick', 'rngSeed', 'roundElapsedMs', 'roundStartTicksRemaining', 'bossIntroMsRemaining',
];

function sameStateExcept(
  previous: GameEngineState,
  next: GameEngineState,
  skipped: ReadonlySet<string>,
): boolean {
  if (previous === next) return true;
  return (Object.keys(next) as (keyof GameEngineState)[])
    .every((key) => skipped.has(key) || previous[key] === next[key]);
}

// PlayerMesh draws its own player (compared by identity) and reads `state`
// for that player's timed power-ups. If it ever draws one of these skipped
// fields during render, remove it from this list.
const PLAYER_MESH_SKIPPED_STATE = new Set([
  ...SCENE_CLOCK_KEYS,
  'players', 'monsters', 'bombs', 'explosions', 'destroyedBoxes', 'hazards',
  'fogOfWar', 'map', 'boss', 'campaign', 'pressureBlocksPlaced',
]);
const PlayerMeshMemo = React.memo(PlayerMesh, (previous, next) => (
  previous.player === next.player
  && previous.slot === next.slot
  && previous.cpu === next.cpu
  && previous.pickupChips === next.pickupChips
  && previous.scarf === next.scarf
  && sameStateExcept(previous.state, next.state, PLAYER_MESH_SKIPPED_STATE)
));

// BossMesh draws `state.boss` (and may read its hazards).
const BOSS_MESH_SKIPPED_STATE = new Set([
  ...SCENE_CLOCK_KEYS,
  'players', 'monsters', 'bombs', 'explosions', 'destroyedBoxes', 'fogOfWar',
  'map', 'timedPowerUps', 'pickupMessages', 'pressureBlocksPlaced',
]);
const BossMeshMemo = React.memo(BossMesh, (previous, next) => (
  sameStateExcept(previous.state, next.state, BOSS_MESH_SKIPPED_STATE)
));

// The camera reads players and map in useFrame; the rest comes in props.
const CameraRigMemo = React.memo(CameraRig, (previous, next) => (
  previous.state.players === next.state.players
  && previous.state.map === next.state.map
  && previous.preferences === next.preferences
  && previous.impact === next.impact
));

const MissionObjectiveMarkersMemo = React.memo(MissionObjectiveMarkers, (previous, next) => (
  previous.state.campaign === next.state.campaign
  && previous.state.boss?.name === next.state.boss?.name
  && previous.visibleCells === next.visibleCells
));

const ShaderWarmupMemo = React.memo(ShaderWarmup);
const DojoMarkersMemo = React.memo(DojoMarkers);
const FloorMemo = React.memo(Floor);
const BombBlastPreviewsMemo = React.memo(BombBlastPreviews);
const PressureBlockWarningMemo = React.memo(PressureBlockWarning);
const TargetCellWarningMemo = React.memo(TargetCellWarning);
const SensedEnemyMarkerMemo = React.memo(SensedEnemyMarker);

// High contrast: the danger cues drawn with shared materials get bolder.
// Opacity is a uniform (all of these are already transparent), so this never
// compiles a program. The stage palette is retoned in SceneContent.
const HIGH_CONTRAST_MATERIALS: readonly HighContrastOverride[] = [
  { material: BLAST_PREVIEW_EDGE_MATERIAL, opacity: 0.85 },
  { material: BLAST_PREVIEW_FILL_MATERIAL, opacity: 0.6 },
  { material: FUSE_RING_MATERIAL, opacity: 0.95 },
  { material: FUSE_RING_URGENT_MATERIAL, opacity: 1 },
  { material: PRESSURE_RING_MATERIAL, opacity: 1 },
  { material: PRESSURE_BLOCK_MATERIAL, opacity: 0.72 },
  { material: SHADOW_BLOB_MATERIAL, opacity: 0.42 },
  { material: FIGHTER_INK_MATERIAL, color: FIGHTER_INK_HIGH_CONTRAST },
  { material: GUARD_BADGE_MATERIAL, opacity: 1 },
  ...PICKUP_HIGH_CONTRAST,
  ...OBJECTIVE_HIGH_CONTRAST,
  ...BOSS_INK_HIGH_CONTRAST,
];

function SceneContentBase({
  state,
  preferences,
  impact,
}: {
  state: GameEngineState;
  preferences: GamePreferences;
  impact: number;
}) {
  const stage = useMemo(
    () => getStageDefinition(state.config.stageId),
    [state.config.stageId]
  );
  const look = useMemo(() => getStageLook(state.config.stageId), [state.config.stageId]);
  const { highContrast } = preferences;
  const palette = useMemo(
    () => (highContrast ? highContrastPalette(stage.palette) : stage.palette),
    [highContrast, stage.palette],
  );
  useHighContrastMaterials(highContrast, HIGH_CONTRAST_MATERIALS);
  const mapDimensions = useMemo(() => getMapDimensions(state.map), [state.map]);
  const tileFeatureKey = campaignTileFeatureKey(state.campaign);
  const tileFeatures = useMemo(() => tileFeaturesFromKey(tileFeatureKey), [tileFeatureKey]);
  const visibleCellSet = useMemo(
    () => new Set(state.fogOfWar.visible ?? []),
    [state.fogOfWar.visible],
  );
  const sensedEnemyCells = useMemo(
    () => new Set(state.fogOfWar.sensedEnemies ?? []),
    [state.fogOfWar.sensedEnemies],
  );
  // Drawn outside the memoised MapTiles: flames need every tick's timers.
  const visibleExplosions = useMemo(
    () => state.explosions.filter((explosion) => (
      cellVisibleInSet(visibleCellSet, explosion.x, explosion.y)
    )),
    [state.explosions, visibleCellSet],
  );
  const visibleMonsters = useMemo(
    () => state.monsters.filter((m) => cellVisibleInSet(visibleCellSet, m.x, m.y)),
    [state.monsters, visibleCellSet],
  );
  const warnedMonsters = useMemo(
    () => getVisibleAbilityWarnings(state.monsters, visibleCellSet),
    [state.monsters, visibleCellSet],
  );
  const sensedMonsters = useMemo(
    () => state.monsters.filter((m) => (
      !cellVisibleInSet(visibleCellSet, m.x, m.y)
      && sensedEnemyCells.has(cellKey(Math.round(m.x), Math.round(m.y)))
    )),
    [state.monsters, sensedEnemyCells, visibleCellSet],
  );
  const bossCellKey = state.boss
    ? cellKey(Math.round(state.boss.x), Math.round(state.boss.y))
    : null;
  // The boss's entrance shows it wherever it stands, fog or not.
  const bossIntro = isBossIntroRunning(state);
  const bossVisible = !!state.boss
    && !!bossCellKey
    && (bossIntro || visibleCellSet.has(bossCellKey));
  const bossSensed = !!state.boss
    && !bossVisible
    && !!bossCellKey
    && sensedEnemyCells.has(bossCellKey);
  // Mini-boss gate guards by monster id; they wear their stage's regalia.
  const guardIds = useMemo(() => new Set(
    (state.campaign?.objectives ?? [])
      .filter((objective) => objective.kind === 'miniBoss')
      .map((objective) => objective.miniBossGuardId ?? `${objective.id}-guard`)
  ), [state.campaign?.objectives]);
  const guardStage = state.campaign?.stageId;
  const multiplayer = state.players.length > 1;
  const motion = React.useContext(MotionContext);
  const readLiveState = React.useContext(LiveStateContext);
  const puzzleObjective = state.campaign?.objectives.find((objective) => objective.kind === 'puzzle');
  const cueChips = useCueChips(multiplayer ? state.players.length : 0);
  // The village square every campaign mission starts in (content/villageSquare).
  const villageSquare = activeSquareLayout(state.config);
  const villageTier = state.config.village?.reputationTier ?? 'stranger';
  const localSeat = React.useContext(LocalSeatContext);
  const promptKey = villageSquare ? promptPlayersKey(state, localSeat) : '';
  const promptPlayerIds = useMemo(
    () => (promptKey ? promptKey.split('|') : NO_PLAYER_IDS),
    [promptKey],
  );
  const villageMarksCells = villageMarksKey(villageMarks(state.campaign));
  const requestMarks = useMemo(() => villageMarksFromKey(villageMarksCells), [villageMarksCells]);
  // The scarf the player chose, worn on the mission's square map (render only).
  const villageScarf = villageSquare ? state.config.village?.scarf : undefined;

  return (
    <LightPool>
      <ShaderWarmupMemo withBoss={state.config.mode === 'solo'} withVillage={!!villageSquare} />
      <CastPrewarm stageId={state.campaign?.stageId} square={villageSquare} />
      <CameraRigMemo state={state} preferences={preferences} impact={impact} />
      <StageAtmosphere look={look} farEdgeZ={toWorld(0, -BOARD_LIP)[2]} />
      <FloorMemo
        palette={palette}
        width={mapDimensions.width}
        height={mapDimensions.height}
      />
      <StageLandmarks
        look={look}
        slabColor={stage.palette.wall}
        width={mapDimensions.width}
        height={mapDimensions.height}
      />
      <MapTiles
        map={state.map}
        bombs={state.bombs}
        destroyedBoxes={state.destroyedBoxes}
        palette={palette}
        fogOfWar={state.fogOfWar}
        features={tileFeatures}
        powerTheme={state.players[0]?.characterId}
        blastStop={squareBlastStop(state.config)}
      />
      {state.players.map((player) => player.teleportMark && (
        <FlyingThunderMarker
          key={`flying-thunder-mark-${player.id}`}
          x={player.teleportMark.x}
          y={player.teleportMark.y}
        />
      ))}
      <HazardLayer hazards={state.hazards} visibleCells={visibleCellSet} />
      <ExplosionFieldMemo explosions={visibleExplosions} />
      <BombBlastPreviewsMemo visibleCells={visibleCellSet} />
      <HazardTelegraphs
        hazards={state.hazards}
        boss={state.boss}
        visibleCells={visibleCellSet}
        motion={motion}
      />
      <MissionObjectiveMarkersMemo state={state} visibleCells={visibleCellSet} />
      {puzzleObjective && (
        <PuzzleMarkers
          objective={puzzleObjective}
          fogOfWar={state.fogOfWar}
          readState={readLiveState}
          motion={motion}
          reducedMotion={preferences.reducedMotion}
          highContrast={highContrast}
        />
      )}
      {state.config.mode === 'training' && (
        <DojoMarkersMemo
          goals={state.config.training?.goals}
          reducedMotion={preferences.reducedMotion}
        />
      )}
      <WaveTelegraphs waves={state.campaign?.waves ?? null} readLive={readLiveState} motion={motion} />
      {villageSquare && state.campaign && (
        <VillageSquare
          square={villageSquare}
          stageId={state.campaign.stageId}
          tier={villageTier}
          closedCells={closedCellsKey(villageSquare, state.map)}
          groundTint={palette.groundA}
          readState={readLiveState}
          promptPlayerIds={promptPlayerIds}
          reducedMotion={preferences.reducedMotion}
          repairStage={state.config.village?.repairStage}
        />
      )}
      {villageMarksCells && (
        <VillageRequestMarks
          marks={requestMarks}
          visibleCells={visibleCellSet}
          explored={state.fogOfWar.explored}
          reducedMotion={preferences.reducedMotion}
          highContrast={highContrast}
        />
      )}
      {getUpcomingPressureCells(state).map((cell, order) => (
        <PressureBlockWarningMemo
          key={`pressure-${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          order={order % 3}
        />
      ))}
      {state.players.map((p, index) => (
        <PlayerMeshMemo
          key={p.id}
          player={p}
          state={state}
          slot={multiplayer ? index + 1 : undefined}
          cpu={multiplayer && isCpuSlot(state.config, index)}
          pickupChips={cueChips.pickups}
          scarf={index === 0 ? villageScarf : undefined}
        />
      ))}
      <KoMarkers players={state.players} chips={cueChips.ko} />
      {visibleMonsters.map((m) => (
        <MonsterMesh key={m.id} monster={m} guardStage={guardIds.has(m.id) ? guardStage : undefined} />
      ))}
      {warnedMonsters.map((m) => (
        <TargetCellWarningMemo key={`target-warning-${m.id}`} monster={m} />
      ))}
      {sensedMonsters.map((m) => (
        <SensedEnemyMarkerMemo
          key={`sensed-${m.id}`}
          x={Math.round(m.x)}
          y={Math.round(m.y)}
          label={m.name}
          color={MONSTER_VISUALS[m.kind].glow}
        />
      ))}
      {state.boss && bossVisible && (
        <BossMeshMemo state={state} />
      )}
      {state.boss && bossSensed && (
        <SensedEnemyMarkerMemo
          x={Math.round(state.boss.x)}
          y={Math.round(state.boss.y)}
          label={state.boss.name}
          color={BOSS_VISUALS[state.boss.id].glow}
          scale={1.25}
        />
      )}
    </LightPool>
  );
}

const SceneContent = React.memo(SceneContentBase);

type GameScene3DProps = {
  /**
   * What the scene renders from. GameScreen passes useSceneState's output,
   * whose identity changes only when something the scene draws changed.
   */
  state: GameEngineState;
  preferences: GamePreferences;
  impact?: number;
  /** Interpolated positions from the engine loop; without it entities chase their sim position. */
  motion?: MotionStore | null;
  /** Advances the simulation to this frame's timestamp before the scene renders. */
  advanceFrame?: (timestamp: number) => void;
  /**
   * The engine's newest state, read before every frame for what changes each
   * tick but is drawn without a re-render (bomb fuses). Defaults to `state`.
   */
  liveState?: () => GameEngineState | null;
  /**
   * Nothing on screen moves (pause menu, Settings, result dialog): draw only
   * on change. Defaults to "paused or the round is over".
   */
  idle?: boolean;
  /** Online: the seat this browser plays. Left out, every human seat is local. */
  localSeat?: number | null;
};

/**
 * Before each frame: advance the simulation, then point the bomb clock at the
 * newest bombs. Runs ahead of every useFrame (R3F global effect).
 */
function useBeforeEachFrame(
  advanceFrame: ((timestamp: number) => void) | undefined,
  readState: () => GameEngineState | null,
  bombClock: React.MutableRefObject<BombClock>,
) {
  const advanceRef = useRef(advanceFrame);
  advanceRef.current = advanceFrame;
  const readRef = useRef(readState);
  readRef.current = readState;
  useEffect(() => addEffect((timestamp) => {
    advanceRef.current?.(timestamp);
    refreshBombClock(bombClock.current, readRef.current());
  }), [bombClock]);
}

/**
 * Nothing moves while the game is paused or a round result is up, so the
 * canvas draws on demand then: one frame per change instead of 60 a second.
 * R3F starts its loop again when the frameloop turns back to 'always'.
 */
function isSceneIdle(state: GameEngineState): boolean {
  return state.paused || state.phase !== 'playing';
}

// The scene state reaches the canvas through this store, not through props:
// a new state then re-renders only the scene inside the canvas. Re-rendering
// <Canvas> itself re-renders r3f's root and its context bridge (about a dozen
// components per commit) and the canvas wrapper on the page side.
type SceneStore = {
  get: () => GameEngineState;
  set: (state: GameEngineState) => void;
  subscribe: (listener: () => void) => () => void;
};

function createSceneStore(initial: GameEngineState): SceneStore {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

function SceneFromStore({
  store,
  preferences,
  impact,
}: {
  store: SceneStore;
  preferences: GamePreferences;
  impact: number;
}) {
  const state = useSyncExternalStore(store.subscribe, store.get);
  // Request a frame whenever the scene's inputs change. In 'always' mode the
  // loop is running anyway; on demand it draws the change (a setting toggled
  // under the pause menu) exactly once.
  const invalidate = useThree((three) => three.invalidate);
  useEffect(() => { invalidate(); }, [invalidate, state, preferences, impact]);
  return <SceneContent state={state} preferences={preferences} impact={impact} />;
}

type SceneCanvasProps = {
  store: SceneStore;
  readState: () => GameEngineState | null;
  preferences: GamePreferences;
  impact: number;
  motion: MotionStore | null;
  idle: boolean;
  bombClock: React.MutableRefObject<BombClock>;
  // The stage's sky gradient, drawn behind the transparent canvas.
  sky: string;
  localSeat: number | null;
};

const SceneCanvas = React.memo(({
  store, readState, preferences, impact, motion, idle, bombClock, sky, localSeat,
}: SceneCanvasProps) => {
  const viewport = useViewportSize();
  const lowEnd = useMemo(() => isLikelyLowEndDevice(), []);
  const targetDpr = initialCanvasDpr({
    ...viewport,
    deviceDpr: window.devicePixelRatio,
    lowEnd,
  });
  const resolutionRef = useRef<AdaptiveDprRuntime>({
    targetDpr, dpr: targetDpr, fastWindows: 0,
  });
  resolutionRef.current = reconcileAdaptiveDpr(resolutionRef.current, targetDpr);
  const [renderDpr, setRenderDpr] = useState(targetDpr);
  useLayoutEffect(() => setRenderDpr(targetDpr), [targetDpr]);

  return (
    <Canvas
      shadows
      dpr={renderDpr}
      frameloop={idle ? 'demand' : 'always'}
      style={{
        width: '100%',
        height: '100%',
        background: sky,
      }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      flat
      camera={{ position: [0, 13.2, 9.6], fov: 48 }}
    >
      <AdaptiveResolution
        active={!idle}
        targetDpr={targetDpr}
        runtimeRef={resolutionRef}
        onDprChange={setRenderDpr}
      />
      <ReducedMotionContext.Provider value={preferences.reducedMotion}>
        <SceneryContext.Provider value={preferences.scenery}>
          <MotionContext.Provider value={motion}>
            <BombClockContext.Provider value={bombClock}>
              <LiveStateContext.Provider value={readState}>
                <LocalSeatContext.Provider value={localSeat}>
                  <SceneFromStore store={store} preferences={preferences} impact={impact} />
                </LocalSeatContext.Provider>
              </LiveStateContext.Provider>
            </BombClockContext.Provider>
          </MotionContext.Provider>
        </SceneryContext.Provider>
      </ReducedMotionContext.Provider>
      {PERF_PROBE_ENABLED && <PerfProbe />}
    </Canvas>
  );
});
SceneCanvas.displayName = 'SceneCanvas';

export function GameScene3D({
  state, preferences, impact = 0, motion = null, advanceFrame, liveState, idle, localSeat = null,
}: GameScene3DProps) {
  const sky = useMemo(
    () => stageSkyBackground(getStageLook(state.config.stageId)),
    [state.config.stageId],
  );
  const storeRef = useRef<SceneStore>();
  if (!storeRef.current) storeRef.current = createSceneStore(state);
  const store = storeRef.current;
  useLayoutEffect(() => { store.set(state); }, [store, state]);
  const readState = React.useCallback(
    () => liveState?.() ?? store.get(),
    [liveState, store],
  );
  const bombClockRef = useRef<BombClock>(createBombClock());
  useBeforeEachFrame(advanceFrame, readState, bombClockRef);
  // Free cached label canvases nothing shows any more once the arena closes.
  useEffect(() => () => {
    LABEL_SPRITES.disposeIdle();
    PLAYER_TAG_SPRITES.disposeIdle();
  }, []);
  return (
    <SceneCanvas
      store={store}
      readState={readState}
      preferences={preferences}
      impact={impact}
      motion={motion}
      idle={idle ?? isSceneIdle(state)}
      bombClock={bombClockRef}
      sky={sky}
      localSeat={localSeat}
    />
  );
}
