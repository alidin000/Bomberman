import { CharacterId, StageId } from '../content/types';
import { GameEngineState } from '../engine/types';
import {
  ClientMessage,
  OnlineAction,
  OnlinePlayer,
  ONLINE_ROOM_CAPACITY,
  OnlineRoomMode,
  OnlineRounds,
  PROTOCOL_VERSION,
  ResumeFailureReason,
  RoomClosedDetail,
  SIMULATION_VERSION,
  ServerMessage,
  parseServerMessage,
  serializeMessage,
} from './protocol';

const STORAGE_KEY = 'shinobiOnlineSeat';
const RECONNECT_DELAYS = [500, 1000, 2000, 4000];
// Longer than the server's default 20 s reconnect grace: a try within the
// grace can still save the seat, and one after it hears why the seat is gone.
const RECONNECT_DEADLINE_MS = 30_000;
// The server closes a socket with this code when another tab takes its seat.
const CLOSE_REPLACED = 4001;
// Several checks a second, so each second of the away countdown shows on
// time whenever its deadline started; the text is published only on change.
const PEER_NOTICE_TICK_MS = 250;

const CONNECT_FAILED = 'Could not connect to the online server.';
const RECONNECTING = 'Connection lost. Rejoining the room...';
const ROOM_CLOSED = 'The room was closed.';
const ROOM_EXPIRED = 'The room expired.';
const SEAT_EXPIRED = 'seat expired';

/** The error once the session stops trying to rejoin; `rejoin()` tries the kept seat again. */
export const RECONNECT_FAILED = 'Could not rejoin the room.';

/**
 * The error for each way a room closes. The screens key their copy by these
 * texts (view/OnlineScreen/onlineCopy); a detail this build does not know
 * falls back to the coarse reason.
 */
export const ROOM_CLOSED_ERRORS: Record<RoomClosedDetail, string> = {
  'host-left': 'The host left the room.',
  'player-left': 'A player left the match.',
  'lobby-expired': ROOM_EXPIRED,
  empty: 'The room closed while everyone was away.',
  'seat-timeout': 'A player did not reconnect in time.',
  idle: 'The match was idle too long.',
  finished: 'The room closed after the match.',
  'max-age': 'The room reached its time limit.',
  restart: 'The server restarted.',
};

/** The error for each reason a resume fails; a close detail, when sent, says more. */
export const RESUME_FAILURE_ERRORS: Record<ResumeFailureReason, string> = {
  'seat-not-found': SEAT_EXPIRED,
  'room-closed': ROOM_CLOSED,
  'server-restarted': ROOM_CLOSED_ERRORS.restart,
  replaced: 'Your seat moved to another tab.',
};

export type OnlineConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'lobby'
  | 'playing'
  | 'reconnecting'
  | 'closed';

export type OnlineSessionSnapshot = {
  status: OnlineConnectionStatus;
  connected: boolean;
  roomId: string;
  seat: number | null;
  playerId: string;
  token: string;
  players: OnlinePlayer[];
  roomMode: OnlineRoomMode;
  stageId: StageId;
  capacity: number;
  totalRounds: OnlineRounds;
  gameState: GameEngineState | null;
  ack: number;
  error: string;
};

type StoredSeat = { roomId: string; token: string };

type SeatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type OnlineSessionOptions = {
  /** The room server's WebSocket URL; by default the one this build was given. */
  url?: string;
  /** The WebSocket class to open sockets with; tests pass the `ws` package's. */
  WebSocket?: typeof WebSocket;
  /** Where the seat outlives a reload: sessionStorage unless a test passes its own. */
  storage?: SeatStorage;
  /** How long to keep trying to rejoin after the connection drops. */
  reconnectDeadlineMs?: number;
};

function emptySnapshot(): OnlineSessionSnapshot {
  return {
    status: 'idle',
    connected: false,
    roomId: '',
    seat: null,
    playerId: '',
    token: '',
    players: [],
    roomMode: 'arena',
    stageId: 'hiddenLeaf',
    capacity: ONLINE_ROOM_CAPACITY,
    totalRounds: 3,
    gameState: null,
    ack: -1,
    error: '',
  };
}

function serverUrl(): string {
  const configured = __GAME_SERVER_URL__.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'http:') url.protocol = 'ws:';
      if (url.protocol === 'https:') url.protocol = 'wss:';
      return url.toString();
    } catch {
      return '';
    }
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://127.0.0.1:8787';
  }
  return '';
}

// Storage is read through a getter: merely touching sessionStorage throws
// in a browser that blocks it, and that must stay inside the try.
function readStoredSeat(storage: () => SeatStorage): StoredSeat | null {
  try {
    const parsed = JSON.parse(storage().getItem(STORAGE_KEY) ?? 'null') as StoredSeat | null;
    return parsed && typeof parsed.roomId === 'string' && typeof parsed.token === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStoredSeat(storage: () => SeatStorage, roomId: string, token: string): void {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify({ roomId, token }));
  } catch {
    // A private tab may reject storage; the live socket still works.
  }
}

function clearStoredSeat(storage: () => SeatStorage): void {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

function resumeMessage(roomId: string, token: string): ClientMessage {
  return {
    type: 'resume-session',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    roomId,
    token,
  };
}

/** `table[key]` for a key the server sent; a newer server may send one this build lacks. */
function knownText<K extends string>(
  table: Record<K, string>,
  key: string | undefined
): string | undefined {
  return key !== undefined && Object.prototype.hasOwnProperty.call(table, key)
    ? table[key as K]
    : undefined;
}

function roomClosedError(message: Extract<ServerMessage, { type: 'room-closed' }>): string {
  return knownText(ROOM_CLOSED_ERRORS, message.detail)
    ?? (message.reason === 'timeout' ? ROOM_EXPIRED : ROOM_CLOSED);
}

function seatExpiredError(message: Extract<ServerMessage, { type: 'error' }>): string {
  return knownText(ROOM_CLOSED_ERRORS, message.detail)
    ?? knownText(RESUME_FAILURE_ERRORS, message.reason)
    ?? SEAT_EXPIRED;
}

export class OnlineSession {
  private snapshot = emptySnapshot();

  private listeners = new Set<() => void>();

  private socket: WebSocket | null = null;

  /** Whether the current socket holds a seat, which it does from its welcome on. */
  private seated = false;

  /** The server ended the seat or room for good: nothing may resume it. */
  private terminal = false;

  private reconnectAttempt = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Ends the rejoin tries; set at the first drop and cleared by a welcome. */
  private reconnectDeadline: ReturnType<typeof setTimeout> | null = null;

  /** When the server stops holding each away player's seat. */
  private graceEnds = new Map<number, number>();

  /** Counts the away notice down while it shows. */
  private peerTimer: ReturnType<typeof setInterval> | null = null;

  private intentionallyClosed = false;

  private seq = 0;

  private readonly options: OnlineSessionOptions;

  private readonly storage = (): SeatStorage => this.options.storage ?? window.sessionStorage;

  constructor(options: OnlineSessionOptions = {}) {
    this.options = options;
  }

  getSnapshot = (): OnlineSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private publish(patch: Partial<OnlineSessionSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  private send(message: ClientMessage): void {
    const { socket } = this;
    if (socket && socket.readyState === socket.OPEN) {
      socket.send(serializeMessage(message));
    }
  }

  private connect(firstMessage: ClientMessage, rejoining = false): void {
    const url = this.options.url ?? serverUrl();
    if (!url) {
      this.publish({
        status: 'closed',
        error: 'Online play is not configured on this build.',
      });
      return;
    }
    // This socket replaces any rejoin still waiting to start.
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.intentionallyClosed = false;
    this.terminal = false;
    this.seated = false;
    // A rejoin keeps its notice up until the seat is back.
    if (!rejoining) this.publish({ status: 'connecting', connected: false, error: '' });
    this.socket?.close(1000, 'New connection');
    const Socket = this.options.WebSocket ?? WebSocket;
    const socket = new Socket(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.publish({ connected: true });
      this.send(firstMessage);
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket || this.terminal) return;
      const message = parseServerMessage(String(event.data));
      if (message) this.handle(message);
    });
    socket.addEventListener('close', (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.seated = false;
      if (this.intentionallyClosed || this.terminal) {
        this.publish({ connected: false });
        return;
      }
      if (event.code === CLOSE_REPLACED) {
        // Another tab resumed this seat. Resuming it here would take it
        // back, and the two tabs would trade it forever.
        this.endSeat(RESUME_FAILURE_ERRORS.replaced);
        return;
      }
      if (this.snapshot.roomId && this.snapshot.token) {
        this.publish({ connected: false });
        this.scheduleReconnect();
        return;
      }
      // A refusal the server explained stays on screen.
      this.publish({
        status: 'closed', connected: false, error: this.snapshot.error || CONNECT_FAILED,
      });
    });
    socket.addEventListener('error', () => {
      // With a seat to rejoin, the close that follows starts the next try.
      if (this.socket === socket && !this.snapshot.connected && !this.snapshot.token) {
        this.publish({ error: CONNECT_FAILED });
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.reconnectDeadline === null) {
      this.reconnectDeadline = setTimeout(
        () => this.giveUpRejoining(),
        this.options.reconnectDeadlineMs ?? RECONNECT_DEADLINE_MS
      );
    }
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.publish({ status: 'reconnecting', error: RECONNECTING });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(resumeMessage(this.snapshot.roomId, this.snapshot.token), true);
    }, delay);
  }

  /** Stops trying, but keeps the seat: the server may hold it longer than this ran. */
  private giveUpRejoining(): void {
    this.stopTimers();
    const { socket } = this;
    this.socket = null;
    socket?.close(1000, 'Gave up rejoining');
    this.publish({
      status: 'closed', connected: false, gameState: null, error: RECONNECT_FAILED,
    });
  }

  /** Cancels the rejoin tries, their deadline, and the away countdown. */
  private stopTimers(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.reconnectDeadline !== null) clearTimeout(this.reconnectDeadline);
    if (this.peerTimer !== null) clearInterval(this.peerTimer);
    this.reconnectTimer = null;
    this.reconnectDeadline = null;
    this.peerTimer = null;
    this.reconnectAttempt = 0;
  }

  /** The server ended this seat or its room for good: say why and forget the seat. */
  private endSeat(error: string): void {
    this.terminal = true;
    this.stopTimers();
    this.graceEnds.clear();
    clearStoredSeat(this.storage);
    this.publish({
      status: 'closed', connected: false, roomId: '', token: '', gameState: null, error,
    });
    // Nothing more comes on it, and a seatless socket holds a server slot.
    this.socket?.close(1000, 'Seat ended');
  }

  /** Who the match waits on, with the seconds the server still holds each seat. */
  private peerNotice(): string {
    const now = Date.now();
    return this.snapshot.players
      .filter((player) => !player.connected)
      .map((player) => {
        const endsAt = this.graceEnds.get(player.seat);
        const left = endsAt === undefined
          ? ''
          : ` (${Math.max(0, Math.ceil((endsAt - now) / 1000))}s)`;
        return `Player ${player.seat + 1} reconnecting${left}`;
      })
      .join(' · ');
  }

  /** In a match, shows who is away and keeps counting it down while it shows. */
  private showPeerNotice(): void {
    const inMatch = this.seated && this.snapshot.status === 'playing';
    const notice = inMatch ? this.peerNotice() : '';
    if (inMatch && notice !== this.snapshot.error) this.publish({ error: notice });
    if (notice && this.peerTimer === null) {
      this.peerTimer = setInterval(() => this.showPeerNotice(), PEER_NOTICE_TICK_MS);
    } else if (!notice && this.peerTimer !== null) {
      clearInterval(this.peerTimer);
      this.peerTimer = null;
    }
  }

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.seated = true;
        this.stopTimers();
        writeStoredSeat(this.storage, message.roomId, message.token);
        this.publish({
          roomId: message.roomId,
          seat: message.seat,
          playerId: message.playerId,
          token: message.token,
          status: this.snapshot.gameState ? 'playing' : 'lobby',
          connected: true,
          error: '',
        });
        break;
      case 'lobby':
        // A seat that is back, or gone from the room, is no longer counted down.
        this.graceEnds.forEach((_, seat) => {
          if (!message.players.some((player) => player.seat === seat && !player.connected)) {
            this.graceEnds.delete(seat);
          }
        });
        this.publish({
          players: message.players,
          roomMode: message.roomMode,
          stageId: message.stageId,
          capacity: message.capacity,
          totalRounds: message.totalRounds,
          status: this.snapshot.gameState ? 'playing' : 'lobby',
          error: '',
        });
        this.showPeerNotice();
        break;
      case 'start':
        this.publish({ playerId: message.playerId, status: 'playing', error: '' });
        this.showPeerNotice();
        break;
      case 'snapshot': {
        const hasPatch = message.patch && Object.keys(message.patch).length > 0;
        const gameState = message.state
          ?? (this.snapshot.gameState && hasPatch
            ? { ...this.snapshot.gameState, ...message.patch }
            : this.snapshot.gameState);
        // Only the away notice outlives a snapshot: a pause arrives as one
        // right after it. Any other error answered one request, now past.
        this.publish({
          gameState, ack: message.ack, status: 'playing', error: this.peerNotice(),
        });
        // An error may have stopped the countdown; this restarts it.
        this.showPeerNotice();
        break;
      }
      case 'peer':
        if (message.connected || typeof message.graceMsLeft !== 'number') {
          this.graceEnds.delete(message.seat);
        } else {
          this.graceEnds.set(message.seat, Date.now() + message.graceMsLeft);
        }
        this.showPeerNotice();
        break;
      case 'room-closed':
        this.endSeat(roomClosedError(message));
        break;
      case 'error':
        if (message.code === 'seat-expired') {
          this.endSeat(seatExpiredError(message));
        } else if (message.code === 'upgrade-required') {
          this.endSeat('upgrade required');
        } else if (
          message.code === 'not-host'
          || message.code === 'not-ready'
          || message.code === 'not-enough-players'
        ) {
          this.publish({ error: message.code.replace(/-/g, ' ') });
        } else if (!this.seated && this.snapshot.token) {
          // The server turned a rejoin away (it is full): the next try may get in.
          this.socket?.close(1000, 'Rejoin refused');
        } else {
          this.publish({ status: 'closed', error: message.code.replace(/-/g, ' ') });
          // A refused create or join holds nothing worth a server slot.
          if (!this.seated) this.socket?.close(1000, 'Request refused');
        }
        break;
      default:
        break;
    }
  }

  create(
    name: string,
    characterId: CharacterId,
    roomMode: OnlineRoomMode,
    stageId: StageId,
    totalRounds: OnlineRounds
  ): void {
    this.stopTimers();
    this.graceEnds.clear();
    this.snapshot = emptySnapshot();
    this.connect({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: name.trim(),
      characterId,
      roomMode,
      stageId,
      totalRounds,
    });
  }

  join(roomId: string, name: string, characterId: CharacterId): void {
    this.stopTimers();
    this.graceEnds.clear();
    this.snapshot = emptySnapshot();
    this.connect({
      type: 'join',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      roomId: roomId.trim().toUpperCase(),
      name: name.trim(),
      characterId,
    });
  }

  resumeStored(expectedRoomId?: string): boolean {
    if (this.socket || this.snapshot.connected) return true;
    const stored = readStoredSeat(this.storage);
    if (!stored || (expectedRoomId && stored.roomId !== expectedRoomId)) return false;
    this.publish({ roomId: stored.roomId, token: stored.token });
    this.connect(resumeMessage(stored.roomId, stored.token));
    return true;
  }

  /** Tries the kept seat again once the session has given up rejoining it. */
  rejoin(): void {
    if (this.socket || !this.snapshot.roomId || !this.snapshot.token) return;
    this.scheduleReconnect();
  }

  selectCharacter(characterId: CharacterId): void {
    this.send({ type: 'selection', characterId });
  }

  setReady(ready: boolean): void {
    this.send({ type: 'ready', ready });
  }

  startMatch(): void {
    this.send({ type: 'start-match' });
  }

  setRematch(ready: boolean): void {
    this.send({ type: 'rematch', ready });
  }

  input(
    direction?: GameEngineState['players'][number]['facing'] | null,
    action?: OnlineAction,
    fallbackDirection?: GameEngineState['players'][number]['facing'] | null
  ): void {
    this.send({
      type: 'input', seq: this.seq, direction, action, fallbackDirection,
    });
    this.seq += 1;
  }

  leave(): void {
    this.intentionallyClosed = true;
    this.stopTimers();
    this.graceEnds.clear();
    this.send({ type: 'leave' });
    this.socket?.close(1000, 'Left room');
    this.socket = null;
    clearStoredSeat(this.storage);
    this.snapshot = emptySnapshot();
    this.listeners.forEach((listener) => listener());
  }
}

let onlineSession: OnlineSession | null = null;

export function getOnlineSession(): OnlineSession {
  if (!onlineSession) onlineSession = new OnlineSession();
  return onlineSession;
}
