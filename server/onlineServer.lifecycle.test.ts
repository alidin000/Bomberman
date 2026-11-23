// @vitest-environment node
import { startOnlineServer } from './onlineServer';
import {
  Client, closeAll, connect, createMessage, joinMessage, resumeMessage, send, snapshotsOf,
  startTwoPlayerMatch, wait, waitFor, waitForLiveRound, welcomeOf,
} from './testUtils';

function phaseOf(snapshot: ReturnType<typeof snapshotsOf>[number]) {
  return snapshot.state?.phase ?? snapshot.patch?.phase;
}

describe('room lifecycle', () => {
  it('expires a lobby at its TTL from creation, even after a resume and a guest drop', async () => {
    const lobbyTtlMs = 800;
    const server = await startOnlineServer({
      port: 0,
      lobbyTtlMs,
      sweepIntervalMs: 10,
      reconnectGraceMs: 10_000,
      emptyRoomTtlMs: 10_000,
      // Both rooms come from 127.0.0.1 within a second.
      createCooldownMs: 0,
    });
    const clients: Client[] = [];
    try {
      const [hostA, resumedA, hostB, guestB] = await Promise.all(
        [0, 1, 2, 3].map(() => connect(server.port))
      );
      clients.push(hostA, resumedA, hostB, guestB);
      send(hostA, createMessage('Host A'));
      const roomA = await welcomeOf(hostA);
      const createdAt = Date.now();

      send(hostB, createMessage('Host B'));
      const roomB = await welcomeOf(hostB);
      send(guestB, joinMessage(roomB.roomId, 'Guest B'));
      await welcomeOf(guestB);
      guestB.socket.close();
      await guestB.closed;

      // Halfway through its life, room A's host comes back on a new socket.
      await wait(lobbyTtlMs / 2);
      send(resumedA, resumeMessage(roomA.roomId, roomA.token));
      await welcomeOf(resumedA);

      const expired = { type: 'room-closed', reason: 'timeout', detail: 'lobby-expired' };
      expect(await resumedA.next('room-closed')).toEqual(expired);
      // Counted from the resume, the room would live another half TTL.
      expect(Date.now() - createdAt).toBeLessThan(lobbyTtlMs * 1.25);
      expect(await hostB.next('room-closed')).toEqual(expired);
      expect(server.roomCount()).toBe(0);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('removes a lobby guest who stays away past the grace so the host can start', async () => {
    const server = await startOnlineServer({
      port: 0, reconnectGraceMs: 100, sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const [host, dropped, newcomer, lateResume] = await Promise.all(
        [0, 1, 2, 3].map(() => connect(server.port))
      );
      clients.push(host, dropped, newcomer, lateResume);
      send(host, createMessage('Host'));
      const room = await welcomeOf(host);
      send(dropped, joinMessage(room.roomId, 'Dropped'));
      const droppedSeat = await welcomeOf(dropped);
      dropped.socket.close();
      await dropped.closed;

      await waitFor(() => {
        const lobbies = host.received.filter(({ message }) => message.type === 'lobby');
        const last = lobbies[lobbies.length - 1]?.message;
        return last?.type === 'lobby' && last.players.length === 1;
      }, 2000, 'the away guest to leave the lobby');

      send(lateResume, resumeMessage(room.roomId, droppedSeat.token));
      expect(await lateResume.next('error')).toEqual({
        type: 'error', code: 'seat-expired', reason: 'seat-not-found',
      });

      send(newcomer, joinMessage(room.roomId, 'Newcomer'));
      expect((await welcomeOf(newcomer)).seat).toBe(1);
      send(host, { type: 'ready', ready: true });
      send(newcomer, { type: 'ready', ready: true });
      await waitFor(() => host.received.some(({ message }) => (
        message.type === 'lobby' && message.players.length === 2
        && message.players.every((player) => player.ready)
      )));
      send(host, { type: 'start-match' });
      await Promise.all([host.next('start'), newcomer.next('start')]);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('closes a lobby whose host stays away while a guest waits', async () => {
    const server = await startOnlineServer({
      port: 0, reconnectGraceMs: 100, sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      send(host, createMessage('Host'));
      const room = await welcomeOf(host);
      send(guest, joinMessage(room.roomId, 'Guest'));
      await welcomeOf(guest);
      host.socket.close();

      expect(await guest.next('room-closed')).toEqual({
        type: 'room-closed', reason: 'left', detail: 'host-left',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('closes a lobby nobody returns to and answers its resume with the detail', async () => {
    const server = await startOnlineServer({
      port: 0, emptyRoomTtlMs: 100, sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const host = await connect(server.port);
      clients.push(host);
      send(host, createMessage('Host'));
      const room = await welcomeOf(host);
      host.socket.close();
      await waitFor(() => server.roomCount() === 0, 2000);

      const back = await connect(server.port);
      clients.push(back);
      send(back, resumeMessage(room.roomId, room.token));
      expect(await back.next('error')).toEqual({
        type: 'error', code: 'seat-expired', reason: 'room-closed', detail: 'empty',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('stops sending while a match is paused or finished, then expires the finished room', async () => {
    const server = await startOnlineServer({
      port: 0,
      tickIntervalMs: 1,
      reconnectGraceMs: 10_000,
      finishedRoomTtlMs: 600,
      sweepIntervalMs: 10,
      createCooldownMs: 0,
    });
    const clients: Client[] = [];
    try {
      const [host, guest, pausedHost, pausedGuest] = await Promise.all(
        [0, 1, 2, 3].map(() => connect(server.port))
      );
      clients.push(host, guest, pausedHost, pausedGuest);

      // Paused: the guest drops mid-countdown, so nothing changes until it is back.
      await startTwoPlayerMatch(pausedHost, pausedGuest);
      pausedGuest.socket.close();
      await waitFor(() => snapshotsOf(pausedHost).some((snapshot) => snapshot.state?.paused));
      const pausedSeen = pausedHost.received.length;
      await wait(200);
      expect(snapshotsOf(pausedHost, pausedSeen)).toHaveLength(0);

      // Finished: a one-round arena ends when the host stands on its bomb.
      const { host: room } = await startTwoPlayerMatch(host, guest, 'arena', 1);
      await waitForLiveRound(server, room.roomId);
      send(host, { type: 'input', seq: 0, action: 'bomb' });
      await waitFor(
        () => snapshotsOf(host).some((snapshot) => phaseOf(snapshot) === 'game_over'),
        5000,
        'the match result'
      );
      const finishedSeen = host.received.length;
      await wait(200);
      expect(snapshotsOf(host, finishedSeen)).toHaveLength(0);
      expect(server.metrics().rooms).toEqual({ waiting: 0, active: 1, finished: 1 });

      expect(await host.next('room-closed', 3000)).toEqual({
        type: 'room-closed', reason: 'timeout', detail: 'finished',
      });
      const metrics = server.metrics();
      expect(metrics.matchesFinished).toBe(1);
      expect(metrics.roomsClosed).toEqual({ finished: 1 });
      expect(metrics.matchDurationMs.count).toBe(1);
      expect(metrics.matchDurationMs.max).toBeGreaterThan(0);
    } finally {
      closeAll(clients);
      await server.close();
    }
  }, 15_000);

  it('restarts the simulation and the expiry clock on a rematch', async () => {
    // 5 ms ticks: the arena's roaming enemies can end a round on their own
    // after ~13 s of game time, so the rematch window must stay shorter.
    const server = await startOnlineServer({
      port: 0, tickIntervalMs: 5, finishedRoomTtlMs: 300, sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      const { host: room } = await startTwoPlayerMatch(host, guest, 'arena', 1);
      await waitForLiveRound(server, room.roomId);
      send(host, { type: 'input', seq: 0, action: 'bomb' });
      await waitFor(() => server.getRoomState(room.roomId)?.phase === 'game_over', 5000);

      send(host, { type: 'rematch', ready: true });
      send(guest, { type: 'rematch', ready: true });
      await Promise.all([host.next('start'), guest.next('start')]);
      const rematchSeen = host.received.length;
      await wait(450);

      expect(server.roomCount()).toBe(1);
      expect(server.getRoomState(room.roomId)?.phase).toBe('playing');
      expect(snapshotsOf(host, rematchSeen).length).toBeGreaterThan(5);
    } finally {
      closeAll(clients);
      await server.close();
    }
  }, 15_000);

  it('closes a match when a seat stays away past the grace', async () => {
    const server = await startOnlineServer({
      port: 0, reconnectGraceMs: 100, sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      await startTwoPlayerMatch(host, guest);
      guest.socket.close();
      expect(await host.next('room-closed')).toEqual({
        type: 'room-closed', reason: 'timeout', detail: 'seat-timeout',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('closes a finished room once a seat stays away past the grace', async () => {
    const server = await startOnlineServer({
      port: 0,
      tickIntervalMs: 5,
      reconnectGraceMs: 150,
      finishedRoomTtlMs: 10_000,
      sweepIntervalMs: 10,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      const { host: room } = await startTwoPlayerMatch(host, guest, 'arena', 1);
      await waitForLiveRound(server, room.roomId);
      send(host, { type: 'input', seq: 0, action: 'bomb' });
      await waitFor(() => server.getRoomState(room.roomId)?.phase === 'game_over', 5000);

      // The guest closes its tab: a rematch can no longer happen.
      guest.socket.close();
      expect(await host.next('room-closed', 2000)).toEqual({
        type: 'room-closed', reason: 'timeout', detail: 'seat-timeout',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  }, 10_000);

  it('closes a match nobody plays and keeps one that gets input', async () => {
    const server = await startOnlineServer({
      port: 0, idleRoomMs: 400, sweepIntervalMs: 10, tickIntervalMs: 5,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      await startTwoPlayerMatch(host, guest);
      for (let seq = 0; seq < 10; seq += 1) {
        send(host, { type: 'input', seq, direction: seq % 2 ? 'up' : 'down' });
        // eslint-disable-next-line no-await-in-loop
        await wait(50);
      }
      expect(server.roomCount()).toBe(1);
      expect(await host.next('room-closed', 2000)).toEqual({
        type: 'room-closed', reason: 'timeout', detail: 'idle',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('closes any room older than the maximum age', async () => {
    const server = await startOnlineServer({ port: 0, maxRoomAgeMs: 150, sweepIntervalMs: 10 });
    const clients: Client[] = [];
    try {
      const host = await connect(server.port);
      clients.push(host);
      send(host, createMessage('Host'));
      await welcomeOf(host);
      expect(await host.next('room-closed')).toEqual({
        type: 'room-closed', reason: 'timeout', detail: 'max-age',
      });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('tells a failed resume why the seat is gone', async () => {
    const server = await startOnlineServer({ port: 0 });
    const otherBoot = await startOnlineServer({ port: 0 });
    const clients: Client[] = [];
    try {
      const host = await connect(server.port);
      clients.push(host);
      send(host, createMessage('Host'));
      const room = await welcomeOf(host);

      const attempt = async (port: number, roomId: string, token: string) => {
        const client = await connect(port);
        clients.push(client);
        send(client, resumeMessage(roomId, token));
        return client.next('error');
      };

      // The room is live, but no seat holds this token.
      const forged = `${room.token.slice(0, 8)}${'0'.repeat(24)}`;
      expect(await attempt(server.port, room.roomId, forged)).toEqual({
        type: 'error', code: 'seat-expired', reason: 'seat-not-found',
      });

      // A token another boot issued: this server restarted since.
      const otherHost = await connect(otherBoot.port);
      clients.push(otherHost);
      send(otherHost, createMessage('Elsewhere'));
      const otherRoom = await welcomeOf(otherHost);
      expect(await attempt(server.port, room.roomId, otherRoom.token)).toEqual({
        type: 'error', code: 'seat-expired', reason: 'server-restarted',
      });

      send(host, { type: 'leave' });
      await host.closed;
      expect(await attempt(server.port, room.roomId, room.token)).toEqual({
        type: 'error', code: 'seat-expired', reason: 'room-closed', detail: 'host-left',
      });
      expect(server.metrics().resumeFailures).toEqual({
        'seat-not-found': 1, 'server-restarted': 1, 'room-closed': 1,
      });
    } finally {
      closeAll(clients);
      await Promise.all([server.close(), otherBoot.close()]);
    }
  });

  it('tells a replaced tab it lost the seat before closing it with 4001', async () => {
    const server = await startOnlineServer({ port: 0 });
    const clients: Client[] = [];
    try {
      const [first, second] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(first, second);
      send(first, createMessage('Host'));
      const room = await welcomeOf(first);
      send(second, resumeMessage(room.roomId, room.token));
      await welcomeOf(second);

      expect(await first.next('error')).toEqual({
        type: 'error', code: 'seat-expired', reason: 'replaced',
      });
      expect(await first.closed).toBe(4001);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('sends a returning seat the full state, then resumes after the delay', async () => {
    const server = await startOnlineServer({
      port: 0, reconnectGraceMs: 3000, resumeDelayMs: 150, tickIntervalMs: 5,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      const { host: room, guest: seat } = await startTwoPlayerMatch(host, guest);
      guest.socket.close();
      await waitFor(() => server.getRoomState(room.roomId)?.paused === true);

      const back = await connect(server.port);
      clients.push(back);
      send(back, resumeMessage(room.roomId, seat.token));
      await welcomeOf(back);
      const welcomedAt = Date.now();
      await back.next('start');
      const full = await back.next('snapshot');
      expect(full.type === 'snapshot' && full.state?.paused).toBe(true);

      const resumed = () => back.received.find(({ message }) => (
        message.type === 'snapshot' && message.state?.paused === false
      ));
      await waitFor(() => !!resumed(), 1500, 'the room to resume');
      const waited = resumed()!.at - welcomedAt;
      expect(waited).toBeGreaterThanOrEqual(100);
      expect(waited).toBeLessThan(1000);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('counts the resume delay from the last seat\'s return', async () => {
    const resumeDelayMs = 600;
    const server = await startOnlineServer({
      port: 0, reconnectGraceMs: 5000, resumeDelayMs, tickIntervalMs: 5,
    });
    const clients: Client[] = [];
    try {
      const [host, guest] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guest);
      const seats = await startTwoPlayerMatch(host, guest);
      const { roomId } = seats.host;
      host.socket.close();
      guest.socket.close();
      await waitFor(() => server.metrics().disconnects === 2);

      const comeBack = async (token: string) => {
        const client = await connect(server.port);
        clients.push(client);
        send(client, resumeMessage(roomId, token));
        await welcomeOf(client);
      };
      await comeBack(seats.host.token);
      await wait(resumeDelayMs / 2);
      await comeBack(seats.guest.token);
      const lastBackAt = Date.now();

      await waitFor(() => server.getRoomState(roomId)?.paused === false, 2000, 'the match to resume');
      // Counted from the first return, it would resume half a delay early.
      expect(Date.now() - lastBackAt).toBeGreaterThan(resumeDelayMs * 0.75);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('shuts down promptly, telling seated players the server restarted', async () => {
    const server = await startOnlineServer({ port: 0, shutdownGraceMs: 300 });
    const [seated, seatless] = await Promise.all([0, 1].map(() => connect(server.port)));
    try {
      send(seated, createMessage('Host'));
      await welcomeOf(seated);

      const startedAt = Date.now();
      const outcome = await Promise.race([
        server.close().then(() => 'closed'),
        wait(2000).then(() => 'still pending after 2 s'),
      ]);
      expect(outcome).toBe('closed');
      expect(Date.now() - startedAt).toBeLessThan(800);
      expect(await seated.next('room-closed')).toEqual({
        type: 'room-closed', reason: 'server', detail: 'restart',
      });
      expect(await seated.closed).toBe(1001);
      expect(await seatless.closed).toBe(1001);
    } finally {
      closeAll([seated, seatless]);
    }
  });

  it('cuts off a client that ignores the close after the shutdown grace', async () => {
    const server = await startOnlineServer({ port: 0, shutdownGraceMs: 200 });
    const stuck = await connect(server.port);
    try {
      // A paused reader never answers the close frame.
      stuck.socket.pause();
      const startedAt = Date.now();
      const outcome = await Promise.race([
        server.shutdown('SIGTERM').then(() => 'closed'),
        wait(2000).then(() => 'still pending after 2 s'),
      ]);
      expect(outcome).toBe('closed');
      expect(Date.now() - startedAt).toBeGreaterThanOrEqual(150);
      expect(Date.now() - startedAt).toBeLessThan(1000);
    } finally {
      stuck.socket.terminate();
    }
  });
});
