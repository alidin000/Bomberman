import { BombState, GameEngineState, TICK_MS } from '../../../engine';
import { getExplosionPositions } from '../../../engine/bombs';

// Read-only view helpers for bomb timing: when each bomb will really go off
// (chain reactions included) and how to draw that on the field.

/** Last stretch of a fuse drawn as "about to blow": a reaction plus a step out. */
export const FUSE_URGENT_MS = 800;

/** A remote bomb waits for its living owner, so it has no countdown. */
export function isHeldRemote(bomb: BombState, players: GameEngineState['players']): boolean {
  return bomb.manualDetonation && players.some((p) => p.id === bomb.ownerId && p.alive);
}

/**
 * Milliseconds until each bomb explodes. A bomb inside another bomb's blast
 * goes off with it (the engine chains them the same tick), so it inherits the
 * earlier time. Held remote bombs are Infinity unless a chain reaches them.
 */
export function bombDetonationTimes(
  bombs: GameEngineState['bombs'],
  map: GameEngineState['map'],
  players: GameEngineState['players']
): Map<string, number> {
  const times = new Map<string, number>();
  if (bombs.length === 0) return times;
  const byCell = new Map<string, BombState>();
  bombs.forEach((bomb) => {
    times.set(bomb.id, isHeldRemote(bomb, players) ? Infinity : Math.max(0, bomb.ticksRemaining));
    byCell.set(`${bomb.x},${bomb.y}`, bomb);
  });
  const reaches = bombs.map((bomb) => getExplosionPositions(bomb, map)
    .map((point) => byCell.get(`${point.x},${point.y}`))
    .filter((hit): hit is BombState => !!hit && hit.id !== bomb.id));
  // Relax until no time drops; each pass settles one more link of a chain.
  for (let pass = 0; pass < bombs.length; pass += 1) {
    let changed = false;
    bombs.forEach((bomb, index) => {
      const at = times.get(bomb.id) as number;
      reaches[index].forEach((hit) => {
        if (at < (times.get(hit.id) as number)) {
          times.set(hit.id, at);
          changed = true;
        }
      });
    });
    if (!changed) break;
  }
  return times;
}

/**
 * Smooths a countdown the engine steps once per tick: between ticks it keeps
 * running on the simulation clock (which stops while paused), at most one
 * tick ahead of the last published value.
 */
export type Countdown = { value: number; changedAtMs: number };

export function createCountdown(): Countdown {
  return { value: NaN, changedAtMs: 0 };
}

export function countdownNow(countdown: Countdown, value: number, simTimeMs: number): number {
  const track = countdown;
  if (value !== track.value) {
    track.value = value;
    track.changedAtMs = simTimeMs;
  }
  if (!Number.isFinite(value)) return value;
  const elapsed = Math.min(Math.max(simTimeMs - track.changedAtMs, 0), TICK_MS);
  return Math.max(0, value - elapsed);
}

/**
 * Radius (cells) of the ring that closes on a bomb as its fuse burns. It maps
 * time, not fuse fraction, so the same ring size always means the same time
 * left, whatever the bomb's fuse length: 3 s ~ 0.9 cell, 0 s = the bomb.
 */
export const FUSE_RING_MIN_RADIUS = 0.3;
export const FUSE_RING_MAX_RADIUS = 0.95;

export function fuseRingRadius(remainingMs: number): number {
  const radius = FUSE_RING_MIN_RADIUS + (0.2 * Math.max(0, remainingMs)) / 1000;
  return Math.min(FUSE_RING_MAX_RADIUS, radius);
}

/**
 * Whole-bomb swell for the last FUSE_URGENT_MS: a fast, deep beat that says
 * "about to blow" by shape and motion, not only by colour. Under 4 beats a
 * second (no flashing); a steady, larger bomb with reduced motion.
 */
export function bombPulseScale(
  remainingMs: number,
  seconds: number,
  reducedMotion: boolean
): number {
  if (!(remainingMs <= FUSE_URGENT_MS)) return 1;
  if (reducedMotion) return 1.15;
  return 1.12 + Math.sin(seconds * 24) * 0.12;
}

export type BlastPreviewCell = { x: number; y: number; imminent: boolean };

/**
 * Every visible cell some live bomb will burn, for the whole fuse. A cell is
 * imminent when the earliest bomb reaching it (chains included) has at most
 * FUSE_URGENT_MS left.
 */
export function blastPreviewCells(
  bombs: GameEngineState['bombs'],
  map: GameEngineState['map'],
  detonationMs: Map<string, number>,
  isVisible: (x: number, y: number) => boolean
): BlastPreviewCell[] {
  const soonest = new Map<string, { x: number; y: number; at: number }>();
  bombs.forEach((bomb) => {
    const at = detonationMs.get(bomb.id) ?? bomb.ticksRemaining;
    getExplosionPositions(bomb, map).forEach((point) => {
      if (!isVisible(point.x, point.y)) return;
      const key = `${point.x},${point.y}`;
      const current = soonest.get(key);
      if (!current || at < current.at) soonest.set(key, { x: point.x, y: point.y, at });
    });
  });
  return [...soonest.values()].map((cell) => ({
    x: cell.x, y: cell.y, imminent: cell.at <= FUSE_URGENT_MS,
  }));
}
