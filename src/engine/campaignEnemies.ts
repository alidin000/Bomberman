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

function canSpawnAt(state: Pick<GameEngineState, 'map' | 'monsters'>, x: number, y: number) {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell)
    && !state.monsters.some((monster) => monster.x === x && monster.y === y);
}

function findSpawnCell(
  state: Pick<GameEngineState, 'map' | 'monsters'>,
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
}: {
  archetype: EnemyArchetype;
  x: number;
  y: number;
  id: string;
  spawnPointId?: string;
  clone?: boolean;
}): MonsterState {
  const definition = getEnemyArchetypeDefinition(archetype);
  const kind = ARCHETYPE_KIND[archetype];
  return {
    id,
    name: clone ? 'Water Clone' : definition.label,
    x,
    y,
    kind,
    moveCooldown: Math.max(260, MONSTER_MOVE_MS[kind] - (definition.elite ? 180 : 0)),
    archetype,
    abilityKind: clone ? undefined : definition.ability,
    abilityLabel: clone ? undefined : definition.abilityLabel,
    abilityCooldown: clone ? undefined : 1600,
    abilityWarningTicks: 0,
    abilityTarget: null,
    spawnPointId,
    clone,
    elite: definition.elite,
  };
}

function spawnFromPoint(
  state: Pick<GameEngineState, 'map' | 'monsters'>,
  point: CampaignRespawnPointState
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
  const spawnPoints = campaign.spawnPoints.map((point) => {
    let nextPoint = { ...point };
    for (let index = 0; index < point.initialCount; index += 1) {
      const spawned = spawnFromPoint({ map, monsters }, nextPoint);
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
  const spawnPoints = state.campaign.spawnPoints.map((point) => {
    let nextPoint = {
      ...point,
      activeMonsterIds: point.activeMonsterIds.filter((id) => monsterIds.has(id)),
      ticksRemaining: Math.max(0, point.ticksRemaining - deltaMs),
    };

    if (
      nextPoint.activeMonsterIds.length >= nextPoint.maxActive
      || nextPoint.ticksRemaining > 0
    ) {
      return nextPoint;
    }

    const spawned = spawnFromPoint({ ...state, monsters }, nextPoint);
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
