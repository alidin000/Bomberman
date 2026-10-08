import { EXPLOSION_MS, TICK_MS } from '../../../engine/constants';
import { createBomb, explodeBombs, tickExplosions } from '../../../engine/bombs';
import { createInitialState } from '../../../engine/initialState';
import { parseMapRows } from '../../../engine/mapLoader';
import { GameConfig, GameEngineState } from '../../../engine/types';
import { nextFlameAgeMs } from './flameAge';

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

const versusConfig: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: openArena,
  selectedCharacters: ['sasuke', 'naruto'],
};

const FRAME_MS = 1000 / 60;
const SHARED_CELL = { x: 4, y: 1 };

function sharedFlame(state: GameEngineState) {
  return state.explosions.find((cell) => cell.x === SHARED_CELL.x && cell.y === SHARED_CELL.y);
}

type DrawnFlame = { age?: number; ticks?: number };

/** Plays 60 fps frames over 50 ms engine ticks, the way ExplosionField samples a flame. */
function playFrames(start: GameEngineState, durationMs: number, drawn: DrawnFlame) {
  let state = start;
  const samples: { engineAgeMs: number; drawnAgeMs: number }[] = [];
  let simMs = 0;
  let tickedMs = 0;
  while (simMs < durationMs) {
    simMs += FRAME_MS;
    while (tickedMs + TICK_MS <= simMs) {
      state = tickExplosions(state, TICK_MS);
      tickedMs += TICK_MS;
    }
    const flame = sharedFlame(state);
    if (!flame) break;
    // eslint-disable-next-line no-param-reassign
    drawn.age = nextFlameAgeMs(drawn.age, drawn.ticks, flame.ticksRemaining, FRAME_MS);
    // eslint-disable-next-line no-param-reassign
    drawn.ticks = flame.ticksRemaining;
    samples.push({ engineAgeMs: EXPLOSION_MS - flame.ticksRemaining, drawnAgeMs: drawn.age });
  }
  return { state, samples };
}

describe('drawn flame age', () => {
  it('starts over when a second blast restarts a burning cell, instead of freezing on its last frame', () => {
    const arena = { ...createInitialState(versusConfig), monsters: [] };
    // Bomb A at (2,1) and bomb B at (6,1), range 2: both blasts reach (4,1).
    const drawn: DrawnFlame = {};
    const first = playFrames(explodeBombs(arena, [createBomb('player1', 2, 1, 2)]), 350, drawn);
    const restarted = explodeBombs(first.state, [createBomb('player2', 6, 1, 2)]);
    expect(sharedFlame(restarted)?.ticksRemaining).toBe(EXPLOSION_MS);

    const second = playFrames(restarted, EXPLOSION_MS + 100, drawn);

    // The flame stays lethal for a whole new lifetime, and the drawn flame
    // follows the engine's age (within one tick) through all of it.
    expect(second.samples.length).toBeGreaterThan(20);
    second.samples.forEach(({ engineAgeMs, drawnAgeMs }) => {
      expect(Math.abs(drawnAgeMs - engineAgeMs)).toBeLessThanOrEqual(TICK_MS + FRAME_MS);
    });
    // Mid-life it is at full blast again, not parked at EXPLOSION_MS (pulse 0).
    const mid = second.samples[Math.floor(second.samples.length / 2)];
    expect(Math.sin((mid.drawnAgeMs / EXPLOSION_MS) * Math.PI)).toBeGreaterThan(0.9);
  });

  it('keeps animating on frame time between ticks for a single blast', () => {
    const drawn: DrawnFlame = {};
    let age: number | undefined;
    const ages: number[] = [];
    // The engine value only changes every 50 ms; the drawn age must still advance every frame.
    [450, 450, 450, 400, 400, 400].forEach((ticks) => {
      age = nextFlameAgeMs(drawn.age, drawn.ticks, ticks, FRAME_MS);
      drawn.age = age;
      drawn.ticks = ticks;
      ages.push(age);
    });

    ages.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(ages[index]));
    expect(nextFlameAgeMs(EXPLOSION_MS - 1, 10, 10, FRAME_MS)).toBe(EXPLOSION_MS);
  });
});
