import type { GameConfig } from '../../../engine/types';
import {
  ArenaMapEntry, FloorMaskClass, arenaMapForConfig, arenaMapMask, arenaMapRows,
} from '../../../content/arenaMaps';
import type { StageId } from '../../../content/types';
import type { GameMap } from '../../../model/gameItem';
import {
  CityMaskColors, StageLook, getLook, getStageLook,
} from '../../../content/stageLooks';
import { isCityLookId } from '../../../content/cityColors';
import {
  highContrastMaskColor, highContrastPalette, relativeLuminance, shadeHex,
} from './highContrast';
import type { BuildingContrast, CheckerTones, TileMask } from './staticTiles';
import { CITY_BUILDING_STYLES, buildingClasses, cityMaskRows } from './city/cityBuildings';
import { VILLAGE_BUILDING_STYLES, villageMaskRows } from './city/villageBuildings';
import { placeStageProps } from './landmarkPlacement';

type MapIdentity = Pick<GameConfig, 'mode' | 'selectedMap' | 'stageId'>;

/**
 * The look a match is drawn in. In Arena mode a catalog map's own look,
 * whatever the stored setup says (a village's look is its stage's, as
 * before); the campaign and unknown ids keep their stage's look.
 */
export function sceneLookFor(config: MapIdentity): StageLook {
  const arena = arenaMapForConfig(config);
  return arena ? getLook(arena.lookId) : getStageLook(config.stageId);
}

const FLOOR_COLORS: Record<Exclude<FloorMaskClass, '.'>, keyof CityMaskColors> = {
  r: 'road',
  p: 'plaza',
  g: 'park',
  d: 'deck',
  x: 'crossing',
  t: 'tram',
};

// Even cells sit a shade darker than odd ones, like the palette's checker,
// so cells stay countable on a coloured floor.
const CHECKER_SHADE = 0.94;

/** The colours a city mask draws in, normal or high contrast. */
export function maskTones(
  colors: CityMaskColors,
  highContrast: boolean
): Pick<TileMask, 'floors' | 'water' | 'walls'> {
  const floors: Record<string, CheckerTones> = {};
  (Object.keys(FLOOR_COLORS) as Exclude<FloorMaskClass, '.'>[]).forEach((cls) => {
    const base = colors[FLOOR_COLORS[cls]];
    floors[cls] = highContrast
      ? { a: highContrastMaskColor(base, 'floorA'), b: highContrastMaskColor(base, 'floorB') }
      : { a: base, b: shadeHex(base, CHECKER_SHADE) };
  });
  return {
    floors,
    water: highContrast ? highContrastMaskColor(colors.water, 'water') : colors.water,
    walls: {
      m: highContrast ? highContrastMaskColor(colors.landmark, 'landmark') : colors.landmark,
    },
  };
}

const TILE_MASKS = new Map<string, TileMask>();

/**
 * High contrast's band for buildings: the walls' tone, dark enough for 3:1
 * on every floor and 2:1 against a lighter crate, with a little to spare.
 */
export function contrastBand(
  floors: readonly string[],
  crate: string,
  wall: string
): BuildingContrast {
  const limits = floors.map((floor) => (relativeLuminance(floor) + 0.05) / 3 - 0.05);
  const crateLight = relativeLuminance(crate);
  if (crateLight > relativeLuminance(wall)) limits.push((crateLight + 0.05) / 2 - 0.05);
  return { tone: wall, maxLuminance: Math.max(0.004, Math.min(...limits) * 0.9) };
}

const VILLAGE_MASKS = new WeakMap<object, Map<string, TileMask>>();
const ARENA_ROWS = new Map<string, string[][]>();
const NO_SKIP: ReadonlySet<string> = new Set();

/** An arena's authored rows, read once: its village mask is then one object per map. */
function arenaRows(id: ArenaMapEntry['id']): string[][] {
  let rows = ARENA_ROWS.get(id);
  if (!rows) {
    rows = arenaMapRows(id);
    ARENA_ROWS.set(id, rows);
  }
  return rows;
}

/**
 * A village map's mask, in any mode (arena, online room, campaign,
 * training): no wall colours of its own and the palette floor but for its
 * path, only its walls drawn as the village, when the village has a
 * building style. Null otherwise. One object per grid, village and skipped
 * cells (a campaign's boss gates).
 */
function villageTileMask(
  look: StageLook,
  grid: readonly (readonly unknown[])[],
  skip: ReadonlySet<string>,
  highContrast: boolean
): TileMask | null {
  const style = VILLAGE_BUILDING_STYLES[look.lookId as StageId];
  if (!style) return null;
  const key = `${look.lookId}|${highContrast ? 'high' : 'normal'}|${[...skip].sort().join(';')}`;
  let masks = VILLAGE_MASKS.get(grid);
  if (!masks) {
    masks = new Map();
    VILLAGE_MASKS.set(grid, masks);
  }
  let mask = masks.get(key);
  if (!mask) {
    // High contrast keeps the palette's own floor (no path) and retones the village.
    const board = highContrastPalette(look.palette);
    const path = style.path && !highContrast;
    mask = {
      rows: villageMaskRows(grid, skip),
      floors: path ? { p: { a: style.path!, b: shadeHex(style.path!, CHECKER_SHADE) } } : {},
      water: style.borderGround,
      walls: {},
      buildings: {
        kind: 'village',
        classes: 'be',
        style,
        seed: look.lookId,
        crate: style.crate,
        ...(highContrast
          ? { contrast: contrastBand([board.groundA, board.groundB], board.crate, board.wall) }
          : {}),
      },
    };
    masks.set(key, mask);
  }
  return mask;
}

/**
 * A match's render mask in its look's colours: a city map's, a village's
 * (its walls as the village, in every mode), or null. One object per map,
 * look, contrast setting and buildings choice, so the tiles rebuild only when
 * one of them changes. A village outside the arena catalog (the campaign,
 * training) builds from the match's own `map`; `skip` keeps cells that change
 * (a campaign's boss gates) out of its buildings.
 *
 * With `buildings`, a city's building and border walls, and its landmark,
 * draw as merged buildings (scene/city/CityBuildings.tsx) on a pavement
 * floor, and crossing cells take the road's tone under their stripes. High
 * contrast keeps its own floors and retones the buildings into the walls'
 * dark band (contrastBand), so they keep the contrast the walls had.
 */
export function sceneTileMask(
  arena: ArenaMapEntry | undefined,
  look: StageLook,
  highContrast: boolean,
  buildings = true,
  map: GameMap | null = null,
  skip: ReadonlySet<string> = NO_SKIP
): TileMask | null {
  if (!look.mask) {
    if (!buildings) return null;
    const grid = arena?.family === 'village' ? arenaRows(arena.id) : map;
    return grid ? villageTileMask(look, grid, skip, highContrast) : null;
  }
  if (!arena) return null;
  const rows = arenaMapMask(arena.id);
  if (!rows) return null;
  const style = buildings && isCityLookId(look.lookId)
    ? CITY_BUILDING_STYLES[look.lookId]
    : undefined;
  const key = `${arena.id}|${look.lookId}|${highContrast ? 'high' : 'normal'}|${style ? 'buildings' : 'walls'}`;
  let mask = TILE_MASKS.get(key);
  if (!mask) {
    mask = { rows, ...maskTones(look.mask, highContrast) };
    if (style) {
      const pavement: CheckerTones = {
        a: style.pavement, b: shadeHex(style.pavement, CHECKER_SHADE),
      };
      // A stadium's arena (Rome's Colosseum) on its own sand floor, class
      // `a`, and the river running out under the border (cityMaskRows).
      // High contrast keeps its own floor tones (no pavement, no sand).
      const floors: Record<string, CheckerTones> = highContrast ? { ...mask.floors } : {
        ...mask.floors, b: pavement, e: pavement, m: pavement, x: mask.floors.r,
      };
      if (style.arenaFloor && !highContrast) {
        floors.a = { a: style.arenaFloor, b: shadeHex(style.arenaFloor, CHECKER_SHADE) };
      }
      const board = highContrastPalette(look.palette);
      const contrast = highContrast
        ? contrastBand(
          [board.groundA, board.groundB, ...Object.values(floors).flatMap(({ a, b }) => [a, b])],
          board.crate,
          board.wall
        )
        : undefined;
      mask = {
        ...mask,
        rows: cityMaskRows(rows, style),
        floors,
        buildings: {
          kind: 'city',
          classes: buildingClasses(style),
          style,
          seed: arena.id,
          crate: style.crate,
          ...(contrast ? { contrast } : {}),
          // The outskirts keep clear of the skyline's props (landmarkPlacement.ts).
          clearings: placeStageProps(look, rows[0].length, rows.length).map(({
            x, y, radius, famous,
          }) => ({
            x, y, radius, famous,
          })),
        },
      };
    }
    TILE_MASKS.set(key, mask);
  }
  return mask;
}
