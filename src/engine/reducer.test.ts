import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { GameConfig } from './types';
import { parseMapRows } from './mapLoader';
import { defaultMap } from '../constants/contants';

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

    expect(state.players[1].x).toBeLessThan(13);
  });

  it('places bomb on empty cell', () => {
    let state = createInitialState(baseConfig);
    state = gameReducer(state, { type: 'DROP_BOMB', playerId: 'player1' })!;
    expect(state.bombs).toHaveLength(1);
    expect(state.players[0].activeBombs).toBe(1);
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

  it('detonates active detonator bombs when bomb capacity is full', () => {
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

    expect(state.bombs).toHaveLength(0);
    expect(state.players[0].activeBombs).toBe(0);
    expect(state.players[0].powerUps).not.toContain('Detonator');
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
    expect(state.players[0].ultimateCooldownRemaining).toBeGreaterThan(0);
  });

  it('moves solo bosses and casts telegraphed hazards', () => {
    let state = createInitialState(soloConfig);
    const start = { x: state.boss!.x, y: state.boss!.y };

    state = gameReducer(state, { type: 'TICK', deltaMs: 2000 })!;

    expect({ x: state.boss!.x, y: state.boss!.y }).not.toEqual(start);
    expect(state.boss!.currentAbility).toBeTruthy();
    expect(state.hazards.length).toBeGreaterThan(0);
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
