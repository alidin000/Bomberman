import { gameReducer } from './reducer';
import { applyPowerUp } from './players';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { GHOST_POWER_MS, TICK_MS } from './constants';
import { GameConfig, GameEngineState } from './types';

const openMap = parseMapRows([
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
  selectedMap: 'test',
  map: openMap,
  selectedCharacters: ['sasuke', 'naruto'],
};

// Player 1 at (1, 1) with `power` lying two cells to the east.
function roundWithPowerAhead(power: Parameters<typeof applyPowerUp>[2]): GameEngineState {
  const state = createInitialState(config);
  const map = state.map.map((row) => [...row]);
  map[1][3] = power;
  return {
    ...state,
    map,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: state.players.map((p, i) => (i === 0 ? { ...p, x: 1, y: 1 } : p)),
  };
}

function walkEast(state: GameEngineState, steps: number): GameEngineState {
  let next = state;
  for (let i = 0; i < steps; i += 1) {
    next = gameReducer(next, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
  }
  return next;
}

function waitMs(state: GameEngineState, ms: number): GameEngineState {
  let next = state;
  for (let t = 0; t < ms; t += TICK_MS) {
    next = gameReducer(next, { type: 'TICK', deltaMs: TICK_MS })!;
  }
  return next;
}

describe('walking onto a power-up', () => {
  it('starts a timed Ghost that wears off, and announces the pickup', () => {
    const picked = walkEast(roundWithPowerAhead('Ghost'), 20);
    expect(picked.map[1][3]).toBe('Empty');
    expect(picked.players[0].powerUps).toContain('Ghost');
    expect(picked.timedPowerUps.player1).toEqual([
      expect.objectContaining({ power: 'Ghost', ticksRemaining: GHOST_POWER_MS }),
    ]);
    expect(picked.pickupMessages).toEqual([
      expect.objectContaining({ playerId: 'player1' }),
    ]);

    const later = waitMs(picked, GHOST_POWER_MS + TICK_MS);
    expect(later.players[0].alive).toBe(true);
    expect(later.players[0].powerUps).not.toContain('Ghost');
  });

  it('announces a permanent pickup too', () => {
    const picked = walkEast(roundWithPowerAhead('AddBomb'), 20);
    expect(picked.players[0].maxBombs).toBeGreaterThan(roundWithPowerAhead('AddBomb').players[0].maxBombs);
    expect(picked.pickupMessages).toEqual([
      expect.objectContaining({ playerId: 'player1' }),
    ]);
  });
});
