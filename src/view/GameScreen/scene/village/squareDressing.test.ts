import * as THREE from 'three';
import { CAMPAIGN_STAGE_LAYOUTS } from '../../../../content/campaignLayouts';
import { STAGE_DEFINITIONS } from '../../../../content/stages';
import type { RepairStage } from '../../../../content/villageSquare';
import { MAP_OFFSET_X, MAP_OFFSET_Z } from '../sceneSpace';
import { buildSquareDressing } from './squareDressing';

// The square's dressing (render only) at each repair stage: it must show the
// village rebuilding, and it must never stand where a player can stand or
// rise in front of one. Cells are map cells; the camera is always south.

const { square } = CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf;
const PILLARS: [number, number][] = [[4, 4], [7, 4]];
const STAGES: RepairStage[] = [0, 1, 2, 3];
const cellX = (x: number) => x - MAP_OFFSET_X;
const cellY = (z: number) => z - MAP_OFFSET_Z;

/** Points on every triangle: corners, edge midpoints and centroid. */
function samplePoints(geometry: THREE.BufferGeometry): THREE.Vector3[] {
  const position = geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    points.push(
      a.clone(),
      b.clone(),
      c.clone(),
      a.clone().add(b).multiplyScalar(0.5),
      b.clone().add(c).multiplyScalar(0.5),
      a.clone().add(c).multiplyScalar(0.5),
      a.clone().add(b).add(c).divideScalar(3)
    );
  }
  return points;
}

/** True if (x, y) lies in the middle of an open square cell, where a player stands. */
function inPlayerSpot(x: number, y: number): boolean {
  const {
    x0, y0, x1, y1,
  } = square.bounds;
  const cx = Math.round(x);
  const cy = Math.round(y);
  if (cx < x0 || cx > x1 || cy < y0 || cy > y1) return false;
  if (PILLARS.some(([px, py]) => px === cx && py === cy)) return false;
  return Math.abs(x - cx) < 0.35 && Math.abs(y - cy) < 0.35;
}

describe.each(STAGE_DEFINITIONS.map((stage) => stage.id))('square dressing in %s', (stageId) => {
  const dressings = STAGES.map((repair) => buildSquareDressing(stageId, repair, square, PILLARS));

  it('rebuilds visibly: ruins and smoke, then lanterns, then lit banners, then a festival', () => {
    const [damaged, rebuilt, thriving, festival] = dressings.map((dressing) => dressing.ambience);
    expect(damaged.lanterns).toHaveLength(0);
    expect(damaged.smoke.length).toBeGreaterThan(0);
    expect(damaged.smoke.every((source) => source.dark)).toBe(true);
    expect(rebuilt.smoke.every((source) => !source.dark)).toBe(true);
    expect(rebuilt.lanterns.length).toBeGreaterThan(0);
    expect(rebuilt.lit).toBe(false);
    expect(thriving.lit).toBe(true);
    expect(thriving.lanterns.length).toBeGreaterThan(rebuilt.lanterns.length);
    expect(festival.lanterns.length).toBeGreaterThan(thriving.lanterns.length + 8);
    // Every stage is a different build, not a recolour.
    const sizes = dressings.map((dressing) => dressing.token.body.getAttribute('position').count);
    expect(new Set(sizes).size).toBe(4);
    expect(sizes[3]).toBeGreaterThan(sizes[2]);
    expect(sizes[2]).toBeGreaterThan(sizes[1]);
  });

  it('never stands where a player stands, and stays low south and east of the square', () => {
    const { y0, x1, y1 } = square.bounds;
    dressings.forEach((dressing, repair) => {
      const offending: string[] = [];
      samplePoints(dressing.token.body).forEach((point) => {
        const x = cellX(point.x);
        const y = cellY(point.z);
        // Flat marks on the paving (scorch) are fine anywhere.
        if (point.y > 0.05 && inPlayerSpot(x, y)) offending.push(`${x.toFixed(2)},${y.toFixed(2)}@${point.y.toFixed(2)}`);
        // South and east, anything tall would rise between the camera and the square.
        if (((x > x1 + 0.5 && y > y0 - 0.5) || y > y1 + 0.5) && point.y > 1.3) offending.push(`low ${x.toFixed(2)},${y.toFixed(2)}@${point.y.toFixed(2)}`);
      });
      dressing.ambience.lanterns.forEach((lantern) => {
        // A lantern's body is 0.11 round, hanging below its hook.
        [[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12]].forEach(([dx, dz]) => {
          if (inPlayerSpot(cellX(lantern.x + dx), cellY(lantern.z + dz))) offending.push(`lantern ${lantern.x},${lantern.z}`);
        });
      });
      expect({ repair, offending: offending.slice(0, 5) }).toEqual({ repair, offending: [] });
    });
  });
});
