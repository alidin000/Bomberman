/* eslint-disable prefer-destructuring, no-continue */
import {
  useReducer, useCallback, useEffect, useRef,
} from 'react';
import {
  gameReducer,
  GameAction,
  GameEngineState,
  GameConfig,
  Direction,
  PlayerState,
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
const MOVE_REPEAT_MS = 28;
const FAST_MOVE_REPEAT_MS = 18;

type ActiveMovement = {
  accumulatorMs: number;
  direction: Direction;
  key: string;
};

function getInputDirection(input: ReturnType<typeof getInputStateForKey>): Direction | null {
  if (input.up) return 'up';
  if (input.down) return 'down';
  if (input.left) return 'left';
  if (input.right) return 'right';
  return null;
}

function getMoveRepeatMs(player: PlayerState): number {
  return player.characterId === 'minato' || player.powerUps.includes('RollerSkate')
    ? FAST_MOVE_REPEAT_MS
    : MOVE_REPEAT_MS;
}

export function useGameEngine(config: GameConfig | null, keyBindings: KeyBindings) {
  const [state, dispatch] = useReducer(gameReducer, null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const accumulatorRef = useRef(0);
  const rafRef = useRef<number>();
  const humanControllerRef = useRef(new HumanController());
  const activeMovementRef = useRef<Record<string, ActiveMovement>>({});

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
        const direction = getInputDirection(input);
        if (direction) {
          const active = activeMovementRef.current[player.id];
          if (!active || active.direction !== direction || active.key !== key) {
            dispatch({ type: 'MOVE', playerId: player.id, direction });
            activeMovementRef.current[player.id] = {
              accumulatorMs: 0,
              direction,
              key,
            };
            return;
          }
          return;
        }
        if (!event.repeat) {
          humanControllerRef.current.getActions(player, input).forEach(dispatch);
        }
        return;
      }
    }
  }, [keyBindings]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const current = stateRef.current;
    if (!current) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    for (let i = 0; i < current.players.length; i += 1) {
      const bindings = getPlayerBindings(keyBindings, i);
      if (!bindings) continue;

      const player = current.players[i];
      const input = getInputStateForKey(key, bindings);
      const direction = getInputDirection(input);
      const active = activeMovementRef.current[player.id];

      if (direction && active?.key === key) {
        delete activeMovementRef.current[player.id];
        return;
      }
    }
  }, [keyBindings]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

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

        Object.entries(activeMovementRef.current).forEach(([playerId, active]) => {
          const player = current.players.find((item) => item.id === playerId);
          if (!player || !player.alive) {
            delete activeMovementRef.current[playerId];
            return;
          }

          const repeatMs = getMoveRepeatMs(player);
          let accumulatorMs = active.accumulatorMs + delta;
          const moveSteps = Math.min(5, Math.floor(accumulatorMs / repeatMs));
          for (let step = 0; step < moveSteps; step += 1) {
            dispatch({ type: 'MOVE', playerId, direction: active.direction });
          }
          accumulatorMs -= moveSteps * repeatMs;
          activeMovementRef.current[playerId] = {
            ...active,
            accumulatorMs,
          };
        });
      } else {
        activeMovementRef.current = {};
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
