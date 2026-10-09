import { readFileSync } from 'node:fs';
import { gameReducer } from './reducer';
import { createInitialState as createMatchState } from './initialState';
import { parseMapRows } from './mapLoader';
import { createShinobiEnemy, tickCampaignRespawns } from './campaignEnemies';
import { positionsTouch } from './grid';
import { SURVIVAL_GRACE_MS } from './constants';
import {
  BossHazard, GameConfig, GameEngineState, MonsterState,
} from './types';
import { StageId } from '../content/types';

function stageMap(stageId: StageId) {
  return parseMapRows(readFileSync(`public/maps/${stageId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
}

function campaignState(stageId: StageId): GameEngineState {
  return {
    ...createMatchState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: stageId,
      stageId,
      selectedCharacters: ['deidara'],
      map: stageMap(stageId),
    }),
    roundStartTicksRemaining: 0,
  };
}

function arenaState(rows: string[], characters = ['deidara', 'naruto']): GameEngineState {
  const map = parseMapRows(rows.map((row) => row.split('')));
  const config: GameConfig = {
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'rules-test',
    map,
    selectedCharacters: characters as GameConfig['selectedCharacters'],
  };
  // Keep the authored cells: spawn clearing would open the test's dead ends.
  return {
    ...createMatchState(config), map, roundStartTicksRemaining: 0, monsters: [],
  };
}

const OPEN_ROOM = [
  'WWWWWWW',
  'W     W',
  'W     W',
  'W     W',
  'W     W',
  'W     W',
  'WWWWWWW',
];

function tick(state: GameEngineState, deltaMs = 50): GameEngineState {
  return gameReducer(state, { type: 'TICK', deltaMs })!;
}

function place(state: GameEngineState, positions: { x: number; y: number }[]): GameEngineState {
  return {
    ...state,
    players: state.players.map((player, index) => ({
      ...player, x: positions[index].x, y: positions[index].y,
    })),
  };
}

function hazard(x: number, y: number, ticksRemaining: number, id = 'spike'): BossHazard {
  return {
    id,
    kind: 'sandSpikes',
    x,
    y,
    ticksRemaining,
    warningTicks: 1680,
    color: '#f59e0b',
    damage: 1,
    sourceName: 'Sand Ninja',
  };
}

function defenseOf(state: GameEngineState) {
  return state.campaign!.objectives.find((objective) => objective.kind === 'defense')!;
}

describe('campaign hazards and objectives', () => {
  it('lets an active enemy hazard damage the defended structure', () => {
    let ready: GameEngineState = { ...campaignState('hiddenSand'), monsters: [] };
    ready.campaign!.objectives[0].targets!.forEach((target) => {
      ready = tick(place(ready, [target]), 0);
    });
    expect(defenseOf(ready).status).toBe('active');
    const { x, y } = defenseOf(ready);

    const telegraphed = tick({ ...ready, hazards: [hazard(x!, y!, 2000)] });
    const struck = tick({ ...ready, hazards: [hazard(x!, y!, 300)] });

    // The wave script sets the seal's health; one struck hit costs 50 of it.
    const full = defenseOf(ready).structureMaxHp!;
    expect(defenseOf(telegraphed).structureHp).toBe(full);
    expect(defenseOf(struck).structureHp).toBe(full - 50);
  });

  it('strikes an enemy hazard when its warning marker ends, not later', () => {
    const sandNinja = createShinobiEnemy({
      archetype: 'sandNinja', x: 1, y: 3, id: 'sand',
    });
    let state = place(arenaState(OPEN_ROOM), [{ x: 3, y: 3 }, { x: 5, y: 1 }]);
    state = { ...state, monsters: [{ ...sandNinja, abilityCooldown: 0, moveCooldown: 60000 }] };

    state = tick(state);
    expect(state.hazards.map((item) => [item.x, item.y])).toEqual([[3, 3]]);
    let ticks = 0;
    while ((state.monsters[0].abilityWarningTicks ?? 0) > 0 && ticks < 40) {
      expect(state.players[0].alive).toBe(true);
      state = tick(state);
      ticks += 1;
    }

    expect(state.players[0].alive).toBe(false);
    expect(state.players[0].deathReason).toContain('Sand Spike');
  });
});

describe('enemy abilities', () => {
  it('lets water clones fade instead of piling up around a lingering player', () => {
    const mist = createShinobiEnemy({
      archetype: 'mistNinja', x: 1, y: 1, id: 'mist',
    });
    let state = place(arenaState(OPEN_ROOM), [{ x: 3, y: 3 }, { x: 5, y: 5 }]);
    state = {
      ...state,
      players: state.players.map((player) => ({ ...player, powerUps: ['Invincibility'] })),
      monsters: [{ ...mist, abilityCooldown: 0 }],
    };

    let maxClones = 0;
    for (let elapsed = 0; elapsed < 60000; elapsed += 50) {
      state = tick(state);
      maxClones = Math.max(maxClones, state.monsters.filter((monster) => monster.clone).length);
    }

    expect(maxClones).toBeGreaterThan(0);
    expect(maxClones).toBeLessThanOrEqual(2);
  });

  it('keeps a water clone and its caster from sharing one cell', () => {
    let state = place(arenaState([
      'WWWWWWW',
      'W  WWWW',
      'WWWW  W',
      'W     W',
      'W     W',
      'W     W',
      'WWWWWWW',
    ]), [{ x: 3, y: 4 }, { x: 5, y: 5 }]);
    const mist: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'mistNinja', x: 1, y: 1, id: 'mist',
      }),
      moveCooldown: 0,
      abilityWarningTicks: 1,
      abilityTarget: { x: 2, y: 1 },
    };
    state = { ...state, monsters: [mist] };

    state = tick(state, 10);

    const cells = state.monsters.map((monster) => `${monster.x},${monster.y}`);
    expect(state.monsters.some((monster) => monster.clone)).toBe(true);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('never conjures a water clone on top of a player beside the caster', () => {
    let state = place(arenaState([
      'WWWWWWW',
      'W  WWWW',
      'WWWW  W',
      'W     W',
      'W     W',
      'W     W',
      'WWWWWWW',
    ]), [{ x: 2, y: 1 }, { x: 5, y: 5 }]);
    const mist: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'mistNinja', x: 1, y: 1, id: 'mist',
      }),
      moveCooldown: 60000,
      abilityWarningTicks: 1,
      abilityTarget: { x: 2, y: 1 },
    };
    state = { ...state, monsters: [mist] };

    state = tick(state, 10);

    expect(state.players[0].alive).toBe(true);
    expect(state.monsters.some((monster) => positionsTouch(monster, state.players[0])))
      .toBe(false);
  });

  it('fizzles body flicker instead of landing on a boxed-in player', () => {
    let state = place(arenaState([
      'WWWWWWWWW',
      'W W     W',
      'WBW     W',
      'W       W',
      'W       W',
      'W       W',
      'WWWWWWWWW',
    ]), [{ x: 1, y: 1 }, { x: 7, y: 5 }]);
    const anbu: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'anbu', x: 2, y: 4, id: 'anbu',
      }),
      moveCooldown: 60000,
      abilityWarningTicks: 1,
      abilityTarget: { x: 1, y: 2 },
    };
    state = { ...state, monsters: [anbu] };

    state = tick(state, 10);

    expect(state.players[0].alive).toBe(true);
    expect(state.monsters[0]).toMatchObject({ x: 2, y: 4, abilityTarget: null });
  });
});

describe('survival saves against lingering threats', () => {
  it('keeps a spent sand shield from being undone by the same hazard', () => {
    let state = place(arenaState(OPEN_ROOM, ['gaara', 'naruto']), [{ x: 3, y: 3 }, { x: 5, y: 5 }]);
    state = { ...state, hazards: [hazard(3, 3, 700)] };

    for (let index = 0; index < 4; index += 1) state = tick(state);
    expect(state.players[0]).toMatchObject({ alive: true, passiveState: 'Sand Shield Spent' });

    // The save's grace outlasts the hazard; a fresh spike after the grace kills.
    for (let elapsed = 0; elapsed < SURVIVAL_GRACE_MS; elapsed += 50) state = tick(state);
    expect(state.players[0].alive).toBe(true);
    state = tick({ ...state, hazards: [...state.hazards, hazard(3, 3, 700, 'second-spike')] });
    expect(state.players[0].alive).toBe(false);
  });

  it('lets Itachi slip away after illusion dodge absorbs a monster contact', () => {
    let state = place(arenaState(OPEN_ROOM, ['naruto', 'itachi']), [{ x: 5, y: 5 }, { x: 3, y: 3 }]);
    state = {
      ...state,
      monsters: [{
        id: 'cultist', name: 'Akatsuki Cultist', x: 3, y: 3, kind: 'basic', moveCooldown: 60000,
      }],
    };

    for (let index = 0; index < 4; index += 1) state = tick(state);
    expect(state.players[1]).toMatchObject({ alive: true, passiveState: 'Illusion Dodge Spent' });

    state = tick(place(state, [{ x: 5, y: 5 }, { x: 3, y: 1 }]));
    expect(state.players[1].alive).toBe(true);
    // Walking back into it once the dodge's grace has run out is fatal.
    for (let elapsed = 0; elapsed < SURVIVAL_GRACE_MS; elapsed += 50) state = tick(state);
    state = tick(place(state, [{ x: 5, y: 5 }, { x: 3, y: 3 }]));
    expect(state.players[1].alive).toBe(false);
  });
});

describe('campaign respawns', () => {
  it('never respawns a village enemy on top of the player', () => {
    const base = campaignState('hiddenLeaf');
    const due: GameEngineState = {
      ...base,
      monsters: [],
      campaign: {
        ...base.campaign!,
        spawnPoints: base.campaign!.spawnPoints.map((point, index) => ({
          ...point,
          activeMonsterIds: [],
          ticksRemaining: index === 0 ? 1 : point.respawnMs,
        })),
      },
    };
    const gateId = due.campaign!.spawnPoints[0].id;
    const firstChoice = tick(due).monsters.find((monster) => monster.spawnPointId === gateId)!;

    const next = tick(place(due, [firstChoice]));

    expect(next.players[0].alive).toBe(true);
    expect(next.monsters.some((monster) => monster.spawnPointId === gateId)).toBe(true);
    expect(next.monsters.some((monster) => positionsTouch(monster, next.players[0]))).toBe(false);
  });

  it('waits a full respawn timer before refilling a cleared spawn point', () => {
    const base = campaignState('hiddenSand');
    const gate = base.campaign!.spawnPoints[0];
    const garrison = Array.from({ length: gate.maxActive }, (_, index) => createShinobiEnemy({
      archetype: 'sandNinja', x: 20 + index, y: 1, id: `${gate.id}-held-${index}`, spawnPointId: gate.id,
    }));
    let state: GameEngineState = {
      ...base,
      monsters: garrison,
      campaign: {
        ...base.campaign!,
        spawnPoints: base.campaign!.spawnPoints.map((point) => (
          point.id === gate.id
            ? { ...point, activeMonsterIds: garrison.map((monster) => monster.id) }
            : point
        )),
      },
    };
    const fromGate = () => state.monsters.filter((monster) => monster.spawnPointId === gate.id);
    const advance = (totalMs: number) => {
      for (let elapsed = 0; elapsed < totalMs; elapsed += 50) {
        state = tickCampaignRespawns(state, 50);
      }
    };

    advance(30000);
    state = {
      ...state,
      monsters: state.monsters.filter((monster) => monster.id !== garrison[0].id),
    };
    advance(50);
    expect(fromGate()).toHaveLength(gate.maxActive - 1);

    advance(gate.respawnMs);
    expect(fromGate()).toHaveLength(gate.maxActive);
  });
});
