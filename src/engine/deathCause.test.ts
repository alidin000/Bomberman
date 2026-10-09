import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { VERSUS_ROUND_MS } from './suddenDeath';
import { GameConfig, GameEngineState, PlayerState } from './types';

// The structured cause rides next to the old sentence; it must name the
// bomb's owner by player id (two players can be the same shinobi) without
// changing what the sentence says or who wins.
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
  selectedCharacters: ['naruto', 'naruto'],
};

function liveRound(): GameEngineState {
  return { ...createInitialState(config), roundStartTicksRemaining: 0, monsters: [] };
}

function place(
  state: GameEngineState,
  playerId: string,
  patch: Partial<PlayerState>
): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => (
      player.id === playerId ? { ...player, ...patch } : player
    )),
  };
}

function tickUntil(state: GameEngineState, done: (s: GameEngineState) => boolean): GameEngineState {
  let next = state;
  for (let i = 0; i < 400 && !done(next); i += 1) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

describe('structured death cause', () => {
  it('credits a mirror-match blast to the player who dropped the bomb', () => {
    let state = place(place(liveRound(), 'player1', { x: 3, y: 3 }), 'player2', { x: 4, y: 3 });
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player2' })!;
    state = place(state, 'player2', { x: 4, y: 7 });
    state = tickUntil(state, (s) => !s.players[0].alive);

    const victim = state.players[0];
    expect(victim.alive).toBe(false);
    expect(victim.deathCause).toMatchObject({ kind: 'blast', byPlayerId: 'player2' });
    expect(victim.deathCause?.bombKind).toBeDefined();
    // The sentence the result screen used before is unchanged.
    expect(victim.deathReason).toMatch(/^Naruto was caught in Naruto's .+ blast\.$/);
    expect(state.players[1].alive).toBe(true);
    expect(state.roundWinners).toEqual(['player2']);
  });

  it('marks a sudden-death crush as such', () => {
    let state = place(liveRound(), 'player1', { x: 1, y: 1 });
    state = place(state, 'player2', { x: 7, y: 4 });
    state = { ...state, roundElapsedMs: VERSUS_ROUND_MS - 50 };
    state = tickUntil(state, (s) => !s.players[0].alive);

    expect(state.players[0].deathCause).toEqual({ kind: 'pressure' });
    expect(state.players[0].deathReason).toBe('Naruto was crushed by a pressure block.');
  });
});
