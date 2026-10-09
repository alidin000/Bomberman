import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { createShinobiEnemy } from './campaignEnemies';
import { getDifficulty } from './difficulty';
import {
  CampaignObjectiveState, GameConfig, GameEngineState, MonsterState,
} from './types';
import { getCampaignWaveScript } from '../content/campaignWaves';
import { getCampaignEvent } from '../content/campaignEvents';
import { StageId } from '../content/types';
import { getWaveTelegraphCells } from './campaignWaves';

// An open 35x35 stage: every cell is floor, so spawns never fall back to
// another entry and nothing but the waves blocks or moves.
const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const TICK = 50;
const PARK = { x: 2, y: 32 };

function config(stageId: StageId, difficulty: GameConfig['difficulty'], seed = 7): GameConfig {
  return {
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: stageId,
    stageId,
    selectedCharacters: ['naruto'],
    map: openStage,
    seed,
    difficulty,
  };
}

function defense(state: GameEngineState): CampaignObjectiveState {
  return state.campaign!.objectives.find((objective) => objective.kind === 'defense')!;
}

function isWaveEnemy(state: GameEngineState, monster: MonsterState): boolean {
  return monster.id.startsWith(state.campaign!.waves!.scriptId);
}

function waveEnemies(state: GameEngineState): MonsterState[] {
  return state.monsters.filter((monster) => isWaveEnemy(state, monster));
}

/**
 * A live village with no patrols, the rescue just completed (the defense
 * starts), and the ninja parked in a far corner no wave enemy can see.
 */
function defenseStarts(stageId: StageId, difficulty: GameConfig['difficulty'], seed = 7) {
  const initial = createInitialState(config(stageId, difficulty, seed));
  let state: GameEngineState = {
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [],
    campaign: { ...initial.campaign!, spawnPoints: [] },
  };
  const rescue = state.campaign!.objectives.find((objective) => objective.kind === 'rescue')!;
  rescue.targets!.forEach((target) => {
    state = gameReducer({
      ...state,
      players: state.players.map((player) => ({ ...player, x: target.x - 0.8, y: target.y })),
    }, { type: 'MOVE', playerId: state.players[0].id, direction: 'right' })!;
  });
  expect(defense(state).status).toBe('active');
  return { ...state, players: state.players.map((player) => ({ ...player, ...PARK })) };
}

function ticks(state: GameEngineState, count: number): GameEngineState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = gameReducer(next, { type: 'TICK', deltaMs: TICK })!;
  }
  return next;
}

function elapsed(state: GameEngineState): number {
  const objective = defense(state);
  return (objective.durationMs ?? 0) - (objective.ticksRemaining ?? 0);
}

function tickTo(
  state: GameEngineState,
  ms: number,
  each?: (s: GameEngineState) => GameEngineState
) {
  let next = state;
  for (
    let guard = 0;
    guard < 4000 && elapsed(next) < ms && next.phase === 'playing' && defense(next).status === 'active';
    guard += 1
  ) {
    next = gameReducer(next, { type: 'TICK', deltaMs: TICK })!;
    if (each) next = each(next);
  }
  return next;
}

// The units a wave should bring on `difficulty`, straight from the table.
function expectedArchetypes(stageId: StageId, wave: number, d: 0 | 1 | 2): string[] {
  const script = getCampaignWaveScript(stageId)!;
  const event = getCampaignEvent(stageId);
  const effect = script.eventEffects?.find((item) => item.event === event?.id);
  const groups = [
    ...script.waves[wave].groups,
    ...(effect?.extra ?? []).filter((item) => item.wave === wave).map((item) => item.group),
  ];
  const units = groups.flatMap((group) => Array(group.count[d]).fill(group.archetype));
  const { elite } = script.waves[wave];
  if (elite && (elite.on ?? [false, true, true])[d]) units.push(elite.archetype);
  return units.sort();
}

describe('scripted defense waves', () => {
  it('marks, then sends, each wave on schedule with its scripted units', () => {
    const script = getCampaignWaveScript('hiddenLeaf')!;
    let state = defenseStarts('hiddenLeaf', 'normal');
    const waves = state.campaign!.waves!;
    const seal = defense(state);
    // The seal holds through every breather and the final hold.
    const breathers = script.waves.map((wave) => wave.breatherMs[1]);
    expect(seal.durationMs).toBe(breathers.reduce((a, b) => a + b, 0) + script.finalHoldMs[1]);
    expect(seal.structureHp).toBe(script.structureHp[1]);

    const firstDue = breathers[0];
    state = tickTo(state, firstDue - waves.telegraphMs - TICK);
    expect(state.campaign!.waves!.telegraphing).toBe(false);
    state = tickTo(state, firstDue - waves.telegraphMs);
    // The marks go up before the wave: on its entry cells.
    expect(state.campaign!.waves!.telegraphing).toBe(true);
    const marked = getWaveTelegraphCells(state.campaign!.waves);
    const entryCells = waves.waves[0].entryIds.map((id) => {
      const entry = waves.entries.find((item) => item.id === id)!;
      return { x: entry.x, y: entry.y };
    });
    expect(marked).toEqual(entryCells);

    state = tickTo(state, firstDue - TICK);
    expect(waveEnemies(state)).toHaveLength(0);
    state = tickTo(state, firstDue);
    const first = waveEnemies(state);
    expect(first.map((monster) => monster.archetype).sort()).toEqual(expectedArchetypes('hiddenLeaf', 0, 1));
    expect(state.campaign!.waves!).toMatchObject({ opened: 1, telegraphing: false, held: false });
    first.forEach((monster) => {
      // Spawned at a marked entry, leashed to the seal, and with the
      // archetype's usual sight: no extra awareness for wave enemies.
      expect(entryCells.some((cell) => (
        Math.abs(cell.x - monster.x) <= 1 && Math.abs(cell.y - monster.y) <= 1
      ))).toBe(true);
      expect(monster.leash).toEqual({ x: seal.x, y: seal.y, radius: script.leashRadius });
      const usual = createShinobiEnemy({
        archetype: monster.archetype!, x: 0, y: 0, id: 'usual', difficulty: getDifficulty('normal'),
      });
      expect(monster.detectionRange).toBe(usual.detectionRange);
    });

    // The next wave keeps its breather after this one, with the village
    // event's straggler on the last wave.
    const secondDue = firstDue + breathers[1];
    state = tickTo(state, secondDue - TICK);
    expect(state.campaign!.waves!.opened).toBe(1);
    state = tickTo(state, secondDue);
    expect(state.campaign!.waves!.opened).toBe(2);
    // Stopped before the last wave, so the cap leaves it room.
    const stopped = state;
    state = {
      ...state,
      monsters: state.monsters.filter((monster) => !isWaveEnemy(stopped, monster)),
    };
    state = tickTo(state, secondDue + breathers[2]);
    expect(state.campaign!.waves!.opened).toBe(3);
    const lastIds = state.campaign!.waves!.activeMonsterIds.filter((id) => id.includes('-w3-'));
    const last = state.monsters.filter((monster) => lastIds.includes(monster.id));
    expect(last.map((monster) => monster.archetype).sort()).toEqual(expectedArchetypes('hiddenLeaf', 2, 1));
    expect(last.map((monster) => monster.archetype)).toContain('whiteZetsu');
    expect(last.find((monster) => monster.elite)?.name).toBe('Gate Breaker');
  });

  it('scales the waves by difficulty: Story drops captains and extra squads', () => {
    const story = defenseStarts('hiddenMist', 'story').campaign!.waves!;
    const normal = defenseStarts('hiddenMist', 'normal').campaign!.waves!;
    const hard = defenseStarts('hiddenMist', 'hard').campaign!.waves!;
    [story, normal, hard].forEach((waves, d) => {
      waves.waves.forEach((wave, index) => {
        expect(wave.units.map((unit) => unit.archetype).sort())
          .toEqual(expectedArchetypes('hiddenMist', index, d as 0 | 1 | 2));
      });
    });
    expect(story.waves.some((wave) => wave.units.some((unit) => unit.eliteLabel))).toBe(false);
    expect(normal.waves.some((wave) => wave.units.some((unit) => unit.eliteLabel))).toBe(true);
    expect(story.maxActive).toBeLessThanOrEqual(normal.maxActive);
    expect(normal.maxActive).toBeLessThanOrEqual(hard.maxActive);
    // Dense Fog cuts sight, so its marks show earlier than the base lead.
    const script = getCampaignWaveScript('hiddenMist')!;
    expect(normal.telegraphMs).toBeGreaterThan(script.telegraphMs[1]);
    // The alert bells' straggler skips Story, and so does its note.
    const leafStory = defenseStarts('hiddenLeaf', 'story').campaign!.waves!;
    const leafNormal = defenseStarts('hiddenLeaf', 'normal').campaign!.waves!;
    expect(leafStory.eventNote).toBeUndefined();
    expect(leafNormal.eventNote).toMatch(/straggler/);
  });

  it('holds a due wave until enough wave enemies are down, then sends it', () => {
    const script = getCampaignWaveScript('hiddenLeaf')!;
    const breathers = script.waves.map((wave) => wave.breatherMs[1]);
    let state = tickTo(defenseStarts('hiddenLeaf', 'normal'), breathers[0]);
    // The first wave wanders far from the seal, unleashed, and stays alive.
    state = {
      ...state,
      monsters: state.monsters.map((monster, index) => (
        isWaveEnemy(state, monster) ? {
          ...monster, x: 30 - index, y: 2, leash: undefined
        } : monster
      )),
    };
    const alive = waveEnemies(state).length;
    const second = state.campaign!.waves!.waves[1].units.length;
    // Room for the second wave only once one of the first is down.
    state = {
      ...state,
      campaign: {
        ...state.campaign!,
        waves: { ...state.campaign!.waves!, maxActive: alive + second - 1 },
      },
    };

    const due = breathers[0] + breathers[1];
    state = tickTo(state, due + 3000);
    expect(state.campaign!.waves!).toMatchObject({ opened: 1, held: true, telegraphing: true });
    expect(waveEnemies(state)).toHaveLength(alive);

    // One down: the wave arrives on the next tick.
    const downed = waveEnemies(state)[0].id;
    state = { ...state, monsters: state.monsters.filter((monster) => monster.id !== downed) };
    const arrivedAt = elapsed(state) + TICK;
    state = gameReducer(state, { type: 'TICK', deltaMs: TICK })!;
    expect(state.campaign!.waves!).toMatchObject({ opened: 2, held: false });
    expect(waveEnemies(state)).toHaveLength(alive - 1 + second);
    // The breather after a held wave counts from its arrival.
    expect(state.campaign!.waves!.dueAtMs)
      .toBe(Math.ceil(arrivedAt / 1000) * 1000 + breathers[2]);
  });

  it('completes the seal when every wave is stopped and releases the survivors', () => {
    const structure = defense(defenseStarts('hiddenLeaf', 'normal'));
    const seal = { x: structure.x!, y: structure.y! };
    let spared: string | null = null;
    // A defender who stops every attacker before it gets close, except one
    // of the last wave, sent off to the far side of the village.
    const stopEveryone = (state: GameEngineState): GameEngineState => {
      const waves = state.campaign!.waves!;
      if (!spared && waves.opened === waves.waves.length) {
        [spared] = waves.activeMonsterIds;
      }
      return {
        ...state,
        monsters: state.monsters.flatMap((monster) => {
          if (!isWaveEnemy(state, monster)) return [monster];
          if (monster.id === spared) {
            return [{
              ...monster, x: 32, y: 2, leash: undefined
            }];
          }
          return Math.abs(monster.x - seal.x) + Math.abs(monster.y - seal.y) <= 4 ? [] : [monster];
        }),
      };
    };
    let state = tickTo(defenseStarts('hiddenLeaf', 'normal'), Infinity, stopEveryone);
    const waves = state.campaign!.waves!;
    expect(defense(state)).toMatchObject({ status: 'complete', structureHp: structure.structureMaxHp });
    expect(waves).toMatchObject({
      finished: true, opened: waves.waves.length, activeMonsterIds: [],
    });
    expect(state.campaign!.missionResult).toBe('in_progress');
    // The chain moves on to the route puzzle; the gate waits for it.
    const statusOf = (kind: string) => state.campaign!.objectives
      .find((objective) => objective.kind === kind)!.status;
    expect(statusOf('puzzle')).toBe('active');
    expect(statusOf('miniBoss')).toBe('locked');
    // The survivor patrols on as an ordinary enemy.
    expect(state.monsters.find((monster) => monster.id === spared)?.leash).toBeUndefined();
    const count = waveEnemies(state).length;
    for (let step = 0; step < 400; step += 1) state = gameReducer(state, { type: 'TICK', deltaMs: TICK })!;
    expect(waveEnemies(state).length).toBeLessThanOrEqual(count);
    expect(state.campaign!.waves!.opened).toBe(waves.waves.length);
  });

  it('fails the mission when attackers break the last-life seal; each breach costs one hit', () => {
    const script = getCampaignWaveScript('hiddenLeaf')!;
    let state = tickTo(defenseStarts('hiddenLeaf', 'hard'), script.waves[0].breatherMs[2]);
    const seal = defense(state);
    const hit = 50 + (state.campaign!.event?.structureDamageBonus ?? 0);
    // Two hits from falling, on the last life.
    state = {
      ...state,
      campaign: {
        ...state.campaign!,
        objectives: state.campaign!.objectives.map((objective) => (
          objective.kind === 'defense' ? { ...objective, structureHp: hit * 2 } : objective
        )),
      },
    };
    // An attacker that reaches the seal and would stand on it.
    const reach = (next: GameEngineState): GameEngineState => {
      const [attacker] = waveEnemies(next);
      return {
        ...next,
        monsters: next.monsters.map((monster) => (monster === attacker
          ? {
            ...monster, x: seal.x!, y: seal.y!, moveCooldown: 60000, abilityCooldown: 60000,
          }
          : monster)),
      };
    };
    state = reach(state);
    const breacher = waveEnemies(state)[0].id;
    state = ticks(state, 40);
    // One hit, not one every 650 ms: the attacker is spent on the seal.
    expect(defense(state).structureHp).toBe(hit);
    expect(state.monsters.some((monster) => monster.id === breacher)).toBe(false);
    expect(state.phase).toBe('playing');

    state = tickTo(state, script.waves[0].breatherMs[2] + script.waves[1].breatherMs[2]);
    state = ticks(reach(state), 2);
    expect(defense(state).status).toBe('failed');
    expect(state.campaign!.missionResult).toBe('failed');
    expect(state.phase).toBe('game_over');
  });

  it('restarts the waves with the seal when a life is spent', () => {
    let state = defenseStarts('hiddenLeaf', 'normal');
    state = {
      ...state,
      campaign: {
        ...state.campaign!,
        objectives: state.campaign!.objectives.map((objective) => (
          objective.kind === 'defense' ? { ...objective, structureHp: 1 } : objective
        )),
      },
    };
    const lives = state.campaign!.livesRemaining!;
    for (let guard = 0; guard < 1600 && state.campaign!.livesRemaining === lives; guard += 1) {
      state = gameReducer(state, { type: 'TICK', deltaMs: TICK })!;
    }
    expect(state.campaign!.livesRemaining).toBe(lives - 1);
    expect(defense(state)).toMatchObject({
      status: 'active', structureHp: defense(state).structureMaxHp, current: 0,
    });
    // The attackers withdraw and the script starts over.
    expect(waveEnemies(state)).toHaveLength(0);
    expect(state.campaign!.waves!).toMatchObject({ opened: 0, run: 1, activeMonsterIds: [] });
    state = tickTo(state, state.campaign!.waves!.waves[0].breatherMs);
    expect(waveEnemies(state).length).toBe(state.campaign!.waves!.waves[0].units.length);
    expect(waveEnemies(state).every((monster) => monster.id.includes('-r1-'))).toBe(true);
  });

  it('plays the same waves from the same seed', () => {
    const run = (seed: number) => {
      const log: string[] = [];
      let state = defenseStarts('greatShinobiWar', 'normal', seed);
      const seal = defense(state);
      state = tickTo(state, Infinity, (next) => {
        next.monsters.forEach((monster) => {
          if (isWaveEnemy(next, monster) && !log.some((line) => line.startsWith(`${monster.id} `))) {
            log.push(`${monster.id} ${monster.archetype} ${monster.x},${monster.y} @${elapsed(next)}`);
          }
        });
        // Stop attackers near the seal so the whole script plays.
        return {
          ...next,
          monsters: next.monsters.filter((monster) => !isWaveEnemy(next, monster)
            || Math.abs(monster.x - seal.x!) + Math.abs(monster.y - seal.y!) > 3),
        };
      });
      return { log, waves: state.campaign!.waves! };
    };
    const a = run(1234);
    const b = run(1234);
    expect(a.log.length).toBeGreaterThan(5);
    expect(b.log).toEqual(a.log);
    expect(b.waves.waves).toEqual(a.waves.waves);
    // The seed picks entries among each group's options.
    const entries = (seed: number) => defenseStarts('greatShinobiWar', 'normal', seed)
      .campaign!.waves!.waves.map((wave) => wave.units.map((unit) => unit.entryId).join(','))
      .join('|');
    const seen = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(entries));
    expect(seen.size).toBeGreaterThan(1);
  });
});
