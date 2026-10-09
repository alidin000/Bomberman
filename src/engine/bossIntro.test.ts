import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { parseMapRows } from './mapLoader';
import { BOSS_INTRO_MS, BOSS_INTRO_SKIP_LOCK_MS, TICK_MS } from './constants';
import { GameAction } from './actions';
import { GameConfig, GameEngineState } from './types';
import {
  exportReplay, importReplay, recordReplay, replayActions,
} from '../network/replay';

// The boss arena's entrance: once the last objective falls and the boss
// appears, the arena freezes for BOSS_INTRO_MS like the round countdown, a
// player may skip it, and it plays once per attempt.

const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const config: GameConfig = {
  mode: 'solo',
  numPlayers: 1,
  totalRounds: 1,
  selectedMap: 'hiddenLeaf',
  stageId: 'hiddenLeaf',
  selectedCharacters: ['naruto'],
  map: openStage,
  seed: 7,
  difficulty: 'story',
};

const reduce = (state: GameEngineState, action: GameAction) => (
  gameReducer(state, action) as GameEngineState
);
const tick = (state: GameEngineState, deltaMs = TICK_MS) => reduce(state, { type: 'TICK', deltaMs });

/** Past the countdown, no wandering enemies, the player a few cells from the centre. */
function liveMission(): GameEngineState {
  const state = createInitialState(config);
  return {
    ...state,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: state.players.map((player) => ({ ...player, x: 12, y: 17 })),
  };
}

/** Every objective cleared: the next step opens the arena and the boss appears. */
function clearObjectives(state: GameEngineState): GameEngineState {
  const campaign = state.campaign!;
  return {
    ...state,
    campaign: {
      ...campaign,
      objectives: campaign.objectives.map((objective) => ({ ...objective, status: 'complete' })),
    },
  };
}

function openArena(state: GameEngineState): GameEngineState {
  const opened = tick(clearObjectives(state));
  expect(opened.boss).not.toBeNull();
  return opened;
}

describe('boss intro freeze', () => {
  it('freezes the whole arena while the boss makes its entrance, then plays on', () => {
    const mission = liveMission();
    let state = reduce(mission, { type: 'DROP_BOMB', playerId: mission.players[0].id });
    expect(state.bombs.length).toBeGreaterThan(0);
    state = openArena(state);
    expect(state.campaign?.missionStep).toBe('boss');
    expect(state.bossIntroMsRemaining).toBe(BOSS_INTRO_MS);

    const frozen = state;
    const playerId = frozen.players[0].id;
    // No input lands: not a step, a bomb, an ultimate or cover.
    expect(reduce(frozen, { type: 'MOVE', playerId, direction: 'right' })).toBe(frozen);
    expect(reduce(frozen, { type: 'DROP_BOMB', playerId })).toBe(frozen);
    expect(reduce(frozen, { type: 'USE_ULTIMATE', playerId })).toBe(frozen);
    expect(reduce(frozen, { type: 'PLACE_OBSTACLE', playerId })).toBe(frozen);

    // Nothing ticks: the fuse, the boss's cooldowns, the tick counter.
    for (let elapsed = TICK_MS; elapsed < BOSS_INTRO_MS; elapsed += TICK_MS) {
      state = tick(state);
    }
    expect(state.bossIntroMsRemaining).toBe(TICK_MS);
    expect(state.tick).toBe(frozen.tick);
    expect(state.bombs).toEqual(frozen.bombs);
    expect(state.boss).toEqual(frozen.boss);
    expect(state.hazards).toEqual(frozen.hazards);
    expect(state.players).toEqual(frozen.players);

    // The last frozen tick ends it; the next one runs the arena again.
    state = tick(state);
    expect(state.bossIntroMsRemaining).toBe(0);
    state = tick(state);
    expect(state.tick).toBe(frozen.tick + 1);
    expect(state.bombs[0].ticksRemaining).toBeLessThan(frozen.bombs[0].ticksRemaining);
    expect(state.boss?.attackCooldown).toBeLessThan(frozen.boss!.attackCooldown);
    const moved = reduce(state, { type: 'MOVE', playerId, direction: 'right' });
    expect(moved.players[0].x).toBeGreaterThan(state.players[0].x);
  });

  it('can be skipped, and the skip is a recorded action that replays the same', () => {
    const before = clearObjectives(liveMission());
    let state = tick(before);
    const playerId = state.players[0].id;

    // A bomb mashed as the arena opens does not skip what nobody has seen yet.
    expect(reduce(state, { type: 'SKIP_BOSS_INTRO' })).toBe(state);
    const lockTicks = BOSS_INTRO_SKIP_LOCK_MS / TICK_MS;
    for (let step = 0; step < lockTicks; step += 1) state = tick(state);

    // Paused under the pause menu: the skip waits for play.
    const paused = reduce(state, { type: 'PAUSE' });
    expect(reduce(paused, { type: 'SKIP_BOSS_INTRO' })).toBe(paused);

    state = reduce(state, { type: 'SKIP_BOSS_INTRO' });
    expect(state.bossIntroMsRemaining).toBe(0);
    // Play is live at once.
    state = reduce(state, { type: 'DROP_BOMB', playerId });
    const placed = state.bombs.length;
    expect(placed).toBeGreaterThan(0);
    // Outside an intro it is a no-op.
    expect(reduce(state, { type: 'SKIP_BOSS_INTRO' })).toBe(state);

    // Replays carry it: the same frames rebuild the same arena.
    const frames = [
      ...Array.from({ length: lockTicks + 1 }, () => (
        { tick: 0, action: { type: 'TICK', deltaMs: TICK_MS } as GameAction }
      )),
      { tick: 1, action: { type: 'SKIP_BOSS_INTRO' } as GameAction },
      { tick: 1, action: { type: 'DROP_BOMB', playerId } as GameAction },
      { tick: 2, action: { type: 'TICK', deltaMs: TICK_MS } as GameAction },
    ];
    const recording = importReplay(exportReplay(recordReplay(before, frames)));
    const replayed = recording.frames.reduce(
      (current, frame) => gameReducer(current, frame.action),
      recording.initialState
    ) as GameEngineState;
    expect(replayed.bossIntroMsRemaining).toBe(0);
    expect(replayed.bombs).toHaveLength(placed);
    expect(replayed.tick).toBe(before.tick + 2);
    // From INIT as well: the intro has not started, so the skip changes nothing.
    const skip = frames[lockTicks + 1];
    expect(skip.action.type).toBe('SKIP_BOSS_INTRO');
    expect(replayActions({ type: 'INIT', config }, [skip])?.bossIntroMsRemaining ?? 0).toBe(0);
  });

  it('plays once per attempt: not again after a fall, again on a retry', () => {
    let state = openArena(liveMission());
    expect(state.bossIntroMsRemaining).toBeGreaterThan(0);
    while ((state.bossIntroMsRemaining ?? 0) > 0) state = tick(state);
    expect(state.campaign?.livesRemaining).toBeGreaterThan(1);

    // The boss knocks the player down; a life is spent and the fight goes on.
    state = {
      ...state,
      players: state.players.map((player) => ({
        ...player, alive: false, deathReason: 'Kurama hit Naruto.',
      })),
      boss: state.boss ? { ...state.boss, health: state.boss.health - 40 } : null,
    };
    state = tick(state);
    expect(state.players[0].alive).toBe(true);
    expect(state.boss?.health).toBe(state.boss!.maxHealth - 40);
    expect(state.bossIntroMsRemaining ?? 0).toBe(0);
    for (let step = 0; step < 20; step += 1) state = tick(state);
    expect(state.bossIntroMsRemaining ?? 0).toBe(0);

    // A retry is a new attempt: the arena opens, and the boss enters again.
    state = reduce(state, { type: 'RESTART' });
    expect(state.boss).toBeNull();
    expect(state.bossIntroMsRemaining ?? 0).toBe(0);
    state = openArena({ ...state, roundStartTicksRemaining: 0, monsters: [] });
    expect(state.bossIntroMsRemaining).toBeGreaterThan(0);
    expect(state.bossIntroMsRemaining).toBe(BOSS_INTRO_MS);
  });
});
