import { act } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { createInitialState } from '../engine/initialState';
import { parseMapRows } from '../engine/mapLoader';
import { GameEngineState } from '../engine/types';
import { OnlineSession, OnlineSessionSnapshot } from '../network/onlineSession';
import { useOnlineEngine, useOnlineStatusSnapshot } from './useOnlineGame';

const openArena = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

function gameState(): GameEngineState {
  return createInitialState({
    mode: 'onlinePreview',
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: 'online-arena',
    stageId: 'hiddenLeaf',
    map: openArena,
    selectedCharacters: ['naruto', 'sasuke'],
    seed: 7,
  });
}

function fakeSession(initialState: GameEngineState) {
  let snapshot: OnlineSessionSnapshot = {
    status: 'playing',
    connected: true,
    roomId: 'ABC234',
    seat: 0,
    playerId: 'player1',
    token: 'token',
    players: [],
    roomMode: 'arena',
    stageId: 'hiddenLeaf',
    capacity: 4,
    totalRounds: 3,
    gameState: initialState,
    ack: 0,
    error: '',
  };
  const listeners = new Set<() => void>();
  return {
    session: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as unknown as OnlineSession,
    publish: (patch: Partial<OnlineSessionSnapshot>) => {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((listener) => listener());
    },
  };
}

describe('online render subscriptions', () => {
  it('publishes game snapshots directly into the engine store', () => {
    const initial = gameState();
    const fake = fakeSession(initial);
    const { result } = renderHook(() => useOnlineEngine(fake.session));
    expect(result.current.store.getState()).toBe(initial);

    const next = {
      ...initial,
      tick: initial.tick + 2,
      players: initial.players.map((player, index) => (
        index === 0 ? { ...player, x: player.x + 0.2 } : player
      )),
    };
    act(() => fake.publish({ gameState: next, ack: 1 }));

    expect(result.current.store.getState()).toBe(next);
    expect(result.current.motion.tracks.get('player:player1')?.durationMs).toBe(100);
  });

  it('does not re-render socket chrome for game-only snapshots', () => {
    const initial = gameState();
    const fake = fakeSession(initial);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useOnlineStatusSnapshot(fake.session);
    });
    const initialRenders = renders;

    act(() => fake.publish({ gameState: { ...initial, tick: initial.tick + 1 }, ack: 1 }));
    expect(renders).toBe(initialRenders);

    act(() => fake.publish({ connected: false, error: 'Reconnecting' }));
    expect(renders).toBeGreaterThan(initialRenders);
    expect(result.current).toMatchObject({ connected: false, error: 'Reconnecting' });
  });
});
