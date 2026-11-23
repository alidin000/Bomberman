/* eslint-disable no-console -- a command-line report */
// `npm run gates`: the city arenas' quality gates (docs/REAL_CITY_ARENAS_PLAN.md,
// "Quality Gates"; tools/city/README.md says how to run it). It plays CPU-hard
// matches on every city map, the control and the seven shipped arenas through
// the game's own engine loop, CPU AI and camera framing, measures each grid,
// prints the gate tables and writes them to tools/city/GATES.md.
//
// CPU play shows how the mechanics behave, not whether a map is fun: the
// playtest decides that. The shipped arenas are re-measured in every run
// with the same seeds, so the cities are compared with them, not with
// numbers from another run.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { basename, isAbsolute, relative } from 'node:path';
import {
  Worker, isMainThread, parentPort, workerData,
} from 'node:worker_threads';
import { advanceEngineFrame, applyEngineAction, createEngineLoop } from '../../src/hooks/engineLoop';
import {
  GameConfig,
  PLAYER_SPAWNS,
  ROUND_START_COUNTDOWN_MS,
  VERSUS_ROUND_MS,
  createInitialState,
  parseMapRows,
  parseMapText,
} from '../../src/engine';
import { PRESSURE_FILL_MS } from '../../src/engine/suddenDeath';
import type { GameMap } from '../../src/model/gameItem';
import { CHARACTER_DEFINITIONS, CharacterId } from '../../src/content';
import {
  ARENA_MAPS, ArenaMapEntry, arenaMapMask, arenaMapRows,
} from '../../src/content/arenaMaps';
import { getLook } from '../../src/content/stageLooks';
import { placeStageProps } from '../../src/view/GameScreen/scene/landmarkPlacement';
import {
  ScreenInsets, framingScaleFor, groupShift, maxFramingFor, screenX, screenY,
} from '../../src/view/GameScreen/scene/cameraFraming';
import { ARENA_FRAME_PX, canvasHudInsets } from '../../src/view/GameScreen/scene/canvasInsets';
import { DEFAULT_GAME_PREFERENCES } from '../../src/view/GameScreen/gamePreferences';

// --- Settings -------------------------------------------------------------------

/** The plan's seat-balance run is about 400 matches: 14 x the 30 ordered fighter pairs. */
const DEFAULT_REPS = 14;
const FRAME_MS = 1000 / 60;
/** A round that outlasts sudden death's whole spiral is a stuck match, never a result. */
const MAX_FRAMES = Math.ceil(
  (ROUND_START_COUNTDOWN_MS + VERSUS_ROUND_MS + PRESSURE_FILL_MS + 30_000) / FRAME_MS
);
/** The laptop screen the plan's on-screen gate names, at the default HUD size. */
const VIEW = { width: 1366, height: 768 };
/**
 * A village arena played under an id outside the catalog gets no versus
 * monsters (engine/monsterSpawns.ts); the CPU baseline has none.
 */
const NO_MONSTERS_PREFIX = 'gates-no-monsters:';

const HARD = {
  /** Each seat wins this share of decided matches; widened if a shipped arena falls outside it. */
  seatBand: 10,
  /** Half the signature cells on screen for this share of live frames. */
  signatureFrames: 25,
};
/**
 * A skyline landmark is measured at this share of its height: its towers and
 * roofs, not the base the board's top edge often shows alone.
 */
const SKYLINE_SILHOUETTE = 0.5;
const SOFT = {
  playablePct: 75,
  articulationPct: 2,
  deadEnds: 10,
  oneWidePct: 11,
  maxBlob: 15,
  /** Seconds either side of the shipped arenas' range of median match lengths. */
  medianMarginS: 10,
  /** Points above the shipped arenas' highest sudden-death share. */
  suddenMarginPts: 5,
};

type SoftTarget = 'playable' | 'articulation' | 'deadEnds' | 'oneWide' | 'maxBlob' | 'median' | 'sudden';

/**
 * Why a known soft-target miss is accepted, from the map's method.md. A miss
 * with no reason here is flagged for a developer to look at.
 */
const SOFT_MISS_REASONS: Record<string, Partial<Record<SoftTarget, string>>> = {
  budapest: {
    playable: 'the Danube alone is about 14% of the interior; the land is about 83% playable',
  },
};

// --- Options --------------------------------------------------------------------

const USAGE = `npm run gates [-- options]
  --reps N        matches per map: 30 x N (every ordered pair of the 6 fighters); default ${DEFAULT_REPS}
  --workers N     worker threads; default up to 4, leaving 2 cores free
  --maps a,b      play only these catalog maps
  --grid id=path  play this grid file in place of a map's own; a .mask.txt beside it is its mask
  --monsters      shipped arenas keep their versus monsters (cities have none)
  --out path      write the report here (a default run writes tools/city/GATES.md)
  --no-write      print the report only`;

interface Options {
  reps: number;
  workers: number;
  maps: string[] | null;
  grids: Map<string, string>;
  monsters: boolean;
  out: string | null;
}

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(2);
}

function positiveInt(flag: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) fail(`${flag} needs a whole number, got '${value}'`);
  return parsed;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    reps: DEFAULT_REPS,
    workers: Math.max(1, Math.min(4, availableParallelism() - 2)),
    maps: null,
    grids: new Map(),
    monsters: false,
    out: null,
  };
  let write = true;
  let custom = false;
  const ids = new Set(ARENA_MAPS.map((entry) => entry.id as string));
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--reps') {
      options.reps = positiveInt(flag, value);
      index += 1;
      custom = true;
    } else if (flag === '--workers') {
      options.workers = positiveInt(flag, value);
      index += 1;
    } else if (flag === '--maps') {
      options.maps = (value ?? '').split(',').filter(Boolean);
      options.maps.forEach((id) => { if (!ids.has(id)) fail(`--maps: unknown map '${id}'`); });
      index += 1;
      custom = true;
    } else if (flag === '--grid') {
      const [id, path] = (value ?? '').split('=');
      if (!ids.has(id) || !path) fail(`--grid needs <catalog id>=<grid file>, got '${value}'`);
      if (!existsSync(path)) fail(`--grid: no file at '${path}'`);
      options.grids.set(id, path);
      index += 1;
      custom = true;
    } else if (flag === '--monsters') {
      options.monsters = true;
      custom = true;
    } else if (flag === '--out') {
      if (!value) fail('--out needs a path');
      options.out = value;
      index += 1;
    } else if (flag === '--no-write') {
      write = false;
    } else if (flag === '--help' || flag === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      fail(`unknown option '${flag}'`);
    }
  }
  // Only a default run replaces the committed report; any other run says where it goes.
  if (!write) options.out = null;
  else if (!options.out && !custom) options.out = 'tools/city/GATES.md';
  return options;
}

// --- Maps -----------------------------------------------------------------------

type Cell = { x: number; y: number };

interface MapSpec {
  id: string;
  family: ArenaMapEntry['family'];
  name: string;
  /** Where the grid came from, when not the catalog's own. */
  source: string | null;
  rows: string[][];
  mask: string[] | null;
  /** The board's signature: the mask's landmark (`m`) cells. */
  board: Cell[];
  /** The skyline landmark's footprint cells, on the far band past the top edge. */
  skyline: Cell[];
  /** How high above its footprint the skyline landmark is measured, in cells. */
  skylineHeight: number;
  /** The id the engine plays it under (the monster rule follows it). */
  selectedMap: string;
}

function readRows(path: string): string[] {
  return readFileSync(path, 'utf8').split(/\r?\n/).map((row) => row.trimEnd()).filter(Boolean);
}

function maskCells(mask: string[] | null, cls: string): Cell[] {
  return (mask ?? []).flatMap((row, y) => Array.from(row).flatMap((cell, x) => (
    cell === cls ? [{ x, y }] : []
  )));
}

/**
 * The cells under the look's famous skyline place, where the game itself puts
 * it, and the height its silhouette is measured at.
 */
function skylineOf(entry: ArenaMapEntry, width: number, height: number) {
  const none = { cells: [] as Cell[], height: 0 };
  if (!entry.skylineLandmark) return none;
  const famous = placeStageProps(getLook(entry.lookId), width, height)
    .find((prop) => prop.famous && prop.kind === entry.skylineLandmark);
  if (!famous) return none;
  const cells: Cell[] = [];
  const top = Math.ceil(famous.y - famous.halfDepth);
  const left = Math.ceil(famous.x - famous.radius);
  for (let y = top; y <= Math.floor(famous.y + famous.halfDepth); y += 1) {
    for (let x = left; x <= Math.floor(famous.x + famous.radius); x += 1) cells.push({ x, y });
  }
  return {
    cells: cells.length > 0 ? cells : [{ x: Math.round(famous.x), y: Math.round(famous.y) }],
    height: famous.height * SKYLINE_SILHOUETTE,
  };
}

function loadSpecs(options: Options): MapSpec[] {
  // Cities first (the playtest control after them), then the shipped arenas.
  const entries = [...ARENA_MAPS]
    .filter((entry) => !options.maps || options.maps.includes(entry.id))
    .sort((a, b) => Number(a.family !== 'city') - Number(b.family !== 'city')
      || Number(a.playtestOnly) - Number(b.playtestOnly));
  return entries.map((entry) => {
    const override = options.grids.get(entry.id) ?? null;
    const maskPath = override ? override.replace(/\.txt$/, '.mask.txt') : null;
    const ownMask = arenaMapMask(entry.id);
    let mask: string[] | null = null;
    if (maskPath && maskPath !== override && existsSync(maskPath)) mask = readRows(maskPath);
    else if (!override && ownMask) mask = [...ownMask];
    const rows = override ? parseMapText(readFileSync(override, 'utf8')) : arenaMapRows(entry.id);
    const width = Math.max(...rows.map((row) => row.length));
    const villageAsBaseline = entry.family === 'village' && !options.monsters;
    const skyline = skylineOf(entry, width, rows.length);
    return {
      id: entry.id,
      family: entry.family,
      name: entry.playtestOnly ? `${entry.name} (control)` : entry.name,
      source: override,
      rows,
      mask,
      board: maskCells(mask, 'm'),
      skyline: skyline.cells,
      skylineHeight: skyline.height,
      selectedMap: villageAsBaseline ? `${NO_MONSTERS_PREFIX}${entry.id}` : entry.id,
    };
  });
}

/** The map a round starts on: the engine's own spawn carve applied for `seats` players. */
function roundStartMap(spec: MapSpec, seats: number): GameMap {
  return createInitialState({
    mode: 'local',
    numPlayers: seats,
    totalRounds: 1,
    selectedMap: spec.selectedMap,
    map: parseMapRows(spec.rows),
  }).map;
}

// --- Static checks (the hard structural gates and the soft layout targets) -------

const STEPS: readonly Cell[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

interface Layout {
  /** Most authored walls the carve opened, and crates it cleared, with 2 to 4 seats. */
  carveWalls: number;
  carveCrates: number;
  waterAtSpawn: boolean;
  spawnsJoined: boolean;
  sealedCells: number;
  playablePct: number;
  wallsPct: number;
  cratePct: number;
  articulation: number;
  articulationPct: number;
  deadEnds: number;
  oneWidePct: number;
  maxBlob: number;
  lineOpen: number;
  lineClear: number;
}

function reach(
  map: GameMap,
  start: Cell,
  passable: (x: number, y: number) => boolean
): Set<number> {
  const width = map[0].length;
  const seen = new Set([start.y * width + start.x]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    STEPS.forEach((step) => {
      const nx = x + step.x;
      const ny = y + step.y;
      const key = ny * width + nx;
      if (map[ny]?.[nx] === undefined || seen.has(key) || !passable(nx, ny)) return;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    });
  }
  return seen;
}

/** Cut vertices of the 4-neighbour graph of open cells (iterative Tarjan). */
function articulationPoints(open: boolean[][]): number {
  const height = open.length;
  const width = open[0].length;
  const total = width * height;
  const disc = new Int32Array(total).fill(-1);
  const low = new Int32Array(total);
  const parent = new Int32Array(total).fill(-1);
  const cut = new Uint8Array(total);
  const neighbours = (node: number) => STEPS
    .map((step) => ({ x: (node % width) + step.x, y: Math.floor(node / width) + step.y }))
    .filter(({ x, y }) => open[y]?.[x])
    .map(({ x, y }) => y * width + x);
  let time = 0;
  for (let root = 0; root < total; root += 1) {
    if (open[Math.floor(root / width)][root % width] && disc[root] === -1) {
      disc[root] = time;
      low[root] = time;
      time += 1;
      let children = 0;
      const stack: { node: number; next: number[] }[] = [{ node: root, next: neighbours(root) }];
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        const next = top.next.pop();
        if (next !== undefined) {
          if (disc[next] === -1) {
            parent[next] = top.node;
            disc[next] = time;
            low[next] = time;
            time += 1;
            if (top.node === root) children += 1;
            stack.push({ node: next, next: neighbours(next) });
          } else if (next !== parent[top.node]) {
            low[top.node] = Math.min(low[top.node], disc[next]);
          }
        } else {
          stack.pop();
          if (stack.length > 0) {
            const up = stack[stack.length - 1].node;
            low[up] = Math.min(low[up], low[top.node]);
            if (up !== root && low[top.node] >= disc[up]) cut[up] = 1;
          }
        }
      }
      if (children > 1) cut[root] = 1;
    }
  }
  return cut.reduce((sum, value) => sum + value, 0);
}

/** For each open cell, the side of the largest open square that contains it. */
function openSquareWidths(open: boolean[][]): number[][] {
  const height = open.length;
  const width = open[0].length;
  const ending = open.map((row) => row.map(() => 0));
  const best = open.map((row) => row.map(() => 0));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (open[y][x]) {
        ending[y][x] = x === 0 || y === 0
          ? 1
          : 1 + Math.min(ending[y - 1][x], ending[y][x - 1], ending[y - 1][x - 1]);
        const side = ending[y][x];
        for (let dy = 0; dy < side; dy += 1) {
          for (let dx = 0; dx < side; dx += 1) {
            best[y - dy][x - dx] = Math.max(best[y - dy][x - dx], side);
          }
        }
      }
    }
  }
  return best;
}

function longestLine(pass: boolean[][]): number {
  let best = 0;
  const height = pass.length;
  const width = pass[0].length;
  for (let y = 0; y < height; y += 1) {
    let run = 0;
    for (let x = 0; x < width; x += 1) {
      run = pass[y][x] ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  for (let x = 0; x < width; x += 1) {
    let run = 0;
    for (let y = 0; y < height; y += 1) {
      run = pass[y][x] ? run + 1 : 0;
      best = Math.max(best, run);
    }
  }
  return best;
}

/** The biggest 4-connected wall shape inside the border, leaving out water and the landmark. */
function largestWallBlob(map: GameMap, mask: string[] | null): number {
  const height = map.length;
  const width = map[0].length;
  const inner = (x: number, y: number) => x > 0 && y > 0 && x < width - 1 && y < height - 1;
  const rated = (x: number, y: number) => inner(x, y)
    && map[y][x] === 'Wall'
    && !['w', 'm'].includes(mask?.[y]?.[x] ?? '');
  const seen = new Set<number>();
  let best = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rated(x, y) && !seen.has(y * width + x)) {
        const blob = reach(map, { x, y }, rated);
        blob.forEach((key) => seen.add(key));
        best = Math.max(best, blob.size);
      }
    }
  }
  return best;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function measureLayout(spec: MapSpec): Layout {
  const authored = spec.rows;
  let carveWalls = 0;
  let carveCrates = 0;
  [2, 3, 4].forEach((seats) => {
    const map = roundStartMap(spec, seats);
    let walls = 0;
    let crates = 0;
    authored.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === 'W' && map[y][x] !== 'Wall') walls += 1;
      if (cell === 'B' && map[y][x] !== 'Box') crates += 1;
    }));
    carveWalls = Math.max(carveWalls, walls);
    carveCrates = Math.max(carveCrates, crates);
  });
  const spawnArea = PLAYER_SPAWNS.flatMap((spawn) => [{ x: 0, y: 0 }, ...STEPS].map((step) => (
    { x: spawn.x + step.x, y: spawn.y + step.y }
  )));
  const waterAtSpawn = spawnArea.some(({ x, y }) => spec.mask?.[y]?.[x] === 'w');

  // The rest is measured where play starts: the round-start map with four seats.
  const map = roundStartMap(spec, 4);
  const height = map.length;
  const width = map[0].length;
  const isOpen = (x: number, y: number) => map[y][x] !== 'Wall';
  const isClear = (x: number, y: number) => isOpen(x, y) && map[y][x] !== 'Box';
  const lanes = reach(map, PLAYER_SPAWNS[0], isClear);
  const spawnsJoined = PLAYER_SPAWNS.every((spawn) => lanes.has(spawn.y * width + spawn.x));
  const region = reach(map, PLAYER_SPAWNS[0], isOpen);

  const open = map.map((row, y) => row.map((_, x) => isOpen(x, y)));
  const clear = map.map((row, y) => row.map((_, x) => isClear(x, y)));
  const widths = openSquareWidths(open);
  let interior = 0;
  let walls = 0;
  let crates = 0;
  let playable = 0;
  let deadEnds = 0;
  let oneWide = 0;
  let sealedCells = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      interior += 1;
      if (!open[y][x]) walls += 1;
      else {
        playable += 1;
        if (map[y][x] === 'Box') crates += 1;
        if (widths[y][x] === 1) oneWide += 1;
        if (STEPS.filter((step) => open[y + step.y]?.[x + step.x]).length <= 1) deadEnds += 1;
        if (!region.has(y * width + x)) sealedCells += 1;
      }
    }
  }
  const articulation = articulationPoints(open);
  return {
    carveWalls,
    carveCrates,
    waterAtSpawn,
    spawnsJoined,
    sealedCells,
    playablePct: round1((100 * playable) / interior),
    wallsPct: round1((100 * walls) / interior),
    cratePct: round1((100 * crates) / Math.max(1, playable)),
    articulation,
    articulationPct: round1((100 * articulation) / Math.max(1, playable)),
    deadEnds,
    oneWidePct: round1((100 * oneWide) / Math.max(1, playable)),
    maxBlob: largestWallBlob(map, spec.mask),
    lineOpen: longestLine(open),
    lineClear: longestLine(clear),
  };
}

// --- CPU matches ----------------------------------------------------------------

/** What the camera shows: the 1366x768 canvas inside the arena frame, as CameraRig frames it. */
interface View {
  aspect: number;
  insets: ScreenInsets;
  maxFraming: number;
  cache: Map<string, { scale: number; shift: number }>;
}

function laptopView(): View {
  const width = VIEW.width - 2 * ARENA_FRAME_PX;
  const height = VIEW.height - 2 * ARENA_FRAME_PX;
  const insets = canvasHudInsets(DEFAULT_GAME_PREFERENCES.hudScale, width, height);
  const aspect = width / height;
  return {
    aspect, insets, maxFraming: maxFramingFor(aspect, insets), cache: new Map(),
  };
}

// Players move in 0.1-cell steps, so a few hundred box sizes cover a whole run.
function framingFor(view: View, halfWidth: number, halfDepth: number) {
  const key = `${halfWidth.toFixed(2)}|${halfDepth.toFixed(2)}`;
  let hit = view.cache.get(key);
  if (!hit) {
    const scale = framingScaleFor(halfWidth, halfDepth, view.aspect, view.insets, view.maxFraming);
    hit = { scale, shift: groupShift(scale, halfWidth, halfDepth, view.insets) };
    view.cache.set(key, hit);
  }
  return hit;
}

/** Share of `cells`, `h` cells above the ground, on the canvas for a camera aimed at aimX, aimY. */
function shareOnScreen(
  cells: Cell[],
  h: number,
  aimX: number,
  aimY: number,
  scale: number,
  aspect: number
) {
  let seen = 0;
  cells.forEach(({ x, y }) => {
    const sx = screenX(scale, x - aimX, y - aimY, h, aspect);
    const sy = screenY(scale, y - aimY, h);
    if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) seen += 1;
  });
  return seen / cells.length;
}

interface MatchResult {
  /** The winning seat (0 or 1), -1 for a draw, -2 for a match that never ended. */
  winner: number;
  endMs: number;
  /** Live frames (after the countdown), and those with half the signature on screen. */
  live: number;
  signature: number;
  skyline: number;
}

const FIGHTERS: CharacterId[] = CHARACTER_DEFINITIONS.map((character) => character.id);
/** Every ordered pair of different fighters: each fighter plays each seat against each rival. */
const PAIRS: [CharacterId, CharacterId][] = FIGHTERS.flatMap((first) => FIGHTERS
  .filter((second) => second !== first)
  .map((second): [CharacterId, CharacterId] => [first, second]));

/** The same seeds on every map, so maps differ only by their grid. */
function matchSeed(rep: number, pair: number): number {
  return 1000 + rep * 1009 + pair * 17;
}

function playMatch(
  spec: MapSpec,
  pair: [CharacterId, CharacterId],
  seed: number,
  view: View
): MatchResult {
  const config: GameConfig = {
    mode: 'local',
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: spec.selectedMap,
    map: parseMapRows(spec.rows),
    selectedCharacters: pair,
    seed,
    controllers: ['cpu-hard', 'cpu-hard'],
  };
  const loop = createEngineLoop();
  applyEngineAction(loop, { type: 'INIT', config });
  if (spec.selectedMap.startsWith(NO_MONSTERS_PREFIX) && loop.state!.monsters.length > 0) {
    throw new Error(`${spec.id}: the no-monster baseline started with monsters`);
  }
  // The board's landmark lies on the ground; a skyline one is measured at its silhouette.
  const onBoard = spec.board.length > 0;
  const signatureCells = onBoard ? spec.board : spec.skyline;
  const signatureHeight = onBoard ? 0 : spec.skylineHeight;
  let live = 0;
  let signature = 0;
  let skyline = 0;
  for (let frame = 0; frame < MAX_FRAMES && loop.state!.phase === 'playing'; frame += 1) {
    advanceEngineFrame(loop, FRAME_MS);
    const state = loop.state!;
    if (state.phase === 'playing' && state.roundStartTicksRemaining <= 0) {
      live += 1;
      // CameraRig's rule: the box round the living players (everyone once
      // nobody is), fitted to the screen and shifted clear of the HUD.
      const alive = state.players.filter((player) => player.alive);
      const framed = alive.length > 0 ? alive : state.players;
      const xs = framed.map((player) => player.x);
      const ys = framed.map((player) => player.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const halfWidth = framed.length > 1 ? (maxX - minX) / 2 : 0;
      const halfDepth = framed.length > 1 ? (maxY - minY) / 2 : 0;
      const { scale, shift } = framingFor(view, halfWidth, halfDepth);
      const aimX = (minX + maxX) / 2;
      const aimY = (minY + maxY) / 2 + shift;
      const seen = (cells: Cell[], h: number) => cells.length > 0
        && shareOnScreen(cells, h, aimX, aimY, scale, view.aspect) >= 0.5;
      if (seen(signatureCells, signatureHeight)) signature += 1;
      if (seen(spec.skyline, spec.skylineHeight)) skyline += 1;
    }
  }
  const state = loop.state!;
  let winner = -2;
  if (state.phase !== 'playing') {
    const won = state.roundWinners[0];
    winner = state.players.findIndex((player) => player.id === won);
  }
  return {
    winner, endMs: state.roundElapsedMs, live, signature, skyline,
  };
}

/** One rep: every ordered fighter pair once on one map. */
function playRep(spec: MapSpec, rep: number, view: View): MatchResult[] {
  return PAIRS.map((pair, index) => playMatch(spec, pair, matchSeed(rep, index), view));
}

type Task = { map: number; rep: number };
type Done = Task & { results: MatchResult[] };

/** Every map's matches, in rep order whatever order the workers finish in. */
async function playAll(specs: MapSpec[], options: Options): Promise<MatchResult[][]> {
  const reps: MatchResult[][][] = specs.map(() => []);
  const tasks: Task[] = specs.flatMap((_, map) => (
    Array.from({ length: options.reps }, (__, rep) => ({ map, rep }))
  ));
  const started = Date.now();
  const record = ({ map, rep, results }: Done) => {
    reps[map][rep] = results;
    if (reps[map].filter(Boolean).length === options.reps) {
      const seconds = Math.round((Date.now() - started) / 1000);
      process.stderr.write(`  ${specs[map].id}: ${options.reps * PAIRS.length} matches (${seconds} s)\n`);
    }
  };
  if (options.workers <= 1) {
    const view = laptopView();
    tasks.forEach((task) => record({ ...task, results: playRep(specs[task.map], task.rep, view) }));
    return reps.map((list) => list.flat());
  }
  // Workers run this same bundle (process.argv[1]) and play one rep per task.
  const workers = Array.from({ length: Math.min(options.workers, tasks.length) }, () => (
    new Worker(process.argv[1], { workerData: { specs } })
  ));
  try {
    await new Promise<void>((resolve, reject) => {
      let next = 0;
      let finished = 0;
      const feed = (worker: Worker) => {
        if (next >= tasks.length) return;
        worker.postMessage(tasks[next]);
        next += 1;
      };
      workers.forEach((worker) => {
        worker.on('message', (done: Done) => {
          record(done);
          finished += 1;
          if (finished === tasks.length) resolve();
          else feed(worker);
        });
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (finished < tasks.length) reject(new Error(`a worker exited with code ${code}`));
        });
        feed(worker);
      });
    });
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  return reps.map((list) => list.flat());
}

function workerMain() {
  const { specs } = workerData as { specs: MapSpec[] };
  const view = laptopView();
  parentPort!.on('message', (task: Task) => {
    const done: Done = { ...task, results: playRep(specs[task.map], task.rep, view) };
    parentPort!.postMessage(done);
  });
}

// --- Summaries and gates --------------------------------------------------------

interface Play {
  matches: number;
  decided: number;
  draws: number;
  unfinished: number;
  seat1Pct: number;
  /** 95% Wilson interval of seat 1's share of decided matches. */
  seat1Low: number;
  seat1High: number;
  medianS: number;
  suddenPct: number;
  /** Share of live frames with half the signature (board, else skyline) on screen. */
  signaturePct: number | null;
  skylinePct: number | null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function wilson(successes: number, trials: number): [number, number] {
  if (trials === 0) return [0, 100];
  const z = 1.96;
  const p = successes / trials;
  const centre = p + (z * z) / (2 * trials);
  const spread = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
  const scale = 1 + (z * z) / trials;
  return [round1((100 * (centre - spread)) / scale), round1((100 * (centre + spread)) / scale)];
}

function summarize(spec: MapSpec, results: MatchResult[]): Play {
  const decided = results.filter((result) => result.winner >= 0);
  const seat1 = decided.filter((result) => result.winner === 0).length;
  const [seat1Low, seat1High] = wilson(seat1, decided.length);
  const live = results.reduce((sum, result) => sum + result.live, 0);
  const share = (frames: number) => round1((100 * frames) / Math.max(1, live));
  const hasSignature = spec.board.length > 0 || spec.skyline.length > 0;
  return {
    matches: results.length,
    decided: decided.length,
    draws: results.filter((result) => result.winner === -1).length,
    unfinished: results.filter((result) => result.winner === -2).length,
    seat1Pct: round1((100 * seat1) / Math.max(1, decided.length)),
    seat1Low,
    seat1High,
    medianS: round1(median(results.map((result) => result.endMs)) / 1000),
    suddenPct: round1((100 * results.filter((result) => result.endMs >= VERSUS_ROUND_MS).length)
      / Math.max(1, results.length)),
    signaturePct: hasSignature
      ? share(results.reduce((sum, result) => sum + result.signature, 0))
      : null,
    skylinePct: spec.skyline.length > 0
      ? share(results.reduce((sum, result) => sum + result.skyline, 0))
      : null,
  };
}

interface Bands {
  /** Seat 1's share of decided matches must sit in [50 - seat, 50 + seat]. */
  seat: number;
  medianLow: number | null;
  medianHigh: number | null;
  suddenMax: number | null;
}

/** The gates' bands, with the shipped arenas re-measured in this run. */
function bandsFrom(specs: MapSpec[], plays: Play[]): Bands {
  const shipped = plays.filter((_, index) => specs[index].family === 'village');
  if (shipped.length === 0) {
    return {
      seat: HARD.seatBand, medianLow: null, medianHigh: null, suddenMax: null,
    };
  }
  // The plan: widen the seat band if a shipped arena falls outside it.
  const seat = Math.max(HARD.seatBand, ...shipped.map((play) => Math.abs(play.seat1Pct - 50)));
  const medians = shipped.map((play) => play.medianS);
  return {
    seat,
    medianLow: round1(Math.min(...medians) - SOFT.medianMarginS),
    medianHigh: round1(Math.max(...medians) + SOFT.medianMarginS),
    suddenMax: round1(Math.max(...shipped.map((play) => play.suddenPct)) + SOFT.suddenMarginPts),
  };
}

interface Verdict {
  hard: { gate: string; pass: boolean; detail: string }[];
  soft: { target: SoftTarget; detail: string; reason: string | null }[];
}

function judge(spec: MapSpec, layout: Layout, play: Play, bands: Bands): Verdict {
  const city = spec.family === 'city';
  const hard: Verdict['hard'] = [];
  const soft: Verdict['soft'] = [];
  if (city) {
    hard.push({
      gate: 'spawns',
      pass: layout.spawnsJoined && layout.sealedCells === 0,
      detail: `${layout.spawnsJoined ? 'joined' : 'NOT joined'} by crate-free lanes, ${layout.sealedCells} sealed cells`,
    });
    hard.push({
      gate: 'spawn carve',
      pass: layout.carveWalls === 0 && !layout.waterAtSpawn,
      detail: `${layout.carveWalls} walls opened, ${layout.waterAtSpawn ? 'water' : 'no water'} at a spawn`,
    });
  }
  hard.push({
    gate: 'seat balance',
    pass: play.unfinished === 0 && Math.abs(play.seat1Pct - 50) <= bands.seat,
    detail: `seat 1 won ${play.seat1Pct}% of ${play.decided} decided (95% CI ${play.seat1Low}-${play.seat1High})`,
  });
  if (city) {
    const share = play.signaturePct ?? 0;
    hard.push({
      gate: 'signature on screen',
      pass: share >= HARD.signatureFrames,
      detail: `${share}% of live frames (${spec.board.length > 0 ? 'board' : 'skyline'})`,
    });
  }
  const reason = (target: SoftTarget) => SOFT_MISS_REASONS[spec.id]?.[target] ?? null;
  const miss = (target: SoftTarget, failed: boolean, detail: string) => {
    if (failed) soft.push({ target, detail, reason: reason(target) });
  };
  miss('playable', layout.playablePct < SOFT.playablePct, `playable ${layout.playablePct}% < ${SOFT.playablePct}%`);
  miss(
    'articulation',
    layout.articulationPct > SOFT.articulationPct,
    `articulation points ${layout.articulationPct}% > ${SOFT.articulationPct}%`
  );
  miss('deadEnds', layout.deadEnds > SOFT.deadEnds, `dead ends ${layout.deadEnds} > ${SOFT.deadEnds}`);
  miss('oneWide', layout.oneWidePct > SOFT.oneWidePct, `1-wide ${layout.oneWidePct}% > ${SOFT.oneWidePct}%`);
  miss('maxBlob', layout.maxBlob > SOFT.maxBlob, `wall blob ${layout.maxBlob} > ${SOFT.maxBlob}`);
  if (bands.medianLow !== null && bands.medianHigh !== null) {
    miss(
      'median',
      play.medianS < bands.medianLow || play.medianS > bands.medianHigh,
      `median match ${play.medianS} s outside ${bands.medianLow}-${bands.medianHigh} s`
    );
  }
  if (bands.suddenMax !== null) {
    miss('sudden', play.suddenPct > bands.suddenMax, `sudden death ${play.suddenPct}% > ${bands.suddenMax}%`);
  }
  return { hard, soft };
}

// --- Report ---------------------------------------------------------------------

function table(header: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

const pct = (value: number | null) => (value === null ? 'n/a' : `${value}%`);

function report(
  specs: MapSpec[],
  layouts: Layout[],
  plays: Play[],
  bands: Bands,
  options: Options
): string {
  const verdicts = specs.map((spec, index) => judge(spec, layouts[index], plays[index], bands));
  const cities = specs.map((spec, index) => ({ spec, index })).filter(({ spec }) => spec.family === 'city');
  const date = new Date().toISOString().slice(0, 10);
  const matches = options.reps * PAIRS.length;
  const lines: string[] = [];
  lines.push('# City Arena Gates', '');
  lines.push(
    `Written by \`npm run gates\` on ${date} (tools/city/README.md says how to run it).`,
    `Each map played ${matches} CPU-hard matches, 2 players, ${options.monsters ? 'shipped arenas with their versus monsters' : 'no monsters'}:`,
    `every ordered pair of the ${FIGHTERS.length} fighters ${options.reps === 1 ? 'once' : `${options.reps} times`}, with the same seeds on every map.`,
    'The shipped arenas are re-measured in the same run. Gates and targets are in',
    'docs/REAL_CITY_ARENAS_PLAN.md, "Quality Gates".',
    ''
  );
  const overrides = specs.filter((spec) => spec.source);
  if (overrides.length > 0) {
    // Repository paths only: a report may be committed, so no local path goes in it.
    const shown = (path: string) => {
      const inside = relative(process.cwd(), path);
      return inside.startsWith('..') || isAbsolute(inside) ? basename(path) : inside;
    };
    lines.push(`Grids replaced for this run: ${overrides.map((spec) => `${spec.id} from \`${shown(spec.source!)}\``).join(', ')}.`, '');
  }

  lines.push('## Hard Gates', '');
  lines.push(
    `Seat balance: each seat wins ${50 - bands.seat}-${50 + bands.seat}% of decided matches`
    + `${bands.seat > HARD.seatBand ? ' (widened: a shipped arena fell outside 40-60%)' : ''}.`,
    `Signature on screen: at least half of the signature cells inside the ${VIEW.width}x${VIEW.height}`,
    `play view for at least ${HARD.signatureFrames}% of live frames (the countdown does not count).`,
    ''
  );
  lines.push(table(
    ['Map', 'Spawns', 'Spawn carve', 'Seat balance', 'Signature on screen', 'Result'],
    cities.map(({ spec, index }) => {
      const gate = (name: string) => {
        const found = verdicts[index].hard.find((item) => item.gate === name);
        return found ? `${found.pass ? 'pass' : '**FAIL**'}: ${found.detail}` : 'n/a';
      };
      const passed = verdicts[index].hard.every((item) => item.pass);
      return [
        spec.name,
        gate('spawns'),
        gate('spawn carve'),
        gate('seat balance'),
        gate('signature on screen'),
        passed ? 'PASS' : '**FAIL**',
      ];
    })
  ), '');

  lines.push('## CPU Matches', '');
  lines.push(
    'Seat 1 starts at (1,1), seat 2 at (13,8). Sudden death: the round reached the',
    `${VERSUS_ROUND_MS / 1000} s clock. Signature: the board's landmark cells (the mask's \`m\`),`,
    "else the skyline landmark's footprint on the far band, measured at half the landmark's",
    'height (its towers and roofs, not its base); skyline: that measure alone.',
    ''
  );
  lines.push(table(
    ['Map', 'Matches', 'Decided', 'Draws', 'Seat 1 wins (95% CI)', 'Median match', 'Sudden death', 'Signature on screen', 'Skyline on screen'],
    specs.map((spec, index) => {
      const play = plays[index];
      return [
        spec.name,
        play.matches,
        play.decided,
        play.draws + (play.unfinished ? ` (+${play.unfinished} unfinished)` : ''),
        `${play.seat1Pct}% (${play.seat1Low}-${play.seat1High})`,
        `${play.medianS} s`,
        `${play.suddenPct}%`,
        spec.board.length > 0 ? `${pct(play.signaturePct)} (${spec.board.length} cells)` : pct(play.signaturePct),
        pct(play.skylinePct),
      ];
    })
  ), '');
  if (bands.medianLow !== null) {
    lines.push(
      `Soft targets from the shipped arenas in this run: median match ${bands.medianLow}-${bands.medianHigh} s`,
      `(their range ± ${SOFT.medianMarginS} s), sudden death at most ${bands.suddenMax}% (their highest + ${SOFT.suddenMarginPts}).`,
      ''
    );
  }

  lines.push('## Layout', '');
  lines.push(
    'Measured on the round-start map (the engine\'s spawn carve, 4 seats), inside the wall',
    'border, crates counted as passable. Wall blob leaves out water and the board\'s',
    'landmark. Line: the longest straight run of open cells, then of crate-free cells.',
    `Soft targets: playable ≥ ${SOFT.playablePct}%, articulation points ≤ ${SOFT.articulationPct}% of playable,`,
    `dead ends ≤ ${SOFT.deadEnds}, 1-wide cells ≤ ${SOFT.oneWidePct}%, wall blob ≤ ${SOFT.maxBlob}.`,
    ''
  );
  lines.push(table(
    ['Map', 'Playable', 'Walls', 'Crates (of playable)', 'Artic. points', 'Dead ends', '1-wide', 'Wall blob', 'Line', 'Carve (walls / crates)'],
    specs.map((spec, index) => {
      const layout = layouts[index];
      return [
        spec.name,
        `${layout.playablePct}%`,
        `${layout.wallsPct}%`,
        `${layout.cratePct}%`,
        `${layout.articulation} (${layout.articulationPct}%)`,
        layout.deadEnds,
        `${layout.oneWidePct}%`,
        layout.maxBlob,
        `${layout.lineOpen} / ${layout.lineClear}`,
        `${layout.carveWalls} / ${layout.carveCrates}`,
      ];
    })
  ), '');

  lines.push('## Soft-Target Misses', '');
  const misses = cities.flatMap(({ spec, index }) => verdicts[index].soft.map((item) => (
    `- **${spec.name}**: ${item.detail}. ${item.reason ? `Accepted: ${item.reason}.` : 'No reason recorded: look at it.'}`
  )));
  lines.push(...(misses.length > 0 ? misses : ['None.']), '');
  return lines.join('\n');
}

// --- Main -----------------------------------------------------------------------

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const specs = loadSpecs(options);
  const started = Date.now();
  process.stderr.write(`Playing ${specs.length} maps x ${options.reps * PAIRS.length} matches on ${options.workers} worker(s)\n`);
  const layouts = specs.map(measureLayout);
  const results = await playAll(specs, options);
  const plays = specs.map((spec, index) => summarize(spec, results[index]));
  const bands = bandsFrom(specs, plays);
  const text = report(specs, layouts, plays, bands, options);
  console.log(text);
  if (options.out) {
    writeFileSync(options.out, `${text.trimEnd()}\n`);
    process.stderr.write(`Wrote ${options.out}\n`);
  }
  process.stderr.write(`Done in ${Math.round((Date.now() - started) / 1000)} s\n`);
  const cityFails = specs.some((spec, index) => spec.family === 'city'
    && judge(spec, layouts[index], plays[index], bands).hard.some((item) => !item.pass));
  if (cityFails) process.exitCode = 1;
}

if (isMainThread) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  workerMain();
}
