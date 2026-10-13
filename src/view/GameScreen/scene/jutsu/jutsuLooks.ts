import * as THREE from 'three';
import { BombKind } from '../../../../engine/types';

/**
 * Each signature bomb's blast, as the show draws the jutsu behind it:
 *
 * - smoke: a shadow clone bursting in a white puff of smoke (Naruto).
 * - barrage: the whole clone formation going up at once.
 * - rasengan: a blue chakra sphere inside the Rasenshuriken's spinning wind
 *   blades.
 * - chidori: crackling blue-white lightning bolts (Sasuke).
 * - kirin: a bolt as tall as the sky, on every cell of the cross.
 * - sand: Gaara's sand rising in spikes and closing like a coffin.
 * - tsunami: a heaving wave of sand with spray off its crest.
 * - clay: Deidara's C1 "Katsu!": a cream-white blast and orange smoke.
 * - c3: the giant clay bomb's mushroom cloud.
 * - amaterasu: crows scattering from a burst clone and Amaterasu's black
 *   flames (Itachi).
 * - tsukuyomi: the Sharingan's three tomoe turning on a red field, black
 *   flames rising.
 * - hiraishin: the Flying Thunder God's yellow flash, streaks shooting out
 *   from the mark (Minato).
 * - chakra: an ordinary explosive tag's fireball.
 *
 * Every blast keeps the shared danger marks on the floor (the expanding
 * shockwave and the hex ring, in the jutsu's colour) under its effect, so a
 * burning cell reads as burning by shape and colour whatever jutsu lit it.
 */
export type JutsuEffect =
  | 'chakra' | 'smoke' | 'barrage' | 'rasengan' | 'chidori' | 'kirin' | 'sand' | 'tsunami'
  | 'clay' | 'c3' | 'amaterasu' | 'tsukuyomi' | 'hiraishin';

export const JUTSU_OF_BOMB: Record<BombKind, JutsuEffect> = {
  standard: 'chakra',
  shadowClone: 'smoke',
  shadowCloneBarrage: 'barrage',
  rasenshuriken: 'rasengan',
  chidoriMine: 'chidori',
  kirin: 'kirin',
  sandCoffin: 'sand',
  sandTsunami: 'tsunami',
  claySpider: 'clay',
  giantClay: 'c3',
  crowClone: 'amaterasu',
  tsukuyomi: 'tsukuyomi',
  thunderMark: 'hiraishin',
  instantTeleport: 'hiraishin',
};

/** The jutsu's colours: `danger` paints the floor marks and the blast light. */
export type JutsuLook = {
  /** The main body: fireball, chakra sphere, sand dome. */
  body: string;
  /** Floor shockwave, hex ring and the pooled blast light. */
  danger: string;
  /** Streaks, flames, spikes. */
  accent: string;
  /** Sparks, grains, chunks, feathers. */
  debris: string;
  /** Smoke, dust, the wind blades, the bolts, the crows, the tomoe. */
  extra: string;
};

export const JUTSU_LOOKS: Record<JutsuEffect, JutsuLook> = {
  chakra: {
    body: '#f5efe0', danger: '#ff8a00', accent: '#fed7aa', debris: '#fed7aa', extra: '#e7e5e4',
  },
  smoke: {
    body: '#ff9f1c', danger: '#f97316', accent: '#fdba74', debris: '#f8fafc', extra: '#f8fafc',
  },
  barrage: {
    body: '#ff8a00', danger: '#f97316', accent: '#fdba74', debris: '#f8fafc', extra: '#f1f5f9',
  },
  rasengan: {
    body: '#dbeafe', danger: '#38bdf8', accent: '#e0f2fe', debris: '#7dd3fc', extra: '#f0f9ff',
  },
  chidori: {
    body: '#93c5fd', danger: '#3b82f6', accent: '#eff6ff', debris: '#bfdbfe', extra: '#e0f2fe',
  },
  kirin: {
    body: '#93c5fd', danger: '#2563eb', accent: '#eff6ff', debris: '#bfdbfe', extra: '#dbeafe',
  },
  sand: {
    body: '#d6a45d', danger: '#f59e0b', accent: '#c48a4a', debris: '#8b5e34', extra: '#e7c89a',
  },
  tsunami: {
    body: '#d6a45d', danger: '#f97316', accent: '#c48a4a', debris: '#8b5e34', extra: '#eed9b0',
  },
  clay: {
    body: '#fff7ed', danger: '#f97316', accent: '#fb923c', debris: '#f5efe0', extra: '#fdba74',
  },
  c3: {
    body: '#fff7ed', danger: '#ef4444', accent: '#fdba74', debris: '#f5efe0', extra: '#fed7aa',
  },
  amaterasu: {
    body: '#7f1d1d', danger: '#ef4444', accent: '#0a0a0f', debris: '#111827', extra: '#0b0b12',
  },
  tsukuyomi: {
    body: '#991b1b', danger: '#dc2626', accent: '#0a0a0f', debris: '#111827', extra: '#0a0a0f',
  },
  hiraishin: {
    body: '#fef9c3', danger: '#facc15', accent: '#fde047', debris: '#fef3c7', extra: '#fde047',
  },
};

/** The same colours parsed once, so the blast loop never parses a string. */
export type JutsuColors = Record<keyof JutsuLook, THREE.Color>;

export const JUTSU_COLORS: Record<JutsuEffect, JutsuColors> = Object.fromEntries(
  (Object.keys(JUTSU_LOOKS) as JutsuEffect[]).map((effect) => {
    const look = JUTSU_LOOKS[effect];
    return [effect, {
      body: new THREE.Color(look.body),
      danger: new THREE.Color(look.danger),
      accent: new THREE.Color(look.accent),
      debris: new THREE.Color(look.debris),
      extra: new THREE.Color(look.extra),
    }];
  })
) as Record<JutsuEffect, JutsuColors>;

export function jutsuOf(kind?: BombKind): JutsuEffect {
  return JUTSU_OF_BOMB[kind ?? 'standard'] ?? 'chakra';
}

// --- Beats ------------------------------------------------------------------
//
// Spinning or crackling shapes make each pixel they cross brighten and darken
// as they pass. These rates keep every such beat at or under three a second
// (WCAG 2.3.1; scene/flashSafety), whatever the shape's area. Reduced motion
// holds them all still.

/** Every bomb turns slowly on its cell (BombMesh), shapes on it included. */
export const BOMB_SPIN_RAD_PER_S = 0.7;
/**
 * The Rasenshuriken's four blades: 0.6 turns a second of their own, plus the
 * bomb's slow turn when they ride one: under 0.72 turns, 2.9 blade passes.
 */
export const RASENSHURIKEN_BLADES = 4;
export const RASENSHURIKEN_TURNS_PER_S = 0.6;
/** Tsukuyomi's three tomoe: 0.5 turns a second, 1.5 passes. */
export const TOMOE_COUNT = 3;
export const TOMOE_TURNS_PER_S = 0.5;
/** Lightning re-forks this many times a second (each fork is one change). */
export const LIGHTNING_FORKS_PER_S = 3;

/** Most brightness changes a second each spinning or crackling shape makes at one pixel. */
export function jutsuBeatsPerSecond(): Record<string, number> {
  const bombTurns = BOMB_SPIN_RAD_PER_S / (Math.PI * 2);
  return {
    rasenshuriken: RASENSHURIKEN_BLADES * (RASENSHURIKEN_TURNS_PER_S + bombTurns),
    tomoe: TOMOE_COUNT * TOMOE_TURNS_PER_S,
    // A fork lights some pixels and darkens others: a flash needs a rise
    // and a fall, so forks two changes apart make one flash. The sparks on
    // a Chidori bomb fork the same way while the bomb turns slowly.
    lightning: LIGHTNING_FORKS_PER_S / 2,
  };
}
