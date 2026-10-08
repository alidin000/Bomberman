import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { Direction, GameConfig, GameEngineState } from './types';

// Classic pillar grid: the first opening below row 1 east of the spawn is x=3.
const pillarMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W W W W W W W W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const config: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'test',
  map: pillarMap,
  selectedCharacters: ['sasuke', 'naruto'],
};

function liveRound(x: number): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: state.players.map((p, i) => (i === 0 ? { ...p, x, y: 1 } : p)),
  };
}

function moveTimes(
  state: GameEngineState,
  times: number,
  direction: Direction,
  fallbackDirection?: Direction
): GameEngineState {
  let next = state;
  for (let i = 0; i < times; i += 1) {
    next = gameReducer(next, {
      type: 'MOVE', playerId: 'player1', direction, fallbackDirection,
    })!;
  }
  return next;
}

describe('buffered turns at intersections', () => {
  it('stalls against a pillar when only the new direction is used', () => {
    const end = moveTimes(liveRound(1.8), 20, 'down');
    expect(end.players[0].y).toBeLessThan(1.3);
  });

  it('keeps travelling in the held direction and turns at the next opening', () => {
    const end = moveTimes(liveRound(1.8), 20, 'down', 'right');
    expect(end.players[0].x).toBe(3);
    expect(end.players[0].y).toBeGreaterThan(1.5);
  });

  it('does not wobble into the lane slack while sliding past a pillar', () => {
    let state = liveRound(1.8);
    const ys: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      state = moveTimes(state, 1, 'down', 'right');
      ys.push(state.players[0].y);
    }
    // x passes 2.0..2.5 next to the pillar at (2,2): no step goes down there.
    expect(ys.slice(0, 6).every((y) => y === 1)).toBe(true);
  });

  it('takes the new direction as soon as it is open', () => {
    const end = moveTimes(liveRound(3), 1, 'down', 'right');
    expect(end.players[0]).toMatchObject({ x: 3, y: 1.1, facing: 'down' });
  });
});
