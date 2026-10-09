import { CharacterId, StageId } from '../content/types';
import { Direction, GameConfig, GameEngineState } from '../engine/types';
import { REPLAY_VERSION } from './replay';

export const PROTOCOL_VERSION = 1;
export const SIMULATION_VERSION = REPLAY_VERSION;
export const MAX_CLIENT_MESSAGE_BYTES = 1024;

export type OnlineAction = 'bomb' | 'detonate' | 'ultimate' | 'cover';

export type OnlinePlayer = {
  seat: number;
  name: string;
  characterId: CharacterId;
  ready: boolean;
  connected: boolean;
};

export type ClientMessage =
  | {
    type: 'create'; protocol: typeof PROTOCOL_VERSION; simulation: typeof SIMULATION_VERSION;
    name: string; characterId: CharacterId;
  }
  | {
    type: 'join'; protocol: typeof PROTOCOL_VERSION; simulation: typeof SIMULATION_VERSION;
    roomId: string; name: string; characterId: CharacterId;
  }
  | {
    type: 'resume-session'; protocol: typeof PROTOCOL_VERSION;
    simulation: typeof SIMULATION_VERSION; roomId: string; token: string;
  }
  | { type: 'selection'; characterId: CharacterId }
  | { type: 'ready'; ready: boolean }
  | {
    type: 'input'; seq: number; direction?: Direction | null;
    fallbackDirection?: Direction | null; action?: OnlineAction;
  }
  | { type: 'rematch'; ready: boolean }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'welcome'; roomId: string; seat: number; playerId: string; token: string }
  | { type: 'lobby'; roomId: string; stageId: StageId; players: OnlinePlayer[] }
  | { type: 'start'; roomId: string; playerId: string; config: GameConfig }
  | {
    type: 'snapshot'; tick: number; ack: number;
    state?: GameEngineState; patch?: Partial<GameEngineState>;
  }
  | { type: 'peer'; seat: number; connected: boolean; graceMsLeft?: number }
  | { type: 'room-closed'; reason: 'left' | 'timeout' | 'server' }
  | {
    type: 'error';
    code: 'bad-message' | 'room-full' | 'room-not-found' | 'seat-expired'
      | 'upgrade-required' | 'match-started' | 'rate-limited';
  };

const CHARACTER_IDS: CharacterId[] = [
  'deidara', 'naruto', 'sasuke', 'gaara', 'minato', 'itachi',
];
const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const ONLINE_ACTIONS: OnlineAction[] = ['bomb', 'detonate', 'ultimate', 'cover'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCharacterId(value: unknown): value is CharacterId {
  return typeof value === 'string' && CHARACTER_IDS.includes(value as CharacterId);
}

function isDirection(value: unknown): value is Direction {
  return typeof value === 'string' && DIRECTIONS.includes(value as Direction);
}

function isName(value: unknown): value is string {
  const hasControlCharacter = typeof value === 'string'
    && Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
  return typeof value === 'string'
    && value.trim().length >= 1
    && value.trim().length <= 16
    && !hasControlCharacter;
}

function isRoomId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(value);
}

function hasVersions(value: Record<string, unknown>): boolean {
  return value.protocol === PROTOCOL_VERSION && value.simulation === SIMULATION_VERSION;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function parseClientMessage(raw: string): ClientMessage | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_CLIENT_MESSAGE_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== 'string') return null;

  switch (value.type) {
    case 'create':
      return hasOnlyKeys(value, ['type', 'protocol', 'simulation', 'name', 'characterId'])
        && hasVersions(value) && isName(value.name) && isCharacterId(value.characterId)
        ? value as ClientMessage : null;
    case 'join':
      return hasOnlyKeys(
        value,
        ['type', 'protocol', 'simulation', 'roomId', 'name', 'characterId']
      ) && hasVersions(value) && isRoomId(value.roomId)
        && isName(value.name) && isCharacterId(value.characterId)
        ? value as ClientMessage : null;
    case 'resume-session':
      return hasOnlyKeys(
        value,
        ['type', 'protocol', 'simulation', 'roomId', 'token']
      ) && hasVersions(value) && isRoomId(value.roomId)
        && typeof value.token === 'string' && /^[a-f0-9]{32}$/.test(value.token)
        ? value as ClientMessage : null;
    case 'selection':
      return hasOnlyKeys(value, ['type', 'characterId']) && isCharacterId(value.characterId)
        ? value as ClientMessage : null;
    case 'ready':
    case 'rematch':
      return hasOnlyKeys(value, ['type', 'ready']) && typeof value.ready === 'boolean'
        ? value as ClientMessage : null;
    case 'input': {
      const validDirection = value.direction === undefined
        || value.direction === null || isDirection(value.direction);
      const validFallback = value.fallbackDirection === undefined
        || value.fallbackDirection === null || isDirection(value.fallbackDirection);
      const validAction = value.action === undefined
        || (typeof value.action === 'string'
          && ONLINE_ACTIONS.includes(value.action as OnlineAction));
      return Number.isSafeInteger(value.seq) && (value.seq as number) >= 0
        && hasOnlyKeys(value, ['type', 'seq', 'direction', 'fallbackDirection', 'action'])
        && validDirection && validFallback && validAction
        && (value.direction !== undefined || value.action !== undefined)
        ? value as ClientMessage : null;
    }
    case 'leave':
      return hasOnlyKeys(value, ['type']) ? value as ClientMessage : null;
    default:
      return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== 'string') return null;
  switch (value.type) {
    case 'welcome':
      return isRoomId(value.roomId) && Number.isInteger(value.seat)
        && typeof value.playerId === 'string' && typeof value.token === 'string'
        ? value as ServerMessage : null;
    case 'lobby':
      return isRoomId(value.roomId) && Array.isArray(value.players)
        ? value as ServerMessage : null;
    case 'start':
      return isRoomId(value.roomId) && isRecord(value.config)
        && typeof value.playerId === 'string' ? value as ServerMessage : null;
    case 'snapshot':
      return Number.isFinite(value.tick) && Number.isFinite(value.ack)
        && (isRecord(value.state) || isRecord(value.patch))
        ? value as ServerMessage : null;
    case 'peer':
      return Number.isInteger(value.seat) && typeof value.connected === 'boolean'
        ? value as ServerMessage : null;
    case 'room-closed':
      return value.reason === 'left' || value.reason === 'timeout' || value.reason === 'server'
        ? value as ServerMessage : null;
    case 'error':
      return typeof value.code === 'string' ? value as ServerMessage : null;
    default:
      return null;
  }
}

export function serializeMessage(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}
