/* eslint-disable comma-dangle */
import { GameEngineState } from '../engine';

// Render-side motion tracks. The simulation moves entities in discrete steps
// (players 0.1 cell per move step, monsters and bosses one whole cell per
// move); the renderer replays each step as a timed glide from where the entity
// was drawn to where the simulation put it, sampled at simulation time. This
// is "fixed timestep + render interpolation": motion stays continuous and
// frame-rate independent, and lags the simulation by at most one step.

export type MotionEasing = 'linear' | 'smooth';

export type MotionTrack = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startMs: number;
  durationMs: number;
  easing: MotionEasing;
};

export type MotionStore = {
  /** Simulation clock: advances only while a round is live, so pauses freeze glides. */
  simTimeMs: number;
  tracks: Map<string, MotionTrack>;
};

export type MotionPoint = { x: number; y: number };

/** A position change larger than this is a teleport or respawn: draw it at once. */
export const MOTION_SNAP_DISTANCE = 1.6;
/**
 * Monsters and bosses hop a whole cell per move. Gliding the hop over a fixed
 * window keeps the average gap between drawn and simulated position at today's
 * level (~0.17 cell for a 700 ms walker) while removing the exponential lurch.
 */
export const ENEMY_GLIDE_MS = 240;

export function createMotionStore(): MotionStore {
  return { simTimeMs: 0, tracks: new Map() };
}

export function playerMotionId(id: string): string {
  return `player:${id}`;
}

export function monsterMotionId(id: string): string {
  return `monster:${id}`;
}

export const BOSS_MOTION_ID = 'boss';

function ease(t: number, easing: MotionEasing): number {
  if (easing === 'linear') return t;
  return t * t * (3 - 2 * t);
}

export function trackProgress(track: MotionTrack, timeMs: number): number {
  if (track.durationMs <= 0) return 1;
  const t = (timeMs - track.startMs) / track.durationMs;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t;
}

export function sampleTrack(track: MotionTrack, timeMs: number): MotionPoint {
  const k = ease(trackProgress(track, timeMs), track.easing);
  return {
    x: track.fromX + (track.toX - track.fromX) * k,
    y: track.fromY + (track.toY - track.fromY) * k,
  };
}

/**
 * Starts a glide to (toX, toY). It begins where the previous track is drawn at
 * `startMs`, so back-to-back steps chain without a seam.
 */
export function recordMotion(
  store: MotionStore,
  id: string,
  previous: MotionPoint,
  to: MotionPoint,
  startMs: number,
  durationMs: number,
  easing: MotionEasing = 'linear',
): void {
  const existing = store.tracks.get(id);
  const from = existing ? sampleTrack(existing, startMs) : previous;
  const far = Math.abs(to.x - from.x) > MOTION_SNAP_DISTANCE
    || Math.abs(to.y - from.y) > MOTION_SNAP_DISTANCE;
  store.tracks.set(id, {
    fromX: far ? to.x : from.x,
    fromY: far ? to.y : from.y,
    toX: to.x,
    toY: to.y,
    startMs,
    durationMs: far ? 0 : durationMs,
    easing,
  });
}

/** Drawn position of an entity, or its simulated position when it has no track. */
export function samplePosition(
  store: MotionStore | null | undefined,
  id: string,
  fallbackX: number,
  fallbackY: number,
): MotionPoint {
  const track = store?.tracks.get(id);
  if (!store || !track) return { x: fallbackX, y: fallbackY };
  return sampleTrack(track, store.simTimeMs);
}

export function isTrackMoving(store: MotionStore | null | undefined, id: string): boolean {
  const track = store?.tracks.get(id);
  if (!store || !track) return false;
  return trackProgress(track, store.simTimeMs) < 1
    && (track.toX !== track.fromX || track.toY !== track.fromY);
}

export function clearMotion(store: MotionStore): void {
  store.tracks.clear();
}

function samePosition(a: MotionPoint, b: MotionPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Records the glide for one player after a MOVE step. */
export function recordPlayerStep(
  store: MotionStore,
  before: GameEngineState,
  after: GameEngineState,
  playerId: string,
  startMs: number,
  stepMs: number,
): void {
  const previous = before.players.find((player) => player.id === playerId);
  const next = after.players.find((player) => player.id === playerId);
  if (!previous || !next || samePosition(previous, next)) return;
  recordMotion(store, playerMotionId(playerId), previous, next, startMs, stepMs);
}

/** Records glides for every entity a TICK moved, and drops tracks of removed ones. */
export function recordTickMotion(
  store: MotionStore,
  before: GameEngineState,
  after: GameEngineState,
  startMs: number,
  tickMs: number,
): void {
  if (before.players !== after.players) {
    after.players.forEach((player) => {
      const previous = before.players.find((item) => item.id === player.id);
      if (previous && !samePosition(previous, player)) {
        recordMotion(store, playerMotionId(player.id), previous, player, startMs, tickMs);
      }
    });
  }

  if (before.monsters !== after.monsters) {
    const previousById = new Map(before.monsters.map((monster) => [monster.id, monster]));
    const alive = new Set<string>();
    after.monsters.forEach((monster) => {
      const id = monsterMotionId(monster.id);
      alive.add(id);
      const previous = previousById.get(monster.id);
      if (previous && !samePosition(previous, monster)) {
        recordMotion(store, id, previous, monster, startMs, ENEMY_GLIDE_MS, 'smooth');
      }
    });
    previousById.forEach((_, monsterId) => {
      const id = monsterMotionId(monsterId);
      if (!alive.has(id)) store.tracks.delete(id);
    });
  }

  if (before.boss !== after.boss) {
    if (!after.boss) {
      store.tracks.delete(BOSS_MOTION_ID);
    } else if (before.boss && !samePosition(before.boss, after.boss)) {
      recordMotion(store, BOSS_MOTION_ID, before.boss, after.boss, startMs, ENEMY_GLIDE_MS, 'smooth');
    }
  }
}
