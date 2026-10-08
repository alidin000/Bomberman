import { renderHook } from '@testing-library/react-hooks';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { useGameFeedback } from './useGameFeedback';

describe('useGameFeedback', () => {
  it('combines simultaneous events and re-identifies repeated captions', () => {
    const initial = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, {
        ...DEFAULT_GAME_PREFERENCES,
        soundEnabled: false,
      }),
      { initialProps: { state: initial } }
    );

    const firstBlast = {
      ...initial,
      tick: initial.tick + 1,
      explosions: [{
        x: 2, y: 1, ticksRemaining: 500, kind: 'claySpider' as const,
      }],
      monsters: initial.monsters.slice(1),
      players: initial.players.map((player, index) => (
        index === 0 ? { ...player, alive: false } : player
      )),
    };
    rerender({ state: firstBlast });

    expect(result.current.caption).toContain('Blast detonates');
    expect(result.current.caption).toContain('Enemy defeated');
    expect(result.current.caption).toContain('Shinobi down');
    const firstEventId = result.current.eventId;

    rerender({ state: { ...firstBlast, tick: firstBlast.tick + 1, explosions: [] } });
    rerender({
      state: {
        ...firstBlast,
        tick: firstBlast.tick + 2,
        explosions: [{
          x: 2, y: 1, ticksRemaining: 500, kind: 'claySpider' as const,
        }],
      },
    });

    expect(result.current.caption).toBe('Blast detonates');
    expect(result.current.eventId).toBeGreaterThan(firstEventId);
  });

  it('announces a repeat pickup of the same power even when the message count stays flat', () => {
    const initial = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });
    const message = (id: string) => ({
      id, playerId: 'player1', power: 'AddBomb' as const, ticksRemaining: 3600,
    });
    const first = { ...initial, tick: 1, pickupMessages: [message('1-player1-AddBomb-0')] };
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, {
        ...DEFAULT_GAME_PREFERENCES,
        soundEnabled: false,
      }),
      { initialProps: { state: initial } }
    );

    rerender({ state: first });
    expect(result.current.caption).toBe('Power-up collected');
    const firstEventId = result.current.eventId;

    rerender({ state: { ...first, tick: 30, pickupMessages: [message('30-player1-AddBomb-1')] } });
    expect(result.current.eventId).toBeGreaterThan(firstEventId);
    expect(result.current.caption).toBe('Power-up collected');
  });
});
