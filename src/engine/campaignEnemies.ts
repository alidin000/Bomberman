/* eslint-disable comma-dangle */
import { EnemyArchetype, getEnemyArchetypeDefinition } from '../content/enemies';
import { isBomb, isObstacle } from '../model/gameItem';
import {
  CampaignRespawnPointState,
  CampaignRuntimeState,
  GameEngineState,
  MonsterKind,
  MonsterState,
  Point,
} from './types';
import { MONSTER_MOVE_MS } from './constants';
import { positionOverlapsCell } from './grid';
import { DifficultySettings, getDifficulty } from './difficulty';

// "Creates a short-lived clone threat": a water clone fades after this long,
// so a Mist Ninja keeps at most two around instead of an ever-growing crowd.
export const WATER_CLONE_LIFETIME_MS = 6000;

const ARCHETYPE_KIND: Record<EnemyArchetype, MonsterKind> = {
  rogueGenin: 'basic',
  anbu: 'fork',
  mistNinja: 'ghost',
  sandNinja: 'smart',
  cloudNinja: 'fork',
  whiteZetsu: 'ghost',
  blackZetsu: 'fork',
};

const SPAWN_OFFSETS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

const ARCHETYPE_DETECTION_RANGE: Record<EnemyArchetype, number> = {
  rogueGenin: 6,
  anbu: 7,
  mistNinja: 6,
  sandNinja: 6,
  cloudNinja: 7,
  whiteZetsu: 4,
  blackZetsu: 5,
};

type SpawnState = Pick<GameEngineState, 'map' | 'monsters'> & Partial<Pick<GameEngineState, 'players'>>;

function canSpawnAt(state: SpawnState, x: number, y: number) {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell)
    && !state.monsters.some((monster) => monster.x === x && monster.y === y)
    // Never respawn an enemy onto a player: contact would be an unwarned hit.
    && !(state.players ?? []).some((player) => (
      player.alive && positionOverlapsCell(player, x, y)
    ));
}

function findSpawnCell(
  state: SpawnState,
  point: Pick<CampaignRespawnPointState, 'x' | 'y'>,
  seed: number
): Point | null {
  const ordered = SPAWN_OFFSETS.map((offset, index) => ({
    offset,
    order: (index + seed) % SPAWN_OFFSETS.length,
  })).sort((a, b) => a.order - b.order);

  const match = ordered.find(({ offset }) => canSpawnAt(
    state,
    point.x + offset.x,
    point.y + offset.y
  ));
  return match
    ? { x: point.x + match.offset.x, y: point.y + match.offset.y }
    : null;
}

export function createShinobiEnemy({
  archetype,
  x,
  y,
  id,
  spawnPointId,
  clone = false,
  difficulty = getDifficulty('hard'),
}: {
  archetype: EnemyArchetype;
  x: number;
  y: number;
  id: string;
  spawnPointId?: string;
  clone?: boolean;
  difficulty?: DifficultySettings;
}): MonsterState {
  const definition = getEnemyArchetypeDefinition(archetype);
  const kind = ARCHETYPE_KIND[archetype];
  return {
    id,
    name: clone ? 'Water Clone' : definition.label,
    x,
    y,
    kind,
    moveCooldown: Math.round(
      Math.max(260, MONSTER_MOVE_MS[kind] - (definition.elite ? 180 : 0))
        * difficulty.enemyMoveScale
    ),
    archetype,
    abilityKind: clone ? undefined : definition.ability,
    abilityLabel: clone ? undefined : definition.abilityLabel,
    abilityCooldown: clone ? undefined : Math.round(1600 * difficulty.abilityCooldownScale),
    abilityWarningTicks: 0,
    abilityTarget: null,
    detectionRange: Math.max(2, (clone
      ? 4
      : ARCHETYPE_DETECTION_RANGE[archetype] + (definition.elite ? 1 : 0)
    ) + difficulty.detectionOffset),
    spawnPointId,
    clone,
    elite: definition.elite,
    lifetimeMs: clone ? WATER_CLONE_LIFETIME_MS : undefined,
  };
}

function spawnFromPoint(
  state: SpawnState,
  point: CampaignRespawnPointState,
  difficulty: DifficultySettings,
): { monster: MonsterState | null; point: CampaignRespawnPointState } {
  const archetype = point.archetypes[point.spawnCount % point.archetypes.length];
  const cell = findSpawnCell(state, point, point.spawnCount);
  if (!cell) {
    return {
      monster: null,
      point: { ...point, ticksRemaining: point.respawnMs },
    };
  }

  const monster = createShinobiEnemy({
    archetype,
    x: cell.x,
    y: cell.y,
    id: `${point.id}-${point.spawnCount}`,
    spawnPointId: point.id,
    difficulty,
  });
  return {
    monster,
    point: {
      ...point,
      ticksRemaining: point.respawnMs,
      activeMonsterIds: [...point.activeMonsterIds, monster.id],
      spawnCount: point.spawnCount + 1,
    },
  };
}

export function initializeCampaignEnemies(
  campaign: CampaignRuntimeState | null,
  map: GameEngineState['map']
): {
  campaign: CampaignRuntimeState | null;
  monsters: MonsterState[];
} {
  if (!campaign) return { campaign, monsters: [] };

  let monsters: MonsterState[] = [];
  const difficulty = getDifficulty(campaign.difficulty);
  const spawnPoints = campaign.spawnPoints.map((point) => {
    let nextPoint = { ...point };
    for (let index = 0; index < point.initialCount; index += 1) {
      const spawned = spawnFromPoint({ map, monsters }, nextPoint, difficulty);
      nextPoint = spawned.point;
      if (spawned.monster) monsters = [...monsters, spawned.monster];
    }
    return nextPoint;
  });

  return {
    campaign: { ...campaign, spawnPoints },
    monsters,
  };
}

export function tickCampaignRespawns(
  state: GameEngineState,
  deltaMs: number
): GameEngineState {
  if (!state.campaign || deltaMs <= 0) return state;

  let monsters = [...state.monsters];
  const monsterIds = new Set(monsters.map((monster) => monster.id));
  const respawnPressure = state.campaign.event?.respawnPressure ?? 1;
  const difficulty = getDifficulty(state.campaign.difficulty);
  const spawnPoints = state.campaign.spawnPoints.map((point) => {
    const activeMonsterIds = point.activeMonsterIds.filter((id) => monsterIds.has(id));
    const full = activeMonsterIds.length >= point.maxActive;
    let nextPoint = {
      ...point,
      activeMonsterIds,
      // A full point holds its timer, so a cleared area waits a whole respawn
      // period instead of refilling the moment an enemy falls.
      ticksRemaining: full
        ? point.respawnMs
        : Math.max(0, point.ticksRemaining - deltaMs * respawnPressure),
    };

    if (full || nextPoint.ticksRemaining > 0) {
      return nextPoint;
    }

    const spawned = spawnFromPoint({ ...state, monsters }, nextPoint, difficulty);
    nextPoint = spawned.point;
    if (spawned.monster) {
      monsters = [...monsters, spawned.monster];
      monsterIds.add(spawned.monster.id);
    }
    return nextPoint;
  });

  return {
    ...state,
    monsters,
    campaign: {
      ...state.campaign,
      spawnPoints,
    },
  };
}
