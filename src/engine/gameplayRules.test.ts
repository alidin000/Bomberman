import { gameReducer } from './reducer';
import { createBossForConfig, createInitialState as createMatchState } from './initialState';
import {
  BossHazard, GameConfig, GameEngineState, MonsterState
} from './types';
import { parseMapRows } from './mapLoader';
import { createBomb, explodeBombs } from './bombs';
import { createDangerMap } from './monsters';
import {
  PRESSURE_BLOCK_INTERVAL_MS, PRESSURE_FILL_MS, VERSUS_ROUND_MS, getUpcomingPressureCells,
  tickSuddenDeath,
} from './suddenDeath';
import { genericPowerUpOptions } from '../model/gameItem';

const corridorMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W    WWWWWWW  W',
  'W             W',
  'W    WWWWWWW  W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const crateRowMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WBBBBBBBBBBBBBW',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

const versusConfig: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: corridorMap,
  selectedCharacters: ['sasuke', 'naruto'],
};

function liveRound(config: GameConfig, overrides: Partial<GameEngineState> = {}): GameEngineState {
  return {
    ...createMatchState(config),
    roundStartTicksRemaining: 0,
    monsters: [],
    ...overrides,
  };
}

function tickFor(state: GameEngineState, totalMs: number): GameEngineState {
  let next = state;
  for (let elapsed = 0; elapsed < totalMs; elapsed += 50) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

function monster(overrides: Partial<MonsterState>): MonsterState {
  return {
    id: 'm1',
    name: 'Rogue Ninja',
    x: 8,
    y: 4,
    kind: 'smart',
    moveCooldown: 0,
    ...overrides,
  };
}

describe('seeded crate drops', () => {
  function blastCrateRow(seed: number) {
    const state = liveRound({ ...versusConfig, map: crateRowMap, seed });
    const bombs = Array.from({ length: 13 }, (_, index) => (
      createBomb('player1', index + 1, 4, 1, false, 'standard')
    ));
    return explodeBombs(state, bombs).destroyedBoxes.map((box) => box.pendingPowerUp);
  }

  it('drops items from only some crates, the same way for the same seed', () => {
    const drops = blastCrateRow(1234);
    const dropped = drops.filter((power) => power !== null);

    expect(drops).toHaveLength(13);
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.length).toBeLessThan(13);
    dropped.forEach((power) => expect(genericPowerUpOptions).toContain(power));
    expect(blastCrateRow(1234)).toEqual(drops);
    expect(blastCrateRow(98765)).not.toEqual(drops);
  });

  it('rolls a different, still reproducible seed for a rematch', () => {
    const state = liveRound({ ...versusConfig, seed: 77 });
    const first = gameReducer(state, { type: 'RESTART' })!;
    const again = gameReducer(state, { type: 'RESTART' })!;

    expect(first.config.seed).not.toBe(77);
    expect(again.config.seed).toBe(first.config.seed);
    expect(first.rngSeed).toBe(first.config.seed);
  });
});

describe('lingering flames', () => {
  it('catches a player who walks into a flame after the blast', () => {
    let state = liveRound(versusConfig, {
      explosions: [{
        x: 2, y: 1, ticksRemaining: 450, kind: 'standard', ownerId: 'player2', sparedIds: [],
      }],
    });

    for (let step = 0; step < 6; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].deathReason).toBe('Sasuke walked into Naruto\'s lingering flame.');
  });

  it('consumes a monster that lands in a burning cell it was not caught in', () => {
    let state = liveRound(versusConfig, {
      monsters: [monster({
        x: 3, y: 1, kind: 'basic', moveCooldown: 1000
      })],
      explosions: [{
        x: 3, y: 1, ticksRemaining: 450, sparedIds: []
      }],
    });

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.monsters).toEqual([]);
  });
});

describe('boss damage', () => {
  it('hits the boss once per bomb however many blast cells touch it', () => {
    const soloConfig: GameConfig = {
      ...versusConfig,
      mode: 'solo',
      numPlayers: 1,
      selectedCharacters: ['deidara'],
      stageId: 'hiddenSand',
    };
    const boss = createBossForConfig(soloConfig)!;
    const state = liveRound(soloConfig, { boss });

    const next = explodeBombs(state, [
      createBomb('player1', boss.x, boss.y, 3, false, 'standard'),
    ]);

    expect(next.boss!.health).toBe(boss.maxHealth - 80);
  });
});

describe('monster hazards', () => {
  it('hurts players even when no boss is in the arena', () => {
    const hazard: BossHazard = {
      id: 'spikes',
      kind: 'sandSpikes',
      x: 1,
      y: 1,
      ticksRemaining: 300,
      warningTicks: 850,
      color: '#f59e0b',
      damage: 1,
      sourceName: 'Sand Ninja',
    };
    let state = liveRound(versusConfig, { boss: null, hazards: [hazard] });

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(false);
  });
});

describe('danger-aware monster AI', () => {
  it('runs a cornered smart monster out of the blast line before the bomb goes off', () => {
    const bomb = createBomb('player1', 6, 4, 3, false, 'standard', 1300);
    let state = liveRound(versusConfig, {
      bombs: [bomb],
      monsters: [monster({ x: 8, y: 4, kind: 'smart' })],
    });
    state.map[4][6] = { range: 3, coords: { x: 6, y: 4 }, ownerId: 'player1' };

    state = tickFor(state, 1400);

    expect(state.bombs).toEqual([]);
    expect(state.monsters).toHaveLength(1);
    expect(state.monsters[0].x).toBeGreaterThanOrEqual(10);
  });

  it('keeps a basic monster from stepping into live flames', () => {
    let state = liveRound(versusConfig, {
      monsters: [monster({ x: 8, y: 4, kind: 'basic' })],
      explosions: [
        {
          x: 7, y: 4, ticksRemaining: 450, sparedIds: []
        },
        {
          x: 9, y: 4, ticksRemaining: 450, sparedIds: []
        },
      ],
    });

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.monsters[0]).toMatchObject({ x: 8, y: 4 });
  });

  it('treats a chained bomb as going off with the bomb that triggers it', () => {
    const state = liveRound(versusConfig, {
      bombs: [
        createBomb('player1', 2, 1, 2, false, 'standard', 300),
        createBomb('player2', 4, 1, 2, false, 'standard', 2900),
      ],
    });

    const danger = createDangerMap(state);

    expect(danger.get('4,2')).toBe(300);
    expect(danger.get('6,1')).toBe(300);
    expect(danger.get('1,1')).toBe(300);
  });
});

describe('versus sudden death', () => {
  it('drops pressure blocks in a spiral once the clock runs out, crushing what is under them', () => {
    const bomb = createBomb('player1', 2, 1, 2, false, 'standard', 2900);
    let state = liveRound(versusConfig, {
      roundElapsedMs: VERSUS_ROUND_MS - 50,
      bombs: [bomb],
    });
    state = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0 ? { ...player, activeBombs: 1 } : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.map[1][1]).toBe('Wall');
    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].deathReason).toBe('Sasuke was crushed by a pressure block.');
    expect(getUpcomingPressureCells(state, 2)).toEqual([{ x: 2, y: 1 }, { x: 3, y: 1 }]);

    state = { ...state, players: state.players.map((player) => ({ ...player, alive: true })) };
    state = {
      ...state, phase: 'playing', paused: false, roundProcessed: false
    };
    state = tickFor(state, PRESSURE_BLOCK_INTERVAL_MS);

    expect(state.map[1][2]).toBe('Wall');
    expect(state.bombs).toEqual([]);
    expect(state.players[0].activeBombs).toBe(0);
  });

  it('closes a 35x35 stage arena in batches within the fill time', () => {
    const stageMap = parseMapRows(Array.from({ length: 35 }, (_, y) => (
      y === 0 || y === 34 ? 'W'.repeat(35) : `W${' '.repeat(33)}W`
    )).map((row) => row.split('')));
    const start = liveRound({ ...versusConfig, map: stageMap }, {
      roundElapsedMs: VERSUS_ROUND_MS - 50,
    });

    const firstDrop = tickSuddenDeath(start, 50);
    expect(firstDrop.pressureBlocksPlaced).toBe(8);
    expect(getUpcomingPressureCells(firstDrop)).toHaveLength(8);

    const closed = tickSuddenDeath(firstDrop, PRESSURE_FILL_MS);
    expect(closed.pressureBlocksPlaced).toBe(33 * 33);
    expect(closed.map[17][17]).toBe('Wall');
  });

  it('never closes the arena in campaign missions', () => {
    let state = liveRound({
      ...versusConfig,
      mode: 'solo',
      numPlayers: 1,
      selectedCharacters: ['deidara'],
      stageId: 'hiddenSand',
    }, { roundElapsedMs: VERSUS_ROUND_MS * 2 });

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.map[1][1]).not.toBe('Wall');
    expect(getUpcomingPressureCells(state, 3)).toEqual([]);
  });
});
