import { EnemyArchetype } from '../../../content/enemies';
import { MonsterKind, MonsterState } from '../../../engine/types';

/**
 * Enemy silhouettes, read in this order at gameplay distance: the shape on
 * top of the head, the shape in the hands, then how the body moves. Colour
 * only supports them. Render-only: nothing here touches engine state.
 */

export type MonsterHeadShape =
  | 'topknot'
  | 'peakHood'
  | 'brimHat'
  | 'squareCowl'
  | 'twinStalks'
  | 'lowDome'
  | 'finCrest';

export type MonsterCarryShape =
  | 'shortBlade'
  | 'backBlade'
  | 'hookRod'
  | 'spadeStaff'
  | 'foldedFan'
  | 'clawSets'
  | 'hookClaws';

export type MonsterMotionProfile = 'dart' | 'glide' | 'float' | 'stomp' | 'twitch' | 'lunge';

export type MonsterLook = {
  head: MonsterHeadShape;
  carry: MonsterCarryShape;
  motion: MonsterMotionProfile;
  /** Main mass, headgear and cloth, carried object, bare face. */
  body: string;
  trim: string;
  carried: string;
  skin: string;
  /** Small eye marks; bright on dark bodies, dark on pale ones. */
  eye: string;
  /** Motion speed multiplier (elite and fast variants move quicker). */
  tempo: number;
};

export const MONSTER_LOOKS: Record<EnemyArchetype, MonsterLook> = {
  rogueGenin: {
    head: 'topknot',
    carry: 'shortBlade',
    motion: 'dart',
    body: '#56606b',
    trim: '#c9a46a',
    carried: '#cfd6dc',
    skin: '#e6cfb0',
    eye: '#1b1f26',
    tempo: 1,
  },
  anbu: {
    head: 'peakHood',
    carry: 'backBlade',
    motion: 'glide',
    body: '#3b4252',
    trim: '#262b36',
    carried: '#d5dbe3',
    skin: '#d9c8b0',
    eye: '#f2e6c4',
    tempo: 1,
  },
  mistNinja: {
    head: 'brimHat',
    carry: 'hookRod',
    motion: 'float',
    body: '#4f7480',
    trim: '#bfa877',
    carried: '#2e3b40',
    skin: '#e1d3bd',
    eye: '#13232a',
    tempo: 1,
  },
  sandNinja: {
    head: 'squareCowl',
    carry: 'spadeStaff',
    motion: 'stomp',
    body: '#9a6a4e',
    trim: '#d9bb8b',
    carried: '#4a3326',
    skin: '#e3c7a2',
    eye: '#2a1a12',
    tempo: 1,
  },
  cloudNinja: {
    head: 'twinStalks',
    carry: 'foldedFan',
    motion: 'twitch',
    body: '#4b5f8a',
    trim: '#e2d6a2',
    carried: '#f2c94c',
    skin: '#e5d0b4',
    eye: '#141a2b',
    tempo: 1,
  },
  whiteZetsu: {
    head: 'lowDome',
    carry: 'clawSets',
    motion: 'lunge',
    body: '#d6d3c7',
    trim: '#8d8a7d',
    carried: '#3d3a34',
    skin: '#d6d3c7',
    eye: '#2a2824',
    tempo: 1,
  },
  blackZetsu: {
    head: 'finCrest',
    carry: 'hookClaws',
    motion: 'lunge',
    body: '#2b2a31',
    trim: '#8a3442',
    carried: '#cfc8bb',
    skin: '#2b2a31',
    eye: '#f0c95a',
    tempo: 1.35,
  },
};

/** Monsters spawned without an archetype (old saves, tests) use their kind's. */
const KIND_FALLBACK: Record<MonsterKind, EnemyArchetype> = {
  basic: 'rogueGenin',
  smart: 'sandNinja',
  ghost: 'mistNinja',
  fork: 'anbu',
};

export function monsterArchetypeOf(monster: Pick<MonsterState, 'archetype' | 'kind'>): EnemyArchetype {
  return monster.archetype ?? KIND_FALLBACK[monster.kind];
}

export function monsterLookFor(monster: Pick<MonsterState, 'archetype' | 'kind'>): MonsterLook {
  return MONSTER_LOOKS[monsterArchetypeOf(monster)];
}

/** A per-monster phase so a pack never bobs in lockstep. */
export function monsterMotionPhase(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973;
  }
  return (hash / 9973) * Math.PI * 2;
}

export const MAX_MONSTER_LIFT = 0.07;
export const MAX_MONSTER_REACH = 0.12;

/**
 * Offsets for a nested pose group; the outer group keeps the engine-driven
 * place. `sample` overwrites every field (no allocation, so it can run every
 * frame). Reduced motion holds a still, readable pose: the profile's lean
 * only, with no bob, sway or lunge.
 */
export class MonsterPose {
  /** Up from the rest height (cells). */
  lift = 0;

  /** Forward along the facing (cells). */
  reach = 0;

  /** Forward pitch (radians, +: leaning in). */
  lean = 0;

  /** Side roll (radians). */
  roll = 0;

  /** Vertical squash (1 = none). */
  squash = 1;

  sample(
    profile: MonsterMotionProfile,
    seconds: number,
    tempo: number,
    reducedMotion: boolean
  ): this {
    const t = seconds * tempo;
    this.lift = 0;
    this.reach = 0;
    this.roll = 0;
    this.squash = 1;
    switch (profile) {
      case 'dart':
        this.lean = 0.16;
        if (reducedMotion) break;
        // Quick light hops.
        this.lift = Math.abs(Math.sin(t * 7.5)) * 0.05;
        break;
      case 'glide':
        this.lean = 0.1;
        if (reducedMotion) break;
        // No bob at all: a smooth, low drift side to side.
        this.roll = Math.sin(t * 1.6) * 0.05;
        break;
      case 'float':
        this.lean = 0;
        if (reducedMotion) break;
        this.lift = 0.035 + Math.sin(t * 2.2) * 0.035;
        this.roll = Math.sin(t * 1.1) * 0.08;
        break;
      case 'stomp': {
        this.lean = 0.04;
        if (reducedMotion) break;
        // Rise slowly, drop hard, squash on landing.
        const step = Math.abs(Math.sin(t * 3.4));
        this.lift = step ** 3 * MAX_MONSTER_LIFT;
        this.squash = 1 - (1 - step) ** 6 * 0.08;
        break;
      }
      case 'twitch': {
        this.lean = 0.06;
        if (reducedMotion) break;
        // Mostly still, with short sideways jolts.
        const burst = Math.max(0, Math.sin(t * 1.9) - 0.55) / 0.45;
        this.roll = Math.sin(t * 15) * 0.09 * burst;
        this.lift = 0.012 * burst;
        break;
      }
      case 'lunge':
      default: {
        this.lean = 0.28;
        if (reducedMotion) break;
        // Coiled low, then a short snap forward.
        const coil = Math.max(0, Math.sin(t * 2.6)) ** 4;
        this.reach = coil * MAX_MONSTER_REACH;
        this.lean = 0.28 + coil * 0.14;
        break;
      }
    }
    return this;
  }
}
