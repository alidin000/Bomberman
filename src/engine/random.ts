/* eslint-disable no-bitwise */
// Seeded randomness for the simulation. The engine never calls Math.random:
// every draw advances `rngSeed` in state, so a match replays exactly from its
// starting config (mulberry32, a 32-bit PRNG that is fast and small to store).

export const DEFAULT_MATCH_SEED = 0x5eed1e55;

export interface RandomDraw {
  value: number;
  seed: number;
}

export function normalizeSeed(seed: number | undefined): number {
  return Number.isFinite(seed) ? (seed as number) >>> 0 : DEFAULT_MATCH_SEED;
}

export function nextRandom(seed: number): RandomDraw {
  const nextSeed = (seed + 0x6d2b79f5) >>> 0;
  let t = nextSeed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: nextSeed };
}

// A fresh, still deterministic, seed for the next match (restart / rematch).
export function deriveMatchSeed(seed: number): number {
  return Math.floor(nextRandom(seed ^ 0x9e3779b9).value * 4294967296) >>> 0;
}

// Only for the UI boundary, never inside the reducer.
export function createMatchSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

export interface WeightedEntry<T> {
  item: T;
  weight: number;
}

export function pickWeighted<T>(entries: readonly WeightedEntry<T>[], roll: number): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = roll * total;
  for (let index = 0; index < entries.length; index += 1) {
    threshold -= entries[index].weight;
    if (threshold < 0) return entries[index].item;
  }
  return entries[entries.length - 1].item;
}
