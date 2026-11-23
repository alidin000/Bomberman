import { GameMode, StageId } from './types';
import { STAGE_DEFINITIONS } from './stages';
import type { CityLandmarkKind, LookId } from './stageLooks';
import { loadStageMapRows, parseMapText } from '../engine/mapLoader';
// The city grids and masks ship inside the bundle like the stage maps
// (engine/mapLoader.ts): a match never waits on a fetch, and no map data is
// requested from OpenStreetMap or anywhere else at runtime.
/* eslint-disable import/no-unresolved -- Vite `?raw` imports */
import romeGrid from '../../public/maps/city/rome.txt?raw';
import romeMask from '../../public/maps/city/rome.mask.txt?raw';
import barcelonaGrid from '../../public/maps/city/barcelona.txt?raw';
import barcelonaMask from '../../public/maps/city/barcelona.mask.txt?raw';
import budapestGrid from '../../public/maps/city/budapest.txt?raw';
import budapestMask from '../../public/maps/city/budapest.mask.txt?raw';
import romeControlGrid from '../../public/maps/city/romeControl.txt?raw';
import romeControlMask from '../../public/maps/city/romeControl.mask.txt?raw';
/* eslint-enable import/no-unresolved */

/**
 * Every map Arena mode plays, in one catalog: the seven village arenas
 * (their stage ids, grids, monsters and looks as before) and the city
 * arenas built from OpenStreetMap. City ids are never StageIds: the
 * campaign, the hub and the online lobby keep their own stage lists.
 */
export type CityArenaId = 'rome' | 'barcelona' | 'budapest' | 'romeControl';
export type ArenaMapId = StageId | CityArenaId;
export type ArenaFamily = 'village' | 'city';

/** A map's versus monsters: an existing village set, or none at all. */
export type ArenaMonsterRule = StageId | 'none';

export interface ArenaAttribution {
  /** The credit line, linked to `href` wherever a link fits. */
  text: string;
  href: string;
  /**
   * Where the map's source data, method and hand edits are published: the
   * ODbL 4.6 offer, linked beside the credit wherever the credit is linked.
   */
  source: { text: string; href: string };
  /** Further credits the map needs, such as a structure's designer. */
  credits: readonly string[];
}

export interface ArenaMapEntry {
  id: ArenaMapId;
  family: ArenaFamily;
  name: string;
  /** One line for the Mission Deck under the picker. */
  caption: string;
  lookId: LookId;
  monsters: ArenaMonsterRule;
  /**
   * The famous place on the skyline (its look's anchored landmark). The
   * board's own signature cells are the mask's `m` cells
   * (arenaSignatureCells); a place is never shown in both.
   */
  skylineLandmark: CityLandmarkKind | null;
  attribution: ArenaAttribution | null;
  /** Listed in the Mission Deck only with ?playtest=1; its route always plays. */
  playtestOnly: boolean;
}

export const OSM_ATTRIBUTION_TEXT = '© OpenStreetMap contributors';
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
/**
 * The city maps' OSM extracts, queries, method and hand edits: tools/city in
 * the game's public repository. Players of the deployed game reach it from
 * the credit, and public/maps/city/NOTICE.txt names it too.
 */
export const CITY_SOURCE_URL = 'https://github.com/alidin000/Bomberman/tree/main/tools/city';
export const CITY_SOURCE_TEXT = 'Map data and method';

function osmCredit(credits: readonly string[] = []): ArenaAttribution {
  return {
    text: OSM_ATTRIBUTION_TEXT,
    href: OSM_COPYRIGHT_URL,
    source: { text: CITY_SOURCE_TEXT, href: CITY_SOURCE_URL },
    credits,
  };
}

/**
 * The render mask: one class per cell, read only by the client. `W` cells
 * are the border edge, a building, water or the board's landmark; open and
 * crate cells are plain, road, plaza or pedestrian, park, bridge deck,
 * crossing or tram track.
 */
export const WALL_MASK_CLASSES = ['e', 'b', 'w', 'm'] as const;
export const FLOOR_MASK_CLASSES = ['.', 'r', 'p', 'g', 'd', 'x', 't'] as const;
export type WallMaskClass = typeof WALL_MASK_CLASSES[number];
export type FloorMaskClass = typeof FLOOR_MASK_CLASSES[number];
export type MaskClass = WallMaskClass | FloorMaskClass;

const ROME_CAPTION = 'Roman piazzas and lanes under the Vittoriano\'s white colonnade.';

const CITY_ENTRIES: readonly ArenaMapEntry[] = [
  {
    id: 'rome',
    family: 'city',
    name: 'Rome',
    caption: ROME_CAPTION,
    lookId: 'rome',
    monsters: 'none',
    skylineLandmark: 'vittoriano',
    attribution: osmCredit(),
    playtestOnly: false,
  },
  {
    id: 'barcelona',
    family: 'city',
    name: 'Barcelona',
    caption: 'Eixample blocks turned onto their streets, the Sagrada Família on the skyline.',
    lookId: 'barcelona',
    monsters: 'none',
    skylineLandmark: 'sagradaFamilia',
    attribution: osmCredit(),
    playtestOnly: false,
  },
  {
    id: 'budapest',
    family: 'city',
    name: 'Budapest',
    caption: 'Two banks of the Danube joined by the Chain Bridge, Parliament on the Pest skyline.',
    lookId: 'budapest',
    monsters: 'none',
    skylineLandmark: 'parliament',
    // Both depicted works name their designers (Hungarian law asks it of the
    // bridge; the Parliament on the skyline gets the same credit).
    attribution: osmCredit(['Chain Bridge: William Tierney Clark', 'Parliament: Imre Steindl']),
    playtestOnly: false,
  },
  // The playtest's control: a mirrored village grid dressed exactly as Rome
  // (name, caption, look, skyline and credit), so testers judging which one
  // is laid out like Rome have nothing else to go on. Its credit over-
  // attributes rather than giving the control away.
  {
    id: 'romeControl',
    family: 'city',
    name: 'Rome',
    caption: ROME_CAPTION,
    lookId: 'rome',
    monsters: 'none',
    skylineLandmark: 'vittoriano',
    attribution: osmCredit(),
    playtestOnly: true,
  },
];

// Village arenas keep the stage's name and its rule as their caption.
const VILLAGE_ENTRIES: readonly ArenaMapEntry[] = STAGE_DEFINITIONS.map((stage) => ({
  id: stage.id,
  family: 'village' as const,
  name: stage.name,
  caption: stage.mechanic,
  lookId: stage.id,
  monsters: stage.id,
  skylineLandmark: null,
  attribution: null,
  playtestOnly: false,
}));

/** Village arenas first (in stage order), then the cities. */
export const ARENA_MAPS: readonly ArenaMapEntry[] = [...VILLAGE_ENTRIES, ...CITY_ENTRIES];

const CITY_SOURCES = new Map<string, { grid: string; mask: string }>([
  ['rome', { grid: romeGrid, mask: romeMask }],
  ['barcelona', { grid: barcelonaGrid, mask: barcelonaMask }],
  ['budapest', { grid: budapestGrid, mask: budapestMask }],
  ['romeControl', { grid: romeControlGrid, mask: romeControlMask }],
]);

const BY_ID = new Map<string, ArenaMapEntry>(ARENA_MAPS.map((entry) => [entry.id, entry]));

export function isArenaMapId(id: unknown): id is ArenaMapId {
  return typeof id === 'string' && BY_ID.has(id);
}

/** The catalog entry for a route or saved id, or undefined for any other id. */
export function getArenaMap(id: string | null | undefined): ArenaMapEntry | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function isCityArenaId(id: unknown): id is CityArenaId {
  return getArenaMap(typeof id === 'string' ? id : undefined)?.family === 'city';
}

/** Local Arena and online arena rooms play catalog maps; the campaign and the dojo do not. */
export function isArenaMode(mode: GameMode | undefined): boolean {
  return mode === 'local' || mode === 'onlinePreview';
}

/**
 * The catalog map a match plays: its route id when the mode is an arena
 * mode and the id is in the catalog. The route id is the map's one identity:
 * grid, look and monsters all follow it.
 */
export function arenaMapForConfig(config: {
  mode?: GameMode;
  selectedMap: string;
}): ArenaMapEntry | undefined {
  return isArenaMode(config.mode ?? 'local') ? getArenaMap(config.selectedMap) : undefined;
}

/** A map's versus monster rule, or undefined for an id outside the catalog. */
export function arenaMonsterRule(id: string): ArenaMonsterRule | undefined {
  return getArenaMap(id)?.monsters;
}

const VILLAGE_MAP_IDS = new Map<string, string>(
  STAGE_DEFINITIONS.map((stage) => [stage.id, stage.mapId])
);

/**
 * The authored rows of an arena map, a fresh copy from the bundle: a
 * village's 35x35 stage map, exactly as Local Arena always loaded it, or a
 * city's grid.
 */
export function arenaMapRows(id: ArenaMapId): string[][] {
  const villageMap = VILLAGE_MAP_IDS.get(id);
  if (villageMap) return loadStageMapRows(villageMap);
  const city = CITY_SOURCES.get(id);
  if (!city) throw new Error(`Unknown arena map '${id}'`);
  return parseMapText(city.grid);
}

const MASK_CACHE = new Map<string, readonly string[]>();

/** A city map's render mask, one string per row; null for a village. */
export function arenaMapMask(id: ArenaMapId): readonly string[] | null {
  const city = CITY_SOURCES.get(id);
  if (!city) return null;
  let mask = MASK_CACHE.get(id);
  if (!mask) {
    mask = Object.freeze(city.mask
      .split(/\r?\n/)
      .map((row) => row.replace(/\s+$/, ''))
      .filter((row) => row.length > 0));
    MASK_CACHE.set(id, mask);
  }
  return mask;
}

/** The board cells of a map's signature: its mask's landmark (`m`) cells. */
export function arenaSignatureCells(id: ArenaMapId): { x: number; y: number }[] {
  const mask = arenaMapMask(id) ?? [];
  return mask.flatMap((row, y) => Array.from(row).flatMap((cell, x) => (
    cell === 'm' ? [{ x, y }] : []
  )));
}

/**
 * True when a mask fits a grid: the same size, every class in the alphabet,
 * and wall classes exactly on its `W` cells. The structural gates
 * (arenaMaps.test.ts) hold every committed map to this, and the top-down
 * preview draws nothing for a mask that fails it.
 */
export function maskFitsGrid(
  mask: readonly string[],
  rows: readonly (readonly string[])[]
): boolean {
  if (mask.length !== rows.length) return false;
  const walls = new Set<string>(WALL_MASK_CLASSES);
  const floors = new Set<string>(FLOOR_MASK_CLASSES);
  return rows.every((row, y) => {
    const line = mask[y];
    if (line.length !== row.length) return false;
    return row.every((cell, x) => (
      cell === 'W' ? walls.has(line[x]) : floors.has(line[x])
    ));
  });
}
