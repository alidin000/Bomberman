/* eslint-disable no-restricted-syntax */
/* eslint-disable comma-dangle, prefer-const, @typescript-eslint/no-unused-vars */
import {
  GameMap, isBomb, isObstacle,
} from '../model/gameItem';
import {
  Point, GameEngineState, MonsterState, PlayerState,
} from './types';
import { MONSTER_MOVE_MS } from './constants';
import { applyCharacterSurvival, isPowerUpActive } from './players';
import { getPlayerCell, positionsTouch } from './grid';

const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

function isInBounds(x: number, y: number, map: GameMap): boolean {
  return x >= 1 && x < map[0].length - 1 && y >= 1 && y < map.length - 1;
}

function basicValidMove(
  x: number,
  y: number,
  map: GameMap,
  monsters: MonsterState[],
  selfId: string,
): boolean {
  if (!isInBounds(x, y, map)) return false;
  if (map[y][x] !== 'Empty') return false;
  return !monsters.some((m) => m.id !== selfId && m.x === x && m.y === y);
}

function ghostValidMove(x: number, y: number, map: GameMap): boolean {
  if (!isInBounds(x, y, map)) return false;
  const cell = map[y][x];
  return cell !== 'Wall' && !isBomb(cell);
}

function getNeighbors(point: Point, map: GameMap): Point[] {
  return DIRECTIONS.map((d) => ({ x: point.x + d.x, y: point.y + d.y }))
    .filter((p) => isInBounds(p.x, p.y, map) && map[p.y][p.x] === 'Empty');
}

function heuristic(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function aStarSearch(map: GameMap, start: Point, goal: Point): Point[] {
  let openSet: Point[] = [start];
  const cameFrom = new Map<string, Point>();
  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  const key = (p: Point) => `${p.x},${p.y}`;

  gScore.set(key(start), 0);
  fScore.set(key(start), heuristic(start, goal));

  while (openSet.length > 0) {
    const current = openSet.reduce((a, b) => (
      (fScore.get(key(a)) ?? Infinity) < (fScore.get(key(b)) ?? Infinity) ? a : b
    ));

    if (current.x === goal.x && current.y === goal.y) {
      const path: Point[] = [];
      let cur: Point | undefined = current;
      while (cur) {
        path.unshift(cur);
        cur = cameFrom.get(key(cur));
      }
      return path;
    }

    openSet = openSet.filter((p) => p.x !== current.x || p.y !== current.y);

    for (const neighbor of getNeighbors(current, map)) {
      const tentative = (gScore.get(key(current)) ?? Infinity) + 1;
      if (tentative < (gScore.get(key(neighbor)) ?? Infinity)) {
        cameFrom.set(key(neighbor), current);
        gScore.set(key(neighbor), tentative);
        fScore.set(key(neighbor), tentative + heuristic(neighbor, goal));
        if (!openSet.some((p) => p.x === neighbor.x && p.y === neighbor.y)) {
          openSet.push(neighbor);
        }
      }
    }
  }
  return [];
}

function moveBasicMonster(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  if (options.length === 0) return monster;
  const chosen = options[Math.floor(Math.random() * options.length)];
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveSmartMonster(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  if (options.length > 0) {
    const chosen = options[Math.floor(Math.random() * options.length)];
    return { ...monster, x: chosen.x, y: chosen.y };
  }

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) return monster;

  const closest = alivePlayers.reduce((best, p) => {
    const bestDist = (best.x - monster.x) ** 2 + (best.y - monster.y) ** 2;
    const pDist = (p.x - monster.x) ** 2 + (p.y - monster.y) ** 2;
    return pDist < bestDist ? p : best;
  });

  const path = aStarSearch(map, { x: monster.x, y: monster.y }, getPlayerCell(closest));
  if (path.length > 1) {
    return { ...monster, x: path[1].x, y: path[1].y };
  }
  return monster;
}

function moveGhostMonster(monster: MonsterState, map: GameMap): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => ghostValidMove(p.x, p.y, map));

  if (options.length === 0) return monster;
  const chosen = options[Math.floor(Math.random() * options.length)];
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveForkMonster(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  if (options.length === 0) return monster;

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) {
    const chosen = options[Math.floor(Math.random() * options.length)];
    return { ...monster, x: chosen.x, y: chosen.y };
  }

  const closest = alivePlayers.reduce((best, p) => {
    const bestDist = Math.abs(best.x - monster.x) + Math.abs(best.y - monster.y);
    const pDist = Math.abs(p.x - monster.x) + Math.abs(p.y - monster.y);
    return pDist < bestDist ? p : best;
  });

  let bestDir = options[0];
  let minDist = Infinity;
  options.forEach((dir) => {
    const dist = Math.abs(dir.x - closest.x) + Math.abs(dir.y - closest.y);
    if (dist < minDist) {
      minDist = dist;
      bestDir = dir;
    }
  });

  if (Math.random() < 0.15) {
    const random = options[Math.floor(Math.random() * options.length)];
    return { ...monster, x: random.x, y: random.y };
  }
  return { ...monster, x: bestDir.x, y: bestDir.y };
}

function moveMonsterByKind(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
): MonsterState {
  switch (monster.kind) {
    case 'smart':
      return moveSmartMonster(monster, map, monsters, players);
    case 'ghost':
      return moveGhostMonster(monster, map);
    case 'fork':
      return moveForkMonster(monster, map, monsters, players);
    default:
      return moveBasicMonster(monster, map, monsters);
  }
}

export function tickMonsters(state: GameEngineState, deltaMs: number): MonsterState[] {
  return state.monsters.map((monster) => {
    let cooldown = monster.moveCooldown - deltaMs;
    if (cooldown > 0) {
      return { ...monster, moveCooldown: cooldown };
    }

    const moved = moveMonsterByKind(
      monster,
      state.map,
      state.monsters,
      state.players,
    );
    return {
      ...moved,
      moveCooldown: MONSTER_MOVE_MS[monster.kind],
    };
  });
}

export function checkMonsterCollisions(state: GameEngineState): PlayerState[] {
  return state.players.map((player) => {
    if (!player.alive) return player;
    const hasInvincibility = isPowerUpActive(state, player.id, 'Invincibility');
    if (hasInvincibility) return player;

    const hit = state.monsters.some((m) => positionsTouch(m, player));
    return hit ? applyCharacterSurvival(player) : player;
  });
}

export { isInBounds, isObstacle };
