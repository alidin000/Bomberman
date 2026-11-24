import { getArenaMap } from '../../../../content/arenaMaps';
import { CITY_LOOKS, CityLookId } from '../../../../content/stageLooks';
import { sceneTileMask } from '../arenaScene';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';
import { cityBuildingGeometry } from './CityBuildings';
import { OUTSKIRTS_NEAR_TOP, OUTSKIRTS_TOP } from './cityOutskirts';

const EPS = 1e-6;
// The floor slab reaches this far past the board (GameScene3D's Floor).
const SLAB = 0.55;

const top = (list: readonly { y: number }[]) => list.reduce((max, { y }) => Math.max(max, y), 0);

const lattice = (x: number, z: number) => ({
  u: x / TILE_SIZE - MAP_OFFSET_X + 0.5,
  v: z / TILE_SIZE - MAP_OFFSET_Z + 0.5,
});

describe.each(Object.keys(CITY_LOOKS) as CityLookId[])('the %s outskirts', (id) => {
  const mask = sceneTileMask(getArenaMap(id), CITY_LOOKS[id], false)!;
  const built = cityBuildingGeometry(mask)!;
  const outskirts = built.outskirts!;
  const width = mask.rows[0].length;
  const height = mask.rows.length;
  const position = outskirts.getAttribute('position');
  const vertices = Array.from({ length: position.count }, (_unused, index) => ({
    ...lattice(position.getX(index), position.getZ(index)),
    y: position.getY(index),
  }));

  it('stands round the board, never on it or its slab', () => {
    expect(vertices.length).toBeGreaterThan(0);
    // Every vertex is a real point (a bad bank lookup once gave Infinity).
    expect(vertices.filter(({ u, v, y }) => ![u, v, y].every(Number.isFinite))).toEqual([]);
    const onSlab = vertices.filter(({ u, v, y }) => y > 0 && u > -SLAB + EPS
      && u < width + SLAB - EPS && v > -SLAB + EPS && v < height + SLAB - EPS);
    expect(onSlab).toEqual([]);
  });

  it('stays low: under the cap behind the board, lowest on the camera\'s side', () => {
    expect(top(vertices)).toBeLessThanOrEqual(OUTSKIRTS_TOP + EPS);
    const near = vertices.filter(({ v }) => v > height + SLAB);
    expect(top(near)).toBeLessThanOrEqual(OUTSKIRTS_NEAR_TOP + EPS);
  });

  it('keeps its famous place\'s footprint and the sky behind it free of roofs', () => {
    const plan = mask.buildings!;
    if (plan.kind !== 'city') throw new Error('a city mask');
    const famous = plan.clearings.filter((clearing) => clearing.famous);
    expect(famous).toHaveLength(1);
    const [{ x, y, radius }] = famous;
    // Map cells to the lattice: a cell's centre sits half a cell in.
    const cx = x + 0.5;
    const cy = y + 0.5;
    // Low embankments may run past it; no roof does.
    const inColumn = vertices.filter(({ u, v, y: h }) => h > 0.15
      && Math.abs(u - cx) < radius + 0.6 && v < cy + radius + 0.4);
    expect(inColumn).toEqual([]);
  });
});

describe('the Danube past the board', () => {
  const mask = sceneTileMask(getArenaMap('budapest'), CITY_LOOKS.budapest, false)!;
  const outskirts = cityBuildingGeometry(mask)!.outskirts!;
  const position = outskirts.getAttribute('position');
  const width = mask.rows[0].length;
  const height = mask.rows.length;

  it('runs on north and south as water, with no roof on it', () => {
    const water = { north: 0, south: 0 };
    const roofsOnRiver: string[] = [];
    for (let index = 0; index < position.count; index += 1) {
      const { u, v } = lattice(position.getX(index), position.getZ(index));
      const y = position.getY(index);
      if (y < -0.01 && y > -0.03) {
        if (v < -2) water.north += 1;
        if (v > height + 2) water.south += 1;
      }
      // Next to the board the river keeps the columns it leaves by.
      const nearNorth = v < -SLAB && v > -0.7;
      const river = Array.from(mask.rows[0]).flatMap((cls, x) => (cls === 'w' ? [x] : []));
      if (nearNorth && y > 0.2 && u > Math.min(...river) && u < Math.max(...river) + 1) {
        roofsOnRiver.push(`${u.toFixed(2)},${v.toFixed(2)}`);
      }
    }
    expect(water.north).toBeGreaterThan(0);
    expect(water.south).toBeGreaterThan(0);
    expect(roofsOnRiver).toEqual([]);
    expect(width).toBeGreaterThan(0);
  });
});
