import { useRef } from 'react';
import { GameEngineState, PlayerState } from '../engine';

// Fields a MOVE step changes that the scene draws from the motion store.
const PLAYER_MOTION_KEYS: ReadonlySet<string> = new Set(['x', 'y', 'facing']);

function playerDiffersOnlyInMotion(previous: PlayerState, next: PlayerState): boolean {
  if (previous === next) return true;
  const keys = Object.keys(next) as (keyof PlayerState)[];
  return keys.length === Object.keys(previous).length
    && keys.every((key) => PLAYER_MOTION_KEYS.has(key) || previous[key] === next[key]);
}

/**
 * True when `next` differs from `previous` only in player x/y/facing: a held
 * movement step between engine ticks. Everything else must be the same
 * reference, so any real change (pickup, fog reveal, bomb, tick) is false.
 */
export function differsOnlyInPlayerMotion(
  previous: GameEngineState | null,
  next: GameEngineState | null
): boolean {
  if (!previous || !next || previous === next) return false;
  const keys = Object.keys(next) as (keyof GameEngineState)[];
  if (keys.length !== Object.keys(previous).length) return false;
  if (!keys.every((key) => key === 'players' || previous[key] === next[key])) return false;
  return previous.players.length === next.players.length
    && next.players.every((player, index) => (
      playerDiffersOnlyInMotion(previous.players[index], player)
    ));
}

/**
 * The engine publishes every frame that changed anything, which while players
 * hold a direction is every frame. The 3D scene samples player positions from
 * the motion store each frame, so the HUD and scene only need a new state when
 * something else changed. This returns the last state worth rendering: the
 * same object across movement-only frames, so memoised children skip them.
 * Player x/y in it can trail the simulation by at most one tick (50 ms).
 */
export function useRenderState(state: GameEngineState | null): GameEngineState | null {
  const renderedRef = useRef(state);
  if (state !== renderedRef.current && !differsOnlyInPlayerMotion(renderedRef.current, state)) {
    renderedRef.current = state;
  }
  return renderedRef.current;
}
