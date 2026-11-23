// @vitest-environment node
import { startOnlineServer } from './onlineServer';
import { PROTOCOL_VERSION } from '../src/network/protocol';
import {
  Client, closeAll, connect, createMessage, joinMessage, logCollector, send, snapshotsOf,
  waitFor, welcomeOf,
} from './testUtils';

describe('room server diagnostics', () => {
  it('logs the room flow without tokens, names, raw addresses, or live room codes', async () => {
    const { entries, log } = logCollector();
    const server = await startOnlineServer({ port: 0, log });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      send(host, createMessage('Zephyrine'));
      const room = await welcomeOf(host);
      send(guest, joinMessage(room.roomId, 'Quillsworth'));
      const seat = await welcomeOf(guest);
      send(host, { type: 'ready', ready: true });
      send(guest, { type: 'ready', ready: true });
      await waitFor(() => host.received.some(({ message }) => (
        message.type === 'lobby' && message.players.every((player) => player.ready)
        && message.players.length === 2
      )));
      send(host, { type: 'start-match' });
      await host.next('start');
      send(guest, { type: 'leave' });
      await host.next('room-closed');
      await waitFor(() => entries.some((entry) => entry.event === 'socket_closed'));

      const events = entries.map((entry) => entry.event);
      expect(events).toEqual(expect.arrayContaining([
        'server_started', 'socket_open', 'room_created', 'seat_joined', 'room_started',
        'room_closed', 'socket_closed',
      ]));
      entries.forEach((entry) => {
        expect(Number.isNaN(Date.parse(entry.ts))).toBe(false);
        const line = JSON.stringify(entry);
        [room.token, seat.token, 'Zephyrine', 'Quillsworth', '127.0.0.1'].forEach((secret) => {
          expect(line).not.toContain(secret);
        });
        if (line.includes(room.roomId)) expect(entry.event).toBe('room_closed');
      });
      expect(entries.find((entry) => entry.event === 'room_closed')).toMatchObject({
        code: room.roomId, reason: 'left', detail: 'player-left',
      });
      // Both sockets share an address, so they share one opaque key.
      const keys = entries.filter((entry) => entry.event === 'socket_open').map((entry) => entry.ip);
      expect(keys).toHaveLength(2);
      expect(keys[0]).toMatch(/^[0-9a-f]{10}$/);
      expect(keys[1]).toBe(keys[0]);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('reports the limits in effect at boot', async () => {
    const { entries, log } = logCollector();
    const server = await startOnlineServer({ port: 0, log });
    try {
      expect(entries.find((entry) => entry.event === 'server_started')).toMatchObject({
        port: server.port,
        clientIpSource: 'socket',
        limits: {
          maxRooms: 100,
          maxRoomsPerIp: 8,
          maxSockets: 400,
          maxSocketsPerIp: 32,
          connectBurst: 20,
          connectRefillMs: 1000,
          createBurst: 8,
          createRefillMs: 5000,
          createCooldownMs: 0,
          joinFailBurst: 10,
          joinFailRefillMs: 3000,
          messagesPerSecond: 60,
          unseatedTimeoutMs: 30_000,
          lobbyTtlMs: 600_000,
          reconnectGraceMs: 20_000,
          emptyRoomTtlMs: 60_000,
          finishedRoomTtlMs: 120_000,
          idleRoomMs: 600_000,
          maxRoomAgeMs: 10_800_000,
          shutdownGraceMs: 5000,
        },
      });
    } finally {
      await server.close();
    }
  });

  it('logs each kind of bad input and closes the socket that sent it', async () => {
    const { entries, log } = logCollector();
    const server = await startOnlineServer({ port: 0, log });
    const clients: Client[] = [];
    try {
      const [oversized, outdated, garbled] = await Promise.all(
        [0, 1, 2].map(() => connect(server.port))
      );
      clients.push(oversized, outdated, garbled);

      oversized.socket.send(JSON.stringify({ type: 'leave', pad: 'x'.repeat(2000) }));
      expect(await oversized.closed).toBe(1009);

      send(outdated, { ...createMessage('Old'), protocol: PROTOCOL_VERSION - 1 });
      expect(await outdated.next('error')).toEqual({ type: 'error', code: 'upgrade-required' });
      expect(await outdated.closed).toBe(1008);

      garbled.socket.send('not json');
      expect(await garbled.next('error')).toEqual({ type: 'error', code: 'bad-message' });
      expect(await garbled.closed).toBe(1008);

      const kinds = () => entries
        .filter((entry) => entry.event === 'protocol_error')
        .map((entry) => entry.kind)
        .sort();
      await waitFor(() => kinds().length === 3);
      expect(kinds()).toEqual(['frame', 'parse', 'version']);
      expect(server.metrics().protocolErrors).toEqual({
        parse: 1, version: 1, frame: 1, state: 0,
      });
      expect(JSON.stringify(entries)).not.toContain('xxxxxxxxxx');
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('logs a repeated rate limit once per address per window with a suppressed count', async () => {
    const { entries, log } = logCollector();
    let clock = 2_000_000;
    const server = await startOnlineServer({
      port: 0, log, now: () => clock, joinFailBurst: 1, joinFailRefillMs: 3_600_000,
    });
    const clients: Client[] = [];
    const refusedJoin = async () => {
      const client = await connect(server.port);
      clients.push(client);
      send(client, joinMessage('ZZZZZZ', 'Guess'));
      const answer = await client.next('error');
      return answer.type === 'error' ? answer.code : answer.type;
    };
    const limited = () => entries.filter((entry) => (
      entry.event === 'rate_limited' && entry.scope === 'join'
    ));
    try {
      expect(await refusedJoin()).toBe('room-not-found');
      expect(await refusedJoin()).toBe('rate-limited');
      expect(await refusedJoin()).toBe('rate-limited');
      expect(await refusedJoin()).toBe('rate-limited');
      expect(limited()).toHaveLength(1);

      clock += 10_000;
      expect(await refusedJoin()).toBe('rate-limited');
      await waitFor(() => limited().length === 2);
      expect(limited()[1]).toMatchObject({ suppressed: 2 });
      expect(server.metrics().rateLimits).toEqual({ join: 4 });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('keeps /healthz for the platform and serves /metrics only with the token', async () => {
    const token = 'metrics-token-for-tests-0123456789';
    const server = await startOnlineServer({ port: 0, metricsToken: token });
    const tokenless = await startOnlineServer({ port: 0 });
    const clients: Client[] = [];
    const base = `http://127.0.0.1:${server.port}`;
    try {
      const host = await connect(server.port);
      clients.push(host, await connect(server.port));
      send(host, createMessage('Host'));
      await welcomeOf(host);

      const health = await fetch(`${base}/healthz`);
      expect(health.status).toBe(200);
      expect(await health.json()).toEqual({ ok: true, rooms: 1, sockets: 2 });

      expect((await fetch(`${base}/metrics`)).status).toBe(401);
      expect((await fetch(`${base}/metrics`, {
        headers: { authorization: 'Bearer not-the-metrics-token' },
      })).status).toBe(401);
      const metrics = await fetch(`${base}/metrics`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(metrics.status).toBe(200);
      const body = await metrics.json();
      expect(body).toEqual(server.metrics());
      expect(body).toMatchObject({
        rooms: { waiting: 1, active: 0, finished: 0 },
        sockets: { seated: 1, seatless: 1 },
        roomsCreated: 1,
      });

      expect((await fetch(`http://127.0.0.1:${tokenless.port}/metrics`)).status).toBe(404);
    } finally {
      closeAll(clients);
      await Promise.all([server.close(), tokenless.close()]);
    }
  });

  it('drops snapshots for a reader that falls behind, then resyncs it with one full state', async () => {
    const { entries, log } = logCollector();
    const server = await startOnlineServer({
      port: 0, log, tickIntervalMs: 1, maxSnapshotBufferBytes: 1024,
    });
    const clients: Client[] = [];
    let mover: ReturnType<typeof setInterval> | null = null;
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      send(host, createMessage('Host', 'coop', 'hiddenLeaf', 1));
      const room = await welcomeOf(host);
      send(guest, joinMessage(room.roomId, 'Guest'));
      await welcomeOf(guest);
      send(host, { type: 'ready', ready: true });
      send(guest, { type: 'ready', ready: true });
      await waitFor(() => host.received.some(({ message }) => (
        message.type === 'lobby' && message.players.length === 2
        && message.players.every((player) => player.ready)
      )));
      send(host, { type: 'start-match' });
      await host.next('start');
      await host.next('snapshot');

      // The host stops reading; the guest keeps the world changing.
      host.socket.pause();
      let seq = 0;
      const directions = ['right', 'down', 'left', 'up'];
      mover = setInterval(() => {
        send(guest, { type: 'input', seq, direction: directions[seq % 4] });
        seq += 1;
      }, 100);
      await waitFor(() => server.metrics().snapshotDrops > 0, 10_000, 'a dropped snapshot');

      const seen = host.received.length;
      host.socket.resume();
      await waitFor(
        () => snapshotsOf(host, seen).some((snapshot) => !!snapshot.state),
        5000,
        'a full-state resync'
      );
      await waitFor(() => server.metrics().resyncs > 0);
      expect(entries.find((entry) => entry.event === 'snapshot_resync'))
        .toMatchObject({ dropped: expect.any(Number) });
    } finally {
      if (mover) clearInterval(mover);
      closeAll(clients);
      await server.close();
    }
  }, 20_000);
});
