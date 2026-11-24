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
import { highContrastMaskColor, shadeHex } from './highContrast';
import type { CheckerTones, TileMask } from './staticTiles';
import { CITY_BUILDING_STYLES, buildingClasses } from './city/cityBuildings';
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
  skip: ReadonlySet<string>
): TileMask | null {
  const style = VILLAGE_BUILDING_STYLES[look.lookId as StageId];
  if (!style) return null;
  const key = `${look.lookId}|${[...skip].sort().join(';')}`;
  let masks = VILLAGE_MASKS.get(grid);
  if (!masks) {
    masks = new Map();
    VILLAGE_MASKS.set(grid, masks);
  }
  let mask = masks.get(key);
  if (!mask) {
    mask = {
      rows: villageMaskRows(grid, skip),
      floors: style.path ? { p: { a: style.path, b: shadeHex(style.path, CHECKER_SHADE) } } : {},
      water: style.borderGround,
      walls: {},
      buildings: {
        kind: 'village', classes: 'be', style, seed: look.lookId, crate: style.crate,
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
 * draw as merged buildings (scene/city/CityBuildings.tsx) on a pavement floor, and crossing
 * cells take the road's tone under their stripes. High contrast keeps
 * today's walls, whose contrast rules are tested.
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
    if (!buildings || highContrast) return null;
    const grid = arena?.family === 'village' ? arenaRows(arena.id) : map;
    return grid ? villageTileMask(look, grid, skip) : null;
  }
  if (!arena) return null;
  const rows = arenaMapMask(arena.id);
  if (!rows) return null;
  const style = buildings && !highContrast && isCityLookId(look.lookId)
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
      mask = {
        ...mask,
        floors: {
          ...mask.floors, b: pavement, e: pavement, m: pavement, x: mask.floors.r,
        },
        buildings: {
          kind: 'city',
          classes: buildingClasses(style),
          style,
          seed: arena.id,
          crate: style.crate,
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
