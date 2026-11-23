// Shared helpers for the room server tests: real sockets, real timers and
// polling waits, so a test sees what a browser would.
import WebSocket from 'ws';
import { CharacterId } from '../src/content/types';
import {
  PROTOCOL_VERSION, SIMULATION_VERSION, ServerMessage,
} from '../src/network/protocol';
import type { LogEntry, OnlineServer } from './onlineServer';

export type Received = { at: number; message: ServerMessage };

export type Client = {
  socket: WebSocket;
  /** Every message so far, in arrival order. */
  received: Received[];
  /** The next message of this type not taken yet; fails after `timeoutMs`. */
  next: (type: ServerMessage['type'], timeoutMs?: number) => Promise<ServerMessage>;
  /** The close code, once the socket has closed. */
  closed: Promise<number>;
};

export type ConnectOptions = { headers?: Record<string, string>; origin?: string };

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitFor(
  condition: () => boolean,
  timeoutMs = 1000,
  what = 'server state'
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${what}`);
    // State changes on the server timer and must be observed in order.
    // eslint-disable-next-line no-await-in-loop
    await wait(5);
  }
}

/** Opens a socket like a browser tab would; rejects when the handshake is refused. */
export async function connect(port: number, options: ConnectOptions = {}): Promise<Client> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, {
    headers: options.headers,
    origin: options.origin,
  });
  const received: Received[] = [];
  const pending: ServerMessage[] = [];
  const waiters: { type: ServerMessage['type']; resolve: (message: ServerMessage) => void }[] = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    received.push({ at: Date.now(), message });
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
    } else {
      pending.push(message);
    }
  });
  const closed = new Promise<number>((resolve) => {
    socket.once('close', (code) => resolve(code));
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  // A late socket error (a reset during shutdown) must not fail the test run.
  socket.on('error', () => undefined);
  return {
    socket,
    received,
    closed,
    next: (type, timeoutMs = 2000) => {
      const index = pending.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(pending.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const waiter = {
          type,
          resolve: (message: ServerMessage) => {
            if (timer) clearTimeout(timer);
            resolve(message);
          },
        };
        timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1);
          const seen = received.map((item) => item.message.type).join(', ') || 'nothing';
          reject(new Error(`Timed out waiting for '${type}'; received: ${seen}`));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}

export function send(client: Client, message: object): void {
  client.socket.send(JSON.stringify(message));
}

/** The first message of any of these types, without taking it from `next`. */
export async function firstOf(
  client: Client,
  types: ServerMessage['type'][],
  timeoutMs = 2000
): Promise<ServerMessage> {
  const matches = ({ message }: Received) => types.includes(message.type);
  await waitFor(() => client.received.some(matches), timeoutMs, `one of ${types.join(', ')}`);
  return client.received.find(matches)!.message;
}

export function createMessage(
  name: string,
  roomMode: 'coop' | 'arena' = 'arena',
  stageId = 'hiddenLeaf',
  totalRounds = 3
) {
  return {
    type: 'create',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    name,
    characterId: 'naruto',
    roomMode,
    stageId,
    totalRounds,
  };
}

export function joinMessage(roomId: string, name: string, characterId: CharacterId = 'sasuke') {
  return {
    type: 'join',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    roomId,
    name,
    characterId,
  };
}

export function resumeMessage(roomId: string, token: string) {
  return {
    type: 'resume-session',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    roomId,
    token,
  };
}

export type Welcome = Extract<ServerMessage, { type: 'welcome' }>;

export async function welcomeOf(client: Client): Promise<Welcome> {
  const message = await client.next('welcome');
  if (message.type !== 'welcome') throw new Error('Missing welcome');
  return message;
}

/** Host creates a room, a guest joins, both ready up, and the host starts. */
export async function startTwoPlayerMatch(
  host: Client,
  guest: Client,
  roomMode: 'coop' | 'arena' = 'arena',
  totalRounds = 3
): Promise<{ host: Welcome; guest: Welcome }> {
  send(host, createMessage('Host', roomMode, 'hiddenLeaf', totalRounds));
  const hostWelcome = await welcomeOf(host);
  send(guest, joinMessage(hostWelcome.roomId, 'Guest'));
  const guestWelcome = await welcomeOf(guest);
  send(host, { type: 'ready', ready: true });
  send(guest, { type: 'ready', ready: true });
  await waitFor(
    () => host.received.some(({ message }) => (
      message.type === 'lobby' && message.players.length === 2
      && message.players.every((player) => player.ready)
    )),
    2000,
    'both seats ready'
  );
  send(host, { type: 'start-match' });
  await Promise.all([host.next('start'), guest.next('start')]);
  return { host: hostWelcome, guest: guestWelcome };
}

/** Waits until the round-start countdown is over and bombs can be placed. */
export function waitForLiveRound(server: OnlineServer, roomId: string): Promise<void> {
  return waitFor(
    () => (server.getRoomState(roomId)?.roundStartTicksRemaining ?? 1) === 0,
    5000,
    'the round countdown'
  );
}

export function snapshotsOf(client: Client, since = 0) {
  return client.received
    .slice(since)
    .map(({ message }) => message)
    .filter((message): message is Extract<ServerMessage, { type: 'snapshot' }> => (
      message.type === 'snapshot'
    ));
}

/** Collects the server's structured log lines in memory. */
export function logCollector(): { entries: LogEntry[]; log: (entry: LogEntry) => void } {
  const entries: LogEntry[] = [];
  return { entries, log: (entry) => { entries.push(entry); } };
}

export function closeAll(clients: (Client | null | undefined)[]): void {
  clients.forEach((client) => client?.socket.close());
}
