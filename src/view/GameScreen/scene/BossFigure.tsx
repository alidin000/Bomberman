/* eslint-disable react/no-unknown-property */
import React, {
  forwardRef, useImperativeHandle, useLayoutEffect, useRef,
} from 'react';
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { BossId } from '../../../content/types';
import { getBossDefinition } from '../../../content/bosses';
import { FigurePart, createFigureMaterial, mergeFigureParts } from './figureGeometry';
import {
  FIGHTER_INK_HIGH_CONTRAST, FIGHTER_INK_MATERIAL, FIGHTER_TOON_RAMP, createInkWarmupMaterial,
} from './fighterInk';
import type { HighContrastOverride } from './highContrast';
import {
  BEASTS, BeastLook, BeastTailLayout, BeastTone,
} from './beasts';

/**
 * The tailed beasts as the anime draws them (scene/beasts/*): Shukaku's sand
 * tanuki, Matatabi's blue-flame cat, Isobu's spiked turtle, Son Goku's red
 * ape, Kokuo's horse with a dolphin's head, Saiken's slug, Chomei's beetle,
 * Gyuki's ox-octopus and Kurama's fox, each with its own tail shape and the
 * right number of tails (Shukaku 1 ... Kurama 9). Tails sway, flare on the
 * entrance roar and droop at the seal.
 *
 * The look is cel-shaded like the fighters: the shared three-band toon ramp
 * and one inverted-hull ink line for the body and one for the tails.
 * Everything stays inside BOSS_FIGURE_BOUNDS (tails at full sway and flare
 * included), so the figure keeps to its footprint and stays under its phase
 * label, and its glowing eyes, its weak point, face the camera unblocked.
 * Base parts merge into one geometry per material; the tails are one
 * instanced mesh. Materials are shared per beast; their see-through twins
 * (for when something stands behind the boss, and for the seal) and the
 * instanced tails and their line are compiled by ShaderWarmup.
 */

export type BossFigureTone = BeastTone;
export const BOSS_FIGURE_TONES: BossFigureTone[] = ['body', 'trim', 'mark', 'core', 'veil'];

/** Local bounds before the boss group's scale (about 1.5). */
export const BOSS_FIGURE_BOUNDS = { radius: 0.62, bottom: -0.5, top: 0.95 };

/** Each beast's own tail shape (foxTail, tanukiTail, tentacle...). */
export type BossTailStyle = string;

export type BossFigureLook = BeastLook;

export const BOSS_FIGURE_LOOKS: Record<BossId, BossFigureLook> = Object.fromEntries(
  (Object.keys(BEASTS) as BossId[]).map((id) => [id, BEASTS[id].look])
) as Record<BossId, BossFigureLook>;

/** A part too small for its own ink line (an eye, a claw, a fang): the line would swallow it. */
const INK_MIN_PART = 0.07;

const PART_SIZE = new THREE.Vector3();

function partSize(entry: FigurePart): number {
  const { geometry } = entry;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const size = geometry.boundingBox!.getSize(PART_SIZE);
  const scale = entry.scale ?? [1, 1, 1];
  return Math.max(size.x * scale[0], size.y * scale[1], size.z * scale[2]);
}

/**
 * The ink line's shell: the big parts' positions welded into one geometry
 * with smoothed normals, so the pushed-out back faces close round each part.
 */
function inkHull(parts: FigurePart[]): THREE.BufferGeometry {
  const merged = mergeFigureParts(parts);
  const placed = new THREE.BufferGeometry();
  placed.setAttribute('position', merged.getAttribute('position'));
  const welded = mergeVertices(placed, 1e-4);
  merged.dispose();
  welded.computeVertexNormals();
  welded.computeBoundingSphere();
  return welded;
}

// --- Tails -----------------------------------------------------------------

/**
 * Where a boss's tails grow and how they fan. Each tail is the same shape,
 * built pointing up from its root; the fan places one per tail around the
 * figure's back.
 */
export type BossTailLayout = BeastTailLayout;

export const BOSS_TAIL_LAYOUTS: Record<BossId, BossTailLayout> = Object.fromEntries(
  (Object.keys(BEASTS) as BossId[]).map((id) => [id, BEASTS[id].layout])
) as Record<BossId, BossTailLayout>;

/** Sway (radians each way) and how far the roar fans and lifts the tails. */
export const BOSS_TAIL_SWAY = 0.12;
export const BOSS_TAIL_FLARE = { spread: 0.25, lift: -0.15 };
/** The seal: tails droop this much further from vertical, and shrink toward their roots. */
export const BOSS_TAIL_DROOP = { lean: 0.15, shrink: 0.45 };

export type BossFigureGeometries = Partial<Record<BossFigureTone, THREE.BufferGeometry>>;

type BeastGeometry = {
  tones: BossFigureGeometries;
  /** The ink line round the body (its big opaque parts). */
  hull: THREE.BufferGeometry;
};

const GEOMETRY_CACHE = new Map<BossId, BeastGeometry>();
type TailGeometry = { tail: THREE.BufferGeometry; hull: THREE.BufferGeometry };
const TAIL_GEOMETRY_CACHE = new Map<BossId, TailGeometry>();

const cloneParts = (parts: FigurePart[] = []) => parts.map((entry) => (
  { ...entry, geometry: entry.geometry.clone() }
));

function beastGeometry(bossId: BossId): BeastGeometry {
  let built = GEOMETRY_CACHE.get(bossId);
  if (!built) {
    const parts = BEASTS[bossId].parts();
    const inked = (['body', 'trim', 'mark'] as const)
      .flatMap((tone) => cloneParts(parts[tone]))
      .filter((entry) => partSize(entry) >= INK_MIN_PART);
    const hull = inkHull(inked);
    const tones: BossFigureGeometries = {};
    BOSS_FIGURE_TONES.forEach((tone) => {
      let list = parts[tone] ?? [];
      if (tone === 'core') list = [...list, ...(parts.face ?? [])];
      if (tone === 'trim') list = [...list, ...(parts.pupil ?? [])];
      if (list.length) tones[tone] = mergeFigureParts(list);
    });
    built = { tones, hull };
    GEOMETRY_CACHE.set(bossId, built);
  }
  return built;
}

export function getBossFigureGeometries(bossId: BossId): BossFigureGeometries {
  return beastGeometry(bossId).tones;
}

/** The ink line's shell round the body: back faces pushed out by the ink material. */
export function getBossInkHullGeometry(bossId: BossId): THREE.BufferGeometry {
  return beastGeometry(bossId).hull;
}

/** The boss's eyes alone (part of its core mesh): its weak point. For tests and tools. */
export function getBossFaceGeometry(bossId: BossId): THREE.BufferGeometry {
  return mergeFigureParts(BEASTS[bossId].parts().face ?? []);
}

/** One tone's own parts merged, without the eyes or pupils drawn in it. For tests and tools. */
export function getBossToneGeometry(
  bossId: BossId,
  tone: BossFigureTone
): THREE.BufferGeometry | null {
  const list = BEASTS[bossId].parts()[tone];
  return list?.length ? mergeFigureParts(list) : null;
}

function beastTail(bossId: BossId) {
  let built = TAIL_GEOMETRY_CACHE.get(bossId);
  if (!built) {
    const parts = BEASTS[bossId].tail();
    const hull = inkHull(cloneParts(parts));
    built = { tail: mergeFigureParts(parts), hull };
    TAIL_GEOMETRY_CACHE.set(bossId, built);
  }
  return built;
}

/** One tail of this boss, root at the origin and pointing up; shared by its tails. */
export function getBossTailGeometry(bossId: BossId): THREE.BufferGeometry {
  return beastTail(bossId).tail;
}

/** The ink line round one tail, instanced with the tails. */
export function getBossTailInkGeometry(bossId: BossId): THREE.BufferGeometry {
  return beastTail(bossId).hull;
}

/** One tail per tail of the boss (Shukaku 1 ... Kurama 9). */
export function bossTailCount(bossId: BossId): number {
  return Math.max(1, getBossDefinition(bossId).tails);
}

const TAIL_POSITION = new THREE.Vector3();
const TAIL_QUATERNION = new THREE.Quaternion();
const TAIL_EULER = new THREE.Euler(0, 0, 0, 'YXZ');
const TAIL_SCALE = new THREE.Vector3(1, 1, 1);

/**
 * Tail `index`'s placement in the figure: its slot in the fan, swayed by
 * `sway` (radians), fanned and lifted by `flare` (roar, 0..1) and lowered by
 * `droop` (seal, 0..1).
 */
export function bossTailMatrix(
  bossId: BossId,
  index: number,
  sway: number,
  flare: number,
  droop: number,
  target: THREE.Matrix4
): THREE.Matrix4 {
  const layout = BOSS_TAIL_LAYOUTS[bossId];
  const count = bossTailCount(bossId);
  const spread = count > 1 ? layout.spread + BOSS_TAIL_FLARE.spread * flare : 0;
  const slot = count > 1 ? index / (count - 1) - 0.5 : 0;
  // Straight back is yaw π; the fan opens round it.
  const yaw = Math.PI + (layout.turn ?? 0) + slot * spread + sway * 0.6;
  const lean = layout.lean
    + BOSS_TAIL_FLARE.lift * flare
    + BOSS_TAIL_DROOP.lean * droop
    + sway * 0.25;
  TAIL_POSITION.set(
    Math.sin(yaw) * layout.rootRadius,
    layout.rootY,
    Math.cos(yaw) * layout.rootRadius
  );
  TAIL_EULER.set(lean, yaw, 0, 'YXZ');
  TAIL_QUATERNION.setFromEuler(TAIL_EULER);
  TAIL_SCALE.setScalar(1 - BOSS_TAIL_DROOP.shrink * droop);
  return target.compose(TAIL_POSITION, TAIL_QUATERNION, TAIL_SCALE);
}

/** Each tail's sway phase, so a fan ripples instead of moving as one block. */
export function bossTailPhase(index: number): number {
  return index * 1.3;
}

// --- Materials --------------------------------------------------------------

/** How see-through the figure gets while something it would hide stands behind it. */
export const BOSS_SEE_THROUGH_OPACITY = 0.34;
const VEIL_OPACITY = 0.62;

type SolidTone = 'body' | 'trim' | 'mark' | 'core';
const SOLID_TONES: SolidTone[] = ['body', 'trim', 'mark', 'core'];

export type BossFigureMaterials = Record<SolidTone, THREE.MeshToonMaterial> & {
  veil: THREE.MeshStandardMaterial;
  /** See-through twins of the solid tones (transparent toon). */
  seeThrough: Record<SolidTone, THREE.MeshToonMaterial>;
};

const GLOW: Record<SolidTone, number> = {
  body: 0.06, trim: 0.04, mark: 0.08, core: 0.95,
};

function toon(color: string, glow: string, intensity: number): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: FIGHTER_TOON_RAMP,
    emissive: glow,
    emissiveIntensity: intensity,
  });
}

function seeThroughTwin(material: THREE.MeshToonMaterial): THREE.MeshToonMaterial {
  const twin = material.clone();
  twin.transparent = true;
  twin.depthWrite = false;
  return twin;
}

const MATERIAL_CACHE = new Map<BossId, BossFigureMaterials>();

/** One set per boss for the session (a handful), never disposed. */
export function getBossFigureMaterials(bossId: BossId): BossFigureMaterials {
  let materials = MATERIAL_CACHE.get(bossId);
  if (!materials) {
    const look = BOSS_FIGURE_LOOKS[bossId];
    const body = toon(look.body, look.core, GLOW.body);
    const trim = toon(look.trim, look.core, GLOW.trim);
    const mark = toon(look.mark, look.mark, GLOW.mark);
    const core = toon(look.core, look.core, GLOW.core);
    const veil = createFigureMaterial(look.veil, {
      translucent: true, glow: look.veil, glowIntensity: 0.7,
    });
    veil.opacity = VEIL_OPACITY;
    materials = {
      body,
      trim,
      mark,
      core,
      veil,
      seeThrough: {
        body: seeThroughTwin(body),
        trim: seeThroughTwin(trim),
        mark: seeThroughTwin(mark),
        core: seeThroughTwin(core),
      },
    };
    MATERIAL_CACHE.set(bossId, materials);
  }
  return materials;
}

/**
 * The tails' ink line: the fighters' ink look on an instanced mesh, its own
 * material so the fighters' plain line never switches program. High contrast
 * inks it black like theirs.
 */
export const BOSS_TAIL_INK_MATERIAL = createInkWarmupMaterial();
export const BOSS_INK_HIGH_CONTRAST: readonly HighContrastOverride[] = [
  { material: BOSS_TAIL_INK_MATERIAL, color: FIGHTER_INK_HIGH_CONTRAST },
];

// --- Figure -----------------------------------------------------------------

/** What the boss's presentation (BossMesh) asks of the figure each frame. */
export type BossFigurePose = {
  /** Tail sway angle source: seconds on a clock that stops for hit-stop. */
  swayTime: number;
  /** 0 holds the tails still (reduced motion, seal), 1 full sway. */
  swayAmount: number;
  /** Entrance roar: tails fan and lift (0..1). */
  flare: number;
  /** Seal: tails droop (0..1). */
  droop: number;
  /** Phase 2 colour shift: the body glows toward its core colour (0..1). */
  enrage: number;
  /** See-through while it would hide a player or a telegraph (0..1). */
  seeThrough: number;
  /** Seal: the figure dissolves and its core dims (0 whole .. 1 gone). */
  dissolve: number;
};

export type BossFigureHandle = {
  apply: (pose: BossFigurePose) => void;
};

/** Extra body and trim glow at full enrage (emissive toward the core colour). */
export const BOSS_ENRAGE_GLOW = 0.32;

const TAIL_MATRIX = new THREE.Matrix4();

function BossFigureBase({ bossId }: { bossId: BossId }, ref: React.Ref<BossFigureHandle>) {
  const geometries = getBossFigureGeometries(bossId);
  const hullGeometry = getBossInkHullGeometry(bossId);
  const materials = getBossFigureMaterials(bossId);
  const tailGeometry = getBossTailGeometry(bossId);
  const tailHullGeometry = getBossTailInkGeometry(bossId);
  const tailTone = BOSS_TAIL_LAYOUTS[bossId].tone;
  const tailCount = bossTailCount(bossId);
  const meshes = useRef<Partial<Record<BossFigureTone, THREE.Mesh | null>>>({});
  const tails = useRef<THREE.InstancedMesh>(null);
  const tailHull = useRef<THREE.InstancedMesh>(null);
  const hull = useRef<THREE.Mesh>(null);
  const setters = useRef(Object.fromEntries(BOSS_FIGURE_TONES.map((tone) => [
    tone,
    (mesh: THREE.Mesh | null) => { meshes.current[tone] = mesh; },
  ])) as Record<BossFigureTone, (mesh: THREE.Mesh | null) => void>);

  const writeTails = (pose: BossFigurePose | null) => {
    const mesh = tails.current;
    const line = tailHull.current;
    if (!mesh) return;
    for (let index = 0; index < tailCount; index += 1) {
      const sway = pose
        ? Math.sin(pose.swayTime * 1.7 + bossTailPhase(index)) * BOSS_TAIL_SWAY * pose.swayAmount
        : 0;
      bossTailMatrix(bossId, index, sway, pose?.flare ?? 0, pose?.droop ?? 0, TAIL_MATRIX);
      mesh.setMatrixAt(index, TAIL_MATRIX);
      line?.setMatrixAt(index, TAIL_MATRIX);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (line) line.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => { writeTails(null); });

  useImperativeHandle(ref, () => ({
    apply: (pose) => {
      const faded = pose.seeThrough > 0.001 || pose.dissolve > 0.001;
      const opacity = (1 - (1 - BOSS_SEE_THROUGH_OPACITY) * pose.seeThrough) * (1 - pose.dissolve);
      const glow = 1 - pose.dissolve * 0.85;
      SOLID_TONES.forEach((tone) => {
        const solid = materials[tone];
        const twin = materials.seeThrough[tone];
        const enrage = tone === 'core' || tone === 'mark' ? 0 : BOSS_ENRAGE_GLOW * pose.enrage;
        solid.emissiveIntensity = (GLOW[tone] + enrage) * glow;
        twin.emissiveIntensity = solid.emissiveIntensity;
        twin.opacity = opacity;
        const mesh = meshes.current[tone];
        if (mesh) mesh.material = faded ? twin : solid;
      });
      materials.veil.opacity = VEIL_OPACITY * opacity;
      const tailMesh = tails.current;
      if (tailMesh) {
        tailMesh.material = faded ? materials.seeThrough[tailTone] : materials[tailTone];
      }
      // The line is solid ink: it steps aside while the figure is see-through.
      if (hull.current) hull.current.visible = !faded;
      if (tailHull.current) tailHull.current.visible = !faded;
      writeTails(pose);
    },
  }));

  return (
    <>
      {BOSS_FIGURE_TONES.map((tone) => {
        const geometry = geometries[tone];
        if (!geometry) return null;
        return (
          <mesh
            key={tone}
            ref={setters.current[tone]}
            geometry={geometry}
            material={materials[tone]}
            castShadow={tone === 'body'}
          />
        );
      })}
      <mesh
        ref={hull}
        geometry={hullGeometry}
        material={FIGHTER_INK_MATERIAL}
        userData={{ bossInk: bossId }}
      />
      <instancedMesh
        ref={tails}
        args={[tailGeometry, materials[tailTone], tailCount]}
        frustumCulled={false}
        userData={{ bossTails: bossId }}
      />
      <instancedMesh
        ref={tailHull}
        args={[tailHullGeometry, BOSS_TAIL_INK_MATERIAL, tailCount]}
        frustumCulled={false}
        userData={{ bossTailInk: bossId }}
      />
    </>
  );
}

// BossMesh re-renders every tick; the figure only changes with the boss.
export const BossFigure = React.memo(forwardRef(BossFigureBase));
