import { GameMap } from '../../../model/gameItem';
import { cellKey, withUpdatedFogOfWar } from '../../../engine/fogOfWar';
import { parseMapRows } from '../../../engine/mapLoader';
import { createInitialState } from '../../../engine/initialState';
import type { CampaignRuntimeState } from '../../../engine/types';
import {
  buildStaticTileLayers,
  campaignTileFeatureKey,
  firstChangedTile,
  tileFeaturesFromKey,
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

describe('campaign feature tiles', () => {
  // A cracked wall (crate in the engine), a hidden passage (floor) and an
  // arena gate (wall) in one row.
  const row: GameMap = [['Box', 'Empty', 'Wall', 'Wall', 'Box', 'Empty']];
  const all = keys(row[0].map((_, x) => [x, 0] as [number, number]));
  const campaign = {
    hiddenAreas: [
      {
        id: 'scroll',
        room: {
          x: 0, y: 1, width: 1, height: 1, entry: 'crackedWall', door: { x: 0, y: 0 },
        },
      },
      {
        id: 'fragment',
        room: {
          x: 1, y: 1, width: 1, height: 1, entry: 'hiddenPassage', door: { x: 1, y: 0 },
        },
      },
      { id: 'old-style-crate' },
    ],
    discoveredSecrets: [] as string[],
    bossArena: { gates: [{ x: 2, y: 0 }] },
  } as unknown as CampaignRuntimeState;

  it('draws secret doors and arena gates by shape, and plain cells as before', () => {
    const features = tileFeaturesFromKey(campaignTileFeatureKey(campaign));
    const layers = buildStaticTileLayers(row, palette, all, all, new Set(), features);
    expect(cellsOf(layers, 'crackedVisible')).toEqual([`0,0:${palette.wall}`]);
    expect(cellsOf(layers, 'passageVisible')).toEqual([`1,0:${palette.wall}`]);
    expect(cellsOf(layers, 'gateVisible')).toEqual([`2,0:${palette.accent}`]);
    expect(cellsOf(layers, 'wallVisible')).toEqual([`3,0:${palette.wall}`]);
    expect(cellsOf(layers, 'crateVisible')).toEqual([`4,0:${palette.crate}`]);

    // Fogged features keep their shape in the explored tint.
    const fogged = buildStaticTileLayers(row, palette, new Set(), all, new Set(), features);
    expect(cellsOf(fogged, 'crackedExplored')).toEqual([`0,0:${EXPLORED_WALL_COLOR}`]);
    expect(cellsOf(fogged, 'passageExplored')).toEqual([`1,0:${EXPLORED_WALL_COLOR}`]);
    expect(cellsOf(fogged, 'gateExplored')).toEqual([`2,0:${EXPLORED_WALL_COLOR}`]);
  });

  it('drops the false wall once its room is found, and an opened gate is floor', () => {
    const found = { ...campaign, discoveredSecrets: ['fragment'] };
    const key = campaignTileFeatureKey(found);
    expect(key).not.toBe(campaignTileFeatureKey(campaign));
    const opened: GameMap = [['Empty', 'Empty', 'Empty', 'Wall', 'Box', 'Empty']];
    const features = tileFeaturesFromKey(key);
    const layers = buildStaticTileLayers(opened, palette, all, all, new Set(), features);
    expect(layers.passageVisible).toEqual([]);
    expect(layers.gateVisible).toEqual([]);
    expect(layers.crackedVisible).toEqual([]);
    expect(layers.groundVisible).toHaveLength(6);
  });
});

describe('incremental tile rewrites on a 50x50 map', () => {
  it('rewrites only the tail of a layer a fog step touched, and nothing of the rest', () => {
    const size = 50;
    const open = parseMapRows(Array.from({ length: size }, (_, y) => (
      y === 0 || y === size - 1 ? 'W'.repeat(size) : `W${' '.repeat(size - 2)}W`
    ).split('')));
    const before = createInitialState({
      mode: 'solo',
      numPlayers: 1,
      totalRounds: 1,
      selectedMap: 'hiddenLeaf',
      stageId: 'hiddenLeaf',
      selectedCharacters: ['naruto'],
      map: open,
      seed: 3,
    });
    const after = withUpdatedFogOfWar({
      ...before,
      players: before.players.map((player) => ({ ...player, x: player.x + 1 })),
    });
    const build = (state: typeof before) => buildStaticTileLayers(
      state.map,
      palette,
      new Set(state.fogOfWar.visible),
      new Set(state.fogOfWar.explored),
      new Set()
    );
    const a = build(before);
    const b = build(after);
    let rewritten = 0;
    STATIC_TILE_LAYER_IDS.forEach((id) => {
      const from = firstChangedTile(a[id], b[id]);
      if (from >= 0) rewritten += b[id].length - from;
    });
    // Layers run from the bottom row up, so a step near the top-left entrance
    // rewrites the last few rows only: far less than the 2,500 instances a
    // full rewrite of every layer touches.
    expect(rewritten).toBeGreaterThan(0);
    expect(rewritten).toBeLessThan(size * size * 0.15);
    // Rebuilding without a fog change rewrites nothing at all.
    const again = build(after);
    STATIC_TILE_LAYER_IDS.forEach((id) => expect(firstChangedTile(b[id], again[id])).toBe(-1));
  });
});
