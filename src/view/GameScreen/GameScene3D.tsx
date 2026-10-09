/* eslint-disable react/no-unknown-property, react/no-array-index-key */
/* eslint-disable react/require-default-props, comma-dangle, max-len */
import React, {
  useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
} from 'react';
import {
  Canvas, addEffect, useFrame, useThree,
} from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils';
import {
  BombKind,
  BossHazard,
  CampaignObjectiveState,
  CampaignRescueTargetState,
  CellVisibility,
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
import { getUpcomingPressureCells } from '../../engine';
import { EXPLOSION_MS } from '../../engine/constants';
import { hazardIsActive } from '../../engine/bosses';
import { cellKey } from '../../engine/fogOfWar';
import { getStageDefinition } from '../../content';
import { getStageLook, stageSkyBackground } from '../../content/stageLooks';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import {
  BossId, CharacterId, StageDefinition
} from '../../content/types';
import { GamePreferences } from './gamePreferences';
import { PERF_PROBE_ENABLED, PerfProbe } from './scene/PerfProbe';
import {
  MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE, toWorld
} from './scene/sceneSpace';
import { StaticTiles } from './scene/StaticTiles';
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
} from './scene/bombFuse';
import { PLAYER_TAG_SPRITES, PlayerTagSprite, playerTagKey } from './scene/playerTags';
import { playerSlotColor } from './playerSlots';
import { isCpuSlot } from '../../ai/controllers';
import { HazardTelegraphs } from './scene/HazardTelegraphs';
import { KoMarkers } from './scene/KoMarkers';
import { useCueChips } from './scene/cueChips';
import { createPlayerPose, samplePlayerCuePose } from './scene/playerCuePose';
import { LightPool, PooledPointLight } from './scene/LightPool';
import { disposeModelSkeletons } from './scene/modelDisposal';
import { nextFlameAgeMs } from './scene/flameAge';
import { LIGHT_PRIORITY, PooledLightHandle } from './scene/lightPoolSlots';
import { LABEL_SPRITES, labelSpriteKey } from './scene/labelSprites';
import { ShaderWarmup, useTransparencyVariantWarmup } from './scene/ShaderWarmup';
import {
  FIGHTER_INK_HIGH_CONTRAST, FIGHTER_INK_MATERIAL, cachedInkHull, fighterToonMaterial, inkHullFor,
  setInkViewportHeight,
} from './scene/fighterInk';
import { shareSkeletons } from './scene/sharedSkeletons';
import { MAX_FRAME_DELTA_MS } from '../../hooks/engineLoop';
import {
  BOSS_MOTION_ID,
  MotionStore,
  isTrackMoving,
  monsterMotionId,
  playerMotionId,
  samplePosition,
  trackProgress,
} from '../../hooks/motionStore';
import { PICKUP_CUE_MS, bodyCueAt, pickupCueAt } from '../../hooks/cueStore';
import {
  FACING_HEADING, advanceStride, cameraFollowRate, decayShake, turnToward,
} from './scene/motionFeel';
import { StageAtmosphere } from './scene/StageAtmosphere';
import { StageLandmarks } from './scene/StageLandmarks';
import { BOARD_LIP } from './scene/landmarkPlacement';
import { MonsterFigure, monsterIsTranslucent } from './scene/MonsterFigure';
import { BossFigure } from './scene/BossFigure';
import { BombClockState, createBombClock, refreshBombClock } from './scene/bombClock';
import { canvasHudInsets } from './scene/canvasInsets';
import {
  HighContrastOverride, highContrastPalette, useHighContrastMaterials,
} from './scene/highContrast';

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

function lerpAngle(from: number, to: number, alpha: number): number {
  const turn = Math.PI * 2;
  const diff = ((((to - from) % turn) + turn * 1.5) % turn) - Math.PI;
  return from + diff * alpha;
}

const USE_ARCHIVE_MODELS = false;

function getMapDimensions(map: GameMap): { width: number; height: number } {
  return {
    width: Math.max(1, ...map.map((row) => row.length)),
    height: Math.max(1, map.length),
  };
}

function getMapWorldCenter(width: number, height: number): [number, number, number] {
  return toWorld((width - 1) / 2, (height - 1) / 2);
}

function getVisibilityFromSets(
  visibleCells: Set<string>,
  exploredCells: Set<string>,
  x: number,
  y: number
): CellVisibility {
  const key = cellKey(x, y);
  if (visibleCells.has(key)) return 'visible';
  if (exploredCells.has(key)) return 'explored';
  return 'hidden';
}

function cellVisibleInSet(visibleCells: Set<string>, x: number, y: number): boolean {
  return visibleCells.has(cellKey(Math.round(x), Math.round(y)));
}

const POWERUP_VISUALS: Record<Power, {
  paper: string;
  accent: string;
  glow: string;
  shape: 'scroll' | 'seal' | 'charm' | 'tag' | 'fragment';
}> = {
  AddBomb: {
    paper: '#fff1d6', accent: '#f97316', glow: '#ff8a00', shape: 'scroll'
  },
  BlastRangeUp: {
    paper: '#ecfccb', accent: '#22c55e', glow: '#84cc16', shape: 'scroll'
  },
  Detonator: {
    paper: '#f9e8d2', accent: '#dc2626', glow: '#f97316', shape: 'tag'
  },
  RollerSkate: {
    paper: '#e0f2fe', accent: '#38bdf8', glow: '#38bdf8', shape: 'scroll'
  },
  Invincibility: {
    paper: '#ede9fe', accent: '#7c3aed', glow: '#a855f7', shape: 'fragment'
  },
  Ghost: {
    paper: '#dcfce7', accent: '#16a34a', glow: '#86efac', shape: 'seal'
  },
  Obstacle: {
    paper: '#e7d2a6', accent: '#6b4f3a', glow: '#a16207', shape: 'tag'
  },
  ClaySpider: {
    paper: '#f5efe0', accent: '#f97316', glow: '#ff8a00', shape: 'charm'
  },
  Rasengan: {
    paper: '#eff6ff', accent: '#38bdf8', glow: '#dbeafe', shape: 'seal'
  },
  Sharingan: {
    paper: '#fee2e2', accent: '#ef4444', glow: '#111827', shape: 'tag'
  },
  FTGKunai: {
    paper: '#fef3c7', accent: '#facc15', glow: '#2563eb', shape: 'charm'
  },
  CrowFeather: {
    paper: '#e5e7eb', accent: '#111827', glow: '#ef4444', shape: 'fragment'
  },
  SandArmor: {
    paper: '#f5deb3', accent: '#c48a4a', glow: '#fff7ed', shape: 'fragment'
  },
  ChakraScroll: {
    paper: '#ecfccb', accent: '#22c55e', glow: '#dcfce7', shape: 'scroll'
  },
  CharacterFragment: {
    paper: '#ede9fe', accent: '#a855f7', glow: '#fef3c7', shape: 'fragment'
  },
};

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

const CHARACTER_VISUALS: Record<CharacterId, {
  body: string;
  accent: string;
  hair: string;
  aura: string;
  trim: string;
  headband: string;
}> = {
  deidara: {
    body: '#111827', accent: '#d92323', hair: '#f8fafc', aura: '#ff8a00', trim: '#f8fafc', headband: '#1f2937'
  },
  naruto: {
    body: '#ff8a00', accent: '#2563eb', hair: '#facc15', aura: '#f97316', trim: '#111827', headband: '#1d4ed8'
  },
  sasuke: {
    body: '#1e293b', accent: '#60a5fa', hair: '#111827', aura: '#60a5fa', trim: '#7c3aed', headband: '#0f172a'
  },
  gaara: {
    body: '#7f1d1d', accent: '#f59e0b', hair: '#dc2626', aura: '#d6a45d', trim: '#3b2412', headband: '#7f1d1d'
  },
  minato: {
    body: '#2563eb', accent: '#facc15', hair: '#fde68a', aura: '#fde047', trim: '#f8fafc', headband: '#1e40af'
  },
  itachi: {
    body: '#111827', accent: '#dc2626', hair: '#111827', aura: '#ef4444', trim: '#7f1d1d', headband: '#374151'
  },
};

type SceneModelConfig = {
  paths: string[];
  height: number;
  footY?: number;
  rotation?: [number, number, number];
  scale?: number;
};

const CHARACTER_MODEL_CONFIGS: Record<CharacterId, SceneModelConfig> = {
  deidara: {
    paths: ['/models/characters/deidara.glb'],
    height: 1.16,
  },
  naruto: {
    paths: [
      '/models/characters/naruto_rigged.glb',
      '/models/characters/naruto.glb',
      '/models/characters/naruto_mode_kurama_free_fire.glb',
    ],
    height: 1.16,
  },
  sasuke: {
    paths: [
      '/models/characters/sasuke_fortnite.glb',
      '/models/characters/sasuke.glb',
    ],
    height: 1.16,
  },
  gaara: {
    paths: ['/models/characters/gaara.glb'],
    height: 1.16,
  },
  minato: {
    paths: [
      '/models/characters/freefire_new_3d_character_minato_namikaze.glb',
      '/models/characters/minato.glb',
    ],
    height: 1.16,
  },
  itachi: {
    paths: [
      '/models/characters/itachi_uchiha_sharingan_akatsuki_amaterasu.glb',
      '/models/characters/itachi.glb',
    ],
    height: 1.16,
  },
};

const BOSS_MODEL_CONFIGS: Partial<Record<BossId, SceneModelConfig>> = {
  shukaku: {
    paths: [
      '/models/characters/shukaku_naruto.glb',
      '/models/bosses/shukaku.glb',
    ],
    height: 0.94,
    footY: -0.58,
  },
  kurama: {
    paths: [
      '/models/characters/kurama__nine-tails.glb',
      '/models/bosses/kurama.glb',
    ],
    height: 0.9,
    footY: -0.58,
  },
};

type SceneModelAsset = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  config: SceneModelConfig;
  sourcePath: string;
};

type SceneModelCacheEntry =
  | { status: 'loaded'; asset: SceneModelAsset }
  | { status: 'loading'; promise: Promise<SceneModelAsset | null> }
  | { status: 'missing' };

const SCENE_MODEL_CACHE = new Map<string, SceneModelCacheEntry>();

function configureModelMeshes(root: THREE.Object3D, cloneMaterials: boolean) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (cloneMaterials) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material.clone())
        : mesh.material.clone();
    }
  });
}

function findCharacterClip(
  animations: THREE.AnimationClip[],
  pattern: RegExp,
): THREE.AnimationClip | undefined {
  return animations.find((clip) => pattern.test(clip.name));
}

function loadSceneModelPath(
  loader: GLTFLoader,
  cacheKey: string,
  config: SceneModelConfig,
  index = 0,
): Promise<SceneModelAsset | null> {
  const path = config.paths[index];
  if (!path) return Promise.resolve(null);

  return loader.loadAsync(path).then((gltf) => {
    const asset = {
      scene: gltf.scene,
      animations: gltf.animations ?? [],
      config,
      sourcePath: path,
    };
    configureModelMeshes(asset.scene, false);
    SCENE_MODEL_CACHE.set(cacheKey, { status: 'loaded', asset });
    return asset;
  }).catch(() => loadSceneModelPath(loader, cacheKey, config, index + 1));
}

function loadSceneModel(
  cacheKey: string,
  config: SceneModelConfig,
): Promise<SceneModelAsset | null> {
  const cached = SCENE_MODEL_CACHE.get(cacheKey);
  if (cached?.status === 'loaded') return Promise.resolve(cached.asset);
  if (cached?.status === 'missing') return Promise.resolve(null);
  if (cached?.status === 'loading') return cached.promise;

  const loader = new GLTFLoader();
  const promise = loadSceneModelPath(loader, cacheKey, config).then((asset) => {
    if (!asset) {
      SCENE_MODEL_CACHE.set(cacheKey, { status: 'missing' });
    }
    return asset;
  });

  SCENE_MODEL_CACHE.set(cacheKey, { status: 'loading', promise });
  return promise;
}

function useSceneModel(cacheKey: string | null, config?: SceneModelConfig) {
  const [asset, setAsset] = useState<SceneModelAsset | null>(() => {
    if (!cacheKey) return null;
    const cached = SCENE_MODEL_CACHE.get(cacheKey);
    return cached?.status === 'loaded' ? cached.asset : null;
  });

  useEffect(() => {
    if (!cacheKey || !config) {
      setAsset(null);
      return undefined;
    }

    let mounted = true;
    const cached = SCENE_MODEL_CACHE.get(cacheKey);
    setAsset(cached?.status === 'loaded' ? cached.asset : null);
    loadSceneModel(cacheKey, config).then((nextAsset) => {
      if (mounted) setAsset(nextAsset);
    });
    return () => {
      mounted = false;
    };
  }, [cacheKey, config]);

  return asset;
}

function useCharacterModel(characterId: CharacterId) {
  return useSceneModel(
    USE_ARCHIVE_MODELS ? `character:${characterId}` : null,
    USE_ARCHIVE_MODELS ? CHARACTER_MODEL_CONFIGS[characterId] : undefined,
  );
}

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
  const [wx, , wz] = toWorld(x, y);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 12 - order) * 0.1);
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

function BombMesh({ x, y, kind }: { x: number; y: number; kind: BombKind }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<PooledLightHandle>(null);
  const bombClock = React.useContext(BombClockContext);
  const motion = React.useContext(MotionContext);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const countdownRef = useRef(createCountdown());
  const [wx, , wz] = toWorld(x, y);
  const ultimateScale = ['giantClay', 'rasenshuriken', 'kirin', 'sandTsunami', 'instantTeleport', 'tsukuyomi']
    .includes(kind)
    ? 1.35
    : 1;
  const giant = kind === 'giantClay';
  const baseScale = giant ? 1.72 : ultimateScale;
  const height = giant ? 0.48 : 0.36;
  useFrame(({ clock }) => {
    const remaining = bombRemainingMs(bombClock?.current, x, y, countdownRef.current, motion?.simTimeMs);
    const urgent = remaining <= FUSE_URGENT_MS;
    const pulse = 1 + Math.sin(clock.elapsedTime * 10) * 0.08;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }
    // About to blow: the whole bomb swells and beats faster.
    const scale = baseScale * bombPulseScale(remaining, clock.elapsedTime, reducedMotion);
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.7;
      groupRef.current.scale.setScalar(scale);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.7 + Math.sin(clock.elapsedTime * 12) * 0.35;
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
    <group ref={groupRef} position={[wx, height, wz]} scale={baseScale}>
      <mesh ref={ringRef} geometry={FUSE_RING_GEOMETRY} material={FUSE_RING_MATERIAL} />
      <PooledPointLight ref={lightRef} priority={LIGHT_PRIORITY.bomb} color={style.emissive} distance={2.8} intensity={0.72} />

      {(kind === 'claySpider' || kind === 'giantClay') && (
        <>
          <mesh ref={coreRef} castShadow scale={[1.15, 0.72, 0.9]}>
            <sphereGeometry args={[0.26, 24, 24]} />
            <meshStandardMaterial color="#f5efe0" emissive={style.emissive} emissiveIntensity={0.24} roughness={0.52} />
          </mesh>
          <mesh position={[0, 0.18, 0.2]} castShadow>
            <sphereGeometry args={[0.12, 14, 14]} />
            <meshStandardMaterial color="#f7f0df" roughness={0.5} />
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
          <mesh position={[0, 0.1, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.24, 0.12]} />
            <meshStandardMaterial color={style.emissive} emissive={style.emissive} emissiveIntensity={0.55} />
          </mesh>
          {giant && (
            <mesh position={[0, 0.42, 0.02]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshStandardMaterial color="#ffdd55" emissive="#ff6600" emissiveIntensity={1.2} />
            </mesh>
          )}
        </>
      )}

      {kind === 'shadowClone' && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
            <torusGeometry args={[0.33, 0.026, 8, 34]} />
            <meshStandardMaterial color="#fed7aa" emissive="#f97316" emissiveIntensity={0.64} transparent opacity={0.62} />
          </mesh>
          <mesh ref={coreRef} position={[0, 0.02, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.32, 6, 12]} />
            <meshStandardMaterial color="#ff8a00" emissive="#f97316" emissiveIntensity={0.34} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.31, 0.03]} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#ffedd5" emissive="#f97316" emissiveIntensity={0.18} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.38, 0.12]} castShadow>
            <boxGeometry args={[0.29, 0.045, 0.035]} />
            <meshStandardMaterial color="#1d4ed8" emissive="#2563eb" emissiveIntensity={0.28} />
          </mesh>
          {[-0.08, 0.08].map((side) => (
            <mesh key={`clone-hair-${side}`} position={[side, 0.49, 0.01]} rotation={[0.15, 0, side > 0 ? -0.32 : 0.32]}>
              <coneGeometry args={[0.055, 0.18, 6]} />
              <meshStandardMaterial color="#facc15" emissive="#f59e0b" emissiveIntensity={0.24} />
            </mesh>
          ))}
          {[-0.16, 0.16].map((side) => (
            <mesh key={`clone-arm-${side}`} position={[side, 0.04, 0.02]} rotation={[0.25, 0, side > 0 ? -0.7 : 0.7]}>
              <capsuleGeometry args={[0.032, 0.24, 4, 6]} />
              <meshStandardMaterial color="#2563eb" emissive="#1d4ed8" emissiveIntensity={0.12} />
            </mesh>
          ))}
          {[-0.22, 0.22].map((side) => (
            <mesh key={`clone-smoke-${side}`} position={[side, -0.16, side > 0 ? -0.08 : 0.08]} scale={[1.2, 0.66, 1.2]}>
              <sphereGeometry args={[0.1, 12, 12]} />
              <meshStandardMaterial color="#f8fafc" emissive="#e5e7eb" emissiveIntensity={0.2} transparent opacity={0.62} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshStandardMaterial color="#ffedd5" emissive="#f97316" emissiveIntensity={0.9} transparent opacity={0.68} />
          </mesh>
        </>
      )}

      {(kind === 'chidoriMine' || kind === 'kirin') && (
        <>
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
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((rotation) => (
            <React.Fragment key={`thunder-seal-${rotation}`}>
              <mesh position={[Math.sin(rotation) * 0.24, -0.2, Math.cos(rotation) * 0.24]} rotation={[-Math.PI / 2, 0, -rotation]}>
                <boxGeometry args={[0.045, kind === 'instantTeleport' ? 0.38 : 0.28, 0.018]} />
                <meshStandardMaterial color="#fde68a" emissive="#facc15" emissiveIntensity={0.82} transparent opacity={0.78} />
              </mesh>
              <mesh position={[Math.sin(rotation) * 0.39, -0.19, Math.cos(rotation) * 0.39]} rotation={[Math.PI / 2, 0, -rotation]}>
                <coneGeometry args={[0.045, 0.16, 3]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.5} roughness={0.28} emissive="#facc15" emissiveIntensity={0.18} />
              </mesh>
            </React.Fragment>
          ))}
          {kind === 'instantTeleport' && (
            <mesh position={[0, 0.25, 0]} rotation={[0, 0, Math.PI / 4]}>
              <coneGeometry args={[0.16, 0.86, 4]} />
              <meshStandardMaterial color="#fef3c7" emissive="#facc15" emissiveIntensity={1.05} transparent opacity={0.44} />
            </mesh>
          )}
          <mesh position={[0, -0.17, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <boxGeometry args={[0.5, 0.035, 0.02]} />
            <meshStandardMaterial color="#60a5fa" emissive="#38bdf8" emissiveIntensity={0.6} transparent opacity={0.66} />
          </mesh>
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
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => (
            <mesh key={`rasen-blade-${rotation}`} position={[Math.sin(rotation) * 0.24, 0, Math.cos(rotation) * 0.24]} rotation={[Math.PI / 2, 0, -rotation]}>
              <coneGeometry args={[0.065, 0.32, 3]} />
              <meshStandardMaterial color="#eff6ff" emissive="#38bdf8" emissiveIntensity={0.75} />
            </mesh>
          ))}
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

type ExplosionEffect = 'chakra' | 'lightning' | 'sand' | 'clay' | 'genjutsu' | 'teleport' | 'rasengan';

function getExplosionStyle(kind?: BombKind): {
  color: string;
  emissive: string;
  accent: string;
  effect: ExplosionEffect;
} {
  if (kind === 'chidoriMine' || kind === 'kirin') {
    return {
      color: '#93c5fd', emissive: '#60a5fa', accent: '#050507', effect: 'lightning'
    };
  }
  if (kind === 'sandCoffin' || kind === 'sandTsunami') {
    return {
      color: '#d6a45d', emissive: '#f59e0b', accent: '#8b5e34', effect: 'sand'
    };
  }
  if (kind === 'claySpider' || kind === 'giantClay') {
    return {
      color: '#fed7aa', emissive: '#f97316', accent: '#ef4444', effect: 'clay'
    };
  }
  if (kind === 'crowClone' || kind === 'tsukuyomi') {
    return {
      color: '#7f1d1d', emissive: '#ef4444', accent: '#111827', effect: 'genjutsu'
    };
  }
  if (kind === 'thunderMark' || kind === 'instantTeleport') {
    return {
      color: '#fef3c7', emissive: '#facc15', accent: '#60a5fa', effect: 'teleport'
    };
  }
  if (kind === 'shadowClone' || kind === 'rasenshuriken') {
    return {
      color: '#dbeafe', emissive: '#38bdf8', accent: '#f97316', effect: 'rasengan'
    };
  }
  return {
    ...BOMB_STYLE[kind ?? 'standard'],
    accent: '#fed7aa',
    effect: 'chakra',
  };
}

const EXPLOSION_INSTANCE_CAPACITY = 512;
const EXPLOSION_DUMMY = new THREE.Object3D();
const EXPLOSION_COLOR = new THREE.Color();

function getExplosionKey(explosion: ExplosionCell): string {
  return `${explosion.x},${explosion.y},${explosion.kind ?? 'standard'}`;
}

function ExplosionField({ explosions }: { explosions: ExplosionCell[] }) {
  const flameRef = useRef<THREE.InstancedMesh>(null);
  const shockwaveRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const accentRef = useRef<THREE.InstancedMesh>(null);
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<PooledLightHandle>(null);
  const agesRef = useRef(new Map<string, number>());
  const ticksRef = useRef(new Map<string, number>());
  const motion = React.useContext(MotionContext);
  const simTimeRef = useRef<number | null>(null);

  // Allocate instance colours up front: setColorAt would otherwise create them
  // on the first explosion, which changes the shader variant and compiles a
  // new program mid-match. The layers take their colour from these alone: a
  // `vertexColors` material also multiplies by the geometry's colour
  // attribute, and these geometries have none, so WebGL read (0, 0, 0) and
  // every flame drew black.
  useLayoutEffect(() => {
    [flameRef.current, shockwaveRef.current, ringRef.current, accentRef.current, debrisRef.current].forEach((mesh) => {
      if (!mesh || mesh.instanceColor) return;
      const instancedMesh = mesh;
      instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(EXPLOSION_INSTANCE_CAPACITY * 3),
        3,
      );
    });
  }, []);

  useFrame((_, delta) => {
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
    const activeKeys = new Set<string>();
    const count = Math.min(explosions.length, EXPLOSION_INSTANCE_CAPACITY);
    let strongestLight = 0;
    let strongestLightPosition: [number, number, number] | null = null;
    let strongestLightColor = '#f97316';

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
      const [wx, , wz] = toWorld(explosion.x, explosion.y);
      const style = getExplosionStyle(explosion.kind);
      const pulse = Math.sin(progress * Math.PI);

      EXPLOSION_COLOR.set(style.color);
      EXPLOSION_DUMMY.position.set(wx, 0.45 + progress * 0.08, wz);
      EXPLOSION_DUMMY.scale.set(0.95 - progress * 0.18, 1.05 + pulse * 0.32, 0.95 - progress * 0.18);

      if (style.effect === 'lightning') {
        EXPLOSION_DUMMY.position.set(wx, 0.7 + pulse * 0.18, wz);
        EXPLOSION_DUMMY.scale.set(0.34 + pulse * 0.08, 1.55 + pulse * 0.7, 0.34 + pulse * 0.08);
      }
      if (style.effect === 'sand') {
        EXPLOSION_DUMMY.position.set(wx, 0.24 + pulse * 0.12, wz);
        EXPLOSION_DUMMY.scale.set(1.2 + pulse * 0.35, 0.46 + pulse * 0.22, 1.2 + pulse * 0.35);
      }
      if (style.effect === 'clay') {
        EXPLOSION_DUMMY.position.set(wx, 0.5 + pulse * 0.16, wz);
        EXPLOSION_DUMMY.scale.set(1.28 + pulse * 0.35, 1.18 + pulse * 0.45, 1.28 + pulse * 0.35);
      }
      if (style.effect === 'rasengan') {
        EXPLOSION_DUMMY.position.set(wx, 0.42 + pulse * 0.14, wz);
        EXPLOSION_DUMMY.scale.set(0.72 + pulse * 0.5, 0.72 + pulse * 0.5, 0.72 + pulse * 0.5);
      }
      if (style.effect === 'genjutsu') {
        EXPLOSION_DUMMY.position.set(wx, 0.42 + pulse * 0.12, wz);
        EXPLOSION_DUMMY.scale.set(0.74 + pulse * 0.18, 1.15 + pulse * 0.4, 0.74 + pulse * 0.18);
      }
      if (style.effect === 'teleport') {
        EXPLOSION_DUMMY.position.set(wx, 0.34 + pulse * 0.2, wz);
        EXPLOSION_DUMMY.scale.set(0.62 + pulse * 0.32, 0.82 + pulse * 0.4, 0.62 + pulse * 0.32);
      }
      EXPLOSION_DUMMY.rotation.set(0, progress * Math.PI * 2, 0);
      EXPLOSION_DUMMY.updateMatrix();
      flameRef.current?.setMatrixAt(index, EXPLOSION_DUMMY.matrix);
      flameRef.current?.setColorAt(index, EXPLOSION_COLOR);

      EXPLOSION_COLOR.set(style.emissive);

      EXPLOSION_DUMMY.position.set(wx, 0.16, wz);
      EXPLOSION_DUMMY.scale.setScalar(0.65 + progress * 1.4);
      EXPLOSION_DUMMY.rotation.set(-Math.PI / 2, 0, progress * Math.PI);
      EXPLOSION_DUMMY.updateMatrix();
      shockwaveRef.current?.setMatrixAt(index, EXPLOSION_DUMMY.matrix);
      shockwaveRef.current?.setColorAt(index, EXPLOSION_COLOR);

      EXPLOSION_DUMMY.position.set(wx, 0.14, wz);
      EXPLOSION_DUMMY.scale.setScalar(0.7 + pulse * 0.25);
      EXPLOSION_DUMMY.rotation.set(-Math.PI / 2, 0, 0);
      EXPLOSION_DUMMY.updateMatrix();
      ringRef.current?.setMatrixAt(index, EXPLOSION_DUMMY.matrix);
      ringRef.current?.setColorAt(index, EXPLOSION_COLOR);

      EXPLOSION_COLOR.set(style.accent);
      if (style.effect === 'lightning') {
        EXPLOSION_DUMMY.position.set(wx, 0.68 + pulse * 0.28, wz);
        EXPLOSION_DUMMY.scale.set(0.13, 1.25 + pulse * 0.85, 0.13);
        EXPLOSION_DUMMY.rotation.set(progress * Math.PI, progress * Math.PI * 3, index * 0.7);
      } else if (style.effect === 'rasengan') {
        EXPLOSION_DUMMY.position.set(
          wx + Math.sin(progress * Math.PI * 6 + index) * 0.24,
          0.44 + pulse * 0.25,
          wz + Math.cos(progress * Math.PI * 6 + index) * 0.24
        );
        EXPLOSION_DUMMY.scale.set(0.14 + pulse * 0.04, 0.9 + pulse * 0.35, 0.14 + pulse * 0.04);
        EXPLOSION_DUMMY.rotation.set(Math.PI / 2, progress * Math.PI * 7, index * 0.9);
      } else if (style.effect === 'genjutsu') {
        EXPLOSION_DUMMY.position.set(wx + Math.cos(index) * 0.22, 0.46, wz + Math.sin(index) * 0.22);
        EXPLOSION_DUMMY.scale.set(0.28 + pulse * 0.08, 0.62, 0.1);
        EXPLOSION_DUMMY.rotation.set(0.2, progress * Math.PI * 4, index * 1.2);
      } else if (style.effect === 'teleport') {
        EXPLOSION_DUMMY.position.set(wx, 0.3 + pulse * 0.18, wz);
        EXPLOSION_DUMMY.scale.set(0.12, 0.68 + pulse * 0.3, 0.12);
        EXPLOSION_DUMMY.rotation.set(Math.PI / 2, 0, progress * Math.PI * 6);
      } else if (style.effect === 'clay') {
        EXPLOSION_DUMMY.position.set(wx, 0.72 + pulse * 0.24, wz);
        EXPLOSION_DUMMY.scale.set(0.2 + pulse * 0.06, 1.0 + pulse * 0.45, 0.2 + pulse * 0.06);
        EXPLOSION_DUMMY.rotation.set(0, progress * Math.PI * 3, index * 0.5);
      } else {
        EXPLOSION_DUMMY.position.set(wx, 0.52, wz);
        EXPLOSION_DUMMY.scale.setScalar(0.001);
        EXPLOSION_DUMMY.rotation.set(0, 0, 0);
      }
      EXPLOSION_DUMMY.updateMatrix();
      accentRef.current?.setMatrixAt(index, EXPLOSION_DUMMY.matrix);
      accentRef.current?.setColorAt(index, EXPLOSION_COLOR);

      EXPLOSION_COLOR.set(style.effect === 'sand' ? '#8b5e34' : style.accent);
      if (style.effect === 'sand' || style.effect === 'clay' || style.effect === 'lightning' || style.effect === 'rasengan') {
        EXPLOSION_DUMMY.position.set(
          wx + Math.sin(index * 1.8) * (0.2 + progress * 0.4),
          0.18 + pulse * 0.32,
          wz + Math.cos(index * 1.8) * (0.2 + progress * 0.4)
        );
        let debrisScale = 0.1;
        if (style.effect === 'sand') debrisScale = 0.14;
        if (style.effect === 'lightning') debrisScale = 0.085;
        if (style.effect === 'rasengan') debrisScale = 0.075;
        EXPLOSION_DUMMY.scale.setScalar(debrisScale + pulse * 0.09);
        EXPLOSION_DUMMY.rotation.set(progress * Math.PI * 2, index * 0.9, progress * Math.PI);
      } else if (style.effect === 'genjutsu') {
        EXPLOSION_DUMMY.position.set(
          wx + Math.sin(index * 2.6 + progress * 4) * 0.34,
          0.32 + pulse * 0.24,
          wz + Math.cos(index * 2.6 + progress * 4) * 0.34
        );
        EXPLOSION_DUMMY.scale.set(0.16 + pulse * 0.08, 0.28, 0.08);
        EXPLOSION_DUMMY.rotation.set(0.5, progress * Math.PI * 4, index * 1.1);
      } else {
        EXPLOSION_DUMMY.position.set(wx, 0.14, wz);
        EXPLOSION_DUMMY.scale.setScalar(0.001);
        EXPLOSION_DUMMY.rotation.set(0, 0, 0);
      }
      EXPLOSION_DUMMY.updateMatrix();
      debrisRef.current?.setMatrixAt(index, EXPLOSION_DUMMY.matrix);
      debrisRef.current?.setColorAt(index, EXPLOSION_COLOR);

      if (pulse > strongestLight) {
        strongestLight = pulse;
        strongestLightPosition = [wx, 1.1, wz];
        strongestLightColor = style.emissive;
      }
    }

    Array.from(agesRef.current.keys()).forEach((key) => {
      if (activeKeys.has(key)) return;
      agesRef.current.delete(key);
      ticksRef.current.delete(key);
    });

    [flameRef.current, shockwaveRef.current, ringRef.current, accentRef.current, debrisRef.current].forEach((mesh) => {
      if (!mesh) return;
      const instancedMesh = mesh;
      instancedMesh.count = count;
      // Upload only the live instances: flagging the whole 512-instance
      // buffers sent ~190 KB to the GPU every frame, even with no explosions.
      if (count === 0) return;
      instancedMesh.instanceMatrix.addUpdateRange(0, count * 16);
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) {
        instancedMesh.instanceColor.addUpdateRange(0, count * 3);
        instancedMesh.instanceColor.needsUpdate = true;
      }
    });

    if (lightRef.current) {
      lightRef.current.intensity = strongestLight * 2.1;
      lightRef.current.color.set(strongestLightColor);
      if (strongestLightPosition) {
        lightRef.current.position.set(...strongestLightPosition);
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

type CharacterVisual = (typeof CHARACTER_VISUALS)[CharacterId];

function CharacterHair({
  characterId,
  visual,
  ghost,
}: {
  characterId: CharacterId;
  visual: CharacterVisual;
  ghost: boolean;
}) {
  const hair = fighterToonMaterial(visual.hair, { ghost });

  if (characterId === 'naruto' || characterId === 'minato') {
    const spikes = characterId === 'naruto'
      ? [-0.22, -0.11, 0, 0.11, 0.22]
      : [-0.26, -0.14, 0, 0.14, 0.26];
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.08, 0.58, 0.95]} material={hair} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
        </mesh>
        {spikes.map((side) => (
          <mesh
            key={`${characterId}-hair-spike-${side}`}
            position={[side, 0.58 - Math.abs(side) * 0.12, 0.03]}
            rotation={[0.38, side * 3.2, side > 0 ? -0.64 : 0.64]}
            material={hair}
            castShadow
          >
            <coneGeometry args={[0.07, characterId === 'minato' ? 0.3 : 0.24, 8]} />
          </mesh>
        ))}
      </>
    );
  }

  if (characterId === 'sasuke') {
    const spikes = [
      { position: [-0.2, 0.5, -0.04], rotation: [0.2, -0.9, 0.8] },
      { position: [-0.08, 0.58, -0.08], rotation: [0.05, -0.3, 0.35] },
      { position: [0.1, 0.58, -0.08], rotation: [0.05, 0.3, -0.35] },
      { position: [0.22, 0.5, -0.04], rotation: [0.2, 0.9, -0.8] },
    ];
    return (
      <>
        <mesh position={[0, 0.45, -0.04]} scale={[1.12, 0.62, 0.95]} material={hair} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
        </mesh>
        {spikes.map((spike, index) => (
          <mesh
            key={`sasuke-hair-${index}`}
            position={spike.position as [number, number, number]}
            rotation={spike.rotation as [number, number, number]}
            material={hair}
            castShadow
          >
            <coneGeometry args={[0.075, 0.3, 8]} />
          </mesh>
        ))}
      </>
    );
  }

  if (characterId === 'deidara') {
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.1, 0.58, 0.95]} material={hair} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
        </mesh>
        <mesh position={[-0.05, 0.65, -0.04]} material={hair} castShadow>
          <sphereGeometry args={[0.13, 14, 14]} />
        </mesh>
        <mesh position={[0.17, 0.34, 0.08]} rotation={[0.28, 0, -0.18]} material={hair} castShadow>
          <capsuleGeometry args={[0.04, 0.38, 5, 8]} />
        </mesh>
      </>
    );
  }

  if (characterId === 'gaara') {
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.02, 0.52, 0.92]} material={hair} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
        </mesh>
        {[-0.14, 0, 0.14].map((side) => (
          <mesh
            key={`gaara-hair-${side}`}
            position={[side, 0.56, 0.04]}
            rotation={[0.62, side * 2.2, side > 0 ? -0.4 : 0.4]}
            material={hair}
            castShadow
          >
            <coneGeometry args={[0.055, 0.2, 7]} />
          </mesh>
        ))}
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 0.45, -0.03]} scale={[1.06, 0.6, 0.95]} material={hair} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
      </mesh>
      <mesh position={[-0.15, 0.28, 0.02]} rotation={[0.12, 0, 0.2]} material={hair} castShadow>
        <capsuleGeometry args={[0.045, 0.34, 5, 8]} />
      </mesh>
      <mesh position={[0.15, 0.28, 0.02]} rotation={[0.12, 0, -0.2]} material={hair} castShadow>
        <capsuleGeometry args={[0.045, 0.34, 5, 8]} />
      </mesh>
    </>
  );
}

function CharacterAccessory({
  characterId,
  visual,
  ghost,
}: {
  characterId: CharacterId;
  visual: CharacterVisual;
  ghost: boolean;
}) {
  if (characterId === 'naruto') {
    // Face marks stay solid under Ghost, as before.
    const mark = fighterToonMaterial('#111827');
    return (
      <>
        {[-0.1, 0.1].map((side) => (
          <React.Fragment key={`naruto-face-${side}`}>
            <mesh position={[side, 0.31, 0.205]} rotation={[0, 0, side > 0 ? 0.2 : -0.2]} material={mark}>
              <boxGeometry args={[0.07, 0.008, 0.012]} />
            </mesh>
            <mesh position={[side, 0.27, 0.205]} rotation={[0, 0, side > 0 ? -0.2 : 0.2]} material={mark}>
              <boxGeometry args={[0.07, 0.008, 0.012]} />
            </mesh>
          </React.Fragment>
        ))}
      </>
    );
  }

  if (characterId === 'sasuke') {
    return (
      <>
        <mesh
          position={[0, -0.19, 0.16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={fighterToonMaterial(visual.trim, { ghost, glow: visual.trim, glowIntensity: 0.18 })}
        >
          <torusGeometry args={[0.24, 0.035, 8, 28]} />
        </mesh>
        <mesh position={[0, -0.2, 0.2]} rotation={[0.2, 0, 0]} material={fighterToonMaterial(visual.trim, { ghost })}>
          <boxGeometry args={[0.46, 0.05, 0.04]} />
        </mesh>
      </>
    );
  }

  if (characterId === 'deidara') {
    return (
      <>
        <mesh
          position={[-0.24, 0.13, 0.02]}
          scale={[0.8, 0.55, 0.7]}
          material={fighterToonMaterial('#f8fafc', { ghost, glow: '#f97316', glowIntensity: 0.12 })}
          castShadow
        >
          <sphereGeometry args={[0.11, 12, 12]} />
        </mesh>
        <mesh position={[-0.28, 0.14, 0.12]} rotation={[0.2, 0, 0.6]} material={fighterToonMaterial('#f8fafc', { ghost })}>
          <coneGeometry args={[0.035, 0.16, 8]} />
        </mesh>
      </>
    );
  }

  if (characterId === 'gaara') {
    return (
      <group position={[0.24, 0.06, -0.2]} rotation={[0.18, 0.5, -0.28]}>
        <mesh material={fighterToonMaterial('#9a5f2b', { ghost, glow: '#d6a45d', glowIntensity: 0.08 })} castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={fighterToonMaterial('#2f1c16', { ghost })}>
          <torusGeometry args={[0.14, 0.018, 8, 24]} />
        </mesh>
      </group>
    );
  }

  if (characterId === 'minato') {
    return (
      <>
        <mesh
          position={[0, -0.08, -0.16]}
          rotation={[0.15, 0, 0]}
          material={fighterToonMaterial('#f8fafc', { ghost, glow: '#fde047', glowIntensity: 0.06 })}
          castShadow
        >
          <boxGeometry args={[0.58, 0.68, 0.045]} />
        </mesh>
        <mesh position={[0, 0.08, -0.19]} material={fighterToonMaterial('#dc2626', { ghost })}>
          <boxGeometry args={[0.5, 0.06, 0.05]} />
        </mesh>
      </>
    );
  }

  if (characterId === 'itachi') {
    const cloud = fighterToonMaterial('#dc2626', { ghost, glow: '#ef4444', glowIntensity: 0.28 });
    return (
      <>
        {[-0.12, 0.12].map((side) => (
          <mesh key={`itachi-cloud-${side}`} position={[side, 0.0, 0.2]} material={cloud}>
            <sphereGeometry args={[0.055, 10, 10]} />
          </mesh>
        ))}
        <mesh
          position={[0, -0.22, -0.02]}
          scale={[1.05, 0.72, 0.92]}
          material={fighterToonMaterial('#050507', { ghost })}
          castShadow
        >
          <sphereGeometry args={[0.22, 12, 12]} />
        </mesh>
      </>
    );
  }

  return null;
}

function createFittedSceneModel(asset: SceneModelAsset): THREE.Group {
  const clone = cloneSkeleton(asset.scene) as THREE.Group;
  const model = new THREE.Group();
  const rotation = asset.config.rotation ?? [0, 0, 0];
  configureModelMeshes(clone, true);
  shareSkeletons(clone);
  clone.rotation.set(rotation[0], rotation[1], rotation[2]);
  model.add(clone);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);

  clone.position.x -= center.x;
  clone.position.y -= bounds.min.y;
  clone.position.z -= center.z;
  model.scale.setScalar((asset.config.height / Math.max(size.y, 0.001)) * (asset.config.scale ?? 1));
  model.position.y = asset.config.footY ?? -0.56;

  return model;
}

function LoadedSceneModel({
  asset,
  ghost,
  motionRef,
  warmGhostVariant = false,
}: {
  asset: SceneModelAsset;
  ghost: boolean;
  motionRef?: React.MutableRefObject<number>;
  /** Precompile the Ghost (transparent) look of the model's materials. */
  warmGhostVariant?: boolean;
}) {
  const model = useMemo(() => createFittedSceneModel(asset), [asset]);
  useTransparencyVariantWarmup(model, warmGhostVariant);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<{
    idle?: THREE.AnimationAction;
    move?: THREE.AnimationAction;
    fallback?: THREE.AnimationAction;
  } | null>(null);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(model);
    const idleClip = findCharacterClip(asset.animations, /idle|stand|breath/i);
    const moveClip = findCharacterClip(asset.animations, /run|walk|move|sprint/i);
    const fallbackClip = asset.animations[0];
    const idle = idleClip ? mixer.clipAction(idleClip).play() : undefined;
    const move = moveClip && moveClip !== idleClip ? mixer.clipAction(moveClip).play() : undefined;
    const fallback = !idle && !move && fallbackClip ? mixer.clipAction(fallbackClip).play() : undefined;

    if (idle) idle.setEffectiveWeight(1);
    if (move) move.setEffectiveWeight(0);
    if (fallback) fallback.setEffectiveWeight(1);

    mixerRef.current = mixer;
    actionsRef.current = { idle, move, fallback };

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      mixerRef.current = null;
      actionsRef.current = null;
      // Each mount clones its own skeletons; free their bone textures, which
      // otherwise piled up every time a GLB ninja died and respawned.
      disposeModelSkeletons(model);
    };
  }, [asset.animations, model]);

  useEffect(() => {
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;

      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((sourceMaterial) => {
        const material = sourceMaterial;
        material.transparent = ghost;
        material.opacity = ghost ? 0.56 : 1;
        material.depthWrite = !ghost;
      });
    });
  }, [ghost, model]);

  useFrame((_, delta) => {
    const movement = THREE.MathUtils.clamp(motionRef?.current ?? 0, 0, 1);
    const actions = actionsRef.current;
    if (actions?.idle && actions.move) {
      actions.idle.setEffectiveWeight(1 - movement);
      actions.move.setEffectiveWeight(movement);
      actions.move.timeScale = 0.8 + movement * 0.85;
    } else if (actions?.fallback) {
      actions.fallback.timeScale = 0.72 + movement * 0.72;
    }
    mixerRef.current?.update(delta);
  });

  return <primitive object={model} />;
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
}: {
  player: PlayerState;
  state: GameEngineState;
  slot?: number;
  cpu?: boolean;
  pickupChips?: Map<Power, PlayerTagSprite>;
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
    ink: { fighterInk: player.id },
  }), [player.id]);
  const motionId = useMemo(() => playerMotionId(player.id), [player.id]);
  const motion = React.useContext(MotionContext);
  const motionRef = useRef(0);
  const ghost = isPowerUpActive(state, player.id, 'Ghost');
  const invincible = isPowerUpActive(state, player.id, 'Invincibility');
  const visual = CHARACTER_VISUALS[player.characterId];
  const characterModel = useCharacterModel(player.characterId);
  // The ink hull is built from the first figure of each character to mount
  // (in the countdown) and shared by every later one.
  const figureRef = useRef<THREE.Group>(null);
  const [inkHull, setInkHull] = useState(() => cachedInkHull(player.characterId));
  useLayoutEffect(() => {
    setInkHull(inkHullFor(player.characterId, figureRef.current));
  }, [player.characterId, characterModel]);
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

  // Toggling `transparent` changes the shader's OPAQUE define, which three.js
  // only picks up after needsUpdate. A light-count change used to force that
  // recompile by accident; with a fixed light pool it has to be explicit.
  // Child effects (LoadedSceneModel) run first, so their flags are already set.
  useEffect(() => {
    bodyRef.current?.traverse((object) => {
      const { material } = object as THREE.Mesh;
      if (!material) return;
      (Array.isArray(material) ? material : [material]).forEach((entry) => {
        const target = entry;
        target.needsUpdate = true;
      });
    });
  }, [ghost]);

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

    if (invincible) {
      body.visible = Math.sin(clock.elapsedTime * 10) > 0;
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
        {slot !== undefined && <PlayerTag slot={slot} color={playerSlotColor(slot - 1)} cpu={cpu} />}
        <group ref={poseRef} position={[0, FEET_Y, 0]}>
          <group position={[0, -FEET_Y, 0]}>
            {characterModel ? (
              <LoadedSceneModel asset={characterModel} ghost={ghost} motionRef={motionRef} warmGhostVariant />
            ) : (
              <>
                <group ref={figureRef}>
                  <mesh
                    position={[0, -0.04, 0]}
                    material={fighterToonMaterial(visual.body, { ghost, glow: visual.body })}
                    castShadow
                  >
                    <capsuleGeometry args={[0.19, 0.26, 6, 10]} />
                  </mesh>
                  <mesh
                    position={[0, -0.08, 0.16]}
                    material={fighterToonMaterial(visual.trim, { ghost, glow: visual.trim })}
                    castShadow
                  >
                    <boxGeometry args={[0.38, 0.26, 0.035]} />
                  </mesh>
                  <mesh position={[0, 0.32, 0.02]} material={fighterToonMaterial('#f2c7a2', { ghost })} castShadow>
                    <sphereGeometry args={[0.225, 10, 8]} />
                  </mesh>
                  <CharacterHair characterId={player.characterId} visual={visual} ghost={ghost} />
                  <mesh
                    position={[0, 0.35, 0.2]}
                    material={fighterToonMaterial(visual.headband, { ghost, glow: visual.headband, glowIntensity: 0.18 })}
                    castShadow
                  >
                    <boxGeometry args={[0.42, 0.055, 0.04]} />
                  </mesh>
                  <mesh position={[0, 0.35, 0.225]} material={fighterToonMaterial('#d1d5db', { ghost })} castShadow>
                    <boxGeometry args={[0.16, 0.05, 0.018]} />
                  </mesh>
                  {[-0.22, 0.22].map((side) => (
                    <mesh
                      key={`${player.id}-arm-${side}`}
                      position={[side, 0.04, 0.04]}
                      rotation={[0.35, 0, side > 0 ? -0.55 : 0.55]}
                      material={fighterToonMaterial(visual.accent, { ghost })}
                      castShadow
                    >
                      <capsuleGeometry args={[0.055, 0.34, 5, 8]} />
                    </mesh>
                  ))}
                  {[-0.09, 0.09].map((side) => (
                    <mesh
                      key={`${player.id}-leg-${side}`}
                      position={[side, -0.36, 0.02]}
                      rotation={[0.18, 0, side > 0 ? -0.08 : 0.08]}
                      material={fighterToonMaterial(visual.body, { ghost })}
                      castShadow
                    >
                      <capsuleGeometry args={[0.052, 0.34, 5, 8]} />
                    </mesh>
                  ))}
                  {[-0.1, 0.1].map((side) => (
                    <mesh
                      key={`${player.id}-shoe-${side}`}
                      position={[side, -0.55, 0.1]}
                      rotation={[0.2, 0, 0]}
                      material={fighterToonMaterial('#111827', { ghost })}
                      castShadow
                    >
                      <boxGeometry args={[0.13, 0.06, 0.2]} />
                    </mesh>
                  ))}
                  {[-0.09, 0.09].map((side) => (
                    <mesh key={`${player.id}-eye-${side}`} position={[side, 0.34, 0.17]} material={fighterToonMaterial('#111827')}>
                      <sphereGeometry args={[0.025, 8, 8]} />
                    </mesh>
                  ))}
                  <CharacterAccessory characterId={player.characterId} visual={visual} ghost={ghost} />
                  <mesh
                    position={[0, -0.27, -0.08]}
                    rotation={[Math.PI / 2, 0, Math.PI / 2]}
                    material={fighterToonMaterial(visual.accent, { glow: visual.accent, glowIntensity: 0.12 })}
                    castShadow
                  >
                    <cylinderGeometry args={[0.075, 0.075, 0.42, 12]} />
                  </mesh>
                </group>
                {/* The ink line; Ghost drops it with the solid look. */}
                {inkHull && (
                  <mesh
                    geometry={inkHull}
                    material={FIGHTER_INK_MATERIAL}
                    visible={!ghost}
                    userData={marks.ink}
                  />
                )}
              </>
            )}
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

function MonsterNameplate({ monster }: { monster: MonsterState }) {
  let barWidth = 0.36;
  if (monster.kind === 'smart') barWidth = 0.44;
  if (monster.kind === 'fork') barWidth = 0.52;
  return (
    <group position={[0, 0.95, 0]} rotation={[-0.25, 0, 0]}>
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

function MonsterMeshBase({ monster }: { monster: MonsterState }) {
  const ref = useRef<THREE.Group>(null);
  const visual = MONSTER_VISUALS[monster.kind];
  const translucent = monsterIsTranslucent(monster);
  const reducedMotion = React.useContext(ReducedMotionContext);
  useSmoothWorldPosition(ref, monster.x, monster.y, 0.45, undefined, monsterMotionId(monster.id));

  return (
    <group ref={ref} scale={visual.scale * (monster.elite ? 1.12 : 1)}>
      <ShadowBlob />
      {monster.elite && (
        <mesh position={[0, -0.41, 0]} geometry={ELITE_BADGE_GEOMETRY} material={ELITE_BADGE_MATERIAL} />
      )}
      <MonsterFigure monster={monster} reducedMotion={reducedMotion} />
      <mesh
        position={[0, -0.39, 0]}
        geometry={MONSTER_RING_GEOMETRY}
        material={monsterRingMaterial(monster.kind, translucent)}
      />
      <MonsterAbilityWarning monster={monster} visual={visual} />
      <MonsterNameplate monster={monster} />
    </group>
  );
}

const MonsterMesh = React.memo(MonsterMeshBase, (previous, next) => (
  previous.monster.id === next.monster.id
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

function BossMesh({ state }: { state: GameEngineState }) {
  const { boss } = state;
  const ref = useRef<THREE.Group>(null);
  const bossModelConfig = boss && USE_ARCHIVE_MODELS ? BOSS_MODEL_CONFIGS[boss.id] : undefined;
  const bossModel = useSceneModel(
    boss && bossModelConfig ? `boss:${boss.id}` : null,
    bossModelConfig,
  );
  useSmoothWorldPosition(ref, boss?.x ?? 0, boss?.y ?? 0, 0.92, undefined, BOSS_MOTION_ID);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.92 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 1.8) * 0.025;
    }
  });

  if (!boss || boss.health <= 0) return null;

  const visual = BOSS_VISUALS[boss.id];
  const phasePulse = boss.phase > 1 ? 1.08 : 1;

  return (
    <group ref={ref} scale={visual.scale * phasePulse}>
      <PooledPointLight priority={LIGHT_PRIORITY.player} color={visual.glow} distance={5.2} intensity={1.25} />
      <ShadowBlob />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]}>
        <torusGeometry args={[0.62, 0.025, 8, 42]} />
        <meshStandardMaterial color={visual.glow} emissive={visual.glow} emissiveIntensity={1.05} transparent opacity={0.38} />
      </mesh>
      {bossModel ? (
        <LoadedSceneModel asset={bossModel} ghost={false} />
      ) : (
        <BossFigure bossId={boss.id} />
      )}
      {boss.phase > 1 && (
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
  // The floor shape that says which family this is, and when it can kill,
  // is drawn by HazardTelegraphs; this draws the effect above it.

  useFrame(({ clock }) => {
    if (ref.current) {
      let scale = 1;
      if (!reducedMotion && active) scale = 1.15;
      if (!reducedMotion && !active) scale = 0.85 + Math.sin(clock.elapsedTime * 8) * 0.08;
      ref.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * (active ? 2.6 : 1.5);
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

      {visual.effect === 'spikes' && [-0.24, 0, 0.24].map((offset) => (
        <mesh key={`sand-spike-${hazard.id}-${offset}`} position={[offset, active ? 0.24 : 0.08, 0]} rotation={[0.18, 0, offset > 0 ? -0.12 : 0.12]}>
          <coneGeometry args={[0.075, active ? 0.62 : 0.28, 7]} />
          <meshStandardMaterial color="#d6a45d" emissive={visual.color} emissiveIntensity={active ? 0.42 : 0.2} />
        </mesh>
      ))}

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

      {visual.effect === 'air' && (
        <>
          <mesh position={[0, 0.56, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.16, active ? 1.12 : 0.58, 7]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.color} emissiveIntensity={0.68} transparent opacity={active ? 0.5 : 0.26} />
          </mesh>
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

      {visual.effect === 'shockwave' && [0.26, 0.42].map((radius) => (
        <mesh key={`shock-${hazard.id}-${radius}`} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.022, 8, 34]} />
          <meshStandardMaterial color={effectColor} emissive={effectColor} emissiveIntensity={0.82} transparent opacity={active ? 0.54 : 0.28} />
        </mesh>
      ))}
    </group>
  );
}

function PowerupSymbol({
  power,
  accent,
}: {
  power: Power;
  accent: string;
}) {
  if (power === 'AddBomb') {
    return (
      <>
        <mesh position={[0, 0.13, 0.04]} castShadow>
          <sphereGeometry args={[0.075, 14, 14]} />
          <meshStandardMaterial color="#ffedd5" emissive={accent} emissiveIntensity={0.42} />
        </mesh>
        <mesh position={[0, 0.13, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.012, 6, 24]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
        </mesh>
      </>
    );
  }
  if (power === 'BlastRangeUp') {
    return (
      <>
        <mesh position={[0, 0.13, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.018, 8, 28]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0.08, 0.13, 0.04]} rotation={[0, 0, -0.8]}>
          <coneGeometry args={[0.04, 0.18, 3]} />
          <meshStandardMaterial color="#ecfccb" emissive={accent} emissiveIntensity={0.48} />
        </mesh>
      </>
    );
  }
  if (power === 'Detonator') {
    return (
      <mesh position={[0, 0.13, 0.04]}>
        <boxGeometry args={[0.08, 0.24, 0.035]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
    );
  }
  if (power === 'RollerSkate') {
    return (
      <mesh position={[0, 0.13, 0.04]} rotation={[0, 0, -0.8]}>
        <coneGeometry args={[0.08, 0.24, 3]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
      </mesh>
    );
  }
  if (power === 'Invincibility') {
    return (
      <group position={[0, 0.13, 0.04]}>
        <mesh rotation={[0.2, 0.4, 0]}>
          <octahedronGeometry args={[0.13, 0]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.62} transparent opacity={0.86} />
        </mesh>
        <mesh position={[0.07, -0.02, 0]} rotation={[0.4, -0.2, 0.6]}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial color="#c4b5fd" emissive={accent} emissiveIntensity={0.45} transparent opacity={0.8} />
        </mesh>
      </group>
    );
  }
  if (power === 'Ghost') {
    return (
      <>
        <mesh position={[0, 0.13, 0.04]}>
          <sphereGeometry args={[0.11, 14, 14]} />
          <meshStandardMaterial color="#dcfce7" emissive={accent} emissiveIntensity={0.75} transparent opacity={0.62} />
        </mesh>
        <mesh position={[0, 0.13, 0.16]}>
          <boxGeometry args={[0.18, 0.035, 0.02]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
        </mesh>
      </>
    );
  }
  if (power === 'Rasengan') {
    return (
      <group position={[0, 0.13, 0.04]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.018, 8, 30]} />
          <meshStandardMaterial color="#dbeafe" emissive={accent} emissiveIntensity={0.9} />
        </mesh>
        <mesh>
          <sphereGeometry args={[0.08, 14, 14]} />
          <meshStandardMaterial color="#eff6ff" emissive={accent} emissiveIntensity={0.75} transparent opacity={0.72} />
        </mesh>
      </group>
    );
  }
  if (power === 'Sharingan') {
    return (
      <group position={[0, 0.13, 0.04]}>
        <mesh>
          <sphereGeometry args={[0.13, 18, 18]} />
          <meshStandardMaterial color="#ef4444" emissive={accent} emissiveIntensity={0.72} />
        </mesh>
        {[0, 1, 2].map((index) => {
          const angle = index * ((Math.PI * 2) / 3);
          return (
            <mesh
              key={`sharingan-dot-${index}`}
              position={[
                Math.cos(angle) * 0.065,
                Math.sin(angle) * 0.065,
                0.08,
              ]}
            >
              <sphereGeometry args={[0.022, 8, 8]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (power === 'FTGKunai') {
    return (
      <group position={[0, 0.13, 0.04]} rotation={[0, 0, -0.5]}>
        <mesh>
          <coneGeometry args={[0.055, 0.28, 4]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.28} emissive={accent} emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0, -0.14, 0]}>
          <boxGeometry args={[0.035, 0.16, 0.028]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.48} />
        </mesh>
      </group>
    );
  }
  if (power === 'CrowFeather') {
    return (
      <group position={[0, 0.12, 0.04]} rotation={[0.2, 0.1, -0.35]}>
        <mesh>
          <coneGeometry args={[0.055, 0.34, 8]} />
          <meshStandardMaterial color="#111827" emissive={accent} emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[0.08, 0.04, 0]}>
          <coneGeometry args={[0.03, 0.2, 8]} />
          <meshStandardMaterial color="#374151" emissive={accent} emissiveIntensity={0.28} />
        </mesh>
      </group>
    );
  }
  if (power === 'SandArmor') {
    return (
      <group position={[0, 0.13, 0.04]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.13, 0.026, 8, 28]} />
          <meshStandardMaterial color="#c48a4a" emissive={accent} emissiveIntensity={0.56} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[0.1, 0]} />
          <meshStandardMaterial color="#f5deb3" emissive="#f59e0b" emissiveIntensity={0.32} />
        </mesh>
      </group>
    );
  }
  if (power === 'ClaySpider') {
    return (
      <group position={[0, 0.12, 0.04]}>
        <mesh>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color="#f5efe0" emissive={accent} emissiveIntensity={0.38} />
        </mesh>
        {[-0.12, -0.06, 0.06, 0.12].map((offset) => (
          <mesh key={`clay-leg-${offset}`} position={[offset, -0.02, 0]} rotation={[0, 0, offset > 0 ? -0.8 : 0.8]}>
            <capsuleGeometry args={[0.012, 0.14, 4, 6]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        ))}
      </group>
    );
  }
  if (power === 'ChakraScroll' || power === 'CharacterFragment') {
    return (
      <group position={[0, 0.13, 0.04]}>
        <mesh rotation={[0.3, 0.4, 0.2]}>
          <octahedronGeometry args={[power === 'CharacterFragment' ? 0.14 : 0.1, 0]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.72} transparent opacity={0.84} />
        </mesh>
        <mesh position={[0.09, -0.03, 0.04]}>
          <octahedronGeometry args={[0.055, 0]} />
          <meshStandardMaterial color="#fef3c7" emissive={accent} emissiveIntensity={0.42} />
        </mesh>
      </group>
    );
  }
  return (
    <group position={[0, 0.12, 0.04]}>
      <mesh>
        <dodecahedronGeometry args={[0.11, 0]} />
        <meshStandardMaterial color="#8b6f47" emissive={accent} emissiveIntensity={0.18} />
      </mesh>
      <mesh position={[0.09, -0.03, 0.04]}>
        <dodecahedronGeometry args={[0.065, 0]} />
        <meshStandardMaterial color="#6b4f3a" />
      </mesh>
    </group>
  );
}

type PowerUpVisual = (typeof POWERUP_VISUALS)[Power];

function PowerUpBody({ visual }: { visual: PowerUpVisual }) {
  if (visual.shape === 'fragment') {
    return (
      <group position={[0, 0.07, 0]}>
        <mesh rotation={[0.2, 0.5, 0.2]} castShadow>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.45} transparent opacity={0.84} />
        </mesh>
        <mesh position={[-0.15, -0.02, 0.03]} rotation={[0.5, -0.2, 0.8]} castShadow>
          <octahedronGeometry args={[0.11, 0]} />
          <meshStandardMaterial color="#c4b5fd" emissive={visual.glow} emissiveIntensity={0.28} transparent opacity={0.78} />
        </mesh>
        <mesh position={[0.15, 0.01, -0.04]} rotation={[-0.3, 0.3, -0.6]} castShadow>
          <octahedronGeometry args={[0.09, 0]} />
          <meshStandardMaterial color="#6d28d9" emissive={visual.glow} emissiveIntensity={0.28} transparent opacity={0.74} />
        </mesh>
      </group>
    );
  }

  if (visual.shape === 'charm') {
    return (
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.34, 0.42, 0.07]} />
        <meshStandardMaterial color={visual.paper} emissive={visual.glow} emissiveIntensity={0.12} roughness={0.55} />
      </mesh>
    );
  }

  if (visual.shape === 'tag') {
    return (
      <>
        <mesh position={[0, 0.07, 0]} castShadow>
          <boxGeometry args={[0.28, 0.48, 0.055]} />
          <meshStandardMaterial color={visual.paper} roughness={0.62} emissive={visual.glow} emissiveIntensity={0.08} />
        </mesh>
        <mesh position={[0, 0.08, 0.04]}>
          <boxGeometry args={[0.2, 0.05, 0.02]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0, -0.03, 0.04]}>
          <boxGeometry args={[0.15, 0.14, 0.02]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.24} />
        </mesh>
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 0.07, 0]} castShadow>
        <boxGeometry args={[0.46, 0.28, 0.06]} />
        <meshStandardMaterial color={visual.paper} roughness={0.62} />
      </mesh>
      <mesh position={[-0.27, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
        <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.27, 0.07, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.055, 0.16, 12]} />
        <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.2} />
      </mesh>
    </>
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
  const ref = useRef<THREE.Group>(null);
  const reducedMotion = React.useContext(ReducedMotionContext);
  const [wx, , wz] = toWorld(x, y);
  const theme = getCharacterPowerTheme(characterId, power);
  const baseVisual = POWERUP_VISUALS[power];
  const visual = {
    ...baseVisual,
    paper: theme.paper,
    accent: theme.color,
    glow: theme.accent,
  };
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = reducedMotion
        ? 0.35
        : 0.35 + Math.sin(clock.elapsedTime * 3) * 0.08;
      ref.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime;
    }
  });
  return (
    <group ref={ref} position={[wx, 0.35, wz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]}>
        <ringGeometry args={[0.18, 0.38, 24]} />
        <meshStandardMaterial
          color={visual.glow}
          emissive={visual.glow}
          emissiveIntensity={0.75}
          transparent
          opacity={0.34}
        />
      </mesh>
      <PowerUpBody visual={visual} />
      <mesh position={[0, -0.08, 0.04]} castShadow>
        <boxGeometry args={[0.52, 0.035, 0.035]} />
        <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.25} />
      </mesh>
      <PowerupSymbol power={power} accent={visual.accent} />
    </group>
  );
}

function MissionRescueMarker({ target }: { target: CampaignRescueTargetState }) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(target.x, target.y);
  const { rescued } = target;
  const robe = rescued ? '#22c55e' : '#f8fafc';
  const accent = rescued ? '#86efac' : '#f97316';
  const label = rescued ? 'Safe' : target.label;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.4 + Math.sin(clock.elapsedTime * 4 + target.x) * 0.045;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 1.3 + target.y) * 0.22;
  });

  return (
    <group ref={ref} position={[wx, 0.4, wz]}>
      <PooledPointLight priority={LIGHT_PRIORITY.marker} color={accent} distance={2.2} intensity={rescued ? 0.55 : 1.05} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.38, 0]}>
        <ringGeometry args={[0.18, 0.5, 34]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={1}
          transparent
          opacity={rescued ? 0.42 : 0.72}
        />
      </mesh>
      {!rescued && (
        <mesh position={[0, 0.84, 0]} rotation={[0, 0, Math.PI]}>
          <coneGeometry args={[0.1, 0.34, 5]} />
          <meshStandardMaterial color="#fde68a" emissive="#f97316" emissiveIntensity={0.7} />
        </mesh>
      )}
      <ShadowBlob />
      <mesh position={[0, -0.08, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.42, 8, 16]} />
        <meshStandardMaterial
          color={robe}
          emissive={accent}
          emissiveIntensity={rescued ? 0.12 : 0.22}
          roughness={0.55}
        />
      </mesh>
      <mesh position={[0, 0.32, 0.02]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#f2c7a2" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.36, 0.18]} castShadow>
        <boxGeometry args={[0.34, 0.05, 0.035]} />
        <meshStandardMaterial color="#166534" emissive={accent} emissiveIntensity={0.16} />
      </mesh>
      {[-0.17, 0.17].map((side) => (
        <mesh
          key={`${target.id}-arm-${side}`}
          position={[side, 0.02, 0.03]}
          rotation={[0.25, 0, side > 0 ? -0.58 : 0.58]}
          castShadow
        >
          <capsuleGeometry args={[0.042, 0.26, 5, 8]} />
          <meshStandardMaterial color={rescued ? '#bbf7d0' : '#fed7aa'} roughness={0.5} />
        </mesh>
      ))}
      <group position={[0, 0.83, 0]}>
        <TextSprite text={label} color={rescued ? '#bbf7d0' : '#fff7ed'} width={0.82} />
      </group>
    </group>
  );
}

function MissionDefenseMarker({ objective }: { objective: CampaignObjectiveState }) {
  const ref = useRef<THREE.Group>(null);
  const x = objective.x ?? 0;
  const y = objective.y ?? 0;
  const [wx, , wz] = toWorld(x, y);
  const active = objective.status === 'active';
  const complete = objective.status === 'complete';
  let color = '#94a3b8';
  if (active) color = '#facc15';
  if (complete) color = '#22c55e';
  const label = objective.structureLabel ?? objective.label;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.6) * 0.08;
  });

  return (
    <group ref={ref} position={[wx, 0.34, wz]}>
      <PooledPointLight priority={LIGHT_PRIORITY.marker} color={color} distance={2.8} intensity={active ? 1.1 : 0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <ringGeometry args={[0.28, active ? 0.66 : 0.52, 34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} transparent opacity={active ? 0.58 : 0.34} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.72, 0.58, 0.72]} />
        <meshStandardMaterial color="#8b5e34" emissive={color} emissiveIntensity={0.12} roughness={0.62} />
      </mesh>
      <mesh position={[0, 0.44, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[0.6, 0.42, 4]} />
        <meshStandardMaterial color="#f97316" emissive={color} emissiveIntensity={0.2} roughness={0.58} />
      </mesh>
      <mesh position={[0, 0.12, 0.38]} castShadow>
        <boxGeometry args={[0.22, 0.28, 0.035]} />
        <meshStandardMaterial color="#111827" emissive="#facc15" emissiveIntensity={active ? 0.34 : 0.08} />
      </mesh>
      <group position={[0, 0.96, 0]}>
        <TextSprite text={label} color="#fff7ed" width={0.86} />
      </group>
    </group>
  );
}

function MissionMiniBossMarker({ objective }: { objective: CampaignObjectiveState }) {
  const ref = useRef<THREE.Group>(null);
  const x = objective.x ?? 0;
  const y = objective.y ?? 0;
  const [wx, , wz] = toWorld(x, y);
  const active = objective.status === 'active';
  const complete = objective.status === 'complete';
  const color = complete ? '#22c55e' : '#ef4444';
  const label = complete ? 'Gate Open' : objective.miniBossLabel ?? objective.label;

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = 0.46 + Math.sin(clock.elapsedTime * 3.6) * 0.035;
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 1.1) * 0.18;
  });

  return (
    <group ref={ref} position={[wx, 0.46, wz]}>
      <PooledPointLight priority={LIGHT_PRIORITY.marker} color={color} distance={2.4} intensity={active ? 1.1 : 0.45} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 0]}>
        <ringGeometry args={[0.22, active ? 0.58 : 0.44, 34]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} transparent opacity={active ? 0.68 : 0.38} />
      </mesh>
      <ShadowBlob />
      <mesh position={[0, -0.08, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.48, 8, 16]} />
        <meshStandardMaterial color="#166534" emissive={color} emissiveIntensity={0.2} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.35, 0.02]} castShadow>
        <sphereGeometry args={[0.17, 16, 16]} />
        <meshStandardMaterial color="#f2c7a2" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.39, 0.19]} castShadow>
        <boxGeometry args={[0.36, 0.05, 0.035]} />
        <meshStandardMaterial color="#111827" emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.25, 0.04, 0.08]} rotation={[0.3, 0, -0.72]} castShadow>
        <capsuleGeometry args={[0.04, 0.36, 5, 8]} />
        <meshStandardMaterial color="#f8fafc" emissive={color} emissiveIntensity={0.16} />
      </mesh>
      <mesh position={[0.36, 0.2, 0.1]} rotation={[0.2, 0, -0.7]} castShadow>
        <boxGeometry args={[0.08, 0.42, 0.035]} />
        <meshStandardMaterial color="#fde68a" emissive="#facc15" emissiveIntensity={0.5} />
      </mesh>
      <group position={[0, 0.86, 0]}>
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
  const ref = useRef<THREE.Group>(null);
  const { bossArena } = campaign;
  const [wx, , wz] = toWorld(bossArena.x, bossArena.y);
  const active = bossArena.unlocked;
  const visible = cellVisibleInSet(visibleCells, bossArena.x, bossArena.y);
  const color = active ? '#fb923c' : '#94a3b8';
  let label = campaign.bossGateLabel;
  if (active) {
    label = bossName ? `${bossName} Arena` : bossArena.label;
  }

  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.35;
    ref.current.position.y = 0.24 + Math.sin(clock.elapsedTime * 2.4) * 0.025;
  });

  if (!visible) return null;

  return (
    <group ref={ref} position={[wx, 0.24, wz]}>
      <PooledPointLight priority={LIGHT_PRIORITY.marker} color={color} distance={3.2} intensity={active ? 1.2 : 0.42} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <ringGeometry args={[0.42, active ? 0.82 : 0.66, 48]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.05} transparent opacity={active ? 0.66 : 0.32} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, -0.16, 0]}>
        <ringGeometry args={[0.18, 0.34, 36]} />
        <meshStandardMaterial color="#fef3c7" emissive={color} emissiveIntensity={0.8} transparent opacity={active ? 0.72 : 0.36} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => (
        <mesh
          key={`arena-seal-${rotation}`}
          position={[Math.sin(rotation) * 0.48, 0.06, Math.cos(rotation) * 0.48]}
          rotation={[0, rotation, 0]}
        >
          <boxGeometry args={[0.09, 0.26, 0.035]} />
          <meshStandardMaterial color="#fef3c7" emissive={color} emissiveIntensity={active ? 0.7 : 0.24} />
        </mesh>
      ))}
      <group position={[0, 0.58, 0]}>
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
          typeof objective.x === 'number'
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

type MapTilesProps = {
  map: GameMap;
  bombs: GameEngineState['bombs'];
  destroyedBoxes: GameEngineState['destroyedBoxes'];
  palette: StageDefinition['palette'];
  fogOfWar: GameEngineState['fogOfWar'];
  powerTheme?: CharacterId;
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
  powerTheme,
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
  const sensedWallSet = useMemo(
    () => new Set(fogOfWar.sensedWalls ?? []),
    [fogOfWar.sensedWalls],
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
  // per-cell objects stay as their own React elements.
  const cellObjects: React.ReactElement[] = [];
  map.forEach((row, y) => row.forEach((cell, x) => {
    const visibility = getVisibilityFromSets(visibleCellSet, exploredCellSet, x, y);
    if (visibility === 'hidden') {
      if (
        sensedWallSet.has(cellKey(x, y))
        && (cell === 'Wall' || cell === 'Box' || isObstacle(cell))
      ) {
        cellObjects.push(<SensedWallMarkerMemo key={`sensed-wall-${x}-${y}`} x={x} y={y} />);
      }
      return;
    }
    if (visibility !== 'visible') return;
    if (isPower(cell)) {
      cellObjects.push(
        <PowerUpMeshMemo key={`power-${x}-${y}`} x={x} y={y} power={cell} characterId={powerTheme} />
      );
    } else if (isBomb(cell)) {
      const bomb = bombByCell.get(`${x},${y}`);
      cellObjects.push(
        <BombMeshMemo key={`bomb-${x}-${y}`} x={x} y={y} kind={bomb?.kind ?? 'standard'} />
      );
    }
  }));

  return (
    <>
      <StaticTilesMemo
        map={map}
        palette={palette}
        visibleCells={visibleCellSet}
        exploredCells={exploredCellSet}
        destroyedCells={destroyedSet}
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
  && prev.powerTheme === next.powerTheme
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
  const lookAtRef = useRef(new THREE.Vector3());
  const lookTargetRef = useRef(new THREE.Vector3());
  const framingRef = useRef<number | null>(null);
  const shakeRef = useRef(0);
  // The HUD bands for this layout, and how far out this screen's shape
  // needs to zoom for the widest spread players can reach. The HUD is laid
  // out on the viewport; the canvas sits inside the arena frame.
  const frame = useMemo(() => {
    const insets = canvasHudInsets(preferences.hudScale, size.width, size.height);
    const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 16 / 9;
    return { insets, aspect, maxFraming: maxFramingFor(aspect, insets) };
  }, [preferences.hudScale, size.width, size.height]);

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
    const framingScale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
    // Aim a little off the box centre when its edge would sit under a HUD band.
    const shiftZ = groupShift(framingScale, halfWidth, halfDepth, insets) * TILE_SIZE;
    // `impact` holds for a moment and then drops to 0; fade out from it
    // instead of cutting off mid-swing.
    shakeRef.current = preferences.reducedMotion ? 0 : decayShake(shakeRef.current, impact, delta);
    const shakeStrength = shakeRef.current * (preferences.screenShake / 100) * 0.18;
    const shakeX = Math.sin(clock.elapsedTime * 83) * shakeStrength;
    const shakeZ = Math.cos(clock.elapsedTime * 71) * shakeStrength;

    // Smooth one follow point and hang the camera off it, so position and aim
    // move together. Aiming at the raw target while easing only the position
    // turned every 0.1-cell step into a ~7 px whole-screen jump.
    const lookAt = lookAtRef.current;
    const lookTarget = lookTargetRef.current.set(targetX, 0, targetZ + shiftZ);
    if (framingRef.current === null) {
      // Start from wherever the camera is aimed so the opening glide is kept.
      framingRef.current = camera.position.y / 13.2;
      lookAt.set(camera.position.x, 0, camera.position.z - 9.6 * framingRef.current);
    }
    // The rate follows the smoothed zoom: switching it on the target framing
    // changed the camera's speed by 40% in a single frame.
    const followAlpha = preferences.reducedMotion
      ? 1
      : 1 - Math.exp(-delta * cameraFollowRate(framingRef.current));
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
      pinRef.current.position.y = 1.95 + (reducedMotion ? 0 : Math.sin(clock.elapsedTime * 7) * 0.07);
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
const SCENE_CLOCK_KEYS = ['tick', 'rngSeed', 'roundElapsedMs', 'roundStartTicksRemaining'];

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
  const bossVisible = !!state.boss
    && !!bossCellKey
    && visibleCellSet.has(bossCellKey);
  const bossSensed = !!state.boss
    && !bossVisible
    && !!bossCellKey
    && sensedEnemyCells.has(bossCellKey);
  const multiplayer = state.players.length > 1;
  const motion = React.useContext(MotionContext);
  const cueChips = useCueChips(multiplayer ? state.players.length : 0);

  return (
    <LightPool>
      <ShaderWarmupMemo />
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
        powerTheme={state.players[0]?.characterId}
      />
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
        />
      ))}
      <KoMarkers players={state.players} chips={cueChips.ko} />
      {visibleMonsters.map((m) => (
        <MonsterMesh key={m.id} monster={m} />
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
};

const SceneCanvas = React.memo(({
  store, readState, preferences, impact, motion, idle, bombClock, sky,
}: SceneCanvasProps) => (
  <Canvas
    shadows
    dpr={[1, 1.35]}
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
    <ReducedMotionContext.Provider value={preferences.reducedMotion}>
      <MotionContext.Provider value={motion}>
        <BombClockContext.Provider value={bombClock}>
          <LiveStateContext.Provider value={readState}>
            <SceneFromStore store={store} preferences={preferences} impact={impact} />
          </LiveStateContext.Provider>
        </BombClockContext.Provider>
      </MotionContext.Provider>
    </ReducedMotionContext.Provider>
    {PERF_PROBE_ENABLED && <PerfProbe />}
  </Canvas>
));
SceneCanvas.displayName = 'SceneCanvas';

export function GameScene3D({
  state, preferences, impact = 0, motion = null, advanceFrame, liveState, idle,
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
    />
  );
}
