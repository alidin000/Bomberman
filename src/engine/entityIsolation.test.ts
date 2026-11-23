import { gameReducer } from './reducer';
import { createInitialState } from './initialState';
import { loadStageMapRows, parseMapRows } from './mapLoader';
import { placeBomb, placeUltimateBomb, previewPlayerBombs } from './bombs';
import { TICK_MS } from './constants';
import { GameAction } from './actions';
import {
  BossHazard, GameConfig, GameEngineState, PlayerState,
} from './types';
import { getStageDefinition, StageId } from '../content';
import { createDojoConfig, getDojoRoom } from '../content/dojoRooms';
import { isBomb } from '../model/gameItem';

// Entity ids (bombs, boss hazards, enemy hazards) belong to one match. The
// server runs every room in one process, so nothing another room does may
// change them, and the same actions always mint the same ids.

const reduce = (state: GameEngineState | null, action: GameAction) => (
  gameReducer(state, action) as GameEngineState
);
const tick = (state: GameEngineState) => reduce(state, { type: 'TICK', deltaMs: TICK_MS });

// An online arena room, built the way the server's createConfig builds one.
function arenaRoom(stageId: StageId, seed: number): GameConfig {
  const stage = getStageDefinition(stageId);
  return {
    mode: 'onlinePreview',
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: stage.mapId,
    stageId: stage.id,
    map: parseMapRows(loadStageMapRows(stage.mapId)),
    selectedCharacters: ['naruto', 'sasuke'],
    playerNames: ['First', 'Second'],
    seed,
  };
}

// New hazards go after the ones still burning, so what a tick minted is
// whatever follows the survivors of the tick before.
function mintedHazards(before: GameEngineState, after: GameEngineState): BossHazard[] {
  if (after.tick === before.tick) return [];
  const survivors = before.hazards.filter((hazard) => hazard.ticksRemaining > TICK_MS);
  return after.hazards.slice(survivors.length);
}

type Run = { minted: string[]; duplicateTicks: number[]; final: GameEngineState };

// Ticks a room until its tick counter reaches `untilTick`. `between` runs
// other rooms' work after each of its ticks, the way the server interleaves
// room timers.
function playFrom(
  start: GameEngineState,
  untilTick: number,
  between: (roomTick: number) => void = () => {}
): Run {
  let state = start;
  const minted: string[] = [];
  const duplicateTicks: number[] = [];
  for (let step = 0; step < 400 && state.tick < untilTick; step += 1) {
    const before = state;
    state = tick(state);
    const now = state.tick;
    if (now !== before.tick) {
      mintedHazards(before, state).forEach((hazard) => minted.push(`t${now}:${hazard.id}`));
      const ids = state.hazards.map((hazard) => hazard.id);
      if (new Set(ids).size !== ids.length) duplicateTicks.push(now);
      between(now);
    }
  }
  return { minted, duplicateTicks, final: state };
}

// Room A: an online arena room on hiddenCloud whose players stay put. Its
// enemies cast at ticks 36, 36 and 43 for any seed.
function playArena(untilTick: number, between?: (roomTick: number) => void): Run {
  return playFrom(
    reduce(null, { type: 'INIT', config: arenaRoom('hiddenCloud', 4242) }),
    untilTick,
    between
  );
}

const mintTick = (entry: string) => Number(entry.slice(1, entry.indexOf(':')));

const openArena = parseMapRows([
  'WWWWWWWWWWWWWWW',
  ...Array.from({ length: 8 }, () => 'W             W'),
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

// A local versus round past its countdown, with no enemies. Deidara carries
// two bombs; Sasuke's Chidori Mine has the shorter fuse.
function liveArena(): GameEngineState {
  const state = createInitialState({
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: 'map1',
    map: openArena,
    selectedCharacters: ['deidara', 'sasuke'],
    seed: 5,
  });
  return { ...state, roundStartTicksRemaining: 0, monsters: [] };
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

function bombCells(state: GameEngineState): string[] {
  return state.map.flatMap((row, y) => row.flatMap((cell, x) => (
    isBomb(cell) ? [`${x},${y}`] : []
  )));
}

// A solo mission on an open 35x35 board with no wandering enemies, as in
// bossIntro.test.ts. Clearing every objective brings the boss in.
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34 ? 'W'.repeat(35) : `W${' '.repeat(33)}W`
).split('')));

function bossFight(): GameEngineState {
  const mission = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto'],
    map: openStage,
    seed: 7,
    difficulty: 'story',
  });
  const campaign = mission.campaign!;
  const opened = tick({
    ...mission,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: mission.players.map((player) => ({ ...player, x: 12, y: 17 })),
    campaign: {
      ...campaign,
      objectives: campaign.objectives.map((objective) => ({ ...objective, status: 'complete' })),
    },
  });
  expect(opened.boss).not.toBeNull();
  return { ...opened, bossIntroMsRemaining: 0 };
}

// The ids of the boss's first `count` attacks, one list per attack.
function bossAttacks(count: number, afterAttack: (attack: number) => void = () => {}): string[][] {
  let state = bossFight();
  const attacks: string[][] = [];
  for (let step = 0; step < 600 && attacks.length < count; step += 1) {
    const before = state;
    state = tick(state);
    const minted = mintedHazards(before, state);
    if (minted.length > 0) {
      attacks.push(minted.map((hazard) => hazard.id));
      afterAttack(attacks.length);
    }
  }
  return attacks;
}

describe('match-scoped entity ids', () => {
  it("another room's INIT never changes this room's hazard ids", () => {
    const alone = playArena(60);
    let other: GameEngineState | null = null;
    const shared = playArena(60, (aTick) => {
      if (other) other = tick(other);
      // Room B's host presses Start between room A's casts.
      if (aTick === 40) other = reduce(null, { type: 'INIT', config: arenaRoom('hiddenLeaf', 777) });
    });

    // Room A casts both before and after room B starts.
    expect(alone.minted.some((entry) => mintTick(entry) < 40)).toBe(true);
    expect(alone.minted.some((entry) => mintTick(entry) > 40)).toBe(true);
    expect(shared.minted).toEqual(alone.minted);
    expect(shared.duplicateTicks).toEqual([]);
    expect(shared.final).toEqual(alone.final);
  });

  it("another room's round advance never resets this room's ids", () => {
    const alone = playArena(60);
    // Room D: an arena room on its round result screen.
    let other: GameEngineState = {
      ...reduce(null, { type: 'INIT', config: arenaRoom('hiddenLeaf', 31337) }),
      phase: 'round_end',
    };
    const shared = playArena(60, (aTick) => {
      if (aTick === 40) other = reduce(other, { type: 'DISMISS_DIALOG' });
    });

    expect(other.round).toBe(2);
    expect(shared.minted).toEqual(alone.minted);
    expect(shared.duplicateTicks).toEqual([]);
  });

  it('bombs placed around a detonation in one tick get distinct ids and all explode', () => {
    // Player 2 holds a Detonator, so a bomb leaves the board within the tick.
    let state = patchPlayer(liveArena(), 'player2', { x: 11, y: 7, powerUps: ['Detonator'] });
    state = patchPlayer(state, 'player1', { x: 3, y: 3 });
    const placedAt = state.tick;
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player2' });
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player1' });
    // Out of its own blast first: a blast takes a ninja out whatever the health.
    state = patchPlayer(state, 'player2', { x: 13, y: 1 });
    state = reduce(state, { type: 'DETONATE_BOMBS', playerId: 'player2' });
    for (let step = 0; step < 12 && Math.round(state.players[0].x) === 3; step += 1) {
      state = reduce(state, { type: 'MOVE', playerId: 'player1', direction: 'right' });
    }
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player1' });

    expect(state.tick).toBe(placedAt);
    expect(state.bombs.map(({ x, y }) => `${x},${y}`)).toEqual(['3,3', '4,3']);
    expect(new Set(state.bombs.map((bomb) => bomb.id)).size).toBe(2);

    // A shorter fuse in line with the first bomb sets the pair off in a chain.
    state = patchPlayer(state, 'player2', { x: 3, y: 6 });
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player2' });
    state = patchPlayer(patchPlayer(state, 'player1', { x: 8, y: 8 }), 'player2', { x: 12, y: 8 });
    for (let step = 0; step < 80 && state.bombs.length > 0; step += 1) state = tick(state);

    expect(state.phase).toBe('playing');
    expect(state.bombs).toEqual([]);
    expect(bombCells(state)).toEqual([]);
    expect(state.players.map((player) => player.activeBombs)).toEqual([0, 0]);
  });

  it('an ultimate takes the next bomb id, so the bomb dropped after it gets its own', () => {
    let state = patchPlayer(liveArena(), 'player2', {
      x: 11, y: 7, ultimateCooldownRemaining: 0, maxBombs: 2,
    });
    state = reduce(state, { type: 'USE_ULTIMATE', playerId: 'player2' });
    // Off the Kirin's cell: no second bomb goes on it.
    state = patchPlayer(state, 'player2', { x: 8, y: 7 });
    state = reduce(state, { type: 'DROP_BOMB', playerId: 'player2' });

    expect(state.bombs.map(({ id, kind }) => `${id}:${kind}`))
      .toEqual(['bomb-1:kirin', 'bomb-2:chidoriMine']);
    expect(state.entityIds).toEqual({ bomb: 2, bossHazard: 0, monsterHazard: 0 });
  });

  it("boss attacks keep fresh ids across another room's INIT", () => {
    const attacks = bossAttacks(3, (attack) => {
      // Another room's host presses Start after the first attack.
      if (attack === 1) reduce(null, { type: 'INIT', config: arenaRoom('hiddenLeaf', 31337) });
    });

    expect(attacks).toHaveLength(3);
    const ids = attacks.flat();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ids keep counting across a round', () => {
    const roundOne = playArena(45);
    const dropped = reduce(roundOne.final, { type: 'DROP_BOMB', playerId: 'player1' });
    const roundOneIds = [
      ...roundOne.minted.map((entry) => entry.slice(entry.indexOf(':') + 1)),
      ...dropped.bombs.map((bomb) => bomb.id),
    ];
    expect(dropped.bombs).toHaveLength(1);

    const roundTwoStart = reduce({ ...dropped, phase: 'round_end' }, { type: 'DISMISS_DIALOG' });
    expect(roundTwoStart.round).toBe(2);
    // Round 2's enemies first cast 64 ticks in (seeded).
    const roundTwo = playFrom(roundTwoStart, roundTwoStart.tick + 70);
    const roundTwoDrop = reduce(roundTwo.final, { type: 'DROP_BOMB', playerId: 'player1' });
    const roundTwoIds = [
      ...roundTwo.minted.map((entry) => entry.slice(entry.indexOf(':') + 1)),
      ...roundTwoDrop.bombs.map((bomb) => bomb.id),
    ];

    expect(roundTwo.minted.length).toBeGreaterThan(0);
    expect(roundTwoDrop.bombs).toHaveLength(1);
    expect(roundTwoIds.filter((id) => roundOneIds.includes(id))).toEqual([]);
  });

  it('training charges stay bomb-1..N, and the room keeps counting after them', () => {
    const room = getDojoRoom('pillarShade');
    const config = createDojoConfig({
      ...room,
      charges: [
        ...room.charges,
        {
          x: 3, y: 3, range: 1, fuseMs: 3600,
        },
        {
          x: 8, y: 3, range: 1, fuseMs: 3600,
        },
      ],
    });
    const state = reduce(null, { type: 'INIT', config });
    expect(state.bombs.map((bomb) => bomb.id)).toEqual(['bomb-1', 'bomb-2', 'bomb-3']);

    const live = { ...state, roundStartTicksRemaining: 0 };
    const dropped = reduce(live, { type: 'DROP_BOMB', playerId: 'player1' });
    expect(dropped.bombs.map((bomb) => bomb.id)).toEqual(['bomb-1', 'bomb-2', 'bomb-3', 'bomb-4']);

    const restarted = reduce(dropped, { type: 'RESTART' });
    expect(restarted.bombs.map((bomb) => bomb.id)).toEqual(['bomb-1', 'bomb-2', 'bomb-3']);
  });

  it('previewPlayerBombs leaves entityIds untouched and previews the id placeBomb then mints', () => {
    // The room has already minted a bomb, so a preview starts mid-count.
    const state = reduce(liveArena(), { type: 'DROP_BOMB', playerId: 'player2' });
    const snapshot = JSON.parse(JSON.stringify(state));

    const basic = previewPlayerBombs(state, 'player1');
    const ultimate = previewPlayerBombs(state, 'player1', true);
    const again = previewPlayerBombs(state, 'player1');

    expect(state).toEqual(snapshot);
    expect(basic?.bombs).toHaveLength(1);
    expect(basic?.bombs).toEqual(placeBomb(state, 'player1').bombs.slice(state.bombs.length));
    expect(ultimate?.bombs)
      .toEqual(placeUltimateBomb(state, 'player1').bombs.slice(state.bombs.length));
    expect(again?.bombs).toEqual(basic?.bombs);
  });

  it('minted ids keep the bomb-, hazard- and monster-hazard- prefixes', () => {
    const enemyHazards = playArena(45).minted.map((entry) => entry.slice(entry.indexOf(':') + 1));
    const bossHazards = bossAttacks(1).flat();
    const { bombs } = reduce(liveArena(), { type: 'DROP_BOMB', playerId: 'player1' });

    expect(enemyHazards.length).toBeGreaterThan(0);
    expect(bossHazards.length).toBeGreaterThan(0);
    enemyHazards.forEach((id) => expect(id).toMatch(/^monster-hazard-\d+$/));
    bossHazards.forEach((id) => expect(id).toMatch(/^hazard-\d+$/));
    expect(bombs.map((bomb) => bomb.id)).toEqual([expect.stringMatching(/^bomb-/)]);
  });
});
