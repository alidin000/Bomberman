import { renderHook } from '@testing-library/react-hooks';
import { createInitialState } from '../../engine/initialState';
import { gameReducer } from '../../engine/reducer';
import { GameEngineState } from '../../engine/types';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { createShinobiEnemy } from '../../engine/campaignEnemies';
import { GameAction } from '../../engine/actions';
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

  it('does not announce a fading water clone as a defeated enemy', () => {
    const base = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });
    const clone = createShinobiEnemy({
      archetype: 'mistNinja', x: 5, y: 5, id: 'mist-clone', clone: true,
    });
    const initial = { ...base, monsters: [...base.monsters, clone] };
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, {
        ...DEFAULT_GAME_PREFERENCES,
        soundEnabled: false,
      }),
      { initialProps: { state: initial } }
    );

    rerender({ state: { ...initial, tick: initial.tick + 1, monsters: base.monsters } });

    expect(result.current.caption).not.toContain('Enemy defeated');
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
    // Deidara's take on +1 bomb, credited to the slot that picked it up.
    expect(result.current.caption).toBe('P1 Clay Pouch');
    const firstEventId = result.current.eventId;

    rerender({ state: { ...first, tick: 30, pickupMessages: [message('30-player1-AddBomb-1')] } });
    expect(result.current.eventId).toBeGreaterThan(firstEventId);
    expect(result.current.caption).toBe('P1 Clay Pouch');
  });

  it('announces the blast that ends the round', () => {
    const start = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
      selectedCharacters: ['sasuke', 'naruto'],
    });
    let state: GameEngineState = { ...start, monsters: [], roundStartTicksRemaining: 0 };
    const { result, rerender } = renderHook(
      ({ current }) => useGameFeedback(current, {
        ...DEFAULT_GAME_PREFERENCES,
        soundEnabled: false,
      }),
      { initialProps: { current: state } }
    );

    // Sasuke's Chidori Mine goes off under him: the blast decides the match.
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    rerender({ current: state });
    for (let elapsed = 0; elapsed < 3000 && state.phase === 'playing'; elapsed += 50) {
      state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
      rerender({ current: state });
    }

    expect(state.phase).toBe('game_over');
    expect(result.current.caption).toMatch(/blasts? detonates?/i);
    expect(result.current.caption).toContain('Shinobi down');
  });

  const blastPreferences = { ...DEFAULT_GAME_PREFERENCES, soundEnabled: false };
  const reduce = (state: GameEngineState, action: GameAction): GameEngineState => {
    const next = gameReducer(state, action);
    if (!next) throw new Error('reducer dropped the state');
    return next;
  };
  const startVersusRound = (shielded: boolean): GameEngineState => {
    const state = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    });
    const live = reduce(state, { type: 'TICK', deltaMs: 3000 });
    return shielded
      ? {
        ...live,
        players: live.players.map((player) => ({ ...player, powerUps: ['Invincibility'] })),
      }
      : live;
  };
  const runUntilBlast = (start: GameEngineState, onStep: (s: GameEngineState) => void) => {
    let state = start;
    for (let i = 0; i < 200 && state.explosions.length === 0; i += 1) {
      state = reduce(state, { type: 'TICK', deltaMs: 50 });
      onStep(state);
    }
    expect(state.explosions.length).toBeGreaterThan(1);
    return state;
  };

  it('counts detonated bombs, not flame cells, in the blast caption', () => {
    let single = startVersusRound(true);
    const singleHook = renderHook(
      ({ current }) => useGameFeedback(current, blastPreferences),
      { initialProps: { current: single } }
    );
    single = reduce(single, { type: 'DROP_BOMB', playerId: 'player1' });
    expect(single.bombs).toHaveLength(1);
    singleHook.rerender({ current: single });
    runUntilBlast(single, (next) => singleHook.rerender({ current: next }));
    expect(singleHook.result.current.caption).toMatch(/^Blast detonates/);

    let pair = startVersusRound(true);
    const pairHook = renderHook(
      ({ current }) => useGameFeedback(current, blastPreferences),
      { initialProps: { current: pair } }
    );
    pair = reduce(pair, { type: 'DROP_BOMB', playerId: 'player1' });
    pair = reduce(pair, { type: 'DROP_BOMB', playerId: 'player2' });
    expect(pair.bombs).toHaveLength(2);
    pairHook.rerender({ current: pair });
    runUntilBlast(pair, (next) => pairHook.rerender({ current: next }));
    expect(pairHook.result.current.caption).toMatch(/^2 blasts detonate/);
  });

  it('still announces the blast that decides the round', () => {
    let state = startVersusRound(false);
    const { result, rerender } = renderHook(
      ({ current }) => useGameFeedback(current, blastPreferences),
      { initialProps: { current: state } }
    );
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player1' });
    rerender({ current: state });
    state = runUntilBlast(state, (next) => rerender({ current: next }));

    expect(state.phase).toBe('game_over');
    expect(result.current.caption).toContain('Blast detonates');
    expect(result.current.caption).toContain('Shinobi down');
  });

  it('says which slot went down', () => {
    const initial = createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      selectedCharacters: ['naruto', 'naruto'],
      map: parseMapRows(defaultMap),
    });
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, blastPreferences),
      { initialProps: { state: initial } }
    );

    rerender({
      state: {
        ...initial,
        tick: initial.tick + 1,
        players: initial.players.map((player, index) => (
          index === 1 ? { ...player, alive: false } : player
        )),
      },
    });

    expect(result.current.caption).toBe('Shinobi down: P2 Naruto');
  });

  it('captions the last 30 and 15 seconds and the start of sudden death', () => {
    const initial = { ...startVersusRound(false), monsters: [] };
    const at = (roundElapsedMs: number, tick: number) => ({ ...initial, roundElapsedMs, tick });
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, blastPreferences),
      { initialProps: { state: at(59950, 1) } }
    );

    rerender({ state: at(60000, 2) });
    expect(result.current.caption).toBe('30 seconds left');

    rerender({ state: at(74950, 3) });
    rerender({ state: at(75000, 4) });
    expect(result.current.caption).toBe('15 seconds left');

    rerender({ state: at(89950, 5) });
    rerender({ state: at(90000, 6) });
    expect(result.current.caption).toBe('Sudden death: walls closing');
  });

  it('has no clock captions in the campaign', () => {
    const solo = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['deidara'],
      map: parseMapRows(defaultMap),
    });
    const { result, rerender } = renderHook(
      ({ state }) => useGameFeedback(state, blastPreferences),
      { initialProps: { state: { ...solo, roundElapsedMs: 59950 } } }
    );

    rerender({ state: { ...solo, tick: solo.tick + 1, roundElapsedMs: 90000 } });
    expect(result.current.caption).toBe('');
  });
});
