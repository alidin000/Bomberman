/* eslint-disable react/no-unknown-property, react/require-default-props */
import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CampaignPuzzleRole } from '../../../content/campaignMissions';
import {
  CampaignObjectiveState,
  CampaignPuzzleElementState,
  CampaignPuzzleState,
  FogOfWarState,
  GameEngineState,
} from '../../../engine/types';
import { getCellVisibility } from '../../../engine/fogOfWar';
import { TICK_MS } from '../../../engine/constants';
import { puzzleHighlights } from '../../../engine/campaignPuzzles';
import { MotionStore, playerMotionId, samplePosition } from '../../../hooks/motionStore';
import { toWorld } from './sceneSpace';
import {
  FigurePart, Vec3, mergeFigureParts, part,
} from './figureGeometry';
import { LABEL_SPRITES, labelSpriteKey } from './labelSprites';
import { HighContrastOverride, useHighContrastMaterials } from './highContrast';

/**
 * Route puzzle pieces. Every piece stands on the same square plate (the
 * puzzle family: hazards use lines, crosses, rings and diamonds), so a piece
 * never reads as danger. What a piece is shows in its silhouette; whether it
 * is done shows twice: its shape changes (a flame on the lantern, a pylon
 * lying down, a span lifted out of the water) and its plate turns from teal
 * to amber. Pieces stay drawn in a muted "remembered" tone once explored, so
 * an order or a lever sign can be read back under fog; Story shows them
 * before they are explored too.
 *
 * Geometry is merged per part and built once; materials are module-level
 * flat-shaded or transparent standard materials, the two programs the floor
 * slab and ShaderWarmup keep compiled, so a piece mounting mid-match adds no
 * shader program. Timers (a pylon re-tying, a burning beacon) are drawn from
 * the live state in useFrame: the pieces do not re-render while they run.
 */

type Tone =
  | 'stone' | 'wood' | 'sand' | 'bronze' | 'paper' | 'iron'
  | 'plateLocked' | 'plateActive' | 'plateDone'
  | 'off' | 'ready' | 'lit' | 'struck' | 'string' | 'flame'
  | 'memoryBody' | 'memoryOff' | 'memoryOn'
  | 'timer' | 'timerBack' | 'hint';

const TONES: Record<Tone, { color: string; glow?: string; glowIntensity?: number }> = {
  stone: { color: '#a8a29e' },
  wood: { color: '#8b5e34' },
  sand: { color: '#d6b37a' },
  bronze: { color: '#9a6b1f' },
  paper: { color: '#f5f5f4' },
  iron: { color: '#475569' },
  plateLocked: { color: '#64748b' },
  plateActive: { color: '#0f766e', glow: '#14b8a6', glowIntensity: 0.2 },
  plateDone: { color: '#d97706', glow: '#fbbf24', glowIntensity: 0.35 },
  off: { color: '#1f2937' },
  ready: { color: '#2dd4bf', glow: '#2dd4bf', glowIntensity: 0.5 },
  lit: { color: '#fde68a', glow: '#fbbf24', glowIntensity: 1.1 },
  struck: { color: '#fb923c', glow: '#f97316', glowIntensity: 0.9 },
  string: { color: '#c084fc', glow: '#a855f7', glowIntensity: 0.7 },
  flame: { color: '#fdba74', glow: '#f97316', glowIntensity: 1.3 },
  // Remembered pieces stand on dimmed, explored floor: lighter tones.
  memoryBody: { color: '#b6c2d1' },
  memoryOff: { color: '#64748b' },
  memoryOn: { color: '#fbbf24', glow: '#f59e0b', glowIntensity: 0.45 },
  timer: { color: '#fde68a', glow: '#fbbf24', glowIntensity: 0.9 },
  timerBack: { color: '#111827' },
  hint: { color: '#ecfeff', glow: '#22d3ee', glowIntensity: 0.9 },
};

function createToneMaterial(tone: Tone): THREE.MeshStandardMaterial {
  const { color, glow, glowIntensity } = TONES[tone];
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0,
    flatShading: true,
    emissive: glow ?? color,
    emissiveIntensity: glowIntensity ?? 0.05,
  });
}

const MATERIALS = Object.fromEntries(
  (Object.keys(TONES) as Tone[]).map((tone) => [tone, createToneMaterial(tone)])
) as Record<Tone, THREE.MeshStandardMaterial>;
// A lowered span lies under this water.
const WATER_MATERIAL = new THREE.MeshStandardMaterial({
  color: '#38bdf8',
  emissive: '#0ea5e9',
  emissiveIntensity: 0.25,
  roughness: 0.3,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
});

// High contrast: plates and the on/off accents separate by lightness.
const HIGH_CONTRAST_PUZZLE: readonly HighContrastOverride[] = [
  { material: MATERIALS.plateActive, color: '#0b3d3a' },
  { material: MATERIALS.plateDone, color: '#ffd166' },
  { material: MATERIALS.off, color: '#000000' },
  { material: MATERIALS.lit, color: '#fff7c2' },
  { material: MATERIALS.memoryBody, color: '#94a3b8' },
  { material: WATER_MATERIAL, opacity: 0.8 },
];

// --- Geometry ------------------------------------------------------------------

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const UP = new THREE.Vector3(0, 1, 0);

// A thin bar from one point to another.
function rod(from: Vec3, to: Vec3, thickness: number): FigurePart {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const length = direction.length();
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize())
  );
  const middle = start.add(direction.multiplyScalar(0.5));
  return part(
    box(thickness, length, thickness),
    [middle.x, middle.y, middle.z],
    [rotation.x, rotation.y, rotation.z]
  );
}

type PuzzleGeometries = {
  plate: THREE.BufferGeometry;
  lanternBody: THREE.BufferGeometry;
  lanternWindow: THREE.BufferGeometry;
  flame: THREE.BufferGeometry;
  pylonUp: THREE.BufferGeometry;
  pylonStrings: THREE.BufferGeometry;
  pylonDown: THREE.BufferGeometry;
  leverBase: THREE.BufferGeometry;
  leverIdle: THREE.BufferGeometry;
  leverPulled: THREE.BufferGeometry;
  leverSign: THREE.BufferGeometry;
  spanDown: THREE.BufferGeometry;
  spanUp: THREE.BufferGeometry;
  water: THREE.BufferGeometry;
  shrine: THREE.BufferGeometry[];
  bell: THREE.BufferGeometry;
  keystoneBed: THREE.BufferGeometry;
  keystone: THREE.BufferGeometry;
  cairn: THREE.BufferGeometry;
  wardPost: THREE.BufferGeometry;
  wardTag: THREE.BufferGeometry[];
  beaconStand: THREE.BufferGeometry;
  beaconEmbers: THREE.BufferGeometry;
  bar: THREE.BufferGeometry;
  chevron: THREE.BufferGeometry;
};

let geometries: PuzzleGeometries | null = null;

function buildGeometries(): PuzzleGeometries {
  const merge = mergeFigureParts;
  const corner = 0.36;
  const studs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
    part(box(0.13, 0.05, 0.13), [sx * corner, 0.07, sz * corner])
  ));
  const pips = (count: number) => Array.from({ length: count }, (_, index) => (
    part(box(0.07, 0.07, 0.07), [(index - (count - 1) / 2) * 0.14, 0.9, 0])
  ));
  const shrineFrame = () => [
    part(box(0.08, 0.72, 0.08), [-0.27, 0.4, 0]),
    part(box(0.08, 0.72, 0.08), [0.27, 0.4, 0]),
    part(box(0.78, 0.08, 0.13), [0, 0.8, 0]),
    part(box(0.6, 0.05, 0.08), [0, 0.66, 0]),
  ];
  const squareGlyph = [
    part(box(0.14, 0.025, 0.02), [0, 0.6, 0.035]),
    part(box(0.14, 0.025, 0.02), [0, 0.47, 0.035]),
    part(box(0.025, 0.14, 0.02), [-0.06, 0.535, 0.035]),
    part(box(0.025, 0.14, 0.02), [0.06, 0.535, 0.035]),
  ];
  const tag = () => part(box(0.26, 0.42, 0.03), [0, 0.54, 0.02]);
  return {
    // A square tile with four corner studs.
    plate: merge([part(box(0.84, 0.05, 0.84), [0, 0.025, 0]), ...studs]),
    lanternBody: merge([
      part(box(0.34, 0.1, 0.34), [0, 0.1, 0]),
      part(box(0.12, 0.26, 0.12), [0, 0.28, 0]),
      part(box(0.3, 0.22, 0.3), [0, 0.52, 0]),
      part(new THREE.ConeGeometry(0.3, 0.2, 4), [0, 0.73, 0], [0, Math.PI / 4, 0]),
      part(box(0.06, 0.08, 0.06), [0, 0.86, 0]),
    ]),
    lanternWindow: merge([
      part(box(0.33, 0.12, 0.16), [0, 0.52, 0]),
      part(box(0.16, 0.12, 0.33), [0, 0.52, 0]),
    ]),
    flame: merge([
      part(new THREE.OctahedronGeometry(0.1, 0), [0, 1.0, 0], undefined, [1, 1.7, 1]),
    ]),
    pylonUp: merge([
      part(new THREE.CylinderGeometry(0.07, 0.15, 0.9, 4), [0, 0.5, 0], [0, Math.PI / 4, 0]),
      part(new THREE.ConeGeometry(0.11, 0.16, 4), [0, 1.03, 0], [0, Math.PI / 4, 0]),
      part(box(0.56, 0.06, 0.06), [0, 0.84, 0]),
    ]),
    // Chakra strings from the crossbar to the plate's corners.
    pylonStrings: merge([
      rod([-0.27, 0.84, 0], [-corner, 0.08, -corner], 0.025),
      rod([-0.27, 0.84, 0], [-corner, 0.08, corner], 0.025),
      rod([0.27, 0.84, 0], [corner, 0.08, -corner], 0.025),
      rod([0.27, 0.84, 0], [corner, 0.08, corner], 0.025),
    ]),
    // Toppled: the obelisk lies across the plate, the crossbar beside it.
    pylonDown: merge([
      part(new THREE.CylinderGeometry(0.07, 0.15, 0.9, 4), [0.02, 0.14, 0], [0, 0, Math.PI / 2]),
      part(new THREE.ConeGeometry(0.11, 0.16, 4), [-0.5, 0.14, 0], [0, 0, Math.PI / 2]),
      part(box(0.06, 0.06, 0.5), [0.2, 0.08, 0.26], [0, 0.5, 0]),
    ]),
    leverBase: merge([part(box(0.38, 0.12, 0.26), [0, 0.06, 0])]),
    leverIdle: merge([
      part(box(0.07, 0.44, 0.07), [-0.09, 0.32, 0], [0, 0, 0.45]),
      part(new THREE.IcosahedronGeometry(0.07, 0), [-0.19, 0.53, 0]),
    ]),
    leverPulled: merge([
      part(box(0.07, 0.44, 0.07), [0.09, 0.32, 0], [0, 0, -0.45]),
      part(new THREE.IcosahedronGeometry(0.07, 0), [0.19, 0.53, 0]),
    ]),
    leverSign: merge([
      part(box(0.05, 0.42, 0.05), [0.28, 0.21, -0.26]),
      part(box(0.36, 0.2, 0.035), [0.28, 0.5, -0.26]),
    ]),
    // Lowered: the plank sits at the waterline. Raised: lifted on posts with rails.
    spanDown: merge([part(box(0.8, 0.06, 0.48), [0, 0.06, 0])]),
    spanUp: merge([
      part(box(0.84, 0.07, 0.5), [0, 0.3, 0]),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        part(box(0.06, 0.3, 0.06), [sx * 0.37, 0.15, sz * 0.21])
      )),
      part(box(0.84, 0.04, 0.04), [0, 0.46, -0.23]),
      part(box(0.84, 0.04, 0.04), [0, 0.46, 0.23]),
    ]),
    water: merge([part(box(0.86, 0.04, 0.86), [0, 0.12, 0])]),
    // A bell gate with as many pips on the beam as its place in the order.
    shrine: [1, 2, 3, 4].map((count) => merge([...shrineFrame(), ...pips(count)])),
    bell: merge([
      part(new THREE.CylinderGeometry(0.08, 0.15, 0.2, 6), [0, 0.46, 0]),
      part(box(0.03, 0.1, 0.03), [0, 0.6, 0]),
      part(new THREE.IcosahedronGeometry(0.04, 0), [0, 0.34, 0]),
    ]),
    keystoneBed: merge([part(box(0.5, 0.06, 0.5), [0, 0.06, 0])]),
    keystone: merge([
      part(new THREE.IcosahedronGeometry(0.17, 0), [0, 0, 0], undefined, [1, 1.25, 0.9]),
    ]),
    cairn: merge([
      part(new THREE.IcosahedronGeometry(0.17, 0), [-0.2, 0.13, 0.12]),
      part(new THREE.IcosahedronGeometry(0.16, 0), [0.2, 0.12, 0.12]),
      part(new THREE.IcosahedronGeometry(0.18, 0), [0, 0.13, -0.2]),
      part(new THREE.IcosahedronGeometry(0.13, 0), [0, 0.36, 0]),
    ]),
    wardPost: merge([
      part(box(0.2, 0.06, 0.2), [0, 0.06, 0]),
      part(box(0.06, 0.78, 0.06), [0, 0.42, -0.04]),
    ]),
    // Pair 0 wears a ring, pair 1 a square: the shape names the pair.
    wardTag: [
      merge([tag(), part(new THREE.TorusGeometry(0.065, 0.018, 4, 10), [0, 0.54, 0.04])]),
      merge([tag(), ...squareGlyph]),
    ],
    beaconStand: merge([
      ...[0, 1, 2].map((leg) => {
        const angle = (leg / 3) * Math.PI * 2;
        return rod(
          [Math.cos(angle) * 0.3, 0.05, Math.sin(angle) * 0.3],
          [Math.cos(angle) * 0.12, 0.52, Math.sin(angle) * 0.12],
          0.05
        );
      }),
      part(new THREE.CylinderGeometry(0.26, 0.14, 0.16, 6), [0, 0.6, 0]),
    ]),
    beaconEmbers: merge([part(box(0.3, 0.05, 0.3), [0, 0.69, 0], [0, 0.4, 0])]),
    bar: merge([part(box(0.7, 0.06, 0.06), [0.35, 0, 0])]),
    chevron: merge([
      part(new THREE.ConeGeometry(0.13, 0.26, 4), [0, 0, 0], [Math.PI, Math.PI / 4, 0]),
    ]),
  };
}

function puzzleGeometries(): PuzzleGeometries {
  if (!geometries) geometries = buildGeometries();
  return geometries;
}

// --- Pieces --------------------------------------------------------------------

type PieceLook = 'live' | 'memory';

// Props stand taller than the plate they sit on, so they read from the
// gameplay camera's distance next to crates and fighters.
const PROP_SCALE: Vec3 = [1.3, 1.35, 1.3];

type PieceProps = {
  piece: CampaignPuzzleElementState;
  puzzle: CampaignPuzzleState;
  status: CampaignObjectiveState['status'];
  look: PieceLook;
  highlight: boolean;
  readState: () => GameEngineState | null;
  reducedMotion: boolean;
};

function Mesh({
  geometry, material, position, shadow = false,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  position?: Vec3;
  shadow?: boolean;
}) {
  return <mesh geometry={geometry} material={material} position={position} castShadow={shadow} />;
}

function Label({ text, y }: { text: string; y: number }) {
  const key = labelSpriteKey(text, '#fff7ed');
  const sprite = useMemo(() => LABEL_SPRITES.get(key), [key]);
  useEffect(() => {
    LABEL_SPRITES.retain(key, sprite);
    return () => LABEL_SPRITES.release(key, sprite);
  }, [key, sprite]);
  return <sprite position={[0, y, 0]} scale={[1.1, 0.24, 1]} material={sprite.material} />;
}

// Time left on a toppled pylon, a struck ward or a burning beacon, read from
// the live engine tick every frame.
function TimerBar({
  piece, windowMs, readState,
}: {
  piece: CampaignPuzzleElementState;
  windowMs: number;
  readState: () => GameEngineState | null;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const { bar } = puzzleGeometries();
  const windowTicks = Math.max(1, windowMs / TICK_MS);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tick = readState()?.tick ?? 0;
    const left = Math.min(1, Math.max(0.02, ((piece.untilTick ?? tick) - tick) / windowTicks));
    mesh.scale.x = left;
  });
  return (
    <group position={[-0.35, 1.5, 0]}>
      <mesh
        geometry={bar}
        material={MATERIALS.timerBack}
        scale={[1, 0.7, 0.7]}
        position={[0, 0, -0.01]}
      />
      <mesh ref={ref} geometry={bar} material={MATERIALS.timer} />
    </group>
  );
}

// Story: a slow bob above what to do next (well under one cycle a second).
function HintChevron({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = reducedMotion ? 2.1 : 2.1 + Math.sin(clock.elapsedTime * 3) * 0.07;
  });
  return (
    <mesh
      ref={ref}
      geometry={puzzleGeometries().chevron}
      material={MATERIALS.hint}
      position={[0, 2.1, 0]}
    />
  );
}

/** Whether a piece shows its finished plate (levers and the cairn never do). */
function pieceDone(puzzle: CampaignPuzzleState, piece: CampaignPuzzleElementState): boolean {
  if (piece.role === 'lever' || piece.role === 'cairn') return false;
  // A struck ward is only done once its twin is struck too.
  if (puzzle.kind === 'pairs') return piece.on && piece.untilTick === undefined;
  return piece.on;
}

function bodyTone(role: CampaignPuzzleRole): Tone {
  switch (role) {
    case 'pylon': return 'sand';
    case 'lever': case 'span': return 'wood';
    case 'shrine': return 'iron';
    case 'ward': return 'iron';
    case 'beacon': return 'iron';
    default: return 'stone';
  }
}

function PieceProp({ piece, puzzle, look }: Pick<PieceProps, 'piece' | 'puzzle' | 'look'>) {
  const g = puzzleGeometries();
  const memory = look === 'memory';
  const body = MATERIALS[memory ? 'memoryBody' : bodyTone(piece.role)];
  let onTone: Tone = 'lit';
  if (memory) onTone = 'memoryOn';
  const offTone: Tone = memory ? 'memoryOff' : 'off';
  const struck = piece.on && piece.untilTick !== undefined && !puzzle.solved;
  switch (piece.role) {
    case 'lantern':
      return (
        <>
          <Mesh geometry={g.lanternBody} material={body} shadow={!memory} />
          <Mesh geometry={g.lanternWindow} material={MATERIALS[piece.on ? onTone : offTone]} />
          {piece.on && !memory && <Mesh geometry={g.flame} material={MATERIALS.flame} />}
        </>
      );
    case 'pylon':
      return piece.on ? (
        <Mesh geometry={g.pylonDown} material={body} shadow={!memory} />
      ) : (
        <>
          <Mesh geometry={g.pylonUp} material={body} shadow={!memory} />
          <Mesh geometry={g.pylonStrings} material={MATERIALS[memory ? 'memoryOff' : 'string']} />
        </>
      );
    case 'lever':
      return (
        <>
          <Mesh geometry={g.leverBase} material={MATERIALS[memory ? 'memoryBody' : 'iron']} />
          <Mesh
            geometry={piece.pressed ? g.leverPulled : g.leverIdle}
            material={body}
            shadow={!memory}
          />
          <Mesh geometry={g.leverSign} material={MATERIALS[memory ? 'memoryOff' : 'ready']} />
        </>
      );
    case 'span':
      return piece.on ? (
        <Mesh geometry={g.spanUp} material={memory ? MATERIALS.memoryOn : body} />
      ) : (
        <>
          <Mesh geometry={g.spanDown} material={MATERIALS[memory ? 'memoryBody' : 'off']} />
          <mesh geometry={g.water} material={WATER_MATERIAL} />
        </>
      );
    case 'shrine': {
      const frame = g.shrine[Math.min(3, Math.max(0, (piece.order ?? 1) - 1))];
      let bellTone: Tone = memory ? 'memoryOff' : 'bronze';
      if (piece.on) bellTone = onTone;
      return (
        <>
          <Mesh geometry={frame} material={body} shadow={!memory} />
          <Mesh geometry={g.bell} material={MATERIALS[bellTone]} />
        </>
      );
    }
    case 'keystone':
      return (
        <>
          <Mesh geometry={g.keystoneBed} material={MATERIALS[memory ? 'memoryOff' : 'off']} />
          {!piece.on && !piece.carriedBy && (
            <Mesh
              geometry={g.keystone}
              material={MATERIALS[memory ? 'memoryBody' : 'ready']}
              position={[0, 0.28, 0]}
            />
          )}
        </>
      );
    case 'cairn': {
      const set = puzzle.elements.filter((item) => item.role === 'keystone' && item.on).length;
      return (
        <>
          <Mesh geometry={g.cairn} material={body} shadow={!memory} />
          {[[-0.2, 0.42, 0.12], [0.2, 0.42, 0.12], [0, 0.46, -0.2]].slice(0, set).map((at) => (
            <Mesh key={at.join(',')} geometry={g.keystone} material={MATERIALS[onTone]} position={at as Vec3} />
          ))}
        </>
      );
    }
    case 'ward': {
      let tagTone: Tone = memory ? 'memoryOff' : 'paper';
      if (piece.on) tagTone = struck && !memory ? 'struck' : onTone;
      return (
        <>
          <Mesh geometry={g.wardPost} material={body} shadow={!memory} />
          <Mesh geometry={g.wardTag[(piece.pair ?? 0) % 2]} material={MATERIALS[tagTone]} />
        </>
      );
    }
    case 'beacon':
    default:
      return (
        <>
          <Mesh geometry={g.beaconStand} material={body} shadow={!memory} />
          {piece.on && !memory
            ? <Mesh geometry={g.flame} material={MATERIALS.flame} position={[0, -0.22, 0]} />
            : <Mesh geometry={g.beaconEmbers} material={MATERIALS[piece.on ? onTone : offTone]} />}
        </>
      );
  }
}

const PuzzlePiece = React.memo(({
  piece, puzzle, status, look, highlight, readState, reducedMotion,
}: PieceProps) => {
  const [wx, , wz] = toWorld(piece.x, piece.y);
  const memory = look === 'memory';
  let plateTone: Tone = 'plateLocked';
  if (status === 'active') plateTone = pieceDone(puzzle, piece) ? 'plateDone' : 'plateActive';
  if (status === 'complete') plateTone = 'plateDone';
  // A remembered piece keeps its plate colour (done or not) under fog.
  const timed = !memory
    && !puzzle.solved
    && piece.on
    && piece.untilTick !== undefined
    && (puzzle.kind === 'topple' || puzzle.kind === 'pairs' || puzzle.kind === 'relay');
  return (
    <group position={[wx, 0, wz]} name={`puzzle-${piece.id}`}>
      <mesh geometry={puzzleGeometries().plate} material={MATERIALS[plateTone]} receiveShadow />
      <group scale={PROP_SCALE}>
        <PieceProp piece={piece} puzzle={puzzle} look={look} />
      </group>
      <Label text={piece.label} y={1.8} />
      {timed && (
        <TimerBar piece={piece} windowMs={puzzle.tuning.windowMs ?? 0} readState={readState} />
      )}
      {highlight && !memory && <HintChevron reducedMotion={reducedMotion} />}
    </group>
  );
});
PuzzlePiece.displayName = 'PuzzlePiece';

// Keystones ride above the ninja carrying them, at the drawn (interpolated) spot.
function CarriedKeystones({
  pieces, readState, motion,
}: {
  pieces: CampaignPuzzleElementState[];
  readState: () => GameEngineState | null;
  motion: MotionStore | null;
}) {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const live = readState();
    pieces.forEach((piece, index) => {
      const mesh = refs.current[index];
      const player = live?.players.find((item) => item.id === piece.carriedBy);
      if (!mesh || !player) return;
      const point = samplePosition(motion, playerMotionId(player.id), player.x, player.y);
      const [wx, , wz] = toWorld(point.x, point.y);
      mesh.position.set(wx, 1.25 + index * 0.36, wz);
    });
  });
  const { keystone } = puzzleGeometries();
  return (
    <>
      {pieces.map((piece, index) => (
        <mesh
          key={piece.id}
          ref={(mesh) => { refs.current[index] = mesh; }}
          geometry={keystone}
          material={MATERIALS.ready}
          scale={PROP_SCALE}
          name={`puzzle-carried-${piece.id}`}
        />
      ))}
    </>
  );
}

type PuzzleMarkersProps = {
  objective: CampaignObjectiveState;
  fogOfWar: FogOfWarState;
  readState: () => GameEngineState | null;
  motion: MotionStore | null;
  reducedMotion: boolean;
  highContrast: boolean;
};

function pieceLook(
  puzzle: CampaignPuzzleState,
  fogOfWar: FogOfWarState,
  piece: CampaignPuzzleElementState
): PieceLook | null {
  const visibility = getCellVisibility(fogOfWar, piece.x, piece.y);
  if (visibility === 'visible') return 'live';
  if (visibility === 'explored' || puzzle.tuning.revealAll) return 'memory';
  return null;
}

/** How each piece is drawn (or not) under the current fog, as one string. */
export function puzzleFogSignature(
  objective: CampaignObjectiveState,
  fogOfWar: FogOfWarState
): string {
  const { puzzle } = objective;
  if (!puzzle) return '';
  return puzzle.elements.map((piece) => pieceLook(puzzle, fogOfWar, piece) ?? '-').join('|');
}

function PuzzleMarkersBase({
  objective, fogOfWar, readState, motion, reducedMotion, highContrast,
}: PuzzleMarkersProps) {
  useHighContrastMaterials(highContrast, HIGH_CONTRAST_PUZZLE);
  const { puzzle } = objective;
  if (!puzzle) return null;
  const highlights = new Set(objective.status === 'active' ? puzzleHighlights(puzzle) : []);
  const carried = puzzle.elements.filter((piece) => piece.carriedBy);
  return (
    <group name="puzzle-markers">
      {puzzle.elements.map((piece) => {
        const look = pieceLook(puzzle, fogOfWar, piece);
        if (!look) return null;
        return (
          <PuzzlePiece
            key={piece.id}
            piece={piece}
            puzzle={puzzle}
            status={objective.status}
            look={look}
            highlight={highlights.has(piece.id)}
            readState={readState}
            reducedMotion={reducedMotion}
          />
        );
      })}
      {carried.length > 0 && (
        <CarriedKeystones pieces={carried} readState={readState} motion={motion} />
      )}
    </group>
  );
}

/**
 * Re-renders only when the puzzle changes (a step, a blast, a timer running
 * out) or a piece changes fog class, not on every explored cell.
 */
export const PuzzleMarkers = React.memo(PuzzleMarkersBase, (previous, next) => (
  previous.objective === next.objective
  && previous.readState === next.readState
  && previous.motion === next.motion
  && previous.reducedMotion === next.reducedMotion
  && previous.highContrast === next.highContrast
  && (previous.fogOfWar === next.fogOfWar
    || puzzleFogSignature(previous.objective, previous.fogOfWar)
      === puzzleFogSignature(next.objective, next.fogOfWar))
));
