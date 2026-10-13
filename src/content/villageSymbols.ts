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
  // Line width in box units for a `stroke` mark (round caps and joins), or
  // the outline width around a `fill` mark. Thick enough that the mark still
  // reads at 16 px; thin enough that its gaps stay open at 64 px.
  strokeWidth?: number;
}

// Shared line weight: 7 box units is about 1.1 px at 16 px and 4.5 px at 64 px.
const LINE = 7;

export const VILLAGE_SYMBOLS: Record<VillageSymbolId, VillageSymbol> = {
  leaf: {
    id: 'leaf',
    name: 'Hidden Leaf',
    mode: 'stroke',
    // A leaf seen side on: its tip points down-left, its round body is a
    // spiral that winds clockwise in to the centre, and a short stem leaves
    // the top right. The tip's two edges meet the body at its top and bottom.
    d: 'M8 86 C14 54 30 20 58 20 A34 34 0 0 1 92 54 A34 34 0 0 1 58 88 '
      + 'A25 25 0 0 1 58 38 A17 17 0 0 1 58 72 A9 9 0 0 1 58 54 '
      + 'M8 86 Q34 92 58 88 M75 25 L89 9',
    color: '#334155',
    strokeWidth: LINE,
  },
  sand: {
    id: 'sand',
    name: 'Hidden Sand',
    mode: 'stroke',
    // A flat lid over an hourglass whose sides pinch in to a narrow waist.
    d: 'M32 9 H68 A4 4 0 0 1 72 13 V18 A4 4 0 0 1 68 22 H32 A4 4 0 0 1 28 18 V13 A4 4 0 0 1 32 9 Z '
      + 'M32 31 H68 A4 4 0 0 1 72 35 V38 C72 51 57 52 57 61 C57 70 72 71 72 84 V87 '
      + 'A4 4 0 0 1 68 91 H32 A4 4 0 0 1 28 87 V84 C28 71 43 70 43 61 C43 52 28 51 28 38 V35 '
      + 'A4 4 0 0 1 32 31 Z',
    color: '#334155',
    strokeWidth: 6,
  },
  mist: {
    id: 'mist',
    name: 'Hidden Mist',
    mode: 'stroke',
    // Four slanted wave strokes, two over two, each an S that starts and
    // ends level.
    d: 'M12 46 c8 0 11 -7 15 -13 s7 -13 15 -13 M54 46 c8 0 11 -7 15 -13 s7 -13 15 -13 '
      + 'M6 82 c8 0 11 -7 15 -13 s7 -13 15 -13 M48 82 c8 0 11 -7 15 -13 s7 -13 15 -13',
    color: '#334155',
    strokeWidth: LINE,
  },
  cloud: {
    id: 'cloud',
    name: 'Hidden Cloud',
    mode: 'stroke',
    // A small cloud wisp beside a stepped cloud: a high bank on the right
    // that drops through a neck into a long low bank on the left.
    d: 'M53 25 H83 A9 9 0 0 1 83 43 H66 C60 43 58 47 58 51 C58 55 60 57 66 57 H67 '
      + 'A9 9 0 0 1 67 75 H19 A9 9 0 0 1 19 57 H38 C42 57 44 55 44 51 V34 A9 9 0 0 1 53 25 Z '
      + 'M8 35 A12 5.5 0 1 0 32 35 A12 5.5 0 1 0 8 35 Z',
    color: '#334155',
    strokeWidth: 6,
  },
  stone: {
    id: 'stone',
    name: 'Hidden Stone',
    mode: 'stroke',
    // Two cut boulders: a tall one behind and a smaller one in front of it,
    // each with a notched side.
    d: 'M66 46 L72 30 L64 12 H28 L16 48 L22 56 V84 H52 '
      + 'M58 46 H84 L94 62 V90 H52 V68 L47 62 Z',
    color: '#334155',
    strokeWidth: 6,
  },
  akatsukiCloud: {
    id: 'akatsukiCloud',
    name: 'Akatsuki',
    mode: 'fill',
    // The red cloud worn on the cloaks: round billows over a scalloped
    // underside (drawn with a white outline, `strokeWidth` wide).
    d: 'M8 62 A10 10 0 0 1 18 46 A14 14 0 0 1 40 34 A16 16 0 0 1 66 34 A13 13 0 0 1 84 44 '
      + 'A10 10 0 0 1 90 62 A9 9 0 0 1 78 72 A11 11 0 0 1 58 74 A11 11 0 0 1 38 74 '
      + 'A10 10 0 0 1 20 72 A8 8 0 0 1 8 62 Z',
    color: '#c4161c',
    strokeWidth: 5,
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
