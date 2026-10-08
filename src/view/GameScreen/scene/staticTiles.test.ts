import { GameMap } from '../../../model/gameItem';
import { cellKey } from '../../../engine/fogOfWar';
import {
  buildStaticTileLayers,
  DESTROYED_CRATE_COLOR,
  EXPLORED_CRATE_COLOR,
  EXPLORED_GROUND_COLOR,
  EXPLORED_WALL_COLOR,
  HIDDEN_GROUND_COLOR,
  STATIC_TILE_LAYER_IDS,
  StaticTileLayers,
} from './staticTiles';

const palette = {
  groundA: '#a00000',
  groundB: '#b00000',
  wall: '#c00000',
  crate: '#d00000',
  accent: '#e00000',
};

const obstacle = { ownerId: 'p1', coords: { x: 1, y: 1 } };
const bomb = { range: 2, coords: { x: 2, y: 1 } };

// Row 0: wall, box, box, wall
// Row 1: empty, obstacle, bomb, power-up
// Row 2: wall, box, empty, wall
const map: GameMap = [
  ['Wall', 'Box', 'Box', 'Wall'],
  ['Empty', obstacle, bomb, 'AddBomb'],
  ['Wall', 'Box', 'Empty', 'Wall'],
];

const keys = (cells: [number, number][]) => new Set(cells.map(([x, y]) => cellKey(x, y)));

function cellsOf(layers: StaticTileLayers, id: keyof StaticTileLayers) {
  return layers[id].map(({ x, y, color }) => `${x},${y}:${color}`).sort();
}

describe('buildStaticTileLayers', () => {
  it('gives every cell exactly one ground tile, coloured by its fog state', () => {
    const visible = keys([[0, 0], [1, 0], [0, 1], [1, 1]]);
    const explored = keys([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1]]);
    const layers = buildStaticTileLayers(map, palette, visible, explored, new Set());

    const groundCount = layers.groundVisible.length
      + layers.groundExplored.length
      + layers.groundHidden.length;
    expect(groundCount).toBe(12);
    expect(cellsOf(layers, 'groundVisible')).toEqual([
      `0,0:${palette.groundB}`,
      `0,1:${palette.groundA}`,
      `1,0:${palette.groundA}`,
      `1,1:${palette.groundB}`,
    ]);
    expect(cellsOf(layers, 'groundExplored')).toEqual([
      `2,0:${EXPLORED_GROUND_COLOR}`,
      `2,1:${EXPLORED_GROUND_COLOR}`,
    ]);
    expect(layers.groundHidden).toHaveLength(6);
    expect(layers.groundHidden.every((cell) => cell.color === HIDDEN_GROUND_COLOR)).toBe(true);
  });

  it('keeps hidden walls and crates out of view and dims explored ones', () => {
    // Column 3 and row 2 stay hidden; column 2 is explored but not visible.
    const visible = keys([[0, 0], [1, 0], [0, 1], [1, 1]]);
    const explored = keys([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [2, 1]]);
    const destroyed = keys([[1, 0], [2, 0]]);
    const layers = buildStaticTileLayers(map, palette, visible, explored, destroyed);

    expect(cellsOf(layers, 'wallVisible')).toEqual([`0,0:${palette.wall}`]);
    expect(layers.wallExplored).toEqual([]);
    // A visible destroyed crate gets the scorched tint...
    expect(cellsOf(layers, 'crateDestroyed')).toEqual([`1,0:${DESTROYED_CRATE_COLOR}`]);
    // ...but fog wins over the scorched tint once the cell is only explored.
    expect(cellsOf(layers, 'crateExplored')).toEqual([`2,0:${EXPLORED_CRATE_COLOR}`]);
    // Player obstacles render as ordinary crates.
    expect(cellsOf(layers, 'crateVisible')).toEqual([`1,1:${palette.crate}`]);
  });

  it('dims explored walls and leaves bombs and power-ups to their animated meshes', () => {
    const everything = keys(map.flatMap((row, y) => row.map((_, x) => [x, y] as [number, number])));
    const fullyVisible = buildStaticTileLayers(map, palette, everything, everything, new Set());
    const exploredOnly = buildStaticTileLayers(map, palette, new Set(), everything, new Set());

    const staticCells = (layers: StaticTileLayers) => STATIC_TILE_LAYER_IDS
      .filter((id) => !id.startsWith('ground'))
      .flatMap((id) => layers[id].map(({ x, y }) => cellKey(x, y)));

    // Bomb (2,1) and power-up (3,1) cells only ever get ground.
    expect(staticCells(fullyVisible)).not.toContain(cellKey(2, 1));
    expect(staticCells(fullyVisible)).not.toContain(cellKey(3, 1));
    expect(staticCells(fullyVisible)).toHaveLength(8);

    expect(exploredOnly.wallVisible).toEqual([]);
    expect(exploredOnly.wallExplored).toHaveLength(4);
    expect(exploredOnly.wallExplored.map((cell) => cell.color))
      .toEqual(Array(4).fill(EXPLORED_WALL_COLOR));
    expect(exploredOnly.crateExplored).toHaveLength(4);
  });
});
