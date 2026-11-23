import type { GameConfig } from '../../../engine/types';
import {
  ArenaMapEntry, FloorMaskClass, arenaMapForConfig, arenaMapMask,
} from '../../../content/arenaMaps';
import {
  CityMaskColors, StageLook, getLook, getStageLook,
} from '../../../content/stageLooks';
import { highContrastMaskColor, shadeHex } from './highContrast';
import type { CheckerTones, TileMask } from './staticTiles';

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
 * A match's render mask in its look's colours: a city map's, or null (the
 * villages and the campaign draw as before). One object per map, look and
 * contrast setting, so the tiles rebuild only when one of them changes.
 */
export function sceneTileMask(
  arena: ArenaMapEntry | undefined,
  look: StageLook,
  highContrast: boolean
): TileMask | null {
  if (!arena || !look.mask) return null;
  const rows = arenaMapMask(arena.id);
  if (!rows) return null;
  const key = `${arena.id}|${look.lookId}|${highContrast ? 'high' : 'normal'}`;
  let mask = TILE_MASKS.get(key);
  if (!mask) {
    mask = { rows, ...maskTones(look.mask, highContrast) };
    TILE_MASKS.set(key, mask);
  }
  return mask;
}
