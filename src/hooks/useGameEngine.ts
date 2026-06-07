/* eslint-disable prefer-destructuring, no-continue */
import {
  useReducer, useCallback, useEffect, useRef,
} from 'react';
import {
  gameReducer,
  GameAction,
  GameEngineState,
  GameConfig,
  TICK_MS,
} from '../engine';
import { KeyBindings } from '../constants/props';
import {
  getInputStateForKey,
  getPlayerBindings,
  hasInput,
  HumanController,
} from '../input/humanController';

const MAX_FRAME_DELTA_MS = 100;
const MAX_TICK_STEPS_PER_FRAME = 4;

export function useGameEngine(config: GameConfig | null, keyBindings: KeyBindings) {
  const [state, dispatch] = useReducer(gameReducer, null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const accumulatorRef = useRef(0);
  const rafRef = useRef<number>();
  const humanControllerRef = useRef(new HumanController());

  useEffect(() => {
    if (config) {
      dispatch({ type: 'INIT', config });
    }
  }, [config]);

  const dispatchAction = useCallback((action: GameAction) => {
    dispatch(action);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const current = stateRef.current;
    if (!current || current.paused || current.phase !== 'playing') return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    for (let i = 0; i < current.players.length; i += 1) {
      const bindings = getPlayerBindings(keyBindings, i);
      if (!bindings) continue;

      const player = current.players[i];
      if (!player.alive) continue;

      const input = getInputStateForKey(key, bindings);
      if (hasInput(input)) {
        event.preventDefault();
        humanControllerRef.current.getActions(player, input).forEach(dispatch);
        return;
      }
    }
  }, [keyBindings]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = Math.min(now - lastTime, MAX_FRAME_DELTA_MS);
      lastTime = now;
      const current = stateRef.current;
      if (current && !current.paused && current.phase === 'playing') {
        accumulatorRef.current += delta;
        let tickSteps = 0;
        while (
          accumulatorRef.current >= TICK_MS
          && tickSteps < MAX_TICK_STEPS_PER_FRAME
        ) {
          dispatch({ type: 'TICK', deltaMs: TICK_MS });
          accumulatorRef.current -= TICK_MS;
          tickSteps += 1;
        }
        if (tickSteps === MAX_TICK_STEPS_PER_FRAME) {
          accumulatorRef.current = 0;
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return {
    state: state as GameEngineState | null,
    dispatch: dispatchAction,
    pause: () => dispatch({ type: 'PAUSE' }),
    resume: () => dispatch({ type: 'RESUME' }),
    restart: () => dispatch({ type: 'RESTART' }),
    dismissDialog: () => dispatch({ type: 'DISMISS_DIALOG' }),
  };
}
