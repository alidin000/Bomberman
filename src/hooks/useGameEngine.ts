/* eslint-disable prefer-destructuring, no-continue */
import {
  useState, useCallback, useEffect, useRef,
} from 'react';
import {
  GameAction,
  GameEngineState,
  GameConfig,
  Direction,
  createMatchSeed,
} from '../engine';
import { KeyBindings } from '../constants/props';
import {
  getInputStateForKey,
  getPlayerBindings,
  hasInput,
  HumanController,
} from '../input/humanController';
import {
  ActiveMovement,
  EngineLoop,
  TURN_BUFFER_MS,
  advanceEngineFrame,
  applyEngineAction,
  createEngineLoop,
} from './engineLoop';

type HeldDirection = {
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

function pruneInactiveMovement(
  activeMovement: Record<string, ActiveMovement>,
  state: GameEngineState | null
): Record<string, ActiveMovement> {
  if (!state || state.paused || state.phase !== 'playing') return {};
  const alivePlayerIds = new Set(
    state.players.filter((player) => player.alive).map((player) => player.id)
  );
  return Object.fromEntries(
    Object.entries(activeMovement).filter(([playerId]) => alivePlayerIds.has(playerId))
  );
}

export function useGameEngine(config: GameConfig | null, keyBindings: KeyBindings) {
  const loopRef = useRef<EngineLoop | null>(null);
  if (!loopRef.current) loopRef.current = createEngineLoop();
  const loop = loopRef.current;
  // The simulation is reduced synchronously in `loop`; React only receives a
  // published snapshot, at most once per frame from the frame loop.
  const [state, setState] = useState<GameEngineState | null>(null);
  const rafRef = useRef<number>();
  const humanControllerRef = useRef(new HumanController());
  // Every direction key each player is holding, oldest first. Releasing one
  // falls back to the newest key still down instead of stopping the player.
  const heldDirectionsRef = useRef<Record<string, HeldDirection[]>>({});
  const releasedDirectionRef = useRef<Record<string, { direction: Direction; atMs: number }>>({});

  const dispatch = useCallback((action: GameAction) => {
    applyEngineAction(loop, action);
    setState(loop.state);
  }, [loop]);

  const clearMovement = useCallback(() => {
    loop.activeMovement = {};
    heldDirectionsRef.current = {};
    releasedDirectionRef.current = {};
  }, [loop]);

  // Buffered turn: what to keep moving in while `direction` is blocked. The
  // newest other key still held, else one released within TURN_BUFFER_MS.
  const getFallback = useCallback((playerId: string, direction: Direction) => {
    const held = heldDirectionsRef.current[playerId] ?? [];
    for (let i = held.length - 1; i >= 0; i -= 1) {
      if (held[i].direction !== direction) {
        return { fallbackDirection: held[i].direction, fallbackUntilMs: undefined };
      }
    }
    const released = releasedDirectionRef.current[playerId];
    if (
      released
      && released.direction !== direction
      && loop.motion.simTimeMs - released.atMs <= TURN_BUFFER_MS
    ) {
      return {
        fallbackDirection: released.direction,
        fallbackUntilMs: released.atMs + TURN_BUFFER_MS,
      };
    }
    return { fallbackDirection: undefined, fallbackUntilMs: undefined };
  }, [loop]);

  useEffect(() => {
    if (config) {
      // Randomness enters at the boundary: the seed travels in the config, so
      // the reducer stays pure and a recorded INIT replays the same drops.
      dispatch({
        type: 'INIT',
        config: config.seed === undefined ? { ...config, seed: createMatchSeed() } : config,
      });
    }
  }, [config, dispatch]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const current = loop.state;
    if (!current || current.paused || current.phase !== 'playing') return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    let handledDirectionalInput = false;

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
          heldDirectionsRef.current[player.id] = [
            ...(heldDirectionsRef.current[player.id] ?? []).filter((held) => held.key !== key),
            { direction, key },
          ];
          const active = loop.activeMovement[player.id];
          if (!active || active.direction !== direction || active.key !== key) {
            const fallback = getFallback(player.id, direction);
            dispatch({
              type: 'MOVE',
              playerId: player.id,
              direction,
              fallbackDirection: fallback.fallbackDirection,
            });
            loop.activeMovement[player.id] = {
              accumulatorMs: 0,
              direction,
              key,
              ...fallback,
            };
          }
          handledDirectionalInput = true;
          continue;
        }
        if (!event.repeat) {
          humanControllerRef.current.getActions(player, input).forEach(dispatch);
        }
        return;
      }
    }

    if (handledDirectionalInput) event.preventDefault();
  }, [keyBindings, dispatch, getFallback, loop]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const current = loop.state;
    if (!current || current.paused || current.phase !== 'playing') {
      clearMovement();
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    for (let i = 0; i < current.players.length; i += 1) {
      const bindings = getPlayerBindings(keyBindings, i);
      if (!bindings) continue;

      const player = current.players[i];
      const direction = getInputDirection(getInputStateForKey(key, bindings));
      if (!direction) continue;

      const held = (heldDirectionsRef.current[player.id] ?? []).filter((item) => item.key !== key);
      heldDirectionsRef.current[player.id] = held;
      releasedDirectionRef.current[player.id] = { direction, atMs: loop.motion.simTimeMs };
      const active = loop.activeMovement[player.id];
      if (!active) continue;

      if (active.key !== key) {
        loop.activeMovement[player.id] = { ...active, ...getFallback(player.id, active.direction) };
        continue;
      }
      const next = held[held.length - 1];
      if (next) {
        loop.activeMovement[player.id] = {
          ...active,
          ...next,
          ...getFallback(player.id, next.direction),
        };
      } else {
        delete loop.activeMovement[player.id];
      }
    }
  }, [keyBindings, clearMovement, getFallback, loop]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    const handleBlur = () => {
      clearMovement();
    };
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [handleKeyDown, handleKeyUp, clearMovement]);

  useEffect(() => {
    loop.activeMovement = pruneInactiveMovement(loop.activeMovement, state);
    if (!state || state.paused || state.phase !== 'playing') {
      heldDirectionsRef.current = {};
      releasedDirectionRef.current = {};
    }
  }, [state, loop]);

  // Advances the simulation to a frame timestamp. Every rAF callback in one
  // frame gets the same timestamp, so this is idempotent per frame: the 3D
  // scene calls it before it renders (R3F addEffect) and the hook's own rAF
  // loop covers tests and a lost WebGL context. Whichever runs first wins, so
  // the scene always draws the state of the frame it is drawing.
  const lastFrameTimeRef = useRef<number | null>(null);
  const advanceFrame = useCallback((now: number) => {
    const last = lastFrameTimeRef.current;
    if (last !== null && now <= last) return;
    lastFrameTimeRef.current = now;
    const before = loop.state;
    if (!advanceEngineFrame(loop, last === null ? 0 : now - last)) {
      heldDirectionsRef.current = {};
      releasedDirectionRef.current = {};
    }
    if (loop.state !== before) setState(loop.state);
  }, [loop]);

  useEffect(() => {
    lastFrameTimeRef.current = performance.now();
    const frame = (now: number) => {
      advanceFrame(now);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [advanceFrame]);

  // Stable identities let memoised overlay UI skip the per-tick re-render.
  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), [dispatch]);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [dispatch]);
  const dismissDialog = useCallback(() => dispatch({ type: 'DISMISS_DIALOG' }), [dispatch]);

  return {
    state,
    motion: loop.motion,
    advanceFrame,
    dispatch,
    pause,
    resume,
    restart,
    dismissDialog,
  };
}
