/* eslint-disable no-param-reassign -- rooms and seats are mutable server actors. */
/* eslint-disable no-console */
import {
  createHash, randomBytes, randomInt, timingSafeEqual,
} from 'node:crypto';
import { createServer, IncomingMessage, Server as HttpServer } from 'node:http';
import WebSocket, { RawData, WebSocketServer } from 'ws';
import { GameAction } from '../src/engine/actions';
import { TICK_MS } from '../src/engine/constants';
import { loadCampaignMapRows, parseMapRows } from '../src/engine/mapLoader';
import { arenaMapRows, getArenaMap } from '../src/content/arenaMaps';
import { gameReducer } from '../src/engine/reducer';
import {
  Direction, GameConfig, GameEngineState, PlayerState,
} from '../src/engine/types';
import { CharacterId, StageId } from '../src/content/types';
import { getStageDefinition } from '../src/content/stages';
import {
  ClientMessage,
  MAX_CLIENT_MESSAGE_BYTES,
  OnlineAction,
  OnlinePlayer,
  ONLINE_ROOM_CAPACITY,
  OnlineArenaMapId,
  OnlineRoomMode,
  OnlineRounds,
  PROTOCOL_VERSION,
  ResumeFailureReason,
  RoomClosedDetail,
  SIMULATION_VERSION,
  ServerMessage,
  parseClientMessage,
  serializeMessage,
} from '../src/network/protocol';
import {
  ClientIpSource, Peer, PeerTable, addressKey, clientAddress, isLocalhostOrigin,
  normalizeOrigin, parseClientIpSource, siteKey,
} from './admission';
import {
  LogEntry, OnlineServerCounters, OnlineServerMetrics, ProtocolErrorKind,
  createAddressTagger, createCounters,
} from './telemetry';

export type { ClientIpSource } from './admission';
export type { LogEntry, OnlineServerMetrics } from './telemetry';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const ROUND_RESULT_MS = 4_000;
const KEEPALIVE_MS = 15_000;
const MAX_SNAPSHOT_BUFFER_BYTES = 16 * 1024;
const MOVE_REPEAT_MS = 28;
const FAST_MOVE_REPEAT_MS = 18;
const MIN_ROOM_PLAYERS = 2;
const SWEEP_INTERVAL_MS = 1000;
const RESUME_DELAY_MS = 2000;
// A closed room's code keeps answering resumes with why it closed.
const TOMBSTONE_MS = 10 * 60_000;
const MAX_TOMBSTONES = 1000;
// Repeated abuse lines from one address collapse into one per window.
const LOG_WINDOW_MS = 10_000;
const CLOSE_REPLACED = 4001;
const CLOSE_UNSEATED = 4002;

/** Limits and timeouts. Each one can be set from the environment (server/config.ts). */
export const ONLINE_SERVER_LIMITS = {
  maxRooms: 100,
  // Per-address caps stay generous: a household or a school behind one NAT
  // shares an address and may host several rooms at once.
  maxRoomsPerIp: 8,
  maxSockets: 400,
  maxSocketsPerIp: 32,
  connectBurst: 20,
  connectRefillMs: 1000,
  // A burst as large as the room cap, so a class can open all its rooms at
  // once; the refill only slows create-and-leave churn.
  createBurst: 8,
  createRefillMs: 5000,
  // Off by default: a gap per address would queue that class up again.
  createCooldownMs: 0,
  joinFailBurst: 10,
  joinFailRefillMs: 3000,
  messagesPerSecond: 60,
  // The browser opens its socket only when the player presses Create or
  // Join, and sends that request as soon as it opens, so a socket still
  // without a seat after this long never asked for one or was refused.
  unseatedTimeoutMs: 30_000,
  lobbyTtlMs: 10 * 60_000,
  reconnectGraceMs: 20_000,
  emptyRoomTtlMs: 60_000,
  finishedRoomTtlMs: 2 * 60_000,
  idleRoomMs: 10 * 60_000,
  maxRoomAgeMs: 3 * 60 * 60_000,
  shutdownGraceMs: 5000,
};

export type OnlineServerLimits = typeof ONLINE_SERVER_LIMITS;

/**
 * An IPv6 /48 gets this many times one address's socket, room and
 * failed-join allowance. A home or a free tunnel can hold a whole /48, and
 * each /64 in it counts as one address; set loose because phones on one
 * carrier can share a /48 too.
 */
export const IPV6_SITE_FACTOR = 4;

type InputMessage = Extract<ClientMessage, { type: 'input' }>;
type RoomCloseReason = Extract<ServerMessage, { type: 'room-closed' }>['reason'];
type RoomPhase = 'waiting' | 'active' | 'finished';
type RateLimitScope = 'connect' | 'create' | 'create-cooldown' | 'join' | 'message';
type RejectReason =
  | 'origin' | 'draining' | 'max-sockets' | 'max-sockets-per-ip' | 'max-sockets-per-site'
  | 'max-rooms' | 'max-rooms-per-ip' | 'max-rooms-per-site';
type ResumeFailure = { reason: ResumeFailureReason; detail?: RoomClosedDetail };

type Seat = {
  seat: number;
  playerId: string;
  token: string;
  name: string;
  characterId: CharacterId;
  ready: boolean;
  connected: boolean;
  socket: WebSocket | null;
  queue: InputMessage[];
  lastAppliedSeq: number;
  direction: Direction | null;
  fallbackDirection: Direction | null;
  moveAccumulatorMs: number;
  needsFullSnapshot: boolean;
  /** When the seat's socket went away; null while it is connected. */
  awaySince: number | null;
  /** The ack of the last snapshot this seat was sent. */
  sentAck: number | null;
  /** Snapshots skipped since this reader fell behind. */
  droppedSnapshots: number;
};

type Room = {
  id: string;
  /** Random reference for logs; the code is a join secret while the room is open. */
  ref: string;
  /** The address whose open-room cap this room counts against. */
  owner: Peer;
  /** The owner's IPv6 /48, whose wider cap it also counts against. */
  ownerSite: Peer | null;
  roomMode: OnlineRoomMode;
  stageId: StageId;
  /** The map an arena room plays (a village or a city); a co-op room's is its stage. */
  arenaMapId: OnlineArenaMapId;
  totalRounds: OnlineRounds;
  seats: Seat[];
  state: GameEngineState | null;
  config: GameConfig | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  resultTimer: ReturnType<typeof setTimeout> | null;
  resumeTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  lastInputAt: number;
};

type Tombstone = { reason: RoomCloseReason; detail: RoomClosedDetail; closedAt: number };

type Connection = {
  peer: Peer;
  /** The IPv6 /48 the address is in; null for IPv4. */
  site: Peer | null;
  openedAt: number;
  /** Whether the socket ever held a seat. */
  seated: boolean;
  unseatedTimer: ReturnType<typeof setTimeout> | null;
  rate: { startedAt: number; count: number };
};

export type OnlineServer = {
  port: number;
  roomCount: () => number;
  getRoomState: (roomId: string) => GameEngineState | null;
  /** Live gauges and counts since boot, the same object /metrics serves. */
  metrics: () => OnlineServerMetrics;
  /** Drains, tells every room why it ends, and resolves once every socket is gone. */
  shutdown: (signal?: string) => Promise<void>;
  close: () => Promise<void>;
};

export type OnlineServerOptions = Partial<OnlineServerLimits> & {
  port?: number;
  host?: string;
  allowedOrigins?: string[];
  /** Defaults to true only when `allowedOrigins` is empty. */
  allowLocalhostOrigins?: boolean;
  clientIpSource?: ClientIpSource;
  /** Logs the raw forwarding headers of every handshake, only to choose `clientIpSource`. */
  debugClientIp?: boolean;
  /** Bearer token for /metrics. Without one, /metrics answers 404. */
  metricsToken?: string;
  roundResultMs?: number;
  tickIntervalMs?: number;
  maxSnapshotBufferBytes?: number;
  /**
   * Receives each structured log line. Unset, nothing is logged, so tests and
   * other embedders stay quiet; server/index.ts passes writeLogLine (stdout).
   */
  log?: (entry: LogEntry) => void;
  /** Clock for rate limits, cooldowns and log windows, so tests can move it. */
  now?: () => number;
  sweepIntervalMs?: number;
  /** How long a match stays paused after the last seat returns. */
  resumeDelayMs?: number;
};

type SnapshotDelivery = { needsFullSnapshot: boolean };

function roomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => (
    ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]
  )).join('');
}

/** The boot id first, so a resume can tell a restart from a lost seat; 32 hex in all. */
function seatToken(bootId: string): string {
  return `${bootId}${randomBytes(12).toString('hex')}`;
}

function send(socket: WebSocket | null, message: ServerMessage): void {
  if (socket?.readyState === WebSocket.OPEN) socket.send(serializeMessage(message));
}

function roomPlayers(room: Room): OnlinePlayer[] {
  return room.seats.map((seat) => ({
    seat: seat.seat,
    name: seat.name,
    characterId: seat.characterId,
    ready: seat.ready,
    connected: seat.connected,
  }));
}

function lobbyMessage(room: Room): ServerMessage {
  return {
    type: 'lobby',
    roomId: room.id,
    roomMode: room.roomMode,
    stageId: room.stageId,
    arenaMapId: room.arenaMapId,
    capacity: ONLINE_ROOM_CAPACITY,
    totalRounds: room.totalRounds,
    players: roomPlayers(room),
  };
}

function broadcast(room: Room, message: ServerMessage): void {
  room.seats.forEach((seat) => send(seat.socket, message));
}

function phaseOf(room: Room): RoomPhase {
  if (!room.state) return 'waiting';
  return room.state.phase === 'game_over' ? 'finished' : 'active';
}

function playerRepeatMs(player: PlayerState | undefined): number {
  return player?.characterId === 'minato' || player?.powerUps.includes('RollerSkate')
    ? FAST_MOVE_REPEAT_MS
    : MOVE_REPEAT_MS;
}

function actionFor(playerId: string, action: OnlineAction): GameAction {
  if (action === 'bomb') return { type: 'DROP_BOMB', playerId };
  if (action === 'detonate') return { type: 'DETONATE_BOMBS', playerId };
  if (action === 'ultimate') return { type: 'USE_ULTIMATE', playerId };
  return { type: 'PLACE_OBSTACLE', playerId };
}

function statePatch(
  before: GameEngineState,
  after: GameEngineState
): Partial<GameEngineState> {
  const patch: Partial<GameEngineState> = {};
  (Object.keys(after) as (keyof GameEngineState)[]).forEach((key) => {
    if (before[key] !== after[key]) Object.assign(patch, { [key]: after[key] });
  });
  return patch;
}

/** @internal Exported so the backpressure/resync contract can be tested directly. */
export function snapshotForDelivery(
  delivery: SnapshotDelivery,
  before: GameEngineState | null,
  state: GameEngineState,
  ack: number,
  bufferedBytes: number,
  maxBufferedBytes: number,
  forceFull = false
): Extract<ServerMessage, { type: 'snapshot' }> | null {
  if (bufferedBytes > maxBufferedBytes) {
    delivery.needsFullSnapshot = true;
    return null;
  }
  const sendFull = forceFull || delivery.needsFullSnapshot || !before;
  delivery.needsFullSnapshot = false;
  return {
    type: 'snapshot',
    tick: state.tick,
    ack,
    ...(sendFull ? { state } : { patch: statePatch(before, state) }),
  };
}

function createConfig(room: Room): GameConfig {
  const seats = {
    numPlayers: room.seats.length,
    selectedCharacters: room.seats.map((seat) => seat.characterId),
    playerNames: room.seats.map((seat) => seat.name),
    seed: randomInt(1, 2_147_483_646),
  };
  if (room.roomMode === 'coop') {
    // Co-op missions play the village's campaign map.
    const stage = getStageDefinition(room.stageId);
    return {
      ...seats,
      mode: 'solo',
      totalRounds: 1,
      selectedMap: stage.mapId,
      stageId: stage.id,
      map: parseMapRows(loadCampaignMapRows(stage.mapId)),
    };
  }
  // Arena rooms play their catalog map, as Local Arena does: a village is its
  // stage, a city is no stage and names only its map.
  const arena = getArenaMap(room.arenaMapId);
  if (!arena) throw new Error(`Unknown arena map '${room.arenaMapId}'`);
  return {
    ...seats,
    mode: 'onlinePreview',
    totalRounds: room.totalRounds,
    selectedMap: arena.id,
    ...(arena.family === 'city' ? {} : { stageId: arena.id as StageId }),
    map: parseMapRows(arenaMapRows(arena.id)),
  };
}

function bearerMatches(header: string | undefined, token: string): boolean {
  const presented = /^Bearer\s+(.+)$/i.exec(header ?? '')?.[1] ?? '';
  // Comparing equal-length digests keeps the check constant-time.
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(presented), digest(token));
}

function bump(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function startOnlineServer(
  options: OnlineServerOptions = {}
): Promise<OnlineServer> {
  const limits = Object.fromEntries(Object.entries(ONLINE_SERVER_LIMITS).map(([key, fallback]) => (
    [key, options[key as keyof OnlineServerLimits] ?? fallback]
  ))) as OnlineServerLimits;
  const allowedOrigins = (options.allowedOrigins ?? []).map((origin) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized) throw new Error(`Not an http(s) origin: ${origin}`);
    return normalized;
  });
  const allowLocalhostOrigins = options.allowLocalhostOrigins ?? allowedOrigins.length === 0;
  const clientIpSource = parseClientIpSource(options.clientIpSource ?? 'socket');
  if (!clientIpSource) throw new Error(`Unknown client address source: ${options.clientIpSource}`);
  const roundResultMs = options.roundResultMs ?? ROUND_RESULT_MS;
  const tickIntervalMs = options.tickIntervalMs ?? TICK_MS;
  const maxSnapshotBufferBytes = options.maxSnapshotBufferBytes
    ?? MAX_SNAPSHOT_BUFFER_BYTES;
  const sweepIntervalMs = options.sweepIntervalMs ?? SWEEP_INTERVAL_MS;
  const resumeDelayMs = options.resumeDelayMs ?? RESUME_DELAY_MS;
  const { metricsToken } = options;
  const clock = options.now ?? Date.now;
  const logSink = options.log ?? (() => undefined);

  const rooms = new Map<string, Room>();
  const tombstones = new Map<string, Tombstone>();
  const sessions = new Map<WebSocket, { room: Room; seat: Seat }>();
  const connections = new Map<WebSocket, Connection>();
  const liveSockets = new WeakMap<WebSocket, boolean>();
  const tagOf = createAddressTagger();
  const peers = new PeerTable(limits, tagOf);
  // Only their socket and room counts and failed-join bucket are used.
  const sites = new PeerTable({
    ...limits,
    joinFailBurst: limits.joinFailBurst * IPV6_SITE_FACTOR,
    joinFailRefillMs: limits.joinFailRefillMs / IPV6_SITE_FACTOR,
  }, tagOf);
  const counters = createCounters();
  const bootId = randomBytes(4).toString('hex');
  let draining = false;
  let shutdownPromise: Promise<void> | null = null;

  const log = (event: string, fields: Record<string, unknown> = {}) => {
    logSink({ ts: new Date().toISOString(), event, ...fields });
  };

  /** One line per address and kind per window; the next one says how many were held back. */
  const logThrottled = (
    peer: Peer,
    event: string,
    kind: string,
    fields: Record<string, unknown>
  ) => {
    const now = clock();
    const slot = `${event}:${kind}`;
    const previous = peer.logWindows.get(slot);
    if (previous && now - previous.at < LOG_WINDOW_MS) {
      previous.suppressed += 1;
      return;
    }
    log(event, previous?.suppressed ? { ...fields, suppressed: previous.suppressed } : fields);
    peer.logWindows.set(slot, { at: now, suppressed: 0 });
  };

  const noteRejected = (peer: Peer, reason: RejectReason, fields: Record<string, unknown> = {}) => {
    bump(counters.rejects, reason);
    logThrottled(peer, 'socket_rejected', reason, { reason, ip: peer.tag, ...fields });
  };

  const noteRateLimited = (peer: Peer, scope: RateLimitScope) => {
    bump(counters.rateLimits, scope);
    logThrottled(peer, 'rate_limited', scope, { scope, ip: peer.tag });
  };

  const protocolError = (peer: Peer, kind: ProtocolErrorKind) => {
    counters.protocolErrors[kind] += 1;
    logThrottled(peer, 'protocol_error', kind, { kind, ip: peer.tag });
  };

  const metrics = (): OnlineServerMetrics => {
    const byPhase = { waiting: 0, active: 0, finished: 0 };
    rooms.forEach((room) => { byPhase[phaseOf(room)] += 1; });
    return {
      rooms: byPhase,
      sockets: { seated: sessions.size, seatless: connections.size - sessions.size },
      ...(JSON.parse(JSON.stringify(counters)) as OnlineServerCounters),
    };
  };

  const http: HttpServer = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, rooms: rooms.size, sockets: connections.size }));
      return;
    }
    if (request.url === '/metrics' && metricsToken) {
      if (!bearerMatches(request.headers.authorization, metricsToken)) {
        response.writeHead(401, { 'www-authenticate': 'Bearer' });
        response.end();
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify(metrics()));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  /** What the client's address counts against: itself, and its /48 when it is IPv6. */
  const peersOf = (request: IncomingMessage): { peer: Peer; site: Peer | null } => {
    const now = clock();
    const address = clientAddress(request, clientIpSource);
    const site = siteKey(address);
    return {
      peer: peers.get(addressKey(address), now),
      site: site === null ? null : sites.get(site, now),
    };
  };

  const originAllowed = (origin: string | undefined): boolean => {
    // Browsers always send Origin; a client that omits it could forge one anyway.
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    return !!normalized && (allowedOrigins.includes(normalized)
      || (allowLocalhostOrigins && isLocalhostOrigin(normalized)));
  };

  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: {
      // Active patches are only a few KB. Avoid paying zlib/context costs on
      // every 20 Hz update; larger full-state syncs still compress.
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
      concurrencyLimit: 4,
      threshold: 4 * 1024,
      zlibDeflateOptions: { level: 3 },
    },
    verifyClient: ({ origin, req }, done) => {
      if (options.debugClientIp) {
        // Raw addresses, on purpose: only while choosing CLIENT_IP_SOURCE.
        log('client_ip_debug', {
          xForwardedFor: req.headers['x-forwarded-for'] ?? null,
          cfConnectingIp: req.headers['cf-connecting-ip'] ?? null,
          trueClientIp: req.headers['true-client-ip'] ?? null,
          remoteAddress: req.socket.remoteAddress ?? null,
        });
      }
      const { peer } = peersOf(req);
      if (!originAllowed(origin)) {
        noteRejected(peer, 'origin', { origin: String(origin).slice(0, 200) });
        done(false, 403, 'Origin not allowed');
        return;
      }
      if (draining) {
        noteRejected(peer, 'draining');
        done(false, 503, 'Server restarting');
        return;
      }
      // The connect rate is checked once upgraded: a browser shows a refused
      // handshake only as a failed connection, so it could not say why.
      done(true);
    },
  });

  const clearRoomTimers = (room: Room) => {
    if (room.tickTimer) clearInterval(room.tickTimer);
    if (room.resultTimer) clearTimeout(room.resultTimer);
    if (room.resumeTimer) clearTimeout(room.resumeTimer);
    room.tickTimer = null;
    room.resultTimer = null;
    room.resumeTimer = null;
  };

  const closeRoom = (room: Room, reason: RoomCloseReason, detail: RoomClosedDetail) => {
    if (!rooms.delete(room.id)) return;
    clearRoomTimers(room);
    const now = Date.now();
    tombstones.set(room.id, { reason, detail, closedAt: now });
    if (tombstones.size > MAX_TOMBSTONES) tombstones.delete(tombstones.keys().next().value);
    room.owner.rooms -= 1;
    if (room.ownerSite) room.ownerSite.rooms -= 1;
    bump(counters.roomsClosed, detail);
    log('room_closed', {
      room: room.ref,
      // Once the room is gone its code is no longer a join secret.
      code: room.id,
      reason,
      detail,
      ageMs: now - room.createdAt,
      ...(room.startedAt === null
        ? {}
        : { durationMs: (room.finishedAt ?? now) - room.startedAt }),
    });
    room.seats.forEach((seat) => {
      const { socket } = seat;
      if (!socket) return;
      sessions.delete(socket);
      send(socket, { type: 'room-closed', reason, detail });
      socket.close(reason === 'server' ? 1001 : 1000, 'Room closed');
    });
  };

  const publishState = (
    room: Room,
    before: GameEngineState | null,
    forceFull = false
  ) => {
    if (!room.state) return;
    room.seats.forEach((seat) => {
      // Nothing changed and the ack did not move: no snapshot, and no drop
      // that would force a full resync of a paused or finished room.
      if (
        !forceFull
        && !seat.needsFullSnapshot
        && before === room.state
        && seat.sentAck === seat.lastAppliedSeq
      ) return;
      const message = snapshotForDelivery(
        seat,
        before,
        room.state!,
        seat.lastAppliedSeq,
        seat.socket?.bufferedAmount ?? 0,
        maxSnapshotBufferBytes,
        forceFull
      );
      if (!message) {
        seat.droppedSnapshots += 1;
        counters.snapshotDrops += 1;
        return;
      }
      // An empty patch with the same ack tells the seat nothing.
      if (
        message.patch
        && Object.keys(message.patch).length === 0
        && message.ack === seat.sentAck
      ) return;
      send(seat.socket, message);
      seat.sentAck = message.ack;
      if (message.state && seat.droppedSnapshots > 0) {
        counters.resyncs += 1;
        const connection = seat.socket ? connections.get(seat.socket) : undefined;
        if (connection) {
          logThrottled(connection.peer, 'snapshot_resync', 'resync', {
            room: room.ref,
            seat: seat.seat,
            dropped: seat.droppedSnapshots,
            ip: connection.peer.tag,
          });
        }
        seat.droppedSnapshots = 0;
      }
    });
  };

  const reduce = (room: Room, action: GameAction): void => {
    room.state = gameReducer(room.state, action);
  };

  const scheduleRoundAdvance = (room: Room): void => {
    if (
      room.resultTimer
      || room.state?.phase !== 'round_end'
      || !room.seats.every((seat) => seat.connected)
    ) return;
    room.resultTimer = setTimeout(() => {
      room.resultTimer = null;
      const result = room.state;
      if (
        !result
        || result.phase !== 'round_end'
        || !room.seats.every((seat) => seat.connected)
      ) return;
      reduce(room, { type: 'DISMISS_DIALOG' });
      publishState(room, result, true);
    }, roundResultMs);
  };

  const finishMatch = (room: Room) => {
    const now = Date.now();
    room.finishedAt = now;
    const durationMs = now - (room.startedAt ?? now);
    counters.matchesFinished += 1;
    counters.matchDurationMs.count += 1;
    counters.matchDurationMs.sum += durationMs;
    counters.matchDurationMs.max = Math.max(counters.matchDurationMs.max, durationMs);
    log('room_finished', { room: room.ref, durationMs });
  };

  const tickRoom = (room: Room): void => {
    const before = room.state;
    if (!before) return;

    room.seats.forEach((seat) => {
      const queued = seat.queue.splice(0);
      queued.forEach((message) => {
        if (message.seq <= seat.lastAppliedSeq) return;
        seat.lastAppliedSeq = message.seq;
        if (message.direction !== undefined) {
          const nextDirection = message.direction ?? null;
          seat.fallbackDirection = message.fallbackDirection ?? null;
          if (nextDirection && nextDirection !== seat.direction) {
            reduce(room, {
              type: 'MOVE',
              playerId: seat.playerId,
              direction: nextDirection,
              fallbackDirection: seat.fallbackDirection ?? undefined,
            });
            seat.moveAccumulatorMs = 0;
          }
          seat.direction = nextDirection;
        }
        if (message.action) reduce(room, actionFor(seat.playerId, message.action));
      });
    });

    if (room.state?.phase === 'playing' && !room.state.paused) {
      reduce(room, { type: 'TICK', deltaMs: TICK_MS });
      room.seats.forEach((seat) => {
        if (!room.state || !seat.direction) return;
        const player = room.state.players[seat.seat];
        if (!player?.alive) {
          seat.direction = null;
          seat.moveAccumulatorMs = 0;
          return;
        }
        const repeatMs = playerRepeatMs(player);
        seat.moveAccumulatorMs += TICK_MS;
        const steps = Math.min(3, Math.floor(seat.moveAccumulatorMs / repeatMs));
        for (let step = 0; step < steps; step += 1) {
          reduce(room, {
            type: 'MOVE',
            playerId: seat.playerId,
            direction: seat.direction,
            fallbackDirection: seat.fallbackDirection ?? undefined,
          });
        }
        seat.moveAccumulatorMs -= steps * repeatMs;
      });
    }

    if (!room.state) return;
    publishState(room, before);
    if (before.phase === 'playing' && room.state.phase === 'round_end') {
      log('round_end', { room: room.ref, round: room.state.round });
      scheduleRoundAdvance(room);
    }
    if (room.state.phase !== 'game_over') return;
    if (before.phase !== 'game_over') finishMatch(room);
    // Nothing moves after the result, so stop ticking until a rematch, but
    // only once a reader that fell behind has been sent the final state.
    if (room.tickTimer && room.seats.every((seat) => !seat.socket || !seat.needsFullSnapshot)) {
      clearInterval(room.tickTimer);
      room.tickTimer = null;
    }
  };

  const startMatch = (room: Room) => {
    room.config = createConfig(room);
    room.state = gameReducer(null, { type: 'INIT', config: room.config });
    const now = Date.now();
    room.startedAt = now;
    room.finishedAt = null;
    room.lastInputAt = now;
    room.seats.forEach((seat) => {
      seat.queue = [];
      seat.direction = null;
      seat.fallbackDirection = null;
      seat.moveAccumulatorMs = 0;
      seat.lastAppliedSeq = -1;
      seat.sentAck = null;
      seat.ready = false;
      send(seat.socket, {
        type: 'start', roomId: room.id, playerId: seat.playerId, config: room.config!,
      });
    });
    publishState(room, null, true);
    // A rematch restarts the tick that finishing the last match stopped.
    if (!room.tickTimer) room.tickTimer = setInterval(() => tickRoom(room), tickIntervalMs);
    counters.matchesStarted += 1;
    log('room_started', {
      room: room.ref, players: room.seats.length, roomMode: room.roomMode, stageId: room.stageId,
    });
  };

  const markSeated = (socket: WebSocket) => {
    const connection = connections.get(socket);
    if (!connection) return;
    connection.seated = true;
    if (connection.unseatedTimer) clearTimeout(connection.unseatedTimer);
    connection.unseatedTimer = null;
  };

  const addSeat = (
    room: Room,
    socket: WebSocket,
    name: string,
    characterId: CharacterId
  ): Seat | null => {
    if (room.state) return null;
    if (room.seats.length >= ONLINE_ROOM_CAPACITY) return null;
    const seatIndex = room.seats.length;
    const seat: Seat = {
      seat: seatIndex,
      playerId: `player${seatIndex + 1}`,
      token: seatToken(bootId),
      name: name.trim(),
      characterId,
      ready: false,
      connected: true,
      socket,
      queue: [],
      lastAppliedSeq: -1,
      direction: null,
      fallbackDirection: null,
      moveAccumulatorMs: 0,
      needsFullSnapshot: true,
      awaySince: null,
      sentAck: null,
      droppedSnapshots: 0,
    };
    room.seats.push(seat);
    sessions.set(socket, { room, seat });
    markSeated(socket);
    log('seat_joined', { room: room.ref, seat: seat.seat, ip: connections.get(socket)?.peer.tag });
    send(socket, {
      type: 'welcome',
      roomId: room.id,
      seat: seat.seat,
      playerId: seat.playerId,
      token: seat.token,
    });
    broadcast(room, lobbyMessage(room));
    broadcast(room, {
      type: 'peer', seat: seat.seat, connected: true, graceMsLeft: limits.reconnectGraceMs,
    });
    return seat;
  };

  const scheduleResume = (room: Room) => {
    if (room.resumeTimer) clearTimeout(room.resumeTimer);
    room.resumeTimer = setTimeout(() => {
      room.resumeTimer = null;
      if (
        room.state?.phase !== 'playing'
        || !room.seats.every((item) => item.connected)
      ) return;
      const before = room.state;
      reduce(room, { type: 'RESUME' });
      publishState(room, before, true);
    }, resumeDelayMs);
  };

  const reconnect = (room: Room, seat: Seat, socket: WebSocket) => {
    const replaced = seat.socket && seat.socket !== socket ? seat.socket : null;
    if (replaced) {
      sessions.delete(replaced);
      // Say why before closing: a tab that only sees the close would resume again.
      send(replaced, { type: 'error', code: 'seat-expired', reason: 'replaced' });
      replaced.close(CLOSE_REPLACED, 'Session replaced');
      bump(counters.resumeFailures, 'replaced');
    }
    const awayMs = seat.awaySince === null ? 0 : Date.now() - seat.awaySince;
    seat.awaySince = null;
    seat.socket = socket;
    seat.connected = true;
    seat.needsFullSnapshot = true;
    seat.droppedSnapshots = 0;
    // A new input stream: a reloaded or duplicated tab numbers its inputs
    // from zero again, and the replaced tab's queued input and held key are
    // not this one's.
    seat.queue = [];
    seat.lastAppliedSeq = -1;
    seat.direction = null;
    seat.fallbackDirection = null;
    seat.moveAccumulatorMs = 0;
    sessions.set(socket, { room, seat });
    markSeated(socket);
    counters.reconnects += 1;
    log('seat_reconnected', {
      room: room.ref, seat: seat.seat, awayMs, replaced: !!replaced,
    });
    send(socket, {
      type: 'welcome',
      roomId: room.id,
      seat: seat.seat,
      playerId: seat.playerId,
      token: seat.token,
    });
    broadcast(room, lobbyMessage(room));
    if (room.state && room.config) {
      send(socket, {
        type: 'start', roomId: room.id, playerId: seat.playerId, config: room.config,
      });
      send(socket, {
        type: 'snapshot', tick: room.state.tick, ack: seat.lastAppliedSeq, state: room.state,
      });
      seat.needsFullSnapshot = false;
      seat.sentAck = seat.lastAppliedSeq;
      if (room.state.phase === 'round_end') scheduleRoundAdvance(room);
      if (room.state.phase === 'playing') scheduleResume(room);
    }
  };

  const detach = (socket: WebSocket) => {
    const session = sessions.get(socket);
    sessions.delete(socket);
    if (!session || session.seat.socket !== socket) return;
    const { room, seat } = session;
    seat.socket = null;
    seat.connected = false;
    seat.direction = null;
    seat.queue = [];
    seat.awaySince = Date.now();
    if (room.resultTimer) clearTimeout(room.resultTimer);
    room.resultTimer = null;
    if (room.resumeTimer) clearTimeout(room.resumeTimer);
    room.resumeTimer = null;
    counters.disconnects += 1;
    log('seat_disconnected', { room: room.ref, seat: seat.seat, phase: phaseOf(room) });
    broadcast(room, lobbyMessage(room));
    broadcast(room, {
      type: 'peer', seat: seat.seat, connected: false, graceMsLeft: limits.reconnectGraceMs,
    });
    // The sweep ends the seat, or the room, once the grace runs out.
    if (phaseOf(room) === 'active') {
      const before = room.state;
      reduce(room, { type: 'PAUSE' });
      publishState(room, before, true);
    }
  };

  const removeLobbyGuest = (room: Room, seat: Seat): void => {
    const { socket } = seat;
    if (socket) sessions.delete(socket);
    room.seats.splice(seat.seat, 1);
    room.seats.forEach((remaining, index) => {
      remaining.seat = index;
      remaining.playerId = `player${index + 1}`;
      send(remaining.socket, {
        type: 'welcome',
        roomId: room.id,
        seat: remaining.seat,
        playerId: remaining.playerId,
        token: remaining.token,
      });
    });
    broadcast(room, lobbyMessage(room));
    socket?.close(1000, 'Left room');
  };

  /** Ends whatever a room's phase says has run out; rooms never hold their own expiry timer. */
  const sweepRoom = (room: Room, now: number) => {
    const ageMs = now - room.createdAt;
    const awayPastGrace = (seat: Seat) => (
      seat.awaySince !== null && now - seat.awaySince > limits.reconnectGraceMs
    );
    if (ageMs > limits.maxRoomAgeMs) {
      closeRoom(room, 'timeout', 'max-age');
      return;
    }
    const phase = phaseOf(room);
    if (phase !== 'waiting') {
      // A rematch needs every seat, so a finished room waits on a dropped
      // seat no longer than a running match does.
      const away = room.seats.find(awayPastGrace);
      if (away) {
        log('seat_expired', { room: room.ref, seat: away.seat });
        closeRoom(room, 'timeout', 'seat-timeout');
      } else if (phase === 'finished') {
        if (now - (room.finishedAt ?? now) > limits.finishedRoomTtlMs) {
          closeRoom(room, 'timeout', 'finished');
        }
      } else if (now - room.lastInputAt > limits.idleRoomMs) {
        closeRoom(room, 'timeout', 'idle');
      }
      return;
    }
    if (ageMs > limits.lobbyTtlMs) {
      closeRoom(room, 'timeout', 'lobby-expired');
      return;
    }
    if (room.seats.every((seat) => !seat.connected)) {
      // Nobody is left to tell; give a reloading host the longer window.
      const lastLeftAt = Math.max(...room.seats.map((seat) => seat.awaySince ?? now));
      if (now - lastLeftAt > limits.emptyRoomTtlMs) closeRoom(room, 'timeout', 'empty');
      return;
    }
    if (awayPastGrace(room.seats[0])) {
      // Guests are waiting on a host who is gone: release them.
      closeRoom(room, 'left', 'host-left');
      return;
    }
    room.seats.filter((seat) => seat.seat > 0 && awayPastGrace(seat)).forEach((seat) => {
      log('seat_expired', { room: room.ref, seat: seat.seat });
      removeLobbyGuest(room, seat);
    });
  };

  const rateAllowed = (connection: Connection): boolean => {
    const now = Date.now();
    const { rate } = connection;
    if (now - rate.startedAt >= 1000) {
      rate.startedAt = now;
      rate.count = 1;
      return true;
    }
    rate.count += 1;
    return rate.count <= limits.messagesPerSecond;
  };

  const rateLimited = (socket: WebSocket, peer: Peer, scope: RateLimitScope) => {
    noteRateLimited(peer, scope);
    send(socket, { type: 'error', code: 'rate-limited' });
  };

  const refuseCreate = (
    socket: WebSocket,
    peer: Peer,
    code: 'server-busy' | 'too-many-rooms',
    reason: RejectReason
  ) => {
    bump(counters.rejects, reason);
    logThrottled(peer, 'create_rejected', reason, { reason, ip: peer.tag });
    send(socket, { type: 'error', code });
  };

  /** Spends one guess from the address, and from its /48. */
  const spendGuess = ({ peer, site }: Connection) => {
    const now = clock();
    peer.joinFail.take(now);
    site?.joinFail.take(now);
  };

  const failJoin = (
    socket: WebSocket,
    connection: Connection,
    code: 'room-not-found' | 'match-started' | 'room-full'
  ) => {
    // Only an unknown code is a guess. A full or started room proves the
    // code right, and classmates behind one router may all try it.
    if (code === 'room-not-found') spendGuess(connection);
    send(socket, { type: 'error', code });
  };

  const resumeFailure = (roomId: string, resumeToken: string, roomIsLive: boolean) => {
    const failure: ResumeFailure = { reason: 'room-closed' };
    if (!resumeToken.startsWith(bootId)) failure.reason = 'server-restarted';
    else if (roomIsLive) failure.reason = 'seat-not-found';
    else {
      const tombstone = tombstones.get(roomId);
      if (tombstone) failure.detail = tombstone.detail;
    }
    return failure;
  };

  const handleUnseated = (socket: WebSocket, connection: Connection, message: ClientMessage) => {
    const { peer, site } = connection;
    if (message.type === 'create') {
      if (draining || rooms.size >= limits.maxRooms) {
        refuseCreate(socket, peer, 'server-busy', draining ? 'draining' : 'max-rooms');
        return;
      }
      if (peer.rooms >= limits.maxRoomsPerIp) {
        refuseCreate(socket, peer, 'too-many-rooms', 'max-rooms-per-ip');
        return;
      }
      if (site && site.rooms >= limits.maxRoomsPerIp * IPV6_SITE_FACTOR) {
        refuseCreate(socket, site, 'too-many-rooms', 'max-rooms-per-site');
        return;
      }
      const now = clock();
      if (peer.lastCreateAt !== null && now - peer.lastCreateAt < limits.createCooldownMs) {
        rateLimited(socket, peer, 'create-cooldown');
        return;
      }
      if (!peer.create.take(now)) {
        rateLimited(socket, peer, 'create');
        return;
      }
      peer.lastCreateAt = now;
      let id = roomCode();
      while (rooms.has(id) || tombstones.has(id)) id = roomCode();
      const createdAt = Date.now();
      const room: Room = {
        id,
        ref: randomBytes(4).toString('hex'),
        owner: peer,
        ownerSite: site,
        roomMode: message.roomMode,
        stageId: message.stageId,
        arenaMapId: message.roomMode === 'arena'
          ? message.arenaMapId ?? message.stageId
          : message.stageId,
        totalRounds: message.totalRounds,
        seats: [],
        state: null,
        config: null,
        tickTimer: null,
        resultTimer: null,
        resumeTimer: null,
        createdAt,
        startedAt: null,
        finishedAt: null,
        lastInputAt: createdAt,
      };
      rooms.set(id, room);
      peer.rooms += 1;
      if (site) site.rooms += 1;
      counters.roomsCreated += 1;
      log('room_created', {
        room: room.ref,
        roomMode: room.roomMode,
        stageId: room.stageId,
        arenaMapId: room.arenaMapId,
        totalRounds: room.totalRounds,
        ip: peer.tag,
      });
      addSeat(room, socket, message.name, message.characterId);
      return;
    }
    // Joins with an unknown code and failed resumes spend one bucket per
    // address, and one per IPv6 /48. Once either is empty even a right
    // guess is refused, so codes cannot be probed faster than it refills.
    // A resume with a real seat token is never a guess.
    const refuseGuess = () => {
      const now = clock();
      if (peer.joinFail.has(now) && (!site || site.joinFail.has(now))) return false;
      rateLimited(socket, peer, 'join');
      socket.close(1008, 'Rate limited');
      return true;
    };
    if (message.type === 'join') {
      if (refuseGuess()) return;
      const room = rooms.get(message.roomId);
      if (!room) {
        failJoin(socket, connection, 'room-not-found');
        return;
      }
      if (room.state) {
        failJoin(socket, connection, 'match-started');
        return;
      }
      if (!addSeat(room, socket, message.name, message.characterId)) {
        failJoin(socket, connection, 'room-full');
      }
      return;
    }
    if (message.type === 'resume-session') {
      const room = rooms.get(message.roomId);
      const seat = room?.seats.find((item) => item.token === message.token);
      if (room && seat) {
        reconnect(room, seat, socket);
        return;
      }
      if (refuseGuess()) return;
      const failure = resumeFailure(message.roomId, message.token, !!room);
      spendGuess(connection);
      bump(counters.resumeFailures, failure.reason);
      log('resume_failed', { ...failure, ip: peer.tag });
      // Always 'seat-expired', which every client already treats as final.
      send(socket, { type: 'error', code: 'seat-expired', ...failure });
      return;
    }
    protocolError(peer, 'state');
    send(socket, { type: 'error', code: 'bad-message' });
  };

  const handleSeated = (
    room: Room,
    seat: Seat,
    message: ClientMessage,
    peer: Peer
  ) => {
    if (message.type === 'selection' && !room.state) {
      seat.characterId = message.characterId;
      seat.ready = false;
      broadcast(room, lobbyMessage(room));
      return;
    }
    if (message.type === 'ready' && !room.state) {
      seat.ready = message.ready;
      broadcast(room, lobbyMessage(room));
      return;
    }
    if (message.type === 'start-match' && !room.state) {
      if (seat.seat !== 0) {
        send(seat.socket, { type: 'error', code: 'not-host' });
        return;
      }
      if (room.seats.length < MIN_ROOM_PLAYERS) {
        send(seat.socket, { type: 'error', code: 'not-enough-players' });
        return;
      }
      if (!room.seats.every((item) => item.connected && item.ready)) {
        send(seat.socket, { type: 'error', code: 'not-ready' });
        return;
      }
      startMatch(room);
      return;
    }
    if (message.type === 'input' && room.state) {
      // A finished room no longer ticks, so its input would only pile up.
      if (room.state.phase === 'game_over') return;
      if (message.seq > seat.lastAppliedSeq) seat.queue.push(message);
      room.lastInputAt = Date.now();
      return;
    }
    if (message.type === 'rematch' && room.state?.phase === 'game_over') {
      seat.ready = message.ready;
      broadcast(room, lobbyMessage(room));
      if (room.seats.every((item) => item.ready)) {
        room.state = null;
        room.seats.forEach((item) => { item.ready = false; });
        startMatch(room);
      }
      return;
    }
    if (message.type === 'leave') {
      if (!room.state && seat.seat !== 0) {
        log('seat_left', { room: room.ref, seat: seat.seat });
        removeLobbyGuest(room, seat);
      } else {
        closeRoom(room, 'left', room.state ? 'player-left' : 'host-left');
      }
      return;
    }
    protocolError(peer, 'state');
    send(seat.socket, { type: 'error', code: 'bad-message' });
  };

  /** Answers a socket over a cap or rate with why, then closes it. */
  const turnAway = (
    socket: WebSocket,
    code: 'server-busy' | 'too-many-connections' | 'rate-limited',
    closeCode: number
  ) => {
    // A bad frame before the close completes must not crash the process.
    socket.on('error', () => undefined);
    send(socket, { type: 'error', code });
    socket.close(closeCode, code);
  };

  wss.on('connection', (socket, request) => {
    const { peer, site } = peersOf(request);
    if (!peer.connect.take(clock())) {
      noteRateLimited(peer, 'connect');
      turnAway(socket, 'rate-limited', 1008);
      return;
    }
    if (connections.size >= limits.maxSockets) {
      noteRejected(peer, 'max-sockets');
      turnAway(socket, 'server-busy', 1013);
      return;
    }
    if (peer.sockets >= limits.maxSocketsPerIp) {
      noteRejected(peer, 'max-sockets-per-ip');
      turnAway(socket, 'too-many-connections', 1008);
      return;
    }
    if (site && site.sockets >= limits.maxSocketsPerIp * IPV6_SITE_FACTOR) {
      noteRejected(site, 'max-sockets-per-site');
      turnAway(socket, 'too-many-connections', 1008);
      return;
    }
    const openedAt = Date.now();
    const connection: Connection = {
      peer,
      site,
      openedAt,
      seated: false,
      unseatedTimer: setTimeout(() => {
        connection.unseatedTimer = null;
        if (!sessions.has(socket)) socket.close(CLOSE_UNSEATED, 'No seat taken');
      }, limits.unseatedTimeoutMs),
      rate: { startedAt: openedAt, count: 0 },
    };
    peer.sockets += 1;
    if (site) site.sockets += 1;
    connections.set(socket, connection);
    liveSockets.set(socket, true);
    log('socket_open', { ip: peer.tag, sockets: connections.size });
    socket.on('pong', () => liveSockets.set(socket, true));
    socket.on('message', (data: RawData) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (!rateAllowed(connection)) {
        rateLimited(socket, peer, 'message');
        socket.close(1008, 'Rate limited');
        return;
      }
      const message = parseClientMessage(data.toString());
      if (!message) {
        let mismatch = false;
        try {
          const envelope = JSON.parse(data.toString());
          mismatch = envelope
            && ['create', 'join', 'resume-session'].includes(envelope.type)
            && (envelope.protocol !== PROTOCOL_VERSION
              || envelope.simulation !== SIMULATION_VERSION);
        } catch {
          mismatch = false;
        }
        protocolError(peer, mismatch ? 'version' : 'parse');
        send(socket, { type: 'error', code: mismatch ? 'upgrade-required' : 'bad-message' });
        socket.close(1008, 'Bad message');
        return;
      }
      const session = sessions.get(socket);
      if (session) handleSeated(session.room, session.seat, message, peer);
      else handleUnseated(socket, connection, message);
    });
    socket.on('close', (code: number) => {
      if (connection.unseatedTimer) clearTimeout(connection.unseatedTimer);
      connection.unseatedTimer = null;
      connections.delete(socket);
      peer.sockets -= 1;
      if (site) site.sockets -= 1;
      detach(socket);
      const abnormal = code === 1006;
      if (abnormal) counters.abnormalCloses += 1;
      log('socket_closed', {
        ip: peer.tag, code, abnormal, seated: connection.seated, durationMs: Date.now() - openedAt,
      });
    });
    // ws reports a malformed or oversized frame here, then closes the socket.
    socket.on('error', () => {
      protocolError(peer, 'frame');
      detach(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? 8787, options.host ?? '127.0.0.1', () => resolve());
  });
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 8787;

  const keepaliveTimer = setInterval(() => {
    wss.clients.forEach((socket) => {
      if (!liveSockets.get(socket)) {
        socket.terminate();
        return;
      }
      liveSockets.set(socket, false);
      socket.ping();
    });
  }, KEEPALIVE_MS);

  const sweepTimer = setInterval(() => {
    const now = Date.now();
    Array.from(rooms.values()).forEach((room) => sweepRoom(room, now));
    // Tombstones are kept in closing order, so the stale ones come first.
    Array.from(tombstones).some(([roomId, tombstone]) => {
      if (now - tombstone.closedAt < TOMBSTONE_MS) return true;
      tombstones.delete(roomId);
      return false;
    });
    peers.prune(clock());
    sites.prune(clock());
  }, sweepIntervalMs);

  log('server_started', {
    port,
    clientIpSource,
    allowedOrigins,
    allowLocalhostOrigins,
    metrics: !!metricsToken,
    debugClientIp: !!options.debugClientIp,
    limits,
  });

  const shutdown = (signal = 'close'): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    draining = true;
    log('server_shutdown', {
      signal, rooms: rooms.size, sockets: connections.size, graceMs: limits.shutdownGraceMs,
    });
    clearInterval(keepaliveTimer);
    clearInterval(sweepTimer);
    const httpClosed = new Promise<void>((resolve) => {
      http.close(() => resolve());
    });
    Array.from(rooms.values()).forEach((room) => closeRoom(room, 'server', 'restart'));
    // Seatless sockets, and any socket a cap was already turning away.
    wss.clients.forEach((socket) => socket.close(1001, 'Server restarting'));
    const wssClosed = new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
    const forceTimer = setTimeout(() => {
      wss.clients.forEach((socket) => socket.terminate());
      http.closeAllConnections();
    }, limits.shutdownGraceMs);
    shutdownPromise = Promise.all([wssClosed, httpClosed]).then(() => {
      clearTimeout(forceTimer);
    });
    return shutdownPromise;
  };

  return {
    port,
    roomCount: () => rooms.size,
    getRoomState: (roomId) => rooms.get(roomId)?.state ?? null,
    metrics,
    shutdown,
    close: () => shutdown(),
  };
}
