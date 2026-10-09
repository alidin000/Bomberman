import { GameMap } from '../model/gameItem';
import { GameEngineState, Point } from './types';
import { positionOverlapsCell } from './grid';

// Versus sudden death, after Super Bomberman's pressure blocks: once the round
// clock runs out, walls drop in a spiral from the edge inward until one ninja
// is left (or the arena closes and the round is a draw).
export const VERSUS_ROUND_MS = 90000;
export const PRESSURE_BLOCK_INTERVAL_MS = 300;
// The closing spiral should take about this long on any arena: one block per
// drop on the small 15x10 arenas, a whole batch per drop on the 35x35 stages.
export const PRESSURE_FILL_MS = 45000;

const pressureOrderCache = new WeakMap<GameMap, Point[]>();

export function getPressureSpiral(map: GameMap): Point[] {
  const height = map.length;
  const width = map[0]?.length ?? 0;
  const cells: Point[] = [];
  let top = 1;
  let left = 1;
  let bottom = height - 2;
  let right = width - 2;
  while (top <= bottom && left <= right) {
    for (let x = left; x <= right; x += 1) cells.push({ x, y: top });
    for (let y = top + 1; y <= bottom; y += 1) cells.push({ x: right, y });
    if (top < bottom) {
      for (let x = right - 1; x >= left; x -= 1) cells.push({ x, y: bottom });
    }
    if (left < right) {
      for (let y = bottom - 1; y > top; y -= 1) cells.push({ x: left, y });
    }
    top += 1;
    left += 1;
    bottom -= 1;
    right -= 1;
  }
  return cells;
}

// The arena's own pillars never move, so the drop order skips them and every
// interval drops a block that actually changes the board.
function getPressureOrder(state: GameEngineState): Point[] {
  const baseMap = state.config.map;
  const cached = pressureOrderCache.get(baseMap);
  if (cached) return cached;
  const order = getPressureSpiral(baseMap).filter(({ x, y }) => baseMap[y]?.[x] !== 'Wall');
  pressureOrderCache.set(baseMap, order);
  return order;
}

// Versus only: the campaign and the Training Dojo have no round clock.
export function isSuddenDeathMode(state: GameEngineState): boolean {
  return state.config.mode !== 'solo' && state.config.mode !== 'training';
}

export function getRoundTimeRemainingMs(state: GameEngineState): number {
  return Math.max(0, VERSUS_ROUND_MS - state.roundElapsedMs);
}

export function getPressureBlocksPerDrop(state: GameEngineState): number {
  const drops = PRESSURE_FILL_MS / PRESSURE_BLOCK_INTERVAL_MS;
  return Math.max(1, Math.ceil(getPressureOrder(state).length / drops));
}

export function getUpcomingPressureCells(
  state: GameEngineState,
  count = getPressureBlocksPerDrop(state)
): Point[] {
  // The first batch is due the moment the clock runs out, so it is warned of
  // for the same interval as every later batch.
  if (!isSuddenDeathMode(state)
    || getRoundTimeRemainingMs(state) > PRESSURE_BLOCK_INTERVAL_MS) return [];
  return getPressureOrder(state).slice(
    state.pressureBlocksPlaced,
    state.pressureBlocksPlaced + count
  );
}

function dropPressureBlock(state: GameEngineState, { x, y }: Point): GameEngineState {
  if (state.map[y][x] === 'Wall') return state;

  const map = state.map.map((row) => [...row]);
  map[y][x] = 'Wall';

  const crushedBombs = state.bombs.filter((bomb) => bomb.x === x && bomb.y === y);
  const players = state.players.map((player) => {
    const refund = crushedBombs.filter((bomb) => bomb.ownerId === player.id).length;
    const next = refund > 0
      ? { ...player, activeBombs: Math.max(0, player.activeBombs - refund) }
      : player;
    if (!next.alive || !positionOverlapsCell(next, x, y)) return next;
    return {
      ...next,
      alive: false,
      deathReason: `${next.name} was crushed by a pressure block.`,
      deathCause: { kind: 'pressure' as const },
    };
  });

  return {
    ...state,
    map,
    players,
    bombs: state.bombs.filter((bomb) => bomb.x !== x || bomb.y !== y),
    monsters: state.monsters.filter((monster) => monster.x !== x || monster.y !== y),
    explosions: state.explosions.filter((explosion) => explosion.x !== x || explosion.y !== y),
    destroyedBoxes: state.destroyedBoxes.filter((box) => box.x !== x || box.y !== y),
  };
}

export function tickSuddenDeath(state: GameEngineState, deltaMs: number): GameEngineState {
  if (!isSuddenDeathMode(state)) return state;

  const roundElapsedMs = state.roundElapsedMs + deltaMs;
  let next: GameEngineState = { ...state, roundElapsedMs };
  if (roundElapsedMs < VERSUS_ROUND_MS) return next;

  const order = getPressureOrder(state);
  const drops = 1 + Math.floor((roundElapsedMs - VERSUS_ROUND_MS) / PRESSURE_BLOCK_INTERVAL_MS);
  const due = Math.min(order.length, drops * getPressureBlocksPerDrop(state));
  for (let index = next.pressureBlocksPlaced; index < due; index += 1) {
    next = dropPressureBlock(next, order[index]);
  }
  return { ...next, pressureBlocksPlaced: Math.max(next.pressureBlocksPlaced, due) };
}
