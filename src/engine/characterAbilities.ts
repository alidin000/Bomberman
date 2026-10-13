import {
  GameMap, isBomb, isObstacle, isPower,
} from '../model/gameItem';
import { BombState, GameEngineState, Point } from './types';
import { isInVillageSquare } from './villageSquare';

export const SHADOW_CLONE_FORMATION_MS = 2000;

export const CARDINAL_DIRECTIONS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function shadowCloneHasFormed(bomb: BombState): boolean {
  return bomb.kind === 'shadowCloneBarrage'
    && (bomb.ageMs ?? 0) >= SHADOW_CLONE_FORMATION_MS;
}

function canHoldShadowClone(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  if (cell === undefined || cell === 'Wall' || cell === 'Box') return false;
  // The barrage's blast stops at the village square's edge, and so do its clones.
  if (isInVillageSquare(state, x, y)) return false;
  return !isBomb(cell) && !isObstacle(cell) && (cell === 'Empty' || isPower(cell));
}

export function getShadowCloneBarragePositions(
  bomb: BombState,
  map: GameMap
): Point[] {
  const positions: Point[] = [{ x: bomb.x, y: bomb.y }];
  CARDINAL_DIRECTIONS.forEach((direction) => {
    for (let distance = 1; distance <= bomb.range; distance += 1) {
      const x = bomb.x + direction.x * distance;
      const y = bomb.y + direction.y * distance;
      const cell = map[y]?.[x];
      if (cell === undefined || cell === 'Wall') break;
      positions.push({ x, y });
      if (cell === 'Box' || isObstacle(cell)) break;
    }
  });
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const x = bomb.x + dx;
      const y = bomb.y + dy;
      if (
        Math.abs(dx) + Math.abs(dy) <= 3
        && x > 0
        && x < map[0].length - 1
        && y > 0
        && y < map.length - 1
        && map[y][x] !== 'Wall'
      ) positions.push({ x, y });
    }
  }
  const seen = new Set<string>();
  return positions.filter(({ x, y }) => {
    const key = `${x},${y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getShadowCloneFormationCells(bomb: BombState, map: GameMap): Point[] {
  return getShadowCloneBarragePositions(bomb, map).filter(({ x, y }) => {
    if (x === bomb.x && y === bomb.y) return false;
    const cell = map[y]?.[x];
    return cell === 'Empty' || isPower(cell);
  });
}

export type ShadowCloneBlock = Point & { ownerId: string };

/** Every traversable blast cell occupied by Naruto's formed clones. */
export function getShadowCloneBlocks(state: GameEngineState): ShadowCloneBlock[] {
  const cells: ShadowCloneBlock[] = [];
  const seen = new Set<string>();
  state.bombs.filter(shadowCloneHasFormed).forEach((bomb) => {
    getShadowCloneFormationCells(bomb, state.map).forEach((point) => {
      const key = `${point.x},${point.y},${bomb.ownerId}`;
      if (!seen.has(key) && canHoldShadowClone(state, point.x, point.y)) {
        seen.add(key);
        cells.push({ ...point, ownerId: bomb.ownerId });
      }
    });
  });
  return cells;
}

export function getShadowCloneBlockCells(state: GameEngineState): Point[] {
  return getShadowCloneBlocks(state).map(({ x, y }) => ({ x, y }));
}

export function isShadowCloneBlocked(
  state: GameEngineState,
  x: number,
  y: number,
  movingPlayerId?: string
): boolean {
  return getShadowCloneBlocks(state).some((point) => (
    point.x === x && point.y === y
    && point.ownerId !== movingPlayerId
  ));
}
