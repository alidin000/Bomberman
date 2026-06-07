import { GameMap, gameItem } from '../model/gameItem';
import { PlayerState, Point } from './types';

export const PLAYER_MOVE_STEP = 0.1;
export const PLAYER_COLLISION_RADIUS = 0.28;
export const PLAYER_LANE_SNAP_DISTANCE = 0.42;
export const ENTITY_TOUCH_DISTANCE = PLAYER_COLLISION_RADIUS * 2;

export function roundToMovementStep(value: number): number {
  return Number(value.toFixed(3));
}

export function moveTowardCellCenter(value: number): number {
  const center = Math.round(value);
  const offset = center - value;
  if (Math.abs(offset) > PLAYER_LANE_SNAP_DISTANCE) return value;
  if (Math.abs(offset) <= PLAYER_MOVE_STEP) return center;
  return roundToMovementStep(value + Math.sign(offset) * PLAYER_MOVE_STEP);
}

export function getPlayerCell(player: Pick<PlayerState, 'x' | 'y'>): Point {
  return {
    x: Math.round(player.x),
    y: Math.round(player.y),
  };
}

export function getCell(map: GameMap, point: Point): gameItem | undefined {
  return map[point.y]?.[point.x];
}

export function getOverlappedCells(
  x: number,
  y: number,
  radius = PLAYER_COLLISION_RADIUS
): Point[] {
  const minX = Math.floor(x - radius + 0.5);
  const maxX = Math.floor(x + radius + 0.5);
  const minY = Math.floor(y - radius + 0.5);
  const maxY = Math.floor(y + radius + 0.5);
  const cells: Point[] = [];

  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      cells.push({ x: cx, y: cy });
    }
  }

  return cells;
}

export function positionOverlapsCell(
  position: Pick<PlayerState, 'x' | 'y'>,
  cellX: number,
  cellY: number,
  radius = PLAYER_COLLISION_RADIUS
): boolean {
  return Math.abs(position.x - cellX) <= 0.5 + radius
    && Math.abs(position.y - cellY) <= 0.5 + radius;
}

export function positionsTouch(
  first: Pick<PlayerState, 'x' | 'y'>,
  second: Pick<PlayerState, 'x' | 'y'>,
  distance = ENTITY_TOUCH_DISTANCE
): boolean {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  return dx * dx + dy * dy <= distance * distance;
}
