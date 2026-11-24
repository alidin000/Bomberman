import * as THREE from 'three';
import {
  ArenaMapId, arenaMapMask, arenaMapRows, getArenaMap,
} from '../../../../content/arenaMaps';
import { CITY_COLORS, CityLookId } from '../../../../content/cityColors';
import { CITY_LOOKS } from '../../../../content/stageLooks';
import { cellKey } from '../../../../engine/fogOfWar';
import { parseMapRows } from '../../../../engine/mapLoader';
import { maskTones, sceneTileMask } from '../arenaScene';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';
import { buildStaticTileLayers } from '../staticTiles';
import { contrastRatio } from '../highContrast';
import {
  TELEGRAPH_EDGE_COLOR, TELEGRAPH_EDGE_OPACITY, TELEGRAPH_FILL_COLOR, TELEGRAPH_FILL_OPACITY,
} from '../hazardTelegraph';
import {
  BODY_CAP, CITY_BUILDING_STYLES, FEATURE_CAP, SOUTH_ROW_CAP, buildCityBuildings, buildingClasses,
} from './cityBuildings';
import {
  CUTAWAY_SQUASH, applyCutaway, cutawayTargets, cutawayWeights, stepCutaway,
} from './cutaway';

// Every city map as it ships.
const MAPS: { id: ArenaMapId; look: CityLookId }[] = [
  { id: 'rome', look: 'rome' },
  { id: 'barcelona', look: 'barcelona' },
  { id: 'budapest', look: 'budapest' },
  { id: 'romeControl', look: 'rome' },
];
// Crates are 0.66 tall: the tallest building stands well above one.
const BODY_FLOOR = 0.8;
// Today's wall height: what a sunk building, and the south border row, stay under.
const WALL_HEIGHT = 0.94;
const EPS = 1e-6;

const lattice = (x: number, z: number) => ({
  u: x / TILE_SIZE - MAP_OFFSET_X + 0.5,
  v: z / TILE_SIZE - MAP_OFFSET_Z + 0.5,
});

function cellsOf(rows: readonly string[], classes: string) {
  const cells = new Set<string>();
  rows.forEach((row, y) => Array.from(row).forEach((cls, x) => {
    if (classes.includes(cls)) cells.add(`${x},${y}`);
  }));
  return cells;
}

/** Every vertex of `geometry` lies on a cell of `allowed` (edges and corners count). */
function strayVertices(geometry: THREE.BufferGeometry, allowed: Set<string>): string[] {
  const position = geometry.getAttribute('position');
  const stray: string[] = [];
  for (let index = 0; index < position.count; index += 1) {
    const { u, v } = lattice(position.getX(index), position.getZ(index));
    const xs = [Math.floor(u + EPS), Math.floor(u - EPS)];
    const ys = [Math.floor(v + EPS), Math.floor(v - EPS)];
    const onAllowed = xs.some((x) => ys.some((y) => allowed.has(`${x},${y}`)));
    if (!onAllowed && stray.length < 5) stray.push(`${u.toFixed(3)},${v.toFixed(3)}`);
  }
  return stray;
}

/** Cells with an upward face over their centre: the roof or terrace that covers them. */
function roofedCells(geometry: THREE.BufferGeometry): Set<string> {
  const position = geometry.getAttribute('position');
  const covered = new Set<string>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const triangle = new THREE.Triangle();
  const flat = new THREE.Triangle();
  const point = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    triangle.set(a, b, c).getNormal(normal);
    // Above the kerb slab: a roof, not the pavement around the block.
    if (normal.y > 0.5 && Math.min(a.y, b.y, c.y) > 0.5) {
      const ground = (p: THREE.Vector3) => new THREE.Vector3(p.x, 0, p.z);
      flat.set(ground(a), ground(b), ground(c));
      const box = new THREE.Box3().setFromPoints([a, b, c]);
      const p0 = lattice(box.min.x, box.min.z);
      const p1 = lattice(box.max.x, box.max.z);
      for (let x = Math.floor(p0.u); x <= Math.floor(p1.u); x += 1) {
        for (let y = Math.floor(p0.v); y <= Math.floor(p1.v); y += 1) {
          point.set((x + MAP_OFFSET_X) * TILE_SIZE, 0, (y + MAP_OFFSET_Z) * TILE_SIZE);
          if (flat.containsPoint(point)) covered.add(`${x},${y}`);
        }
      }
    }
  }
  return covered;
}

/** Vertices above the floor, as lattice points. */
function raised(geometry: THREE.BufferGeometry, above: number): THREE.BufferGeometry {
  const position = geometry.getAttribute('position');
  const kept: number[] = [];
  for (let index = 0; index < position.count; index += 1) {
    if (position.getY(index) > above) {
      kept.push(position.getX(index), position.getY(index), position.getZ(index));
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3));
  return out;
}

describe('city buildings geometry', () => {
  MAPS.forEach(({ id, look }) => {
    const rows = arenaMapMask(id)!;
    const style = CITY_BUILDING_STYLES[look];
    const built = buildCityBuildings(rows, style, id);
    const buildingCells = cellsOf(rows, 'be');
    // The landmark stands on its own `m` cells; a chain bridge also spans its
    // deck, and stone quays line the river inside its water cells.
    const landmarkCells = cellsOf(rows, buildingClasses(style).includes('m') ? 'm' : '');
    const spanned = style.landmark === 'chainBridge' ? cellsOf(rows, 'd') : new Set<string>();
    const water = cellsOf(rows, 'w');
    const solid = new Set([...buildingCells, ...landmarkCells, ...water, ...spanned]);

    it(`${id}: roofs every building and border cell, and nothing open`, () => {
      expect(built.cells).toBe(buildingCells.size);
      const roofed = roofedCells(built.mass);
      expect([...buildingCells].filter((cell) => !roofed.has(cell))).toEqual([]);
      // A bridge's towers may stand in the river.
      const towersIn = style.landmark === 'chainBridge' ? water : new Set<string>();
      const covers = new Set([...buildingCells, ...landmarkCells, ...spanned, ...towersIn]);
      expect([...roofed].filter((cell) => !covers.has(cell))).toEqual([]);
    });

    it(`${id}: raises nothing on a street; marks lie flat on theirs`, () => {
      expect(strayVertices(raised(built.mass, 0.02), solid)).toEqual([]);
      expect(strayVertices(raised(built.detail, 0.02), solid)).toEqual([]);
      const markCells = cellsOf(rows, 'xt');
      expect(strayVertices(built.detail, new Set([...solid, ...markCells]))).toEqual([]);
    });

    it(`${id}: stands taller than a crate, under the caps, low on the camera's border row`, () => {
      expect(built.bodyTop).toBeGreaterThanOrEqual(BODY_FLOOR);
      expect(built.bodyTop).toBeLessThanOrEqual(BODY_CAP);
      expect(built.featureTop).toBeLessThanOrEqual(FEATURE_CAP);
      expect(built.southRowTop).toBeLessThanOrEqual(SOUTH_ROW_CAP);
      [built.mass, built.detail].forEach((geometry) => {
        geometry.computeBoundingBox();
        expect(geometry.boundingBox!.max.y).toBeLessThanOrEqual(FEATURE_CAP + EPS);
        // Nothing on the border row nearest the camera rises above today's wall.
        const position = geometry.getAttribute('position');
        let southTop = 0;
        for (let index = 0; index < position.count; index += 1) {
          const { v } = lattice(position.getX(index), position.getZ(index));
          if (v > rows.length - 1 + 0.01) southTop = Math.max(southTop, position.getY(index));
        }
        expect(southTop).toBeLessThanOrEqual(SOUTH_ROW_CAP + EPS);
      });
    });

    it(`${id}: sinks under today's walls in front of whatever must be seen`, () => {
      const height = rows.length;
      const width = rows[0].length;
      // A fighter in the middle of the board, and one in a corner.
      const focus = [{ x: Math.floor(width / 2), y: Math.floor(height / 2) }, { x: 1, y: 1 }];
      const shares = cutawayTargets(width, height, focus);
      [built.mass, built.detail].forEach((source) => {
        const geometry = source.clone();
        const weights = cutawayWeights(geometry, width, height);
        applyCutaway(geometry, weights, shares);
        const position = geometry.getAttribute('position');
        const high: string[] = [];
        for (let index = 0; index < position.count; index += 1) {
          const { u, v } = lattice(position.getX(index), position.getZ(index));
          // Between the centres of the sunk cells, every vertex is fully sunk.
          const inFront = focus.some(({ x, y }) => (
            u >= x - 0.5 && u <= x + 1.5 && v >= y + 0.5 && v <= y + 2.5
          ));
          if (inFront && position.getY(index) > WALL_HEIGHT + EPS && high.length < 5) {
            high.push(`${u.toFixed(2)},${v.toFixed(2)}`);
          }
        }
        expect(high).toEqual([]);
        // Back at full height, the geometry is exactly as built.
        applyCutaway(geometry, weights, new Float32Array(shares.length).fill(1));
        expect(Array.from(geometry.getAttribute('position').array))
          .toEqual(Array.from(source.getAttribute('position').array));
      });
    });

    it(`${id}: builds the same buildings every time`, () => {
      const again = buildCityBuildings(rows, style, id);
      expect(Array.from(again.mass.getAttribute('position').array))
        .toEqual(Array.from(built.mass.getAttribute('position').array));
      expect(Array.from(again.detail.getAttribute('color').array))
        .toEqual(Array.from(built.detail.getAttribute('color').array));
    });
  });
});

// Colour rules from docs/CITY_BUILDINGS_PLAN.md, measured on the base
// colours (faces are shaded on top of these).
function luminance(hex: string): number {
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(p: string, q: string): number {
  const [hi, lo] = [luminance(p), luminance(q)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function deltaE(p: string, q: string): number {
  const lab = (hex: string) => {
    const color = new THREE.Color(hex);
    const xyz = [
      (0.4124 * color.r + 0.3576 * color.g + 0.1805 * color.b) / 0.95047,
      0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b,
      (0.0193 * color.r + 0.1192 * color.g + 0.9505 * color.b) / 1.08883,
    ].map((t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116));
    return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
  };
  const [l1, a1, b1] = lab(p);
  const [l2, a2, b2] = lab(q);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const FLAME = '#ff8a00';
const CITIES = Object.keys(CITY_BUILDING_STYLES) as CityLookId[];
// Today's closest wall to flame orange sets how close a building may come.
const FLAME_DISTANCE = Math.min(
  ...CITIES.map((city) => deltaE(CITY_COLORS[city].palette.wall, FLAME))
);

describe('city building colours', () => {
  CITIES.forEach((city) => {
    const style = CITY_BUILDING_STYLES[city];
    const { palette } = CITY_COLORS[city];
    const tones = maskTones(CITY_LOOKS[city].mask!, false);
    const floors = [
      palette.groundA, palette.groundB,
      ...Object.values(tones.floors).flatMap(({ a, b }) => [a, b]),
    ];
    const floorContrast = (hex: string) => Math.min(...floors.map((floor) => contrast(hex, floor)));
    const surfaces = [...style.facades, ...style.roofs, style.terrace, style.turretRoof];

    it(`${city}: facades and roofs stand off the floor at least as well as today's wall`, () => {
      const today = floorContrast(palette.wall);
      expect(surfaces.filter((hex) => floorContrast(hex) < today - EPS)).toEqual([]);
    });

    it(`${city}: keeps facades and roofs as far from flame orange as today's walls`, () => {
      expect(surfaces.filter((hex) => deltaE(hex, FLAME) < FLAME_DISTANCE - 0.05)).toEqual([]);
    });

    it(`${city}: draws windows as dark glass, never near flame orange`, () => {
      style.facades.forEach((facade) => {
        expect(luminance(style.window)).toBeLessThan(luminance(facade));
        expect(luminance(style.railing)).toBeLessThan(luminance(facade));
      });
      expect(deltaE(style.window, FLAME)).toBeGreaterThanOrEqual(FLAME_DISTANCE);
      const { shutter } = style;
      if (shutter) expect(deltaE(shutter, FLAME)).toBeGreaterThanOrEqual(FLAME_DISTANCE);
    });

    if (style.landmark) {
      it(`${city}: builds its landmark in stone that stands off the floor`, () => {
        const today = floorContrast(palette.wall);
        expect(floorContrast(style.landmarkStone)).toBeGreaterThanOrEqual(today - EPS);
        expect(deltaE(style.landmarkStone, FLAME)).toBeGreaterThanOrEqual(FLAME_DISTANCE - 0.05);
      });
    }
  });
});

describe('city buildings in the tile layers', () => {
  const visibleAll = (map: ReturnType<typeof parseMapRows>) => new Set(
    map.flatMap((row, y) => row.map((_cell, x) => cellKey(x, y)))
  );

  it('leaves building, border and landmark walls to the buildings', () => {
    const arena = getArenaMap('budapest')!;
    const map = parseMapRows(arenaMapRows('budapest'));
    const mask = sceneTileMask(arena, CITY_LOOKS.budapest, false)!;
    expect(mask.buildings?.classes).toBe('bem');
    expect(mask.buildings?.crate).toBe('casks');
    const layers = buildStaticTileLayers(
      map,
      CITY_LOOKS.budapest.palette,
      visibleAll(map),
      new Set(),
      new Set(),
      undefined,
      mask
    );
    const rows = arenaMapMask('budapest')!;
    // Every wall is a building, the bridge or the river: no cube is left.
    expect(layers.wallVisible).toEqual([]);
    const riverWalls = map.flatMap((row, y) => row.filter((cell, x) => (
      cell === 'Wall' && rows[y][x] === 'w'
    ))).length;
    expect(layers.waterVisible.length).toBe(riverWalls);
  });

  it('draws today\'s walls in high contrast and when buildings are off', () => {
    const arena = getArenaMap('barcelona')!;
    expect(sceneTileMask(arena, CITY_LOOKS.barcelona, true)?.buildings).toBeUndefined();
    expect(sceneTileMask(arena, CITY_LOOKS.barcelona, false, false)?.buildings).toBeUndefined();
    const map = parseMapRows(arenaMapRows('barcelona'));
    const mask = sceneTileMask(arena, CITY_LOOKS.barcelona, false, false)!;
    const layers = buildStaticTileLayers(
      map,
      CITY_LOOKS.barcelona.palette,
      visibleAll(map),
      new Set(),
      new Set(),
      undefined,
      mask
    );
    const wallCells = map.flat().filter((cell) => cell === 'Wall').length;
    expect(layers.wallVisible.length + layers.waterVisible.length).toBe(wallCells);
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

describe('Rome\'s Colosseum', () => {
  const rows = arenaMapMask('rome')!;
  const built = buildCityBuildings(rows, CITY_BUILDING_STYLES.rome, 'rome');
  const ringRows = rows.flatMap((row, y) => (row.includes('m') ? [y] : []));
  const north = ringRows[0];
  const south = ringRows[ringRows.length - 1];

  it('stands three tiers tall on the north arc, two on the south, and falls inward to the arena', () => {
    const position = built.mass.getAttribute('position');
    let northTop = 0;
    let southTop = 0;
    const heights = new Set<number>();
    for (let index = 0; index < position.count; index += 1) {
      const { u, v } = lattice(position.getX(index), position.getZ(index));
      const x = Math.floor(u);
      const y = Math.floor(v);
      if (rows[y]?.[x] === 'm' && u - x > 0.01 && v - y > 0.01) {
        const h = position.getY(index);
        if (y === north) northTop = Math.max(northTop, h);
        if (y === south) southTop = Math.max(southTop, h);
        heights.add(Math.round(h * 100));
      }
    }
    expect(northTop).toBeGreaterThan(1.7);
    expect(southTop).toBeLessThan(1.25);
    // The arena wall the seating falls to.
    expect(heights.has(62)).toBe(true);
  });

  it('lays the arena inside the ring on sand that keeps every danger cue readable', () => {
    const mask = sceneTileMask(getArenaMap('rome')!, CITY_LOOKS.rome, false)!;
    const map = parseMapRows(arenaMapRows('rome'));
    const sand = mask.rows.flatMap((row, y) => Array.from(row)
      .flatMap((cls, x) => (cls === 'a' ? [{ x, y }] : [])));
    expect(sand.length).toBeGreaterThan(40);
    // Floor only, and only inside the ring's rows.
    sand.forEach(({ x, y }) => {
      expect(map[y][x]).not.toBe('Wall');
      expect(y).toBeGreaterThan(north);
      expect(y).toBeLessThan(south);
    });
    const tones = mask.floors.a;
    expect(tones.a).not.toBe(tones.b);
    [tones.a, tones.b].forEach((floor) => {
      expect(contrastRatio(floor, over(floor, TELEGRAPH_EDGE_COLOR, TELEGRAPH_EDGE_OPACITY)))
        .toBeGreaterThanOrEqual(3);
      expect(contrastRatio(floor, over(floor, TELEGRAPH_FILL_COLOR, TELEGRAPH_FILL_OPACITY)))
        .toBeGreaterThanOrEqual(3);
    });
    // High contrast keeps the plain floor.
    expect(sceneTileMask(getArenaMap('rome')!, CITY_LOOKS.rome, true)!.floors.a).toBeUndefined();
  });
});

describe('Budapest bridges', () => {
  it('stands two towers, one at each bank, on every deck over the river', () => {
    const rows = arenaMapMask('budapest')!;
    const built = buildCityBuildings(rows, CITY_BUILDING_STYLES.budapest, 'budapest');
    const position = built.mass.getAttribute('position');
    const towerCells = new Set<string>();
    for (let index = 0; index < position.count; index += 1) {
      // Only the towers' shafts and caps rise above the chains (2.15).
      if (position.getY(index) > 2.25) {
        const { u, v } = lattice(position.getX(index), position.getZ(index));
        towerCells.add(`${Math.floor(u)},${Math.floor(v)}`);
      }
    }
    // The Chain Bridge on its marked pylons; the second bridge on the river
    // cells either side of its deck, in the same two columns.
    expect([...towerCells].sort()).toEqual([
      '11,13', '11,17', '11,3', '11,7', '7,13', '7,17', '7,3', '7,7',
    ]);
    expect(['7,13', '7,17', '11,13', '11,17'].every((cell) => {
      const [x, y] = cell.split(',').map(Number);
      return rows[y][x] === 'w';
    })).toBe(true);
  });
});

describe('city building cut-away', () => {
  it('collapses what fog hides to nothing, and restores it exactly', () => {
    const rows = arenaMapMask('barcelona')!;
    const built = buildCityBuildings(rows, CITY_BUILDING_STYLES.barcelona, 'barcelona');
    const geometry = built.mass.clone();
    const weights = cutawayWeights(geometry, rows[0].length, rows.length);
    const { count } = geometry.getAttribute('position');
    const shares = new Float32Array(rows.length * rows[0].length).fill(1);
    const present = new Uint8Array(count).fill(1);
    for (let index = 0; index < count / 2; index += 1) present[index] = 0;
    applyCutaway(geometry, weights, shares, present);
    const position = geometry.getAttribute('position');
    // Every hidden vertex on one point: its triangles have no area.
    const hidden = new Set<string>();
    for (let index = 0; index < count / 2; index += 1) {
      hidden.add(`${position.getX(index)},${position.getY(index)},${position.getZ(index)}`);
    }
    expect(hidden.size).toBe(1);
    expect(position.getY(0)).toBeLessThan(-1);
    applyCutaway(geometry, weights, shares, present.fill(1));
    expect(Array.from(geometry.getAttribute('position').array))
      .toEqual(Array.from(built.mass.getAttribute('position').array));
  });

  it('sinks the focus cell, two rows toward the camera and a column either side', () => {
    const shares = cutawayTargets(10, 8, [{ x: 4.4, y: 2.6 }]);
    const sunk: string[] = [];
    shares.forEach((share, index) => {
      if (share < 1) {
        expect(share).toBeCloseTo(CUTAWAY_SQUASH);
        sunk.push(`${index % 10},${Math.floor(index / 10)}`);
      } else {
        expect(share).toBe(1);
      }
    });
    // The fighter stands on (4,3): rows 3-5, columns 3-5.
    expect(sunk.sort()).toEqual(['3,3', '3,4', '3,5', '4,3', '4,4', '4,5', '5,3', '5,4', '5,5']);
    // Clipped at the board's edge.
    expect(Array.from(cutawayTargets(3, 3, [{ x: 0, y: 2 }])).filter((s) => s < 1)).toHaveLength(2);
  });

  it('eases toward its targets, and snaps at once under reduced motion', () => {
    const shown = new Float32Array([1, 1]);
    const target = new Float32Array([CUTAWAY_SQUASH, 1]);
    expect(stepCutaway(shown, target, 1 / 60, false)).toBe(true);
    expect(shown[0]).toBeLessThan(1);
    expect(shown[0]).toBeGreaterThan(CUTAWAY_SQUASH);
    expect(stepCutaway(shown, target, 1 / 60, true)).toBe(true);
    expect(shown[0]).toBeCloseTo(CUTAWAY_SQUASH);
    expect(stepCutaway(shown, target, 1 / 60, false)).toBe(false);
  });
});
