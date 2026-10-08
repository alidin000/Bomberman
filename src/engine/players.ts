/* eslint-disable no-use-before-define, prefer-destructuring */
/* eslint-disable comma-dangle, no-nested-ternary, prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  isBomb, isObstacle, isPower, Power,
} from '../model/gameItem';
import { Direction, GameEngineState, PlayerState } from './types';
import {
  GHOST_POWER_MS, INVINCIBILITY_POWER_MS, POWER_FLASH_MS, SURVIVAL_GRACE_MS,
} from './constants';
import {
  getCell,
  getOverlappedCells,
  getPlayerCell,
  moveTowardCellCenter,
  PLAYER_COLLISION_RADIUS,
  PLAYER_MOVE_STEP,
  positionsTouch,
  roundToMovementStep,
} from './grid';

const MUTUALLY_EXCLUSIVE: Partial<Record<Power, Power | null>> = {
  Ghost: 'Invincibility',
  Invincibility: 'Ghost',
  CrowFeather: 'Invincibility',
  SandArmor: 'Ghost',
};

const PICKUP_MESSAGE_MS = 3600;
export const SHARED_SCREEN_MAX_DELTA_X = 12;
export const SHARED_SCREEN_MAX_DELTA_Y = 8;
// A ninja running from danger may stretch the shared screen to this multiple,
// so the limit never pins anyone beside a bomb. The camera's widest framing
// still shows an 18x12 spread well inside the view.
export const SHARED_SCREEN_ESCAPE_SCALE = 1.5;

function addPickupMessage(
  state: GameEngineState,
  playerId: string,
  power: Power,
): GameEngineState['pickupMessages'] {
  const current = state.pickupMessages ?? [];
  const next = current.filter((message) => (
    message.playerId !== playerId || message.power !== power
  ));
  return [
    ...next,
    {
      id: `${state.tick}-${playerId}-${power}-${current.length}`,
      playerId,
      power,
      ticksRemaining: PICKUP_MESSAGE_MS,
    },
  ].slice(-6);
}

export function applyCharacterSurvival(
  player: PlayerState,
  deathReason?: string
): PlayerState {
  // A save covers the whole hit: the rest of that blast, its flames, or a
  // monster still in contact cannot undo it a moment later.
  if ((player.survivalGraceMs ?? 0) > 0) return player;
  if (player.characterId === 'gaara'
    && (player.passiveState === 'Automatic Sand Shield'
      || player.passiveState === 'Sand Armor Reinforced')) {
    return {
      ...player,
      alive: true,
      passiveState: 'Sand Shield Spent',
      survivalGraceMs: SURVIVAL_GRACE_MS,
    };
  }
  if (player.characterId === 'itachi' && player.passiveState === 'Illusion Dodge') {
    return {
      ...player,
      alive: true,
      passiveState: 'Illusion Dodge Spent',
      survivalGraceMs: SURVIVAL_GRACE_MS,
    };
  }
  return { ...player, alive: false, deathReason };
}

function isGhostActive(state: GameEngineState, playerId: string): boolean {
  return state.timedPowerUps[playerId]?.some(
    (tp) => tp.power === 'Ghost' && tp.ticksRemaining > 0,
  ) ?? false;
}

function addUniquePower(powerUps: Power[], power: Power): Power[] {
  return powerUps.includes(power) ? powerUps : [...powerUps, power];
}

function distanceToCellCenterSquared(x: number, y: number, cellX: number, cellY: number): number {
  return (x - cellX) ** 2 + (y - cellY) ** 2;
}

function overlapsCell(x: number, y: number, cellX: number, cellY: number): boolean {
  return getOverlappedCells(x, y).some((cell) => (
    cell.x === cellX && cell.y === cellY
  ));
}

function isLeavingOverlappedCell(
  currentX: number,
  currentY: number,
  nextX: number,
  nextY: number,
  cellX: number,
  cellY: number,
): boolean {
  if (!overlapsCell(currentX, currentY, cellX, cellY)) return false;

  const currentDistance = distanceToCellCenterSquared(currentX, currentY, cellX, cellY);
  const nextDistance = distanceToCellCenterSquared(nextX, nextY, cellX, cellY);
  return nextDistance >= currentDistance;
}

function isCellValidForPlayer(
  state: GameEngineState,
  playerId: string,
  nextX: number,
  nextY: number,
  cellX: number,
  cellY: number,
  currentX: number,
  currentY: number,
): boolean {
  const { map } = state;
  if (cellY < 0 || cellY >= map.length || cellX < 0 || cellX >= map[0].length) return false;

  if (isGhostActive(state, playerId)) {
    // Ghost phases through walls, but never past the edge of the arena.
    return nextX >= 0 && nextY >= 0 && nextX <= map[0].length - 1 && nextY <= map.length - 1;
  }

  const cell = map[cellY][cellX];
  if (isBomb(cell)) {
    if (cell.ownerId === playerId && overlapsCell(currentX, currentY, cellX, cellY)) return true;
    // Someone else's bomb dropped onto a cell you overlap: you may walk out.
    return isLeavingOverlappedCell(currentX, currentY, nextX, nextY, cellX, cellY);
  }

  if (cell === 'Wall' || cell === 'Box' || isObstacle(cell)) {
    return isLeavingOverlappedCell(currentX, currentY, nextX, nextY, cellX, cellY);
  }

  return cell === 'Empty' || isPower(cell);
}

function isValidMove(
  state: GameEngineState,
  playerId: string,
  x: number,
  y: number,
  currentX: number,
  currentY: number,
): boolean {
  return getOverlappedCells(x, y).every((cell) => (
    isCellValidForPlayer(state, playerId, x, y, cell.x, cell.y, currentX, currentY)
  ));
}

function getDirectionDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case 'up': return { dx: 0, dy: -PLAYER_MOVE_STEP };
    case 'down': return { dx: 0, dy: PLAYER_MOVE_STEP };
    case 'left': return { dx: -PLAYER_MOVE_STEP, dy: 0 };
    case 'right': return { dx: PLAYER_MOVE_STEP, dy: 0 };
    default: return { dx: 0, dy: 0 };
  }
}

function withinOrClosing(next: number, current: number, max: number): boolean {
  return next <= max || next <= current;
}

// A move may never pull players further apart than the shared screen, but a
// move that closes the gap is always allowed, so nobody gets frozen outside it.
export function staysInsideSharedScreen(
  state: GameEngineState,
  mover: PlayerState,
  x: number,
  y: number,
  scale = 1
): boolean {
  if (state.config.mode === 'solo' || state.config.numPlayers <= 1) return true;

  const aliveOthers = state.players.filter((player) => (
    player.id !== mover.id && player.alive
  ));
  return aliveOthers.every((player) => (
    withinOrClosing(
      Math.abs(player.x - x),
      Math.abs(player.x - mover.x),
      SHARED_SCREEN_MAX_DELTA_X * scale
    )
    && withinOrClosing(
      Math.abs(player.y - y),
      Math.abs(player.y - mover.y),
      SHARED_SCREEN_MAX_DELTA_Y * scale
    )
  ));
}

function distanceSquared(
  first: Pick<PlayerState, 'x' | 'y'>,
  second: Pick<PlayerState, 'x' | 'y'>
): number {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

// `escaping`: the mover stands in danger. Then the shared screen stretches
// and other ninjas' bodies stop blocking, so neither can trap them in a blast.
export function movePlayer(
  state: GameEngineState,
  playerId: string,
  direction: Direction,
  escaping = false,
): GameEngineState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  if (!player.alive) return state;

  const others = state.players.filter((p) => p.id !== playerId && p.alive);
  const { dx, dy } = getDirectionDelta(direction);
  let { x, y } = player;
  let map = state.map;
  let players = [...state.players];
  const nx = roundToMovementStep(dy === 0 ? x + dx : moveTowardCellCenter(x));
  const ny = roundToMovementStep(dx === 0 ? y + dy : moveTowardCellCenter(y));

  if (!isValidMove(state, playerId, nx, ny, x, y)) return state;
  const screenScale = escaping ? SHARED_SCREEN_ESCAPE_SCALE : 1;
  if (!staysInsideSharedScreen(state, player, nx, ny, screenScale)) return state;
  // Players block each other, but two players who end up overlapping (a
  // teleport, a respawn) can always step apart.
  const blocked = !escaping && others.some((p) => (
    positionsTouch({ x: nx, y: ny }, p, PLAYER_COLLISION_RADIUS * 2)
    && distanceSquared({ x: nx, y: ny }, p) <= distanceSquared(player, p)
  ));
  if (blocked) return state;

  x = nx;
  y = ny;

  const playerCell = getPlayerCell({ x, y });
  const cell = getCell(map, playerCell);
  if (cell && isPower(cell)) {
    const result = applyPowerUp(
      { ...state, map, players },
      playerId,
      cell as Power,
    );
    map = result.map;
    players = result.players;
    const newMap = map.map((row) => [...row]);
    newMap[playerCell.y][playerCell.x] = 'Empty';
    map = newMap;
  }

  players[playerIndex] = {
    ...players[playerIndex], x, y, facing: direction,
  };
  return { ...state, map, players };
}

// A held direction only counts as open if a short look-ahead keeps moving:
// the first 0.2 cells toward a wall are lane slack, not progress.
const TURN_PROBE_STEPS = 3;

function canAdvance(
  state: GameEngineState,
  playerId: string,
  direction: Direction,
  escaping: boolean,
): boolean {
  let probe = state;
  for (let step = 0; step < TURN_PROBE_STEPS; step += 1) {
    const next = movePlayer(probe, playerId, direction, escaping);
    if (next === probe) return false;
    probe = next;
  }
  return true;
}

/**
 * Buffered turn: move in the newest direction when it is open; when it is
 * blocked, keep travelling in the fallback (an older held or just-released
 * direction) so the turn happens at the next opening instead of stalling
 * against the wall.
 */
export function movePlayerBuffered(
  state: GameEngineState,
  playerId: string,
  direction: Direction,
  fallbackDirection?: Direction,
  escaping = false,
): GameEngineState {
  if (fallbackDirection && fallbackDirection !== direction
    && !canAdvance(state, playerId, direction, escaping)) {
    const fallback = movePlayer(state, playerId, fallbackDirection, escaping);
    if (fallback !== state) return fallback;
  }
  return movePlayer(state, playerId, direction, escaping);
}

function getFacingDelta(direction: Direction): { dx: number; dy: number } {
  switch (direction) {
    case 'up': return { dx: 0, dy: -1 };
    case 'down': return { dx: 0, dy: 1 };
    case 'left': return { dx: -1, dy: 0 };
    case 'right': return { dx: 1, dy: 0 };
    default: return { dx: 0, dy: 1 };
  }
}

function actorOverlapsCell(actor: Pick<PlayerState, 'x' | 'y'>, x: number, y: number): boolean {
  return getOverlappedCells(actor.x, actor.y).some((cell) => cell.x === x && cell.y === y);
}

function cellIsOccupiedByActor(
  state: GameEngineState,
  x: number,
  y: number,
  playerId: string,
): boolean {
  const occupiedByPlayer = state.players.some((player) => (
    player.id !== playerId
    && player.alive
    && actorOverlapsCell(player, x, y)
  ));
  const occupiedByMonster = state.monsters.some((monster) => monster.x === x && monster.y === y);
  const occupiedByBoss = state.boss?.x === x && state.boss.y === y;
  return occupiedByPlayer || occupiedByMonster || occupiedByBoss;
}

function hasAdjacentEscapeCell(
  state: GameEngineState,
  playerId: string,
  player: PlayerState,
): boolean {
  const origin = getPlayerCell(player);
  const directions: Direction[] = ['up', 'down', 'left', 'right'];
  return directions.some((direction) => {
    const { dx, dy } = getFacingDelta(direction);
    const x = origin.x + dx;
    const y = origin.y + dy;
    return isValidMove(state, playerId, x, y, player.x, player.y);
  });
}

export function placeObstacle(state: GameEngineState, playerId: string): GameEngineState {
  const playerIndex = state.players.findIndex((player) => player.id === playerId);
  if (playerIndex === -1) return state;

  const player = state.players[playerIndex];
  if (!player.alive || player.obstacles <= 0) return state;

  const origin = getPlayerCell(player);
  const facing = player.facing ?? 'down';
  const { dx, dy } = getFacingDelta(facing);
  const target = { x: origin.x + dx, y: origin.y + dy };
  const targetCell = getCell(state.map, target);

  if (targetCell !== 'Empty'
    || actorOverlapsCell(player, target.x, target.y)
    || cellIsOccupiedByActor(state, target.x, target.y, playerId)) {
    return state;
  }

  const map = state.map.map((row) => [...row]);
  map[target.y][target.x] = {
    ownerId: playerId,
    coords: target,
  };

  if (!hasAdjacentEscapeCell({ ...state, map }, playerId, player)) {
    return state;
  }

  const players = state.players.map((item) => {
    if (item.id !== playerId) return item;
    const obstacles = item.obstacles - 1;
    return {
      ...item,
      obstacles,
      powerUps: obstacles > 0
        ? item.powerUps
        : item.powerUps.filter((powerUp) => powerUp !== 'Obstacle'),
    };
  });

  return { ...state, map, players };
}

// The ultimate recharges from its cooldown, so a charge pickup winds the
// cooldown forward; a bare charge bonus would be overwritten on the next tick.
function restoreUltimateCharge(
  player: PlayerState,
  amount: number,
): Pick<PlayerState, 'ultimateCharge' | 'ultimateCooldownRemaining'> {
  const ultimateCharge = Math.min(100, player.ultimateCharge + amount);
  return {
    ultimateCharge,
    ultimateCooldownRemaining: Math.min(
      player.ultimateCooldownRemaining,
      (player.ultimateCooldown * (100 - ultimateCharge)) / 100,
    ),
  };
}

export function applyPowerUp(
  state: GameEngineState,
  playerId: string,
  powerUp: Power,
): GameEngineState {
  const exclusive = MUTUALLY_EXCLUSIVE[powerUp];
  const currentTimed = state.timedPowerUps[playerId] ?? [];
  const currentPlayer = state.players.find((p) => p.id === playerId);
  const hasExclusive = currentTimed.some((tp) => tp.power === exclusive)
    || Boolean(exclusive && currentPlayer?.powerUps.includes(exclusive));
  if (exclusive && hasExclusive) {
    return state;
  }

  let players = state.players.map((p) => {
    if (p.id !== playerId) return p;
    const next = { ...p };
    switch (powerUp) {
      case 'AddBomb':
        next.maxBombs += 1;
        break;
      case 'BlastRangeUp':
        next.bombRange += 1;
        break;
      case 'Detonator':
        next.powerUps = addUniquePower(next.powerUps, 'Detonator');
        break;
      case 'RollerSkate':
        next.powerUps = addUniquePower(next.powerUps, 'RollerSkate');
        break;
      case 'Invincibility':
        next.powerUps = [
          ...next.powerUps.filter((pw) => pw !== 'Invincibility'),
          'Invincibility',
        ];
        break;
      case 'Ghost':
        next.powerUps = [
          ...next.powerUps.filter((pw) => pw !== 'Ghost'),
          'Ghost',
        ];
        break;
      case 'Obstacle':
        next.obstacles += 3;
        next.powerUps = addUniquePower(next.powerUps, 'Obstacle');
        break;
      case 'ClaySpider':
        next.maxBombs += 1;
        next.bombRange += 1;
        Object.assign(next, restoreUltimateCharge(next, 15));
        break;
      case 'Rasengan':
        next.bombRange += 1;
        Object.assign(next, restoreUltimateCharge(next, 25));
        break;
      case 'Sharingan':
        next.powerUps = addUniquePower(next.powerUps, 'Detonator');
        Object.assign(next, restoreUltimateCharge(next, 25));
        break;
      case 'FTGKunai':
        next.powerUps = addUniquePower(next.powerUps, 'RollerSkate');
        Object.assign(next, restoreUltimateCharge(next, 20));
        break;
      case 'CrowFeather':
        next.powerUps = [
          ...next.powerUps.filter((pw) => pw !== 'Ghost'),
          'Ghost',
        ];
        Object.assign(next, restoreUltimateCharge(next, 10));
        break;
      case 'SandArmor':
        next.powerUps = [
          ...next.powerUps.filter((pw) => pw !== 'Invincibility'),
          'Invincibility',
        ];
        next.passiveState = 'Sand Armor Reinforced';
        break;
      case 'ChakraScroll':
        next.bombRange += 1;
        Object.assign(next, restoreUltimateCharge(next, 35));
        break;
      case 'CharacterFragment':
        Object.assign(next, restoreUltimateCharge(next, 100));
        break;
      default:
        break;
    }
    return next;
  });

  let timedPowerUps = { ...state.timedPowerUps };
  const timedPower = powerUp === 'CrowFeather'
    ? 'Ghost'
    : powerUp === 'SandArmor'
      ? 'Invincibility'
      : powerUp;
  const durationMs = timedPower === 'Ghost'
    ? GHOST_POWER_MS
    : timedPower === 'Invincibility'
      ? INVINCIBILITY_POWER_MS
      : 0;

  if (durationMs > 0) {
    const list = (timedPowerUps[playerId] ?? []).filter(
      (tp) => tp.power !== timedPower,
    );
    list.push({
      power: timedPower,
      ticksRemaining: durationMs,
      flashTicksRemaining: POWER_FLASH_MS,
    });
    timedPowerUps = { ...timedPowerUps, [playerId]: list };
  }

  return {
    ...state,
    players,
    timedPowerUps,
    pickupMessages: addPickupMessage(state, playerId, powerUp),
  };
}

export function tickPickupMessages(
  state: GameEngineState,
  deltaMs: number,
): GameEngineState {
  if (state.pickupMessages && state.pickupMessages.length === 0) return state;
  const pickupMessages = (state.pickupMessages ?? [])
    .map((message) => ({
      ...message,
      ticksRemaining: message.ticksRemaining - deltaMs,
    }))
    .filter((message) => message.ticksRemaining > 0);
  return { ...state, pickupMessages };
}

function tickSurvivalGrace(players: PlayerState[], deltaMs: number): PlayerState[] {
  if (!players.some((p) => (p.survivalGraceMs ?? 0) > 0)) return players;
  return players.map((p) => (
    (p.survivalGraceMs ?? 0) > 0
      ? { ...p, survivalGraceMs: Math.max(0, (p.survivalGraceMs ?? 0) - deltaMs) }
      : p
  ));
}

export function tickPowerUps(state: GameEngineState, deltaMs: number): GameEngineState {
  const graced = tickSurvivalGrace(state.players, deltaMs);
  if (Object.keys(state.timedPowerUps).length === 0) {
    return graced === state.players ? state : { ...state, players: graced };
  }
  let players = [...graced];
  const timedPowerUps: GameEngineState['timedPowerUps'] = {};

  Object.entries(state.timedPowerUps).forEach(([playerId, powers]) => {
    const remaining: typeof powers = [];
    powers.forEach((tp) => {
      const ticksRemaining = tp.ticksRemaining - deltaMs;
      let flashTicksRemaining = tp.flashTicksRemaining - deltaMs;
      if (flashTicksRemaining < 0) flashTicksRemaining = 0;

      if (ticksRemaining > 0) {
        remaining.push({ ...tp, ticksRemaining, flashTicksRemaining });
      } else if (tp.power === 'Ghost') {
        const player = players.find((p) => p.id === playerId);
        if (player?.alive) {
          const trapped = getOverlappedCells(player.x, player.y).some((point) => {
            const cell = getCell(state.map, point);
            if (!cell || cell === 'Empty' || isPower(cell)) return false;
            if (isBomb(cell)) return cell.ownerId !== playerId;
            return true;
          });
          if (trapped) {
            players = players.map((p) => (
              p.id === playerId
                ? {
                  ...p,
                  alive: false,
                  deathReason: `${p.name} was sealed when Ghost faded inside a wall or cover.`,
                }
                : p
            ));
          }
        }
        players = players.map((p) => (
          p.id === playerId
            ? { ...p, powerUps: p.powerUps.filter((pw) => pw !== 'Ghost') }
            : p
        ));
      } else if (tp.power === 'Invincibility') {
        players = players.map((p) => (
          p.id === playerId
            ? { ...p, powerUps: p.powerUps.filter((pw) => pw !== 'Invincibility') }
            : p
        ));
      }
    });
    if (remaining.length > 0) {
      timedPowerUps[playerId] = remaining;
    }
  });

  return { ...state, players, timedPowerUps };
}

export function clearPlayerPowerUps(
  state: GameEngineState,
  playerId: string,
): GameEngineState {
  const timedPowerUps = { ...state.timedPowerUps };
  delete timedPowerUps[playerId];
  const players = state.players.map((p) => (
    p.id === playerId ? { ...p, powerUps: [] } : p
  ));
  return { ...state, players, timedPowerUps };
}

export function isPowerUpActive(
  state: GameEngineState,
  playerId: string,
  power: Power,
): boolean {
  const timed = state.timedPowerUps[playerId]?.some(
    (tp) => tp.power === power && tp.ticksRemaining > 0,
  ) ?? false;
  const carried = state.players.find((p) => p.id === playerId)?.powerUps.includes(power) ?? false;
  return timed || carried;
}

export function isPowerUpFlashing(
  state: GameEngineState,
  playerId: string,
  power: Power,
): boolean {
  return state.timedPowerUps[playerId]?.some(
    (tp) => tp.power === power && tp.flashTicksRemaining > 0 && tp.ticksRemaining > 0,
  ) ?? false;
}
