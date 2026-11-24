import * as THREE from 'three';
import { arenaMapForConfig, arenaMapRows, getArenaMap } from '../../../../content/arenaMaps';
import { STAGE_DEFINITIONS } from '../../../../content/stages';
import { getStageLook } from '../../../../content/stageLooks';
import type { StageId } from '../../../../content/types';
import { cellKey } from '../../../../engine/fogOfWar';
import { loadCampaignMapRows, parseMapRows } from '../../../../engine/mapLoader';
import { sceneTileMask } from '../arenaScene';
import { MAP_OFFSET_X, MAP_OFFSET_Z, TILE_SIZE } from '../sceneSpace';
import { buildStaticTileLayers } from '../staticTiles';
import {
  VILLAGE_BODY_CAP, VILLAGE_BUILDING_STYLES, VILLAGE_HOUSE_CAP, VILLAGE_SOUTH_CAP, VILLAGE_TREE_CAP,
  buildVillageBuildings, villageMaskRows,
} from './villageBuildings';

const EPS = 1e-6;
const VILLAGES = Object.keys(VILLAGE_BUILDING_STYLES) as StageId[];

const lattice = (x: number, z: number) => ({
  u: x / TILE_SIZE - MAP_OFFSET_X + 0.5,
  v: z / TILE_SIZE - MAP_OFFSET_Z + 0.5,
});

/**
 * Raised vertices (above the floor) that stand on no wall cell. Off the
 * board counts as wall: border trees may overhang outward, never inward.
 */
function strayRaised(geometry: THREE.BufferGeometry, rows: readonly string[]): string[] {
  const position = geometry.getAttribute('position');
  const stray: string[] = [];
  const outside = (x: number, y: number) => (
    y < 0 || x < 0 || y >= rows.length || x >= rows[0].length
  );
  const wall = (x: number, y: number) => outside(x, y) || 'eb'.includes(rows[y][x]);
  for (let index = 0; index < position.count; index += 1) {
    if (position.getY(index) <= 0.02) continue; // eslint-disable-line no-continue
    const { u, v } = lattice(position.getX(index), position.getZ(index));
    const xs = [Math.floor(u + EPS), Math.floor(u - EPS)];
    const ys = [Math.floor(v + EPS), Math.floor(v - EPS)];
    if (!xs.some((x) => ys.some((y) => wall(x, y))) && stray.length < 5) {
      stray.push(`${u.toFixed(3)},${v.toFixed(3)}`);
    }
  }
  return stray;
}

describe('village buildings', () => {
  it('gives the six atlas villages buildings, and leaves the war front as it was', () => {
    expect(VILLAGES.sort()).toEqual([
      'akatsukiHideout', 'hiddenCloud', 'hiddenLeaf', 'hiddenMist', 'hiddenSand', 'hiddenStone',
    ]);
    const war = getArenaMap('greatShinobiWar')!;
    expect(sceneTileMask(war, getStageLook('greatShinobiWar'), false)).toBeNull();
  });

  it('keeps today\'s walls in high contrast and with buildings off', () => {
    const arena = getArenaMap('hiddenLeaf')!;
    const look = getStageLook('hiddenLeaf');
    expect(sceneTileMask(arena, look, true)).toBeNull();
    expect(sceneTileMask(arena, look, false, false)).toBeNull();
  });

  it('marks the border ring, the walls inside, and grass beside walls', () => {
    const rows = villageMaskRows([
      ['W', 'W', 'W', 'W', 'W'],
      ['W', ' ', ' ', ' ', 'W'],
      ['W', ' ', 'W', ' ', 'W'],
      ['W', ' ', ' ', ' ', 'W'],
      ['W', ' ', ' ', 'B', 'W'],
      ['W', ' ', ' ', ' ', 'W'],
      ['W', 'W', 'W', 'W', 'W'],
    ]);
    // A crate is floor: open ground away from every wall is path.
    expect(rows).toEqual(['eeeee', 'eggge', 'egbge', 'eggge', 'egpge', 'eggge', 'eeeee']);
  });

  VILLAGES.forEach((id) => {
    const style = VILLAGE_BUILDING_STYLES[id]!;
    const arena = getArenaMap(id)!;
    const mask = sceneTileMask(arena, getStageLook(id), false)!;
    const built = buildVillageBuildings(mask.rows, style, id);

    it(`${id}: draws every wall as village, and leaves no cube behind`, () => {
      expect(mask.buildings?.kind).toBe('village');
      expect(mask.buildings?.crate).toBe(style.crate);
      const map = parseMapRows(arenaMapRows(id));
      const walls = map.flat().filter((cell) => cell === 'Wall').length;
      expect(built.cells).toBe(walls);
      const all = new Set(map.flatMap((row, y) => row.map((_cell, x) => cellKey(x, y))));
      const stage = STAGE_DEFINITIONS.find((entry) => entry.id === id)!;
      const layers = buildStaticTileLayers(
        map,
        stage.palette,
        all,
        new Set(),
        new Set(),
        undefined,
        mask
      );
      expect(layers.wallVisible).toEqual([]);
      expect(layers.waterVisible).toEqual([]);
    });

    it(`${id}: raises nothing on open ground`, () => {
      expect(strayRaised(built.mass, mask.rows)).toEqual([]);
      expect(strayRaised(built.detail, mask.rows)).toEqual([]);
    });

    it(`${id}: keeps houses low, the border's crowns under the cap and its camera row low`, () => {
      expect(built.bodyTop).toBeGreaterThan(0.66);
      // The signature towers top the village; houses stay lower.
      expect(built.bodyTop).toBeGreaterThan(VILLAGE_HOUSE_CAP);
      expect(built.bodyTop).toBeLessThanOrEqual(VILLAGE_BODY_CAP);
      expect(built.southRowTop).toBeLessThanOrEqual(VILLAGE_SOUTH_CAP);
      expect(built.featureTop).toBeLessThanOrEqual(VILLAGE_TREE_CAP);
      const position = built.mass.getAttribute('position');
      let southTop = 0;
      let insideTop = 0;
      for (let index = 0; index < position.count; index += 1) {
        const { u, v } = lattice(position.getX(index), position.getZ(index));
        const y = position.getY(index);
        if (v > mask.rows.length - 1 + 0.01) southTop = Math.max(southTop, y);
        const inside = u > 1.01 && v > 1.01 && u < mask.rows[0].length - 1.01
          && v < mask.rows.length - 1.01;
        if (inside) insideTop = Math.max(insideTop, y);
      }
      expect(southTop).toBeLessThanOrEqual(VILLAGE_SOUTH_CAP + EPS);
      expect(insideTop).toBeLessThanOrEqual(VILLAGE_BODY_CAP + EPS);
    });

    it(`${id}: dresses an online room on this village exactly as Local Arena`, () => {
      const online = arenaMapForConfig({ mode: 'onlinePreview', selectedMap: id });
      expect(sceneTileMask(online, getStageLook(id), false)).toBe(mask);
    });

    it(`${id}: stands its signature buildings near the board's quarters`, () => {
      const position = built.mass.getAttribute('position');
      const towers = new Set<string>();
      for (let index = 0; index < position.count; index += 1) {
        const { u, v } = lattice(position.getX(index), position.getZ(index));
        const inside = u > 1 && v > 1 && u < mask.rows[0].length - 1 && v < mask.rows.length - 1;
        if (inside && position.getY(index) > VILLAGE_HOUSE_CAP + 0.05) {
          towers.add(`${Math.floor(u)},${Math.floor(v)}`);
        }
      }
      expect(towers.size).toBeGreaterThanOrEqual(2);
      expect(towers.size).toBeLessThanOrEqual(4);
      towers.forEach((cell) => {
        const [x, y] = cell.split(',').map(Number);
        expect(mask.rows[y][x]).toBe('b');
      });
    });

    it(`${id}: builds the same village every time`, () => {
      const again = buildVillageBuildings(mask.rows, style, id);
      expect(Array.from(again.mass.getAttribute('position').array))
        .toEqual(Array.from(built.mass.getAttribute('position').array));
      expect(Array.from(again.detail.getAttribute('color').array))
        .toEqual(Array.from(built.detail.getAttribute('color').array));
    });
  });
});

describe('campaign villages', () => {
  VILLAGES.forEach((id) => {
    const style = VILLAGE_BUILDING_STYLES[id]!;
    const look = getStageLook(id);
    const map = parseMapRows(loadCampaignMapRows(id));
    // A wall that must stay itself, as a campaign's boss gate does.
    const gateY = map.findIndex((row, y) => y > 0 && row.some((cell, x) => (
      cell === 'Wall' && x > 0 && x < row.length - 1
    )));
    const gateX = map[gateY].findIndex((cell, x) => cell === 'Wall' && x > 0);
    const skip = new Set([`${gateX},${gateY}`]);
    const mask = sceneTileMask(undefined, look, false, true, map, skip)!;

    it(`${id}: draws its campaign map as the village, but for the cells it keeps`, () => {
      expect(mask.buildings?.kind).toBe('village');
      expect(mask.rows[gateY][gateX]).not.toMatch(/[eb]/);
      const walls = map.flat().filter((cell) => cell === 'Wall').length;
      const built = buildVillageBuildings(mask.rows, style, id);
      expect(built.cells).toBe(walls - 1);
      expect(strayRaised(built.mass, mask.rows)).toEqual([]);
      expect(built.southRowTop).toBeLessThanOrEqual(VILLAGE_SOUTH_CAP);
      expect(built.featureTop).toBeLessThanOrEqual(VILLAGE_TREE_CAP);
      // One object per tree, rock or lot, each on its own wall cells.
      const owners = built.owners!;
      const width = mask.rows[0].length;
      owners.cells.slice(1).forEach((cells) => {
        expect(cells.length).toBeGreaterThan(0);
        cells.forEach((cell) => {
          expect('eb').toContain(mask.rows[Math.floor(cell / width)][cell % width]);
        });
      });
      expect(owners.mass.reduce((top, owner) => Math.max(top, owner), 0))
        .toBe(owners.cells.length - 1);
    });

    it(`${id}: keeps one mask per match map, and none in high contrast`, () => {
      expect(sceneTileMask(undefined, look, false, true, map, new Set(skip))).toBe(mask);
      expect(sceneTileMask(undefined, look, true, true, map, skip)).toBeNull();
    });
  });
});

// The same colour rules as the cities' (cityBuildings.test.ts), measured
// against each village's own floor and today's wall.
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
// The cities' closest wall to flame orange (cityBuildings.test.ts) sets how close any may come.
const FLAME_DISTANCE = Math.min(...['#a9664a', '#b3855a', '#7b7d90'].map((hex) => deltaE(hex, FLAME)));

describe('village building colours', () => {
  VILLAGES.forEach((id) => {
    const style = VILLAGE_BUILDING_STYLES[id]!;
    const { palette } = STAGE_DEFINITIONS.find((stage) => stage.id === id)!;
    const floors = [palette.groundA, palette.groundB, ...(style.path ? [style.path] : [])];
    const floorContrast = (hex: string) => Math.min(...floors.map((floor) => contrast(hex, floor)));
    const surfaces = [
      ...style.walls, ...style.roofs, ...style.borderTones, style.stone,
      ...(style.cliffTop ? [style.cliffTop] : []),
    ];

    it(`${id}: walls, roofs, stone and border stand off the floor as well as today's wall`, () => {
      const today = floorContrast(palette.wall);
      expect(surfaces.filter((hex) => floorContrast(hex) < today - EPS)).toEqual([]);
    });

    it(`${id}: keeps every surface and opening as far from flame orange`, () => {
      const all = [...surfaces, style.window, style.frame, style.moss];
      expect(all.filter((hex) => deltaE(hex, FLAME) < FLAME_DISTANCE - 0.05)).toEqual([]);
    });
  });
});
