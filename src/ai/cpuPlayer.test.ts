/* eslint-disable no-param-reassign */
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';
import { parseMapRows } from '../engine/mapLoader';
import { createBomb } from '../engine/bombs';
import { FLAME_HURT_RADIUS, positionOverlapsCell } from '../engine/grid';
import { GameAction } from '../engine/actions';
import { GameConfig, GameEngineState, PlayerSlotController } from '../engine/types';
import { CharacterId } from '../content/types';
import {
  EngineLoop,
  advanceEngineFrame,
  applyEngineAction,
  createEngineLoop,
  getMoveRepeatMs,
} from '../hooks/engineLoop';
import { replayActions } from '../network/replay';
import { thinkCpuPlayer } from './cpuPlayer';

// Every reducer call the loop makes, so a CPU match can be replayed from
// its actions alone.
const recorder = vi.hoisted(() => ({ on: false, actions: [] as unknown[] }));
vi.mock('../engine/reducer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/reducer')>();
  return {
    ...actual,
    gameReducer: (...args: Parameters<typeof actual.gameReducer>) => {
      if (recorder.on) recorder.actions.push(args[1]);
      return actual.gameReducer(...args);
    },
  };
});

const FRAME_MS = 1000 / 60;

function arena(rows: string[]) {
  return parseMapRows(rows.map((row) => row.split('')));
}

function stageMap(mapId: string) {
  return parseMapRows(readFileSync(`public/maps/${mapId}.txt`, 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split('')));
}

function versus(
  map: GameConfig['map'],
  controllers: PlayerSlotController[] | undefined,
  characters: CharacterId[] = ['sasuke', 'naruto'],
  seed = 7,
  selectedMap = 'cpu-test'
): GameConfig {
  return {
    mode: 'local',
    numPlayers: characters.length,
    totalRounds: 1,
    selectedMap,
    map,
    selectedCharacters: characters,
    seed,
    controllers,
  };
}

function startLoop(config: GameConfig): EngineLoop {
  const loop = createEngineLoop();
  applyEngineAction(loop, { type: 'INIT', config });
  while (loop.state!.roundStartTicksRemaining > 0) advanceEngineFrame(loop, FRAME_MS);
  return loop;
}

function run(loop: EngineLoop, ms: number, onFrame?: (state: GameEngineState) => void) {
  for (let t = 0; t < ms && loop.state!.phase === 'playing'; t += FRAME_MS) {
    advanceEngineFrame(loop, FRAME_MS);
    onFrame?.(loop.state!);
  }
}

const OPEN = [
  'WWWWWWWWWWWWWWW',
  'W  B          W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
];

describe('CPU players', () => {
  it.each([
    ['sasuke', 'cpu-normal'],
    ['naruto', 'cpu-normal'],
    ['deidara', 'cpu-hard'],
    ['gaara', 'cpu-hard'],
    ['minato', 'cpu-hard'],
    ['itachi', 'cpu-normal'],
  ] as [CharacterId, PlayerSlotController][])(
    'as %s (%s) bombs a crate and escapes its own blast',
    (character, level) => {
      const loop = startLoop(versus(arena(OPEN), [level, 'human'], [character, 'naruto']));
      let ownBombs = 0;
      let ownFlames = 0;
      const seen = new Set<string>();
      run(loop, 8000, (state) => {
        state.bombs.forEach((bomb) => {
          if (bomb.ownerId === 'player1' && !seen.has(bomb.id)) {
            seen.add(bomb.id);
            ownBombs += 1;
          }
        });
        if (state.explosions.some((flame) => flame.ownerId === 'player1')) ownFlames += 1;
      });
      expect(ownBombs).toBeGreaterThan(0);
      expect(ownFlames).toBeGreaterThan(0);
      expect(loop.state!.map[1][3]).not.toBe('Box');
      expect(loop.state!.players[0]).toMatchObject({ alive: true });
    }
  );

  it('waits for a blast ray to burn out instead of walking into it', () => {
    // A corridor along row 1; the only way to the human (bottom right)
    // crosses (5,1), which a bomb in the niche below is about to burn.
    const map = arena([
      'WWWWWWWWWWWWWWW',
      'W             W',
      'WWWW WWWWWWWW W',
      'WWWW WWWWWWWW W',
      'WWWWWWWWWWWWW W',
      'WWWWWWWWWWWWW W',
      'WWWWWWWWWWWWW W',
      'WWWWWWWWWWWWW W',
      'WWWWWWWWWWWWW W',
      'WWWWWWWWWWWWWWW',
    ]);
    const loop = startLoop(versus(map, ['cpu-normal', 'human']));
    const bomb = createBomb('player2', 5, 3, 2, false, 'standard', 1200);
    const nextMap = loop.state!.map.map((row) => [...row]);
    nextMap[3][5] = { range: 2, coords: { x: 5, y: 3 }, ownerId: 'player2' };
    loop.state = { ...loop.state!, map: nextMap, bombs: [bomb] };

    let burned = 0;
    let lit = 0;
    run(loop, 6000, (state) => {
      const cpu = state.players[0];
      if (state.explosions.length > 0) lit += 1;
      if (state.explosions.some((flame) => (
        positionOverlapsCell(cpu, flame.x, flame.y, FLAME_HURT_RADIUS)
      ))) burned += 1;
    });
    const cpu = loop.state!.players[0];
    expect(lit).toBeGreaterThan(0);
    expect(burned).toBe(0);
    expect(cpu.alive).toBe(true);
    // It did not just freeze: once the flame was gone it went on.
    expect(cpu.x).toBeGreaterThan(6);
  });

  it('plays the same match from the same seed, and replays from its actions', () => {
    const config = versus(stageMap('hiddenLeaf'), ['cpu-hard', 'cpu-normal'], ['deidara', 'gaara'], 4242, 'hiddenLeaf');
    const first = startLoop(config);
    run(first, 20000);
    const second = startLoop(config);
    run(second, 20000);
    expect(second.state).toEqual(first.state);

    recorder.actions = [];
    recorder.on = true;
    const recorded = startLoop(config);
    run(recorded, 20000);
    recorder.on = false;
    const actions = recorder.actions as GameAction[];
    // The CPUs really played: they moved and dropped bombs as ordinary actions.
    expect(actions.some((action) => action.type === 'DROP_BOMB' && action.playerId === 'player1')).toBe(true);
    expect(actions.some((action) => action.type === 'MOVE' && action.playerId === 'player2')).toBe(true);
    const [init, ...frames] = actions;
    const replayed = replayActions(init, frames.map((action, tick) => ({ tick, action })));
    expect(replayed).toEqual(recorded.state);
    expect(recorded.state).toEqual(first.state);
  });

  it('makes Easy measurably weaker than Hard', () => {
    const maps = ['hiddenLeaf', 'hiddenSand', 'hiddenMist', 'hiddenCloud', 'hiddenStone', 'akatsukiHideout'];
    let hardWins = 0;
    let easyWins = 0;
    let hardDeaths = 0;
    let easyDeaths = 0;
    maps.forEach((mapId, index) => {
      [0, 1].forEach((swap) => {
        const controllers: PlayerSlotController[] = swap ? ['cpu-easy', 'cpu-hard'] : ['cpu-hard', 'cpu-easy'];
        const loop = startLoop(versus(stageMap(mapId), controllers, ['naruto', 'sasuke'], 300 + index * 11 + swap, mapId));
        run(loop, 90000);
        loop.state!.players.forEach((player, slot) => {
          const hard = controllers[slot] === 'cpu-hard';
          if (!player.alive) {
            if (hard) hardDeaths += 1; else easyDeaths += 1;
          } else if (loop.state!.players.filter((p) => p.alive).length === 1) {
            if (hard) hardWins += 1; else easyWins += 1;
          }
        });
      });
    });
    expect(hardWins).toBeGreaterThan(easyWins);
    expect(easyDeaths).toBeGreaterThan(hardDeaths);
  });

  it('keeps playing in the next round of a best-of match', () => {
    const loop = startLoop({ ...versus(arena(OPEN), ['human', 'cpu-normal']), totalRounds: 3 });
    // Player 1 falls, so the CPU takes round one; a best of 3 goes on.
    loop.state = {
      ...loop.state!,
      players: loop.state!.players.map((p, slot) => (slot === 0 ? { ...p, alive: false } : p)),
    };
    run(loop, 1000);
    expect(loop.state).toMatchObject({ phase: 'round_end', round: 1, roundWinners: ['player2'] });

    applyEngineAction(loop, { type: 'DISMISS_DIALOG' });
    while (loop.state!.roundStartTicksRemaining > 0) advanceEngineFrame(loop, FRAME_MS);
    expect(loop.state).toMatchObject({ phase: 'playing', round: 2 });
    const human = { x: loop.state!.players[0].x, y: loop.state!.players[0].y };
    const cpu = { x: loop.state!.players[1].x, y: loop.state!.players[1].y };
    run(loop, 3000);

    expect(loop.state!.players[0]).toMatchObject(human);
    expect(loop.state!.players[1]).not.toMatchObject(cpu);
  });

  it('leaves a config without controllers exactly as before: all human, no CPU', () => {
    const holdRight = (loop: EngineLoop) => {
      applyEngineAction(loop, { type: 'MOVE', playerId: 'player1', direction: 'right' });
      loop.activeMovement.player1 = { accumulatorMs: 0, direction: 'right', key: 'd' };
    };
    const legacy = startLoop(versus(arena(OPEN), undefined));
    const humans = startLoop(versus(arena(OPEN), ['human', 'human']));
    holdRight(legacy);
    holdRight(humans);
    run(legacy, 3000);
    run(humans, 3000);
    expect(legacy.cpu ?? null).toBeNull();
    expect(humans.cpu ?? null).toBeNull();
    expect(humans.state).toEqual({
      ...legacy.state,
      config: { ...legacy.state!.config, controllers: ['human', 'human'] },
    });
    // Player 2 never moved on its own.
    expect(legacy.state!.players[1]).toMatchObject({ x: 13, y: 8 });
  });
});

describe('CPU decision cost', () => {
  it('thinks well under a millisecond on a 35x35 stage with two CPUs', () => {
    const config = versus(stageMap('hiddenLeaf'), ['human', 'cpu-hard', 'cpu-hard'], ['naruto', 'deidara', 'sasuke'], 99, 'hiddenLeaf');
    const loop = startLoop(config);
    run(loop, 15000);
    const state = loop.state!;
    const squad = loop.cpu!;
    const samples: number[] = [];
    for (let round = 0; round < 400; round += 1) {
      squad.brains.forEach((brain) => {
        if (!state.players[brain.slot].alive) return;
        brain.rethink = true;
        const t0 = performance.now();
        thinkCpuPlayer(squad, brain, state, getMoveRepeatMs);
        samples.push(performance.now() - t0);
      });
    }
    samples.sort((a, b) => a - b);
    const mean = samples.reduce((sum, ms) => sum + ms, 0) / samples.length;
    expect(samples.length).toBeGreaterThan(0);
    expect(mean).toBeLessThan(1);
    expect(samples[Math.floor(samples.length / 2)]).toBeLessThan(0.5);
  });
});
