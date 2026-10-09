/* eslint-disable prefer-destructuring, no-continue */
import {
  useCallback, useEffect, useMemo, useRef, useSyncExternalStore,
} from 'react';
import {
  GameAction,
  GameEngineState,
  GameConfig,
  Direction,
  createMatchSeed,
  isBossIntroRunning,
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
import { useGamepadInput } from './useGamepadInput';
import { isCpuSlot } from '../ai/controllers';
import { EngineStore, createEngineStore, PublishingEngineStore } from './engineStore';

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
  // Runs after every published frame: keep the object when nothing is pruned.
  const isAlive = (playerId: string) => state.players.some(
    (player) => player.id === playerId && player.alive
  );
  if (Object.keys(activeMovement).every(isAlive)) return activeMovement;
  const alivePlayerIds = new Set(
    state.players.filter((player) => player.alive).map((player) => player.id)
  );
  return Object.fromEntries(
    Object.entries(activeMovement).filter(([playerId]) => alivePlayerIds.has(playerId))
  );
}

/**
 * Runs a match. The simulation is reduced synchronously in the engine loop;
 * views get a published snapshot through `store`, at most once per frame,
 * and subscribe to just what they draw. Nothing here re-renders the caller.
 */
export function useGameEngineStore(config: GameConfig | null, keyBindings: KeyBindings) {
  const loopRef = useRef<EngineLoop | null>(null);
  if (!loopRef.current) loopRef.current = createEngineLoop();
  const loop = loopRef.current;
  const storeRef = useRef<PublishingEngineStore | null>(null);
  if (!storeRef.current) storeRef.current = createEngineStore();
  const store = storeRef.current;
  const rafRef = useRef<number>();
  const humanControllerRef = useRef(new HumanController());
  // Every direction key each player is holding, oldest first. Releasing one
  // falls back to the newest key still down instead of stopping the player.
  const heldDirectionsRef = useRef<Record<string, HeldDirection[]>>({});
  const releasedDirectionRef = useRef<Record<string, { direction: Direction; atMs: number }>>({});

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

  // Runs for every published state: drops movement of players that are
  // gone, and picks up directions still held through a pause or into a new
  // round.
  const syncHeldMovement = useCallback((state: GameEngineState | null) => {
    loop.activeMovement = pruneInactiveMovement(loop.activeMovement, state);
    if (!state || state.paused || state.phase !== 'playing') {
      releasedDirectionRef.current = {};
      return;
    }
    state.players.forEach((player) => {
      const held = heldDirectionsRef.current[player.id] ?? [];
      const newest = held[held.length - 1];
      if (!player.alive || !newest || loop.activeMovement[player.id]) return;
      loop.activeMovement[player.id] = {
        accumulatorMs: 0,
        ...newest,
        ...getFallback(player.id, newest.direction),
      };
    });
  }, [loop, getFallback]);

  const publish = useCallback(() => {
    if (loop.state === store.getState()) return;
    syncHeldMovement(loop.state);
    store.publish(loop.state);
  }, [loop, store, syncHeldMovement]);

  const dispatch = useCallback((action: GameAction) => {
    applyEngineAction(loop, action);
    publish();
  }, [loop, publish]);

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

  // While no round is live, still track which direction keys are down: a key
  // held through a pause or into the next round keeps moving once play
  // resumes, since OS key repeat stops as soon as another key (Escape) is hit.
  const holdWhileIdle = useCallback((current: GameEngineState, key: string) => {
    current.players.forEach((player, index) => {
      if (isCpuSlot(current.config, index)) return;
      const bindings = getPlayerBindings(keyBindings, index);
      const direction = bindings && getInputDirection(getInputStateForKey(key, bindings));
      if (!direction) return;
      heldDirectionsRef.current[player.id] = [
        ...(heldDirectionsRef.current[player.id] ?? []).filter((held) => held.key !== key),
        { direction, key },
      ];
    });
  }, [keyBindings]);

  // Bomb, detonate, ultimate or cover for any human seat (pads press these).
  const isActionKey = useCallback((current: GameEngineState, key: string) => (
    current.players.some((_, index) => {
      if (isCpuSlot(current.config, index)) return false;
      const bindings = getPlayerBindings(keyBindings, index);
      if (!bindings) return false;
      const input = getInputStateForKey(key, bindings);
      return input.bomb || input.detonate || input.special || input.cover;
    })
  ), [keyBindings]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const current = loop.state;
    if (!current) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (current.paused || current.phase !== 'playing') {
      holdWhileIdle(current, key);
      return;
    }
    // The boss's entrance: any action key (A on a pad) starts the fight.
    // Directions are kept, so a held key moves as soon as play is live.
    if (isBossIntroRunning(current)) {
      holdWhileIdle(current, key);
      if (isActionKey(current, key)) {
        event.preventDefault();
        if (!event.repeat) dispatch({ type: 'SKIP_BOSS_INTRO' });
      }
      return;
    }
    let handledDirectionalInput = false;

    for (let i = 0; i < current.players.length; i += 1) {
      // A CPU slot's keys belong to nobody: they never move or act for it.
      const bindings = isCpuSlot(current.config, i) ? undefined : getPlayerBindings(keyBindings, i);
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
  }, [keyBindings, dispatch, getFallback, holdWhileIdle, isActionKey, loop]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const current = loop.state;
    if (!current) {
      clearMovement();
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (current.paused || current.phase !== 'playing') {
      Object.keys(heldDirectionsRef.current).forEach((playerId) => {
        heldDirectionsRef.current[playerId] = heldDirectionsRef.current[playerId]
          .filter((held) => held.key !== key);
      });
      return;
    }

    for (let i = 0; i < current.players.length; i += 1) {
      const bindings = isCpuSlot(current.config, i) ? undefined : getPlayerBindings(keyBindings, i);
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

  // Pads press the same bound keys, so they reuse every handler above. The
  // n-th pad plays the n-th human slot, skipping CPU slots.
  const padBindings = useMemo(() => {
    if (!config?.controllers?.some((_, slot) => isCpuSlot(config, slot))) return keyBindings;
    const humans: KeyBindings = {};
    let pad = 0;
    for (let slot = 0; slot < config.numPlayers; slot += 1) {
      const bindings = getPlayerBindings(keyBindings, slot);
      if (!isCpuSlot(config, slot) && bindings) {
        pad += 1;
        humans[String(pad)] = bindings;
      }
    }
    return humans;
  }, [config, keyBindings]);
  useGamepadInput(padBindings);

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
    if (!advanceEngineFrame(loop, last === null ? 0 : now - last)) {
      releasedDirectionRef.current = {};
    }
    publish();
  }, [loop, publish]);

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

  // The newest simulation state, ahead of what was last published: the 3D
  // scene reads it before every frame for what it draws without re-rendering.
  const getState = useCallback(() => loop.state, [loop]);

  // Stable identities let memoised overlay UI skip the per-tick re-render.
  const pause = useCallback(() => dispatch({ type: 'PAUSE' }), [dispatch]);
  const resume = useCallback(() => dispatch({ type: 'RESUME' }), [dispatch]);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [dispatch]);
  const dismissDialog = useCallback(() => dispatch({ type: 'DISMISS_DIALOG' }), [dispatch]);

  return {
    store: store as EngineStore,
    motion: loop.motion,
    getState,
    advanceFrame,
    dispatch,
    pause,
    resume,
    restart,
    dismissDialog,
  };
}

/**
 * The engine plus its whole published state, re-rendering the caller on
 * every publish. For tests and small tools; the game screen subscribes to
 * slices instead (useGameEngineStore + useEngineSelector).
 */
export function useGameEngine(config: GameConfig | null, keyBindings: KeyBindings) {
  const engine = useGameEngineStore(config, keyBindings);
  const state = useSyncExternalStore(engine.store.subscribe, engine.store.getState);
  return { ...engine, state };
}
