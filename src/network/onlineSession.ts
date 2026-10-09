import { CharacterId } from '../content/types';
import { GameEngineState } from '../engine/types';
import {
  ClientMessage,
  OnlineAction,
  OnlinePlayer,
  PROTOCOL_VERSION,
  SIMULATION_VERSION,
  ServerMessage,
  parseServerMessage,
  serializeMessage,
} from './protocol';

const STORAGE_KEY = 'shinobiOnlineSeat';
const RECONNECT_DELAYS = [500, 1000, 2000, 4000];

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
  gameState: GameEngineState | null;
  ack: number;
  error: string;
};

type StoredSeat = { roomId: string; token: string };

function emptySnapshot(): OnlineSessionSnapshot {
  return {
    status: 'idle',
    connected: false,
    roomId: '',
    seat: null,
    playerId: '',
    token: '',
    players: [],
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

function readStoredSeat(): StoredSeat | null {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredSeat | null;
    return parsed && typeof parsed.roomId === 'string' && typeof parsed.token === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function writeStoredSeat(roomId: string, token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ roomId, token }));
  } catch {
    // A private tab may reject storage; the live socket still works.
  }
}

function clearStoredSeat(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

export class OnlineSession {
  private snapshot = emptySnapshot();

  private listeners = new Set<() => void>();

  private socket: WebSocket | null = null;

  private reconnectAttempt = 0;

  private reconnectTimer: number | null = null;

  private intentionallyClosed = false;

  private seq = 0;

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
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(serializeMessage(message));
    }
  }

  private connect(firstMessage: ClientMessage): void {
    const url = serverUrl();
    if (!url) {
      this.publish({
        status: 'closed',
        error: 'Online play is not configured on this build.',
      });
      return;
    }
    this.intentionallyClosed = false;
    this.publish({ status: 'connecting', connected: false, error: '' });
    this.socket?.close(1000, 'New connection');
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.publish({ connected: true, error: '' });
      this.send(firstMessage);
    });
    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) return;
      const message = parseServerMessage(String(event.data));
      if (message) this.handle(message);
    });
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.publish({ connected: false });
      if (!this.intentionallyClosed && this.snapshot.roomId && this.snapshot.token) {
        this.scheduleReconnect();
      } else if (!this.intentionallyClosed) {
        this.publish({ status: 'closed', error: 'Could not connect to the online server.' });
      }
    });
    socket.addEventListener('error', () => {
      if (!this.snapshot.connected) {
        this.publish({ error: 'Could not connect to the online server.' });
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)];
    this.reconnectAttempt += 1;
    this.publish({ status: 'reconnecting', error: 'Connection lost. Rejoining the room...' });
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect({
        type: 'resume-session',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: this.snapshot.roomId,
        token: this.snapshot.token,
      });
    }, delay);
  }

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        writeStoredSeat(message.roomId, message.token);
        this.publish({
          roomId: message.roomId,
          seat: message.seat,
          playerId: message.playerId,
          token: message.token,
          status: this.snapshot.gameState ? 'playing' : 'lobby',
          connected: true,
        });
        break;
      case 'lobby':
        this.publish({ players: message.players, status: this.snapshot.gameState ? 'playing' : 'lobby' });
        break;
      case 'start':
        this.publish({ playerId: message.playerId, status: 'playing', error: '' });
        break;
      case 'snapshot': {
        const hasPatch = message.patch && Object.keys(message.patch).length > 0;
        const gameState = message.state
          ?? (this.snapshot.gameState && hasPatch
            ? { ...this.snapshot.gameState, ...message.patch }
            : this.snapshot.gameState);
        this.publish({
          gameState, ack: message.ack, status: 'playing', error: ''
        });
        break;
      }
      case 'peer':
        this.publish({
          error: message.connected
            ? ''
            : `Player ${message.seat + 1} disconnected. The match is paused.`,
        });
        break;
      case 'room-closed':
        clearStoredSeat();
        this.publish({
          status: 'closed',
          connected: false,
          gameState: null,
          error: message.reason === 'timeout' ? 'The room expired.' : 'The room was closed.',
        });
        break;
      case 'error':
        if (message.code === 'seat-expired' || message.code === 'upgrade-required') {
          clearStoredSeat();
          this.publish({
            status: 'closed',
            roomId: '',
            token: '',
            error: message.code.replace(/-/g, ' '),
          });
        } else {
          this.publish({ status: 'closed', error: message.code.replace(/-/g, ' ') });
        }
        break;
      default:
        break;
    }
  }

  create(name: string, characterId: CharacterId): void {
    this.snapshot = emptySnapshot();
    this.connect({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: name.trim(),
      characterId,
    });
  }

  join(roomId: string, name: string, characterId: CharacterId): void {
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
    const stored = readStoredSeat();
    if (!stored || (expectedRoomId && stored.roomId !== expectedRoomId)) return false;
    this.publish({ roomId: stored.roomId, token: stored.token });
    this.connect({
      type: 'resume-session',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      roomId: stored.roomId,
      token: stored.token,
    });
    return true;
  }

  selectCharacter(characterId: CharacterId): void {
    this.send({ type: 'selection', characterId });
  }

  setReady(ready: boolean): void {
    this.send({ type: 'ready', ready });
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
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.send({ type: 'leave' });
    this.socket?.close(1000, 'Left room');
    this.socket = null;
    clearStoredSeat();
    this.snapshot = emptySnapshot();
    this.listeners.forEach((listener) => listener());
  }
}

let onlineSession: OnlineSession | null = null;

export function getOnlineSession(): OnlineSession {
  if (!onlineSession) onlineSession = new OnlineSession();
  return onlineSession;
}

export function getOnlineServerUrl(): string {
  return serverUrl();
}
