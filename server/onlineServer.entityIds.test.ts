// @vitest-environment node
import WebSocket from 'ws';
import { startOnlineServer } from './onlineServer';
import { TICK_MS } from '../src/engine/constants';
import { GameEngineState } from '../src/engine/types';
import {
  PROTOCOL_VERSION, SIMULATION_VERSION, ServerMessage,
} from '../src/network/protocol';

// Every room runs in the one server process. A room starting (or advancing a
// round) must leave the entity ids of every other room alone.

type Client = {
  socket: WebSocket;
  next: (type: ServerMessage['type']) => Promise<ServerMessage>;
};

async function connect(port: number): Promise<Client> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages: ServerMessage[] = [];
  const waiters: { type: ServerMessage['type']; resolve: (message: ServerMessage) => void }[] = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString()) as ServerMessage;
    // Snapshots are not needed here: the test reads room state directly.
    if (message.type === 'snapshot') return;
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
    if (waiterIndex >= 0) waiters.splice(waiterIndex, 1)[0].resolve(message);
    else messages.push(message);
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
  });
  return {
    socket,
    next: (type) => {
      const index = messages.findIndex((message) => message.type === type);
      if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
      return new Promise((resolve) => {
        waiters.push({ type, resolve });
      });
    },
  };
}

function send(client: Client, message: object): void {
  client.socket.send(JSON.stringify(message));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

type Room = { roomId: string; host: Client; guest: Client };

// Two seats on hiddenCloud, both ready, waiting for the host to start.
async function readyArenaRoom(port: number, clients: Client[]): Promise<Room> {
  const host = await connect(port);
  const guest = await connect(port);
  clients.push(host, guest);
  send(host, {
    type: 'create',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    name: 'Host',
    characterId: 'naruto',
    roomMode: 'arena',
    stageId: 'hiddenCloud',
    totalRounds: 3,
  });
  const welcome = await host.next('welcome');
  if (welcome.type !== 'welcome') throw new Error('Missing welcome');
  send(guest, {
    type: 'join',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    roomId: welcome.roomId,
    name: 'Guest',
    characterId: 'sasuke',
  });
  await guest.next('welcome');
  send(host, { type: 'ready', ready: true });
  send(guest, { type: 'ready', ready: true });
  for (;;) {
    // Lobby updates arrive in order; the last one carries both ready flags.
    // eslint-disable-next-line no-await-in-loop
    const lobby = await host.next('lobby');
    if (lobby.type === 'lobby' && lobby.players.length === 2
      && lobby.players.every((player) => player.ready)) break;
  }
  return { roomId: welcome.roomId, host, guest };
}

describe('online rooms and entity ids', () => {
  it("a room starting does not change another room's live hazard ids", async () => {
    const server = await startOnlineServer({ port: 0, tickIntervalMs: 5 });
    const clients: Client[] = [];
    try {
      const roomA = await readyArenaRoom(server.port, clients);
      const roomB = await readyArenaRoom(server.port, clients);
      send(roomA.host, { type: 'start-match' });
      await roomA.host.next('start');

      // Room A's enemy hazards and the tick each was minted on. Hazards
      // outlive many ticks, so polling the room never misses one.
      const minted: { mintTick: number; id: string }[] = [];
      const seen = new Set<string>();
      const duplicates: string[] = [];
      let startSent = false;
      // Room A's tick by which room B had started (it may have started a
      // tick earlier, never later).
      let roomBStartedBy: number | null = null;
      let mintedAfterB = 0;
      let last: GameEngineState | null = null;
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline && mintedAfterB === 0) {
        const state = server.getRoomState(roomA.roomId);
        if (state && state !== last) {
          last = state;
          if (state.phase !== 'playing') break;
          if (roomBStartedBy === null && server.getRoomState(roomB.roomId)) {
            roomBStartedBy = state.tick;
          }
          for (let index = 0; index < state.hazards.length; index += 1) {
            const hazard = state.hazards[index];
            const lifetime = hazard.warningTicks + (hazard.activeMs ?? 0);
            const mintTick = state.tick - (lifetime - hazard.ticksRemaining) / TICK_MS;
            const key = `${mintTick}@${hazard.x},${hazard.y}`;
            if (!seen.has(key)) {
              seen.add(key);
              minted.push({ mintTick, id: hazard.id });
              if (roomBStartedBy !== null && mintTick > roomBStartedBy) mintedAfterB += 1;
            }
          }
          const ids = state.hazards.map((hazard) => hazard.id);
          if (new Set(ids).size !== ids.length) duplicates.push(`t${state.tick}: ${ids.join(' ')}`);
          // Room B's host presses Start while room A's first casts are live
          // and its next one is a few ticks away (ticks 36 and 43).
          if (!startSent && minted.length > 0) {
            send(roomB.host, { type: 'start-match' });
            startSent = true;
          }
        }
        // The room only changes on the server timer.
        // eslint-disable-next-line no-await-in-loop
        await wait(1);
      }

      expect(roomBStartedBy).not.toBeNull();
      expect(mintedAfterB).toBeGreaterThan(0);
      // In mint order, room A's ids count 1, 2, 3... as if it were alone.
      const mintOrder = [...minted]
        .sort((first, second) => first.mintTick - second.mintTick)
        .map(({ id }) => id);
      expect(mintOrder).toEqual(mintOrder.map((_, index) => `monster-hazard-${index + 1}`));
      expect(duplicates).toEqual([]);
    } finally {
      clients.forEach((client) => client.socket.close());
      await server.close();
    }
  }, 30_000);
});
