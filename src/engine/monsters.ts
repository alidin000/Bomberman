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
import { getExplosionPositions } from './bombs';
import { hazardIsActive } from './bosses';
import { EnemyAbilityKind } from '../content/enemies';
import { createShinobiEnemy } from './campaignEnemies';
import { DifficultySettings, getMatchDifficulty } from './difficulty';
import { isCellVisible } from './fogOfWar';

const DIRECTIONS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// Lethal window of an enemy hazard once its warning marker ends.
const MONSTER_HAZARD_ACTIVE_MS = 800;
const DEFAULT_DETECTION_RANGE = 5;
const DETECTION_RETRY_MS = 350;
let monsterHazardIdCounter = 0;

export function resetMonsterHazardIdCounter(): void {
  monsterHazardIdCounter = 0;
}

// Danger map, as used by Pommerman agents: for every threatened cell, the ms
// until it turns lethal (0 = burning now). Built once per tick and shared.
type DangerMap = Map<string, number>;

type MonsterMovementContext = {
  distanceFields: Map<string, number[][] | null>;
  occupiedCells: Set<string>;
  danger: DangerMap;
  fleeField?: number[][] | null;
  // How far ahead dodging enemies see a bomb coming (difficulty).
  dodgeHorizonMs: number;
};

// Smart, fork and elite monsters refuse cells that blow up within the
// difficulty's dodge window (1400 ms on Hard); the others only refuse cells
// that are already on fire.
// A detonator bomb can go off at any moment.
const MANUAL_BOMB_DANGER_MS = 500;
const TELEGRAPHED_HAZARD_DANGER_MS = 300;

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function isInBounds(x: number, y: number, map: GameMap): boolean {
  return x >= 1 && x < map[0].length - 1 && y >= 1 && y < map.length - 1;
}

function basicValidMove(
  x: number,
  y: number,
  map: GameMap,
  occupiedCells: Set<string>,
): boolean {
  if (!isInBounds(x, y, map)) return false;
  if (map[y][x] !== 'Empty') return false;
  return !occupiedCells.has(cellKey(x, y));
}

function ghostValidMove(x: number, y: number, map: GameMap): boolean {
  if (!isInBounds(x, y, map)) return false;
  const cell = map[y][x];
  return cell !== 'Wall' && !isBomb(cell);
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

function createDistanceField(map: GameMap, players: PlayerState[]): number[][] | null {
  const alivePlayers = players.filter((player) => player.alive);
  if (alivePlayers.length === 0) return null;

  const distances = map.map((row) => row.map(() => Infinity));
  const queue: Point[] = [];
  alivePlayers.forEach((player) => {
    const cell = getPlayerCell(player);
    if (isInBounds(cell.x, cell.y, map) && map[cell.y][cell.x] === 'Empty') {
      distances[cell.y][cell.x] = 0;
      queue.push(cell);
    }
  });

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const nextDistance = distances[current.y][current.x] + 1;
    DIRECTIONS.forEach((direction) => {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      if (
        isInBounds(x, y, map)
        && map[y][x] === 'Empty'
        && nextDistance < distances[y][x]
      ) {
        distances[y][x] = nextDistance;
        queue.push({ x, y });
      }
    });
  }

  return queue.length > 0 ? distances : null;
}

function markDanger(danger: DangerMap, x: number, y: number, ms: number): void {
  const key = cellKey(x, y);
  const current = danger.get(key);
  if (current === undefined || ms < current) danger.set(key, ms);
}

export function createDangerMap(state: GameEngineState): DangerMap {
  const danger: DangerMap = new Map();
  state.explosions.forEach((explosion) => markDanger(danger, explosion.x, explosion.y, 0));
  state.hazards.forEach((hazard) => {
    if (hazard.damage <= 0) return;
    markDanger(
      danger,
      hazard.x,
      hazard.y,
      hazardIsActive(hazard) ? 0 : TELEGRAPHED_HAZARD_DANGER_MS
    );
  });
  if (state.bombs.length === 0) return danger;

  const fuse = new Map(state.bombs.map((bomb) => [
    bomb.id,
    bomb.manualDetonation ? MANUAL_BOMB_DANGER_MS : Math.max(0, bomb.ticksRemaining),
  ]));
  const rays = new Map(state.bombs.map((bomb) => [
    bomb.id,
    getExplosionPositions(bomb, state.map),
  ]));
  const bombsByCell = new Map<string, string[]>();
  state.bombs.forEach((bomb) => {
    const key = cellKey(bomb.x, bomb.y);
    bombsByCell.set(key, [...(bombsByCell.get(key) ?? []), bomb.id]);
  });

  // Chain reactions: a bomb inside another bomb's blast goes off no later.
  for (let pass = 0; pass < state.bombs.length; pass += 1) {
    let updated = false;
    state.bombs.forEach((source) => {
      const sourceFuse = fuse.get(source.id) ?? 0;
      (rays.get(source.id) ?? []).forEach((cell) => {
        (bombsByCell.get(cellKey(cell.x, cell.y)) ?? []).forEach((targetId) => {
          if ((fuse.get(targetId) ?? 0) > sourceFuse) {
            fuse.set(targetId, sourceFuse);
            updated = true;
          }
        });
      });
    });
    if (!updated) break;
  }

  state.bombs.forEach((bomb) => {
    const ms = fuse.get(bomb.id) ?? 0;
    (rays.get(bomb.id) ?? []).forEach((cell) => markDanger(danger, cell.x, cell.y, ms));
  });
  return danger;
}

function createMonsterMovementContext(
  monsters: MonsterState[],
  danger: DangerMap,
  dodgeHorizonMs: number,
): MonsterMovementContext {
  return {
    distanceFields: new Map(),
    occupiedCells: new Set(monsters.map((monster) => cellKey(monster.x, monster.y))),
    danger,
    dodgeHorizonMs,
  };
}

function getDangerHorizon(monster: MonsterState, context: MonsterMovementContext): number {
  return monster.elite || monster.kind === 'smart' || monster.kind === 'fork'
    ? context.dodgeHorizonMs
    : 0;
}

function isDangerous(context: MonsterMovementContext, point: Point, horizonMs: number): boolean {
  const ms = context.danger.get(cellKey(point.x, point.y));
  return ms !== undefined && ms <= horizonMs;
}

function avoidDanger(
  options: Point[],
  monster: MonsterState,
  context: MonsterMovementContext,
): Point[] {
  if (context.danger.size === 0) return options;
  const horizon = getDangerHorizon(monster, context);
  return options.filter((option) => !isDangerous(context, option, horizon));
}

// Flee map: distance from every walkable cell to the nearest safe cell.
function getFleeField(context: MonsterMovementContext, map: GameMap): number[][] | null {
  if (context.fleeField !== undefined) return context.fleeField;
  const distances = map.map((row) => row.map(() => Infinity));
  const queue: Point[] = [];
  map.forEach((row, y) => row.forEach((cell, x) => {
    if (
      isInBounds(x, y, map)
      && cell === 'Empty'
      && !isDangerous(context, { x, y }, context.dodgeHorizonMs)
    ) {
      distances[y][x] = 0;
      queue.push({ x, y });
    }
  }));

  let head = 0;
  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    const nextDistance = distances[current.y][current.x] + 1;
    DIRECTIONS.forEach((direction) => {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      if (
        isInBounds(x, y, map)
        && map[y][x] === 'Empty'
        && nextDistance < distances[y][x]
      ) {
        distances[y][x] = nextDistance;
        queue.push({ x, y });
      }
    });
  }

  context.fleeField = queue.length > 0 ? distances : null;
  return context.fleeField;
}

export function getDetectionRange(monster: MonsterState): number {
  if (typeof monster.detectionRange === 'number') return monster.detectionRange;
  if (monster.elite) return 7;
  if (monster.name.toLowerCase().includes('zetsu')) return 4;
  return DEFAULT_DETECTION_RANGE;
}

function getMonsterDistanceToPlayer(monster: MonsterState, player: PlayerState): number {
  return Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
}

function getDetectedPlayers(monster: MonsterState, players: PlayerState[]): PlayerState[] {
  const detectionRange = getDetectionRange(monster);
  return players.filter((player) => (
    player.alive
    && getMonsterDistanceToPlayer(monster, player) <= detectionRange
  ));
}

function getDistanceFieldForTargets(
  context: MonsterMovementContext,
  map: GameMap,
  targets: PlayerState[],
): number[][] | null {
  if (targets.length === 0) return null;
  const key = targets.map((player) => player.id).sort().join('|');
  if (!context.distanceFields.has(key)) {
    context.distanceFields.set(key, createDistanceField(map, targets));
  }
  return context.distanceFields.get(key) ?? null;
}

function getDistanceAt(distanceField: number[][], point: Point): number {
  return distanceField[point.y]?.[point.x] ?? Infinity;
}

function chooseDistanceFieldMove(
  options: Point[],
  distanceField: number[][] | null,
  monster: MonsterState,
  tick: number,
  salt = 0,
): Point | null {
  if (!distanceField) return null;

  let bestDistance = Infinity;
  const bestOptions: Point[] = [];
  options.forEach((option) => {
    const distance = getDistanceAt(distanceField, option);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestOptions.length = 0;
      bestOptions.push(option);
    } else if (distance === bestDistance) {
      bestOptions.push(option);
    }
  });

  return Number.isFinite(bestDistance)
    ? chooseDeterministic(bestOptions, monster, tick, salt)
    : null;
}

function moveBasicMonster(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  tick: number,
): MonsterState {
  const options = avoidDanger(
    DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
      .filter((p) => basicValidMove(p.x, p.y, map, context.occupiedCells)),
    monster,
    context
  );

  if (options.length === 0) return monster;
  const chosen = chooseDeterministic(options, monster, tick);
  if (!chosen) return monster;
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveSmartMonster(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  players: PlayerState[],
  tick: number,
): MonsterState {
  const options = avoidDanger(
    DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
      .filter((p) => basicValidMove(p.x, p.y, map, context.occupiedCells)),
    monster,
    context
  );

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
  }
  const detectedPlayers = getDetectedPlayers(monster, alivePlayers);
  if (detectedPlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
  }

  const pathMove = chooseDistanceFieldMove(
    options,
    getDistanceFieldForTargets(context, map, detectedPlayers),
    monster,
    tick
  );
  if (pathMove) {
    return { ...monster, x: pathMove.x, y: pathMove.y };
  }
  const chosen = chooseDeterministic(options, monster, tick);
  if (chosen) return { ...monster, x: chosen.x, y: chosen.y };
  return monster;
}

function moveGhostMonster(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  tick: number,
): MonsterState {
  const options = avoidDanger(
    DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
      .filter((p) => (
        ghostValidMove(p.x, p.y, map) && !context.occupiedCells.has(cellKey(p.x, p.y))
      )),
    monster,
    context
  );

  if (options.length === 0) return monster;
  const chosen = chooseDeterministic(options, monster, tick);
  if (!chosen) return monster;
  return { ...monster, x: chosen.x, y: chosen.y };
}

function moveForkMonster(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  players: PlayerState[],
  tick: number,
): MonsterState {
  const options = avoidDanger(
    DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
      .filter((p) => basicValidMove(p.x, p.y, map, context.occupiedCells)),
    monster,
    context
  );

  if (options.length === 0) return monster;

  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
  }

  const detectedPlayers = getDetectedPlayers(monster, alivePlayers);
  if (detectedPlayers.length === 0) {
    const chosen = chooseDeterministic(options, monster, tick);
    return chosen ? { ...monster, x: chosen.x, y: chosen.y } : monster;
  }

  const closest = detectedPlayers.reduce((best, p) => {
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
  const pathMove = chooseDistanceFieldMove(
    options,
    getDistanceFieldForTargets(context, map, detectedPlayers),
    monster,
    tick,
    23
  );
  if (pathMove) return { ...monster, x: pathMove.x, y: pathMove.y };
  return { ...monster, x: bestDir.x, y: bestDir.y };
}

function fleeDanger(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  tick: number,
): MonsterState | null {
  if (getDangerHorizon(monster, context) === 0) return null;
  if (!isDangerous(context, monster, context.dodgeHorizonMs)) return null;

  const walkable = (point: Point) => (
    monster.kind === 'ghost'
      ? ghostValidMove(point.x, point.y, map)
        && !context.occupiedCells.has(cellKey(point.x, point.y))
      : basicValidMove(point.x, point.y, map, context.occupiedCells)
  );
  const options = DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
    .filter(walkable)
    .filter((option) => !isDangerous(context, option, 0));
  if (options.length === 0) return monster;

  const fleeMove = chooseDistanceFieldMove(options, getFleeField(context, map), monster, tick, 47);
  if (fleeMove) return { ...monster, x: fleeMove.x, y: fleeMove.y };

  // No safe cell reachable: buy time by stepping where the blast lands last.
  const latest = options.reduce((best, option) => (
    (context.danger.get(cellKey(option.x, option.y)) ?? Infinity)
      > (context.danger.get(cellKey(best.x, best.y)) ?? Infinity)
      ? option
      : best
  ));
  return { ...monster, x: latest.x, y: latest.y };
}

function leashMove(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  players: PlayerState[],
  tick: number,
): MonsterState | null {
  const { leash } = monster;
  if (!leash) return null;
  if (Math.abs(monster.x - leash.x) + Math.abs(monster.y - leash.y) <= leash.radius) return null;
  if (getDetectedPlayers(monster, players).length > 0) return null;
  const options = avoidDanger(
    DIRECTIONS.map((d) => ({ x: monster.x + d.x, y: monster.y + d.y }))
      .filter((p) => (monster.kind === 'ghost'
        ? ghostValidMove(p.x, p.y, map) && !context.occupiedCells.has(cellKey(p.x, p.y))
        : basicValidMove(p.x, p.y, map, context.occupiedCells))),
    monster,
    context
  );
  const fieldKey = `leash:${leash.x},${leash.y}`;
  if (!context.distanceFields.has(fieldKey)) {
    const anchor = { x: leash.x, y: leash.y, alive: true } as PlayerState;
    context.distanceFields.set(fieldKey, createDistanceField(map, [anchor]));
  }
  const home = chooseDistanceFieldMove(
    options,
    context.distanceFields.get(fieldKey) ?? null,
    monster,
    tick,
    61
  );
  return home ? { ...monster, x: home.x, y: home.y } : null;
}

function moveMonsterByKind(
  monster: MonsterState,
  map: GameMap,
  context: MonsterMovementContext,
  players: PlayerState[],
  tick: number,
): MonsterState {
  const fled = fleeDanger(monster, map, context, tick);
  if (fled) return fled;
  const homeward = leashMove(monster, map, context, players, tick);
  if (homeward) return homeward;
  switch (monster.kind) {
    case 'smart':
      return moveSmartMonster(monster, map, context, players, tick);
    case 'ghost':
      return moveGhostMonster(monster, map, context, tick);
    case 'fork':
      return moveForkMonster(monster, map, context, players, tick);
    default:
      return moveBasicMonster(monster, map, context, tick);
  }
}

function getNearestPlayer(monster: MonsterState, players: PlayerState[]): PlayerState | null {
  const alivePlayers = getDetectedPlayers(monster, players);
  if (alivePlayers.length === 0) return null;
  return alivePlayers.reduce((nearest, player) => {
    const nearestDistance = Math.abs(nearest.x - monster.x) + Math.abs(nearest.y - monster.y);
    const playerDistance = Math.abs(player.x - monster.x) + Math.abs(player.y - monster.y);
    return playerDistance < nearestDistance ? player : nearest;
  }, alivePlayers[0]);
}

function reserveMonsterCell(
  context: MonsterMovementContext,
  before: MonsterState,
  after: MonsterState,
): void {
  context.occupiedCells.delete(cellKey(before.x, before.y));
  context.occupiedCells.add(cellKey(after.x, after.y));
}

function abilityCooldownFor(
  kind: EnemyAbilityKind | undefined,
  elite: boolean | undefined,
  difficulty: DifficultySettings,
): number {
  if (!kind) return 0;
  const cooldowns: Record<EnemyAbilityKind, number> = {
    kunaiThrow: 2400,
    bodyFlicker: 3000,
    waterClone: 3600,
    sandSpike: 2900,
    lightningStrike: 3100,
    zetsuMelee: 1500,
  };
  return Math.round(
    Math.max(900, cooldowns[kind] - (elite ? 350 : 0)) * difficulty.abilityCooldownScale
  );
}

export function getMonsterMoveMs(monster: MonsterState, difficulty: DifficultySettings): number {
  return Math.round(MONSTER_MOVE_MS[monster.kind] * difficulty.enemyMoveScale);
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
  warningMs: number,
  sourceName?: string,
  sourceAbility?: string,
): BossHazard {
  monsterHazardIdCounter += 1;
  return {
    id: `monster-hazard-${monsterHazardIdCounter}`,
    kind,
    x,
    y,
    ticksRemaining: warningMs + MONSTER_HAZARD_ACTIVE_MS,
    warningTicks: warningMs,
    // Lethal from the moment the enemy's own warning marker ends.
    activeMs: MONSTER_HAZARD_ACTIVE_MS,
    color,
    damage: 1,
    sourceName,
    sourceAbility,
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

function touchesLivingPlayer(players: PlayerState[], point: Point): boolean {
  return players.some((player) => player.alive && positionsTouch(player, point));
}

function getAdjacentTargetCell(
  state: GameEngineState,
  target: PlayerState,
  seed: number,
  avoidPlayers: PlayerState[] = [],
): Point {
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
    .find(({ point }) => (
      canTeleportTo(state, point.x, point.y) && !touchesLivingPlayer(avoidPlayers, point)
    ))?.point ?? targetCell;
}

function damagePlayerAtTarget(
  players: PlayerState[],
  state: GameEngineState,
  target: Point,
  sourceName: string,
  sourceAbility?: string,
): PlayerState[] {
  return players.map((player) => {
    if (!player.alive) return player;
    const protectedByShield = isPowerUpActive(state, player.id, 'Invincibility');
    if (protectedByShield) return player;
    const playerCell = getPlayerCell(player);
    return playerCell.x === target.x && playerCell.y === target.y
      ? applyCharacterSurvival(
        player,
        sourceAbility
          ? `${player.name} was hit by ${sourceName}'s ${sourceAbility}.`
          : `${player.name} was caught by ${sourceName}.`,
        { kind: 'enemy', sourceName, sourceAbility }
      )
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

  const difficulty = getMatchDifficulty(state.config);
  let nextMonster = {
    ...monster,
    abilityWarningTicks: 0,
    abilityTarget: null,
    abilityCooldown: abilityCooldownFor(abilityKind, monster.elite, difficulty),
  };
  let nextPlayers = players;
  let nextSpawned = spawned;

  if (abilityKind === 'bodyFlicker') {
    // The flicker lands on the cell its warning marked, so a player who saw
    // the marker and moved is not ambushed somewhere else. It fizzles if that
    // cell is taken or touches a player (that would be an unwarned hit), and
    // the enemy needs a full step to recover before it can move again: the
    // landing never turns into an instant contact in the same tick.
    if (canTeleportTo(state, target.x, target.y) && !touchesLivingPlayer(players, target)) {
      nextMonster = {
        ...nextMonster,
        x: target.x,
        y: target.y,
        moveCooldown: getMonsterMoveMs(monster, difficulty),
      };
    }
  }

  if (abilityKind === 'waterClone') {
    const cloneState = { ...state, monsters: [...state.monsters, ...spawned] };
    const clonePoint = getAdjacentTargetCell(
      cloneState,
      monsterAsTarget(monster),
      hashMonster(monster, state.tick, 59),
      players,
    );
    if (
      canTeleportTo(cloneState, clonePoint.x, clonePoint.y)
      && !touchesLivingPlayer(players, clonePoint)
    ) {
      nextSpawned = [
        ...nextSpawned,
        createShinobiEnemy({
          archetype: 'mistNinja',
          x: clonePoint.x,
          y: clonePoint.y,
          id: `${monster.id}-clone-${state.tick}`,
          spawnPointId: monster.spawnPointId,
          clone: true,
          difficulty: getMatchDifficulty(state.config),
        }),
      ];
    }
  }

  if (abilityKind === 'zetsuMelee') {
    nextPlayers = damagePlayerAtTarget(
      players,
      state,
      target,
      monster.name,
      monster.abilityLabel
    );
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

  const difficulty = getMatchDifficulty(state.config);
  // Below Hard, an enemy cannot strike from the fog: it must stand where the
  // player can see (or sense) it before it starts an ability.
  const seen = !difficulty.castOnlyWhenVisible
    || isCellVisible(state.fogOfWar, monster.x, monster.y)
    || state.fogOfWar.sensedEnemies.includes(`${monster.x},${monster.y}`);
  const targetPlayer = seen ? getNearestPlayer(monster, state.players) : null;
  if (!targetPlayer) {
    return {
      monster: {
        ...monster,
        abilityCooldown: DETECTION_RETRY_MS,
        abilityTarget: null,
        abilityWarningTicks: 0,
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
      createMonsterHazard(
        hazardKind,
        target.x,
        target.y,
        colorForAbility(abilityKind),
        difficulty.abilityWarningMs,
        monster.name,
        monster.abilityLabel
      ),
    ]
    : hazards;

  return {
    monster: {
      ...monster,
      abilityTarget: target,
      abilityWarningTicks: difficulty.abilityWarningMs,
      abilityCooldown: abilityCooldownFor(abilityKind, monster.elite, difficulty),
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
      ?? abilityCooldownFor(monster.abilityKind, monster.elite, getMatchDifficulty(state.config))
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

function ageSummons(monsters: MonsterState[], deltaMs: number): MonsterState[] {
  if (!monsters.some((monster) => monster.lifetimeMs !== undefined)) return monsters;
  return monsters.flatMap((monster) => {
    if (monster.lifetimeMs === undefined) return [monster];
    const lifetimeMs = monster.lifetimeMs - deltaMs;
    return lifetimeMs > 0 ? [{ ...monster, lifetimeMs }] : [];
  });
}

export function tickMonsters(state: GameEngineState, deltaMs: number): GameEngineState {
  // The ability helpers never mutate these, so no defensive copies.
  let { players, hazards } = state;
  let spawned: MonsterState[] = [];
  const difficulty = getMatchDifficulty(state.config);
  const living = ageSummons(state.monsters, deltaMs);
  const movementContext = createMonsterMovementContext(
    living,
    createDangerMap(state),
    difficulty.dodgeHorizonMs,
  );
  // Where everyone stands so far this tick, so teleports and clones never
  // land on a cell another enemy has just moved into.
  const placed = [...living];

  const monsters = living.map((monster, index) => {
    movementContext.occupiedCells.delete(cellKey(monster.x, monster.y));
    const abilityTick = tickMonsterAbility(
      {
        ...state, players, hazards, monsters: [...living, ...placed, ...spawned],
      },
      monster,
      deltaMs,
      players,
      hazards,
      spawned
    );
    abilityTick.spawned.slice(spawned.length).forEach((summon) => {
      movementContext.occupiedCells.add(cellKey(summon.x, summon.y));
    });
    players = abilityTick.players;
    hazards = abilityTick.hazards;
    spawned = abilityTick.spawned;

    let nextMonster = abilityTick.monster;
    const cooldown = nextMonster.moveCooldown - deltaMs;
    if (cooldown > 0 || (nextMonster.abilityWarningTicks ?? 0) > 0) {
      const waitingMonster = { ...nextMonster, moveCooldown: cooldown };
      reserveMonsterCell(movementContext, monster, waitingMonster);
      placed[index] = waitingMonster;
      return waitingMonster;
    }

    const moved = moveMonsterByKind(
      nextMonster,
      state.map,
      movementContext,
      players,
      state.tick,
    );
    nextMonster = {
      ...moved,
      moveCooldown: getMonsterMoveMs(nextMonster, difficulty),
    };
    reserveMonsterCell(movementContext, monster, nextMonster);
    placed[index] = nextMonster;
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

    const hit = state.monsters.find((monster) => positionsTouch(monster, player));
    return hit
      ? applyCharacterSurvival(
        player,
        `${player.name} was caught by ${hit.name}.`,
        { kind: 'enemy', sourceName: hit.name }
      )
      : player;
  });
}

export { isInBounds, isObstacle };
