/* eslint-disable no-use-before-define, prefer-destructuring */
/* eslint-disable comma-dangle, no-nested-ternary, prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  isBomb, isObstacle, isPower, Power,
} from '../model/gameItem';
import { Direction, GameEngineState, PlayerState } from './types';
import {
  GHOST_POWER_MS, INVINCIBILITY_POWER_MS, POWER_FLASH_MS,
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
};

const PICKUP_MESSAGE_MS = 3600;

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

export function applyCharacterSurvival(player: PlayerState): PlayerState {
  if (player.characterId === 'gaara' && player.passiveState === 'Automatic Sand Shield') {
    return {
      ...player,
      alive: true,
      passiveState: 'Sand Shield Spent',
    };
  }
  if (player.characterId === 'itachi' && player.passiveState === 'Illusion Dodge') {
    return {
      ...player,
      alive: true,
      passiveState: 'Illusion Dodge Spent',
    };
  }
  return { ...player, alive: false };
}

function isGhostActive(state: GameEngineState, playerId: string): boolean {
  return state.timedPowerUps[playerId]?.some(
    (tp) => tp.power === 'Ghost' && tp.ticksRemaining > 0,
  ) ?? false;
}

function isCellValidForPlayer(
  state: GameEngineState,
  playerId: string,
  x: number,
  y: number,
  currentX: number,
  currentY: number,
): boolean {
  const { map } = state;
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;

  if (isGhostActive(state, playerId)) {
    return true;
  }

  const cell = map[y][x];
  if (isBomb(cell)) {
    return cell.ownerId === playerId
      && positionsTouch(
        { x: currentX, y: currentY },
        { x, y },
        0.5 + PLAYER_COLLISION_RADIUS,
      );
  }

  return cell !== 'Wall'
    && cell !== 'Box'
    && !isObstacle(cell)
    && (cell === 'Empty' || isPower(cell));
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
    isCellValidForPlayer(state, playerId, cell.x, cell.y, currentX, currentY)
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

export function movePlayer(
  state: GameEngineState,
  playerId: string,
  direction: Direction,
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
  const blocked = others.some((p) => positionsTouch(
    { x: nx, y: ny },
    p,
    PLAYER_COLLISION_RADIUS * 2,
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
        if (!next.powerUps.includes('Detonator')) next.powerUps = [...next.powerUps, 'Detonator'];
        break;
      case 'RollerSkate':
        if (!next.powerUps.includes('RollerSkate')) next.powerUps = [...next.powerUps, 'RollerSkate'];
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
        if (!next.powerUps.includes('Obstacle')) next.powerUps = [...next.powerUps, 'Obstacle'];
        break;
      default:
        break;
    }
    return next;
  });

  let timedPowerUps = { ...state.timedPowerUps };
  const durationMs = powerUp === 'Ghost'
    ? GHOST_POWER_MS
    : powerUp === 'Invincibility'
      ? INVINCIBILITY_POWER_MS
      : 0;

  if (durationMs > 0) {
    const list = (timedPowerUps[playerId] ?? []).filter(
      (tp) => tp.power !== powerUp,
    );
    list.push({
      power: powerUp,
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
  const pickupMessages = (state.pickupMessages ?? [])
    .map((message) => ({
      ...message,
      ticksRemaining: message.ticksRemaining - deltaMs,
    }))
    .filter((message) => message.ticksRemaining > 0);
  return { ...state, pickupMessages };
}

export function tickPowerUps(state: GameEngineState, deltaMs: number): GameEngineState {
  let players = [...state.players];
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
        if (player) {
          const trapped = getOverlappedCells(player.x, player.y).some((point) => {
            const cell = getCell(state.map, point);
            return Boolean(cell && cell !== 'Empty' && !isPower(cell));
          });
          if (trapped) {
            players = players.map((p) => (
              p.id === playerId ? { ...p, alive: false } : p
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
