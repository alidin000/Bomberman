import { gameReducer } from './reducer';
import { GameAction } from './actions';
import { Direction, GameEngineState } from './types';
import { ROUND_START_COUNTDOWN_MS } from './initialState';
import { TICK_MS } from './constants';
import { TRAINING_CHARGE_OWNER, getTrainingOutcome, trainingGoalsMet } from './training';
import { isSuddenDeathMode } from './suddenDeath';
import { DOJO_ROOMS, DojoRoomId } from '../content/dojo';
import {
  DOJO_ROOM_DETAILS, createDojoConfig, findDojoCells, getDojoRoom,
} from '../content/dojoRooms';

// Held movement repeats a MOVE every 28 ms (engineLoop), while the engine
// ticks every 50 ms: the scripted player below walks at that real pace, so a
// fuse it outruns here is one a player outruns too.
const MOVE_REPEAT_MS = 28;

const DELTAS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

class ScriptedRoom {
  state: GameEngineState;

  private now = 0;

  private nextTick = TICK_MS;

  constructor(roomId: DojoRoomId) {
    this.state = gameReducer(null, {
      type: 'INIT', config: createDojoConfig(getDojoRoom(roomId)),
    }) as GameEngineState;
    // The 3-2-1 freeze.
    for (let elapsed = 0; elapsed < ROUND_START_COUNTDOWN_MS; elapsed += TICK_MS) {
      this.dispatch({ type: 'TICK', deltaMs: TICK_MS });
    }
  }

  get player() {
    return this.state.players[0];
  }

  get over() {
    return this.state.phase !== 'playing';
  }

  dispatch(action: GameAction) {
    this.state = gameReducer(this.state, action) as GameEngineState;
  }

  // Runs engine ticks due before `time`.
  private advanceTo(time: number) {
    while (this.nextTick <= time && !this.over) {
      this.dispatch({ type: 'TICK', deltaMs: TICK_MS });
      this.nextTick += TICK_MS;
    }
    this.now = Math.max(this.now, time);
  }

  wait(ms: number) {
    this.advanceTo(this.now + ms);
    return this;
  }

  waitUntil(check: (state: GameEngineState) => boolean, limitMs = 20000) {
    const end = this.now + limitMs;
    while (!check(this.state) && this.now < end && !this.over) this.advanceTo(this.now + TICK_MS);
    expect(check(this.state)).toBe(true);
    return this;
  }

  /** Holds a direction until the player stands `cells` cells further on. */
  walk(direction: Direction, cells: number) {
    const delta = DELTAS[direction];
    const target = {
      x: Math.round(this.player.x) + delta.x * cells,
      y: Math.round(this.player.y) + delta.y * cells,
    };
    let guard = 0;
    while ((this.player.x !== target.x || this.player.y !== target.y) && !this.over) {
      this.advanceTo(this.now + MOVE_REPEAT_MS);
      this.dispatch({ type: 'MOVE', playerId: this.player.id, direction });
      guard += 1;
      if (guard > cells * 20) throw new Error(`stuck walking ${direction} at ${this.player.x},${this.player.y}`);
    }
    return this;
  }

  bomb() {
    this.dispatch({ type: 'DROP_BOMB', playerId: this.player.id });
    return this;
  }
}

function expectCleared(room: ScriptedRoom) {
  expect(room.state.phase).toBe('game_over');
  expect(getTrainingOutcome(room.state)).toBe('cleared');
  expect(room.player.alive).toBe(true);
}

describe('Training Dojo rooms', () => {
  it('start every room at the fixed spawn, with no sudden-death clock', () => {
    expect(DOJO_ROOM_DETAILS.map((room) => room.id)).toEqual(DOJO_ROOMS.map((room) => room.id));
    DOJO_ROOM_DETAILS.forEach((room) => {
      expect(findDojoCells(room.rows, 'S')).toEqual([{ x: 1, y: 1 }]);
      const run = new ScriptedRoom(room.id);
      expect(run.player).toMatchObject({ x: 1, y: 1, alive: true });
      expect(isSuddenDeathMode(run.state)).toBe(false);
      expect(run.state.boss).toBeNull();
      expect(trainingGoalsMet(run.state).every(Boolean)).toBe(false);
    });
  });

  it('Lantern Walk clears when the player walks the winding path to the lantern', () => {
    const room = new ScriptedRoom('lanternWalk');
    room.walk('right', 2).walk('down', 2).walk('right', 2).walk('up', 2);
    expect(room.over).toBe(false);
    room.walk('right', 4).walk('down', 2).walk('left', 2).wait(TICK_MS);
    expectCleared(room);
    expect(room.state.resultMessage).toBe('Room cleared.');
  });

  it('Fuse Step clears once the crate breaks and the player got clear of the blast', () => {
    const room = new ScriptedRoom('fuseStep');
    room.walk('right', 3).bomb();
    expect(room.state.bombs).toHaveLength(1);
    room.walk('left', 3).walk('down', 1);
    expect(room.over).toBe(false);
    room.wait(3000);
    expectCleared(room);
  });

  it('Fuse Step fails when the player only steps off the bomb, staying in its line', () => {
    const room = new ScriptedRoom('fuseStep');
    room.walk('right', 3).bomb().walk('left', 2).wait(3000);
    expect(room.state.phase).toBe('game_over');
    expect(getTrainingOutcome(room.state)).toBe('failed');
    expect(room.state.resultMessage).toMatch(/own Clay Spider blast.*Try the room again/);
  });

  it('Pillar Shade clears after its charge goes off with the player out of the line', () => {
    const room = new ScriptedRoom('pillarShade');
    expect(room.state.bombs).toEqual([
      expect.objectContaining({ ownerId: TRAINING_CHARGE_OWNER, kind: 'standard' }),
    ]);
    room.walk('down', 1);
    room.wait(3000);
    expect(room.over).toBe(false);
    room.wait(1000);
    expectCleared(room);
    // The wall stopped the blast: the crate behind it still stands, the one
    // in the open row broke.
    const [behindWall] = findDojoCells(getDojoRoom('pillarShade').rows, 'b')
      .filter(({ y }) => y === 5);
    expect(room.state.map[behindWall.y][behindWall.x]).toBe('Box');
    expect(room.state.map[1][9]).not.toBe('Box');
  });

  it('Pillar Shade fails when the player stays in the charge row', () => {
    const room = new ScriptedRoom('pillarShade');
    room.wait(4000);
    expect(getTrainingOutcome(room.state)).toBe('failed');
  });

  it('Scroll and Sentry clears after the scroll and a blast that catches the sentry', () => {
    const room = new ScriptedRoom('scrollSentry');
    const range = room.player.bombRange;
    room.walk('right', 2);
    expect(room.player.bombRange).toBe(range + 1);
    expect(trainingGoalsMet(room.state)).toEqual([true, false]);
    room.walk('left', 2).walk('down', 2).walk('right', 1);
    // Watch the slow sentry and drop the bomb as it walks toward the corridor.
    room.waitUntil((state) => (
      state.monsters[0]?.x === 7 && state.monsters[0]?.patrol?.forward === true
    ));
    room.bomb().walk('left', 1).walk('up', 1);
    room.waitUntil((state) => state.phase !== 'playing', 4000);
    expectCleared(room);
    expect(room.state.monsters).toHaveLength(0);
  });

  it('the sentry walks its route at its own slow pace and turns back at a bomb', () => {
    const room = new ScriptedRoom('scrollSentry');
    const start = room.state.monsters[0];
    expect(start).toMatchObject({ x: 9, y: 3, name: 'Straw Sentry' });
    room.wait(900);
    expect(room.state.monsters[0]).toMatchObject({ x: 8, y: 3 });
    room.wait(900 * 4);
    expect(room.state.monsters[0]).toMatchObject({ x: 4, y: 3 });
    // The far end of its route: it turns back, never reaching the corridor.
    room.wait(900);
    expect(room.state.monsters[0]).toMatchObject({ x: 5, y: 3 });
  });

  it('a room restart lights its charges again and replays the same way', () => {
    const room = new ScriptedRoom('pillarShade');
    room.wait(4000);
    expect(getTrainingOutcome(room.state)).toBe('failed');
    const restarted = gameReducer(room.state, { type: 'RESTART' }) as GameEngineState;
    expect(restarted.phase).toBe('playing');
    expect(restarted.bombs).toHaveLength(1);
    expect(restarted.map[1][5])
      .toEqual(expect.objectContaining({ ownerId: TRAINING_CHARGE_OWNER }));
  });

  it('dojo crates hide nothing', () => {
    const room = new ScriptedRoom('fuseStep');
    room.walk('right', 3).bomb().walk('left', 3).walk('down', 1)
      .wait(3000);
    expectCleared(room);
    expect(room.state.destroyedBoxes.every((box) => box.pendingPowerUp === null)).toBe(true);
  });
});
