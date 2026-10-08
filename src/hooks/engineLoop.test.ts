/* eslint-disable no-param-reassign, comma-dangle */
import { parseMapRows } from '../engine/mapLoader';
import { GameConfig } from '../engine/types';
import {
  MOVE_REPEAT_MS,
  advanceEngineFrame,
  applyEngineAction,
  createEngineLoop,
} from './engineLoop';
import {
  ENEMY_GLIDE_MS,
  createMotionStore,
  playerMotionId,
  recordMotion,
  samplePosition,
} from './motionStore';

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
  seed: 1,
};

function startedLoop(frameMs: number) {
  const loop = createEngineLoop();
  applyEngineAction(loop, { type: 'INIT', config });
  for (let t = 0; t < 3200; t += frameMs) advanceEngineFrame(loop, frameMs);
  return loop;
}

function holdRight(loop: ReturnType<typeof createEngineLoop>) {
  const playerId = loop.state!.players[0].id;
  applyEngineAction(loop, { type: 'MOVE', playerId, direction: 'right' });
  loop.activeMovement[playerId] = { accumulatorMs: 0, direction: 'right', key: 'd' };
  return playerId;
}

describe('engine loop render interpolation', () => {
  it.each([1000 / 30, 1000 / 60, 1000 / 144])(
    'draws a held walk at constant speed and within one step of the sim at %f ms frames',
    (frameMs) => {
      const loop = startedLoop(frameMs);
      const playerId = holdRight(loop);
      const drawn: number[] = [];
      for (let frame = 0; frame < Math.round(1500 / frameMs); frame += 1) {
        advanceEngineFrame(loop, frameMs);
        const player = loop.state!.players[0];
        const point = samplePosition(loop.motion, playerMotionId(playerId), player.x, player.y);
        drawn.push(point.x);
        expect(player.x - point.x).toBeGreaterThanOrEqual(-1e-9);
        expect(player.x - point.x).toBeLessThanOrEqual(0.1 + 1e-9);
      }
      const perFrame = drawn.slice(1).map((x, i) => x - drawn[i]);
      const expected = (0.1 / MOVE_REPEAT_MS) * frameMs;
      perFrame.forEach((step) => expect(step).toBeCloseTo(expected, 6));
    },
  );

  it('stops drawing motion one step after the key is released', () => {
    const loop = startedLoop(1000 / 60);
    const playerId = holdRight(loop);
    for (let frame = 0; frame < 30; frame += 1) advanceEngineFrame(loop, 1000 / 60);
    delete loop.activeMovement[playerId];
    for (let frame = 0; frame < 3; frame += 1) advanceEngineFrame(loop, 1000 / 60);
    const player = loop.state!.players[0];
    expect(samplePosition(loop.motion, playerMotionId(playerId), player.x, player.y).x)
      .toBe(player.x);
  });

  it('freezes an in-flight glide while the game is paused', () => {
    const loop = startedLoop(1000 / 60);
    const playerId = holdRight(loop);
    advanceEngineFrame(loop, 5);
    applyEngineAction(loop, { type: 'PAUSE' });
    const player = loop.state!.players[0];
    const before = samplePosition(loop.motion, playerMotionId(playerId), player.x, player.y);
    for (let frame = 0; frame < 30; frame += 1) advanceEngineFrame(loop, 1000 / 60);
    expect(samplePosition(loop.motion, playerMotionId(playerId), player.x, player.y))
      .toEqual(before);
  });

  it('draws a new round at the spawn points without gliding there', () => {
    const loop = startedLoop(1000 / 60);
    const playerId = holdRight(loop);
    for (let frame = 0; frame < 30; frame += 1) advanceEngineFrame(loop, 1000 / 60);
    applyEngineAction(loop, { type: 'RESTART' });
    const player = loop.state!.players[0];
    expect(samplePosition(loop.motion, playerMotionId(playerId), player.x, player.y))
      .toEqual({ x: player.x, y: player.y });
  });
});

describe('enemy cell glide', () => {
  it('finishes a one-cell hop within the glide window and snaps teleports', () => {
    const store = createMotionStore();
    recordMotion(store, 'm', { x: 3, y: 4 }, { x: 4, y: 4 }, 1000, ENEMY_GLIDE_MS, 'smooth');
    store.simTimeMs = 1000 + ENEMY_GLIDE_MS / 2;
    expect(samplePosition(store, 'm', 4, 4).x).toBeCloseTo(3.5, 6);
    store.simTimeMs = 1000 + ENEMY_GLIDE_MS;
    expect(samplePosition(store, 'm', 4, 4)).toEqual({ x: 4, y: 4 });

    recordMotion(store, 'm', { x: 4, y: 4 }, { x: 11, y: 2 }, 2000, ENEMY_GLIDE_MS, 'smooth');
    store.simTimeMs = 2000;
    expect(samplePosition(store, 'm', 11, 2)).toEqual({ x: 11, y: 2 });
  });
});
