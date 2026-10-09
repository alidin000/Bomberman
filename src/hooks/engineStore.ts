import { useCallback, useRef, useSyncExternalStore } from 'react';
import { GameEngineState } from '../engine';

/**
 * The engine's published state, kept outside React. The engine publishes up
 * to once per frame; each view subscribes to the slice it draws (see
 * useEngineSelector), so a tick that changes only clocks re-renders nothing
 * but what prints them.
 */
export type EngineStore = {
  getState: () => GameEngineState | null;
  subscribe: (listener: () => void) => () => void;
};

export type PublishingEngineStore = EngineStore & {
  /** Makes `state` the published state and tells subscribers, if it is new. */
  publish: (state: GameEngineState | null) => void;
};

export function createEngineStore(): PublishingEngineStore {
  let published: GameEngineState | null = null;
  const listeners = new Set<() => void>();
  return {
    getState: () => published,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish: (state) => {
      if (state === published) return;
      published = state;
      listeners.forEach((listener) => listener());
    },
  };
}

/**
 * What one view takes from a published state. It gets its own previous
 * result and returns that same object when nothing it draws changed, so the
 * view is not even re-rendered. Runs once per published state.
 */
export type EngineSelector<T> = (state: GameEngineState | null, previous: T | undefined) => T;

/**
 * Subscribes a component to one slice of the engine state. Selectors that
 * keep memory between states (structural sharing, the GO beat) must be
 * stable for the component's life: create them once per component.
 */
export function useEngineSelector<T>(store: EngineStore, select: EngineSelector<T>): T {
  const cache = useRef<{ input: GameEngineState | null; select: EngineSelector<T>; output: T }>();
  const getSnapshot = useCallback(() => {
    const input = store.getState();
    const cached = cache.current;
    if (cached && cached.input === input && cached.select === select) return cached.output;
    const output = select(input, cached?.output);
    if (cached) {
      cached.input = input;
      cached.select = select;
      cached.output = output;
    } else {
      cache.current = { input, select, output };
    }
    return output;
  }, [select, store]);
  return useSyncExternalStore(store.subscribe, getSnapshot);
}
