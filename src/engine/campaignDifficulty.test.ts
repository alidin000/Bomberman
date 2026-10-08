import { readFileSync } from 'node:fs';
import { gameReducer } from './reducer';
import { createBossForConfig, createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { createShinobiEnemy } from './campaignEnemies';
import { positionsTouch } from './grid';
import {
  GameConfig, GameEngineState, MonsterState, Point,
} from './types';
import { DifficultyId } from './difficulty';
import { StageId } from '../content/types';
import { CAMPAIGN_MISSIONS } from '../content/campaignMissions';
import { cellKey } from './fogOfWar';

function stageMap(stageId: StageId) {
  return parseMapRows(readFileSync(`public/maps/${stageId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
}

function campaignState(stageId: StageId, difficulty?: DifficultyId): GameEngineState {
  return {
    ...createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: stageId,
      stageId,
      selectedCharacters: ['deidara'],
      map: stageMap(stageId),
      difficulty,
    }),
    roundStartTicksRemaining: 0,
  };
}

function arenaState(rows: string[]): GameEngineState {
  const map = parseMapRows(rows.map((row) => row.split('')));
  const config: GameConfig = {
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'rules-test',
    map,
    selectedCharacters: ['deidara', 'naruto'],
  };
  return {
    ...createInitialState(config), map, roundStartTicksRemaining: 0, monsters: [],
  };
}

const OPEN_ROOM = [
  'WWWWWWWWW',
  'W       W',
  'W       W',
  'W       W',
  'W       W',
  'W       W',
  'WWWWWWWWW',
];

function tick(state: GameEngineState, deltaMs = 50): GameEngineState {
  return gameReducer(state, { type: 'TICK', deltaMs })!;
}

function placePlayer(state: GameEngineState, x: number, y: number): GameEngineState {
  return {
    ...state,
    players: state.players.map((player, index) => (index === 0 ? { ...player, x, y } : player)),
  };
}

function kill(state: GameEngineState, reason = 'Deidara was caught by ANBU.'): GameEngineState {
  return {
    ...state,
    players: state.players.map((player) => ({ ...player, alive: false, deathReason: reason })),
  };
}

describe('body flicker', () => {
  it('lands on its warned cell and gives a standing player time to react', () => {
    let state = arenaState(OPEN_ROOM);
    state = {
      ...state,
      players: state.players.map((player, index) => (
        index === 0 ? { ...player, x: 3, y: 3 } : { ...player, x: 7, y: 5 }
      )),
    };
    const anbu: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'anbu', x: 6, y: 1, id: 'anbu',
      }),
      // The move timer ran out during the long warning, as it does in play.
      moveCooldown: -400,
      abilityWarningTicks: 1,
      abilityTarget: { x: 4, y: 3 },
    };
    state = { ...state, monsters: [anbu] };

    state = tick(state);
    expect(state.monsters[0]).toMatchObject({ x: 4, y: 3 });
    // A human needs ~0.3-0.4 s to react to the landing: no contact before it.
    for (let elapsed = 50; elapsed < 600; elapsed += 50) {
      expect(state.players[0].alive).toBe(true);
      expect(positionsTouch(state.monsters[0], state.players[0])).toBe(false);
      state = tick(state);
    }
  });
});

describe('campaign difficulty', () => {
  it('defaults the campaign to Normal and keeps versus on the original numbers', () => {
    const normal = campaignState('hiddenLeaf');
    expect(normal.campaign).toMatchObject({ difficulty: 'normal', livesRemaining: 3 });

    const versus = (difficulty?: DifficultyId) => createInitialState({
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'hiddenSand',
      stageId: 'hiddenSand',
      map: stageMap('hiddenSand'),
      difficulty,
    });
    expect(versus('story').monsters).toEqual(versus().monsters);
    expect(versus('story').campaign).toBeNull();
  });

  it('scales enemies, respawns and boss health from Story to Hard', () => {
    const story = campaignState('hiddenSand', 'story');
    const normal = campaignState('hiddenSand', 'normal');
    const hard = campaignState('hiddenSand', 'hard');

    const gate = (state: GameEngineState) => state.campaign!.spawnPoints[0];
    expect(gate(story).respawnMs).toBeGreaterThan(gate(normal).respawnMs);
    expect(gate(normal).respawnMs).toBeGreaterThan(gate(hard).respawnMs);
    expect(gate(story).maxActive).toBeLessThan(gate(hard).maxActive);

    const firstEnemy = (state: GameEngineState) => state.monsters[0];
    expect(firstEnemy(story).detectionRange!).toBeLessThan(firstEnemy(hard).detectionRange!);
    expect(firstEnemy(story).moveCooldown).toBeGreaterThan(firstEnemy(hard).moveCooldown);

    const bossHealth = (state: GameEngineState) => createBossForConfig(state.config)!.maxHealth;
    expect(bossHealth(story)).toBeLessThan(bossHealth(normal));
    expect(bossHealth(normal)).toBeLessThan(bossHealth(hard));
    expect(bossHealth(hard)).toBe(580);
    expect(story.campaign!.livesRemaining).toBe(5);
    expect(hard.campaign!.livesRemaining).toBe(1);
  });

  it('keeps enemies hidden in the fog from striking below Hard', () => {
    const fogged = (difficulty: DifficultyId) => {
      const base = placePlayer(campaignState('hiddenLeaf', difficulty), 1, 1);
      // Within detection range, but outside Deidara's 3-cell sight.
      const genin: MonsterState = {
        ...createShinobiEnemy({
          archetype: 'rogueGenin', x: 5, y: 1, id: 'genin',
        }),
        detectionRange: 8,
        abilityCooldown: 0,
        moveCooldown: 60000,
      };
      const ready = { ...base, monsters: [genin] };
      return tick(ready).monsters[0];
    };

    expect(fogged('normal').abilityTarget ?? null).toBeNull();
    expect(fogged('story').abilityTarget ?? null).toBeNull();
    expect(fogged('hard').abilityTarget).toEqual({ x: 1, y: 1 });
  });
});

describe('campaign lives', () => {
  it('regroups a fallen player at the last cleared objective while lives remain', () => {
    let state = campaignState('hiddenLeaf', 'normal');
    const rescue = state.campaign!.objectives[0];
    rescue.targets!.forEach((target) => {
      state = tick(placePlayer(state, target.x, target.y), 0);
    });
    expect(state.campaign!.objectives[0].status).toBe('complete');
    state = { ...state, monsters: [] };

    state = tick(kill(placePlayer(state, 30, 30)));

    expect(state.phase).toBe('playing');
    expect(state.players[0].alive).toBe(true);
    expect(state.campaign!.livesRemaining).toBe(2);
    expect(state.campaign!.objectives[0].status).toBe('complete');
    const lastRescued = rescue.targets![rescue.targets!.length - 1];
    expect(Math.abs(state.players[0].x - lastRescued.x)
      + Math.abs(state.players[0].y - lastRescued.y)).toBeLessThanOrEqual(2);
    expect(state.campaign!.message).toContain('2 lives left');
    // Shielded for a moment, so a threat at the checkpoint cannot chain-kill.
    expect(state.players[0].survivalGraceMs).toBeGreaterThan(0);
  });

  it('ends the mission when the last life is lost, as before', () => {
    let state = campaignState('hiddenLeaf', 'hard');
    state = tick(kill(state));
    expect(state.phase).toBe('game_over');
    expect(state.resultMessage).toContain('Deidara was caught by ANBU.');

    let normal = campaignState('hiddenLeaf', 'normal');
    normal = tick(kill(normal));
    normal = tick(kill(normal));
    expect(normal.phase).toBe('playing');
    normal = tick(kill(normal));
    expect(normal.phase).toBe('game_over');
  });

  it('restarts a fallen structure seal for a life instead of failing the mission', () => {
    let state: GameEngineState = { ...campaignState('hiddenSand', 'normal'), monsters: [] };
    state.campaign!.objectives[0].targets!.forEach((target) => {
      state = tick(placePlayer(state, target.x, target.y), 0);
    });
    const defense = () => state.campaign!.objectives.find((item) => item.kind === 'defense')!;
    expect(defense().status).toBe('active');
    const { x, y } = defense();
    const raider: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'rogueGenin', x: x!, y: y!, id: 'raider',
      }),
      moveCooldown: 60000,
      abilityCooldown: 60000,
    };
    state = placePlayer({ ...state, monsters: [raider] }, 1, 1);
    for (let elapsed = 0; elapsed < 1500; elapsed += 50) state = tick(state);

    expect(state.phase).toBe('playing');
    expect(state.campaign!.missionResult).toBe('in_progress');
    expect(state.campaign!.livesRemaining).toBe(2);
    expect(defense()).toMatchObject({ status: 'active' });
    expect(state.campaign!.message).toContain('fell');
  });
});

// A reachable open cell at least `minSteps` cells (Manhattan) from `from`.
function farOpenCell(state: GameEngineState, from: Point, minSteps: number): Point {
  const queue: Point[] = [from];
  const steps = new Map([[cellKey(from.x, from.y), 0]]);
  const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  for (let index = 0; index < queue.length; index += 1) {
    const point = queue[index];
    const distance = steps.get(cellKey(point.x, point.y))!;
    if (Math.abs(point.x - from.x) + Math.abs(point.y - from.y) >= minSteps) return point;
    for (let step = 0; step < offsets.length; step += 1) {
      const next = { x: point.x + offsets[step][0], y: point.y + offsets[step][1] };
      const key = cellKey(next.x, next.y);
      if (!steps.has(key) && state.map[next.y]?.[next.x] === 'Empty') {
        steps.set(key, distance + 1);
        queue.push(next);
      }
    }
  }
  throw new Error('no far cell');
}

describe('campaign difficulty curve', () => {
  it('opens gently and saves the most pressure for the finale', () => {
    const [first, ...rest] = CAMPAIGN_MISSIONS;
    const last = CAMPAIGN_MISSIONS[CAMPAIGN_MISSIONS.length - 1];
    const archetypes = first.spawnPoints.flatMap((point) => point.archetypes);
    // No smart chasers or elites in the first village.
    expect(archetypes).not.toEqual(expect.arrayContaining(['sandNinja']));
    expect(archetypes).not.toEqual(expect.arrayContaining(['cloudNinja']));
    expect(archetypes).not.toEqual(expect.arrayContaining(['blackZetsu']));

    const respawn = (mission: typeof first) => mission.spawnPoints[0].respawnMs;
    const cap = (mission: typeof first) => mission.spawnPoints
      .reduce((sum, point) => sum + point.maxActive, 0);
    rest.forEach((mission) => {
      expect(respawn(mission)).toBeLessThan(respawn(first));
      expect(respawn(mission)).toBeGreaterThanOrEqual(respawn(last));
      expect(cap(mission)).toBeLessThanOrEqual(cap(last));
    });
  });

  it('keeps a sandstorm from cutting sight below three cells on Normal', () => {
    const sight = (difficulty: DifficultyId) => createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenSand',
      stageId: 'hiddenSand',
      selectedCharacters: ['naruto'],
      map: stageMap('hiddenSand'),
      difficulty,
    }).fogOfWar.visible;

    expect(sight('normal')).toContain(cellKey(4, 1));
    expect(sight('hard')).not.toContain(cellKey(4, 1));
  });

  it('keeps an unprovoked mini boss near its gate instead of roaming the map', () => {
    const base = placePlayer(campaignState('hiddenLeaf', 'normal'), 1, 1);
    const gate = { x: 29, y: 29 };
    const start = farOpenCell(base, gate, 8);
    const guard: MonsterState = {
      ...createShinobiEnemy({
        archetype: 'anbu', x: start.x, y: start.y, id: 'confrontIruka-guard',
      }),
      elite: true,
      leash: { ...gate, radius: 4 },
    };
    let state: GameEngineState = { ...base, monsters: [guard] };
    const gateDistance = () => {
      const { x, y } = state.monsters.find((monster) => monster.id === guard.id)!;
      return Math.abs(x - gate.x) + Math.abs(y - gate.y);
    };
    let farthestLate = 0;
    for (let elapsed = 0; elapsed < 30000; elapsed += 50) {
      state = tick({ ...state, players: base.players });
      if (elapsed >= 15000) farthestLate = Math.max(farthestLate, gateDistance());
    }

    // Back home within 15 s; after that one random step past the leash at most.
    expect(farthestLate).toBeLessThanOrEqual(5);
  });
});
