import { GameMap } from '../../../model/gameItem';
import { cellKey } from '../../../engine/fogOfWar';
import { parseMapRows } from '../../../engine/mapLoader';
import {
  ARENA_MAPS, arenaMapMask, arenaMapRows, getArenaMap,
} from '../../../content/arenaMaps';
import {
  CITY_LOOKS, CityLookId, getLook, getStageLook,
} from '../../../content/stageLooks';
import { STAGE_DEFINITIONS } from '../../../content/stages';
import {
  STATIC_TILE_LAYER_IDS,
  StaticTileLayers,
  TileMask,
  buildStaticTileLayers,
  getStaticTileLayerStyles,
  maskWaterCount,
} from './staticTiles';
import { maskTones, sceneLookFor, sceneTileMask } from './arenaScene';
import { contrastRatio, highContrastPalette } from './highContrast';
import {
  TELEGRAPH_EDGE_COLOR, TELEGRAPH_EDGE_OPACITY, TELEGRAPH_FILL_COLOR, TELEGRAPH_FILL_OPACITY,
} from './hazardTelegraph';

const palette = {
  groundA: '#a00000', groundB: '#b00000', wall: '#c00000', crate: '#d00000', accent: '#e00000',
};
const tones: TileMask = {
  rows: [],
  floors: { r: { a: '#010101', b: '#020202' }, g: { a: '#030303', b: '#040404' } },
  water: '#0000ff',
  walls: { m: '#00ff00' },
};

const everyCell = (map: GameMap) => new Set(
  map.flatMap((row, y) => row.map((_, x) => cellKey(x, y)))
);
const cellsOf = (layers: StaticTileLayers, id: keyof StaticTileLayers) => (
  layers[id].map(({ x, y, color }) => `${x},${y}:${color}`).sort()
);

describe('city mask tiles', () => {
  // Row 0: a river wall, a building wall, the landmark, and a water class
  // on an open cell (no water there: water only ever replaces a wall).
  // Row 1: road, park, plain and a crate on a road.
  const map: GameMap = [
    ['Wall', 'Wall', 'Wall', 'Empty'],
    ['Empty', 'Empty', 'Empty', 'Box'],
  ];
  const mask: TileMask = { ...tones, rows: ['wbmw', 'rg.r'] };

  it('draws water flat in its own layer, only on wall cells the mask marks', () => {
    const all = everyCell(map);
    const layers = buildStaticTileLayers(map, palette, all, all, new Set(), undefined, mask);
    expect(cellsOf(layers, 'waterVisible')).toEqual(['0,0:#0000ff']);
    // The water cell has no wall and no ground tile under it...
    expect(layers.wallVisible.map(({ x, y }) => `${x},${y}`)).not.toContain('0,0');
    expect(layers.groundVisible.map(({ x, y }) => `${x},${y}`)).not.toContain('0,0');
    // ...and the water class on an open cell leaves it plain floor.
    expect(cellsOf(layers, 'groundVisible')).toContain(`3,0:${palette.groundA}`);
    expect(maskWaterCount(map, mask)).toBe(1);
  });

  it('recolours floor classes on the checker, tints the landmark, and leaves the rest plain', () => {
    const all = everyCell(map);
    const layers = buildStaticTileLayers(map, palette, all, all, new Set(), undefined, mask);
    expect(cellsOf(layers, 'groundVisible')).toEqual([
      // Building and landmark walls keep their ground as before.
      `1,0:${palette.groundA}`,
      `2,0:${palette.groundB}`,
      `3,0:${palette.groundA}`,
      // Road (even cell: the darker tone), park (odd), plain, road under a crate.
      '0,1:#010101',
      '1,1:#040404',
      `2,1:${palette.groundA}`,
      '3,1:#020202',
    ].sort());
    expect(cellsOf(layers, 'wallVisible')).toEqual([`1,0:${palette.wall}`, '2,0:#00ff00']);
    expect(cellsOf(layers, 'crateVisible')).toEqual([`3,1:${palette.crate}`]);
  });

  it('draws exactly as before without a mask, or with one that does not fit the map', () => {
    const all = everyCell(map);
    const plain = buildStaticTileLayers(map, palette, all, all, new Set());
    const misfit = buildStaticTileLayers(map, palette, all, all, new Set(), undefined, {
      ...mask, rows: ['wbm', 'rg.'],
    });
    STATIC_TILE_LAYER_IDS.forEach((id) => expect(misfit[id]).toEqual(plain[id]));
    expect(plain.waterVisible).toEqual([]);
    expect(maskWaterCount(map, null)).toBe(0);
  });

  it('keeps fogged cells out of the mask: only what is in view is recoloured', () => {
    const seen = everyCell(map);
    const layers = buildStaticTileLayers(map, palette, new Set(), seen, new Set(), undefined, mask);
    expect(layers.waterVisible).toEqual([]);
    expect(layers.wallExplored).toHaveLength(3);
  });

  it('gives water the ground\'s material settings, so it adds no shader program', () => {
    const styles = getStaticTileLayerStyles(palette);
    expect({ ...styles.waterVisible, shape: 'ground' }).toEqual(styles.groundVisible);
  });

  it('puts water only on W cells of every committed city map', () => {
    ARENA_MAPS.filter((entry) => entry.family === 'city').forEach((entry) => {
      const look = getLook(entry.lookId);
      const tileMask = sceneTileMask(entry, look, false);
      expect(tileMask?.rows).toBe(arenaMapMask(entry.id));
      const grid = arenaMapRows(entry.id);
      const parsed = parseMapRows(grid);
      const all = everyCell(parsed);
      const layers = buildStaticTileLayers(
        parsed,
        look.palette,
        all,
        all,
        new Set(),
        undefined,
        tileMask
      );
      layers.waterVisible.forEach(({ x, y }) => expect({ x, y, cell: grid[y][x] }).toEqual({ x, y, cell: 'W' }));
      const marked = grid.flatMap((row, y) => row.filter((cell, x) => cell === 'W' && tileMask?.rows[y][x] === 'w'));
      expect(layers.waterVisible).toHaveLength(marked.length);
    });
  });

  it('gives villages only their buildings, the campaign no mask, and a city route its own look', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const village = sceneTileMask(getArenaMap(stage.id), getStageLook(stage.id), false);
      // A village's mask recolours nothing but its own path, and draws its walls as the village.
      if (village) {
        expect(village.buildings?.kind).toBe('village');
        expect(Object.keys(village.floors).filter((cls) => cls !== 'p')).toEqual([]);
        expect(village.walls).toEqual({});
      }
      expect(sceneTileMask(undefined, getStageLook(stage.id), false)).toBeNull();
      expect(sceneLookFor({ mode: 'local', selectedMap: stage.id, stageId: stage.id }))
        .toBe(getStageLook(stage.id));
    });
    expect(sceneLookFor({ mode: 'local', selectedMap: 'rome', stageId: 'hiddenSand' })).toBe(CITY_LOOKS.rome);
    expect(sceneLookFor({ mode: 'local', selectedMap: 'hiddenMist', stageId: 'hiddenSand' }))
      .toBe(getStageLook('hiddenMist'));
    // The campaign and unknown ids keep their stage's look.
    expect(sceneLookFor({ mode: 'solo', selectedMap: 'rome', stageId: 'hiddenSand' }))
      .toBe(getStageLook('hiddenSand'));
    expect(sceneLookFor({ mode: 'local', selectedMap: 'map1', stageId: 'hiddenCloud' }))
      .toBe(getStageLook('hiddenCloud'));
  });
});

// A colour seen through a translucent mark on the floor (sRGB mix).
function over(floor: string, mark: string, opacity: number): string {
  const channel = (hex: string, index: number) => (
    parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16)
  );
  return `#${[0, 1, 2].map((index) => Math.round(
    channel(floor, index) * (1 - opacity) + channel(mark, index) * opacity
  ).toString(16).padStart(2, '0')).join('')}`;
}

describe.each(Object.keys(CITY_LOOKS) as CityLookId[])('the %s mask colours', (id) => {
  const look = getLook(id);
  const modes = [false, true].map((highContrast) => ({
    highContrast,
    board: highContrast ? highContrastPalette(look.palette) : look.palette,
    mask: maskTones(look.mask!, highContrast),
  }));
  const floorsOf = ({ board, mask }: typeof modes[number]) => [
    board.groundA, board.groundB, ...Object.values(mask.floors).flatMap((tone) => [tone.a, tone.b]),
  ];

  it('keeps every danger cue readable on every floor, in either mode (grayscale contrast)', () => {
    modes.forEach((mode) => floorsOf(mode).forEach((floor) => {
      expect(contrastRatio(floor, over(floor, TELEGRAPH_EDGE_COLOR, TELEGRAPH_EDGE_OPACITY)))
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(floor, over(floor, TELEGRAPH_FILL_COLOR, TELEGRAPH_FILL_OPACITY)))
        .toBeGreaterThanOrEqual(3);
    }));
  });

  it('separates floor, water and walls by brightness, not only by hue', () => {
    const [normal, high] = modes;
    floorsOf(normal).forEach((floor) => {
      expect(contrastRatio(floor, normal.mask.water)).toBeGreaterThanOrEqual(2);
    });
    floorsOf(high).forEach((floor) => {
      expect(contrastRatio(floor, high.board.wall)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(floor, high.mask.water)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(floor, high.mask.walls.m)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(floor, high.board.crate)).toBeGreaterThanOrEqual(1.8);
    });
    // Crates read apart from the walls and the floor in high contrast.
    expect(contrastRatio(high.board.groundB, high.board.crate)).toBeGreaterThanOrEqual(2);
    expect(contrastRatio(high.board.crate, high.board.wall)).toBeGreaterThanOrEqual(2);
    // Every floor class keeps a checker, so cells stay countable.
    Object.values(normal.mask.floors).forEach((tone) => expect(tone.a).not.toBe(tone.b));
  });
});
