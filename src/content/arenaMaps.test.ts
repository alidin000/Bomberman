import { readFileSync } from 'node:fs';
import {
  ARENA_MAPS,
  CITY_SOURCE_URL,
  CityArenaId,
  FLOOR_MASK_CLASSES,
  OSM_ATTRIBUTION_TEXT,
  OSM_COPYRIGHT_URL,
  WALL_MASK_CLASSES,
  arenaMapForConfig,
  arenaMapMask,
  arenaMapRows,
  arenaMonsterRule,
  getArenaMap,
  maskFitsGrid,
} from './arenaMaps';
import { STAGE_DEFINITIONS } from './stages';
import { getLook } from './stageLooks';
import { createInitialState } from '../engine/initialState';
import { loadStageMapRows, parseMapRows } from '../engine/mapLoader';
import { getMonstersForMap } from '../engine/monsterSpawns';
import { PLAYER_SPAWNS } from '../engine/constants';
import type { GameMap } from '../model/gameItem';

const CITY_IDS: CityArenaId[] = ['rome', 'barcelona', 'budapest', 'romeControl'];
const SIZE = 35;
const STEPS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const;

// The committed files, read the way a reviewer would: straight from disk.
function fileRows(path: string): string[] {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter((row) => row.length > 0);
}

function roundStartMap(id: CityArenaId, seats: number): GameMap {
  return createInitialState({
    mode: 'local',
    numPlayers: seats,
    totalRounds: 1,
    selectedMap: id,
    map: parseMapRows(arenaMapRows(id)),
  }).map;
}

/** Cells reachable from `start` through cells that `open` lets a player walk. */
function reachable(
  map: GameMap,
  start: { x: number; y: number },
  open: (cell: GameMap[number][number]) => boolean
): Set<string> {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const { x, y } = queue[index];
    STEPS.slice(1).forEach(([dx, dy]) => {
      const next = { x: x + dx, y: y + dy };
      const key = `${next.x},${next.y}`;
      const cell = map[next.y]?.[next.x];
      if (cell === undefined || seen.has(key) || !open(cell)) return;
      seen.add(key);
      queue.push(next);
    });
  }
  return seen;
}

describe('arena map catalog', () => {
  it('lists the seven village arenas exactly as Local Arena played them, then the cities', () => {
    const villages = ARENA_MAPS.filter((entry) => entry.family === 'village');
    expect(villages.map((entry) => entry.id)).toEqual(STAGE_DEFINITIONS.map((stage) => stage.id));
    villages.forEach((entry) => {
      const stage = STAGE_DEFINITIONS.find((item) => item.id === entry.id)!;
      expect(entry.name).toBe(stage.name);
      expect(entry.caption).toBe(stage.mechanic);
      expect(entry.lookId).toBe(stage.id);
      // Each village keeps its own versus monsters.
      expect(entry.monsters).toBe(stage.id);
      expect(arenaMapRows(entry.id)).toEqual(loadStageMapRows(stage.mapId));
      expect(arenaMapMask(entry.id)).toBeNull();
    });
    expect(ARENA_MAPS.filter((entry) => entry.family === 'city').map((entry) => entry.id))
      .toEqual(CITY_IDS);
    expect(new Set(ARENA_MAPS.map((entry) => entry.id)).size).toBe(ARENA_MAPS.length);
  });

  it('never makes a city a stage, and gives every city no monsters, an OSM credit and its skyline', () => {
    const skyline = {
      rome: 'vittoriano', barcelona: 'sagradaFamilia', budapest: 'parliament', romeControl: 'vittoriano',
    };
    CITY_IDS.forEach((id) => {
      const entry = getArenaMap(id)!;
      expect(STAGE_DEFINITIONS.map((stage) => stage.id as string)).not.toContain(id);
      expect(entry.monsters).toBe('none');
      expect(entry.attribution?.text).toBe(OSM_ATTRIBUTION_TEXT);
      expect(entry.attribution?.href).toBe(OSM_COPYRIGHT_URL);
      // The ODbL 4.6 offer: the published extracts, method and hand edits.
      expect(entry.attribution?.source.href).toBe(CITY_SOURCE_URL);
      expect(entry.skylineLandmark).toBe(skyline[id]);
      // The skyline place stands once, anchored on the far band of its look.
      const anchored = getLook(entry.lookId).landmarks.filter((set) => set.anchor);
      expect(anchored.map((set) => set.kind)).toEqual([skyline[id]]);
      expect(anchored[0].sector).toBe('far');
    });
    // Budapest shows two designed works: the bridge on the board, Parliament on the skyline.
    expect(getArenaMap('budapest')?.attribution?.credits).toEqual([
      'Chain Bridge: William Tierney Clark',
      'Parliament: Imre Steindl',
    ]);
  });

  it('serves a notice with the maps that offers their source and names every credited designer', () => {
    // public/ is deployed with the game: this is the notice its players get.
    const notice = readFileSync('public/maps/city/NOTICE.txt', 'utf8').replace(/\s+/g, ' ');
    expect(notice).toContain(OSM_COPYRIGHT_URL);
    expect(notice).toContain(CITY_SOURCE_URL);
    const credits = CITY_IDS.flatMap((id) => getArenaMap(id)!.attribution!.credits);
    expect(credits.length).toBeGreaterThan(0);
    credits.forEach((credit) => expect(notice).toContain(credit.split(': ')[1]));
  });

  it('dresses the control exactly as Rome, and lists it only for the playtest', () => {
    const rome = getArenaMap('rome')!;
    const control = getArenaMap('romeControl')!;
    expect(control.playtestOnly).toBe(true);
    expect(ARENA_MAPS.filter((entry) => entry.playtestOnly).map((entry) => entry.id)).toEqual(['romeControl']);
    expect({ ...control, id: rome.id, playtestOnly: false }).toEqual(rome);
  });

  it('gives a city its catalog map only in arena modes', () => {
    expect(arenaMapForConfig({ mode: 'local', selectedMap: 'rome' })?.id).toBe('rome');
    expect(arenaMapForConfig({ mode: 'onlinePreview', selectedMap: 'hiddenSand' })?.id).toBe('hiddenSand');
    expect(arenaMapForConfig({ selectedMap: 'budapest' })?.id).toBe('budapest');
    expect(arenaMapForConfig({ mode: 'solo', selectedMap: 'rome' })).toBeUndefined();
    expect(arenaMapForConfig({ mode: 'training', selectedMap: 'hiddenLeaf' })).toBeUndefined();
    expect(arenaMapForConfig({ mode: 'local', selectedMap: 'map1' })).toBeUndefined();
  });

  it('spawns no versus monsters on a city, and keeps every village and legacy set', () => {
    [2, 3, 4].forEach((seats) => {
      CITY_IDS.forEach((id) => expect(getMonstersForMap(id, seats)).toEqual([]));
      expect(getMonstersForMap('hiddenLeaf', seats).length).toBeGreaterThanOrEqual(2);
    });
    // The rule is explicit, not an accident of an unknown id.
    expect(arenaMonsterRule('rome')).toBe('none');
    expect(arenaMonsterRule('hiddenMist')).toBe('hiddenMist');
    expect(arenaMonsterRule('map1')).toBeUndefined();
    expect(getMonstersForMap('map1', 2)).toEqual(getMonstersForMap('hiddenLeaf', 2));
    expect(getMonstersForMap('hiddenMist', 2).map((monster) => monster.name))
      .toEqual(['Hunter Ninja', 'Mist Ninja', 'Water Clone', 'Hidden Mist Shade']);
    expect(getMonstersForMap('nowhere', 2)).toEqual([]);
  });
});

// The plan's structural hard gates, on every city map and the control.
describe.each(CITY_IDS)('city map %s', (id) => {
  const grid = fileRows(`public/maps/city/${id}.txt`);
  const mask = fileRows(`public/maps/city/${id}.mask.txt`);
  const spawnArea = PLAYER_SPAWNS.flatMap((spawn) => STEPS.map(([dx, dy]) => (
    { x: spawn.x + dx, y: spawn.y + dy }
  )));

  it('is a 35x35 grid of open, wall and crate cells inside a full wall border', () => {
    expect(grid).toHaveLength(SIZE);
    grid.forEach((row, y) => {
      expect({ y, width: row.length }).toEqual({ y, width: SIZE });
      expect(row).toMatch(/^[ WB]+$/);
      if (y === 0 || y === SIZE - 1) expect(row).toBe('W'.repeat(SIZE));
      else expect([row[0], row[SIZE - 1]]).toEqual(['W', 'W']);
    });
    // The bundled grid is the committed file.
    expect(arenaMapRows(id)).toEqual(grid.map((row) => row.split('')));
  });

  it('has a mask of the same size: wall classes on W cells, floor classes elsewhere, e round the edge', () => {
    expect(mask).toHaveLength(SIZE);
    const walls = new Set<string>(WALL_MASK_CLASSES);
    const floors = new Set<string>(FLOOR_MASK_CLASSES);
    mask.forEach((row, y) => {
      expect({ y, width: row.length }).toEqual({ y, width: SIZE });
      Array.from(row).forEach((cls, x) => {
        const border = x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1;
        if (border) expect({ x, y, cls }).toEqual({ x, y, cls: 'e' });
        else if (grid[y][x] === 'W') expect({ x, y, wall: walls.has(cls) }).toEqual({ x, y, wall: true });
        else expect({ x, y, floor: floors.has(cls) }).toEqual({ x, y, floor: true });
      });
    });
    expect(maskFitsGrid(mask, grid.map((row) => row.split('')))).toBe(true);
    expect(arenaMapMask(id)).toEqual(mask);
  });

  it('puts no water on a spawn or a spawn\'s neighbour', () => {
    spawnArea.forEach(({ x, y }) => {
      expect({ x, y, cls: mask[y][x] }).not.toEqual({ x, y, cls: 'w' });
    });
  });

  it.each([2, 3, 4])('loses no wall to the engine\'s spawn carve with %i seats', (seats) => {
    const map = roundStartMap(id, seats);
    grid.forEach((row, y) => Array.from(row).forEach((cell, x) => {
      if (cell === 'W') expect({ x, y, cell: map[y][x] }).toEqual({ x, y, cell: 'Wall' });
    }));
  });

  it('joins all four spawns by crate-free lanes at round start, with no sealed pocket', () => {
    const map = roundStartMap(id, 4);
    const [first] = PLAYER_SPAWNS;
    const lanes = reachable(map, first, (cell) => cell === 'Empty');
    PLAYER_SPAWNS.forEach((spawn) => {
      expect({ spawn, joined: lanes.has(`${spawn.x},${spawn.y}`) }).toEqual({ spawn, joined: true });
    });
    // Through crates (they can be blasted), every open cell is reachable.
    const region = reachable(map, first, (cell) => cell !== 'Wall');
    map.forEach((row, y) => row.forEach((cell, x) => {
      if (cell !== 'Wall') expect({ x, y, sealed: !region.has(`${x},${y}`) }).toEqual({ x, y, sealed: false });
    }));
  });
});
