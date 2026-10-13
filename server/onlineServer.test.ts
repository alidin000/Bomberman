// @vitest-environment node
import WebSocket from 'ws';
import { snapshotForDelivery, startOnlineServer } from './onlineServer';
import { defaultMap } from '../src/constants/contants';
import { gameReducer } from '../src/engine/reducer';
import { gameItem } from '../src/model/gameItem';
import { CAMPAIGN_STAGE_LAYOUTS } from '../src/content/campaignLayouts';
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

function createMessage(
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

describe('online room server', () => {
  it('drops backed-up patches and resumes with one full authoritative state', () => {
    const state = gameReducer(null, {
      type: 'INIT',
      config: {
        mode: 'onlinePreview',
        numPlayers: 2,
        totalRounds: 3,
        selectedMap: 'online-arena',
        stageId: 'hiddenLeaf',
        map: defaultMap.map((row) => row.map((cell): gameItem => {
          if (cell === 'W') return 'Wall';
          if (cell === 'B') return 'Box';
          return 'Empty';
        })),
      },
    });
    if (!state) throw new Error('Missing state');
    const delivery = { needsFullSnapshot: false };

    expect(snapshotForDelivery(delivery, state, state, 1, 17_000, 16_000)).toBeNull();
    expect(delivery.needsFullSnapshot).toBe(true);

    const recovered = snapshotForDelivery(delivery, state, state, 2, 0, 16_000);
    expect(recovered).toMatchObject({ type: 'snapshot', ack: 2, state });
    expect(recovered && 'patch' in recovered).toBe(false);
    expect(delivery.needsFullSnapshot).toBe(false);

    const incremental = snapshotForDelivery(delivery, state, state, 3, 0, 16_000);
    expect(incremental).toMatchObject({ type: 'snapshot', ack: 3, patch: {} });
  });

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
      await wait(30);
      send(first, { type: 'start-match' });
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

  it('lets the host start with three ready players without reserving a room size', async () => {
    const server = await startOnlineServer({ port: 0 });
    const clients = await Promise.all(Array.from({ length: 3 }, () => connect(server.port)));
    try {
      send(clients[0], createMessage('First'));
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
      await wait(30);
      expect(server.getRoomState(welcome.roomId)).toBeNull();

      send(clients[0], { type: 'start-match' });
      const starts = await Promise.all(clients.map((client) => client.next('start')));
      expect(starts.every((message) => (
        message.type === 'start' && message.config.numPlayers === 3
      ))).toBe(true);
    } finally {
      clients.forEach((client) => client.socket.close());
      await server.close();
    }
  });

  it('accepts up to four players, starts on host command, and rejects a fifth', async () => {
    const server = await startOnlineServer({ port: 0 });
    const clients = await Promise.all(Array.from({ length: 5 }, () => connect(server.port)));
    try {
      send(clients[0], createMessage('First'));
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
      send(clients[0], { type: 'start-match' });
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
      // Long enough that the disconnect always lands inside the hold, even
      // on a loaded machine; the check below waits past it.
      roundResultMs: 400,
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
      await wait(30);
      send(first, { type: 'start-match' });
      await Promise.all([first.next('start'), second.next('start')]);
      await waitFor(() => (
        (server.getRoomState(welcome.roomId)?.roundStartTicksRemaining ?? 1) === 0
      ));

      send(first, { type: 'input', seq: 0, action: 'bomb' });
      await waitFor(() => server.getRoomState(welcome.roomId)?.phase === 'round_end');
      second.socket.close();
      await waitFor(() => server.getRoomState(welcome.roomId)?.paused === true);
      await wait(500);

      expect(server.getRoomState(welcome.roomId)?.phase).toBe('round_end');
    } finally {
      first.socket.close();
      second.socket.close();
      await server.close();
    }
  });

  it('rejects a guest launch and starts the selected co-op mission for the host', async () => {
    const server = await startOnlineServer({ port: 0 });
    const host = await connect(server.port);
    const guest = await connect(server.port);
    try {
      send(host, createMessage('Host', 'coop', 'hiddenSand', 1));
      const welcome = await host.next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');
      send(host, { type: 'start-match' });
      await expect(host.next('error')).resolves.toEqual({
        type: 'error', code: 'not-enough-players',
      });
      send(guest, {
        type: 'join',
        protocol: PROTOCOL_VERSION,
        simulation: SIMULATION_VERSION,
        roomId: welcome.roomId,
        name: 'Guest',
        characterId: 'gaara',
      });
      await guest.next('welcome');

      send(host, { type: 'ready', ready: true });
      await wait(20);
      send(host, { type: 'start-match' });
      await expect(host.next('error')).resolves.toEqual({
        type: 'error', code: 'not-ready',
      });
      send(guest, { type: 'ready', ready: true });
      await wait(20);
      send(guest, { type: 'start-match' });
      await expect(guest.next('error')).resolves.toEqual({ type: 'error', code: 'not-host' });
      expect(server.getRoomState(welcome.roomId)).toBeNull();

      send(host, { type: 'start-match' });
      const started = await host.next('start');
      expect(started.type === 'start' && started.config).toMatchObject({
        mode: 'solo',
        numPlayers: 2,
        totalRounds: 1,
        selectedMap: 'hiddenSand',
        stageId: 'hiddenSand',
      });
      const snapshot = await host.next('snapshot');
      expect(snapshot.type === 'snapshot' && snapshot.state?.campaign?.stageId)
        .toBe('hiddenSand');
      expect(snapshot.type === 'snapshot' && snapshot.state?.campaign?.villageName)
        .toBe('Hidden Sand');
      // The room plays the village's own map, with both seats on its spawns.
      const layout = CAMPAIGN_STAGE_LAYOUTS.hiddenSand;
      expect(snapshot.type === 'snapshot' && snapshot.state?.map).toHaveLength(layout.size);
      expect(snapshot.type === 'snapshot' && snapshot.state?.players.map(({ x, y }) => ({ x, y })))
        .toEqual(layout.playerSpawns.slice(0, 2));
      expect(snapshot.type === 'snapshot' && snapshot.state?.campaign?.bossArena.gates)
        .toEqual(layout.bossArena.gates);
    } finally {
      host.socket.close();
      guest.socket.close();
      await server.close();
    }
  });
});
