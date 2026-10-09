/* eslint-disable no-param-reassign -- rooms and seats are mutable server actors. */
/* eslint-disable no-console */
import { randomBytes, randomInt } from 'node:crypto';
import { createServer, Server as HttpServer } from 'node:http';
import WebSocket, { RawData, WebSocketServer } from 'ws';
import { defaultMap } from '../src/constants/contants';
import { GameAction } from '../src/engine/actions';
import { TICK_MS } from '../src/engine/constants';
import { gameReducer } from '../src/engine/reducer';
import {
  Direction, GameConfig, GameEngineState, PlayerState,
} from '../src/engine/types';
import { CharacterId } from '../src/content/types';
import {
  ClientMessage,
  MAX_CLIENT_MESSAGE_BYTES,
  OnlineAction,
  OnlinePlayer,
  PROTOCOL_VERSION,
  SIMULATION_VERSION,
  ServerMessage,
  parseClientMessage,
  serializeMessage,
} from '../src/network/protocol';
import { GameMap, gameItem } from '../src/model/gameItem';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const MAX_ROOMS = 100;
const MAX_MESSAGES_PER_SECOND = 60;
const RECONNECT_GRACE_MS = 20_000;
const ROUND_RESULT_MS = 4_000;
const EMPTY_ROOM_TTL_MS = 60_000;
const LOBBY_TTL_MS = 10 * 60_000;
const KEEPALIVE_MS = 15_000;
const MOVE_REPEAT_MS = 28;
const FAST_MOVE_REPEAT_MS = 18;
const ONLINE_STAGE = 'hiddenLeaf' as const;

type InputMessage = Extract<ClientMessage, { type: 'input' }>;

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
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

type Room = {
  id: string;
  seats: Seat[];
  state: GameEngineState | null;
  config: GameConfig | null;
  tickTimer: ReturnType<typeof setInterval> | null;
  resultTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  createdAt: number;
};

type SocketRate = { startedAt: number; count: number };

export type OnlineServer = {
  port: number;
  roomCount: () => number;
  getRoomState: (roomId: string) => GameEngineState | null;
  close: () => Promise<void>;
};

export type OnlineServerOptions = {
  port?: number;
  host?: string;
  allowedOrigins?: string[];
  reconnectGraceMs?: number;
  emptyRoomTtlMs?: number;
  roundResultMs?: number;
  tickIntervalMs?: number;
};

function onlineMap(): GameMap {
  return defaultMap.map((row) => row.map((cell): gameItem => {
    if (cell === 'W') return 'Wall';
    if (cell === 'B') return 'Box';
    return 'Empty';
  }));
}

function roomCode(): string {
  return Array.from({ length: ROOM_CODE_LENGTH }, () => (
    ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]
  )).join('');
}

function token(): string {
  return randomBytes(16).toString('hex');
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
    type: 'lobby', roomId: room.id, stageId: ONLINE_STAGE, players: roomPlayers(room),
  };
}

function broadcast(room: Room, message: ServerMessage): void {
  room.seats.forEach((seat) => send(seat.socket, message));
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

function createConfig(room: Room): GameConfig {
  return {
    mode: 'onlinePreview',
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: 'online-arena',
    stageId: ONLINE_STAGE,
    map: onlineMap(),
    selectedCharacters: room.seats.map((seat) => seat.characterId),
    playerNames: room.seats.map((seat) => seat.name),
    seed: randomInt(1, 2_147_483_646),
  };
}

function originAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export async function startOnlineServer(
  options: OnlineServerOptions = {}
): Promise<OnlineServer> {
  const rooms = new Map<string, Room>();
  const sessions = new Map<WebSocket, { room: Room; seat: Seat }>();
  const rates = new Map<WebSocket, SocketRate>();
  const liveSockets = new WeakMap<WebSocket, boolean>();
  const allowedOrigins = options.allowedOrigins ?? [];
  const reconnectGraceMs = options.reconnectGraceMs ?? RECONNECT_GRACE_MS;
  const emptyRoomTtlMs = options.emptyRoomTtlMs ?? EMPTY_ROOM_TTL_MS;
  const roundResultMs = options.roundResultMs ?? ROUND_RESULT_MS;
  const tickIntervalMs = options.tickIntervalMs ?? TICK_MS;

  const http: HttpServer = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    response.writeHead(404);
    response.end();
  });

  const wss = new WebSocketServer({
    server: http,
    maxPayload: MAX_CLIENT_MESSAGE_BYTES,
    perMessageDeflate: true,
    verifyClient: ({ origin }, done) => {
      if (originAllowed(origin, allowedOrigins)) done(true);
      else done(false, 403, 'Origin not allowed');
    },
  });

  const clearRoomTimers = (room: Room) => {
    if (room.tickTimer) clearInterval(room.tickTimer);
    if (room.resultTimer) clearTimeout(room.resultTimer);
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.seats.forEach((seat) => {
      if (seat.reconnectTimer) clearTimeout(seat.reconnectTimer);
    });
  };

  const closeRoom = (room: Room, reason: 'left' | 'timeout' | 'server') => {
    if (!rooms.delete(room.id)) return;
    clearRoomTimers(room);
    room.seats.forEach((seat) => {
      const { socket } = seat;
      if (!socket) return;
      sessions.delete(socket);
      send(socket, { type: 'room-closed', reason });
      socket.close(1000, 'Room closed');
    });
  };

  const scheduleEmptyCleanup = (room: Room) => {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    if (room.seats.some((seat) => seat.connected)) return;
    room.cleanupTimer = setTimeout(() => closeRoom(room, 'timeout'), emptyRoomTtlMs);
  };

  const publishState = (
    room: Room,
    before: GameEngineState | null,
    forceFull = false
  ) => {
    if (!room.state) return;
    const patch = before && !forceFull ? statePatch(before, room.state) : undefined;
    room.seats.forEach((seat) => send(seat.socket, {
      type: 'snapshot',
      tick: room.state!.tick,
      ack: seat.lastAppliedSeq,
      ...(patch ? { patch } : { state: room.state! }),
    }));
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
      scheduleRoundAdvance(room);
    }
  };

  const startMatch = (room: Room) => {
    room.config = createConfig(room);
    room.state = gameReducer(null, { type: 'INIT', config: room.config });
    room.seats.forEach((seat) => {
      seat.queue = [];
      seat.direction = null;
      seat.fallbackDirection = null;
      seat.moveAccumulatorMs = 0;
      seat.lastAppliedSeq = -1;
      seat.ready = false;
      send(seat.socket, {
        type: 'start', roomId: room.id, playerId: seat.playerId, config: room.config!,
      });
    });
    publishState(room, null, true);
    if (!room.tickTimer) room.tickTimer = setInterval(() => tickRoom(room), tickIntervalMs);
  };

  const maybeStart = (room: Room) => {
    if (room.state || room.seats.length !== 2) return;
    if (room.seats.every((seat) => seat.connected && seat.ready)) startMatch(room);
  };

  const addSeat = (
    room: Room,
    socket: WebSocket,
    name: string,
    characterId: CharacterId
  ): Seat | null => {
    if (room.state) return null;
    if (room.seats.length >= 2) return null;
    const seatIndex = room.seats.length;
    const seat: Seat = {
      seat: seatIndex,
      playerId: `player${seatIndex + 1}`,
      token: token(),
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
      reconnectTimer: null,
    };
    room.seats.push(seat);
    sessions.set(socket, { room, seat });
    send(socket, {
      type: 'welcome',
      roomId: room.id,
      seat: seat.seat,
      playerId: seat.playerId,
      token: seat.token,
    });
    broadcast(room, lobbyMessage(room));
    broadcast(room, {
      type: 'peer', seat: seat.seat, connected: true, graceMsLeft: reconnectGraceMs,
    });
    return seat;
  };

  const reconnect = (room: Room, seat: Seat, socket: WebSocket) => {
    if (seat.socket && seat.socket !== socket) {
      sessions.delete(seat.socket);
      seat.socket.close(4001, 'Session replaced');
    }
    if (seat.reconnectTimer) clearTimeout(seat.reconnectTimer);
    seat.reconnectTimer = null;
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
    seat.socket = socket;
    seat.connected = true;
    sessions.set(socket, { room, seat });
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
      if (room.state.phase === 'round_end') scheduleRoundAdvance(room);
      if (room.state.phase === 'playing') {
        setTimeout(() => {
          if (
            room.state?.phase !== 'playing'
            || !room.seats.every((item) => item.connected)
          ) return;
          const before = room.state;
          reduce(room, { type: 'RESUME' });
          publishState(room, before, true);
        }, 2000);
      }
    }
  };

  const detach = (socket: WebSocket) => {
    const session = sessions.get(socket);
    sessions.delete(socket);
    rates.delete(socket);
    if (!session || session.seat.socket !== socket) return;
    const { room, seat } = session;
    seat.socket = null;
    seat.connected = false;
    seat.direction = null;
    seat.queue = [];
    if (room.resultTimer) clearTimeout(room.resultTimer);
    room.resultTimer = null;
    broadcast(room, lobbyMessage(room));
    broadcast(room, {
      type: 'peer', seat: seat.seat, connected: false, graceMsLeft: reconnectGraceMs,
    });
    if (room.state) {
      const before = room.state;
      reduce(room, { type: 'PAUSE' });
      publishState(room, before, true);
      seat.reconnectTimer = setTimeout(() => closeRoom(room, 'timeout'), reconnectGraceMs);
    } else {
      scheduleEmptyCleanup(room);
    }
  };

  const rateAllowed = (socket: WebSocket): boolean => {
    const now = Date.now();
    const current = rates.get(socket);
    if (!current || now - current.startedAt >= 1000) {
      rates.set(socket, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= MAX_MESSAGES_PER_SECOND;
  };

  const handleUnseated = (socket: WebSocket, message: ClientMessage) => {
    if (message.type === 'create') {
      if (rooms.size >= MAX_ROOMS) {
        send(socket, { type: 'error', code: 'rate-limited' });
        return;
      }
      let id = roomCode();
      while (rooms.has(id)) id = roomCode();
      const room: Room = {
        id,
        seats: [],
        state: null,
        config: null,
        tickTimer: null,
        resultTimer: null,
        cleanupTimer: null,
        createdAt: Date.now(),
      };
      rooms.set(id, room);
      addSeat(room, socket, message.name, message.characterId);
      room.cleanupTimer = setTimeout(() => {
        if (!room.state) closeRoom(room, 'timeout');
      }, LOBBY_TTL_MS);
      return;
    }
    if (message.type === 'join') {
      const room = rooms.get(message.roomId);
      if (!room) {
        send(socket, { type: 'error', code: 'room-not-found' });
        return;
      }
      if (room.state) {
        send(socket, { type: 'error', code: 'match-started' });
        return;
      }
      if (!addSeat(room, socket, message.name, message.characterId)) {
        send(socket, { type: 'error', code: 'room-full' });
      }
      return;
    }
    if (message.type === 'resume-session') {
      const room = rooms.get(message.roomId);
      const seat = room?.seats.find((item) => item.token === message.token);
      if (!room || !seat) {
        send(socket, { type: 'error', code: 'seat-expired' });
        return;
      }
      reconnect(room, seat, socket);
      return;
    }
    send(socket, { type: 'error', code: 'bad-message' });
  };

  const handleSeated = (
    room: Room,
    seat: Seat,
    message: ClientMessage
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
      maybeStart(room);
      return;
    }
    if (message.type === 'input' && room.state) {
      if (message.seq > seat.lastAppliedSeq) seat.queue.push(message);
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
      closeRoom(room, 'left');
      return;
    }
    send(seat.socket, { type: 'error', code: 'bad-message' });
  };

  wss.on('connection', (socket) => {
    rates.set(socket, { startedAt: Date.now(), count: 0 });
    liveSockets.set(socket, true);
    socket.on('pong', () => liveSockets.set(socket, true));
    socket.on('message', (data: RawData) => {
      if (!rateAllowed(socket)) {
        send(socket, { type: 'error', code: 'rate-limited' });
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
        send(socket, { type: 'error', code: mismatch ? 'upgrade-required' : 'bad-message' });
        socket.close(1008, 'Bad message');
        return;
      }
      const session = sessions.get(socket);
      if (session) handleSeated(session.room, session.seat, message);
      else handleUnseated(socket, message);
    });
    socket.on('close', () => detach(socket));
    socket.on('error', () => detach(socket));
  });

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

  await new Promise<void>((resolve, reject) => {
    http.once('error', reject);
    http.listen(options.port ?? 8787, options.host ?? '127.0.0.1', () => resolve());
  });
  const address = http.address();
  const port = typeof address === 'object' && address ? address.port : options.port ?? 8787;

  return {
    port,
    roomCount: () => rooms.size,
    getRoomState: (roomId) => rooms.get(roomId)?.state ?? null,
    close: async () => {
      clearInterval(keepaliveTimer);
      rooms.forEach((room) => closeRoom(room, 'server'));
      await new Promise<void>((resolve) => {
        wss.close(() => resolve());
      });
      await new Promise<void>((resolve, reject) => {
        http.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}
