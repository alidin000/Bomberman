// Test-only: an engine store for screen tests that swap the engine state by
// hand. Views read `read()` whenever they render, and after each render of
// the screen the store publishes it like the engine would, so subscribers
// that did not re-render (the feedback, memoised leaves) see it too.
import { useLayoutEffect } from 'react';
import { GameEngineState } from '../engine';
import type { EngineStore } from './engineStore';

export function testEngineStore(read: () => GameEngineState | null) {
  const listeners = new Set<() => void>();
  let published: GameEngineState | null | undefined;
  const store: EngineStore = {
    getState: read,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
  /** Call from the mocked engine hook. */
  const usePublish = () => {
    useLayoutEffect(() => {
      const state = read();
      if (state === published) return;
      published = state;
      listeners.forEach((listener) => listener());
    });
  };
  return { store, usePublish };
}
