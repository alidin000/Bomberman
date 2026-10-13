/* eslint-disable no-param-reassign -- the clock is a per-scene mutable cache read in useFrame */
import { GameEngineState } from '../../../engine/types';
import { BlastStop, bombDetonationTimes } from './bombFuse';
import { squareBlastStop } from './VillageSquareModels';

/**
 * The parts of an engine state a bomb's fuse depends on. The config says
 * whether the match has a village square, whose edge stops every blast.
 */
export type BombClockSource = Pick<GameEngineState, 'bombs' | 'map' | 'players'>
  & Partial<Pick<GameEngineState, 'config'>>;

/**
 * The bombs on the field and when each really goes off (chains included).
 * The scene keeps one per mount and refreshes it from the live engine state
 * before every frame, so fuses, blast previews and their "about to blow"
 * tier keep up with every tick while the React scene skips fuse-only ticks.
 */
export type BombClockState = BombClockSource & {
  detonationMs: Map<string, number>;
  /** The village square's blast stop (blast previews leave it out), if any. */
  stop: BlastStop | undefined;
};

const NO_DETONATIONS: Map<string, number> = new Map();

export function createBombClock(): BombClockState {
  return {
    bombs: [], map: [], players: [], detonationMs: NO_DETONATIONS, stop: undefined,
  };
}

/**
 * Points the clock at `source`. Detonation times are recomputed only when
 * its bombs, map or players changed (once per tick while bombs are out).
 * Returns whether anything changed.
 */
export function refreshBombClock(
  clock: BombClockState,
  source: BombClockSource | null
): boolean {
  if (!source) return false;
  if (
    clock.bombs === source.bombs
    && clock.map === source.map
    && clock.players === source.players
    && clock.config === source.config
  ) return false;
  clock.bombs = source.bombs;
  clock.map = source.map;
  clock.players = source.players;
  clock.config = source.config;
  clock.stop = source.config ? squareBlastStop(source.config) : undefined;
  clock.detonationMs = source.bombs.length === 0
    ? NO_DETONATIONS
    : bombDetonationTimes(source.bombs, source.map, source.players, clock.stop);
  return true;
}
