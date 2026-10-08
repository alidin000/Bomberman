import { gameReducer } from '../engine/reducer';
import { GameAction } from '../engine/actions';
import { GameEngineState } from '../engine/types';

// Bumped whenever simulation rules change, since an older recording would
// replay differently. v2: seeded drops, countdown freeze, lingering flames.
export const REPLAY_VERSION = 2;

export interface ReplayFrame {
  tick: number;
  action: GameAction;
}

export interface ReplayRecording {
  version: typeof REPLAY_VERSION;
  initialState: GameEngineState | null;
  frames: ReplayFrame[];
}

export function recordReplay(
  initialState: GameEngineState | null,
  frames: ReplayFrame[]
): ReplayRecording {
  return { version: REPLAY_VERSION, initialState, frames };
}

export function replayActions(
  initialAction: GameAction,
  frames: ReplayFrame[]
): GameEngineState | null {
  let state = gameReducer(null, initialAction);
  frames.forEach((frame) => {
    state = gameReducer(state, frame.action);
  });
  return state;
}

export function exportReplay(recording: ReplayRecording): string {
  return JSON.stringify(recording);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDirection(value: unknown): boolean {
  return value === 'up' || value === 'down' || value === 'left' || value === 'right';
}

function hasPlayerId(action: Record<string, unknown>): boolean {
  return typeof action.playerId === 'string' && action.playerId.length > 0;
}

function isGameAction(value: unknown): value is GameAction {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'INIT':
      return isRecord(value.config)
        && typeof value.config.numPlayers === 'number'
        && typeof value.config.totalRounds === 'number'
        && typeof value.config.selectedMap === 'string'
        && Array.isArray(value.config.map);
    case 'MOVE':
      return hasPlayerId(value) && isDirection(value.direction)
        && (value.fallbackDirection === undefined || isDirection(value.fallbackDirection));
    case 'DROP_BOMB':
    case 'DETONATE_BOMBS':
    case 'USE_ULTIMATE':
    case 'PLACE_OBSTACLE':
      return hasPlayerId(value);
    case 'TICK':
      return typeof value.deltaMs === 'number' && Number.isFinite(value.deltaMs);
    case 'PAUSE':
    case 'RESUME':
    case 'DISMISS_DIALOG':
    case 'RESTART':
      return true;
    default:
      return false;
  }
}

function isReplayFrame(value: unknown): value is ReplayFrame {
  return isRecord(value)
    && typeof value.tick === 'number'
    && Number.isFinite(value.tick)
    && value.tick >= 0
    && isGameAction(value.action);
}

function isReplayRecording(value: unknown): value is ReplayRecording {
  return isRecord(value)
    && value.version === REPLAY_VERSION
    && (value.initialState === null || isRecord(value.initialState))
    && Array.isArray(value.frames)
    && value.frames.every(isReplayFrame);
}

export function importReplay(raw: string): ReplayRecording {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid replay: JSON could not be parsed.');
  }

  if (!isReplayRecording(parsed)) {
    throw new Error('Invalid replay: schema validation failed.');
  }

  return parsed;
}
