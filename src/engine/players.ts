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

const MUTUALLY_EXCLUSIVE: Partial<Record<Power, Power | null>> = {
  Ghost: 'Invincibility',
  Invincibility: 'Ghost',
};

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

function isValidMove(
  state: GameEngineState,
  playerId: string,
  x: number,
  y: number,
): boolean {
  const { map } = state;
  if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) return false;

  if (isGhostActive(state, playerId)) {
    return !isObstacle(map[y][x]);
  }

  const cell = map[y][x];
  return cell !== 'Wall'
    && cell !== 'Box'
    && !isObstacle(cell)
    && !isBomb(cell)
    && (cell === 'Empty' || isPower(cell));
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
  const moveDistance = player.powerUps.includes('RollerSkate')
    || player.characterId === 'minato'
    ? 2
    : 1;
  let { x, y } = player;
  let map = state.map;
  let players = [...state.players];

  for (let step = 0; step < moveDistance; step += 1) {
    let nx = x;
    let ny = y;
    switch (direction) {
      case 'up': ny -= 1; break;
      case 'down': ny += 1; break;
      case 'left': nx -= 1; break;
      case 'right': nx += 1; break;
      default: break;
    }

    if (!isValidMove(state, playerId, nx, ny)) break;
    const blocked = others.some((p) => p.x === nx && p.y === ny);
    if (blocked) break;

    x = nx;
    y = ny;
    const cell = map[y][x];
    if (isPower(cell)) {
      const result = applyPowerUp(
        { ...state, map, players },
        playerId,
        cell as Power,
      );
      map = result.map;
      players = result.players;
      const newMap = map.map((row) => [...row]);
      newMap[y][x] = 'Empty';
      map = newMap;
    }
  }

  players[playerIndex] = { ...players[playerIndex], x, y };
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
        next.powerUps = [...next.powerUps, 'Obstacle'];
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

  return { ...state, players, timedPowerUps };
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
          const cell = state.map[player.y][player.x];
          if (cell === 'Wall' || cell === 'Box' || isObstacle(cell)) {
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
  return state.timedPowerUps[playerId]?.some(
    (tp) => tp.power === power && tp.ticksRemaining > 0,
  ) ?? state.players.find((p) => p.id === playerId)?.powerUps.includes(power) ?? false;
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
