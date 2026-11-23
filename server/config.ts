// The online server's settings from the environment. Every value is checked
// at boot: a typo should stop the deploy, not quietly fall back to a default.
import { normalizeOrigin, parseClientIpSource } from './admission';
import type { OnlineServerLimits, OnlineServerOptions } from './onlineServer';

type Env = Record<string, string | undefined>;

export type ServerConfig = OnlineServerOptions & {
  port: number;
  host: string;
  allowedOrigins: string[];
};

const DEFAULT_PORT = 8787;
// setTimeout runs longer delays at once, so no timer may exceed this.
const MAX_TIMER_MS = 2_147_483_647;
const MIN_METRICS_TOKEN_LENGTH = 16;

/** Each limit's variable and its smallest valid value. Unset ones keep the server default. */
const LIMIT_VARIABLES: Record<keyof OnlineServerLimits, [string, number]> = {
  maxRooms: ['MAX_ROOMS', 1],
  maxRoomsPerIp: ['MAX_ROOMS_PER_IP', 1],
  maxSockets: ['MAX_SOCKETS', 1],
  maxSocketsPerIp: ['MAX_SOCKETS_PER_IP', 1],
  connectBurst: ['CONNECT_BURST', 1],
  connectRefillMs: ['CONNECT_REFILL_MS', 1],
  createBurst: ['CREATE_BURST', 1],
  createRefillMs: ['CREATE_REFILL_MS', 1],
  createCooldownMs: ['CREATE_COOLDOWN_MS', 0],
  joinFailBurst: ['JOIN_FAIL_BURST', 1],
  joinFailRefillMs: ['JOIN_FAIL_REFILL_MS', 1],
  messagesPerSecond: ['MESSAGES_PER_SECOND', 1],
  unseatedTimeoutMs: ['UNSEATED_TIMEOUT_MS', 1],
  lobbyTtlMs: ['LOBBY_TTL_MS', 1],
  reconnectGraceMs: ['RECONNECT_GRACE_MS', 1],
  emptyRoomTtlMs: ['EMPTY_ROOM_TTL_MS', 1],
  finishedRoomTtlMs: ['FINISHED_ROOM_TTL_MS', 1],
  idleRoomMs: ['IDLE_ROOM_MS', 1],
  maxRoomAgeMs: ['MAX_ROOM_AGE_MS', 1],
  shutdownGraceMs: ['SHUTDOWN_GRACE_MS', 0],
};

/** Reads the server options from `env`; throws once, naming every invalid value. */
export function readServerConfig(env: Env): ServerConfig {
  const problems: string[] = [];
  // Render's dashboard can hold a key with an empty value: treat it as unset.
  const read = (name: string): string | undefined => env[name]?.trim() || undefined;
  const wholeNumber = (name: string, min: number, max: number): number | undefined => {
    const text = read(name);
    if (text === undefined) return undefined;
    const value = /^\d+$/.test(text) ? Number(text) : NaN;
    if (Number.isSafeInteger(value) && value >= min && value <= max) return value;
    problems.push(`${name} must be a whole number from ${min} to ${max}, not "${text}"`);
    return undefined;
  };
  const flag = (name: string): boolean | undefined => {
    const text = read(name)?.toLowerCase();
    if (text === undefined) return undefined;
    if (text === 'true' || text === '1') return true;
    if (text === 'false' || text === '0') return false;
    problems.push(`${name} must be true or false, not "${text}"`);
    return undefined;
  };

  const config: ServerConfig = {
    port: wholeNumber('PORT', 0, 65_535) ?? DEFAULT_PORT,
    host: '0.0.0.0',
    allowedOrigins: [],
  };

  (Object.keys(LIMIT_VARIABLES) as (keyof OnlineServerLimits)[]).forEach((key) => {
    const [name, min] = LIMIT_VARIABLES[key];
    const value = wholeNumber(name, min, MAX_TIMER_MS);
    if (value !== undefined) config[key] = value;
  });

  (read('ALLOWED_ORIGINS') ?? '').split(',').map((entry) => entry.trim()).filter(Boolean)
    .forEach((entry) => {
      const origin = normalizeOrigin(entry);
      if (origin) config.allowedOrigins.push(origin);
      else problems.push(`ALLOWED_ORIGINS entry "${entry}" is not an http(s) origin`);
    });

  const allowLocalhostOrigins = flag('ALLOW_LOCALHOST_ORIGINS');
  if (allowLocalhostOrigins !== undefined) config.allowLocalhostOrigins = allowLocalhostOrigins;

  const clientIpSource = read('CLIENT_IP_SOURCE');
  if (clientIpSource !== undefined) {
    const source = parseClientIpSource(clientIpSource);
    if (source) config.clientIpSource = source;
    else {
      problems.push('CLIENT_IP_SOURCE must be socket, xff-left, xff-right:<hops> or '
        + `header:<name>, not "${clientIpSource}"`);
    }
  }

  const debugClientIp = flag('DEBUG_CLIENT_IP');
  if (debugClientIp !== undefined) config.debugClientIp = debugClientIp;

  const metricsToken = read('METRICS_TOKEN');
  if (metricsToken !== undefined) {
    // The value is a secret: the message names the rule, never the value.
    if (metricsToken.length >= MIN_METRICS_TOKEN_LENGTH) config.metricsToken = metricsToken;
    else problems.push(`METRICS_TOKEN must be at least ${MIN_METRICS_TOKEN_LENGTH} characters`);
  }

  if (problems.length > 0) {
    throw new Error(`Invalid online server settings:\n- ${problems.join('\n- ')}`);
  }
  return config;
}
