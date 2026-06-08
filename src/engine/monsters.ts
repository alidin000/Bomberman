/* eslint-disable no-restricted-syntax */
/* eslint-disable comma-dangle, prefer-const, @typescript-eslint/no-unused-vars */
import {
  GameMap, isBomb, isObstacle,
} from '../model/gameItem';
import {
  BossHazard, HazardKind, Point, GameEngineState, MonsterState, PlayerState,
} from './types';
import { MONSTER_MOVE_MS } from './constants';
import { applyCharacterSurvival, isPowerUpActive } from './players';
import { getPlayerCell, positionsTouch } from './grid';
import { EnemyAbilityKind } from '../content/enemies';
import { createShinobiEnemy } from './campaignEnemies';

const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const MONSTER_ABILITY_WARNING_MS = 850;
const MONSTER_HAZARD_TOTAL_MS = 1650;
let monsterHazardIdCounter = 0;

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

function hashMonster(monster: MonsterState, tick: number, salt = 0): number {
  let hash = 2166136261;
  const values = [
    monster.x,
    monster.y,
    tick,
    salt,
    monster.id.length,
    monster.name.length,
  ];
  values.forEach((value) => {
    hash = Math.imul(hash + Math.floor(value * 97), 16777619);
  });
  return Math.abs(hash);
}

function chooseDeterministic<T>(
  options: T[],
  monster: MonsterState,
  tick: number,
  salt = 0,
): T | null {
  if (options.length === 0) return null;
  return options[hashMonster(monster, tick, salt) % options.length];
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
  tick: number,
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  if (options.length === 0) return monster;
  const chosen = chooseDeterministic(options, monster, tick);
  if (!chosen) return monster;
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveSmartMonster(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
  tick: number,
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
  }

  const closest = alivePlayers.reduce((best, p) => {
    const bestDist = (best.x - monster.x) ** 2 + (best.y - monster.y) ** 2;
    const pDist = (p.x - monster.x) ** 2 + (p.y - monster.y) ** 2;
    return pDist < bestDist ? p : best;
  });

  const path = aStarSearch(map, { x: monster.x, y: monster.y }, getPlayerCell(closest));
  if (path.length > 1) {
    return { ...monster, x: path[1].x, y: path[1].y };
  }
  const chosen = chooseDeterministic(options, monster, tick);
  if (chosen) return { ...monster, x: chosen.x, y: chosen.y };
  return monster;
}

function moveGhostMonster(monster: MonsterState, map: GameMap, tick: number): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => ghostValidMove(p.x, p.y, map));

  if (options.length === 0) return monster;
  const chosen = chooseDeterministic(options, monster, tick);
  if (!chosen) return monster;
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveForkMonster(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
  tick: number,
): MonsterState {
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter((p) => basicValidMove(p.x, p.y, map, monsters, monster.id));

  if (options.length === 0) return monster;

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
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

  if (hashMonster(monster, tick, 17) % 100 < 15) {
    const random = chooseDeterministic(options, monster, tick, 31);
    if (!random) return monster;
    return { ...monster, x: random.x, y: random.y };
  }
  return { ...monster, x: bestDir.x, y: bestDir.y };
}

function moveMonsterByKind(
  monster: MonsterState,
  map: GameMap,
  monsters: MonsterState[],
  players: PlayerState[],
  tick: number,
): MonsterState {
  switch (monster.kind) {
    case 'smart':
      return moveSmartMonster(monster, map, monsters, players, tick);
    case 'ghost':
      return moveGhostMonster(monster, map, tick);
    case 'fork':
      return moveForkMonster(monster, map, monsters, players, tick);
    default:
      return moveBasicMonster(monster, map, monsters, tick);
  }
}

function getNearestPlayer(monster: MonsterState, players: PlayerState[]): PlayerState | null {
  const alivePlayers = players.filter((player) => player.alive);
  if (alivePlayers.length === 0) return null;
  return alivePlayers.reduce((nearest, player) => {
    const nearestDistance = Math.abs(nearest.x - monster.x) + Math.abs(nearest.y - monster.y);
    const playerDistance = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
    return playerDistance < nearestDistance ? player : nearest;
  }, alivePlayers[0]);
}

function abilityCooldownFor(kind: EnemyAbilityKind | undefined, elite = false): number {
  if (!kind) return 0;
  const cooldowns: Record<EnemyAbilityKind, number> = {
    kunaiThrow: 2400,
    bodyFlicker: 3000,
    waterClone: 3600,
    sandSpike: 2900,
    lightningStrike: 3100,
    zetsuMelee: 1500,
  };
  return Math.max(900, cooldowns[kind] - (elite ? 350 : 0));
}

function hazardKindForAbility(kind: EnemyAbilityKind): HazardKind | null {
  const hazards: Partial<Record<EnemyAbilityKind, HazardKind>> = {
    kunaiThrow: 'chakraShockwave',
    sandSpike: 'sandSpikes',
    lightningStrike: 'airStrike',
  };
  return hazards[kind] ?? null;
}

function colorForAbility(kind: EnemyAbilityKind): string {
  const colors: Record<EnemyAbilityKind, string> = {
    kunaiThrow: '#d1d5db',
    bodyFlicker: '#a855f7',
    waterClone: '#22d3ee',
    sandSpike: '#f59e0b',
    lightningStrike: '#60a5fa',
    zetsuMelee: '#86efac',
  };
  return colors[kind];
}

function createMonsterHazard(
  kind: HazardKind,
  x: number,
  y: number,
  color: string,
): BossHazard {
  monsterHazardIdCounter += 1;
  return {
    id: `monster-hazard-${monsterHazardIdCounter}`,
    kind,
    x,
    y,
    ticksRemaining: MONSTER_HAZARD_TOTAL_MS,
    warningTicks: MONSTER_ABILITY_WARNING_MS,
    color,
    damage: 1,
  };
}

function canTeleportTo(state: GameEngineState, x: number, y: number): boolean {
  const cell = state.map[y]?.[x];
  return cell !== undefined
    && cell !== 'Wall'
    && cell !== 'Box'
    && !isBomb(cell)
    && !isObstacle(cell)
    && !state.monsters.some((monster) => monster.x === x && monster.y === y);
}

function getAdjacentTargetCell(state: GameEngineState, target: PlayerState, seed: number): Point {
  const targetCell = getPlayerCell(target);
  const candidates = [
    { x: targetCell.x + 1, y: targetCell.y },
    { x: targetCell.x - 1, y: targetCell.y },
    { x: targetCell.x, y: targetCell.y + 1 },
    { x: targetCell.x, y: targetCell.y - 1 },
  ];
  return candidates
    .map((point, index) => ({ point, order: (index + seed) % candidates.length }))
    .sort((a, b) => a.order - b.order)
    .find(({ point }) => canTeleportTo(state, point.x, point.y))?.point ?? targetCell;
}

function damagePlayerAtTarget(
  players: PlayerState[],
  state: GameEngineState,
  target: Point,
): PlayerState[] {
  return players.map((player) => {
    if (!player.alive) return player;
    const protectedByShield = isPowerUpActive(state, player.id, 'Invincibility');
    if (protectedByShield) return player;
    const playerCell = getPlayerCell(player);
    return playerCell.x === target.x && playerCell.y === target.y
      ? applyCharacterSurvival(player)
      : player;
  });
}

function monsterAsTarget(monster: MonsterState): PlayerState {
  return {
    id: monster.id,
    name: monster.name,
    x: monster.x,
    y: monster.y,
    alive: true,
    maxBombs: 0,
    activeBombs: 0,
    bombRange: 0,
    powerUps: [],
    obstacles: 0,
    color: '',
    characterId: 'naruto',
    ultimateCooldown: 0,
    ultimateCooldownRemaining: 0,
    ultimateCharge: 0,
  };
}

function resolveMonsterAbility(
  state: GameEngineState,
  monster: MonsterState,
  players: PlayerState[],
  spawned: MonsterState[],
): {
  monster: MonsterState;
  players: PlayerState[];
  spawned: MonsterState[];
} {
  const { abilityKind, abilityTarget: target } = monster;
  if (!abilityKind || !target) {
    return { monster, players, spawned };
  }

  let nextMonster = {
    ...monster,
    abilityWarningTicks: 0,
    abilityTarget: null,
    abilityCooldown: abilityCooldownFor(abilityKind, monster.elite),
  };
  let nextPlayers = players;
  let nextSpawned = spawned;

  if (abilityKind === 'bodyFlicker') {
    const targetPlayer = getNearestPlayer(monster, players);
    if (targetPlayer) {
      const point = getAdjacentTargetCell(
        state,
        targetPlayer,
        hashMonster(monster, state.tick, 43)
      );
      nextMonster = { ...nextMonster, x: point.x, y: point.y };
    }
  }

  if (abilityKind === 'waterClone') {
    const cloneState = { ...state, monsters: [...state.monsters, ...spawned] };
    const clonePoint = getAdjacentTargetCell(
      cloneState,
      monsterAsTarget(monster),
      hashMonster(monster, state.tick, 59),
    );
    if (canTeleportTo(cloneState, clonePoint.x, clonePoint.y)) {
      nextSpawned = [
        ...nextSpawned,
        createShinobiEnemy({
          archetype: 'mistNinja',
          x: clonePoint.x,
          y: clonePoint.y,
          id: `${monster.id}-clone-${state.tick}`,
          spawnPointId: monster.spawnPointId,
          clone: true,
        }),
      ];
    }
  }

  if (abilityKind === 'zetsuMelee') {
    nextPlayers = damagePlayerAtTarget(players, state, target);
  }

  return { monster: nextMonster, players: nextPlayers, spawned: nextSpawned };
}

function startMonsterAbility(
  state: GameEngineState,
  monster: MonsterState,
  hazards: BossHazard[],
): { monster: MonsterState; hazards: BossHazard[] } {
  const { abilityKind } = monster;
  if (!abilityKind || monster.clone) return { monster, hazards };

  const targetPlayer = getNearestPlayer(monster, state.players);
  if (!targetPlayer) {
    return {
      monster: {
        ...monster,
        abilityCooldown: abilityCooldownFor(abilityKind, monster.elite),
      },
      hazards,
    };
  }

  const targetCell = getPlayerCell(targetPlayer);
  const target = abilityKind === 'bodyFlicker' || abilityKind === 'waterClone'
    ? getAdjacentTargetCell(state, targetPlayer, hashMonster(monster, state.tick, 83))
    : targetCell;
  const hazardKind = hazardKindForAbility(abilityKind);
  const nextHazards = hazardKind
    ? [
      ...hazards,
      createMonsterHazard(hazardKind, target.x, target.y, colorForAbility(abilityKind)),
    ]
    : hazards;

  return {
    monster: {
      ...monster,
      abilityTarget: target,
      abilityWarningTicks: MONSTER_ABILITY_WARNING_MS,
      abilityCooldown: abilityCooldownFor(abilityKind, monster.elite),
    },
    hazards: nextHazards,
  };
}

function tickMonsterAbility(
  state: GameEngineState,
  monster: MonsterState,
  deltaMs: number,
  players: PlayerState[],
  hazards: BossHazard[],
  spawned: MonsterState[],
): {
  monster: MonsterState;
  players: PlayerState[];
  hazards: BossHazard[];
  spawned: MonsterState[];
} {
  if (!monster.abilityKind || monster.clone) {
    return {
      monster,
      players,
      hazards,
      spawned,
    };
  }

  const warningTicks = monster.abilityWarningTicks ?? 0;
  if (warningTicks > 0) {
    const remainingWarning = warningTicks - deltaMs;
    if (remainingWarning > 0) {
      return {
        monster: { ...monster, abilityWarningTicks: remainingWarning },
        players,
        hazards,
        spawned,
      };
    }
    const resolved = resolveMonsterAbility(
      state,
      { ...monster, abilityWarningTicks: 0 },
      players,
      spawned
    );
    return {
      monster: resolved.monster,
      players: resolved.players,
      hazards,
      spawned: resolved.spawned,
    };
  }

  const cooldown = (
    monster.abilityCooldown
      ?? abilityCooldownFor(monster.abilityKind, monster.elite)
  ) - deltaMs;
  if (cooldown > 0) {
    return {
      monster: { ...monster, abilityCooldown: cooldown },
      players,
      hazards,
      spawned,
    };
  }

  const started = startMonsterAbility(
    { ...state, players },
    { ...monster, abilityCooldown: 0 },
    hazards
  );
  return {
    monster: started.monster,
    players,
    hazards: started.hazards,
    spawned,
  };
}

export function tickMonsters(state: GameEngineState, deltaMs: number): GameEngineState {
  let players = [...state.players];
  let hazards = [...state.hazards];
  let spawned: MonsterState[] = [];

  const monsters = state.monsters.map((monster) => {
    const abilityTick = tickMonsterAbility(
      { ...state, players, hazards },
      monster,
      deltaMs,
      players,
      hazards,
      spawned
    );
    players = abilityTick.players;
    hazards = abilityTick.hazards;
    spawned = abilityTick.spawned;

    let nextMonster = abilityTick.monster;
    const cooldown = nextMonster.moveCooldown - deltaMs;
    if (cooldown > 0 || (nextMonster.abilityWarningTicks ?? 0) > 0) {
      return { ...nextMonster, moveCooldown: cooldown };
    }

    const moved = moveMonsterByKind(
      nextMonster,
      state.map,
      state.monsters,
      players,
      state.tick,
    );
    nextMonster = {
      ...moved,
      moveCooldown: MONSTER_MOVE_MS[nextMonster.kind],
    };
    return nextMonster;
  });

  return {
    ...state,
    players,
    hazards,
    monsters: [...monsters, ...spawned],
  };
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
