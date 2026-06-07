/* eslint-disable react/no-unknown-property, react/no-array-index-key */
/* eslint-disable react/require-default-props, comma-dangle, max-len */
import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BombKind,
  BossHazard,
  ExplosionCell,
  GameEngineState,
  MonsterKind,
  MonsterState,
  PlayerState,
} from '../../engine/types';
import {
  GameMap, isBomb, isObstacle, isPower, Power,
} from '../../model/gameItem';
import { isPowerUpActive } from '../../engine/players';
import { EXPLOSION_MS } from '../../engine/constants';
import { getStageDefinition } from '../../content';
import {
  BossId, CharacterId, StageDefinition, StageId
} from '../../content/types';
import RosterBoard from '../../assets/ninja-bomber-roster-board.png';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.png';

const TILE_SIZE = 1;
const MAP_OFFSET_X = -7;
const MAP_OFFSET_Z = -4.5;
const ENTITY_LERP_SPEED = 11;

type TextureCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function toWorld(x: number, y: number): [number, number, number] {
  return [(x + MAP_OFFSET_X) * TILE_SIZE, 0, (y + MAP_OFFSET_Z) * TILE_SIZE];
}

const POWERUP_VISUALS: Record<Power, {
  paper: string;
  accent: string;
  glow: string;
  shape: 'scroll' | 'seal' | 'charm' | 'tag';
}> = {
  AddBomb: {
    paper: '#f8ead2', accent: '#d92323', glow: '#ff8a00', shape: 'scroll'
  },
  BlastRangeUp: {
    paper: '#fff7d6', accent: '#ff8a00', glow: '#f97316', shape: 'scroll'
  },
  Detonator: {
    paper: '#f4e5c2', accent: '#7c3aed', glow: '#a855f7', shape: 'seal'
  },
  RollerSkate: {
    paper: '#e0f2fe', accent: '#38bdf8', glow: '#38bdf8', shape: 'tag'
  },
  Invincibility: {
    paper: '#fef3c7', accent: '#facc15', glow: '#ffd166', shape: 'charm'
  },
  Ghost: {
    paper: '#ede9fe', accent: '#a78bfa', glow: '#c4b5fd', shape: 'seal'
  },
  Obstacle: {
    paper: '#e7d2a6', accent: '#6b4f3a', glow: '#a16207', shape: 'tag'
  },
};

const MONSTER_COLORS: Record<MonsterKind, string> = {
  basic: '#ff8a00',
  smart: '#ef4444',
  ghost: '#7dd3fc',
  fork: '#a855f7',
};

const BEAST_TAILS: Record<MonsterKind, number> = {
  basic: 1,
  smart: 2,
  ghost: 3,
  fork: 4,
};

const BOSS_CROPS: Record<BossId, TextureCrop> = {
  shukaku: {
    x: 0.0, y: 0.39, width: 0.12, height: 0.19
  },
  matatabi: {
    x: 0.125, y: 0.39, width: 0.115, height: 0.19
  },
  isobu: {
    x: 0.245, y: 0.39, width: 0.115, height: 0.19
  },
  sonGoku: {
    x: 0.365, y: 0.39, width: 0.115, height: 0.19
  },
  kokuo: {
    x: 0.49, y: 0.39, width: 0.115, height: 0.19
  },
  saiken: {
    x: 0.61, y: 0.39, width: 0.115, height: 0.19
  },
  chomei: {
    x: 0.73, y: 0.39, width: 0.115, height: 0.19
  },
  gyuki: {
    x: 0.85, y: 0.39, width: 0.105, height: 0.19
  },
  kurama: {
    x: 0.89, y: 0.39, width: 0.11, height: 0.19
  },
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
}> = {
  deidara: {
    body: '#f5efe0', accent: '#d92323', hair: '#f8fafc', aura: '#ff8a00'
  },
  naruto: {
    body: '#ff8a00', accent: '#2563eb', hair: '#facc15', aura: '#f97316'
  },
  sasuke: {
    body: '#1e293b', accent: '#60a5fa', hair: '#111827', aura: '#60a5fa'
  },
  gaara: {
    body: '#b45309', accent: '#f59e0b', hair: '#dc2626', aura: '#d6a45d'
  },
  minato: {
    body: '#facc15', accent: '#2563eb', hair: '#fde68a', aura: '#fde047'
  },
  itachi: {
    body: '#111827', accent: '#dc2626', hair: '#111827', aura: '#ef4444'
  },
};

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

function Floor({
  palette,
  stageId,
}: {
  palette: StageDefinition['palette'];
  stageId: StageId;
}) {
  const floorTexture = useCroppedTexture(StageAtlas, STAGE_CROPS[stageId]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial map={floorTexture} color="#ffffff" roughness={0.92} />
      </mesh>
      <gridHelper args={[16, 16, palette.accent, palette.groundA]} position={[0, 0.01, 0]} />
    </>
  );
}

function GroundTile({
  x,
  y,
  palette,
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
}) {
  const [wx, , wz] = toWorld(x, y);
  return (
    <mesh position={[wx, 0, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[0.96, 0.96]} />
      <meshStandardMaterial
        color={(x + y) % 2 ? palette.groundA : palette.groundB}
        roughness={0.92}
        transparent
        opacity={0.48}
      />
    </mesh>
  );
}

function BillboardPlane({
  texture,
  width,
  height,
  opacity = 1,
}: {
  texture: THREE.Texture;
  width: number;
  height: number;
  opacity?: number;
}) {
  const planeRef = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => {
    if (planeRef.current) {
      planeRef.current.lookAt(camera.position);
    }
  });

  return (
    <mesh ref={planeRef} position={[0, height / 2 - 0.2, 0]} castShadow>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function useSmoothWorldPosition(
  ref: React.MutableRefObject<THREE.Group | null>,
  x: number,
  y: number,
  elevation: number,
) {
  const initialized = useRef(false);
  const lastTarget = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const [wx, , wz] = toWorld(x, y);
    const target = new THREE.Vector3(wx, elevation, wz);

    if (!initialized.current) {
      group.position.copy(target);
      lastTarget.current.copy(target);
      initialized.current = true;
      return;
    }

    const direction = target.clone().sub(group.position);
    if (direction.lengthSq() > 0.0001) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      group.rotation.y = THREE.MathUtils.lerp(
        group.rotation.y,
        targetRotation,
        1 - Math.exp(-delta * ENTITY_LERP_SPEED),
      );
    }

    group.position.lerp(target, 1 - Math.exp(-delta * ENTITY_LERP_SPEED));
    lastTarget.current.copy(target);
  });
}

function WallBlock({
  x,
  y,
  palette,
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
}) {
  const [wx, , wz] = toWorld(x, y);
  return (
    <mesh position={[wx, 0.5, wz]} castShadow receiveShadow>
      <boxGeometry args={[0.92, 1, 0.92]} />
      <meshStandardMaterial
        color={palette.wall}
        emissive={palette.wall}
        emissiveIntensity={0.08}
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
}: {
  x: number;
  y: number;
  palette: StageDefinition['palette'];
  destroyed?: boolean;
}) {
  const [wx, , wz] = toWorld(x, y);
  return (
    <mesh position={[wx, 0.4, wz]} castShadow>
      <boxGeometry args={[0.85, 0.8, 0.85]} />
      <meshStandardMaterial
        color={destroyed ? '#5d4037' : palette.crate}
        emissive={destroyed ? '#2f1c16' : palette.crate}
        emissiveIntensity={0.04}
        roughness={0.76}
      />
    </mesh>
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
  const giant = kind === 'giantClay';
  const style = BOMB_STYLE[kind];
  return (
    <group ref={groupRef} position={[wx, giant ? 0.45 : 0.35, wz]} scale={giant ? 1.65 : 1}>
      <pointLight ref={lightRef} color={style.emissive} distance={2.8} intensity={0.8} />
      <mesh ref={coreRef} castShadow scale={[1.15, 0.72, 0.9]}>
        <sphereGeometry args={[0.26, 24, 24]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={0.24}
          roughness={0.52}
        />
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
      <mesh position={[0.12, 0.42, 0.05]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#ffdd55" emissive="#ff6600" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function getExplosionStyle(kind?: BombKind): { color: string; emissive: string } {
  return BOMB_STYLE[kind ?? 'standard'];
}

function getBurstParticleColor(index: number, kind?: BombKind): string {
  if (index % 3 === 0) return '#f5efe0';
  if (index % 2 === 0) return getExplosionStyle(kind).color;
  return getExplosionStyle(kind).emissive;
}

function getBurstParticleEmissive(index: number, kind?: BombKind): string {
  return index % 3 === 0 ? '#7c3aed' : getExplosionStyle(kind).emissive;
}

function ExplosionMeshBase({ explosion }: { explosion: ExplosionCell }) {
  const groupRef = useRef<THREE.Group>(null);
  const particleGroupRef = useRef<THREE.Group>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const ageMsRef = useRef(0);
  const particles = useMemo(() => Array.from({ length: 9 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 9;
    const radius = 0.16 + (index % 3) * 0.09;
    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: 0.16 + (index % 4) * 0.08,
      size: 0.045 + (index % 2) * 0.025,
    };
  }), []);
  const [wx, , wz] = toWorld(explosion.x, explosion.y);
  const style = getExplosionStyle(explosion.kind);

  useFrame(({ clock }, delta) => {
    ageMsRef.current = Math.min(EXPLOSION_MS, ageMsRef.current + delta * 1000);
    const progress = ageMsRef.current / EXPLOSION_MS;
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 2.5;
    }
    if (particleGroupRef.current) {
      particleGroupRef.current.scale.setScalar(1 + progress * 0.55);
      particleGroupRef.current.position.y = progress * 0.26;
    }
    if (shockwaveRef.current) {
      shockwaveRef.current.scale.setScalar(0.8 + progress * 1.4);
      const mat = shockwaveRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0, 0.45 - progress * 0.35);
    }
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = Math.max(0.1, 0.65 - progress * 0.5);
    }
    if (lightRef.current) {
      lightRef.current.intensity = 2.4 * (1 - progress);
    }
    if (flameRef.current) {
      flameRef.current.scale.set(1.1 - progress * 0.25, 1.2 + progress * 0.45, 1.1 - progress * 0.25);
      const mat = flameRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.8 - progress * 0.8;
      mat.opacity = Math.max(0.2, 0.92 - progress * 0.55);
    }
  });

  return (
    <group ref={groupRef} position={[wx, 0.25, wz]}>
      <pointLight ref={lightRef} color={style.emissive} distance={3.6} intensity={2.4} />
      <mesh ref={shockwaveRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.035, 8, 36]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={1.4}
          transparent
          opacity={0.4}
        />
      </mesh>
      <mesh ref={flameRef} position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.38, 18, 18]} />
        <meshStandardMaterial
          color={style.color}
          emissive={style.emissive}
          emissiveIntensity={1.8}
          transparent
          opacity={0.85}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <ringGeometry args={[0.18, 0.55, 6]} />
        <meshStandardMaterial
          color="#111827"
          emissive={style.emissive}
          emissiveIntensity={0.35}
          transparent
          opacity={0.65}
        />
      </mesh>
      <group ref={particleGroupRef}>
        {particles.map((particle, index) => (
          <mesh
            key={`${explosion.x}-${explosion.y}-particle-${index}`}
            position={[particle.x, particle.y, particle.z]}
          >
            {index % 3 === 0 ? (
              <boxGeometry args={[particle.size * 1.8, particle.size * 0.35, particle.size]} />
            ) : (
              <sphereGeometry args={[particle.size, 8, 8]} />
            )}
            <meshStandardMaterial
              color={getBurstParticleColor(index, explosion.kind)}
              emissive={getBurstParticleEmissive(index, explosion.kind)}
              emissiveIntensity={1.1}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const ExplosionMesh = React.memo(ExplosionMeshBase, (prev, next) => (
  prev.explosion.x === next.explosion.x
  && prev.explosion.y === next.explosion.y
  && prev.explosion.kind === next.explosion.kind
));

function ShadowBlob() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]}>
      <circleGeometry args={[0.32, 24]} />
      <meshBasicMaterial color="#000" transparent opacity={0.26} />
    </mesh>
  );
}

function PlayerMesh({ player, state }: { player: PlayerState; state: GameEngineState }) {
  const ref = useRef<THREE.Group>(null);
  const ghost = isPowerUpActive(state, player.id, 'Ghost');
  const invincible = isPowerUpActive(state, player.id, 'Invincibility');
  const visual = CHARACTER_VISUALS[player.characterId];
  useSmoothWorldPosition(ref, player.x, player.y, 0.55);

  useFrame(({ clock }) => {
    if (ref.current && invincible) {
      ref.current.visible = Math.sin(clock.elapsedTime * 10) > 0;
    } else if (ref.current) {
      ref.current.visible = true;
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
      <mesh position={[0, 0.32, 0.02]} castShadow>
        <sphereGeometry args={[0.19, 18, 18]} />
        <meshStandardMaterial color="#f2c7a2" roughness={0.48} transparent={ghost} opacity={ghost ? 0.55 : 1} />
      </mesh>
      <mesh position={[0, 0.45, -0.02]} scale={[1.05, 0.58, 0.95]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color={visual.hair} roughness={0.5} transparent={ghost} opacity={ghost ? 0.55 : 1} />
      </mesh>
      <mesh position={[0, 0.35, 0.2]} castShadow>
        <boxGeometry args={[0.42, 0.055, 0.04]} />
        <meshStandardMaterial
          color={visual.accent}
          emissive={visual.accent}
          emissiveIntensity={0.2}
          transparent={ghost}
          opacity={ghost ? 0.55 : 1}
        />
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
        <mesh key={`${player.id}-eye-${side}`} position={[side, 0.34, 0.17]}>
          <sphereGeometry args={[0.025, 8, 8]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      ))}
      <mesh position={[0, -0.27, -0.08]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.075, 0.075, 0.42, 12]} />
        <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.12} />
      </mesh>
      {invincible && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
          <torusGeometry args={[0.48, 0.03, 8, 36]} />
          <meshBasicMaterial color="#ffd166" transparent opacity={0.72} />
        </mesh>
      )}
    </group>
  );
}

function MonsterMesh({ monster }: { monster: MonsterState }) {
  const ref = useRef<THREE.Group>(null);
  const color = MONSTER_COLORS[monster.kind];
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
    <group ref={ref} scale={1.22}>
      <ShadowBlob />
      <mesh castShadow>
        <dodecahedronGeometry args={[0.4, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isGhost ? 0.95 : 0.38}
          transparent={isGhost}
          opacity={isGhost ? 0.58 : 1}
          roughness={0.38}
        />
      </mesh>
      <pointLight color={color} distance={3.2} intensity={isGhost ? 1.05 : 0.65} />
      <mesh position={[0, 0.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.16, 0.24, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.39, 0]}>
        <torusGeometry args={[0.5, 0.022, 6, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          transparent
          opacity={isGhost ? 0.58 : 0.4}
        />
      </mesh>
      {Array.from({ length: tails }, (_, index) => {
        const offset = (index - (tails - 1) / 2) * 0.12;
        return (
          <mesh
            key={`${monster.id}-tail-${index}`}
            position={[offset, 0.04 + index * 0.015, -0.34]}
            rotation={[0.8, offset * 2.2, offset * 3.2]}
            castShadow
          >
            <capsuleGeometry args={[0.055, 0.46, 5, 8]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={isGhost ? 0.45 : 0.16}
              transparent={isGhost}
              opacity={isGhost ? 0.55 : 1}
            />
          </mesh>
        );
      })}
      {[-0.12, 0.12].map((side) => (
        <mesh key={`${monster.id}-eye-${side}`} position={[side, 0.09, 0.28]}>
          <sphereGeometry args={[0.055, 10, 10]} />
          <meshStandardMaterial color="#f8f9fa" emissive="#f8f9fa" emissiveIntensity={0.15} />
        </mesh>
      ))}
      {[-0.12, 0.12].map((side) => (
        <mesh key={`${monster.id}-pupil-${side}`} position={[side, 0.085, 0.33]}>
          <sphereGeometry args={[0.024, 8, 8]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
      {(monster.kind === 'fork' || monster.kind === 'smart') && [-0.16, 0.16].map((side) => (
        <mesh
          key={`${monster.id}-horn-${side}`}
          position={[side, 0.36, 0.02]}
          rotation={[0.25, 0, side > 0 ? -0.45 : 0.45]}
        >
          <coneGeometry args={[0.07, 0.22, 8]} />
          <meshStandardMaterial color="#f1f2f6" roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function BossMesh({ state }: { state: GameEngineState }) {
  const { boss } = state;
  const ref = useRef<THREE.Group>(null);
  const bossTexture = useCroppedTexture(
    RosterBoard,
    boss ? BOSS_CROPS[boss.id] : BOSS_CROPS.shukaku
  );
  useSmoothWorldPosition(ref, boss?.x ?? 0, boss?.y ?? 0, 0.9);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.9 + Math.sin(clock.elapsedTime * 2.2) * 0.05;
    }
  });

  if (!boss || boss.health <= 0) return null;

  return (
    <group ref={ref} scale={1.6}>
      <pointLight color={boss.color} distance={6} intensity={1.8} />
      <ShadowBlob />
      <BillboardPlane texture={bossTexture} width={1.05} height={1.25} />
      {Array.from({ length: boss.tails }, (_, index) => {
        const offset = (index - (boss.tails - 1) / 2) * 0.08;
        return (
          <mesh
            key={`${boss.id}-boss-tail-${index}`}
            position={[offset, 0.02 + index * 0.01, -0.5]}
            rotation={[0.9, offset * 4, offset * 4]}
            castShadow
          >
            <capsuleGeometry args={[0.045, 0.62, 5, 8]} />
            <meshStandardMaterial
              color={boss.color}
              emissive={boss.color}
              emissiveIntensity={0.28}
            />
          </mesh>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.54, 0]}>
        <torusGeometry args={[0.62, 0.025, 8, 42]} />
        <meshStandardMaterial
          color={boss.color}
          emissive={boss.color}
          emissiveIntensity={1.1}
          transparent
          opacity={0.42}
        />
      </mesh>
    </group>
  );
}

function HazardMesh({ hazard }: { hazard: BossHazard }) {
  const ref = useRef<THREE.Mesh>(null);
  const [wx, , wz] = toWorld(hazard.x, hazard.y);
  const active = hazard.ticksRemaining <= hazard.warningTicks;

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.z = clock.elapsedTime * 3;
      ref.current.scale.setScalar(active ? 1.15 : 0.85 + Math.sin(clock.elapsedTime * 8) * 0.08);
    }
  });

  return (
    <mesh ref={ref} position={[wx, 0.05, wz]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.18, active ? 0.52 : 0.38, 24]} />
      <meshStandardMaterial
        color={active ? hazard.color : '#facc15'}
        emissive={active ? hazard.color : '#facc15'}
        emissiveIntensity={active ? 1.3 : 0.65}
        transparent
        opacity={active ? 0.72 : 0.48}
      />
    </mesh>
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
      <mesh position={[0, 0.12, 0.04]} castShadow>
        <sphereGeometry args={[0.085, 14, 14]} />
        <meshStandardMaterial color="#f5efe0" emissive={accent} emissiveIntensity={0.25} />
      </mesh>
    );
  }
  if (power === 'BlastRangeUp') {
    return (
      <mesh position={[0, 0.13, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.105, 0.018, 8, 28]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.7} />
      </mesh>
    );
  }
  if (power === 'Detonator') {
    return (
      <mesh position={[0, 0.13, 0.04]}>
        <boxGeometry args={[0.07, 0.22, 0.035]} />
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
      <mesh position={[0, 0.13, 0.04]}>
        <sphereGeometry args={[0.105, 6, 6]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
      </mesh>
    );
  }
  if (power === 'Ghost') {
    return (
      <mesh position={[0, 0.13, 0.04]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.75} transparent opacity={0.62} />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0.12, 0.04]}>
      <boxGeometry args={[0.18, 0.12, 0.045]} />
      <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.35} />
    </mesh>
  );
}

function PowerUpMesh({ x, y, power }: { x: number; y: number; power: Power }) {
  const ref = useRef<THREE.Group>(null);
  const [wx, , wz] = toWorld(x, y);
  const visual = POWERUP_VISUALS[power];
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.35 + Math.sin(clock.elapsedTime * 3) * 0.08;
      ref.current.rotation.y = clock.elapsedTime;
    }
  });
  return (
    <group ref={ref} position={[wx, 0.35, wz]}>
      <pointLight color={visual.glow} distance={2.2} intensity={0.75} />
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
      {visual.shape === 'charm' ? (
        <mesh position={[0, 0.07, 0]} castShadow>
          <boxGeometry args={[0.34, 0.42, 0.07]} />
          <meshStandardMaterial color={visual.paper} emissive={visual.glow} emissiveIntensity={0.12} roughness={0.55} />
        </mesh>
      ) : (
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
      )}
      <mesh position={[0, -0.08, 0.04]} castShadow>
        <boxGeometry args={[0.52, 0.035, 0.035]} />
        <meshStandardMaterial color={visual.accent} emissive={visual.accent} emissiveIntensity={0.25} />
      </mesh>
      <PowerupSymbol power={power} accent={visual.accent} />
    </group>
  );
}

type MapTilesProps = {
  map: GameMap;
  bombs: GameEngineState['bombs'];
  destroyedBoxes: GameEngineState['destroyedBoxes'];
  explosions: GameEngineState['explosions'];
  hazards: GameEngineState['hazards'];
  palette: StageDefinition['palette'];
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

function MapTilesBase({
  map,
  bombs,
  destroyedBoxes,
  explosions,
  hazards,
  palette,
}: MapTilesProps) {
  const destroyedSet = useMemo(
    () => new Set(destroyedBoxes.map((b) => `${b.x},${b.y}`)),
    [destroyedBoxes],
  );
  const bombByCell = useMemo(
    () => new Map(bombs.map((bomb) => [`${bomb.x},${bomb.y}`, bomb])),
    [bombs],
  );

  return (
    <>
      {map.map((row, y) => row.map((cell, x) => {
        const tile = <GroundTile key={`tile-${x}-${y}`} x={x} y={y} palette={palette} />;
        if (cell === 'Wall') {
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <WallBlock x={x} y={y} palette={palette} />
            </React.Fragment>
          );
        }
        if (cell === 'Box') {
          const destroyed = destroyedSet.has(`${x},${y}`);
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <CrateBlock x={x} y={y} palette={palette} destroyed={destroyed} />
            </React.Fragment>
          );
        }
        if (isPower(cell)) {
          return (
            <React.Fragment key={`cell-${x}-${y}`}>
              {tile}
              <PowerUpMesh x={x} y={y} power={cell} />
            </React.Fragment>
          );
        }
        if (isBomb(cell)) {
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
              <CrateBlock x={x} y={y} palette={palette} />
            </React.Fragment>
          );
        }
        return tile;
      }))}
      {explosions.map((e) => (
        <ExplosionMesh key={`exp-${e.x}-${e.y}`} explosion={e} />
      ))}
      {hazards.map((hazard) => (
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
));

function SceneContent({ state }: { state: GameEngineState }) {
  const stage = getStageDefinition(state.config.stageId);
  return (
    <>
      <ambientLight intensity={0.72} />
      <hemisphereLight args={['#fef3c7', '#111827', 0.55]} />
      <directionalLight position={[8, 15, 6]} intensity={1.65} castShadow />
      <pointLight position={[-5, 8, -3]} intensity={0.95} color={stage.palette.accent} />
      <pointLight position={[5, 5, 4]} intensity={0.45} color="#f8fafc" />
      <Floor palette={stage.palette} stageId={stage.id} />
      <MapTiles
        map={state.map}
        bombs={state.bombs}
        destroyedBoxes={state.destroyedBoxes}
        explosions={state.explosions}
        hazards={state.hazards}
        palette={stage.palette}
      />
      {state.players.map((p) => (
        <PlayerMesh key={p.id} player={p} state={state} />
      ))}
      {state.monsters.map((m) => (
        <MonsterMesh key={m.id} monster={m} />
      ))}
      <BossMesh state={state} />
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
      style={{ width: '100%', height: '100%', background: 'linear-gradient(180deg, #161132 0%, #3b3278 52%, #221b44 100%)' }}
      gl={{ antialias: true }}
      camera={{ position: [0, 13.2, 9.6], fov: 48 }}
    >
      <SceneContent state={state} />
    </Canvas>
  );
}
