import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { GameConfig, GameEngineState } from './types';
import { parseMapRows } from './mapLoader';

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

const config: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: openArena,
  selectedCharacters: ['sasuke', 'naruto'],
};

function liveRound(
  overrides: Partial<GameConfig> = {},
  positions: { x: number; y: number }[] = []
): GameEngineState {
  const state = createInitialState({ ...config, ...overrides });
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: state.players.map((player, index) => ({ ...player, ...positions[index] })),
  };
}

function move(state: GameEngineState, playerId: string, direction: 'up' | 'down' | 'left' | 'right', steps: number) {
  let next = state;
  for (let step = 0; step < steps; step += 1) {
    next = gameReducer(next, { type: 'MOVE', playerId, direction })!;
  }
  return next;
}

describe('two players sharing the arena', () => {
  it('lets overlapping players step apart but not push into each other', () => {
    const state = liveRound({}, [{ x: 5, y: 4 }, { x: 5.3, y: 4 }]);

    expect(move(state, 'player2', 'right', 3).players[1].x).toBeCloseTo(5.6);
    expect(move(state, 'player2', 'left', 1).players[1].x).toBe(5.3);

    const apart = liveRound({}, [{ x: 5, y: 4 }, { x: 6, y: 4 }]);
    expect(move(apart, 'player2', 'left', 6).players[1].x).toBeGreaterThan(5.5);
  });

  it('lets a player walk out of a cell another player just bombed', () => {
    let state = liveRound({}, [{ x: 5, y: 4 }, { x: 5.6, y: 4 }]);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);

    const escaped = move(state, 'player2', 'right', 5);
    expect(escaped.players[1].x).toBeCloseTo(6.1);
    // ...but cannot walk back into it.
    expect(move(escaped, 'player2', 'left', 5).players[1].x).toBeGreaterThan(5.7);
  });

  it('keeps Minato\'s teleport from landing on the other player', () => {
    const state = liveRound(
      { selectedCharacters: ['sasuke', 'minato'] },
      [{ x: 7, y: 4 }, { x: 4, y: 4 }]
    );

    const next = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player2' })!;

    expect(next.players[1]).toMatchObject({ x: 1, y: 4 });
    expect(next.players[0]).toMatchObject({ x: 7, y: 4 });
  });

  it('always lets players close the gap even when they start too far apart', () => {
    const state = liveRound(
      {
        map: parseMapRows(Array.from({ length: 12 }, (_, y) => (
          y === 0 || y === 11 ? 'W'.repeat(20) : `W${' '.repeat(18)}W`
        )).map((row) => row.split('')))
      },
      [{ x: 1, y: 1 }, { x: 17, y: 4 }]
    );

    expect(move(state, 'player2', 'left', 5).players[1].x).toBeCloseTo(16.5);
    expect(move(state, 'player2', 'right', 5).players[1].x).toBe(17);
  });
});
