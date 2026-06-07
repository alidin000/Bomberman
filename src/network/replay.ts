import { gameReducer } from '../engine/reducer';
import { GameAction } from '../engine/actions';
import { GameEngineState } from '../engine/types';

export interface ReplayFrame {
  tick: number;
  action: GameAction;
}

export interface ReplayRecording {
  version: 1;
  initialState: GameEngineState | null;
  frames: ReplayFrame[];
}

export function recordReplay(
  initialState: GameEngineState | null,
  frames: ReplayFrame[]
): ReplayRecording {
  return { version: 1, initialState, frames };
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

export function importReplay(raw: string): ReplayRecording {
  return JSON.parse(raw) as ReplayRecording;
}
