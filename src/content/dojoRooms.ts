import type { GameMap, gameItem } from '../model/gameItem';
import type {
  GameConfig, Point, TrainingCharge, TrainingGoal, TrainingSentry,
} from '../engine/types';
import type { CharacterId, StageId } from './types';
import type { DojoControl } from './dojoControls';
import { DOJO_ROOMS as DOJO_CATALOG, DojoRoomId, DojoRoomInfo } from './dojo';

// The Inkstone Dojo's rooms (the catalog is in dojo.ts). Each room has one
// goal line with the player's own keys; the instructor's explanation (the
// debrief) only shows once the room is cleared.

// Fixed, so a room plays the same way every time (the rooms draw nothing
// random either: crates hide nothing and the sentry walks a set route).
export const DOJO_SEED = 7_310_517;
// Deidara's Clay Spider is a plain four-way blast, the cleanest to learn on.
export const DOJO_CHARACTER: CharacterId = 'deidara';
export const DOJO_STAGE: StageId = 'hiddenLeaf';

/** One step of a room's goal line. */
export interface DojoStep {
  goal: TrainingGoal;
  /** The one-line goal, in the imperative. */
  prompt: string;
  /** The same goal for the phone's one-line strip (about 26 characters). */
  short: string;
  /** The controls the step needs, shown with the player's own keys. */
  controls: readonly DojoControl[];
}

export interface DojoRoom extends DojoRoomInfo {
  /** The room, row by row (see CELL_ITEMS). The player starts at (1, 1). */
  rows: readonly string[];
  steps: readonly DojoStep[];
  charges: readonly TrainingCharge[];
  sentries: readonly TrainingSentry[];
  /** What the instructor says once the room is cleared. */
  debrief: string;
  /** What the instructor says after a fall, by what caused it. */
  retryHint: { blast: string; enemy: string };
}

// Map legend. `S` marks the start, which the engine fixes at (1, 1).
// `#` wall, `.` floor, `B` a crate the goal asks to break, `b` a crate that is
// only there to show the blast, `L` the lantern, `R` the range scroll,
// `C` a training charge.
const CELL_ITEMS: Record<string, gameItem> = {
  '#': 'Wall',
  '.': 'Empty',
  S: 'Empty',
  L: 'Empty',
  C: 'Empty',
  B: 'Box',
  b: 'Box',
  R: 'BlastRangeUp',
};

export function parseDojoRows(rows: readonly string[]): GameMap {
  return rows.map((row, y) => Array.from(row).map((symbol, x) => {
    const item = CELL_ITEMS[symbol];
    if (item === undefined) {
      throw new Error(`Dojo map: unexpected '${symbol}' at ${x},${y}`);
    }
    return item;
  }));
}

/** Every cell marked `symbol`, in reading order. */
export function findDojoCells(rows: readonly string[], symbol: string): Point[] {
  const cells: Point[] = [];
  rows.forEach((row, y) => {
    Array.from(row).forEach((cell, x) => {
      if (cell === symbol) cells.push({ x, y });
    });
  });
  return cells;
}

const LANTERN_WALK_ROWS = [
  '###########',
  '#S..#.....#',
  '#.#.#.###.#',
  '#.#...#L..#',
  '###########',
] as const;

const FUSE_STEP_ROWS = [
  '#########',
  '#S...B..#',
  '#.#####.#',
  '#.......#',
  '#########',
] as const;

const PILLAR_SHADE_ROWS = [
  '###########',
  '#S...C...b#',
  '#.#.#.#.#.#',
  '#....#....#',
  '#.#.#.#.#.#',
  '#....b....#',
  '###########',
] as const;

const SCROLL_SENTRY_ROWS = [
  '###########',
  '#S.R#######',
  '#.#########',
  '#.........#',
  '###########',
] as const;

function catalogEntry(id: DojoRoomId): DojoRoomInfo {
  const entry = DOJO_CATALOG.find((room) => room.id === id);
  if (!entry) throw new Error(`Dojo room ${id} is missing from the catalog`);
  return entry;
}

const [LANTERN] = findDojoCells(LANTERN_WALK_ROWS, 'L');
const [CHARGE] = findDojoCells(PILLAR_SHADE_ROWS, 'C');

// In catalog order.
export const DOJO_ROOM_DETAILS: readonly DojoRoom[] = [
  {
    ...catalogEntry('lanternWalk'),
    rows: LANTERN_WALK_ROWS,
    steps: [{
      goal: { kind: 'reach', x: LANTERN.x, y: LANTERN.y },
      prompt: 'Walk to the lantern',
      short: 'Walk to the lantern',
      controls: ['move'],
    }],
    charges: [],
    sentries: [],
    debrief: 'Good feet. Hold a direction to keep walking. Press the next one a moment before a corner and you turn without stopping.',
    retryHint: {
      blast: 'Walk the path to the lantern. No bombs needed here.',
      enemy: 'Walk the path to the lantern.',
    },
  },
  {
    ...catalogEntry('fuseStep'),
    rows: FUSE_STEP_ROWS,
    steps: [{
      goal: { kind: 'breakCrates', cells: findDojoCells(FUSE_STEP_ROWS, 'B') },
      prompt: 'Break the crate with a bomb, then get clear',
      short: 'Bomb the crate, get clear',
      controls: ['bomb', 'move'],
    }],
    charges: [],
    sentries: [],
    debrief: 'A blast runs out from the bomb in four straight lines. Stepping off the bomb is not enough: get out of its lines, or around a corner, before the fuse ends.',
    retryHint: {
      blast: 'Your own blast caught you. After you drop the bomb, leave its row and column, not just its tile.',
      enemy: 'Drop a bomb beside the crate, then get clear.',
    },
  },
  {
    ...catalogEntry('pillarShade'),
    rows: PILLAR_SHADE_ROWS,
    steps: [{
      goal: { kind: 'outlastCharges' },
      prompt: 'A charge is lit. Read its marks and stand where the blast cannot reach',
      short: 'Step off the marked tiles',
      controls: ['move'],
    }],
    charges: [{
      x: CHARGE.x, y: CHARGE.y, range: 9, fuseMs: 3600,
    }],
    sentries: [],
    debrief: 'The blast filled the row and stopped at the first wall, so the crate behind the wall still stands. Out of the line, or behind a wall, is safe.',
    retryHint: {
      blast: 'The marks on the floor show every tile the blast will reach. Step off them: walls stop it.',
      enemy: 'Step off the marked tiles before the charge goes off.',
    },
  },
  {
    ...catalogEntry('scrollSentry'),
    rows: SCROLL_SENTRY_ROWS,
    steps: [
      {
        goal: { kind: 'collect', cells: findDojoCells(SCROLL_SENTRY_ROWS, 'R') },
        prompt: 'Pick up the range scroll',
        short: 'Grab the range scroll',
        controls: ['move'],
      },
      {
        goal: { kind: 'defeatAll' },
        prompt: 'Catch the Straw Sentry in a blast',
        short: 'Blast the Straw Sentry',
        controls: ['bomb', 'move'],
      },
    ],
    charges: [],
    sentries: [{
      id: 'straw-sentry',
      name: 'Straw Sentry',
      route: [{ x: 9, y: 3 }, { x: 4, y: 3 }],
      moveMs: 900,
    }],
    debrief: 'The scroll added a tile to your blast. Enemies walk into a blast as readily as you do: drop the bomb in their path, then wait around a corner.',
    retryHint: {
      blast: 'Your own blast caught you. Drop the bomb at the corridor mouth, then step back around the corner.',
      enemy: 'Touching the sentry is fatal. Let your blast reach it instead.',
    },
  },
];

export function getDojoRoom(id: DojoRoomId): DojoRoom {
  return DOJO_ROOM_DETAILS.find((room) => room.id === id) ?? DOJO_ROOM_DETAILS[0];
}

/** The room after `id`, or null after the last one. */
export function getNextDojoRoom(id: DojoRoomId): DojoRoom | null {
  const index = DOJO_ROOM_DETAILS.findIndex((room) => room.id === id);
  return index >= 0 ? DOJO_ROOM_DETAILS[index + 1] ?? null : null;
}

/** The match a room plays: one player, the room's map, goals and set pieces. */
export function createDojoConfig(room: DojoRoom): GameConfig {
  return {
    mode: 'training',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: `dojo-${room.id}`,
    map: parseDojoRows(room.rows),
    stageId: DOJO_STAGE,
    selectedCharacters: [DOJO_CHARACTER],
    seed: DOJO_SEED,
    training: {
      roomId: room.id,
      goals: room.steps.map((step) => step.goal),
      charges: room.charges.map((charge) => ({ ...charge })),
      sentries: room.sentries.map((sentry) => ({
        ...sentry,
        route: sentry.route.map((point) => ({ ...point })),
      })),
    },
  };
}

/** The lantern cells a room's reach goals point at, for the 3D marker. */
export function dojoLanternCells(goals: readonly TrainingGoal[] | undefined): Point[] {
  return (goals ?? []).flatMap((goal) => (goal.kind === 'reach' ? [{ x: goal.x, y: goal.y }] : []));
}
