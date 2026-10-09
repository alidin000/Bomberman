/* eslint-disable react/no-unknown-property */
import React from 'react';
import * as THREE from 'three';
import { BossId } from '../../../content/types';
import {
  FigureMaterialPool, FigurePart, mergeFigureParts, part,
} from './figureGeometry';

/**
 * A distinct base silhouette for each boss: an original lacquer-spirit
 * construct read by its outline (urn, lantern, bell, boulder shoulders,
 * kettle, spore cap, kite, drum, tiered shrine), not by colour. Every base
 * stays inside BOSS_FIGURE_BOUNDS so it keeps to the boss's cell, stays under
 * its phase label and never hides a neighbouring cell's telegraph.
 */

export type BossFigureTone = 'body' | 'trim' | 'core' | 'veil';
export const BOSS_FIGURE_TONES: BossFigureTone[] = ['body', 'trim', 'core', 'veil'];

/** Local bounds before the boss group's scale (about 1.5). */
export const BOSS_FIGURE_BOUNDS = { radius: 0.62, bottom: -0.5, top: 0.95 };

export type BossFigureLook = {
  /** One word for the outline, for tests and the manual. */
  outline: string;
  body: string;
  trim: string;
  /** Emissive focal point: eyes, windows, cracks. The readable "face". */
  core: string;
};

export const BOSS_FIGURE_LOOKS: Record<BossId, BossFigureLook> = {
  shukaku: {
    outline: 'urn', body: '#c48a4a', trim: '#6b3518', core: '#f59e0b',
  },
  matatabi: {
    outline: 'lantern', body: '#9ec5fb', trim: '#16306e', core: '#38bdf8',
  },
  isobu: {
    outline: 'bell', body: '#0e7490', trim: '#0b3b4a', core: '#67e8f9',
  },
  sonGoku: {
    outline: 'boulder', body: '#9f2a22', trim: '#3a1512', core: '#fb923c',
  },
  kokuo: {
    outline: 'kettle', body: '#d2d6dc', trim: '#475569', core: '#93c5fd',
  },
  saiken: {
    outline: 'sporeCap', body: '#7c3aed', trim: '#ddd6fe', core: '#bef264',
  },
  chomei: {
    outline: 'kite', body: '#1f9d4e', trim: '#ecfdf3', core: '#86efac',
  },
  gyuki: {
    outline: 'drum', body: '#4a1f24', trim: '#ead9f7', core: '#a855f7',
  },
  kurama: {
    outline: 'shrine', body: '#d9541e', trim: '#6b2a12', core: '#fdba74',
  },
};

type ToneParts = Partial<Record<BossFigureTone, FigurePart[]>>;

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const drum = (top: number, bottom: number, h: number, segments: number) => (
  new THREE.CylinderGeometry(top, bottom, h, segments)
);
const cone = (r: number, h: number, segments: number) => new THREE.ConeGeometry(r, h, segments);
const rock = (r: number) => new THREE.IcosahedronGeometry(r, 0);
const cap = (r: number, segments = 8) => (
  new THREE.SphereGeometry(r, segments, 4, 0, Math.PI * 2, 0, Math.PI / 2)
);
const QUARTER = Math.PI / 4;
const HALF_TURN = Math.PI / 2;
const slitEyes = (y: number, z: number, spread = 0.12) => [
  part(box(0.1, 0.045, 0.03), [-spread, y, z]),
  part(box(0.1, 0.045, 0.03), [spread, y, z]),
];

const BOSS_PARTS: Record<BossId, () => ToneParts> = {
  // Squat stepped urn with stub arms.
  shukaku: () => ({
    body: [
      part(drum(0.5, 0.56, 0.36, 8), [0, -0.28, 0]),
      part(drum(0.4, 0.48, 0.32, 8), [0, 0.06, 0]),
      part(drum(0.3, 0.38, 0.18, 8), [0, 0.31, 0]),
      part(box(0.16, 0.3, 0.16), [-0.5, -0.06, 0], [0, 0, 0.2]),
      part(box(0.16, 0.3, 0.16), [0.5, -0.06, 0], [0, 0, -0.2]),
    ],
    trim: [
      part(drum(0.57, 0.57, 0.05, 8), [0, -0.1, 0]),
      part(drum(0.49, 0.49, 0.05, 8), [0, 0.22, 0]),
      part(rock(0.1), [0, 0.47, 0]),
    ],
    core: slitEyes(0.08, 0.43),
  }),
  // Tall hexagonal paper lantern crowned with flame tongues.
  matatabi: () => ({
    body: [part(drum(0.32, 0.29, 0.66, 6), [0, 0.05, 0])],
    trim: [
      part(cone(0.44, 0.22, 6), [0, 0.49, 0]),
      part(drum(0.22, 0.31, 0.12, 6), [0, -0.34, 0]),
      part(drum(0.335, 0.335, 0.04, 6), [0, 0.24, 0]),
      part(drum(0.31, 0.31, 0.04, 6), [0, -0.12, 0]),
    ],
    core: slitEyes(0.08, 0.29, 0.1),
    veil: [0, 2.1, 4.2].map((angle) => (
      part(cone(0.08, 0.32, 6), [Math.sin(angle) * 0.12, 0.74, Math.cos(angle) * 0.12])
    )),
  }),
  // Temple bell with a hanging loop and a glowing clapper.
  isobu: () => ({
    body: [part(new THREE.LatheGeometry([
      new THREE.Vector2(0.45, -0.42),
      new THREE.Vector2(0.55, -0.42),
      new THREE.Vector2(0.5, -0.32),
      new THREE.Vector2(0.4, -0.12),
      new THREE.Vector2(0.34, 0.15),
      new THREE.Vector2(0.3, 0.4),
      new THREE.Vector2(0.2, 0.57),
      new THREE.Vector2(0, 0.61),
    ], 8))],
    trim: [
      part(drum(0.565, 0.565, 0.05, 8), [0, -0.37, 0]),
      part(drum(0.35, 0.35, 0.04, 8), [0, 0.12, 0]),
      part(new THREE.TorusGeometry(0.1, 0.035, 4, 8), [0, 0.7, 0]),
    ],
    core: [part(rock(0.13), [0, -0.36, 0]), ...slitEyes(0.22, 0.33, 0.1)],
  }),
  // Heavy hunched mass: boulder shoulders much wider than the head.
  sonGoku: () => ({
    body: [
      part(rock(0.34), [0, -0.05, 0], undefined, [1.1, 0.9, 0.9]),
      part(rock(0.24), [-0.36, 0.18, 0]),
      part(rock(0.24), [0.36, 0.18, 0]),
      part(rock(0.17), [-0.42, -0.28, 0.14]),
      part(rock(0.17), [0.42, -0.28, 0.14]),
    ],
    trim: [part(rock(0.15), [0, 0.3, 0.12])],
    core: [
      part(box(0.03, 0.3, 0.02), [-0.1, -0.02, 0.31], [0, 0, 0.45]),
      part(box(0.03, 0.26, 0.02), [0.12, -0.06, 0.31], [0, 0, -0.4]),
      ...slitEyes(0.33, 0.25, 0.06),
    ],
  }),
  // Round iron kettle: pot, lid, forward spout and an arched handle.
  kokuo: () => ({
    body: [
      part(new THREE.SphereGeometry(0.38, 8, 6), [0, -0.05, 0], undefined, [1, 0.8, 1]),
      part(drum(0.05, 0.09, 0.36, 6), [0, 0.02, 0.42], [1.0, 0, 0]),
    ],
    trim: [
      part(drum(0.2, 0.26, 0.08, 8), [0, 0.28, 0]),
      part(rock(0.06), [0, 0.36, 0]),
      part(new THREE.TorusGeometry(0.32, 0.03, 4, 10, Math.PI), [0, 0.1, 0]),
    ],
    core: [part(box(0.2, 0.06, 0.03), [0, -0.2, 0.37]), ...slitEyes(0.06, 0.37, 0.1)],
    veil: [
      part(cone(0.07, 0.26, 6), [-0.08, 0.5, 0.02]),
      part(cone(0.06, 0.22, 6), [0.09, 0.56, -0.04]),
    ],
  }),
  // A wide spore cap on a stalk, with two small caps at its foot.
  saiken: () => ({
    body: [
      part(cap(0.5), [0, 0.12, 0], undefined, [1, 0.55, 1]),
      part(cap(0.2, 7), [-0.38, -0.22, 0.12], undefined, [1, 0.6, 1]),
      part(cap(0.2, 7), [0.38, -0.22, 0.12], undefined, [1, 0.6, 1]),
    ],
    trim: [
      part(drum(0.5, 0.42, 0.06, 8), [0, 0.1, 0]),
      part(drum(0.16, 0.22, 0.5, 7), [0, -0.18, 0]),
      part(drum(0.07, 0.08, 0.2, 6), [-0.38, -0.32, 0.12]),
      part(drum(0.07, 0.08, 0.2, 6), [0.38, -0.32, 0.12]),
    ],
    core: [
      part(rock(0.06), [0.16, 0.38, 0.1]),
      part(rock(0.05), [-0.2, 0.36, -0.06]),
      part(rock(0.05), [0.02, 0.4, -0.2]),
      ...slitEyes(-0.08, 0.2, 0.07),
    ],
  }),
  // A diamond kite spirit with two wide paper wings.
  chomei: () => ({
    body: [
      part(new THREE.OctahedronGeometry(0.24, 0), [0, 0.2, 0], undefined, [0.9, 1.5, 0.7]),
      part(box(0.5, 0.05, 0.32), [-0.32, 0.25, -0.02], [0, 0.2, 0.25]),
      part(box(0.5, 0.05, 0.32), [0.32, 0.25, -0.02], [0, -0.2, -0.25]),
      part(cone(0.05, 0.22, 4), [0, 0.66, 0]),
    ],
    trim: [
      // Pale spars along the wings' leading edges, like a kite's frame.
      part(box(0.54, 0.035, 0.035), [-0.3, 0.33, 0.13], [0, 0.2, 0.25]),
      part(box(0.54, 0.035, 0.035), [0.3, 0.33, 0.13], [0, -0.2, -0.25]),
    ],
    core: [part(rock(0.07), [0, 0.12, 0.15]), ...slitEyes(0.3, 0.14, 0.06)],
  }),
  // A thunder drum on its side, standing on four short legs.
  gyuki: () => ({
    body: [
      part(drum(0.36, 0.36, 0.62, 10), [0, 0.05, 0], [0, 0, HALF_TURN]),
      ...[-0.2, 0.2].flatMap((x) => [-0.18, 0.18].map((z) => (
        part(box(0.08, 0.25, 0.08), [x, -0.37, z])
      ))),
    ],
    trim: [
      part(drum(0.38, 0.38, 0.04, 10), [-0.32, 0.05, 0], [0, 0, HALF_TURN]),
      part(drum(0.38, 0.38, 0.04, 10), [0.32, 0.05, 0], [0, 0, HALF_TURN]),
      part(new THREE.TorusGeometry(0.37, 0.025, 4, 12), [-0.18, 0.05, 0], [0, HALF_TURN, 0]),
      part(new THREE.TorusGeometry(0.37, 0.025, 4, 12), [0.18, 0.05, 0], [0, HALF_TURN, 0]),
    ],
    core: [part(box(0.3, 0.05, 0.03), [0, -0.1, 0.36]), ...slitEyes(0.14, 0.36, 0.09)],
  }),
  // Three-tier square shrine with flared roofs and an ember door.
  kurama: () => ({
    body: [
      part(box(0.62, 0.2, 0.62), [0, -0.36, 0]),
      part(box(0.44, 0.28, 0.44), [0, -0.12, 0]),
      part(box(0.32, 0.22, 0.32), [0, 0.24, 0]),
      part(box(0.2, 0.16, 0.2), [0, 0.56, 0]),
    ],
    trim: [
      part(cone(0.6, 0.18, 4), [0, 0.11, 0], [0, QUARTER, 0]),
      part(cone(0.46, 0.16, 4), [0, 0.43, 0], [0, QUARTER, 0]),
      part(cone(0.32, 0.14, 4), [0, 0.71, 0], [0, QUARTER, 0]),
      part(drum(0.025, 0.025, 0.1, 4), [0, 0.8, 0]),
    ],
    core: [
      part(box(0.16, 0.16, 0.03), [0, -0.16, 0.225]),
      part(rock(0.05), [0, 0.86, 0]),
      ...slitEyes(0.27, 0.165, 0.07),
    ],
  }),
};

export type BossFigureGeometries = Partial<Record<BossFigureTone, THREE.BufferGeometry>>;

const GEOMETRY_CACHE = new Map<BossId, BossFigureGeometries>();

export function getBossFigureGeometries(bossId: BossId): BossFigureGeometries {
  let geometries = GEOMETRY_CACHE.get(bossId);
  if (!geometries) {
    const parts = BOSS_PARTS[bossId]();
    geometries = {};
    BOSS_FIGURE_TONES.forEach((tone) => {
      const list = parts[tone];
      if (list?.length && geometries) geometries[tone] = mergeFigureParts(list);
    });
    GEOMETRY_CACHE.set(bossId, geometries);
  }
  return geometries;
}

const MATERIAL_POOL = new FigureMaterialPool();

export function getBossFigureMaterials(
  bossId: BossId
): Record<BossFigureTone, THREE.MeshStandardMaterial> {
  const look = BOSS_FIGURE_LOOKS[bossId];
  return {
    body: MATERIAL_POOL.get(look.body, { glow: look.core, glowIntensity: 0.08 }),
    trim: MATERIAL_POOL.get(look.trim, { glow: look.core, glowIntensity: 0.05 }),
    core: MATERIAL_POOL.get(look.core, { glowIntensity: 0.95 }),
    veil: MATERIAL_POOL.get('#eef6ff', { translucent: true, glow: look.core, glowIntensity: 0.9 }),
  };
}

function BossFigureBase({ bossId }: { bossId: BossId }) {
  const geometries = getBossFigureGeometries(bossId);
  const materials = getBossFigureMaterials(bossId);
  return (
    <>
      {BOSS_FIGURE_TONES.map((tone) => {
        const geometry = geometries[tone];
        if (!geometry) return null;
        return (
          <mesh
            key={tone}
            geometry={geometry}
            material={materials[tone]}
            castShadow={tone === 'body'}
          />
        );
      })}
    </>
  );
}

// BossMesh re-renders every tick; the figure only changes with the boss.
export const BossFigure = React.memo(BossFigureBase);
