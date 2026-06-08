import { getCharacterDefinition } from '../content';
import { CharacterId } from '../content/types';
import {
  CellVisibility,
  FogOfWarState,
  GameEngineState,
  Point,
} from './types';
import { getPlayerCell } from './grid';

const DEFAULT_VISION_RADIUS = 3;
const DEIDARA_EXPLOSION_REVEAL_RADIUS = 3;
const SASUKE_ENEMY_SENSE_BONUS = 2;
const ITACHI_ENEMY_SENSE_BONUS = 3;
const MINATO_PROXIMITY_SENSE_RADIUS = 6;
const GAARA_WALL_SENSE_BONUS = 2;
const DEIDARA_REVEAL_KINDS = new Set(['claySpider', 'giantClay']);

export function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function mapContains(state: GameEngineState, x: number, y: number): boolean {
  return y >= 0
    && y < state.map.length
    && x >= 0
    && x < (state.map[y]?.length ?? 0);
}

function addRadius(
  state: GameEngineState,
  visible: Set<string>,
  explored: Set<string>,
  center: Point,
  radius: number
): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
      if (mapContains(state, x, y) && distance <= radius) {
        const key = cellKey(x, y);
        visible.add(key);
        explored.add(key);
      }
    }
  }
}

function addAllCells(state: GameEngineState): FogOfWarState {
  const cells: string[] = [];
  state.map.forEach((row, y) => {
    row.forEach((_, x) => cells.push(cellKey(x, y)));
  });
  return {
    visible: cells,
    explored: cells,
    sensedEnemies: [],
    sensedWalls: [],
  };
}

function getDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function addSensedEnemies(
  state: GameEngineState,
  sensedEnemies: Set<string>,
  center: Point,
  radius: number
): void {
  state.monsters.forEach((monster) => {
    const enemyCell = { x: Math.round(monster.x), y: Math.round(monster.y) };
    if (mapContains(state, enemyCell.x, enemyCell.y)
      && getDistance(center, enemyCell) <= radius) {
      sensedEnemies.add(cellKey(enemyCell.x, enemyCell.y));
    }
  });

  if (state.boss && state.boss.health > 0) {
    const bossCell = { x: Math.round(state.boss.x), y: Math.round(state.boss.y) };
    if (mapContains(state, bossCell.x, bossCell.y)
      && getDistance(center, bossCell) <= radius) {
      sensedEnemies.add(cellKey(bossCell.x, bossCell.y));
    }
  }
}

function addSensedWalls(
  state: GameEngineState,
  sensedWalls: Set<string>,
  center: Point,
  radius: number
): void {
  for (let y = center.y - radius; y <= center.y + radius; y += 1) {
    for (let x = center.x - radius; x <= center.x + radius; x += 1) {
      if (mapContains(state, x, y) && getDistance(center, { x, y }) <= radius) {
        const cell = state.map[y]?.[x];
        if (cell === 'Wall' || cell === 'Box') {
          sensedWalls.add(cellKey(x, y));
        }
      }
    }
  }
}

export function getVisionRadius(characterId: CharacterId): number {
  return getCharacterDefinition(characterId).visionRadius ?? DEFAULT_VISION_RADIUS;
}

export function calculateFogOfWar(state: GameEngineState): FogOfWarState {
  if (state.config.mode !== 'solo') {
    return addAllCells(state);
  }

  const visible = new Set<string>();
  const explored = new Set<string>(state.fogOfWar?.explored ?? []);
  const sensedEnemies = new Set<string>();
  const sensedWalls = new Set<string>();

  state.players
    .filter((player) => player.alive)
    .forEach((player) => {
      const playerCell = getPlayerCell(player);
      const visionRadius = getVisionRadius(player.characterId);
      addRadius(
        state,
        visible,
        explored,
        playerCell,
        visionRadius
      );

      if (player.characterId === 'sasuke') {
        addSensedEnemies(
          state,
          sensedEnemies,
          playerCell,
          visionRadius + SASUKE_ENEMY_SENSE_BONUS
        );
      }
      if (player.characterId === 'itachi') {
        addSensedEnemies(
          state,
          sensedEnemies,
          playerCell,
          visionRadius + ITACHI_ENEMY_SENSE_BONUS
        );
      }
      if (player.characterId === 'minato') {
        addSensedEnemies(
          state,
          sensedEnemies,
          playerCell,
          MINATO_PROXIMITY_SENSE_RADIUS
        );
      }
      if (player.characterId === 'gaara') {
        addSensedWalls(
          state,
          sensedWalls,
          playerCell,
          visionRadius + GAARA_WALL_SENSE_BONUS
        );
      }
    });

  state.explosions
    .filter((explosion) => explosion.kind && DEIDARA_REVEAL_KINDS.has(explosion.kind))
    .forEach((explosion) => {
      addRadius(
        state,
        visible,
        explored,
        explosion,
        DEIDARA_EXPLOSION_REVEAL_RADIUS
      );
    });

  return {
    visible: Array.from(visible).sort(),
    explored: Array.from(explored).sort(),
    sensedEnemies: Array.from(sensedEnemies).sort(),
    sensedWalls: Array.from(sensedWalls).sort(),
  };
}

export function withUpdatedFogOfWar(state: GameEngineState): GameEngineState {
  return { ...state, fogOfWar: calculateFogOfWar(state) };
}

export function getCellVisibility(
  fogOfWar: FogOfWarState,
  x: number,
  y: number
): CellVisibility {
  const key = cellKey(x, y);
  if (fogOfWar.visible.includes(key)) return 'visible';
  if (fogOfWar.explored.includes(key)) return 'explored';
  return 'hidden';
}

export function isCellVisible(fogOfWar: FogOfWarState, x: number, y: number): boolean {
  return getCellVisibility(fogOfWar, x, y) === 'visible';
}
