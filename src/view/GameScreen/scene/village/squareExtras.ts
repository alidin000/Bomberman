import type { StageId } from '../../../../content/types';
import type { RepairStage, VillageSquareLayout } from '../../../../content/villageSquare';
import { getHubVillage } from '../../../../content/hubVillages';

/**
 * The square's walking extras: render-only townsfolk who stroll set routes
 * inside the square, step aside when a player comes within a cell, slip
 * away if one walks right into them, and never block anything (the engine
 * never hears of them). They are the village's invented people (the
 * extras list in hubVillages.ts), then nameless townsfolk. A damaged
 * village has few people about; a thriving one more.
 */

// Each extra is an inked figure (two draws), so the count stays small.
const EXTRAS_AT_STAGE: Record<RepairStage, number> = {
  0: 1, 1: 1, 2: 2, 3: 3,
};

/** The village's own invented people, in order. */
export function villageExtraIds(stageId: StageId): string[] {
  return getHubVillage(stageId).extras.map((extra) => extra.id);
}

/**
 * Who walks the square at this repair stage: the village's people who are
 * not already standing in it as an interactable, then townsfolk.
 */
export function squareExtras(
  stageId: StageId,
  repair: RepairStage,
  standingIds: readonly string[] = []
): string[] {
  const count = EXTRAS_AT_STAGE[repair];
  const named = villageExtraIds(stageId).filter((id) => !standingIds.includes(id));
  const ids = named.slice(0, count);
  for (let index = 0; ids.length < count; index += 1) ids.push(`${stageId}-townsfolk-${index}`);
  return ids;
}

export type Cell = { x: number; y: number };

/**
 * Loops through the open part of the shared square plan (cells relative to
 * the square's north-west corner x0, y0): round the two pillars, down from
 * the east way out, and along the south by the shrine. They keep off every
 * interactable's cell.
 */
const ROUTES: readonly (readonly [number, number])[][] = [
  [[2, 2], [7, 2], [7, 4], [2, 4]],
  [[8, 1], [8, 4], [5, 5.5], [5, 1.5]],
  [[1.5, 5.5], [7.5, 6.5], [7.5, 5], [3, 5]],
];

export function extraRoute(square: VillageSquareLayout, index: number): Cell[] {
  const { x0, y0 } = square.bounds;
  return ROUTES[index % ROUTES.length].map(([x, y]) => ({ x: x0 + x, y: y0 + y }));
}

/** Walking pace, the hurry when stepping aside, cells per second. */
export const EXTRA_WALK_SPEED = 0.8;
export const EXTRA_YIELD_SPEED = 3;
/** A player this close (cells, any direction) makes an extra step aside. */
export const EXTRA_YIELD_RANGE = 1.2;
/** Closer than this, the extra slips away out of sight until the player leaves. */
export const EXTRA_SLIP_RANGE = 0.75;
/** ...and comes back once no player is within this of where it reappears. */
export const EXTRA_RETURN_RANGE = 2;
/** Extras keep this far apart (cells). */
export const EXTRA_PERSONAL_SPACE = 0.9;
const SHRINK_RATE = 7;
const TURN_RATE = 7;

export type ExtraState = {
  x: number;
  y: number;
  /** Facing (yaw toward +x from +y, as the villagers turn). */
  heading: number;
  /** The waypoint it walks toward. */
  next: number;
  /** Seconds to stand at the current waypoint. */
  wait: number;
  /** 1 shown, 0 slipped away. */
  shown: number;
  hidden: boolean;
  /** True while a player is close: it stands aside and looks at them. */
  yielding: boolean;
  /** A step cycle for the walk bob. */
  stride: number;
};

export type ExtraPlayer = { x: number; y: number; alive: boolean };

export function createExtraState(route: readonly Cell[], index: number): ExtraState {
  const start = route[index % route.length];
  return {
    x: start.x,
    y: start.y,
    heading: 0,
    next: (index + 1) % route.length,
    wait: 0.6 + index * 0.9,
    shown: 1,
    hidden: false,
    yielding: false,
    stride: 0,
  };
}

const chebyshev = (ax: number, ay: number, bx: number, by: number) => (
  Math.max(Math.abs(ax - bx), Math.abs(ay - by))
);

function nearestPlayer(
  players: readonly ExtraPlayer[],
  x: number,
  y: number
): { player: ExtraPlayer | null; distance: number } {
  let player: ExtraPlayer | null = null;
  let distance = Infinity;
  for (let index = 0; index < players.length; index += 1) {
    const other = players[index];
    const d = other.alive ? chebyshev(other.x, other.y, x, y) : Infinity;
    if (d < distance) {
      distance = d;
      player = other;
    }
  }
  return { player, distance };
}

function turnToward(state: ExtraState, yaw: number, dt: number, instant: boolean): void {
  const target = state;
  let turn = yaw - target.heading;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  target.heading += instant ? turn : turn * (1 - Math.exp(-dt * TURN_RATE));
}

/** True when (x, y) is inside the square and off every blocked cell. */
function standable(
  square: VillageSquareLayout,
  blocked: ReadonlySet<string>,
  x: number,
  y: number
): boolean {
  const {
    x0, y0, x1, y1,
  } = square.bounds;
  if (x < x0 - 0.2 || x > x1 + 0.2 || y < y0 - 0.2 || y > y1 + 0.2) return false;
  return !blocked.has(`${Math.round(x)},${Math.round(y)}`);
}

/**
 * One frame for one extra: walk the route, or step aside from a player who
 * comes within EXTRA_YIELD_RANGE, or slip away from one inside
 * EXTRA_SLIP_RANGE. `still` (reduced motion) never walks or animates: the
 * extra only disappears while a player is close and comes back after.
 * Mutates `state`; allocates nothing.
 */
export function stepExtra(
  state: ExtraState,
  route: readonly Cell[],
  square: VillageSquareLayout,
  blocked: ReadonlySet<string>,
  players: readonly ExtraPlayer[],
  dt: number,
  still: boolean,
  /** Every extra in the square; a later one waits for an earlier one in its way. */
  crowd: readonly ExtraState[] = [],
  self = -1
): void {
  const extra = state;
  const { player, distance } = nearestPlayer(players, extra.x, extra.y);

  if (extra.hidden) {
    // Out of sight: come back at the next waypoint once the player has
    // moved on from here and the way back in is clear.
    const spot = route[extra.next];
    if (distance > EXTRA_RETURN_RANGE
      && nearestPlayer(players, spot.x, spot.y).distance > EXTRA_RETURN_RANGE) {
      extra.x = spot.x;
      extra.y = spot.y;
      extra.next = (extra.next + 1) % route.length;
      extra.hidden = false;
      extra.wait = 0.8;
    }
    extra.shown = still ? 0 : Math.max(0, extra.shown - dt * SHRINK_RATE);
    return;
  }
  if (extra.shown < 1) extra.shown = still ? 1 : Math.min(1, extra.shown + dt * SHRINK_RATE);

  if (player && distance < EXTRA_SLIP_RANGE) {
    extra.hidden = true;
    extra.yielding = false;
    if (still) extra.shown = 0;
    return;
  }

  if (player && distance <= EXTRA_YIELD_RANGE) {
    extra.yielding = true;
    turnToward(extra, Math.atan2(player.x - extra.x, player.y - extra.y), dt, still);
    if (still) return;
    // Step straight away from the player, or to either side if that is blocked.
    const awayX = extra.x - player.x;
    const awayY = extra.y - player.y;
    const length = Math.hypot(awayX, awayY) || 1;
    const step = EXTRA_YIELD_SPEED * dt;
    const dx = (awayX / length) * step;
    const dy = (awayY / length) * step;
    if (standable(square, blocked, extra.x + dx, extra.y + dy)) {
      extra.x += dx;
      extra.y += dy;
    } else if (standable(square, blocked, extra.x - dy, extra.y + dx)) {
      extra.x -= dy;
      extra.y += dx;
    } else if (standable(square, blocked, extra.x + dy, extra.y - dx)) {
      extra.x += dy;
      extra.y -= dx;
    }
    return;
  }
  extra.yielding = false;
  if (still) return;

  if (extra.wait > 0) {
    extra.wait -= dt;
    return;
  }
  const target = route[extra.next];
  const toX = target.x - extra.x;
  const toY = target.y - extra.y;
  const remaining = Math.hypot(toX, toY);
  for (let index = 0; index < self; index += 1) {
    const other = crowd[index];
    const ox = other.x - extra.x;
    const oy = other.y - extra.y;
    // Someone ahead within a step: wait a moment for them to pass.
    if (!other.hidden && Math.hypot(ox, oy) < EXTRA_PERSONAL_SPACE && ox * toX + oy * toY > 0) {
      extra.wait = 0.5;
      return;
    }
  }
  const step = EXTRA_WALK_SPEED * dt;
  if (remaining <= step) {
    extra.x = target.x;
    extra.y = target.y;
    extra.next = (extra.next + 1) % route.length;
    // A short look round at each corner, longer at every other.
    extra.wait = extra.next % 2 ? 1.6 : 0.7;
    return;
  }
  extra.x += (toX / remaining) * step;
  extra.y += (toY / remaining) * step;
  extra.stride += dt * 9;
  turnToward(extra, Math.atan2(toX, toY), dt, false);
}
