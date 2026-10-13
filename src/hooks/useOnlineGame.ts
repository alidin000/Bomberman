import {
  useCallback, useEffect, useRef, useSyncExternalStore,
} from 'react';
import { DEFAULT_KEY_BINDINGS } from '../constants/props';
import { Direction, TICK_MS } from '../engine';
import { createEngineStore, EngineStore, PublishingEngineStore } from './engineStore';
import {
  clearMotion, createMotionStore, MotionStore, recordTickMotion,
} from './motionStore';
import { clearCues, recordStepCues } from './cueStore';
import { getInputStateForKey } from '../input/humanController';
import {
  getOnlineSession, OnlineSession, OnlineSessionSnapshot,
} from '../network/onlineSession';
import { onlineGlideDuration } from '../network/onlineInterpolation';

const MAX_FRAME_DELTA_MS = 100;

function inputDirection(key: string): Direction | null {
  const input = getInputStateForKey(key, DEFAULT_KEY_BINDINGS['1']);
  if (input.up) return 'up';
  if (input.down) return 'down';
  if (input.left) return 'left';
  if (input.right) return 'right';
  return null;
}

export function useOnlineSessionSnapshot(session: OnlineSession = getOnlineSession()) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}

type OnlineStatusSnapshot = Pick<
OnlineSessionSnapshot,
'connected' | 'roomId' | 'seat' | 'error'
>;

function sameOnlineStatus(
  previous: OnlineStatusSnapshot | null,
  next: OnlineSessionSnapshot
): boolean {
  return !!previous
    && previous.connected === next.connected
    && previous.roomId === next.roomId
    && previous.seat === next.seat
    && previous.error === next.error;
}

/** Socket metadata without subscribing the screen shell to 20 Hz game snapshots. */
export function useOnlineStatusSnapshot(
  session: OnlineSession = getOnlineSession()
): OnlineStatusSnapshot {
  const cachedRef = useRef<OnlineStatusSnapshot | null>(null);
  const getSnapshot = useCallback(() => {
    const next = session.getSnapshot();
    if (!sameOnlineStatus(cachedRef.current, next)) {
      cachedRef.current = {
        connected: next.connected,
        roomId: next.roomId,
        seat: next.seat,
        error: next.error,
      };
    }
    return cachedRef.current!;
  }, [session]);
  return useSyncExternalStore(session.subscribe, getSnapshot, getSnapshot);
}

/**
 * `squareBomb` sees the bomb key first: it returns true when the press was
 * taken by the village square (a prop opened, or no bombs in the square),
 * so the room never hears it.
 */
export function useOnlineInput(
  session: OnlineSession,
  enabled: boolean,
  squareBomb?: () => boolean
): void {
  const heldRef = useRef<{ key: string; direction: Direction }[]>([]);
  const squareBombRef = useRef(squareBomb);
  squareBombRef.current = squareBomb;

  useEffect(() => {
    if (!enabled) return undefined;
    const down = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const direction = inputDirection(key);
      if (direction) {
        event.preventDefault();
        if (event.repeat || heldRef.current.some((held) => held.key === key)) return;
        heldRef.current = [...heldRef.current, { key, direction }];
        const fallback = heldRef.current.length > 1
          ? heldRef.current[heldRef.current.length - 2].direction
          : null;
        session.input(direction, undefined, fallback);
        return;
      }
      if (event.repeat) return;
      const input = getInputStateForKey(key, DEFAULT_KEY_BINDINGS['1']);
      if (input.bomb) {
        if (!squareBombRef.current?.()) session.input(undefined, 'bomb');
      } else if (input.detonate) session.input(undefined, 'detonate');
      else if (input.special) session.input(undefined, 'ultimate');
      else if (input.cover) session.input(undefined, 'cover');
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const before = heldRef.current;
      const next = before.filter((held) => held.key !== key);
      if (next.length === before.length) return;
      heldRef.current = next;
      const active = next[next.length - 1];
      const fallback = next[next.length - 2];
      session.input(active?.direction ?? null, undefined, fallback?.direction ?? null);
    };
    const blur = () => {
      heldRef.current = [];
      session.input(null);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      heldRef.current = [];
      session.input(null);
    };
  }, [enabled, session]);
}

export type OnlineEngine = {
  store: EngineStore;
  motion: MotionStore;
  getState: () => ReturnType<OnlineSession['getSnapshot']>['gameState'];
  advanceFrame: (now: number) => void;
};

export function useOnlineEngine(session: OnlineSession = getOnlineSession()): OnlineEngine {
  const storeRef = useRef<PublishingEngineStore>();
  if (!storeRef.current) storeRef.current = createEngineStore();
  const motionRef = useRef<MotionStore>();
  if (!motionRef.current) motionRef.current = createMotionStore();
  const stateRef = useRef<OnlineSessionSnapshot['gameState']>(null);
  const lastFrameRef = useRef<number | null>(null);
  const lastSnapshotAtRef = useRef<number | null>(null);

  useEffect(() => {
    const publishSessionState = () => {
      const before = stateRef.current;
      const after = session.getSnapshot().gameState;
      if (before === after) return;
      const motion = motionRef.current!;
      const receivedAt = performance.now();
      if (!after) {
        stateRef.current = null;
        lastSnapshotAtRef.current = null;
        clearMotion(motion);
        if (motion.cues) clearCues(motion.cues);
        storeRef.current!.publish(null);
        return;
      }
      if (!before || after.tick < before.tick) {
        clearMotion(motion);
        if (motion.cues) clearCues(motion.cues);
      } else {
        const observedInterval = lastSnapshotAtRef.current === null
          ? TICK_MS
          : receivedAt - lastSnapshotAtRef.current;
        recordTickMotion(
          motion,
          before,
          after,
          motion.simTimeMs,
          onlineGlideDuration(before.tick, after.tick, observedInterval)
        );
        if (motion.cues) recordStepCues(motion.cues, before, after, motion.cues.clockMs);
      }
      lastSnapshotAtRef.current = receivedAt;
      stateRef.current = after;
      storeRef.current!.publish(after);
    };
    publishSessionState();
    return session.subscribe(publishSessionState);
  }, [session]);

  const advanceFrame = useCallback((now: number) => {
    const previous = lastFrameRef.current;
    lastFrameRef.current = now;
    if (previous === null) return;
    const delta = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, now - previous));
    const state = stateRef.current;
    if (!state?.paused) {
      motionRef.current!.simTimeMs += delta;
      if (motionRef.current!.cues) motionRef.current!.cues!.clockMs += delta;
    }
  }, []);

  const getState = useCallback(() => stateRef.current, []);
  return {
    store: storeRef.current as EngineStore,
    motion: motionRef.current,
    getState,
    advanceFrame,
  };
}
