import type { StageDefinition } from './types';

/** A city arena's look. A village's look id is its stage id. */
export type CityLookId = 'rome' | 'barcelona' | 'budapest';

/** The board's colours: floor checker, walls, crates and the accent. */
export type StagePalette = StageDefinition['palette'];

/**
 * The colours a city's render mask (content/arenaMaps.ts) paints: one tone
 * per floor class (the scene darkens every other cell for the checker), the
 * river and the landmark on the board. Buildings and the border keep the
 * palette's wall colour.
 */
export interface CityMaskColors {
  road: string;
  plaza: string;
  park: string;
  deck: string;
  crossing: string;
  tram: string;
  water: string;
  landmark: string;
}

/**
 * Each city look's board colours: its palette and its mask colours. The rest
 * of the look (sky, lights, skyline) is in content/stageLooks.ts, which only
 * the match loads; the menus' city cards and the loading view draw a map
 * from these alone. Each keeps the floor light and the walls dark enough
 * that the danger cues read on it, like the villages, and puts its warm
 * colours on walls and the skyline, not where flames burn.
 */
export const CITY_COLORS: Record<CityLookId, { palette: StagePalette; mask: CityMaskColors }> = {
  rome: {
    palette: {
      groundA: '#e2d6bf',
      groundB: '#d6c9ae',
      wall: '#a9664a',
      crate: '#8d6e86',
      accent: '#b8202e',
    },
    mask: {
      road: '#c9bda6',
      plaza: '#ebe2cf',
      park: '#b3c597',
      deck: '#c2b393',
      crossing: '#efebe1',
      tram: '#b2aa9b',
      water: '#46717f',
      landmark: '#a68c68',
    },
  },
  barcelona: {
    palette: {
      groundA: '#ecdfc6',
      groundB: '#e0d1b3',
      wall: '#b3855a',
      crate: '#5b7fa8',
      accent: '#e4a62a',
    },
    mask: {
      road: '#c8c1b3',
      plaza: '#f0e6d2',
      park: '#adc391',
      deck: '#c6b79c',
      crossing: '#efece5',
      tram: '#b3ada2',
      water: '#3f6f8c',
      landmark: '#9c7650',
    },
  },
  budapest: {
    palette: {
      groundA: '#cdd0d8',
      groundB: '#c0c4ce',
      wall: '#7b7d90',
      crate: '#c79f76',
      accent: '#f0b44a',
    },
    mask: {
      road: '#b8bbc4',
      plaza: '#dcdee5',
      park: '#a3ba98',
      deck: '#bcae95',
      crossing: '#e5e6eb',
      tram: '#adaaa3',
      water: '#3c5f7d',
      landmark: '#968f7d',
    },
  },
};

export function isCityLookId(id: string): id is CityLookId {
  return Object.prototype.hasOwnProperty.call(CITY_COLORS, id);
}
