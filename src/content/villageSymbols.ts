// The village marks as this game draws them: headband plates (scene), menus,
// badges and portraits (2D) all read these. Shapes are drawn in a 100x100
// box; `stroke` shapes are drawn as lines, `fill` shapes as solids, and a
// `glyph` mark is a single character set in the menu font.
import type { StageId } from './types';

export type VillageSymbolId = 'leaf' | 'sand' | 'mist' | 'cloud' | 'stone' | 'akatsukiCloud' | 'alliance';

export interface VillageSymbol {
  id: VillageSymbolId;
  name: string;
  mode: 'stroke' | 'fill' | 'glyph';
  // SVG path data in a 0-100 box (stroke and fill marks).
  d?: string;
  // The character drawn for a glyph mark.
  glyph?: string;
  // The mark's usual colour on cloth and on menus.
  color: string;
}

export const VILLAGE_SYMBOLS: Record<VillageSymbolId, VillageSymbol> = {
  leaf: {
    id: 'leaf',
    name: 'Hidden Leaf',
    mode: 'stroke',
    // A widening spiral that ends in a pointed leaf tip at the upper left.
    d: 'M44 54 A6 6 0 0 1 56 54 A12 12 0 0 1 32 54 A18 18 0 0 1 68 54 A24 24 0 0 1 20 54 L14 22 L42 30',
    color: '#334155',
  },
  sand: {
    id: 'sand',
    name: 'Hidden Sand',
    mode: 'stroke',
    // An hourglass between two open loops.
    d: 'M30 22 L70 22 L50 50 L70 78 L30 78 L50 50 Z M22 34 A10 10 0 0 0 22 66 M78 34 A10 10 0 0 1 78 66',
    color: '#334155',
  },
  mist: {
    id: 'mist',
    name: 'Hidden Mist',
    mode: 'stroke',
    // Four slanted strokes in two pairs.
    d: 'M26 34 L46 24 M26 50 L46 40 M54 60 L74 50 M54 76 L74 66',
    color: '#334155',
  },
  cloud: {
    id: 'cloud',
    name: 'Hidden Cloud',
    mode: 'stroke',
    // A billowing cloud over a base line.
    d: 'M22 66 A12 12 0 0 1 30 44 A16 16 0 0 1 60 38 A13 13 0 0 1 78 62 Z M18 76 L82 76',
    color: '#334155',
  },
  stone: {
    id: 'stone',
    name: 'Hidden Stone',
    mode: 'stroke',
    // Two peaks over a level line.
    d: 'M18 70 L38 34 L50 52 L64 28 L84 70 Z M24 80 L78 80',
    color: '#334155',
  },
  akatsukiCloud: {
    id: 'akatsukiCloud',
    name: 'Akatsuki',
    mode: 'fill',
    // The red cloud worn on the cloaks (drawn with a white outline).
    d: 'M18 62 A10 10 0 0 1 26 46 A14 14 0 0 1 50 40 A12 12 0 0 1 72 46 A10 10 0 0 1 80 62 Z',
    color: '#c4161c',
  },
  alliance: {
    id: 'alliance',
    name: 'Allied Shinobi Forces',
    mode: 'glyph',
    glyph: '忍',
    color: '#1f2937',
  },
};

export const STAGE_SYMBOL: Record<StageId, VillageSymbolId> = {
  hiddenLeaf: 'leaf',
  hiddenSand: 'sand',
  hiddenMist: 'mist',
  hiddenCloud: 'cloud',
  hiddenStone: 'stone',
  akatsukiHideout: 'akatsukiCloud',
  greatShinobiWar: 'alliance',
};
