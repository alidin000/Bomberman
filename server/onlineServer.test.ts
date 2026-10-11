// @vitest-environment node
import WebSocket from 'ws';
import { startOnlineServer } from './onlineServer';
import {
  PROTOCOL_VERSION, SIMULATION_VERSION, ServerMessage,
} from '../src/network/protocol';

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
    const waiterIndex = waiters.findIndex((waiter) => waiter.type === message.type);
    if (waiterIndex >= 0) {
      const [waiter] = waiters.splice(waiterIndex, 1);
      waiter.resolve(message);
    } else {
      messages.push(message);
    }
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

async function waitFor(
  condition: () => boolean,
  timeoutMs = 1000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for server state');
    // State changes on the server timer and must be observed in order.
    // eslint-disable-next-line no-await-in-loop
    await wait(5);
  }
}

function createMessage(name: string, maxPlayers: 2 | 3 | 4 = 2) {
  return {
    type: 'create',
    protocol: PROTOCOL_VERSION,
    simulation: SIMULATION_VERSION,
    name,
    characterId: 'naruto',
    maxPlayers,
  };
}

describe('online room server', () => {
  it('runs one authoritative match for two clients', async () => {
    const server = await startOnlineServer({ port: 0 });
    const first = await connect(server.port);
    const second = await connect(server.port);
    try {
      send(first, createMessage('First'));
      const firstWelcome = await first.next('welcome');
      expect(firstWelcome.type).toBe('welcome');
      if (firstWelcome.type !== 'welcome') return;

      send(second, {
        type: 'join',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: firstWelcome.roomId,
        name: 'Second',
        characterId: 'sasuke',
      });
      const secondWelcome = await second.next('welcome');
      expect(secondWelcome.type === 'welcome' && secondWelcome.seat).toBe(1);

      send(first, { type: 'ready', ready: true });
      send(second, { type: 'ready', ready: true });
      await Promise.all([first.next('start'), second.next('start')]);
      const initial = await first.next('snapshot');
      expect(initial.type === 'snapshot' && initial.state?.players).toHaveLength(2);
      expect(initial.type === 'snapshot' && initial.state?.players.map((player) => player.name))
        .toEqual(['First', 'Second']);

      send(first, { type: 'input', seq: 0, direction: 'right' });
      let moved: Extract<ServerMessage, { type: 'snapshot' }> | null = null;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        // Snapshots are an ordered stream, so this loop must consume them serially.
        // eslint-disable-next-line no-await-in-loop
        const snapshot = await first.next('snapshot');
        if (
          snapshot.type === 'snapshot'
          && snapshot.ack >= 0
          && (snapshot.patch?.players?.[0]?.x ?? 0) > 1
        ) {
          moved = snapshot;
          break;
        }
      }
      expect(moved?.ack).toBe(0);
      expect(moved?.patch?.players?.[0].x).toBeGreaterThan(1);
      expect(moved?.patch?.players?.[1].x).toBe(13);
    } finally {
      first.socket.close();
      second.socket.close();
      await server.close();
    }
  }, 10_000);

  it('starts a three-seat room only after the third player is ready', async () => {
    const server = await startOnlineServer({ port: 0 });
    const clients = await Promise.all(Array.from({ length: 3 }, () => connect(server.port)));
    try {
      send(clients[0], createMessage('First', 3));
      const welcome = await clients[0].next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');

      for (let seat = 1; seat < 3; seat += 1) {
        send(clients[seat], {
          type: 'join',
          protocol: PROTOCOL_VERSION,
          simulation: SIMULATION_VERSION,
          roomId: welcome.roomId,
          name: `Player ${seat + 1}`,
          characterId: 'sasuke',
        });
        // Joins are ordered here so each assigned seat is deterministic.
        // eslint-disable-next-line no-await-in-loop
        await clients[seat].next('welcome');
      }

      send(clients[0], { type: 'ready', ready: true });
      send(clients[1], { type: 'ready', ready: true });
      await wait(30);
      expect(server.getRoomState(welcome.roomId)).toBeNull();

      send(clients[2], { type: 'ready', ready: true });
      const starts = await Promise.all(clients.map((client) => client.next('start')));
      expect(starts.every((message) => (
        message.type === 'start' && message.config.numPlayers === 3
      ))).toBe(true);
    } finally {
      clients.forEach((client) => client.socket.close());
      await server.close();
    }
  });

  it('waits for all four seats, starts four players, and rejects a fifth', async () => {
    const server = await startOnlineServer({ port: 0 });
    const clients = await Promise.all(Array.from({ length: 5 }, () => connect(server.port)));
    try {
      send(clients[0], createMessage('First', 4));
      const welcome = await clients[0].next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');

      for (let seat = 1; seat < 4; seat += 1) {
        send(clients[seat], {
          type: 'join',
          protocol: PROTOCOL_VERSION,
          simulation: SIMULATION_VERSION,
          roomId: welcome.roomId,
          name: `Player ${seat + 1}`,
          characterId: 'sasuke',
        });
        // Joins are ordered here so each assigned seat is deterministic.
        // eslint-disable-next-line no-await-in-loop
        const joined = await clients[seat].next('welcome');
        expect(joined.type === 'welcome' && joined.seat).toBe(seat);
      }

      send(clients[4], {
        type: 'join',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: welcome.roomId,
        name: 'Too late',
        characterId: 'gaara',
      });
      await expect(clients[4].next('error')).resolves.toEqual({
        type: 'error', code: 'room-full',
      });

      clients.slice(0, 3).forEach((client) => send(client, { type: 'ready', ready: true }));
      await wait(30);
      expect(server.getRoomState(welcome.roomId)).toBeNull();

      send(clients[3], { type: 'ready', ready: true });
      await Promise.all(clients.slice(0, 4).map((client) => client.next('start')));
      const initial = await clients[0].next('snapshot');
      expect(initial.type === 'snapshot' && initial.state?.players.map((player) => player.id))
        .toEqual(['player1', 'player2', 'player3', 'player4']);
      expect(initial.type === 'snapshot' && initial.state?.players.map(({ x, y }) => [x, y]))
        .toEqual([[1, 1], [13, 8], [1, 8], [13, 1]]);
    } finally {
      clients.forEach((client) => client.socket.close());
      await server.close();
    }
  });

  it('reconnects the assigned seat and rejects authority-shaped input', async () => {
    const server = await startOnlineServer({ port: 0, reconnectGraceMs: 500 });
    const first = await connect(server.port);
    const attacker = await connect(server.port);
    let resumed: Client | null = null;
    try {
      send(first, createMessage('First'));
      const welcome = await first.next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');

      send(attacker, {
        type: 'input', seq: 0, playerId: 'player2', action: { type: 'INIT' },
      });
      const bad = await attacker.next('error');
      expect(bad).toEqual({ type: 'error', code: 'bad-message' });
      const closed = new Promise<number>((resolve) => {
        attacker.socket.once('close', (code) => resolve(code));
      });
      expect(await closed).toBe(1008);

      first.socket.close();
      await wait(25);
      resumed = await connect(server.port);
      send(resumed, {
        type: 'resume-session',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: welcome.roomId,
        token: welcome.token,
      });
      const resumedWelcome = await resumed.next('welcome');
      expect(resumedWelcome.type === 'welcome' && resumedWelcome.seat).toBe(0);
    } finally {
      first.socket.close();
      attacker.socket.close();
      resumed?.socket.close();
      await server.close();
    }
  });

  it('cancels empty-room expiry when a lobby seat reconnects', async () => {
    const server = await startOnlineServer({ port: 0, emptyRoomTtlMs: 40 });
    const first = await connect(server.port);
    let resumed: Client | null = null;
    try {
      send(first, createMessage('First'));
      const welcome = await first.next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');

      const closed = new Promise<void>((resolve) => {
        first.socket.once('close', () => resolve());
      });
      first.socket.close();
      await closed;
      resumed = await connect(server.port);
      send(resumed, {
        type: 'resume-session',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: welcome.roomId,
        token: welcome.token,
      });
      await resumed.next('welcome');
      await wait(60);

      expect(server.roomCount()).toBe(1);
      expect(resumed.socket.readyState).toBe(WebSocket.OPEN);
    } finally {
      first.socket.close();
      resumed?.socket.close();
      await server.close();
    }
  });

  it('does not advance a round result while a player is disconnected', async () => {
    const server = await startOnlineServer({
      port: 0,
      reconnectGraceMs: 1000,
      roundResultMs: 40,
      tickIntervalMs: 1,
    });
    const first = await connect(server.port);
    const second = await connect(server.port);
    try {
      send(first, createMessage('First'));
      const welcome = await first.next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');
      send(second, {
        type: 'join',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: welcome.roomId,
        name: 'Second',
        characterId: 'sasuke',
      });
      await second.next('welcome');
      send(first, { type: 'ready', ready: true });
      send(second, { type: 'ready', ready: true });
      await Promise.all([first.next('start'), second.next('start')]);
      await waitFor(() => (
        (server.getRoomState(welcome.roomId)?.roundStartTicksRemaining ?? 1) === 0
      ));

      send(first, { type: 'input', seq: 0, action: 'bomb' });
      await waitFor(() => server.getRoomState(welcome.roomId)?.phase === 'round_end');
      second.socket.close();
      await waitFor(() => server.getRoomState(welcome.roomId)?.paused === true);
      await wait(80);

      expect(server.getRoomState(welcome.roomId)?.phase).toBe('round_end');
    } finally {
      first.socket.close();
      second.socket.close();
      await server.close();
    }
  });
});
