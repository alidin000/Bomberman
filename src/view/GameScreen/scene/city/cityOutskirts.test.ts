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
    const inColumn = vertices.filter(({ u, v, y: h }) => h > 0.01
      && Math.abs(u - cx) < radius + 0.6 && v < cy + radius + 0.4);
    expect(inColumn).toEqual([]);
  });
});
