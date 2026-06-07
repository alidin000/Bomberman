import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { GameConfig } from './types';
import { applyPowerUp } from './players';
import { parseMapRows } from './mapLoader';
import { defaultMap } from '../constants/contants';
import { isObstacle } from '../model/gameItem';

const baseConfig: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: parseMapRows(defaultMap),
};

const soloConfig: GameConfig = {
  ...baseConfig,
  mode: 'solo',
  numPlayers: 1,
  selectedCharacters: ['deidara'],
  stageId: 'hiddenSand',
};

const akatsukiMap = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W B B   B B  W',
  'W  WWW B  W  W',
  'WB   B B   B W',
  'W B W   W B  W',
  'W  B W W   B W',
  'W B   B WWW  W',
  'W  W  B   B W',
  'W  B B   B  W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

describe('gameReducer', () => {
  it('initializes game state', () => {
    const state = gameReducer(null, { type: 'INIT', config: baseConfig });
    expect(state).not.toBeNull();
    expect(state!.players).toHaveLength(2);
    expect(state!.monsters.length).toBeGreaterThan(0);
    expect(state!.phase).toBe('playing');
  });

  it('spawns ninja enemies for village arena maps', () => {
    const state = createInitialState({
      ...baseConfig,
      selectedMap: 'hiddenSand',
      stageId: 'hiddenSand',
    });

    expect(state.monsters.length).toBeGreaterThan(0);
    expect(state.monsters.map((monster) => monster.name)).toContain('Puppet Scout');
  });

  it('moves player within bounds', () => {
    let state = createInitialState(baseConfig);
    const startX = state.players[0].x;
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeGreaterThanOrEqual(startX);
  });

  it('moves players in tenth-cell increments while bombs stay grid-snapped', () => {
    let state = createInitialState(baseConfig);

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.1);

    for (let step = 0; step < 9; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }

    expect(state.players[0].x).toBeCloseTo(2);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs[0]).toMatchObject({ x: 2, y: 1 });
  });

  it('recenters players into lanes while moving with decimal positions', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 1, y: 1.3 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;

    expect(state.players[0].x).toBeCloseTo(1.1);
    expect(state.players[0].y).toBeCloseTo(1.2);
  });

  it('clears spawn lanes so player two Minato can move from Akatsuki start', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedMap: 'akatsukiHideout',
      stageId: 'akatsukiHideout',
      map: akatsukiMap,
      selectedCharacters: ['itachi', 'minato'],
    });

    expect(state.map[8][13]).toBe('Empty');
    expect(state.map[8][12]).toBe('Empty');
    expect(state.players[1].characterId).toBe('minato');
    expect(state.players[1].powerUps).toContain('RollerSkate');

    state = gameReducer(state, { type: 'MOVE', playerId: 'player2', direction: 'left' })!;

    expect(state.players[1].x).toBeCloseTo(12.9);
  });

  it('places bomb on empty cell', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);
    expect(state.players[0].activeBombs).toBe(1);
  });

  it('lets players walk out of their placed bomb before it becomes solid', () => {
    let state = createInitialState(baseConfig);

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.1);

    for (let step = 0; step < 7; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }

    expect(state.players[0].x).toBeCloseTo(1.8);
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'left' })!;
    expect(state.players[0].x).toBeCloseTo(1.8);
  });

  it('drops a Naruto shadow clone charge beside the first bomb', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;

    expect(state.bombs).toHaveLength(2);
    expect(state.bombs.every((bomb) => bomb.kind === 'shadowClone')).toBe(true);
    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['1,1', '2,1']);
  });

  it('lets Sasuke Chidori mines pierce boxes', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['sasuke', 'naruto'],
    });
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 5, y: 1 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 1750 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.explosions).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: 7, y: 1, kind: 'chidoriMine' }),
    ]));
  });

  it('uses Gaara sand bombs to trap beasts instead of removing them', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['gaara', 'itachi'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'sand-target',
        name: 'Shukaku Cub',
        x: 2,
        y: 1,
        kind: 'basic',
        moveCooldown: 14000,
      }],
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3250 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.monsters).toHaveLength(1);
    expect(state.monsters[0].moveCooldown).toBeGreaterThan(9000);
  });

  it('uses Minato thunder marks with a quick fuse', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['minato', 'itachi'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;

    expect(state.bombs[0].kind).toBe('thunderMark');
    expect(state.bombs[0].ticksRemaining).toBe(1500);
  });

  it('lets Gaara spend his sand shield to survive his first blast hit', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['gaara', 'itachi'],
    });

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3250 })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].passiveState).toBe('Sand Shield Spent');
  });

  it('lets Itachi spend illusion dodge to survive first monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['itachi', 'gaara'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'itachi-contact',
        name: 'Akatsuki Cultist',
        x: 1,
        y: 1,
        kind: 'smart',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
    expect(state.players[0].passiveState).toBe('Illusion Dodge Spent');
  });

  it('does not seal players from a clear lane without monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'sand-line',
        name: 'Sand Ninja',
        x: 3,
        y: 1,
        kind: 'smart',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('keeps detonator bombs from exploding on the timer', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Detonator'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0].manualDetonation).toBe(true);
  });

  it('detonates active detonator bombs with the detonate action', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Detonator'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);

    state = gameReducer(state, { type: 'DETONATE_BOMBS', playerId: 'player1' })!;

    expect(state.bombs).toHaveLength(0);
    expect(state.players[0].activeBombs).toBe(0);
    expect(state.players[0].powerUps).not.toContain('Detonator');
  });

  it('applies the profile power-up effects to player state', () => {
    let state = createInitialState(baseConfig);
    const initial = state.players[0];

    state = applyPowerUp(state, 'player1', 'AddBomb');
    expect(state.players[0].maxBombs).toBe(initial.maxBombs + 1);
    expect(state.pickupMessages).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: 'player1', power: 'AddBomb' }),
    ]));

    state = applyPowerUp(state, 'player1', 'BlastRangeUp');
    expect(state.players[0].bombRange).toBe(initial.bombRange + 1);

    state = applyPowerUp(state, 'player1', 'Detonator');
    expect(state.players[0].powerUps).toContain('Detonator');

    state = applyPowerUp(state, 'player1', 'RollerSkate');
    expect(state.players[0].powerUps).toContain('RollerSkate');

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Invincibility');
    expect(state.players[0].powerUps).toContain('Invincibility');
    expect(state.timedPowerUps.player1).toEqual(expect.arrayContaining([
      expect.objectContaining({ power: 'Invincibility' }),
    ]));

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Ghost');
    expect(state.players[0].powerUps).toContain('Ghost');
    expect(state.timedPowerUps.player1).toEqual(expect.arrayContaining([
      expect.objectContaining({ power: 'Ghost' }),
    ]));

    state = applyPowerUp(createInitialState(baseConfig), 'player1', 'Obstacle');
    expect(state.players[0].obstacles).toBe(3);
    expect(state.players[0].powerUps).toContain('Obstacle');

    state = applyPowerUp(state, 'player1', 'Obstacle');
    expect(state.players[0].obstacles).toBe(6);
    expect(state.players[0].powerUps.filter((power) => power === 'Obstacle')).toHaveLength(1);
  });

  it('spends cover charges with the cover action', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : player
      )),
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(isObstacle(state.map[1][2])).toBe(true);
    expect(state.map[1][2]).toMatchObject({
      ownerId: 'player1',
      coords: { x: 2, y: 1 },
    });
    expect(state.players[0].obstacles).toBe(0);
    expect(state.players[0].powerUps).not.toContain('Obstacle');
    expect(state.bombs).toHaveLength(0);
  });

  it('does not place cover into a decimal cell occupied by the player', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            x: 1.3,
            y: 1,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : player
      )),
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(state.map[1][2]).toBe('Empty');
    expect(state.players[0].obstacles).toBe(1);
    expect(state.players[0].powerUps).toContain('Obstacle');
  });

  it('does not let cover close the only adjacent escape cell', () => {
    let state = createInitialState(baseConfig);
    const map = parseMapRows([
      'WWWWW',
      'WWWWW',
      'WW  W',
      'WWWWW',
      'WWWWW',
    ].map((row) => row.split('')));
    state = {
      ...state,
      map,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player,
            x: 2,
            y: 2,
            facing: 'right',
            obstacles: 1,
            powerUps: ['Obstacle'],
          }
          : { ...player, alive: false }
      )),
      monsters: [],
    };

    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;

    expect(state.map[2][3]).toBe('Empty');
    expect(state.players[0].obstacles).toBe(1);
    expect(state.players[0].powerUps).toContain('Obstacle');
  });

  it('lets Ghost phase through player cover but punishes ending inside it', () => {
    let state = createInitialState(baseConfig);
    const map = state.map.map((row) => [...row]);
    map[1][2] = {
      ownerId: 'player2',
      coords: { x: 2, y: 1 },
    };
    state = {
      ...state,
      map,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? {
            ...player, x: 1.6, y: 1, powerUps: ['Ghost'],
          }
          : player
      )),
      timedPowerUps: {
        player1: [{
          power: 'Ghost',
          ticksRemaining: 1000,
          flashTicksRemaining: 0,
        }],
      },
    };

    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(1.7);

    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 2, y: 1 }
          : player
      )),
      timedPowerUps: {
        player1: [{ power: 'Ghost', ticksRemaining: 10, flashTicksRemaining: 0 }],
      },
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].powerUps).not.toContain('Ghost');
  });

  it('lets blasts destroy player-placed cover', () => {
    let state = createInitialState(baseConfig);
    const map = state.map.map((row) => [...row]);
    map[1][2] = { ownerId: 'player2', coords: { x: 2, y: 1 } };
    state = { ...state, map, monsters: [] };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.map[1][2]).toBe('Empty');
  });

  it('lets Guard protect players from blasts and monster contact', () => {
    let state = createInitialState({
      ...baseConfig,
      selectedCharacters: ['naruto', 'sasuke'],
    });
    state = {
      ...state,
      monsters: [{
        id: 'guard-contact',
        name: 'Guard Contact',
        x: 1,
        y: 1,
        kind: 'basic',
        moveCooldown: 1000,
      }],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Invincibility'] }
          : player
      )),
      timedPowerUps: {
        player1: [{ power: 'Ghost', ticksRemaining: 5000, flashTicksRemaining: 0 }],
      },
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('removes monsters caught by bomb explosions', () => {
    let state = createInitialState(baseConfig);
    state = {
      ...state,
      monsters: [{
        id: 'test-monster',
        name: 'Test Monster',
        x: 2,
        y: 1,
        kind: 'basic',
        moveCooldown: 1000,
      }],
    };

    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.monsters).toHaveLength(0);
  });

  it('does not render explosion cells through indestructible walls', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    state = gameReducer(state, { type: 'TICK', deltaMs: 3000 })!;

    expect(state.explosions).not.toContainEqual({ x: 0, y: 1, ticksRemaining: 500 });
  });

  it('pauses and resumes', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'PAUSE' })!;
    expect(state.paused).toBe(true);
    state = gameReducer(state, { type: 'RESUME' })!;
    expect(state.paused).toBe(false);
  });

  it('advances tick without crashing', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;
    expect(state.tick).toBe(1);
  });

  it('initializes a solo boss encounter', () => {
    const state = createInitialState(soloConfig);
    expect(state.boss?.name).toBe('Shukaku');
    expect(state.monsters).toHaveLength(0);
    expect(state.players[0].characterId).toBe('deidara');
  });

  it('uses the character ultimate to place a giant clay bomb', () => {
    let state = createInitialState(soloConfig);
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;
    expect(state.bombs[0].kind).toBe('giantClay');
    expect(state.bombs[0].ticksRemaining).toBe(2600);
    expect(state.players[0].ultimateCooldownRemaining).toBeGreaterThan(0);
  });

  it('gives ultimate bombs enough fuse time to escape after decimal movement', () => {
    let state = createInitialState({
      ...soloConfig,
      selectedCharacters: ['sasuke'],
    });

    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(state.bombs[0].kind).toBe('kirin');
    expect(state.bombs[0].ticksRemaining).toBeGreaterThanOrEqual(2000);
  });

  it('snaps ultimate bombs to grid cells from decimal positions near walls', () => {
    let state = createInitialState(soloConfig);
    state = {
      ...state,
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, x: 1.2, y: 0.8 }
          : player
      )),
    };

    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(state.bombs[0]).toMatchObject({ x: 1, y: 1, kind: 'giantClay' });
    expect(state.map[1][1]).toMatchObject({ coords: { x: 1, y: 1 } });
  });

  it('moves solo bosses and casts telegraphed hazards', () => {
    let state = createInitialState(soloConfig);
    const start = { x: state.boss!.x, y: state.boss!.y };

    state = gameReducer(state, { type: 'TICK', deltaMs: 2000 })!;

    expect({ x: state.boss!.x, y: state.boss!.y }).not.toEqual(start);
    expect(state.boss!.currentAbility).toBeTruthy();
    expect(state.hazards.length).toBeGreaterThan(0);
  });

  it('lets Guard protect players from active boss hazards', () => {
    let state = createInitialState(soloConfig);
    state = {
      ...state,
      boss: state.boss
        ? { ...state.boss, attackCooldown: 99999, moveCooldown: 99999 }
        : state.boss,
      hazards: [{
        id: 'guard-test-hazard',
        kind: 'sandTornado',
        x: state.players[0].x,
        y: state.players[0].y,
        ticksRemaining: 100,
        warningTicks: 1500,
        color: '#f59e0b',
        damage: 1,
      }],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, powerUps: ['Invincibility'] }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.players[0].alive).toBe(true);
  });

  it('counts final match winners by player id instead of character name', () => {
    let state = createInitialState({
      ...baseConfig,
      totalRounds: 2,
      selectedCharacters: ['deidara', 'naruto'],
    });
    state = {
      ...state,
      round: 2,
      roundWinners: ['player1'],
      monsters: [],
      players: state.players.map((player) => (
        player.id === 'player2'
          ? { ...player, alive: false }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.phase).toBe('game_over');
    expect(state.roundWinners).toEqual(['player1', 'player1']);
    expect(state.resultMessage).toBe('Deidara wins the match!');
  });

  it('declares a final draw when trial wins are tied', () => {
    let state = createInitialState({
      ...baseConfig,
      totalRounds: 2,
      selectedCharacters: ['deidara', 'naruto'],
    });
    state = {
      ...state,
      round: 2,
      roundWinners: ['player1'],
      monsters: [],
      players: state.players.map((player) => (
        player.id === 'player1'
          ? { ...player, alive: false }
          : player
      )),
    };

    state = gameReducer(state, { type: 'TICK', deltaMs: 50 })!;

    expect(state.phase).toBe('game_over');
    expect(state.roundWinners).toEqual(['player1', 'player2']);
    expect(state.resultMessage).toBe('The match ends in a draw!');
  });
});
