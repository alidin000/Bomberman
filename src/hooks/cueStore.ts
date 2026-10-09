/* eslint-disable no-param-reassign -- the store is mutable render-side state */
import { GameEngineState, PlayerState } from '../engine/types';
import { Power, isPower } from '../model/gameItem';

// Render-only player events: a planted bomb, a survived hit, a fall and an
// ultimate, plus the last pickup. The engine loop records them by diffing the
// state before and after each step it applies, stamped with the step's due
// time, so a pose starts on the first frame that draws the step. Nothing here
// is read by the simulation: the scene samples it to pose the fighter, and a
// match runs the same with or without it.

export type PlayerCueKind = 'plant' | 'hit' | 'ultimate' | 'death';

export type PlayerCue = {
  kind: PlayerCueKind;
  /** Presentation-clock time the cue started. */
  startMs: number;
  seq: number;
};

export type PickupCue = {
  power: Power;
  startMs: number;
  seq: number;
};

export type CueStore = {
  /**
   * Presentation clock. It runs with the simulation clock while a round is
   * live and keeps running through the round result and the match result, so
   * the pose of the blast that decided a round still finishes; it stops while
   * the player has paused.
   */
  clockMs: number;
  /** The latest body cue of each player, by player id. */
  body: Map<string, PlayerCue>;
  /** The latest pickup of each player, by player id. */
  pickups: Map<string, PickupCue>;
  seq: number;
};

/** How long each body cue lasts, settle included. */
export const CUE_DURATION_MS: Record<PlayerCueKind, number> = {
  plant: 200,
  hit: 220,
  ultimate: 300,
  // The fallen fighter is posed this long, then hidden.
  death: 380,
};

/** A later cue only replaces a running one of the same or a lower rank. */
const CUE_RANK: Record<PlayerCueKind, number> = {
  plant: 0,
  ultimate: 1,
  hit: 2,
  death: 3,
};

export const PICKUP_CUE_MS = 640;

export function createCueStore(): CueStore {
  return {
    clockMs: 0, body: new Map(), pickups: new Map(), seq: 0,
  };
}

export function clearCues(store: CueStore): void {
  store.body.clear();
  store.pickups.clear();
}

function isRunning(cue: PlayerCue, nowMs: number): boolean {
  return nowMs - cue.startMs < CUE_DURATION_MS[cue.kind];
}

export function recordBodyCue(
  store: CueStore,
  playerId: string,
  kind: PlayerCueKind,
  startMs: number
): void {
  const current = store.body.get(playerId);
  if (current && isRunning(current, startMs) && CUE_RANK[current.kind] > CUE_RANK[kind]) return;
  store.seq += 1;
  if (current) {
    current.kind = kind;
    current.startMs = startMs;
    current.seq = store.seq;
  } else {
    store.body.set(playerId, { kind, startMs, seq: store.seq });
  }
}

function recordPickupCue(store: CueStore, playerId: string, power: Power, startMs: number): void {
  store.seq += 1;
  const current = store.pickups.get(playerId);
  if (current) {
    current.power = power;
    current.startMs = startMs;
    current.seq = store.seq;
  } else {
    store.pickups.set(playerId, { power, startMs, seq: store.seq });
  }
}

/**
 * The body cue a player is showing at `nowMs`, or null once it has run out.
 * A death cue never runs out: the fallen fighter stays down until the round
 * resets the store.
 */
export function bodyCueAt(
  store: CueStore | null | undefined,
  playerId: string,
  nowMs: number
): PlayerCue | null {
  const cue = store?.body.get(playerId);
  if (!cue || nowMs < cue.startMs) return null;
  if (cue.kind === 'death' || isRunning(cue, nowMs)) return cue;
  return null;
}

/** The pickup a player is showing at `nowMs`, or null once its label is gone. */
export function pickupCueAt(
  store: CueStore | null | undefined,
  playerId: string,
  nowMs: number
): PickupCue | null {
  const cue = store?.pickups.get(playerId);
  if (!cue || nowMs < cue.startMs || nowMs - cue.startMs >= PICKUP_CUE_MS) return null;
  return cue;
}

function playerCue(previous: PlayerState, next: PlayerState): PlayerCueKind | null {
  if (previous.alive && !next.alive) return 'death';
  if (!next.alive) return null;
  // A spent survival passive (or a campaign regroup) grants a grace window:
  // the fighter took a hit and stayed up.
  if ((next.survivalGraceMs ?? 0) > 0 && !((previous.survivalGraceMs ?? 0) > 0)) return 'hit';
  // Only an ultimate resets the cooldown upward.
  if (next.ultimateCooldownRemaining > previous.ultimateCooldownRemaining) return 'ultimate';
  if (next.activeBombs > previous.activeBombs) return 'plant';
  return null;
}

/**
 * The power a mover just took: the item that was on the cell it now stands
 * on and is gone after the step. Read off the map because a pickup by
 * walking changes the map and the player, but not `pickupMessages`.
 */
function pickedUpPower(
  before: GameEngineState,
  after: GameEngineState,
  moverId: string
): Power | null {
  if (before.map === after.map) return null;
  const mover = after.players.find((player) => player.id === moverId);
  if (!mover || !mover.alive) return null;
  const x = Math.round(mover.x);
  const y = Math.round(mover.y);
  const was = before.map[y]?.[x];
  const now = after.map[y]?.[x];
  return was !== undefined && isPower(was) && now !== was ? was as Power : null;
}

/**
 * Records the cues one reducer step produced. Reads both states, writes only
 * the store. Players keep their slot order, so they are matched by index.
 * `moverId` names the player of a MOVE step, the only step that picks up.
 */
export function recordStepCues(
  store: CueStore,
  before: GameEngineState,
  after: GameEngineState,
  startMs: number,
  moverId?: string
): void {
  if (before === after) return;
  if (before.players !== after.players) {
    for (let index = 0; index < after.players.length; index += 1) {
      const next = after.players[index];
      const previous = before.players[index];
      if (previous && previous.id === next.id) {
        // A fighter back on its feet (a campaign regroup) drops its fall.
        if (!previous.alive && next.alive) store.body.delete(next.id);
        const kind = playerCue(previous, next);
        if (kind) recordBodyCue(store, next.id, kind, startMs);
      }
    }
  }
  if (moverId) {
    const power = pickedUpPower(before, after, moverId);
    if (power) recordPickupCue(store, moverId, power, startMs);
  }
}

/**
 * Advances the presentation clock by one display frame. A live round advances
 * it from the engine loop together with the simulation; this covers the
 * frames after a round or match ends, and leaves a player's pause frozen.
 */
export function advanceIdleCueClock(
  store: CueStore,
  state: GameEngineState | null,
  deltaMs: number
): void {
  if (!state || state.phase === 'playing') return;
  store.clockMs += deltaMs;
}
