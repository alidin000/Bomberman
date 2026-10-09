/* eslint-disable react/no-unknown-property */
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EnemyArchetype } from '../../../content/enemies';
import { MonsterState } from '../../../engine/types';
import {
  FigureMaterialPool, FigurePart, mergeFigureParts, part,
} from './figureGeometry';
import {
  MONSTER_LOOKS, MonsterPose, monsterArchetypeOf, monsterMotionPhase,
} from './monsterLooks';

/**
 * One enemy figure per archetype, drawn from five shared geometries (body,
 * headgear and cloth, carried object, face, eyes) and pooled materials. The
 * head shape and the carried shape come from MONSTER_LOOKS; the pose group
 * plays the archetype's motion profile on top of the engine-driven position.
 */

export type MonsterFigureTone = 'body' | 'trim' | 'carried' | 'skin' | 'eye';
export const MONSTER_FIGURE_TONES: MonsterFigureTone[] = ['body', 'trim', 'carried', 'skin', 'eye'];

type ToneParts = Record<MonsterFigureTone, FigurePart[]>;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const rod = (r: number, h: number) => new THREE.CylinderGeometry(r, r, h, 5);
const HALF_TURN = Math.PI / 2;

function upright(torsoTop = 0.14, torsoBottom = 0.19): FigurePart[] {
  return [
    part(new THREE.CylinderGeometry(torsoTop, torsoBottom, 0.42, 6), [0, -0.02, 0]),
    part(box(0.09, 0.24, 0.1), [-0.075, -0.33, 0]),
    part(box(0.09, 0.24, 0.1), [0.075, -0.33, 0]),
    part(box(0.07, 0.3, 0.07), [-0.2, 0, 0.04], [0, 0, 0.35]),
    part(box(0.07, 0.3, 0.07), [0.2, 0, 0.04], [0, 0, -0.35]),
  ];
}

function hunched(): FigurePart[] {
  return [
    part(new THREE.CylinderGeometry(0.15, 0.2, 0.4, 6), [0, -0.08, 0.02], [0.35, 0, 0]),
    part(box(0.09, 0.22, 0.1), [-0.08, -0.34, -0.02]),
    part(box(0.09, 0.22, 0.1), [0.08, -0.34, -0.02]),
    part(box(0.07, 0.3, 0.07), [-0.18, -0.04, 0.16], [-1.1, 0, 0]),
    part(box(0.07, 0.3, 0.07), [0.18, -0.04, 0.16], [-1.1, 0, 0]),
  ];
}

const head = () => part(new THREE.IcosahedronGeometry(0.15, 1), [0, 0.33, 0.01]);
const eyes = (y: number, z: number, spread = 0.055) => [
  part(box(0.05, 0.024, 0.02), [-spread, y, z]),
  part(box(0.05, 0.024, 0.02), [spread, y, z]),
];
const dome = () => part(
  new THREE.SphereGeometry(0.2, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2),
  [0, 0.16, 0.08],
  undefined,
  [1, 0.85, 1.1]
);
const clawFan = (side: number) => [-0.035, 0, 0.035].map((offset) => (
  part(cone(0.022, 0.14, 4), [side + offset, -0.08, 0.34], [HALF_TURN, 0, 0])
));

const MONSTER_PARTS: Record<EnemyArchetype, () => ToneParts> = {
  rogueGenin: () => ({
    body: [
      ...upright(),
      // Dark hair cap with a short knot on top.
      part(new THREE.IcosahedronGeometry(0.158, 1), [0, 0.39, -0.012], undefined, [1, 0.55, 1]),
      part(cone(0.06, 0.2, 5), [0, 0.55, -0.03], [-0.35, 0, 0]),
    ],
    trim: [part(new THREE.TorusGeometry(0.14, 0.032, 4, 8), [0, 0.16, 0], [HALF_TURN, 0, 0])],
    carried: [
      part(box(0.035, 0.03, 0.3), [0.25, -0.04, 0.2]),
      part(box(0.09, 0.025, 0.025), [0.25, -0.04, 0.06]),
    ],
    skin: [head()],
    eye: eyes(0.34, 0.148),
  }),
  anbu: () => ({
    body: [...upright(0.13, 0.18)],
    trim: [
      // A tall peaked hood over the head and a narrow shoulder mantle.
      part(cone(0.2, 0.46, 6), [0, 0.45, -0.01], [0.12, 0, 0]),
      part(box(0.4, 0.07, 0.24), [0, 0.17, 0]),
    ],
    carried: [
      part(box(0.045, 0.78, 0.05), [0, 0.08, -0.19], [0, 0, 0.75]),
      part(box(0.07, 0.13, 0.07), [-0.3, 0.42, -0.19], [0, 0, 0.75]),
    ],
    skin: [head()],
    eye: eyes(0.33, 0.15, 0.05),
  }),
  mistNinja: () => ({
    body: [...upright()],
    trim: [
      // A wide, flat brimmed hat: a disc from above.
      part(cone(0.37, 0.15, 8), [0, 0.52, 0]),
      part(new THREE.CylinderGeometry(0.08, 0.11, 0.07, 6), [0, 0.61, 0]),
    ],
    carried: [
      part(rod(0.018, 1), [0.26, 0.05, 0.1], [0, 0, -0.08]),
      part(box(0.12, 0.025, 0.025), [0.32, 0.55, 0.1]),
      part(box(0.025, 0.09, 0.025), [0.37, 0.5, 0.1]),
    ],
    skin: [head()],
    eye: eyes(0.33, 0.148),
  }),
  sandNinja: () => ({
    body: [...upright(0.16, 0.21)],
    trim: [
      // A squared cowl and broad mantle: a box silhouette with square shoulders.
      part(box(0.3, 0.3, 0.3), [0, 0.36, -0.01]),
      part(box(0.52, 0.1, 0.3), [0, 0.19, 0]),
    ],
    carried: [
      part(rod(0.02, 0.9), [0.27, -0.02, 0.12]),
      part(box(0.15, 0.17, 0.025), [0.27, -0.4, 0.12]),
    ],
    skin: [part(box(0.2, 0.08, 0.02), [0, 0.35, 0.141])],
    eye: eyes(0.35, 0.152, 0.05),
  }),
  cloudNinja: () => ({
    body: [...upright()],
    trim: [
      // A folded war fan opened upward in the right hand.
      part(
        new THREE.CylinderGeometry(0.27, 0.27, 0.025, 7, 1, false, -0.75, 1.5),
        [0.3, 0.05, 0.08],
        [-HALF_TURN, 0, 0]
      ),
    ],
    carried: [
      // Two upright stalks with ball tips: a forked top from any angle.
      part(rod(0.016, 0.24), [-0.07, 0.52, -0.01], [0, 0, 0.3]),
      part(rod(0.016, 0.24), [0.07, 0.52, -0.01], [0, 0, -0.3]),
      part(new THREE.IcosahedronGeometry(0.04, 0), [-0.105, 0.63, -0.01]),
      part(new THREE.IcosahedronGeometry(0.04, 0), [0.105, 0.63, -0.01]),
    ],
    skin: [head()],
    eye: eyes(0.34, 0.148),
  }),
  whiteZetsu: () => ({
    body: [...hunched()],
    trim: [part(new THREE.IcosahedronGeometry(0.12, 0), [0, 0.12, -0.12])],
    carried: [...clawFan(-0.18), ...clawFan(0.18)],
    // Low faceless dome set into the shoulders.
    skin: [dome()],
    eye: eyes(0.22, 0.27, 0.06),
  }),
  blackZetsu: () => ({
    body: [...hunched()],
    trim: [
      // A fin ridge front to back along the dome: a line from above.
      part(cone(0.035, 0.22, 4), [0, 0.38, 0.13], undefined, [0.5, 1, 1.4]),
      part(cone(0.035, 0.18, 4), [0, 0.36, 0.04], undefined, [0.5, 1, 1.4]),
      part(cone(0.035, 0.14, 4), [0, 0.33, -0.05], undefined, [0.5, 1, 1.4]),
    ],
    carried: [-0.18, 0.18].flatMap((side) => [
      part(box(0.03, 0.03, 0.22), [side, -0.06, 0.32], [0.25, 0, 0]),
      part(cone(0.026, 0.12, 4), [side, -0.12, 0.45], [HALF_TURN + 0.6, 0, 0]),
    ]),
    skin: [dome()],
    eye: eyes(0.22, 0.27, 0.06),
  }),
};

export type MonsterFigureGeometries = Record<MonsterFigureTone, THREE.BufferGeometry>;

const GEOMETRY_CACHE = new Map<EnemyArchetype, MonsterFigureGeometries>();

/** The archetype's merged geometries, built on first use and shared. */
export function getMonsterFigureGeometries(
  archetype: EnemyArchetype
): MonsterFigureGeometries {
  let geometries = GEOMETRY_CACHE.get(archetype);
  if (!geometries) {
    const parts = MONSTER_PARTS[archetype]();
    geometries = Object.fromEntries(MONSTER_FIGURE_TONES.map((tone) => (
      [tone, mergeFigureParts(parts[tone])]
    ))) as MonsterFigureGeometries;
    GEOMETRY_CACHE.set(archetype, geometries);
  }
  return geometries;
}

const MATERIAL_POOL = new FigureMaterialPool();

function relativeLuminance(hex: string): number {
  const color = new THREE.Color(hex);
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

export function getMonsterFigureMaterials(
  archetype: EnemyArchetype,
  translucent: boolean
): Record<MonsterFigureTone, THREE.MeshStandardMaterial> {
  const look = MONSTER_LOOKS[archetype];
  const brightEyes = relativeLuminance(look.eye) > 0.4;
  return {
    body: MATERIAL_POOL.get(look.body, { translucent }),
    trim: MATERIAL_POOL.get(look.trim, { translucent }),
    carried: MATERIAL_POOL.get(look.carried, {
      translucent, glowIntensity: translucent ? 0.32 : 0.1,
    }),
    skin: MATERIAL_POOL.get(look.skin, { translucent }),
    eye: MATERIAL_POOL.get(look.eye, { translucent, glowIntensity: brightEyes ? 0.7 : 0 }),
  };
}

const POSE = new MonsterPose();

/**
 * Figures are drawn a little larger than their parts' unit size, so the head
 * and carried shapes stay readable at the zoomed-out shared-screen camera.
 * The nameplate sits above the tallest figure at this scale.
 */
export const MONSTER_FIGURE_SCALE = 1.12;

/** Water clones and crate-phasing monsters draw see-through. */
export function monsterIsTranslucent(monster: Pick<MonsterState, 'kind' | 'clone'>): boolean {
  return monster.kind === 'ghost' || !!monster.clone;
}

export function MonsterFigure({
  monster,
  reducedMotion,
}: {
  monster: MonsterState;
  reducedMotion: boolean;
}) {
  const poseRef = useRef<THREE.Group>(null);
  const archetype = monsterArchetypeOf(monster);
  const look = MONSTER_LOOKS[archetype];
  const translucent = monsterIsTranslucent(monster);
  const geometries = getMonsterFigureGeometries(archetype);
  const materials = useMemo(
    () => getMonsterFigureMaterials(archetype, translucent),
    [archetype, translucent]
  );
  const phase = useMemo(() => monsterMotionPhase(monster.id), [monster.id]);

  useFrame(({ clock }) => {
    const group = poseRef.current;
    if (!group) return;
    POSE.sample(look.motion, clock.elapsedTime + phase, look.tempo, reducedMotion);
    group.position.set(0, POSE.lift, POSE.reach);
    group.rotation.set(POSE.lean, 0, POSE.roll);
    const scale = MONSTER_FIGURE_SCALE;
    group.scale.set(scale, scale * POSE.squash, scale);
  });

  return (
    <group ref={poseRef} scale={MONSTER_FIGURE_SCALE}>
      {MONSTER_FIGURE_TONES.map((tone) => (
        <mesh
          key={tone}
          geometry={geometries[tone]}
          material={materials[tone]}
          castShadow={tone === 'body'}
        />
      ))}
    </group>
  );
}
