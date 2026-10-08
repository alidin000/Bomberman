/* eslint-disable no-bitwise, no-continue, no-param-reassign */
/**
 * CPU opponents for Local Arena.
 *
 * Modelled on Pommerman's rule-based SimpleAgent, in its priority order:
 * flee when the current cell is in danger; bomb an enemy in line, or the
 * crates beside it, but only if an escape exists afterwards; pick up nearby
 * power-ups; otherwise close in on the nearest enemy.
 *
 * A CPU plays through the same paths as a human: it holds a direction in the
 * engine loop's `activeMovement` (with a buffered-turn fallback) and sends
 * DROP_BOMB / USE_ULTIMATE / DETONATE_BOMBS through the reducer, so a match
 * with CPUs replays from its recorded actions alone.
 *
 * Every decision is a pure function of the match state, the tick and the
 * slot (plus memory built from earlier states): there is no Math.random and
 * no wall-clock time. Thinking runs on a fixed cadence of engine ticks and
 * reuses typed-array scratch space, so steering a CPU between decisions
 * allocates nothing.
 */
import {
  BombState, GameEngineState, PlayerState,
} from '../engine/types';
import { getExplosionPositions, previewPlayerBombs } from '../engine/bombs';
import { hazardIsActive } from '../engine/bosses';
import { EXPLOSION_MS, TICK_MS } from '../engine/constants';
import {
  PRESSURE_BLOCK_INTERVAL_MS,
  VERSUS_ROUND_MS,
  getPressureBlocksPerDrop,
  getPressureSpiral,
} from '../engine/suddenDeath';
import { normalizeSeed } from '../engine/random';
import { getMonsterMoveMs } from '../engine/monsters';
import { getMatchDifficulty } from '../engine/difficulty';
import { GameMap, gameItem, isBomb } from '../model/gameItem';
import { CpuLevelId, getCpuLevelId } from './controllers';

export interface CpuLevel {
  id: CpuLevelId;
  // Decision cadence, in 50 ms engine ticks.
  thinkTicks: number;
  // Someone else's new bomb is only noticed this long after it lands.
  reactionMs: number;
  // A bomb further than this from going off does not make the CPU run yet.
  horizonMs: number;
  // Safety margin on every lethal window while moving.
  marginMs: number;
  // Margin the escape must keep before the CPU drops its own bomb.
  bombMarginMs: number;
  // Least time between two of its own bombs.
  bombGapMs: number;
  // Goal values: a spot that puts an enemy in the blast, each crate a bomb
  // would break, and a power-up within `powerUpReach` cells.
  hunt: number;
  farm: number;
  powerUp: number;
  powerUpReach: number;
  ultimates: boolean;
  // Also bombs when the blast would leave an enemy no way out, even if the
  // enemy started running at once (or `trapDelayMs` late, to punish slow
  // reactions).
  traps: boolean;
  trapDelayMs: number;
  // Beginner misreads: this share of other players' bombs is believed one
  // cell shorter than it is, and chain reactions are not foreseen.
  misjudgeChance: number;
  chains: boolean;
  // Chance that a new threat is ignored for `slipMs` ("waits too long").
  slipChance: number;
  slipMs: number;
  // How close it walks up to an enemy it cannot bomb yet.
  approachDistance: number;
  // Chance that it drops a bomb for crates without checking its way out.
  rashChance: number;
  // Runs once a monster could reach its cell this soon; stops only where
  // none could within `monsterRestMs` of arriving.
  monsterThreatMs: number;
  monsterRestMs: number;
}

export const CPU_LEVELS: Record<CpuLevelId, CpuLevel> = {
  easy: {
    id: 'easy',
    thinkTicks: 5,
    reactionMs: 500,
    horizonMs: 1300,
    marginMs: 0,
    bombMarginMs: 0,
    bombGapMs: 2500,
    hunt: 0,
    farm: 2,
    powerUp: 3,
    powerUpReach: 6,
    ultimates: false,
    traps: false,
    trapDelayMs: 0,
    misjudgeChance: 0.5,
    chains: false,
    slipChance: 0.5,
    slipMs: 700,
    approachDistance: 5,
    rashChance: 0.15,
    monsterThreatMs: 500,
    monsterRestMs: 300,
  },
  normal: {
    id: 'normal',
    thinkTicks: 4,
    reactionMs: 250,
    horizonMs: 2200,
    marginMs: 60,
    bombMarginMs: 100,
    bombGapMs: 800,
    hunt: 4,
    farm: 1.5,
    powerUp: 5,
    powerUpReach: 10,
    ultimates: true,
    traps: true,
    trapDelayMs: 0,
    misjudgeChance: 0.15,
    chains: true,
    slipChance: 0.06,
    slipMs: 250,
    approachDistance: 3,
    rashChance: 0,
    monsterThreatMs: 700,
    monsterRestMs: 700,
  },
  hard: {
    id: 'hard',
    thinkTicks: 3,
    reactionMs: 100,
    horizonMs: 4000,
    marginMs: 100,
    bombMarginMs: 160,
    bombGapMs: 0,
    hunt: 8,
    farm: 1,
    powerUp: 6,
    powerUpReach: 14,
    ultimates: true,
    traps: true,
    trapDelayMs: 450,
    misjudgeChance: 0,
    chains: true,
    slipChance: 0,
    slipMs: 0,
    approachDistance: 2,
    rashChance: 0,
    monsterThreatMs: 900,
    monsterRestMs: 1000,
  },
};

export type CpuAction = 'DROP_BOMB' | 'USE_ULTIMATE' | 'DETONATE_BOMBS';

export interface CpuBrain {
  readonly playerId: string;
  readonly slot: number;
  readonly level: CpuLevel;
  readonly phase: number;
  // Planned route as cell indices; steering walks it between decisions.
  readonly path: Int32Array;
  pathLen: number;
  pathIndex: number;
  fleeing: boolean;
  goal: number;
  // Tick each bomb id was first on the field (for the reaction delay).
  readonly seen: Map<string, number>;
  lastBombTick: number;
  ownBombUntilTick: number;
  slipUntilTick: number;
  slipRolled: boolean;
  lastX: number;
  lastY: number;
  stuckTicks: number;
  avoidCell: number;
  avoidUntilTick: number;
  rethink: boolean;
}

type DangerField = {
  // Burning now: lethal from 0 until this many ms from now.
  flameEnd: Float64Array;
  // The next lethal window: [onset, clear] ms from now.
  onset: Float64Array;
  clear: Float64Array;
};

type BlastEntry = {
  map: GameMap;
  x: number;
  y: number;
  range: number;
  cells: Int32Array;
};

export interface CpuSquad {
  readonly brains: CpuBrain[];
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  // Sudden-death drop order, as cell indices.
  readonly pressureOrder: Int32Array;
  readonly live: DangerField;
  readonly whatIf: DangerField;
  readonly stamp: Int32Array;
  stampId: number;
  readonly depth: Int32Array;
  readonly parent: Int32Array;
  readonly queue: Int32Array;
  // Planned arrival time (ms from now) at each searched cell.
  readonly arrive: Float64Array;
  // A late start for the current search (trap checks: a slow reaction).
  searchDelayMs: number;
  // Cells from which a bomb reaches an enemy (stamped per decision).
  readonly huntMark: Int32Array;
  huntId: number;
  // Earliest ms from now at which a monster could stand on each cell.
  readonly monsterAt: Float64Array;
  readonly monsterQueue: Int32Array;
  readonly monsterDepth: Int32Array;
  readonly monsterMark: Int32Array;
  monsterId: number;
  // The deciding CPU's own monster caution (see CpuLevel).
  monsterRestMs: number;
  readonly bombAt: Int32Array;
  readonly bombAtMark: Int32Array;
  bombAtId: number;
  readonly blastMark: Int32Array;
  blastId: number;
  readonly bombList: BombState[];
  readonly fuses: number[];
  readonly blasts: Int32Array[];
  readonly blastCache: Map<string, BlastEntry>;
}

const NONE = -1e9;
// A flame burns a body whose centre is within 0.65 of its cell (0.5 + the
// flame hurt radius), a monster's strike within 0.78: plan with the larger.
const HURT_REACH = 0.8;
// Turns happen this close to a cell centre, so a route's timing is its
// length in cells; a turn's first step comes early (a fresh key press).
const ENTRY_SLACK = 0.1;
const MAX_ESCAPE_DEPTH = 24;
const MAX_GOAL_DEPTH = 30;
const STEP_COST = 0.15;
// A goal cell must stay safe this long after arrival; an escape this long or
// the level's horizon, whichever is longer.
const GOAL_REST_MS = 1500;
const MIN_REST_MS = 1500;
const TRAP_REST_MS = 1000;
const ARRIVE_DISTANCE = 0.12;
const WAYPOINT_DISTANCE = 0.12;
const STUCK_TICKS = 5;
const SHARED_SCREEN_X = 12;
const SHARED_SCREEN_Y = 8;
const ESCAPE_SCREEN_SCALE = 1.5;
const MANUAL_BOMB_MS = 500;
// Monsters catch on touch, so a CPU plans around where they could walk.
const MONSTER_STEPS = 4;
const SUDDEN_DEATH_LOOKAHEAD_MS = 8000;
const CENTRE_SEEK_MS = 12000;

const DIRECTIONS = [null, 'up', 'right', 'down', 'left'] as const;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const CPU_MOVE_KEY = 'cpu';

function roll(seed: number, tick: number, slot: number, salt: number): number {
  let h = (seed ^ Math.imul(tick + 1, 0x9e3779b1) ^ Math.imul(slot + 1, 0x85ebca6b)
    ^ Math.imul(salt + 1, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h, 31) + id.charCodeAt(i);
  return h >>> 0;
}

function createField(size: number): DangerField {
  return {
    flameEnd: new Float64Array(size),
    onset: new Float64Array(size),
    clear: new Float64Array(size),
  };
}

/** The CPU players of a match, or null when every slot is human. */
export function createCpuSquad(state: GameEngineState | null): CpuSquad | null {
  if (!state || state.config.mode === 'solo' || !state.config.controllers) return null;
  const height = state.map.length;
  const width = state.map[0]?.length ?? 0;
  const size = width * height;
  const brains: CpuBrain[] = [];
  state.players.forEach((player, slot) => {
    const levelId = getCpuLevelId(state.config.controllers?.[slot]);
    if (!levelId) return;
    const level = CPU_LEVELS[levelId];
    brains.push({
      playerId: player.id,
      slot,
      level,
      phase: slot % level.thinkTicks,
      path: new Int32Array(size),
      pathLen: 0,
      pathIndex: 0,
      fleeing: false,
      goal: -1,
      seen: new Map(),
      lastBombTick: -1e6,
      ownBombUntilTick: -1,
      slipUntilTick: -1,
      slipRolled: false,
      lastX: player.x,
      lastY: player.y,
      stuckTicks: 0,
      avoidCell: -1,
      avoidUntilTick: -1,
      rethink: false,
    });
  });
  if (brains.length === 0) return null;
  const baseMap = state.config.map;
  const order = getPressureSpiral(baseMap)
    .filter(({ x, y }) => baseMap[y]?.[x] !== 'Wall')
    .map(({ x, y }) => y * width + x);
  return {
    brains,
    width,
    height,
    seed: normalizeSeed(state.config.seed),
    pressureOrder: Int32Array.from(order),
    live: createField(size),
    whatIf: createField(size),
    stamp: new Int32Array(size),
    stampId: 0,
    depth: new Int32Array(size),
    parent: new Int32Array(size),
    queue: new Int32Array(size),
    arrive: new Float64Array(size),
    searchDelayMs: 0,
    huntMark: new Int32Array(size),
    huntId: 0,
    monsterAt: new Float64Array(size),
    monsterQueue: new Int32Array(size),
    monsterDepth: new Int32Array(size),
    monsterMark: new Int32Array(size),
    monsterId: 0,
    monsterRestMs: 0,
    bombAt: new Int32Array(size),
    bombAtMark: new Int32Array(size),
    bombAtId: 0,
    blastMark: new Int32Array(size),
    blastId: 0,
    bombList: [],
    fuses: [],
    blasts: [],
    blastCache: new Map(),
  };
}

function isWalkableItem(cell: gameItem | undefined): boolean {
  // Bombs and cover are objects; every string but crates and walls is floor
  // or a power-up.
  return typeof cell === 'string' && cell !== 'Wall' && cell !== 'Box';
}

function blastCells(squad: CpuSquad, bomb: BombState, map: GameMap, cache: boolean): Int32Array {
  const cached = cache ? squad.blastCache.get(bomb.id) : undefined;
  if (cached && cached.map === map && cached.x === bomb.x && cached.y === bomb.y
    && cached.range === bomb.range) {
    return cached.cells;
  }
  const positions = getExplosionPositions(bomb, map);
  const cells = new Int32Array(positions.length);
  for (let i = 0; i < positions.length; i += 1) {
    cells[i] = positions[i].y * squad.width + positions[i].x;
  }
  if (cache) {
    if (squad.blastCache.size > 48) squad.blastCache.clear();
    squad.blastCache.set(bomb.id, {
      map, x: bomb.x, y: bomb.y, range: bomb.range, cells,
    });
  }
  return cells;
}

function perceives(brain: CpuBrain, state: GameEngineState, bomb: BombState): boolean {
  if (bomb.ownerId === brain.playerId) return true;
  const seenAt = brain.seen.get(bomb.id);
  return seenAt !== undefined && (state.tick - seenAt) * TICK_MS >= brain.level.reactionMs;
}

function ownerAlive(state: GameEngineState, ownerId: string): boolean {
  for (let i = 0; i < state.players.length; i += 1) {
    if (state.players[i].id === ownerId) return state.players[i].alive;
  }
  return false;
}

// Lethal windows per cell, from what this CPU has noticed (plus `extra`
// bombs it is thinking of dropping). Chain reactions follow the engine: a
// bomb inside another bomb's blast goes off no later than it.
function buildDanger(
  squad: CpuSquad,
  state: GameEngineState,
  brain: CpuBrain,
  field: DangerField,
  extra: BombState[] | null
): void {
  const { width } = squad;
  const { flameEnd, onset, clear } = field;
  flameEnd.fill(NONE);
  onset.fill(Infinity);
  clear.fill(NONE);
  for (let i = 0; i < state.explosions.length; i += 1) {
    const flame = state.explosions[i];
    const cell = flame.y * width + flame.x;
    if (flame.ticksRemaining > flameEnd[cell]) flameEnd[cell] = flame.ticksRemaining;
  }
  for (let i = 0; i < state.hazards.length; i += 1) {
    const hazard = state.hazards[i];
    if (hazard.damage > 0) {
      const cell = hazard.y * width + hazard.x;
      if (hazardIsActive(hazard)) {
        if (hazard.ticksRemaining > flameEnd[cell]) flameEnd[cell] = hazard.ticksRemaining;
      } else {
        const active = hazard.activeMs ?? Math.max(300, Math.round(hazard.warningTicks * (3 / 7)));
        const from = Math.max(0, hazard.ticksRemaining - active);
        if (from < onset[cell]) onset[cell] = from;
        if (hazard.ticksRemaining > clear[cell]) clear[cell] = hazard.ticksRemaining;
      }
    }
  }
  // Sudden death: the closing spiral is shown and predictable.
  if (state.config.mode !== 'solo'
    && state.roundElapsedMs > VERSUS_ROUND_MS - SUDDEN_DEATH_LOOKAHEAD_MS) {
    const perDrop = getPressureBlocksPerDrop(state);
    const order = squad.pressureOrder;
    for (let i = state.pressureBlocksPlaced; i < order.length; i += 1) {
      const due = VERSUS_ROUND_MS + PRESSURE_BLOCK_INTERVAL_MS * Math.floor(i / perDrop)
        - state.roundElapsedMs;
      if (due > SUDDEN_DEATH_LOOKAHEAD_MS) break;
      const cell = order[i];
      const from = Math.max(0, due);
      if (from < onset[cell]) onset[cell] = from;
      clear[cell] = Infinity;
    }
  }

  const list = squad.bombList;
  list.length = 0;
  for (let i = 0; i < state.bombs.length; i += 1) {
    if (perceives(brain, state, state.bombs[i])) list.push(state.bombs[i]);
  }
  const realCount = list.length;
  if (extra) for (let i = 0; i < extra.length; i += 1) list.push(extra[i]);
  if (list.length === 0) return;

  const { fuses, blasts } = squad;
  squad.bombAtId += 1;
  const markId = squad.bombAtId;
  for (let k = 0; k < list.length; k += 1) {
    const bomb = list[k];
    fuses[k] = bomb.manualDetonation && ownerAlive(state, bomb.ownerId)
      ? MANUAL_BOMB_MS
      : Math.max(0, bomb.ticksRemaining);
    blasts[k] = blastCells(squad, bomb, state.map, k < realCount);
    const cell = bomb.y * width + bomb.x;
    squad.bombAtMark[cell] = markId;
    squad.bombAt[cell] = k;
  }
  const passes = brain.level.chains ? list.length : 0;
  for (let pass = 0; pass < passes; pass += 1) {
    let updated = false;
    for (let s = 0; s < list.length; s += 1) {
      const cells = blasts[s];
      for (let c = 0; c < cells.length; c += 1) {
        if (squad.bombAtMark[cells[c]] === markId) {
          const target = squad.bombAt[cells[c]];
          if (fuses[target] > fuses[s]) {
            fuses[target] = fuses[s];
            updated = true;
          }
        }
      }
    }
    if (!updated) break;
  }
  for (let k = 0; k < list.length; k += 1) {
    const bomb = list[k];
    const cells = blasts[k];
    const from = fuses[k];
    const to = from + EXPLOSION_MS;
    const short = bomb.ownerId !== brain.playerId && brain.level.misjudgeChance > 0
      && roll(squad.seed, idHash(bomb.id), brain.slot, 7) < brain.level.misjudgeChance;
    for (let c = 0; c < cells.length; c += 1) {
      const cell = cells[c];
      const x = cell % width;
      const y = (cell - x) / width;
      if (short && (x === bomb.x || y === bomb.y)
        && Math.abs(x - bomb.x) + Math.abs(y - bomb.y) >= bomb.range) continue;
      if (from < onset[cell]) onset[cell] = from;
      if (to > clear[cell]) clear[cell] = to;
    }
  }
}

// Is the cell lethal at any time in [from, to] (ms from now)?
function lethal(
  field: DangerField,
  cell: number,
  from: number,
  to: number,
  margin: number
): boolean {
  if (from < field.flameEnd[cell] + margin) return true;
  return to > field.onset[cell] - margin && from < field.clear[cell] + margin;
}

// Where monsters could be soon: each walks one cell per move, so a cell
// `n` steps away is reachable after its move cooldown plus n-1 more moves.
// A body flicker lands on the cell its warning marks, then walks on.
function markMonsters(squad: CpuSquad, state: GameEngineState): void {
  const {
    monsterAt, monsterQueue, monsterDepth, monsterMark, width, height,
  } = squad;
  monsterAt.fill(Infinity);
  const difficulty = getMatchDifficulty(state.config);
  for (let i = 0; i < state.monsters.length; i += 1) {
    const monster = state.monsters[i];
    const moveMs = getMonsterMoveMs(monster, difficulty);
    let start = Math.round(monster.y) * width + Math.round(monster.x);
    let firstMs = 0;
    let stepMs = Math.max(0, monster.moveCooldown);
    const warning = monster.abilityWarningTicks ?? 0;
    if (monster.abilityKind === 'bodyFlicker' && monster.abilityTarget && warning > 0) {
      monsterAt[start] = 0;
      start = monster.abilityTarget.y * width + monster.abilityTarget.x;
      firstMs = warning;
      stepMs = warning + moveMs;
    }
    squad.monsterId += 1;
    const mark = squad.monsterId;
    let head = 0;
    let tail = 1;
    monsterQueue[0] = start;
    monsterDepth[start] = 0;
    monsterMark[start] = mark;
    const ghost = monster.kind === 'ghost';
    while (head < tail) {
      const cell = monsterQueue[head];
      head += 1;
      const d = monsterDepth[cell];
      const at = d === 0 ? firstMs : stepMs + (d - 1) * moveMs;
      if (at < monsterAt[cell]) monsterAt[cell] = at;
      if (d >= MONSTER_STEPS) continue;
      const cx = cell % width;
      const cy = (cell - cx) / width;
      for (let dir = 0; dir < 4; dir += 1) {
        const nx = cx + DX[dir];
        const ny = cy + DY[dir];
        if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
        const next = ny * width + nx;
        if (monsterMark[next] === mark) continue;
        const item = state.map[ny][nx];
        if (ghost ? item === 'Wall' || typeof item !== 'string' : item !== 'Empty') continue;
        monsterMark[next] = mark;
        monsterDepth[next] = d + 1;
        monsterQueue[tail] = next;
        tail += 1;
      }
    }
  }
}

type ScreenBox = { minX: number; maxX: number; minY: number; maxY: number };
const box: ScreenBox = {
  minX: 0, maxX: 0, minY: 0, maxY: 0,
};

// The shared screen keeps everyone within 12x8 cells of each other (1.5x
// while fleeing); plans stay inside it so the CPU never pushes against it.
function setScreenBox(state: GameEngineState, me: PlayerState, scale: number): ScreenBox {
  box.minX = -Infinity;
  box.maxX = Infinity;
  box.minY = -Infinity;
  box.maxY = Infinity;
  if (state.config.numPlayers <= 1) return box;
  for (let i = 0; i < state.players.length; i += 1) {
    const other = state.players[i];
    if (other.alive && other.id !== me.id) {
      box.minX = Math.max(box.minX, other.x - SHARED_SCREEN_X * scale);
      box.maxX = Math.min(box.maxX, other.x + SHARED_SCREEN_X * scale);
      box.minY = Math.max(box.minY, other.y - SHARED_SCREEN_Y * scale);
      box.maxY = Math.min(box.maxY, other.y + SHARED_SCREEN_Y * scale);
    }
  }
  return box;
}

function insideBox(x: number, y: number, me: PlayerState): boolean {
  // A cell outside is still fine when it closes the gap from where we are.
  const okX = (x >= box.minX && x <= box.maxX)
    || (x < box.minX && x >= me.x) || (x > box.maxX && x <= me.x);
  const okY = (y >= box.minY && y <= box.maxY)
    || (y < box.minY && y >= me.y) || (y > box.maxY && y <= me.y);
  return okX && okY;
}

function isExtraBombCell(extra: BombState[] | null, cell: number, width: number): boolean {
  if (!extra) return false;
  for (let i = 0; i < extra.length; i += 1) {
    if (extra[i].y * width + extra[i].x === cell) return true;
  }
  return false;
}

function writePath(squad: CpuSquad, brain: CpuBrain, target: number): void {
  let length = 0;
  for (let cell = target; cell !== -1; cell = squad.parent[cell]) length += 1;
  let index = length - 1;
  for (let cell = target; cell !== -1; cell = squad.parent[cell]) {
    brain.path[index] = cell;
    index -= 1;
  }
  brain.pathLen = length;
  brain.pathIndex = 0;
}

// Planning times along a route: the body is within reach of a route cell
// from a little before it gets to the centre until it is that far past it.
function entryMs(arrive: number, cellMs: number): number {
  return arrive - (HURT_REACH + ENTRY_SLACK) * cellMs;
}

function exitMs(arrive: number, cellMs: number): number {
  return arrive + HURT_REACH * cellMs;
}

// The first hop is timed from where the CPU actually stands, not from the
// centre of the cell it rounds to (it may already be halfway to the next).
function firstHopMs(me: PlayerState, cell: number, width: number, cellMs: number): number {
  const x = cell % width;
  return (Math.abs(me.x - x) + Math.abs(me.y - (cell - x) / width)) * cellMs;
}

// Standing on someone else's bomb (dropped onto a shared cell), the engine
// only lets a body move away from its centre: off-centre on one axis, the
// only way off is further out along that axis.
function canLeaveStart(state: GameEngineState, me: PlayerState, dir: number): boolean {
  const sx = Math.round(me.x);
  const sy = Math.round(me.y);
  const item = state.map[sy]?.[sx];
  if (!isBomb(item) || item.ownerId === me.id) return true;
  const offX = me.x - sx;
  const offY = me.y - sy;
  if (Math.abs(offX) > 0.01) return DX[dir] !== 0 && DX[dir] * offX > 0;
  if (Math.abs(offY) > 0.01) return DY[dir] !== 0 && DY[dir] * offY > 0;
  return true;
}

function startSearch(squad: CpuSquad, me: PlayerState, cellMs: number, delayMs = 0): number {
  const { width } = squad;
  const start = Math.round(me.y) * width + Math.round(me.x);
  squad.stampId += 1;
  squad.queue[0] = start;
  squad.stamp[start] = squad.stampId;
  squad.depth[start] = 0;
  squad.parent[start] = -1;
  squad.arrive[start] = delayMs + firstHopMs(me, start, width, cellMs);
  squad.searchDelayMs = delayMs;
  return start;
}

// Can the route step from `cell` into `next`? The cell it leaves must stay
// safe until the body is clear of it, and `next` while the body is in it.
function stepArrive(
  squad: CpuSquad,
  me: PlayerState,
  field: DangerField,
  start: number,
  cell: number,
  next: number,
  cellMs: number,
  margin: number
): number {
  const arrive = cell === start
    ? squad.searchDelayMs + firstHopMs(me, next, squad.width, cellMs)
    : squad.arrive[cell] + cellMs;
  if (cell === start
    && lethal(field, start, 0, Math.max(0, arrive - (1 - HURT_REACH) * cellMs), margin)) return -1;
  if (lethal(field, next, entryMs(arrive, cellMs), exitMs(arrive, cellMs), margin)) return -1;
  if (squad.monsterAt[next] <= exitMs(arrive, cellMs) + margin) return -1;
  return arrive;
}

function restSafe(
  squad: CpuSquad,
  field: DangerField,
  start: number,
  cell: number,
  cellMs: number,
  margin: number,
  restMs: number
): boolean {
  const arrive = squad.arrive[cell];
  if (squad.monsterAt[cell] <= arrive + squad.monsterRestMs) return false;
  const from = cell === start ? 0 : entryMs(arrive, cellMs);
  return !lethal(field, cell, Math.max(0, from), arrive + restMs, margin);
}

/**
 * Breadth-first search for the nearest cell that stays safe for `restMs`
 * after the CPU gets there, never passing a cell while it is lethal. Writes
 * the route and returns true when one exists; otherwise heads for the cell
 * with the most time to spare and returns false.
 */
function planEscape(
  squad: CpuSquad,
  brain: CpuBrain,
  state: GameEngineState,
  me: PlayerState,
  field: DangerField,
  cellMs: number,
  margin: number,
  restMs: number,
  extra: BombState[] | null,
  write: boolean,
  delayMs = 0
): boolean {
  const { width, height } = squad;
  setScreenBox(state, me, ESCAPE_SCREEN_SCALE);
  let weak = -1;
  const start = startSearch(squad, me, cellMs, delayMs);
  const {
    stamp, depth, parent, queue, monsterAt, arrive,
  } = squad;
  const { stampId } = squad;
  let head = 0;
  let tail = 1;
  let found = -1;
  let fallback = start;
  let fallbackSlack = -Infinity;
  while (head < tail) {
    const cell = queue[head];
    head += 1;
    const d = depth[cell];
    if (restSafe(squad, field, start, cell, cellMs, margin, restMs)) {
      found = cell;
      break;
    }
    // Second best: safe for a shorter while (it will move on from there).
    if (weak < 0 && restMs > MIN_REST_MS
      && restSafe(squad, field, start, cell, cellMs, margin, MIN_REST_MS)) weak = cell;
    const from = cell === start ? 0 : entryMs(arrive[cell], cellMs);
    if (from >= field.flameEnd[cell] + margin) {
      const slack = Math.min(field.onset[cell], monsterAt[cell]) - margin
        - exitMs(arrive[cell], cellMs);
      if (slack > fallbackSlack) {
        fallbackSlack = slack;
        fallback = cell;
      }
    }
    if (d >= MAX_ESCAPE_DEPTH) continue;
    const cx = cell % width;
    const cy = (cell - cx) / width;
    for (let dir = 0; dir < 4; dir += 1) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (stamp[next] === stampId) continue;
      if (cell === start && !canLeaveStart(state, me, dir)) continue;
      if (!isWalkableItem(state.map[ny][nx]) || isExtraBombCell(extra, next, width)) continue;
      if (!insideBox(nx, ny, me)) continue;
      const time = stepArrive(squad, me, field, start, cell, next, cellMs, margin);
      if (time < 0) continue;
      stamp[next] = stampId;
      depth[next] = d + 1;
      parent[next] = cell;
      arrive[next] = time;
      queue[tail] = next;
      tail += 1;
    }
  }
  if (write) {
    let target = fallback;
    if (found >= 0) target = found;
    else if (weak >= 0) target = weak;
    writePath(squad, brain, target);
    brain.goal = -1;
  }
  return found >= 0;
}

function countCrates(map: GameMap, x: number, y: number, range: number): number {
  let crates = 0;
  for (let dir = 0; dir < 4; dir += 1) {
    for (let i = 1; i <= range; i += 1) {
      const cell = map[y + DY[dir] * i]?.[x + DX[dir] * i];
      if (cell === undefined || cell === 'Wall') break;
      if (cell === 'Box') {
        crates += 1;
        break;
      }
      if (typeof cell !== 'string') break;
    }
  }
  return crates;
}

function markLines(squad: CpuSquad, map: GameMap, tx: number, ty: number, range: number): void {
  for (let dir = 0; dir < 4; dir += 1) {
    for (let i = 1; i <= range; i += 1) {
      const x = tx + DX[dir] * i;
      const y = ty + DY[dir] * i;
      if (!isWalkableItem(map[y]?.[x])) break;
      squad.huntMark[y * squad.width + x] = squad.huntId;
    }
  }
}

// Stamps every cell from which a straight blast of `range` reaches an enemy
// (or a monster: clearing them makes the arena safer).
function markHuntSpots(
  squad: CpuSquad,
  state: GameEngineState,
  me: PlayerState,
  range: number
): void {
  squad.huntId += 1;
  for (let p = 0; p < state.players.length; p += 1) {
    const enemy = state.players[p];
    if (enemy.alive && enemy.id !== me.id) {
      markLines(squad, state.map, Math.round(enemy.x), Math.round(enemy.y), range);
    }
  }
  for (let m = 0; m < state.monsters.length; m += 1) {
    markLines(squad, state.map, state.monsters[m].x, state.monsters[m].y, range);
  }
}

function nearestEnemyDistance(
  state: GameEngineState,
  me: PlayerState,
  x: number,
  y: number
): number {
  let best = Infinity;
  for (let p = 0; p < state.players.length; p += 1) {
    const enemy = state.players[p];
    if (enemy.alive && enemy.id !== me.id) {
      const distance = Math.abs(enemy.x - x) + Math.abs(enemy.y - y);
      if (distance < best) best = distance;
    }
  }
  return best;
}

function occupiedByOther(state: GameEngineState, me: PlayerState, x: number, y: number): boolean {
  for (let p = 0; p < state.players.length; p += 1) {
    const other = state.players[p];
    if (other.alive && other.id !== me.id
      && Math.abs(other.x - x) < 0.8 && Math.abs(other.y - y) < 0.8) return true;
  }
  return false;
}

function bombLimit(me: PlayerState): number {
  return me.maxBombs + (me.characterId === 'naruto' ? 1 : 0);
}

/**
 * Where to go while safe: the best of a power-up, a spot that puts an enemy
 * in the blast, or crates to break, less a cost per step; otherwise walk up
 * to the nearest enemy (or, late in the round, to the arena's centre).
 */
function planGoal(
  squad: CpuSquad,
  brain: CpuBrain,
  state: GameEngineState,
  me: PlayerState,
  cellMs: number
): void {
  const { level } = brain;
  const { width, height } = squad;
  const field = squad.live;
  const margin = level.marginMs;
  const range = me.bombRange + (me.characterId === 'deidara' || me.characterId === 'sasuke' ? 1 : 0);
  const hasBomb = me.activeBombs < bombLimit(me);
  if (hasBomb && level.hunt > 0) markHuntSpots(squad, state, me, range);
  const lateRound = state.config.mode !== 'solo'
    && state.roundElapsedMs > VERSUS_ROUND_MS - CENTRE_SEEK_MS;
  const centreX = (width - 1) / 2;
  const centreY = (height - 1) / 2;
  setScreenBox(state, me, 1);
  const start = startSearch(squad, me, cellMs);
  const {
    stamp, depth, parent, queue, arrive,
  } = squad;
  const { stampId } = squad;
  let head = 0;
  let tail = 1;
  let best = -1;
  let bestScore = 0;
  let near = start;
  let nearCost = Infinity;
  const avoid = state.tick < brain.avoidUntilTick ? brain.avoidCell : -1;
  while (head < tail) {
    const cell = queue[head];
    head += 1;
    const d = depth[cell];
    const cx = cell % width;
    const cy = (cell - cx) / width;
    if (restSafe(squad, field, start, cell, cellMs, margin, GOAL_REST_MS)) {
      let value = 0;
      const item = state.map[cy][cx];
      if (item !== 'Empty' && d <= level.powerUpReach) value += level.powerUp;
      if (hasBomb && item === 'Empty') {
        if (squad.huntMark[cell] === squad.huntId) value += level.hunt;
        if (level.farm > 0) {
          value += level.farm * Math.min(3, countCrates(state.map, cx, cy, range));
        }
      }
      if (value > 0) {
        const score = value - d * STEP_COST + (cell === brain.goal ? 0.4 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = cell;
        }
      }
      const cost = lateRound
        ? Math.abs(cx - centreX) + Math.abs(cy - centreY) + d * 0.1
        : Math.max(level.approachDistance, nearestEnemyDistance(state, me, cx, cy)) + d * STEP_COST;
      if (cost < nearCost) {
        nearCost = cost;
        near = cell;
      }
    }
    if (d >= MAX_GOAL_DEPTH) continue;
    for (let dir = 0; dir < 4; dir += 1) {
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = ny * width + nx;
      if (stamp[next] === stampId || next === avoid) continue;
      if (cell === start && !canLeaveStart(state, me, dir)) continue;
      if (!isWalkableItem(state.map[ny][nx])) continue;
      if (!insideBox(nx, ny, me) || occupiedByOther(state, me, nx, ny)) continue;
      const time = stepArrive(squad, me, field, start, cell, next, cellMs, margin);
      if (time < 0) continue;
      stamp[next] = stampId;
      depth[next] = d + 1;
      parent[next] = cell;
      arrive[next] = time;
      queue[tail] = next;
      tail += 1;
    }
  }
  const target = best >= 0 && !lateRound ? best : near;
  brain.goal = target;
  if (target === start) {
    brain.pathLen = 0;
    return;
  }
  writePath(squad, brain, target);
}

const blastHits = { enemies: 0, crates: 0, monsters: 0 };

// What the preview blast would catch: enemies standing in it, crates it breaks.
function countBlastHits(
  squad: CpuSquad,
  state: GameEngineState,
  me: PlayerState,
  bombs: BombState[]
): typeof blastHits {
  squad.blastId += 1;
  const { width } = squad;
  blastHits.enemies = 0;
  blastHits.crates = 0;
  blastHits.monsters = 0;
  for (let b = 0; b < bombs.length; b += 1) {
    const cells = blastCells(squad, bombs[b], state.map, false);
    for (let c = 0; c < cells.length; c += 1) {
      const cell = cells[c];
      if (squad.blastMark[cell] !== squad.blastId) {
        squad.blastMark[cell] = squad.blastId;
        const x = cell % width;
        if (state.map[(cell - x) / width][x] === 'Box') blastHits.crates += 1;
      }
    }
  }
  for (let p = 0; p < state.players.length; p += 1) {
    const enemy = state.players[p];
    if (enemy.alive && enemy.id !== me.id
      && squad.blastMark[Math.round(enemy.y) * width + Math.round(enemy.x)] === squad.blastId) {
      blastHits.enemies += 1;
    }
  }
  for (let m = 0; m < state.monsters.length; m += 1) {
    const monster = state.monsters[m];
    if (squad.blastMark[Math.round(monster.y) * width + Math.round(monster.x)] === squad.blastId) {
      blastHits.monsters += 1;
    }
  }
  return blastHits;
}

// Drops the bomb (or ultimate) only if an escape with the level's margin
// exists afterwards; the escape route is planned at the same time.
function tryBomb(
  squad: CpuSquad,
  brain: CpuBrain,
  state: GameEngineState,
  me: PlayerState,
  cellMs: number,
  ultimate: boolean,
  moveRepeatMs: (player: PlayerState) => number
): boolean {
  const preview = previewPlayerBombs(state, me.id, ultimate);
  if (!preview) return false;
  const { level } = brain;
  const hits = countBlastHits(squad, state, me, preview.bombs);
  let wanted = ultimate
    ? hits.enemies > 0
    : (hits.enemies > 0 && level.hunt > 0) || hits.monsters > 0
      || (hits.crates > 0 && level.farm > 0);
  if (!wanted && !level.traps) return false;
  buildDanger(squad, state, brain, squad.whatIf, preview.bombs);
  if (!wanted) {
    // A trap: the blast (with every bomb already down) leaves a nearby
    // enemy no escape even if it reacts at once.
    for (let p = 0; p < state.players.length && !wanted; p += 1) {
      const enemy = state.players[p];
      if (enemy.alive && enemy.id !== me.id
        && Math.abs(enemy.x - me.x) + Math.abs(enemy.y - me.y) <= me.bombRange + 4
        && !planEscape(
          squad,
          brain,
          state,
          enemy,
          squad.whatIf,
          moveRepeatMs(enemy) * 10,
          0,
          TRAP_REST_MS,
          preview.bombs,
          false,
          level.trapDelayMs
        )) {
        wanted = true;
      }
    }
    if (!wanted) return false;
  }
  const restMs = Math.max(level.horizonMs, MIN_REST_MS);
  const rash = hits.enemies === 0 && level.rashChance > 0
    && roll(squad.seed, state.tick, brain.slot, 3) < level.rashChance;
  if (!rash && !planEscape(
    squad,
    brain,
    state,
    preview.owner,
    squad.whatIf,
    cellMs,
    level.bombMarginMs,
    restMs,
    preview.bombs,
    false
  )) return false;
  planEscape(
    squad,
    brain,
    state,
    preview.owner,
    squad.whatIf,
    cellMs,
    level.marginMs,
    restMs,
    preview.bombs,
    true
  );
  brain.fleeing = true;
  brain.lastBombTick = state.tick;
  // It knows its own bomb is coming, whatever its horizon for others' bombs.
  let fuse = 0;
  for (let b = 0; b < preview.bombs.length; b += 1) {
    fuse = Math.max(fuse, preview.bombs[b].manualDetonation ? 0 : preview.bombs[b].ticksRemaining);
  }
  brain.ownBombUntilTick = state.tick + Math.ceil((fuse + EXPLOSION_MS) / TICK_MS);
  return true;
}

function bodyInDanger(
  squad: CpuSquad,
  field: DangerField,
  me: PlayerState,
  horizonMs: number,
  margin: number,
  threatMs: number
): boolean {
  const { width, height } = squad;
  const x0 = Math.max(0, Math.ceil(me.x - HURT_REACH));
  const x1 = Math.min(width - 1, Math.floor(me.x + HURT_REACH));
  const y0 = Math.max(0, Math.ceil(me.y - HURT_REACH));
  const y1 = Math.min(height - 1, Math.floor(me.y + HURT_REACH));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const cell = y * width + x;
      if (lethal(field, cell, 0, horizonMs, margin)
        || squad.monsterAt[cell] <= threatMs) return true;
    }
  }
  return false;
}

// Is the rest of the current route still clear, timed from where the CPU is?
function pathStillSafe(
  squad: CpuSquad,
  brain: CpuBrain,
  me: PlayerState,
  cellMs: number,
  margin: number,
  restMs: number
): boolean {
  if (brain.pathLen === 0) return false;
  let arrive = 0;
  for (let i = brain.pathIndex; i < brain.pathLen; i += 1) {
    const cell = brain.path[i];
    arrive = i === brain.pathIndex
      ? firstHopMs(me, cell, squad.width, cellMs)
      : arrive + cellMs;
    const last = i === brain.pathLen - 1;
    const from = Math.max(0, entryMs(arrive, cellMs));
    if (lethal(squad.live, cell, from, last ? arrive + restMs : exitMs(arrive, cellMs), margin)) {
      return false;
    }
    if (squad.monsterAt[cell] <= (last ? arrive + squad.monsterRestMs : exitMs(arrive, cellMs))) {
      return false;
    }
  }
  return true;
}

function ownManualBombsClear(
  squad: CpuSquad,
  state: GameEngineState,
  me: PlayerState
): boolean | null {
  let any = false;
  for (let b = 0; b < state.bombs.length; b += 1) {
    const bomb = state.bombs[b];
    if (bomb.ownerId === me.id && bomb.manualDetonation) {
      any = true;
      const cells = blastCells(squad, bomb, state.map, true);
      for (let c = 0; c < cells.length; c += 1) {
        const x = cells[c] % squad.width;
        const y = (cells[c] - x) / squad.width;
        if (Math.abs(me.x - x) <= HURT_REACH + 0.1 && Math.abs(me.y - y) <= HURT_REACH + 0.1) {
          return false;
        }
      }
    }
  }
  return any ? true : null;
}

function noteBombs(brain: CpuBrain, state: GameEngineState): void {
  for (let i = 0; i < state.bombs.length; i += 1) {
    if (!brain.seen.has(state.bombs[i].id)) brain.seen.set(state.bombs[i].id, state.tick);
  }
  if (brain.seen.size > state.bombs.length + 16) {
    brain.seen.forEach((_, id) => {
      if (!state.bombs.some((bomb) => bomb.id === id)) brain.seen.delete(id);
    });
  }
}

/**
 * Runs after every engine tick. Returns the discrete action this CPU takes
 * now, if any; its movement plan is left in the brain for `steerCpuPlayer`.
 */
export function thinkCpuPlayer(
  squad: CpuSquad,
  brain: CpuBrain,
  state: GameEngineState,
  moveRepeatMs: (player: PlayerState) => number
): CpuAction | null {
  const me = state.players[brain.slot];
  if (!me || !me.alive || state.phase !== 'playing' || state.paused
    || state.roundStartTicksRemaining > 0) return null;
  noteBombs(brain, state);

  // Pushing against someone (or the shared screen): think again, routing
  // around the cell it could not enter.
  if (brain.pathLen > 0 && me.x === brain.lastX && me.y === brain.lastY) {
    brain.stuckTicks += 1;
    if (brain.stuckTicks >= STUCK_TICKS) {
      brain.stuckTicks = 0;
      brain.avoidCell = brain.path[Math.min(brain.pathIndex + 1, brain.pathLen - 1)];
      brain.avoidUntilTick = state.tick + 20;
      brain.pathLen = 0;
      brain.rethink = true;
    }
  } else {
    brain.stuckTicks = 0;
  }
  brain.lastX = me.x;
  brain.lastY = me.y;

  if (!brain.rethink && (state.tick + brain.phase) % brain.level.thinkTicks !== 0) return null;
  brain.rethink = false;
  const { level } = brain;
  const cellMs = moveRepeatMs(me) * 10;
  buildDanger(squad, state, brain, squad.live, null);
  markMonsters(squad, state);
  squad.monsterRestMs = level.monsterRestMs;

  const horizonMs = state.tick < brain.ownBombUntilTick ? Infinity : level.horizonMs;
  if (bodyInDanger(squad, squad.live, me, horizonMs, 0, level.monsterThreatMs)) {
    // "Waits too long": now and then a new threat is ignored for a moment.
    if (!brain.fleeing && level.slipChance > 0 && !brain.slipRolled) {
      brain.slipRolled = true;
      if (roll(squad.seed, state.tick, brain.slot, 1) < level.slipChance) {
        brain.slipUntilTick = state.tick + Math.round(level.slipMs / TICK_MS);
      }
    }
    if (state.tick < brain.slipUntilTick) return null;
    const restMs = Math.max(level.horizonMs, MIN_REST_MS);
    if (!brain.fleeing || !pathStillSafe(squad, brain, me, cellMs, level.marginMs, restMs)) {
      planEscape(squad, brain, state, me, squad.live, cellMs, level.marginMs, restMs, null, true);
      brain.fleeing = true;
    }
    return null;
  }
  brain.fleeing = false;
  brain.slipRolled = false;
  brain.slipUntilTick = -1;

  // A detonator bomb goes off once the CPU is clear of it.
  if (ownManualBombsClear(squad, state, me)) return 'DETONATE_BOMBS';

  const sx = Math.round(me.x);
  const sy = Math.round(me.y);
  const here = state.map[sy]?.[sx];
  if (here === 'Empty') {
    if (level.ultimates && me.ultimateCooldownRemaining <= 0
      && nearestEnemyDistance(state, me, sx, sy) <= me.bombRange + 5
      && tryBomb(squad, brain, state, me, cellMs, true, moveRepeatMs)) return 'USE_ULTIMATE';
    const ready = me.activeBombs < bombLimit(me)
      && (state.tick - brain.lastBombTick) * TICK_MS >= level.bombGapMs;
    if (ready) {
      const range = me.bombRange + 1;
      const crates = level.farm > 0 ? countCrates(state.map, sx, sy, range) : 0;
      const enemyNear = nearestEnemyDistance(state, me, sx, sy) <= range + 1;
      let monsterNear = false;
      for (let m = 0; m < state.monsters.length && !monsterNear; m += 1) {
        const monster = state.monsters[m];
        monsterNear = Math.abs(monster.x - sx) + Math.abs(monster.y - sy) <= range + 1;
      }
      if ((crates > 0 || enemyNear || monsterNear)
        && tryBomb(squad, brain, state, me, cellMs, false, moveRepeatMs)) {
        return 'DROP_BOMB';
      }
    }
  }
  planGoal(squad, brain, state, me, cellMs);
  return null;
}

/**
 * Per frame: the held direction (1 up, 2 right, 3 down, 4 left) toward the
 * next waypoint, plus 8 x the buffered-turn fallback; 0 means let go.
 * Allocates nothing.
 */
export function steerCpuPlayer(squad: CpuSquad, brain: CpuBrain, player: PlayerState): number {
  if (brain.pathLen === 0 || !player.alive) return 0;
  const { width } = squad;
  const px = player.x;
  const py = player.y;
  let i = brain.pathIndex;
  while (i < brain.pathLen - 1) {
    const cell = brain.path[i];
    const cx = cell % width;
    const cy = (cell - cx) / width;
    const next = brain.path[i + 1];
    const nx = next % width;
    const ny = (next - nx) / width;
    const between = cx === nx
      ? Math.abs(px - cx) < 0.05 && (py - cy) * (ny - py) > 0
      : Math.abs(py - cy) < 0.05 && (px - cx) * (nx - px) > 0;
    if (!between && Math.abs(px - cx) + Math.abs(py - cy) > WAYPOINT_DISTANCE) break;
    i += 1;
  }
  brain.pathIndex = i;
  const target = brain.path[i];
  const tx = target % width;
  const ty = (target - tx) / width;
  const dx = tx - px;
  const dy = ty - py;
  if (i === brain.pathLen - 1 && Math.abs(dx) + Math.abs(dy) <= ARRIVE_DISTANCE) {
    brain.pathLen = 0;
    return 0;
  }
  let direction: number;
  let fallback = 0;
  if (Math.abs(dx) >= Math.abs(dy)) {
    direction = dx > 0 ? 2 : 4;
    if (Math.abs(dy) > 0.05) fallback = dy > 0 ? 3 : 1;
  } else {
    direction = dy > 0 ? 3 : 1;
    if (Math.abs(dx) > 0.05) fallback = dx > 0 ? 2 : 4;
  }
  return direction + fallback * 8;
}

export function cpuDirection(code: number): (typeof DIRECTIONS)[number] {
  return DIRECTIONS[code & 7];
}

export function cpuFallback(code: number): (typeof DIRECTIONS)[number] {
  return DIRECTIONS[code >> 3];
}
