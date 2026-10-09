import * as THREE from 'three';
import { hazardIsActive } from '../../../engine/bosses';
import { BossHazard, HazardKind } from '../../../engine/types';
import { STAGE_DEFINITIONS } from '../../../content';
import {
  HAZARD_FAMILIES,
  HAZARD_FAMILY,
  HazardFamily,
  TELEGRAPH_EDGE_COLOR,
  TELEGRAPH_EDGE_OPACITY,
  TELEGRAPH_FILL_COLOR,
  TELEGRAPH_FILL_OPACITY,
  TELEGRAPH_GEOMETRY,
  lineHeading,
  telegraphClosingScale,
  telegraphCountdown,
  telegraphPhase,
} from './hazardTelegraph';

function hazard(extra: Partial<BossHazard> = {}): BossHazard {
  return {
    id: 'hazard-1',
    kind: 'lavaBurst',
    x: 3,
    y: 3,
    ticksRemaining: 2400,
    warningTicks: 1680,
    color: '#ef4444',
    damage: 1,
    ...extra,
  };
}

// Which of a 24x24 grid of points over the cell a flat shape covers.
function footprint(geometry: THREE.BufferGeometry): boolean[] {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangles: number[][] = [];
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i += 3) {
    const corner = (k: number) => {
      const v = index ? index.getX(i + k) : i + k;
      return [position.getX(v), position.getZ(v)];
    };
    triangles.push([...corner(0), ...corner(1), ...corner(2)]);
  }
  const inside = (px: number, pz: number, t: number[]) => {
    const [ax, az, bx, bz, cx, cz] = t;
    const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz);
    const d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz);
    const d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az);
    const negative = d1 < 0 || d2 < 0 || d3 < 0;
    const positive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(negative && positive);
  };
  const cells: boolean[] = [];
  for (let gz = 0; gz < 24; gz += 1) {
    for (let gx = 0; gx < 24; gx += 1) {
      const px = -0.5 + (gx + 0.5) / 24;
      const pz = -0.5 + (gz + 0.5) / 24;
      cells.push(triangles.some((t) => inside(px, pz, t)));
    }
  }
  return cells;
}

function difference(a: boolean[], b: boolean[]): number {
  return a.filter((value, i) => value !== b[i]).length / a.length;
}

// sRGB channels; the canvas blends in sRGB, so composite there.
function rgb(hex: string): number[] {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

function luminance([r, g, b]: number[]): number {
  const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastOver(floor: string, color: string, opacity: number): number {
  const base = rgb(floor);
  const top = rgb(color);
  const mixed = base.map((c, i) => c * (1 - opacity) + top[i] * opacity);
  const [light, dark] = [luminance(base), luminance(mixed)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('hazard telegraph shapes', () => {
  it('gives the four families four different floor shapes, none of them the blast square', () => {
    const square = footprint(new THREE.PlaneGeometry(0.84, 0.84).rotateX(-Math.PI / 2));
    const fills = HAZARD_FAMILIES.map((family) => footprint(TELEGRAPH_GEOMETRY[family].fill));
    HAZARD_FAMILIES.forEach((family, i) => {
      expect(difference(fills[i], square)).toBeGreaterThan(0.1);
      // The outline is the same shape's edge: inside the fill, and hollow.
      const edge = footprint(TELEGRAPH_GEOMETRY[family].edge);
      expect(edge.every((covered, k) => !covered || fills[i][k])).toBe(true);
      expect(edge.filter(Boolean).length).toBeLessThan(fills[i].filter(Boolean).length * 0.75);
      for (let j = i + 1; j < fills.length; j += 1) {
        expect(difference(fills[i], fills[j])).toBeGreaterThan(0.08);
      }
    });
  });

  it('keeps each hazard kind in one family, with every family in use', () => {
    const used = new Set<HazardFamily>(Object.values(HAZARD_FAMILY));
    expect([...used].sort()).toEqual([...HAZARD_FAMILIES].sort());
    // Sweeps along a row or column read as lanes; bursts from a point do not.
    (['blueFireTrail', 'waterCannon', 'steamCharge'] as HazardKind[]).forEach((kind) => {
      expect(HAZARD_FAMILY[kind]).toBe('line');
    });
    expect(HAZARD_FAMILY.chakraShockwave).toBe('cross');
  });

  it.each([
    ['a boss strike (lethal for the last 3/7 of its warning)', {}],
    ['an enemy ability (lethal for a fixed window)', { activeMs: 800, warningTicks: 850, ticksRemaining: 1650 }],
  ])('closes the outline on the cell exactly when the engine makes %s lethal', (_, extra) => {
    const start = hazard(extra);
    let closedAt: number | null = null;
    for (let ticks = start.ticksRemaining; ticks > 0; ticks -= 50) {
      const sample = { ...start, ticksRemaining: ticks };
      const { remainingMs, leadMs } = telegraphCountdown(sample);
      const scale = telegraphClosingScale(remainingMs, leadMs);
      expect(telegraphPhase(sample) === 'active').toBe(hazardIsActive(sample));
      expect(scale === 1).toBe(hazardIsActive(sample));
      if (scale === 1 && closedAt === null) closedAt = ticks;
    }
    // It starts wide and closes all the way.
    const first = telegraphCountdown(start);
    expect(telegraphClosingScale(first.remainingMs, first.leadMs)).toBeGreaterThan(1.5);
    expect(closedAt).not.toBeNull();
  });

  it('reads against every arena floor without colour (grayscale contrast)', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      [stage.palette.groundA, stage.palette.groundB].forEach((floor) => {
        const edge = contrastOver(floor, TELEGRAPH_EDGE_COLOR, TELEGRAPH_EDGE_OPACITY);
        const fill = contrastOver(floor, TELEGRAPH_FILL_COLOR, TELEGRAPH_FILL_OPACITY);
        expect(edge).toBeGreaterThanOrEqual(3);
        expect(fill).toBeGreaterThanOrEqual(3);
      });
    });
  });

  it('runs a line attack\'s lane along its row or column', () => {
    const row = [4, 5, 6].map((x) => hazard({
      id: `row-${x}`, kind: 'waterCannon', x, y: 2
    }));
    const column = [4, 5, 6].map((y) => hazard({
      id: `col-${y}`, kind: 'steamCharge', x: 9, y
    }));
    const all = [...row, ...column];
    row.forEach((cell) => expect(lineHeading(cell, all, null)).toBe(0));
    column.forEach((cell) => expect(lineHeading(cell, all, null)).toBeCloseTo(Math.PI / 2));
    // A lone cell (walls cut the rest of the line) follows the boss's column.
    const lone = hazard({
      id: 'lone', kind: 'blueFireTrail', x: 3, y: 7
    });
    expect(lineHeading(lone, [lone], { x: 3, y: 1 })).toBeCloseTo(Math.PI / 2);
    expect(lineHeading(lone, [lone], { x: 8, y: 7 })).toBe(0);
  });
});
