import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { applyPowerUp } from './players';
import { createBomb, getExplosionPositions } from './bombs';
import { getShadowCloneBlocks } from './characterAbilities';
import { parseMapRows } from './mapLoader';
import { GameConfig, GameEngineState, PlayerState } from './types';
import { isBomb } from '../model/gameItem';

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
  state: Partial<GameEngineState> = {}
): GameEngineState {
  return {
    ...createInitialState({ ...config, ...overrides }),
    roundStartTicksRemaining: 0,
    monsters: [],
    ...state,
  };
}

function patchPlayer(
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

function tickFor(state: GameEngineState, totalMs: number): GameEngineState {
  let next = state;
  for (let elapsed = 0; elapsed < totalMs; elapsed += 50) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

function drop(state: GameEngineState, playerId: string): GameEngineState {
  return gameReducer(state, { type: 'DROP_BOMB', playerId })!;
}

describe('Naruto shadow clone bombs', () => {
  it('places one charge and respects Naruto bomb upgrades', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'sasuke'] });
    [3, 5].forEach((x) => {
      state = drop(patchPlayer(state, 'player1', { x, y: 3 }), 'player1');
    });

    expect(state.players[0].maxBombs).toBe(1);
    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['3,3']);
    expect(state.players[0].activeBombs).toBe(1);

    state = applyPowerUp(state, 'player1', 'AddBomb');
    [5, 7].forEach((x) => {
      state = drop(patchPlayer(state, 'player1', { x, y: 5 }), 'player1');
    });
    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['3,3', '5,5']);
    expect(state.players[0].activeBombs).toBe(2);
  });

  it('never fills Naruto adjacent corridor cells with solid clone bombs', () => {
    const corridor = parseMapRows([
      'WWWWWWWWWWW',
      'WWWWWWWWWWW',
      'WW      WWW',
      'WWWWWWWWWWW',
      'WWWWWWWWWWW',
    ].map((row) => row.split('')));
    let state = liveRound(
      { numPlayers: 1, selectedCharacters: ['naruto'] },
      { map: corridor }
    );

    state = drop(patchPlayer(state, 'player1', { x: 2, y: 2 }), 'player1');

    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['2,2']);
  });

  it('keeps the basic Shadow Clone as one charge without forming blockers', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'sasuke'] });
    state = drop(patchPlayer(state, 'player1', { x: 5, y: 5 }), 'player1');
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = patchPlayer(state, 'player2', { x: 6, y: 5 });
    state = tickFor(state, 2000);
    state = gameReducer(state, { type: 'MOVE', playerId: 'player2', direction: 'right' })!;
    expect(state.players[1].x).toBeCloseTo(6.1);
    expect(state.players[1].movementLockReason).toBeUndefined();
  });

  it('covers Naruto\'s whole ultimate blast area and pins even another Naruto', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'naruto'] });
    state = gameReducer(
      patchPlayer(state, 'player1', { x: 5, y: 5 }),
      { type: 'USE_ULTIMATE', playerId: 'player1' }
    )!;
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = patchPlayer(state, 'player2', { x: 9, y: 5 });

    state = tickFor(state, 2000);
    expect(state.bombs[0].kind).toBe('shadowCloneBarrage');
    const blastCells = getExplosionPositions(state.bombs[0], state.map)
      .filter(({ x, y }) => x !== state.bombs[0].x || y !== state.bombs[0].y)
      .map(({ x, y }) => `${x},${y}`)
      .sort();
    const cloneCells = getShadowCloneBlocks(state)
      .map(({ x, y }) => `${x},${y}`)
      .sort();
    expect(cloneCells).toEqual(blastCells);
    expect(state.players[1].movementLockReason).toBe('shadowClone');
    state = gameReducer(state, { type: 'MOVE', playerId: 'player2', direction: 'right' })!;
    expect(state.players[1].x).toBe(9);
  });

  it('lets Naruto move through his own ultimate formation', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'sasuke'] });
    state = gameReducer(
      patchPlayer(state, 'player1', { x: 5, y: 5 }),
      { type: 'USE_ULTIMATE', playerId: 'player1' }
    )!;
    state = patchPlayer(state, 'player1', { x: 6, y: 5 });
    state = patchPlayer(state, 'player2', { x: 12, y: 7 });

    state = tickFor(state, 2000);
    state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    expect(state.players[0].x).toBeCloseTo(6.1);
    expect(state.players[0].movementLockReason).toBeUndefined();
  });

  it('immobilizes monsters and bosses anywhere in the clone blast field', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'sasuke'] });
    state = gameReducer(
      patchPlayer(state, 'player1', { x: 5, y: 5 }),
      { type: 'USE_ULTIMATE', playerId: 'player1' }
    )!;
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = tickFor(state, 1950);
    state = {
      ...state,
      monsters: [{
        id: 'clone-target',
        name: 'White Zetsu',
        x: 9,
        y: 5,
        kind: 'basic',
        moveCooldown: 0,
      }],
      boss: {
        id: 'shukaku',
        name: 'Shukaku',
        x: 5,
        y: 8,
        health: 900,
        maxHealth: 900,
        phase: 1,
        attackCooldown: 10000,
        moveCooldown: 0,
        currentAbility: '',
        color: '#f59e0b',
        tails: 1,
      },
    };

    state = tickFor(state, 50);

    expect(state.monsters[0]).toMatchObject({ x: 9, y: 5, moveCooldown: 60 });
    expect(state.boss).toMatchObject({ x: 5, y: 8 });
    expect(state.boss?.moveCooldown).toBeGreaterThan(0);
  });
});

describe('signature bomb movement and control', () => {
  it('keeps Deidara basic clay spiders stationary', () => {
    let state = liveRound({ selectedCharacters: ['deidara', 'sasuke'] });
    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = patchPlayer(state, 'player2', { x: 8, y: 3 });

    state = tickFor(state, 850);

    expect(state.bombs[0]).toMatchObject({ kind: 'claySpider', x: 3, y: 3 });
    expect(isBomb(state.map[3][3])).toBe(true);
  });

  it('walks Deidara C3 ultimate slowly toward a nearby rival', () => {
    let state = liveRound({ selectedCharacters: ['deidara', 'sasuke'] });
    state = gameReducer(
      patchPlayer(state, 'player1', { x: 3, y: 3 }),
      { type: 'USE_ULTIMATE', playerId: 'player1' }
    )!;
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = patchPlayer(state, 'player2', { x: 8, y: 3 });

    state = tickFor(state, 800);
    expect(state.bombs[0]).toMatchObject({ kind: 'giantClay', x: 3, y: 3 });
    state = tickFor(state, 50);
    expect(state.bombs[0]).toMatchObject({ kind: 'giantClay', x: 4, y: 3 });
  });

  it('does not make Deidara C3 hunt co-op teammates', () => {
    let state = liveRound(
      { mode: 'solo', numPlayers: 2, selectedCharacters: ['deidara', 'naruto'] },
      { boss: null }
    );
    state = gameReducer(
      patchPlayer(state, 'player1', { x: 3, y: 3 }),
      { type: 'USE_ULTIMATE', playerId: 'player1' }
    )!;
    state = patchPlayer(state, 'player1', { x: 2, y: 7 });
    state = patchPlayer(state, 'player2', { x: 8, y: 3 });

    state = tickFor(state, 850);

    expect(state.bombs[0]).toMatchObject({ kind: 'giantClay', x: 3, y: 3 });
  });

  it('does not give Sasuke basic mines an outer movement lock', () => {
    let state = liveRound({ selectedCharacters: ['sasuke', 'naruto'] });
    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    state = patchPlayer(state, 'player1', { x: 3, y: 8 });
    state = patchPlayer(state, 'player2', { x: 7, y: 3 });

    state = tickFor(state, 1800);
    expect(state.players[1].movementLockReason).toBeUndefined();
  });

  it('does not give Itachi basic crow clones an outer movement lock', () => {
    let state = liveRound({ selectedCharacters: ['itachi', 'naruto'] });
    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    state = patchPlayer(state, 'player1', { x: 3, y: 8 });
    state = patchPlayer(state, 'player2', { x: 5, y: 5 });

    state = tickFor(state, 2400);

    expect(state.players[1].movementLockReason).toBeUndefined();
  });
});

describe('ultimate outer health damage', () => {
  it.each([
    ['gaara', 'sandTsunami', 2600, 11, 5],
    ['sasuke', 'kirin', 2100, 11, 6],
    ['itachi', 'tsukuyomi', 2300, 11, 5],
  ] as const)(
    '%s adds one nonlethal damage cell beyond the lethal blast',
    (characterId, bombKind, fuseMs, targetX, targetY) => {
      let state = liveRound({ selectedCharacters: [characterId, 'naruto'] });
      state = gameReducer(
        patchPlayer(state, 'player1', { x: 5, y: 5 }),
        { type: 'USE_ULTIMATE', playerId: 'player1' }
      )!;
      state = patchPlayer(state, 'player1', { x: 2, y: 7 });
      state = patchPlayer(state, 'player2', { x: targetX, y: targetY });

      state = tickFor(state, fuseMs);

      expect(state.players[1]).toMatchObject({ alive: true, health: 2 });
      expect(state.explosions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          x: targetX, y: targetY, kind: bombKind, chipDamage: true,
        }),
      ]));
      state = tickFor(state, 50);
      expect(state.players[1]).toMatchObject({ alive: true, health: 2 });
    }
  );
});

describe('survival passives', () => {
  it('keeps Gaara alive through every cell of the blast that spends his shield', () => {
    let state = liveRound({ selectedCharacters: ['gaara', 'sasuke'] });
    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    // Half a step off the bomb cell, so the blast covers him on two cells.
    state = patchPlayer(state, 'player1', { x: 3.3, y: 3 });

    state = tickFor(state, 3350);

    expect(state.bombs).toHaveLength(0);
    expect(state.players[0]).toMatchObject({ alive: true, passiveState: 'Sand Shield Spent' });
  });

  it('keeps Gaara alive in the neighbouring flame of the one that spent his shield', () => {
    const flame = {
      ticksRemaining: 450, kind: 'standard' as const, ownerId: 'player2', sparedIds: [],
    };
    let state = liveRound(
      { selectedCharacters: ['gaara', 'sasuke'] },
      { explosions: [{ ...flame, x: 3, y: 3 }, { ...flame, x: 4, y: 3 }] }
    );
    state = patchPlayer(state, 'player1', { x: 3.3, y: 3 });

    state = tickFor(state, 50);
    expect(state.players[0]).toMatchObject({ alive: true, passiveState: 'Sand Shield Spent' });

    state = tickFor(state, 100);
    expect(state.players[0].alive).toBe(true);
  });

  it('lets Itachi dodge a monster that stays in contact, but only for a moment', () => {
    let state = liveRound(
      { selectedCharacters: ['itachi', 'sasuke'] },
      {
        monsters: [{
          id: 'cultist', name: 'Akatsuki Cultist', x: 3, y: 3, kind: 'smart', moveCooldown: 60000,
        }],
      }
    );
    state = patchPlayer(state, 'player1', { x: 3, y: 3 });

    state = tickFor(state, 300);
    expect(state.players[0]).toMatchObject({ alive: true, passiveState: 'Illusion Dodge Spent' });

    state = tickFor(state, 2000);
    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].deathReason).toContain('Akatsuki Cultist');
  });

  it('keeps Gaara\'s sand shield when he picks up Sand Armor', () => {
    let state = liveRound({ selectedCharacters: ['gaara', 'sasuke'] });
    state = applyPowerUp(state, 'player1', 'SandArmor');
    // Let the armor's temporary shield run out first.
    state = tickFor(state, 15050);
    expect(state.players[0].powerUps).not.toContain('Invincibility');

    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    state = tickFor(state, 3350);

    expect(state.players[0]).toMatchObject({ alive: true, passiveState: 'Sand Shield Spent' });
  });
});

describe('ultimate charge pickups', () => {
  it('lets signature pickups refill the ultimate they claim to charge', () => {
    let state = liveRound({ selectedCharacters: ['naruto', 'sasuke'] });
    state = patchPlayer(state, 'player1', { x: 3, y: 3 });
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;
    // Step clear of the Rasenshuriken.
    state = patchPlayer(state, 'player1', { x: 11, y: 7 });
    state = tickFor(state, 3000);
    expect(state.players[0].ultimateCharge).toBe(25);

    state = tickFor(applyPowerUp(state, 'player1', 'Rasengan'), 50);
    expect(state.players[0].ultimateCharge).toBe(50);

    state = tickFor(applyPowerUp(state, 'player1', 'CharacterFragment'), 50);
    expect(state.players[0].ultimateCharge).toBe(100);
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;
    expect(state.bombs.map((bomb) => bomb.kind)).toEqual(['shadowCloneBarrage']);
    expect(state.players[0].ultimateCooldownRemaining).toBe(12000);
  });
});

describe('bombs that outlive their owner', () => {
  it('sets off a fallen ninja\'s manual bombs on their normal fuse', () => {
    let state = liveRound({ numPlayers: 3, selectedCharacters: undefined });
    state = patchPlayer(state, 'player1', { x: 3, y: 3, powerUps: ['Detonator'] });
    state = drop(state, 'player1');
    expect(state.bombs[0].manualDetonation).toBe(true);

    state = patchPlayer(state, 'player1', {
      x: 6, y: 6, alive: false, deathReason: 'Deidara was caught by a test.',
    });
    state = tickFor(state, 3000);

    expect(state.bombs).toHaveLength(0);
    expect(state.map[3][3]).toBe('Empty');
    expect(state.players[0].activeBombs).toBe(0);
    expect(state.phase).toBe('playing');
  });
});

describe('crate drops', () => {
  it('never lets a crate drop overwrite a bomb planted on the burning crate cell', () => {
    let state = liveRound(
      { selectedCharacters: ['naruto', 'sasuke'] },
      {
        explosions: [{
          x: 4, y: 3, ticksRemaining: 300, kind: 'standard', ownerId: 'player2', sparedIds: [],
        }],
        destroyedBoxes: [{
          x: 4, y: 3, ticksRemaining: 300, pendingPowerUp: 'AddBomb',
        }],
      }
    );
    state = applyPowerUp(state, 'player1', 'AddBomb');
    state = drop(patchPlayer(state, 'player1', { x: 3, y: 3 }), 'player1');
    state = drop(patchPlayer(state, 'player1', { x: 4, y: 3 }), 'player1');
    state = patchPlayer(state, 'player1', { x: 3, y: 3 });
    expect(state.bombs.map((bomb) => `${bomb.x},${bomb.y}`)).toEqual(['3,3', '4,3']);

    state = tickFor(state, 350);

    expect(state.destroyedBoxes).toHaveLength(0);
    expect(isBomb(state.map[3][4])).toBe(true);
  });
});

describe('Ghost expiry', () => {
  it('keeps the real death reason when Ghost fades on a fallen ninja', () => {
    const map = openArena.map((row) => [...row]);
    map[5][5] = 'Box';
    let state = liveRound(
      { numPlayers: 3, selectedCharacters: undefined },
      {
        map,
        timedPowerUps: {
          player1: [{ power: 'Ghost', ticksRemaining: 10, flashTicksRemaining: 0 }],
        },
      }
    );
    state = patchPlayer(state, 'player1', {
      x: 5, y: 5, alive: false, powerUps: ['Ghost'], deathReason: 'Deidara was caught in a test blast.',
    });

    state = tickFor(state, 50);

    expect(state.players[0].deathReason).toBe('Deidara was caught in a test blast.');
    expect(state.players[0].powerUps).not.toContain('Ghost');
  });

  it('keeps a phasing ninja inside the arena', () => {
    let state = liveRound({}, {
      timedPowerUps: {
        player1: [{ power: 'Ghost', ticksRemaining: 5000, flashTicksRemaining: 0 }],
      },
    });
    state = patchPlayer(state, 'player1', { x: 1, y: 1, powerUps: ['Ghost'] });
    state = patchPlayer(state, 'player2', { x: 2, y: 3 });

    const walk = (from: GameEngineState, direction: 'up' | 'left') => {
      let next = from;
      for (let step = 0; step < 15; step += 1) {
        next = gameReducer(next, { type: 'MOVE', playerId: 'player1', direction })!;
      }
      return next;
    };

    expect(walk(state, 'up').players[0]).toMatchObject({ x: 1, y: 0 });
    expect(walk(state, 'left').players[0]).toMatchObject({ x: 0, y: 1 });
  });
});

describe('Minato Flying Thunder marker', () => {
  it('places Minato\'s ultimate at his current cell when there is no marker', () => {
    const state = patchPlayer(
      liveRound({ selectedCharacters: ['minato', 'sasuke'] }),
      'player1',
      { x: 4, y: 3 }
    );
    const next = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(next.bombs[0]).toMatchObject({ kind: 'instantTeleport', x: 4, y: 3 });
    expect(next.players[0].ultimateCharge).toBe(0);
  });

  it('places a passable marker and routes the ultimate bomb to it', () => {
    let state = liveRound({ selectedCharacters: ['minato', 'sasuke'] });
    state = patchPlayer(state, 'player1', { x: 3, y: 3 });
    state = gameReducer(state, { type: 'PLACE_OBSTACLE', playerId: 'player1' })!;
    expect(state.players[0].teleportMark).toEqual({ x: 3, y: 3 });
    expect(state.map[3][3]).toBe('Empty');
    expect(state.bombs).toHaveLength(0);

    state = patchPlayer(state, 'player1', { x: 8, y: 6 });
    state = gameReducer(state, { type: 'USE_ULTIMATE', playerId: 'player1' })!;

    expect(state.bombs).toHaveLength(1);
    expect(state.bombs[0]).toMatchObject({ kind: 'instantTeleport', x: 3, y: 3 });
    expect(state.players[0].activeBombs).toBe(1);
    expect(state.players[0]).toMatchObject({ x: 8, y: 6 });
    expect(state.players[0].teleportMark).toBeUndefined();
    expect(state.map[6][8]).toBe('Empty');
  });
});

describe('re-ignited flames', () => {
  it('catches a ninja the old flame spared when they walk into the restarted one', () => {
    const map = openArena.map((row) => [...row]);
    map[3][6] = { range: 2, coords: { x: 6, y: 3 }, ownerId: 'player2' };
    let state = liveRound({}, {
      map,
      bombs: [createBomb('player2', 6, 3, 2, false, 'standard', 50)],
      explosions: [{
        x: 4, y: 3, ticksRemaining: 450, kind: 'standard', ownerId: 'player2', sparedIds: ['player1'],
      }],
    });
    state = patchPlayer(state, 'player1', { x: 2, y: 3 });
    state = patchPlayer(state, 'player2', { x: 9, y: 7, activeBombs: 1 });

    // player2's bomb restarts the burning cell two tiles in front of player1.
    state = tickFor(state, 50);
    expect(state.explosions.find((flame) => flame.x === 4 && flame.y === 3))
      .toMatchObject({ ticksRemaining: 450 });

    // 14 steps puts their body well into the flame tile (FLAME_HURT_RADIUS).
    for (let step = 0; step < 14; step += 1) {
      state = gameReducer(state, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
    }
    state = tickFor(state, 50);

    expect(state.players[0].alive).toBe(false);
  });
});
