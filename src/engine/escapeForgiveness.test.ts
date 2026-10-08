import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import {
  Direction, GameConfig, GameEngineState, MonsterState,
} from './types';

// 30x12 open arena: wide enough to put two ninjas at the shared-screen limit.
const wideArena = parseMapRows(Array.from({ length: 12 }, (_, y) => (
  y === 0 || y === 11 ? 'W'.repeat(30) : `W${' '.repeat(28)}W`
)).map((row) => row.split('')));

const config: GameConfig = {
  mode: 'local',
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: wideArena,
  // Neither has a survival passive, so a hit is a death.
  selectedCharacters: ['minato', 'sasuke'],
  seed: 1,
};

function liveRound(positions: { x: number; y: number }[]): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: state.players.map((player, index) => ({ ...player, ...positions[index] })),
  };
}

function move(state: GameEngineState, playerId: string, direction: Direction, steps: number) {
  let next = state;
  for (let step = 0; step < steps; step += 1) {
    next = gameReducer(next, { type: 'MOVE', playerId, direction })!;
  }
  return next;
}

function tick(state: GameEngineState, ms: number) {
  let next = state;
  for (let elapsed = 0; elapsed < ms; elapsed += 50) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

const adjacentEnemy: MonsterState = {
  id: 'monster1',
  name: 'Rogue Genin',
  x: 6,
  y: 5,
  kind: 'basic',
  moveCooldown: 60000,
};

describe('the shared screen never pins a ninja in danger', () => {
  it('still stops a safe ninja at the 12-cell limit', () => {
    const state = liveRound([{ x: 5, y: 5 }, { x: 17, y: 5 }]);
    expect(move(state, 'player1', 'left', 5).players[0].x).toBe(5);
  });

  it('lets a ninja run from their own bomb past the limit', () => {
    let state = liveRound([{ x: 5, y: 5 }, { x: 17, y: 5 }]);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);

    const escaped = move(state, 'player1', 'left', 10);
    expect(escaped.players[0].x).toBeCloseTo(4);
  });

  it('lets a ninja back away from an enemy closing in', () => {
    const state = { ...liveRound([{ x: 5, y: 5 }, { x: 17, y: 5 }]), monsters: [adjacentEnemy] };
    // Free to step away until the enemy is no longer within 1.6 cells.
    expect(move(state, 'player1', 'left', 10).players[0].x).toBeCloseTo(4.3);
  });

  it('stops the stretch at one and a half shared screens', () => {
    let state = liveRound([{ x: 9, y: 5 }, { x: 21, y: 5 }]);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    // A range-9 blast keeps them in danger all the way: only the cap stops them.
    state = { ...state, bombs: state.bombs.map((bomb) => ({ ...bomb, range: 9 })) };
    expect(move(state, 'player1', 'left', 80).players[0].x).toBeCloseTo(3);
  });
});

describe('another ninja never blocks an escape', () => {
  it('blocks a safe ninja but lets one fleeing a bomb pass through', () => {
    const safe = liveRound([{ x: 5, y: 5 }, { x: 6, y: 5 }]);
    expect(move(safe, 'player1', 'right', 15).players[0].x).toBeCloseTo(5.4);

    const bombed = gameReducer(safe, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(move(bombed, 'player1', 'right', 15).players[0].x).toBeCloseTo(6.5);
  });
});

describe('blasts burn only a ninja visibly inside the flame', () => {
  // Minato's Flying Thunder Mark at (5,5): range 2, so the flame ends at (7,5).
  function blastWithVictimAt(x: number): GameEngineState {
    let state = liveRound([{ x: 5, y: 5 }, { x, y: 5 }]);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1' ? { ...player, x: 2, y: 2 } : player
      )),
    };
    return tick(state, 1500);
  }

  it('spares a ninja whose body only grazes the flame tile', () => {
    const state = blastWithVictimAt(7.7);
    expect(state.explosions.some((flame) => flame.x === 7 && flame.y === 5)).toBe(true);
    expect(state.players[1].alive).toBe(true);
  });

  it('still burns a ninja standing well into the flame tile', () => {
    expect(blastWithVictimAt(7.6).players[1].alive).toBe(false);
  });

  it('burns a ninja who then steps into the lingering flame', () => {
    const state = blastWithVictimAt(7.7);
    const stepped = tick(move(state, 'player2', 'left', 1), 50);
    expect(stepped.players[1].alive).toBe(false);
    expect(stepped.players[1].deathReason).toContain('lingering flame');
  });
});
