/* eslint-disable no-param-reassign -- the loop object is the mutable simulation owner */
import {
  gameReducer,
  GameAction,
  GameEngineState,
  Direction,
  PlayerState,
  TICK_MS,
} from '../engine';
import {
  MotionStore,
  clearMotion,
  createMotionStore,
  recordPlayerStep,
  recordTickMotion,
} from './motionStore';
import {
  CPU_MOVE_KEY,
  CpuSquad,
  cpuDirection,
  cpuFallback,
  createCpuSquad,
  steerCpuPlayer,
  thinkCpuPlayer,
} from '../ai/cpuPlayer';

export const MAX_FRAME_DELTA_MS = 100;
export const MAX_TICK_STEPS_PER_FRAME = 4;
export const MOVE_REPEAT_MS = 28;
export const FAST_MOVE_REPEAT_MS = 18;
const MAX_MOVE_STEPS_PER_FRAME = 5;
// After a direction is released, a blocked new direction may keep using it
// this long, so a turn pressed a moment early still happens at the next opening.
export const TURN_BUFFER_MS = 120;

export type ActiveMovement = {
  accumulatorMs: number;
  direction: Direction;
  key: string;
  // Direction to keep moving in while `direction` is blocked (buffered turn).
  fallbackDirection?: Direction;
  // Simulation time after which a just-released fallback no longer applies.
  fallbackUntilMs?: number;
};

/**
 * The simulation lives here, outside React. The frame loop and input handlers
 * reduce it synchronously, the hook publishes it to React at most once per
 * frame, and the 3D scene reads `motion` directly every frame.
 */
export type EngineLoop = {
  state: GameEngineState | null;
  accumulatorMs: number;
  activeMovement: Record<string, ActiveMovement>;
  motion: MotionStore;
  // CPU players of the current match (null when every slot is human).
  cpu: CpuSquad | null;
};

export function createEngineLoop(): EngineLoop {
  return {
    state: null,
    accumulatorMs: 0,
    activeMovement: {},
    motion: createMotionStore(),
    cpu: null,
  };
}

export function getMoveRepeatMs(player: PlayerState): number {
  return player.characterId === 'minato' || player.powerUps.includes('RollerSkate')
    ? FAST_MOVE_REPEAT_MS
    : MOVE_REPEAT_MS;
}

export function isPlaying(state: GameEngineState | null): state is GameEngineState {
  return !!state && !state.paused && state.phase === 'playing';
}

const RESET_ACTIONS = new Set<GameAction['type']>(['INIT', 'RESTART', 'DISMISS_DIALOG']);

/** Applies one action outside the frame loop (keyboard, menus, setup). */
export function applyEngineAction(loop: EngineLoop, action: GameAction): void {
  const before = loop.state;
  const after = gameReducer(before, action);
  loop.state = after;
  if (!before || !after || RESET_ACTIONS.has(action.type)) {
    clearMotion(loop.motion);
    // A new match or round starts every CPU with a clean slate.
    if (RESET_ACTIONS.has(action.type) && after !== before) loop.cpu = createCpuSquad(after);
    return;
  }
  if (after === before) return;
  const startMs = loop.motion.simTimeMs;
  if (action.type === 'MOVE') {
    const player = before.players.find((item) => item.id === action.playerId);
    const stepMs = player ? getMoveRepeatMs(player) : MOVE_REPEAT_MS;
    recordPlayerStep(loop.motion, before, after, action.playerId, startMs, stepMs);
    return;
  }
  recordTickMotion(loop.motion, before, after, startMs, TICK_MS);
}

// After each tick, every CPU may decide; its bomb, ultimate or detonation
// goes through the reducer like a human's key press.
function thinkCpuPlayers(loop: EngineLoop, cpu: CpuSquad): void {
  for (let i = 0; i < cpu.brains.length; i += 1) {
    const { state } = loop;
    if (!state) return;
    const brain = cpu.brains[i];
    const action = thinkCpuPlayer(cpu, brain, state, getMoveRepeatMs);
    if (action) applyEngineAction(loop, { type: action, playerId: brain.playerId });
  }
}

// Each frame, a CPU holds (or lets go of) a direction exactly like a key:
// a new direction moves at once and then repeats from the held-move loop.
function steerCpuPlayers(loop: EngineLoop, cpu: CpuSquad): void {
  for (let i = 0; i < cpu.brains.length; i += 1) {
    const { state } = loop;
    if (!state) return;
    const brain = cpu.brains[i];
    const player = state.players[brain.slot];
    const active = loop.activeMovement[brain.playerId];
    const code = player ? steerCpuPlayer(cpu, brain, player) : 0;
    const direction = cpuDirection(code);
    if (!direction) {
      if (active) delete loop.activeMovement[brain.playerId];
    } else {
      const fallbackDirection = cpuFallback(code) ?? undefined;
      if (!active || active.direction !== direction) {
        applyEngineAction(loop, {
          type: 'MOVE', playerId: brain.playerId, direction, fallbackDirection,
        });
        loop.activeMovement[brain.playerId] = {
          accumulatorMs: 0, direction, key: CPU_MOVE_KEY, fallbackDirection,
        };
      } else if (active.fallbackDirection !== fallbackDirection) {
        loop.activeMovement[brain.playerId] = { ...active, fallbackDirection };
      }
    }
  }
}

/**
 * Advances one display frame. Fixed 50 ms ticks run from an accumulator; held
 * movement repeats from a per-player accumulator. Each step is stamped with
 * the simulation time it was due at, so the renderer can interpolate.
 * Returns false when no round is live (held movement is dropped).
 */
export function advanceEngineFrame(loop: EngineLoop, frameDeltaMs: number): boolean {
  const current = loop.state;
  if (!isPlaying(current)) {
    loop.activeMovement = {};
    return false;
  }

  const delta = Math.min(Math.max(frameDeltaMs, 0), MAX_FRAME_DELTA_MS);
  const frameStartMs = loop.motion.simTimeMs;
  const tickAccumulatorAtStart = loop.accumulatorMs;
  loop.accumulatorMs += delta;
  let tickSteps = 0;
  while (loop.accumulatorMs >= TICK_MS && tickSteps < MAX_TICK_STEPS_PER_FRAME) {
    tickSteps += 1;
    const before = loop.state;
    const after = gameReducer(before, { type: 'TICK', deltaMs: TICK_MS });
    loop.state = after;
    loop.accumulatorMs -= TICK_MS;
    if (before && after) {
      const dueMs = frameStartMs + tickSteps * TICK_MS - tickAccumulatorAtStart;
      recordTickMotion(loop.motion, before, after, dueMs, TICK_MS);
    }
    if (loop.cpu) thinkCpuPlayers(loop, loop.cpu);
  }
  if (loop.cpu && isPlaying(loop.state)) steerCpuPlayers(loop, loop.cpu);
  if (tickSteps === MAX_TICK_STEPS_PER_FRAME) {
    loop.accumulatorMs = Math.min(loop.accumulatorMs, TICK_MS);
  }

  // Like the original loop: repeat rate and liveness come from the state the
  // frame started with.
  Object.entries(loop.activeMovement).forEach(([playerId, active]) => {
    const player = current.players.find((item) => item.id === playerId);
    if (!player || !player.alive) {
      delete loop.activeMovement[playerId];
      return;
    }

    const repeatMs = getMoveRepeatMs(player);
    let accumulatorMs = active.accumulatorMs + delta;
    const moveSteps = Math.min(MAX_MOVE_STEPS_PER_FRAME, Math.floor(accumulatorMs / repeatMs));
    const fallbackDirection = active.fallbackUntilMs === undefined
      || frameStartMs <= active.fallbackUntilMs
      ? active.fallbackDirection
      : undefined;
    for (let step = 1; step <= moveSteps; step += 1) {
      const before = loop.state;
      const after = gameReducer(before, {
        type: 'MOVE', playerId, direction: active.direction, fallbackDirection,
      });
      loop.state = after;
      if (before && after && before !== after) {
        const dueMs = frameStartMs + step * repeatMs - active.accumulatorMs;
        recordPlayerStep(loop.motion, before, after, playerId, dueMs, repeatMs);
      }
    }
    accumulatorMs -= moveSteps * repeatMs;
    loop.activeMovement[playerId] = { ...active, accumulatorMs };
  });

  loop.motion.simTimeMs = frameStartMs + delta;
  return true;
}
