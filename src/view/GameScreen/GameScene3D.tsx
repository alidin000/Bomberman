/* eslint-disable react/no-unknown-property, react/no-array-index-key */
/* eslint-disable react/require-default-props, comma-dangle, max-len */
import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Canvas, useFrame, useLoader, useThree,
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
import { EXPLOSION_MS } from '../../engine/constants';
import { cellKey } from '../../engine/fogOfWar';
import { getStageDefinition } from '../../content';
import { getCharacterPowerTheme } from '../../content/characterPowerups';
import {
  BossId, CharacterId, StageDefinition, StageId
} from '../../content/types';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';

const TILE_SIZE = 1;
const MAP_OFFSET_X = -7;
const MAP_OFFSET_Z = -4.5;
const ENTITY_LERP_SPEED = 7.2;
const ENTITY_SNAP_EPSILON = 0.0016;

type TextureCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function toWorld(x: number, y: number): [number, number, number] {
  return [(x + MAP_OFFSET_X) * TILE_SIZE, 0, (y + MAP_OFFSET_Z) * TILE_SIZE];
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

const BEAST_TAILS: Record<MonsterKind, number> = {
  basic: 0,
  smart: 0,
  ghost: 0,
  fork: 0,
};

const MONSTER_VISUALS: Record<MonsterKind, {
  body: string;
  accent: string;
  belly: string;
  glow: string;
  scale: number;
  style: 'fox' | 'sand' | 'flame' | 'horn';
}> = {
  basic: {
    body: '#334155', accent: '#94a3b8', belly: '#111827', glow: '#f97316', scale: 1.08, style: 'fox'
  },
  smart: {
    body: '#c48a4a', accent: '#7c2d12', belly: '#f5deb3', glow: '#f59e0b', scale: 1.12, style: 'sand'
  },
  ghost: {
    body: '#1d4ed8', accent: '#7dd3fc', belly: '#dbeafe', glow: '#38bdf8', scale: 1.06, style: 'flame'
  },
  fork: {
    body: '#f8fafc', accent: '#a855f7', belly: '#1f2937', glow: '#a855f7', scale: 1.16, style: 'horn'
  },
};

const BOSS_VISUALS: Record<BossId, {
  body: string;
  accent: string;
  belly: string;
  glow: string;
  scale: number;
  style: 'sand' | 'flameCat' | 'shell' | 'lavaApe' | 'steam' | 'slug' | 'wing' | 'octo' | 'fox';
}> = {
  shukaku: {
    body: '#c48a4a', accent: '#7c2d12', belly: '#f5deb3', glow: '#f59e0b', scale: 1.5, style: 'sand'
  },
  matatabi: {
    body: '#1d4ed8', accent: '#7dd3fc', belly: '#dbeafe', glow: '#38bdf8', scale: 1.42, style: 'flameCat'
  },
  isobu: {
    body: '#0e7490', accent: '#67e8f9', belly: '#cffafe', glow: '#22d3ee', scale: 1.5, style: 'shell'
  },
  sonGoku: {
    body: '#dc2626', accent: '#fed7aa', belly: '#7f1d1d', glow: '#fb923c', scale: 1.56, style: 'lavaApe'
  },
  kokuo: {
    body: '#e5e7eb', accent: '#93c5fd', belly: '#f8fafc', glow: '#bfdbfe', scale: 1.48, style: 'steam'
  },
  saiken: {
    body: '#7c3aed', accent: '#bef264', belly: '#ddd6fe', glow: '#a3e635', scale: 1.42, style: 'slug'
  },
  chomei: {
    body: '#16a34a', accent: '#bbf7d0', belly: '#dcfce7', glow: '#86efac', scale: 1.44, style: 'wing'
  },
  gyuki: {
    body: '#3f1d1d', accent: '#e9d5ff', belly: '#7c2d12', glow: '#a855f7', scale: 1.54, style: 'octo'
  },
  kurama: {
    body: '#f97316', accent: '#fed7aa', belly: '#fff7ed', glow: '#fb923c', scale: 1.58, style: 'fox'
  },
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

const STAGE_CROPS: Record<StageId, TextureCrop> = {
  hiddenLeaf: {
    x: 0, y: 0, width: 1 / 3, height: 0.5
  },
  hiddenSand: {
    x: 1 / 3, y: 0, width: 1 / 3, height: 0.5
  },
  hiddenMist: {
    x: 2 / 3, y: 0, width: 1 / 3, height: 0.5
  },
  hiddenCloud: {
    x: 0, y: 0.5, width: 1 / 3, height: 0.5
  },
  hiddenStone: {
    x: 1 / 3, y: 0.5, width: 1 / 3, height: 0.5
  },
  akatsukiHideout: {
    x: 2 / 3, y: 0.5, width: 1 / 3, height: 0.5
  },
  greatShinobiWar: {
    x: 1 / 3, y: 0.25, width: 1 / 3, height: 0.5
  },
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
  return useSceneModel(`character:${characterId}`, CHARACTER_MODEL_CONFIGS[characterId]);
}

function useCroppedTexture(image: string, crop: TextureCrop) {
  const source = useLoader(THREE.TextureLoader, image);
  return useMemo(() => {
    const texture = source.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(crop.width, crop.height);
    texture.offset.set(crop.x, 1 - crop.y - crop.height);
    texture.needsUpdate = true;
    return texture;
  }, [crop, source]);
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
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.font = '700 42px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = 'rgba(0, 0, 0, 0.85)';
      context.shadowBlur = 10;
      context.fillStyle = color;
      context.fillText(text, canvas.width / 2, canvas.height / 2, 460);
    }
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [color, text]);

  return (
    <sprite scale={[width, 0.18, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

function Floor({
  palette,
  stageId,
  width,
  height,
}: {
  palette: StageDefinition['palette'];
  stageId: StageId;
  width: number;
  height: number;
}) {
  const floorTexture = useCroppedTexture(StageAtlas, STAGE_CROPS[stageId]);
  const [centerX, , centerZ] = getMapWorldCenter(width, height);
  const gridSize = Math.max(width, height);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.05, centerZ]} receiveShadow>
        <planeGeometry args={[width + 3, height + 3]} />
        <meshStandardMaterial map={floorTexture} color="#ffffff" roughness={0.92} />
      </mesh>
      <gridHelper args={[gridSize, gridSize, palette.accent, palette.groundA]} position={[centerX, 0.01, centerZ]} />
    </>
  );
}

function GroundTile({
  x,
  y,
  palette,
  visibility = 'visible',
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
  visibility?: CellVisibility;
}) {
  const [wx, , wz] = toWorld(x, y);
  const hidden = visibility === 'hidden';
  const explored = visibility === 'explored';
  let tileColor = (x + y) % 2 ? palette.groundA : palette.groundB;
  let tileOpacity = 0.48;
  if (hidden) {
    tileColor = '#020617';
    tileOpacity = 0.96;
  } else if (explored) {
    tileColor = '#111827';
    tileOpacity = 0.68;
  }
  return (
    <mesh position={[wx, 0, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[0.96, 0.96]} />
      <meshStandardMaterial
        color={tileColor}
        roughness={0.92}
        transparent
        opacity={tileOpacity}
      />
    </mesh>
  );
}

function useSmoothWorldPosition(
  ref: React.MutableRefObject<THREE.Group | null>,
  x: number,
  y: number,
  elevation: number,
  motionRef?: React.MutableRefObject<number>,
) {
  const initialized = useRef(false);
  const targetRef = useRef(new THREE.Vector3());
  const directionRef = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
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
      group.rotation.y = THREE.MathUtils.lerp(
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

function WallBlock({
  x,
  y,
  palette,
  visibility = 'visible',
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
  visibility?: CellVisibility;
}) {
  const [wx, , wz] = toWorld(x, y);
  const explored = visibility === 'explored';
  return (
    <mesh position={[wx, 0.5, wz]} castShadow receiveShadow>
      <boxGeometry args={[0.92, 1, 0.92]} />
      <meshStandardMaterial
        color={explored ? '#1f2937' : palette.wall}
        emissive={explored ? '#020617' : palette.wall}
        emissiveIntensity={explored ? 0.02 : 0.08}
        metalness={0.08}
        roughness={0.72}
      />
    </mesh>
  );
}

function CrateBlock({
  x,
  y,
  palette,
  destroyed,
  visibility = 'visible',
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
  destroyed?: boolean;
  visibility?: CellVisibility;
}) {
  const [wx, , wz] = toWorld(x, y);
  const explored = visibility === 'explored';
  let color = palette.crate;
  let emissive = palette.crate;
  if (destroyed) {
    color = '#5d4037';
    emissive = '#2f1c16';
  }
  if (explored) {
    color = '#2a211c';
    emissive = '#020617';
  }
  return (
    <mesh position={[wx, 0.4, wz]} castShadow>
      <boxGeometry args={[0.85, 0.8, 0.85]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={explored ? 0.02 : 0.04}
        roughness={0.76}
      />
    </mesh>
  );
}

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <ringGeometry args={[0.28, 0.5, 32]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.54} transparent opacity={0.36} />
      </mesh>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[0.62, 0.34, 0.62]} />
        <meshStandardMaterial color="#d6a45d" emissive="#f59e0b" emissiveIntensity={0.22} transparent opacity={0.28} wireframe />
      </mesh>
    </group>
  );
}

function BombMesh({ x, y, kind }: { x: number; y: number; kind: BombKind }) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const [wx, , wz] = toWorld(x, y);
  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 10) * 0.08;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(pulse);
    }
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.7;
    }
    if (lightRef.current) {
      lightRef.current.intensity = 0.7 + Math.sin(clock.elapsedTime * 12) * 0.35;
    }
  });
  const ultimateScale = ['giantClay', 'rasenshuriken', 'kirin', 'sandTsunami', 'instantTeleport', 'tsukuyomi']
    .includes(kind)
    ? 1.35
    : 1;
  const giant = kind === 'giantClay';
  const style = BOMB_STYLE[kind];
  return (
    <group ref={groupRef} position={[wx, giant ? 0.48 : 0.36, wz]} scale={giant ? 1.72 : ultimateScale}>
      <pointLight ref={lightRef} color={style.emissive} distance={2.8} intensity={0.72} />

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

const EXPLOSION_INSTANCE_CAPACITY = 160;
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
  const lightRef = useRef<THREE.PointLight>(null);
  const agesRef = useRef(new Map<string, number>());

  useFrame((_, delta) => {
    const activeKeys = new Set<string>();
    const count = Math.min(explosions.length, EXPLOSION_INSTANCE_CAPACITY);
    let strongestLight = 0;
    let strongestLightPosition: [number, number, number] | null = null;
    let strongestLightColor = '#f97316';

    for (let index = 0; index < count; index += 1) {
      const explosion = explosions[index];
      const key = getExplosionKey(explosion);
      activeKeys.add(key);

      const ageMs = Math.min(
        EXPLOSION_MS,
        (agesRef.current.get(key) ?? 0) + delta * 1000
      );
      agesRef.current.set(key, ageMs);

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
      if (!activeKeys.has(key)) agesRef.current.delete(key);
    });

    [flameRef.current, shockwaveRef.current, ringRef.current, accentRef.current, debrisRef.current].forEach((mesh) => {
      if (!mesh) return;
      const instancedMesh = mesh;
      instancedMesh.count = count;
      instancedMesh.instanceMatrix.needsUpdate = true;
      if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    });

    if (lightRef.current) {
      lightRef.current.intensity = strongestLight * 2.1;
      lightRef.current.color.set(strongestLightColor);
      if (strongestLightPosition) {
        lightRef.current.position.set(...strongestLightPosition);
      }
    }
  });

  if (explosions.length === 0) return null;

  return (
    <>
      <pointLight ref={lightRef} distance={5} intensity={1.8} color="#f97316" />
      <instancedMesh ref={shockwaveRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]}>
        <torusGeometry args={[0.34, 0.035, 8, 24]} />
        <meshBasicMaterial transparent opacity={0.38} vertexColors depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={flameRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]}>
        <sphereGeometry args={[0.34, 12, 12]} />
        <meshBasicMaterial transparent opacity={0.82} vertexColors depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={ringRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]}>
        <ringGeometry args={[0.18, 0.55, 6]} />
        <meshBasicMaterial transparent opacity={0.48} vertexColors depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={accentRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]}>
        <coneGeometry args={[0.12, 0.58, 4]} />
        <meshBasicMaterial transparent opacity={0.78} vertexColors depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={debrisRef} args={[undefined, undefined, EXPLOSION_INSTANCE_CAPACITY]}>
        <tetrahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial transparent opacity={0.72} vertexColors depthWrite={false} />
      </instancedMesh>
    </>
  );
}

function ShadowBlob() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
      <circleGeometry args={[0.32, 24]} />
      <meshBasicMaterial color="#000" transparent opacity={0.26} />
    </mesh>
  );
}

type CharacterVisual = (typeof CHARACTER_VISUALS)[CharacterId];

function HairMaterial({ visual, ghost }: { visual: CharacterVisual; ghost: boolean }) {
  return (
    <meshStandardMaterial
      color={visual.hair}
      roughness={0.5}
      transparent={ghost}
      opacity={ghost ? 0.55 : 1}
    />
  );
}

function CharacterHair({
  characterId,
  visual,
  ghost,
}: {
  characterId: CharacterId;
  visual: CharacterVisual;
  ghost: boolean;
}) {
  if (characterId === 'naruto' || characterId === 'minato') {
    const spikes = characterId === 'naruto'
      ? [-0.22, -0.11, 0, 0.11, 0.22]
      : [-0.26, -0.14, 0, 0.14, 0.26];
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.08, 0.58, 0.95]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
        {spikes.map((side) => (
          <mesh
            key={`${characterId}-hair-spike-${side}`}
            position={[side, 0.58 - Math.abs(side) * 0.12, 0.03]}
            rotation={[0.38, side * 3.2, side > 0 ? -0.64 : 0.64]}
            castShadow
          >
            <coneGeometry args={[0.07, characterId === 'minato' ? 0.3 : 0.24, 8]} />
            <HairMaterial visual={visual} ghost={ghost} />
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
        <mesh position={[0, 0.45, -0.04]} scale={[1.12, 0.62, 0.95]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
        {spikes.map((spike, index) => (
          <mesh
            key={`sasuke-hair-${index}`}
            position={spike.position as [number, number, number]}
            rotation={spike.rotation as [number, number, number]}
            castShadow
          >
            <coneGeometry args={[0.075, 0.3, 8]} />
            <HairMaterial visual={visual} ghost={ghost} />
          </mesh>
        ))}
      </>
    );
  }

  if (characterId === 'deidara') {
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.1, 0.58, 0.95]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
        <mesh position={[-0.05, 0.65, -0.04]} castShadow>
          <sphereGeometry args={[0.13, 14, 14]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
        <mesh position={[0.17, 0.34, 0.08]} rotation={[0.28, 0, -0.18]} castShadow>
          <capsuleGeometry args={[0.04, 0.38, 5, 8]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
      </>
    );
  }

  if (characterId === 'gaara') {
    return (
      <>
        <mesh position={[0, 0.45, -0.03]} scale={[1.02, 0.52, 0.92]} castShadow>
          <sphereGeometry args={[0.2, 16, 16]} />
          <HairMaterial visual={visual} ghost={ghost} />
        </mesh>
        {[-0.14, 0, 0.14].map((side) => (
          <mesh
            key={`gaara-hair-${side}`}
            position={[side, 0.56, 0.04]}
            rotation={[0.62, side * 2.2, side > 0 ? -0.4 : 0.4]}
            castShadow
          >
            <coneGeometry args={[0.055, 0.2, 7]} />
            <HairMaterial visual={visual} ghost={ghost} />
          </mesh>
        ))}
      </>
    );
  }

  return (
    <>
      <mesh position={[0, 0.45, -0.03]} scale={[1.06, 0.6, 0.95]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <HairMaterial visual={visual} ghost={ghost} />
      </mesh>
      <mesh position={[-0.15, 0.28, 0.02]} rotation={[0.12, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.045, 0.34, 5, 8]} />
        <HairMaterial visual={visual} ghost={ghost} />
      </mesh>
      <mesh position={[0.15, 0.28, 0.02]} rotation={[0.12, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.045, 0.34, 5, 8]} />
        <HairMaterial visual={visual} ghost={ghost} />
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
  const transparent = ghost;
  const opacity = ghost ? 0.55 : 1;

  if (characterId === 'naruto') {
    return (
      <>
        {[-0.1, 0.1].map((side) => (
          <React.Fragment key={`naruto-face-${side}`}>
            <mesh position={[side, 0.31, 0.205]} rotation={[0, 0, side > 0 ? 0.2 : -0.2]}>
              <boxGeometry args={[0.07, 0.008, 0.012]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
            <mesh position={[side, 0.27, 0.205]} rotation={[0, 0, side > 0 ? -0.2 : 0.2]}>
              <boxGeometry args={[0.07, 0.008, 0.012]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </React.Fragment>
        ))}
      </>
    );
  }

  if (characterId === 'sasuke') {
    return (
      <>
        <mesh position={[0, -0.19, 0.16]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.24, 0.035, 8, 28]} />
          <meshStandardMaterial color={visual.trim} emissive={visual.trim} emissiveIntensity={0.18} transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, -0.2, 0.2]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[0.46, 0.05, 0.04]} />
          <meshStandardMaterial color={visual.trim} transparent={transparent} opacity={opacity} />
        </mesh>
      </>
    );
  }

  if (characterId === 'deidara') {
    return (
      <>
        <mesh position={[-0.24, 0.13, 0.02]} scale={[0.8, 0.55, 0.7]} castShadow>
          <sphereGeometry args={[0.11, 12, 12]} />
          <meshStandardMaterial color="#f8fafc" emissive="#f97316" emissiveIntensity={0.12} transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[-0.28, 0.14, 0.12]} rotation={[0.2, 0, 0.6]}>
          <coneGeometry args={[0.035, 0.16, 8]} />
          <meshStandardMaterial color="#f8fafc" transparent={transparent} opacity={opacity} />
        </mesh>
      </>
    );
  }

  if (characterId === 'gaara') {
    return (
      <group position={[0.24, 0.06, -0.2]} rotation={[0.18, 0.5, -0.28]}>
        <mesh castShadow>
          <sphereGeometry args={[0.19, 16, 16]} />
          <meshStandardMaterial color="#9a5f2b" emissive="#d6a45d" emissiveIntensity={0.08} transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.018, 8, 24]} />
          <meshStandardMaterial color="#2f1c16" transparent={transparent} opacity={opacity} />
        </mesh>
      </group>
    );
  }

  if (characterId === 'minato') {
    return (
      <>
        <mesh position={[0, -0.08, -0.16]} rotation={[0.15, 0, 0]} castShadow>
          <boxGeometry args={[0.58, 0.68, 0.045]} />
          <meshStandardMaterial color="#f8fafc" emissive="#fde047" emissiveIntensity={0.06} transparent={transparent} opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.08, -0.19]}>
          <boxGeometry args={[0.5, 0.06, 0.05]} />
          <meshStandardMaterial color="#dc2626" transparent={transparent} opacity={opacity} />
        </mesh>
      </>
    );
  }

  if (characterId === 'itachi') {
    return (
      <>
        {[-0.12, 0.12].map((side) => (
          <mesh key={`itachi-cloud-${side}`} position={[side, 0.0, 0.2]}>
            <sphereGeometry args={[0.055, 10, 10]} />
            <meshStandardMaterial color="#dc2626" emissive="#ef4444" emissiveIntensity={0.28} transparent={transparent} opacity={opacity} />
          </mesh>
        ))}
        <mesh position={[0, -0.22, -0.02]} scale={[1.05, 0.72, 0.92]} castShadow>
          <sphereGeometry args={[0.22, 12, 12]} />
          <meshStandardMaterial color="#050507" transparent={transparent} opacity={opacity} roughness={0.5} />
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
}: {
  asset: SceneModelAsset;
  ghost: boolean;
  motionRef?: React.MutableRefObject<number>;
}) {
  const model = useMemo(() => createFittedSceneModel(asset), [asset]);

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

function PlayerMesh({ player, state }: { player: PlayerState; state: GameEngineState }) {
  const ref = useRef<THREE.Group>(null);
  const motionRef = useRef(0);
  const ghost = isPowerUpActive(state, player.id, 'Ghost');
  const invincible = isPowerUpActive(state, player.id, 'Invincibility');
  const visual = CHARACTER_VISUALS[player.characterId];
  const characterModel = useCharacterModel(player.characterId);
  useSmoothWorldPosition(ref, player.x, player.y, 0.55, motionRef);

  useFrame(({ clock }) => {
    const group = ref.current;
    if (!group) return;

    const movement = motionRef.current;
    const stride = Math.sin(clock.elapsedTime * 13);
    group.position.y += Math.abs(stride) * 0.038 * movement;
    group.rotation.z = THREE.MathUtils.lerp(
      group.rotation.z,
      stride * 0.035 * movement,
      0.22,
    );

    if (invincible) {
      group.visible = Math.sin(clock.elapsedTime * 10) > 0;
    } else {
      group.visible = true;
    }
  });

  if (!player.alive) return null;

  return (
    <group ref={ref}>
      <ShadowBlob />
      <pointLight color={visual.aura} distance={2.6} intensity={ghost ? 0.55 : 0.85} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.39, 0]}>
        <torusGeometry args={[0.42, 0.022, 8, 36]} />
        <meshStandardMaterial
          color={visual.aura}
          emissive={visual.aura}
          emissiveIntensity={1.1}
          transparent
          opacity={ghost ? 0.25 : 0.46}
        />
      </mesh>
      {characterModel ? (
        <LoadedSceneModel asset={characterModel} ghost={ghost} motionRef={motionRef} />
      ) : (
        <>
          <mesh position={[0, -0.04, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.44, 8, 16]} />
            <meshStandardMaterial
              color={visual.body}
              emissive={visual.body}
              emissiveIntensity={0.08}
              transparent={ghost}
              opacity={ghost ? 0.55 : 1}
              roughness={0.46}
            />
          </mesh>
          <mesh position={[0, -0.08, 0.16]} castShadow>
            <boxGeometry args={[0.38, 0.26, 0.035]} />
            <meshStandardMaterial
              color={visual.trim}
              emissive={visual.trim}
              emissiveIntensity={0.08}
              transparent={ghost}
              opacity={ghost ? 0.55 : 1}
            />
          </mesh>
          <mesh position={[0, 0.32, 0.02]} castShadow>
            <sphereGeometry args={[0.19, 18, 18]} />
            <meshStandardMaterial color="#f2c7a2" roughness={0.48} transparent={ghost} opacity={ghost ? 0.55 : 1} />
          </mesh>
          <CharacterHair characterId={player.characterId} visual={visual} ghost={ghost} />
          <mesh position={[0, 0.35, 0.2]} castShadow>
            <boxGeometry args={[0.42, 0.055, 0.04]} />
            <meshStandardMaterial
              color={visual.headband}
              emissive={visual.headband}
              emissiveIntensity={0.18}
              transparent={ghost}
              opacity={ghost ? 0.55 : 1}
            />
          </mesh>
          <mesh position={[0, 0.35, 0.225]} castShadow>
            <boxGeometry args={[0.16, 0.05, 0.018]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.32} transparent={ghost} opacity={ghost ? 0.55 : 1} />
          </mesh>
          {[-0.22, 0.22].map((side) => (
            <mesh
              key={`${player.id}-arm-${side}`}
              position={[side, 0.04, 0.04]}
              rotation={[0.35, 0, side > 0 ? -0.55 : 0.55]}
              castShadow
            >
              <capsuleGeometry args={[0.055, 0.34, 5, 8]} />
              <meshStandardMaterial color={visual.accent} roughness={0.48} transparent={ghost} opacity={ghost ? 0.55 : 1} />
            </mesh>
          ))}
          {[-0.09, 0.09].map((side) => (
            <mesh
              key={`${player.id}-leg-${side}`}
              position={[side, -0.36, 0.02]}
              rotation={[0.18, 0, side > 0 ? -0.08 : 0.08]}
              castShadow
            >
              <capsuleGeometry args={[0.052, 0.34, 5, 8]} />
              <meshStandardMaterial color={visual.body} roughness={0.5} transparent={ghost} opacity={ghost ? 0.55 : 1} />
            </mesh>
          ))}
          {[-0.1, 0.1].map((side) => (
            <mesh key={`${player.id}-shoe-${side}`} position={[side, -0.55, 0.1]} rotation={[0.2, 0, 0]} castShadow>
              <boxGeometry args={[0.13, 0.06, 0.2]} />
              <meshStandardMaterial color="#111827" roughness={0.56} transparent={ghost} opacity={ghost ? 0.55 : 1} />
            </mesh>
          ))}
          {[-0.09, 0.09].map((side) => (
            <mesh key={`${player.id}-eye-${side}`} position={[side, 0.34, 0.17]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          ))}
          <CharacterAccessory characterId={player.characterId} visual={visual} ghost={ghost} />
          <mesh position={[0, -0.27, -0.08]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.42, 12]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.12} />
          </mesh>
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
  );
}

function MonsterNameplate({
  monster,
  visual,
}: {
  monster: MonsterState;
  visual: typeof MONSTER_VISUALS[MonsterKind];
}) {
  let barWidth = 0.36;
  if (monster.kind === 'smart') barWidth = 0.44;
  if (monster.kind === 'fork') barWidth = 0.52;
  return (
    <group position={[0, 0.8, 0]} rotation={[-0.25, 0, 0]}>
      <mesh>
        <boxGeometry args={[0.72, 0.12, 0.025]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, -0.085, 0.005]}>
        <boxGeometry args={[0.58, 0.035, 0.02]} />
        <meshBasicMaterial color="#334155" transparent opacity={0.78} />
      </mesh>
      <mesh position={[-(0.58 - barWidth) / 2, -0.085, 0.016]}>
        <boxGeometry args={[barWidth, 0.035, 0.018]} />
        <meshBasicMaterial color={visual.glow} transparent opacity={0.92} />
      </mesh>
      <group position={[0, 0.008, 0.03]}>
        <TextSprite text={monster.name} color="#f8fafc" width={monster.name.length > 16 ? 0.82 : 0.7} />
      </group>
    </group>
  );
}

function MonsterAttackTell({ monster, visual }: { monster: MonsterState; visual: typeof MONSTER_VISUALS[MonsterKind] }) {
  if (monster.kind === 'basic') {
    return (
      <>
        <mesh position={[0, 0.14, 0.48]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.035, 0.38, 4]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.5} roughness={0.32} emissive={visual.glow} emissiveIntensity={0.18} />
        </mesh>
        <mesh position={[0, 0.14, 0.28]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[0.035, 0.34, 0.022]} />
          <meshStandardMaterial color={visual.glow} emissive={visual.glow} emissiveIntensity={0.58} transparent opacity={0.5} />
        </mesh>
      </>
    );
  }
  if (monster.kind === 'smart') {
    return (
      <>
        {[-0.2, 0, 0.2].map((offset) => (
          <mesh key={`${monster.id}-sand-line-${offset}`} position={[offset, -0.08, 0.46 + Math.abs(offset) * 0.2]} rotation={[0.42, 0, 0]}>
            <coneGeometry args={[0.045, 0.34, 6]} />
            <meshStandardMaterial color="#d6a45d" emissive="#f59e0b" emissiveIntensity={0.32} />
          </mesh>
        ))}
      </>
    );
  }
  if (monster.kind === 'ghost') {
    return (
      <>
        {[-0.2, 0.2].map((offset) => (
          <mesh key={`${monster.id}-clone-wisp-${offset}`} position={[offset, 0.1, 0.42]} rotation={[0.7, offset * 2, offset > 0 ? -0.25 : 0.25]}>
            <coneGeometry args={[0.065, 0.42, 8]} />
            <meshStandardMaterial color="#bfdbfe" emissive={visual.glow} emissiveIntensity={0.9} transparent opacity={0.56} />
          </mesh>
        ))}
      </>
    );
  }
  return (
    <>
      {[-0.26, 0.26].map((offset) => (
        <mesh key={`${monster.id}-slam-tell-${offset}`} position={[offset, 0.04, 0.5]} rotation={[1.05, offset > 0 ? -0.35 : 0.35, offset > 0 ? -0.6 : 0.6]}>
          <capsuleGeometry args={[0.04, 0.62, 5, 8]} />
          <meshStandardMaterial color="#4c1d95" emissive={visual.glow} emissiveIntensity={0.38} />
        </mesh>
      ))}
    </>
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

function MonsterMesh({ monster }: { monster: MonsterState }) {
  const ref = useRef<THREE.Group>(null);
  const visual = MONSTER_VISUALS[monster.kind];
  const color = visual.body;
  const isGhost = monster.kind === 'ghost';
  const tails = BEAST_TAILS[monster.kind];
  useSmoothWorldPosition(ref, monster.x, monster.y, 0.45);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y += Math.sin(clock.elapsedTime * 5) * 0.002;
      ref.current.rotation.z = Math.sin(clock.elapsedTime * 4) * 0.05;
    }
  });

  return (
    <group ref={ref} scale={visual.scale}>
      <ShadowBlob />
      <mesh position={[0, -0.05, 0]} castShadow scale={visual.style === 'horn' ? [1.08, 1.05, 0.96] : [0.95, 1, 0.9]}>
        <capsuleGeometry args={[0.17, 0.46, 7, 14]} />
        <meshStandardMaterial
          color={color}
          emissive={visual.glow}
          emissiveIntensity={isGhost ? 0.85 : 0.22}
          transparent={isGhost}
          opacity={isGhost ? 0.58 : 1}
          roughness={0.46}
        />
      </mesh>
      <mesh position={[0, -0.08, 0.17]} scale={[0.9, 0.76, 0.22]} castShadow>
        <boxGeometry args={[0.34, 0.28, 0.05]} />
        <meshStandardMaterial color={visual.belly} emissive={visual.glow} emissiveIntensity={0.08} transparent={isGhost} opacity={isGhost ? 0.42 : 1} />
      </mesh>
      <mesh position={[0, 0.31, 0.04]} scale={visual.style === 'horn' ? [0.82, 0.94, 0.78] : [0.82, 0.78, 0.78]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={color} emissive={visual.glow} emissiveIntensity={isGhost ? 0.9 : 0.28} transparent={isGhost} opacity={isGhost ? 0.55 : 1} roughness={0.42} />
      </mesh>
      {[-0.21, 0.21].map((side) => (
        <mesh
          key={`${monster.id}-ninja-arm-${side}`}
          position={[side, 0.02, 0.04]}
          rotation={[0.28, 0, side > 0 ? -0.62 : 0.62]}
          castShadow
        >
          <capsuleGeometry args={[0.04, 0.34, 5, 8]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.14} transparent={isGhost} opacity={isGhost ? 0.5 : 1} />
        </mesh>
      ))}
      {[-0.08, 0.08].map((side) => (
        <mesh key={`${monster.id}-ninja-leg-${side}`} position={[side, -0.36, 0.01]} rotation={[0.12, 0, side > 0 ? -0.08 : 0.08]} castShadow>
          <capsuleGeometry args={[0.044, 0.28, 5, 8]} />
          <meshStandardMaterial color={visual.belly} roughness={0.5} transparent={isGhost} opacity={isGhost ? 0.48 : 1} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.39, 0]}>
        <torusGeometry args={[0.5, 0.022, 6, 36]} />
        <meshStandardMaterial
          color={visual.glow}
          emissive={visual.glow}
          emissiveIntensity={0.9}
          transparent
          opacity={isGhost ? 0.58 : 0.4}
        />
      </mesh>

      {visual.style === 'fox' && (
        <>
          <mesh position={[0, 0.37, 0.21]} castShadow>
            <boxGeometry args={[0.34, 0.045, 0.026]} />
            <meshStandardMaterial color="#0f172a" emissive={visual.glow} emissiveIntensity={0.16} />
          </mesh>
          <mesh position={[0, 0.37, 0.235]}>
            <boxGeometry args={[0.11, 0.04, 0.018]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.5} roughness={0.32} />
          </mesh>
          <mesh position={[0.24, 0.08, 0.18]} rotation={[Math.PI / 2, 0, -0.72]}>
            <coneGeometry args={[0.035, 0.32, 4]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.45} roughness={0.28} emissive={visual.glow} emissiveIntensity={0.12} />
          </mesh>
        </>
      )}

      {visual.style === 'sand' && (
        <>
          <mesh position={[0, 0.48, 0.03]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.14, 0.2, 8]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.3} />
          </mesh>
          {[-0.18, 0.18].map((side) => (
            <mesh key={`${monster.id}-sand-spike-${side}`} position={[side, 0.2, -0.25]} rotation={[0.7, side, side > 0 ? -0.35 : 0.35]}>
              <coneGeometry args={[0.055, 0.28, 7]} />
              <meshStandardMaterial color="#d6a45d" emissive={visual.glow} emissiveIntensity={0.16} />
            </mesh>
          ))}
        </>
      )}

      {visual.style === 'flame' && (
        <>
          <mesh position={[0, 0.56, 0.0]} rotation={[0.05, 0, 0]}>
            <coneGeometry args={[0.13, 0.36, 8]} />
            <meshStandardMaterial color="#bfdbfe" emissive={visual.glow} emissiveIntensity={1.1} transparent opacity={0.72} />
          </mesh>
          {[-0.18, 0.18].map((side) => (
            <mesh key={`${monster.id}-flame-wisp-${side}`} position={[side, 0.18, -0.28]} rotation={[0.8, side * 2, side > 0 ? -0.3 : 0.3]}>
              <coneGeometry args={[0.07, 0.34, 8]} />
              <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.9} transparent opacity={0.62} />
            </mesh>
          ))}
        </>
      )}

      {visual.style === 'horn' && (
        <>
          {[-0.18, 0.18].map((side) => (
            <mesh key={`${monster.id}-main-horn-${side}`} position={[side, 0.5, 0.04]} rotation={[0.28, 0, side > 0 ? -0.55 : 0.55]}>
              <coneGeometry args={[0.075, 0.34, 8]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.35} />
            </mesh>
          ))}
          <mesh position={[0, 0.0, -0.25]} scale={[0.8, 0.32, 0.2]}>
            <sphereGeometry args={[0.26, 12, 12]} />
            <meshStandardMaterial color="#111827" emissive={visual.glow} emissiveIntensity={0.22} />
          </mesh>
        </>
      )}

      {Array.from({ length: tails }, (_, index) => {
        const offset = (index - (tails - 1) / 2) * 0.12;
        return (
          <mesh
            key={`${monster.id}-tail-${index}`}
            position={[offset, 0.02 + index * 0.014, -0.38]}
            rotation={[0.86, offset * 2.4, offset * 3.4]}
            castShadow
          >
            <capsuleGeometry args={[0.052, visual.style === 'horn' ? 0.58 : 0.46, 5, 8]} />
            <meshStandardMaterial
              color={visual.accent}
              emissive={visual.glow}
              emissiveIntensity={isGhost ? 0.45 : 0.16}
              transparent={isGhost}
              opacity={isGhost ? 0.55 : 1}
            />
          </mesh>
        );
      })}
      {[-0.12, 0.12].map((side) => (
        <mesh key={`${monster.id}-eye-${side}`} position={[side, 0.33, 0.2]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={isGhost ? '#bfdbfe' : '#f8f9fa'} emissive={visual.glow} emissiveIntensity={isGhost ? 0.8 : 0.15} />
        </mesh>
      ))}
      {[-0.12, 0.12].map((side) => (
        <mesh key={`${monster.id}-pupil-${side}`} position={[side, 0.325, 0.24]}>
          <sphereGeometry args={[0.018, 8, 8]} />
          <meshStandardMaterial color={visual.style === 'flame' ? '#1e3a8a' : '#111'} />
        </mesh>
      ))}
      <MonsterAttackTell monster={monster} visual={visual} />
      <MonsterAbilityWarning monster={monster} visual={visual} />
      <MonsterNameplate monster={monster} visual={visual} />
    </group>
  );
}

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
      <pointLight color={color} distance={2.6} intensity={0.5} />
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

function BossStyleDetails({
  bossId,
  visual,
}: {
  bossId: BossId;
  visual: (typeof BOSS_VISUALS)[BossId];
}) {
  if (visual.style === 'sand') {
    return (
      <>
        {[-0.18, 0.18].map((side) => (
          <mesh key={`${bossId}-sand-ear-${side}`} position={[side, 0.78, 0.05]} rotation={[0.28, 0, side > 0 ? -0.36 : 0.36]} castShadow>
            <coneGeometry args={[0.12, 0.34, 8]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.2} />
          </mesh>
        ))}
        {[-0.26, 0, 0.26].map((offset) => (
          <mesh key={`${bossId}-sand-mark-${offset}`} position={[offset, 0.13, 0.31]} scale={[1.2, 0.44, 0.18]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.16} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'flameCat') {
    return (
      <>
        {[-0.17, 0.17].map((side) => (
          <mesh key={`${bossId}-cat-ear-${side}`} position={[side, 0.74, 0.05]} rotation={[0.24, 0, side > 0 ? -0.42 : 0.42]}>
            <coneGeometry args={[0.1, 0.28, 8]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.88} transparent opacity={0.86} />
          </mesh>
        ))}
        {[0, Math.PI * 0.66, Math.PI * 1.33].map((rotation) => (
          <mesh key={`${bossId}-blue-flame-${rotation}`} position={[Math.sin(rotation) * 0.28, 0.3, -0.22 + Math.cos(rotation) * 0.16]} rotation={[0.75, rotation, 0]}>
            <coneGeometry args={[0.08, 0.48, 8]} />
            <meshStandardMaterial color="#bfdbfe" emissive={visual.glow} emissiveIntensity={1.05} transparent opacity={0.62} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'shell') {
    return (
      <>
        <mesh position={[0, 0.16, -0.1]} scale={[1.24, 0.42, 0.92]} castShadow>
          <sphereGeometry args={[0.34, 16, 16]} />
          <meshStandardMaterial color="#164e63" emissive={visual.glow} emissiveIntensity={0.2} roughness={0.5} />
        </mesh>
        {[-0.28, 0, 0.28].map((offset) => (
          <mesh key={`${bossId}-shell-spike-${offset}`} position={[offset, 0.56, -0.08]} rotation={[0.5, offset * 2, 0]}>
            <coneGeometry args={[0.075, 0.26, 7]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.34} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'lavaApe') {
    return (
      <>
        {[-0.42, 0.42].map((side) => (
          <mesh key={`${bossId}-fist-${side}`} position={[side, 0.08, 0.23]} scale={[1.15, 0.88, 1.05]} castShadow>
            <sphereGeometry args={[0.16, 14, 14]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.46} roughness={0.5} />
          </mesh>
        ))}
        {[-0.18, 0.18].map((offset) => (
          <mesh key={`${bossId}-lava-crack-${offset}`} position={[offset, 0.14, 0.34]} rotation={[0.2, 0, offset > 0 ? -0.45 : 0.45]}>
            <boxGeometry args={[0.035, 0.42, 0.025]} />
            <meshStandardMaterial color="#fed7aa" emissive="#fb923c" emissiveIntensity={0.72} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'steam') {
    return (
      <>
        {[-0.15, 0.15].map((side) => (
          <mesh key={`${bossId}-steam-horn-${side}`} position={[side, 0.76, 0.04]} rotation={[0.22, 0, side > 0 ? -0.22 : 0.22]}>
            <coneGeometry args={[0.065, 0.42, 8]} />
            <meshStandardMaterial color="#f8fafc" emissive={visual.glow} emissiveIntensity={0.28} />
          </mesh>
        ))}
        {[0.18, 0.32].map((height) => (
          <mesh key={`${bossId}-steam-ring-${height}`} position={[0, height, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.42 + height * 0.35, 0.018, 8, 32]} />
            <meshStandardMaterial color="#f8fafc" emissive={visual.glow} emissiveIntensity={0.54} transparent opacity={0.38} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'slug') {
    return (
      <>
        {[-0.13, 0.13].map((side) => (
          <mesh key={`${bossId}-slug-antenna-${side}`} position={[side, 0.77, 0.08]} rotation={[0.55, 0, side > 0 ? -0.22 : 0.22]}>
            <capsuleGeometry args={[0.025, 0.32, 4, 6]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.55} />
          </mesh>
        ))}
        {[0, 1, 2].map((bubble) => (
          <mesh key={`${bossId}-acid-bubble-${bubble}`} position={[(bubble - 1) * 0.18, 0.34 + bubble * 0.05, -0.24]}>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.72} transparent opacity={0.58} />
          </mesh>
        ))}
      </>
    );
  }
  if (visual.style === 'wing') {
    return (
      <>
        {[-0.42, 0.42].map((side) => (
          <mesh key={`${bossId}-wing-${side}`} position={[side, 0.28, -0.12]} rotation={[0.24, side > 0 ? -0.5 : 0.5, side > 0 ? -0.38 : 0.38]}>
            <planeGeometry args={[0.52, 0.72]} />
            <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.42} transparent opacity={0.44} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, 0.64, 0.03]}>
          <coneGeometry args={[0.07, 0.26, 6]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.5} />
        </mesh>
      </>
    );
  }
  if (visual.style === 'octo') {
    return (
      <>
        {[-0.16, 0.16].map((side) => (
          <mesh key={`${bossId}-octo-horn-${side}`} position={[side, 0.76, 0.04]} rotation={[0.25, 0, side > 0 ? -0.42 : 0.42]}>
            <coneGeometry args={[0.085, 0.36, 8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.36} />
          </mesh>
        ))}
        {[-0.34, 0.34].map((side) => (
          <mesh key={`${bossId}-octo-arm-${side}`} position={[side, 0.05, 0.18]} rotation={[0.95, 0, side > 0 ? -0.86 : 0.86]}>
            <capsuleGeometry args={[0.055, 0.72, 5, 8]} />
            <meshStandardMaterial color="#4c1d95" emissive={visual.glow} emissiveIntensity={0.4} />
          </mesh>
        ))}
      </>
    );
  }
  return (
    <>
      {[-0.18, 0.18].map((side) => (
        <mesh key={`${bossId}-fox-ear-${side}`} position={[side, 0.77, 0.04]} rotation={[0.25, 0, side > 0 ? -0.45 : 0.45]} castShadow>
          <coneGeometry args={[0.11, 0.34, 8]} />
          <meshStandardMaterial color={visual.accent} emissive={visual.glow} emissiveIntensity={0.26} />
        </mesh>
      ))}
      <mesh position={[0, 0.43, 0.28]} scale={[0.8, 0.38, 0.32]}>
        <sphereGeometry args={[0.18, 14, 14]} />
        <meshStandardMaterial color={visual.belly} emissive={visual.glow} emissiveIntensity={0.12} />
      </mesh>
    </>
  );
}

function BossMesh({ state }: { state: GameEngineState }) {
  const { boss } = state;
  const ref = useRef<THREE.Group>(null);
  const bossModelConfig = boss ? BOSS_MODEL_CONFIGS[boss.id] : undefined;
  const bossModel = useSceneModel(
    boss && bossModelConfig ? `boss:${boss.id}` : null,
    bossModelConfig,
  );
  useSmoothWorldPosition(ref, boss?.x ?? 0, boss?.y ?? 0, 0.92);

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
      <pointLight color={visual.glow} distance={5.2} intensity={1.25} />
      <ShadowBlob />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.56, 0]}>
        <torusGeometry args={[0.62, 0.025, 8, 42]} />
        <meshStandardMaterial color={visual.glow} emissive={visual.glow} emissiveIntensity={1.05} transparent opacity={0.38} />
      </mesh>
      {bossModel ? (
        <LoadedSceneModel asset={bossModel} ghost={false} />
      ) : (
        <>
          <mesh castShadow scale={visual.style === 'shell' || visual.style === 'slug' ? [1.22, 0.78, 1.04] : [1, 0.95, 1]}>
            <sphereGeometry args={[0.38, 20, 20]} />
            <meshStandardMaterial color={visual.body} emissive={visual.glow} emissiveIntensity={0.32} roughness={0.42} />
          </mesh>
          <mesh position={[0, -0.02, 0.28]} scale={[0.86, 0.52, 0.28]}>
            <sphereGeometry args={[0.2, 14, 14]} />
            <meshStandardMaterial color={visual.belly} emissive={visual.glow} emissiveIntensity={0.1} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.48, 0.08]} scale={[0.92, 0.74, 0.8]} castShadow>
            <sphereGeometry args={[0.22, 18, 18]} />
            <meshStandardMaterial color={visual.body} emissive={visual.glow} emissiveIntensity={0.38} roughness={0.4} />
          </mesh>
          {[-0.1, 0.1].map((side) => (
            <React.Fragment key={`${boss.id}-eye-${side}`}>
              <mesh position={[side, 0.5, 0.27]}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <meshStandardMaterial color="#fff7ed" emissive={visual.glow} emissiveIntensity={0.32} />
              </mesh>
              <mesh position={[side, 0.5, 0.305]}>
                <sphereGeometry args={[0.019, 8, 8]} />
                <meshStandardMaterial color={boss.id === 'kurama' ? '#7f1d1d' : '#111827'} emissive={boss.id === 'kurama' ? '#f97316' : '#000'} emissiveIntensity={0.25} />
              </mesh>
            </React.Fragment>
          ))}
          <BossStyleDetails bossId={boss.id} visual={visual} />
          {Array.from({ length: boss.tails }, (_, index) => {
            const offset = (index - (boss.tails - 1) / 2) * (boss.tails > 5 ? 0.08 : 0.12);
            let tailLength = 0.68;
            if (visual.style === 'shell') tailLength = 0.52;
            if (visual.style === 'octo') tailLength = 0.78;
            return (
              <mesh
                key={`${boss.id}-boss-tail-${index}`}
                position={[offset, -0.02 + index * 0.008, -0.42 - Math.abs(offset) * 0.28]}
                rotation={[0.92, offset * 4.5, offset * 4.1]}
                castShadow
              >
                <capsuleGeometry args={[visual.style === 'octo' ? 0.05 : 0.044, tailLength, 5, 8]} />
                <meshStandardMaterial color={visual.style === 'octo' ? '#4c1d95' : visual.accent} emissive={visual.glow} emissiveIntensity={0.34} />
              </mesh>
            );
          })}
        </>
      )}
      {boss.phase > 1 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
          <ringGeometry args={[0.68, 0.86, 36]} />
          <meshStandardMaterial color={visual.glow} emissive={visual.glow} emissiveIntensity={0.9} transparent opacity={0.22} />
        </mesh>
      )}
    </group>
  );
}

function HazardMesh({ hazard }: { hazard: BossHazard }) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(hazard.x, hazard.y);
  const active = hazard.ticksRemaining <= hazard.warningTicks;
  const visual = HAZARD_VISUALS[hazard.kind];
  const beastColored = hazard.kind === 'beastBomb' || hazard.kind === 'chakraShockwave';
  const effectColor = beastColored ? hazard.color : visual.color;
  const effectAccent = beastColored ? '#fff7ed' : visual.accent;
  const color = active ? effectColor : '#facc15';
  const opacity = active ? 0.78 : 0.46;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * (active ? 2.6 : 1.5);
      ref.current.scale.setScalar(active ? 1.15 : 0.85 + Math.sin(clock.elapsedTime * 8) * 0.08);
    }
  });

  return (
    <group ref={ref} position={[wx, 0.06, wz]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, active ? 0.52 : 0.38, 26]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.25 : 0.62} transparent opacity={opacity} />
      </mesh>

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
      ref.current.position.y = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.08;
      ref.current.rotation.y = clock.elapsedTime;
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
      <pointLight color={accent} distance={2.2} intensity={rescued ? 0.55 : 1.05} />
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
      <pointLight color={color} distance={2.8} intensity={active ? 1.1 : 0.45} />
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
      <pointLight color={color} distance={2.4} intensity={active ? 1.1 : 0.45} />
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
      <pointLight color={color} distance={3.2} intensity={active ? 1.2 : 0.42} />
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
  explosions: GameEngineState['explosions'];
  hazards: GameEngineState['hazards'];
  palette: StageDefinition['palette'];
  fogOfWar: GameEngineState['fogOfWar'];
  powerTheme?: CharacterId;
};

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
  explosions,
  hazards,
  palette,
  fogOfWar,
  powerTheme,
}: MapTilesProps) {
  const destroyedSet = useMemo(
    () => new Set(destroyedBoxes.map((b) => `${b.x},${b.y}`)),
    [destroyedBoxes],
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
  const visibleExplosions = useMemo(
    () => explosions.filter((explosion) => (
      cellVisibleInSet(visibleCellSet, explosion.x, explosion.y)
    )),
    [explosions, visibleCellSet],
  );
  const visibleHazards = useMemo(
    () => hazards.filter((hazard) => cellVisibleInSet(visibleCellSet, hazard.x, hazard.y)),
    [hazards, visibleCellSet],
  );

  return (
    <>
      {map.map((row, y) => row.map((cell, x) => {
        const visibility = getVisibilityFromSets(visibleCellSet, exploredCellSet, x, y);
        const visible = visibility === 'visible';
        const sensedWall = visibility === 'hidden'
          && sensedWallSet.has(cellKey(x, y))
          && (cell === 'Wall' || cell === 'Box' || isObstacle(cell));
        const tile = (
          <GroundTile key={`tile-${x}-${y}`} x={x} y={y} palette={palette} visibility={visibility} />
        );
        if (visibility === 'hidden') {
          if (!sensedWall) return tile;
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <SensedWallMarker x={x} y={y} />
            </React.Fragment>
          );
        }

        if (cell === 'Wall') {
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <WallBlock x={x} y={y} palette={palette} visibility={visibility} />
            </React.Fragment>
          );
        }
        if (cell === 'Box') {
          const destroyed = destroyedSet.has(`${x},${y}`);
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <CrateBlock x={x} y={y} palette={palette} destroyed={destroyed} visibility={visibility} />
            </React.Fragment>
          );
        }
        if (visible && isPower(cell)) {
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <PowerUpMesh x={x} y={y} power={cell} characterId={powerTheme} />
            </React.Fragment>
          );
        }
        if (visible && isBomb(cell)) {
          const bomb = bombByCell.get(`${x},${y}`);
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <BombMesh x={x} y={y} kind={bomb?.kind ?? 'standard'} />
            </React.Fragment>
          );
        }
        if (isObstacle(cell)) {
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <CrateBlock x={x} y={y} palette={palette} visibility={visibility} />
            </React.Fragment>
          );
        }
        return tile;
      }))}
      <ExplosionField explosions={visibleExplosions} />
      {visibleHazards.map((hazard) => (
        <HazardMesh key={hazard.id} hazard={hazard} />
      ))}
    </>
  );
}

const MapTiles = React.memo(MapTilesBase, (prev, next) => (
  prev.map === next.map
  && prev.palette === next.palette
  && sameBombCells(prev.bombs, next.bombs)
  && sameTimedCells(prev.destroyedBoxes, next.destroyedBoxes)
  && sameTimedCells(prev.explosions, next.explosions)
  && prev.hazards === next.hazards
  && sameFogCells(prev.fogOfWar, next.fogOfWar)
  && prev.powerTheme === next.powerTheme
));

function CameraRig({ state }: { state: GameEngineState }) {
  const { camera } = useThree();
  const lookAtRef = useRef(new THREE.Vector3());
  const cameraTargetRef = useRef(new THREE.Vector3());

  useFrame(() => {
    const trackedPlayers = state.players.filter((player) => player.alive);
    const players = trackedPlayers.length > 0 ? trackedPlayers : state.players;
    const fallbackCenter = getMapWorldCenter(
      state.map[0]?.length ?? 15,
      state.map.length || 10,
    );
    const target = players.length > 0
      ? players.reduce(
        (sum, player) => ({
          x: sum.x + player.x / players.length,
          y: sum.y + player.y / players.length,
        }),
        { x: 0, y: 0 }
      )
      : { x: fallbackCenter[0] - MAP_OFFSET_X, y: fallbackCenter[2] - MAP_OFFSET_Z };
    const [targetX, , targetZ] = toWorld(target.x, target.y);

    lookAtRef.current.set(targetX, 0, targetZ);
    cameraTargetRef.current.set(targetX, 13.2, targetZ + 9.6);
    camera.position.lerp(cameraTargetRef.current, 0.12);
    camera.lookAt(lookAtRef.current);
  });

  return null;
}

function SceneContent({ state }: { state: GameEngineState }) {
  const stage = useMemo(
    () => getStageDefinition(state.config.stageId),
    [state.config.stageId]
  );
  const mapDimensions = useMemo(() => getMapDimensions(state.map), [state.map]);
  const visibleCellSet = useMemo(
    () => new Set(state.fogOfWar.visible ?? []),
    [state.fogOfWar.visible],
  );
  const sensedEnemyCells = useMemo(
    () => new Set(state.fogOfWar.sensedEnemies ?? []),
    [state.fogOfWar.sensedEnemies],
  );
  const visibleMonsters = useMemo(
    () => state.monsters.filter((m) => cellVisibleInSet(visibleCellSet, m.x, m.y)),
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

  return (
    <>
      <CameraRig state={state} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#fef3c7', '#111827', 0.55]} />
      <directionalLight position={[8, 15, 6]} intensity={1.65} castShadow />
      <pointLight position={[-5, 8, -3]} intensity={0.95} color={stage.palette.accent} />
      <pointLight position={[5, 5, 4]} intensity={0.45} color="#f8fafc" />
      <Floor
        palette={stage.palette}
        stageId={stage.id}
        width={mapDimensions.width}
        height={mapDimensions.height}
      />
      <MapTiles
        map={state.map}
        bombs={state.bombs}
        destroyedBoxes={state.destroyedBoxes}
        explosions={state.explosions}
        hazards={state.hazards}
        palette={stage.palette}
        fogOfWar={state.fogOfWar}
        powerTheme={state.players[0]?.characterId}
      />
      <MissionObjectiveMarkers state={state} visibleCells={visibleCellSet} />
      {state.players.map((p) => (
        <PlayerMesh key={p.id} player={p} state={state} />
      ))}
      {visibleMonsters.map((m) => (
        <MonsterMesh key={m.id} monster={m} />
      ))}
      {sensedMonsters.map((m) => (
        <SensedEnemyMarker
          key={`sensed-${m.id}`}
          x={Math.round(m.x)}
          y={Math.round(m.y)}
          label={m.name}
          color={MONSTER_VISUALS[m.kind].glow}
        />
      ))}
      {state.boss && bossVisible && (
        <BossMesh state={state} />
      )}
      {state.boss && bossSensed && (
        <SensedEnemyMarker
          x={Math.round(state.boss.x)}
          y={Math.round(state.boss.y)}
          label={state.boss.name}
          color={BOSS_VISUALS[state.boss.id].glow}
          scale={1.25}
        />
      )}
    </>
  );
}

type GameScene3DProps = {
  state: GameEngineState;
};

export function GameScene3D({ state }: GameScene3DProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.35]}
      style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #161132 0%, #3b3278 52%, #221b44 100%)' }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ position: [0, 13.2, 9.6], fov: 48 }}
    >
      <SceneContent state={state} />
    </Canvas>
  );
}
