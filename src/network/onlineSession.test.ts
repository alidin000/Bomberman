// @vitest-environment node
import { once } from 'node:events';
import { AddressInfo, createServer } from 'node:net';
import WebSocket, { WebSocketServer } from 'ws';
import { OnlineServer, OnlineServerOptions, startOnlineServer } from '../../server/onlineServer';
import { wait, waitFor, waitForLiveRound } from '../../server/testUtils';
import { findOnlineProblem } from '../view/OnlineScreen/onlineCopy';
import { OnlineSession, OnlineSessionOptions, OnlineSessionSnapshot } from './onlineSession';

// The key a tab keeps its seat under; a duplicated tab copies it.
const SEAT_KEY = 'shinobiOnlineSeat';

/** The sockets one browser tab opens, which a test can cut or point at a dead port. */
type Wire = {
  Socket: typeof globalThis.WebSocket;
  sockets: WebSocket[];
  /** Off, new sockets go to a port nothing listens on, as during an outage. */
  reachable: boolean;
  /** Drops the live socket without a close frame, as a lost network does. */
  cut: () => void;
};

type Tab = {
  session: OnlineSession;
  wire: Wire;
  storage: Map<string, string> & {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
};

let deadUrl = '';

beforeAll(async () => {
  // A port that was free a moment ago refuses connections at once.
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  deadUrl = `ws://127.0.0.1:${(probe.address() as AddressInfo).port}`;
  probe.close();
  await once(probe, 'close');
});

function wireFor(rewrite?: (data: string) => string): Wire {
  const wire = { sockets: [] as WebSocket[], reachable: true } as Wire;
  class TabSocket extends WebSocket {
    constructor(url: string) {
      super(wire.reachable ? url : deadUrl);
      wire.sockets.push(this);
      if (rewrite) {
        const send = this.send.bind(this);
        this.send = ((data: string) => send(rewrite(data))) as WebSocket['send'];
      }
    }
  }
  wire.Socket = TabSocket as unknown as typeof globalThis.WebSocket;
  wire.cut = () => wire.sockets[wire.sockets.length - 1]?.terminate();
  return wire;
}

function memoryStorage(): Tab['storage'] {
  const items = new Map<string, string>();
  return Object.assign(items, {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => { items.set(key, value); },
    removeItem: (key: string) => { items.delete(key); },
  });
}

function tabOn(
  port: number,
  options: Partial<OnlineSessionOptions> & { rewrite?: (data: string) => string } = {}
): Tab {
  const { rewrite, ...sessionOptions } = options;
  const wire = wireFor(rewrite);
  const storage = memoryStorage();
  const session = new OnlineSession({
    url: `ws://127.0.0.1:${port}`, WebSocket: wire.Socket, storage, ...sessionOptions,
  });
  return { session, wire, storage };
}

function startQuietServer(options: OnlineServerOptions = {}): Promise<OnlineServer> {
  return startOnlineServer({ port: 0, log: () => undefined, ...options });
}

function until(
  session: OnlineSession,
  condition: (snapshot: OnlineSessionSnapshot) => boolean,
  what: string,
  timeoutMs = 2000
): Promise<void> {
  return waitFor(() => condition(session.getSnapshot()), timeoutMs, what);
}

function problemOf(session: OnlineSession) {
  return findOnlineProblem(session.getSnapshot().error);
}

async function openRoom(host: OnlineSession): Promise<string> {
  host.create('Host', 'naruto', 'arena', 'hiddenLeaf', 3);
  await until(host, (snapshot) => snapshot.status === 'lobby' && !!snapshot.roomId, 'the room to open');
  return host.getSnapshot().roomId;
}

async function joinRoom(guest: OnlineSession, roomId: string): Promise<void> {
  guest.join(roomId, 'Guest', 'sasuke');
  await until(guest, (snapshot) => snapshot.status === 'lobby' && snapshot.seat === 1, 'the guest seat');
}

/** Both seats ready up; `start` is how the host presses Start battle. */
async function readyAndStart(
  host: OnlineSession,
  guest: OnlineSession,
  start = () => host.startMatch()
): Promise<void> {
  host.setReady(true);
  guest.setReady(true);
  await until(
    host,
    ({ players }) => players.length === 2 && players.every((player) => player.ready),
    'both seats ready'
  );
  start();
  await until(host, (snapshot) => !!snapshot.gameState, 'the host to see the match');
}

function leaveAll(tabs: Tab[]): void {
  tabs.forEach((tab) => tab.session.leave());
}

describe('online session against the room server', () => {
  it('stays closed when its room closes, and never tries to rejoin it', async () => {
    const server = await startQuietServer();
    const host = tabOn(server.port);
    const guest = tabOn(server.port);
    try {
      await joinRoom(guest.session, await openRoom(host.session));
      host.session.leave();
      await until(guest.session, (snapshot) => snapshot.status === 'closed', 'the room to close');
      // Past the first rejoin delay (500 ms), when an old client resumed.
      await wait(800);

      expect(problemOf(guest.session)?.title).toBe('The host left the room');
      expect(guest.session.getSnapshot()).toMatchObject({
        status: 'closed', roomId: '', token: '', gameState: null,
      });
      expect(guest.storage.size).toBe(0);
      expect(guest.wire.sockets).toHaveLength(1);
      expect(server.metrics().resumeFailures).toEqual({});
    } finally {
      leaveAll([host, guest]);
      await server.close();
    }
  });

  it('keeps saying the game is out of date after the server closes the socket', async () => {
    const server = await startQuietServer();
    // A tab left open across a rules change still sends the old version.
    const stale = tabOn(server.port, {
      rewrite: (data) => data.replace(
        /"simulation":(\d+)/,
        (_, version) => `"simulation":${Number(version) - 1}`
      ),
    });
    try {
      stale.session.create('Host', 'naruto', 'arena', 'hiddenLeaf', 3);
      await waitFor(
        () => stale.wire.sockets[0]?.readyState === WebSocket.CLOSED,
        2000,
        'the server to close the socket'
      );

      expect(problemOf(stale.session)?.title).toBe('This game is out of date');
      expect(stale.session.getSnapshot().status).toBe('closed');
      expect(stale.wire.sockets).toHaveLength(1);
    } finally {
      leaveAll([stale]);
      await server.close();
    }
  });

  it('keeps the server\'s reason when it refuses a socket and closes it', async () => {
    const server = await startQuietServer({ maxSocketsPerIp: 1 });
    const host = tabOn(server.port);
    const guest = tabOn(server.port);
    try {
      const roomId = await openRoom(host.session);
      guest.session.join(roomId, 'Guest', 'sasuke');
      await waitFor(
        () => guest.wire.sockets[0]?.readyState === WebSocket.CLOSED,
        2000,
        'the refused socket to close'
      );

      expect(problemOf(guest.session)?.title).toBe('Too many connections from your network');
      expect(guest.session.getSnapshot().status).toBe('closed');
    } finally {
      leaveAll([host, guest]);
      await server.close();
    }
  });

  it('says a network is trying too often, not that the server is unreachable', async () => {
    const server = await startQuietServer({ connectBurst: 1, connectRefillMs: 60_000 });
    const host = tabOn(server.port);
    const guest = tabOn(server.port);
    try {
      // The second socket from one address within the refill.
      const roomId = await openRoom(host.session);
      guest.session.join(roomId, 'Guest', 'sasuke');
      await until(guest.session, (snapshot) => snapshot.status === 'closed', 'the refusal');

      expect(problemOf(guest.session)?.title).toBe('Too many tries at once');
    } finally {
      leaveAll([host, guest]);
      await server.close();
    }
  });

  it('lets go of its socket when a join is refused', async () => {
    const server = await startQuietServer();
    const guest = tabOn(server.port);
    try {
      guest.session.join('ABC234', 'Guest', 'sasuke');
      await until(guest.session, (snapshot) => snapshot.status === 'closed', 'the join to fail');
      // The server would hold a seatless socket open until its own timeout.
      await waitFor(() => server.metrics().sockets.seatless === 0, 1000, 'the refused socket to close');

      expect(problemOf(guest.session)?.title).toBe('No room has that code');
    } finally {
      leaveAll([guest]);
      await server.close();
    }
  });

  it('gives up rejoining at the deadline, then Try again takes the seat back', async () => {
    const server = await startQuietServer({ reconnectGraceMs: 10_000 });
    const host = tabOn(server.port, { reconnectDeadlineMs: 1200 });
    try {
      const roomId = await openRoom(host.session);
      host.wire.reachable = false;
      host.wire.cut();
      await until(host.session, (snapshot) => snapshot.status === 'reconnecting', 'the first rejoin');
      await until(host.session, (snapshot) => snapshot.status === 'closed', 'the session to give up', 3000);

      expect(problemOf(host.session)).toMatchObject({ title: 'Could not rejoin the room', retry: true });
      // The seat may outlive the network trouble, so the session keeps it.
      expect(host.session.getSnapshot()).toMatchObject({
        roomId, token: expect.stringMatching(/^[0-9a-f]{32}$/),
      });
      const tries = host.wire.sockets.length;
      await wait(1000);
      expect(host.wire.sockets).toHaveLength(tries);

      host.wire.reachable = true;
      host.session.rejoin();
      await until(
        host.session,
        (snapshot) => snapshot.status === 'lobby' && snapshot.connected,
        'the seat to come back'
      );
      expect(host.session.getSnapshot()).toMatchObject({ roomId, seat: 0, error: '' });
      expect(server.metrics().reconnects).toBe(1);
    } finally {
      leaveAll([host]);
      await server.close();
    }
  }, 10_000);

  it('keeps the notice of a dropped player through snapshots and clears it on their return', async () => {
    const server = await startQuietServer({ reconnectGraceMs: 10_000, resumeDelayMs: 50 });
    const host = tabOn(server.port);
    const guest = tabOn(server.port);
    try {
      await joinRoom(guest.session, await openRoom(host.session));
      host.session.setReady(true);
      guest.session.setReady(true);
      await until(
        host.session,
        ({ players }) => players.length === 2 && players.every((player) => player.ready),
        'both seats ready'
      );
      host.session.startMatch();
      await until(guest.session, (snapshot) => !!snapshot.gameState, 'the guest to see the match');

      guest.wire.reachable = false;
      guest.wire.cut();
      // The server pauses with a snapshot sent right after the notice.
      await until(host.session, (snapshot) => snapshot.gameState?.paused === true, 'the pause snapshot');
      expect(host.session.getSnapshot().error).toBe('Player 2 reconnecting (10s)');
      await until(
        host.session,
        (snapshot) => snapshot.error === 'Player 2 reconnecting (9s)',
        'the countdown to tick'
      );

      guest.wire.reachable = true;
      await until(
        host.session,
        (snapshot) => snapshot.players.every((player) => player.connected),
        'the guest to return',
        5000
      );
      expect(host.session.getSnapshot().error).toBe('');
    } finally {
      leaveAll([host, guest]);
      await server.close();
    }
  }, 10_000);

  it('drops a refused request\'s error at the next snapshot, so a double start does not cover the match', async () => {
    const server = await startQuietServer({ tickIntervalMs: 5 });
    const host = tabOn(server.port);
    const guest = tabOn(server.port);
    try {
      const roomId = await openRoom(host.session);
      await joinRoom(guest.session, roomId);
      // A double click: the second start reaches a room already playing.
      await readyAndStart(host.session, guest.session, () => {
        host.session.startMatch();
        host.session.startMatch();
      });
      await waitFor(() => server.metrics().protocolErrors.state === 1, 1000, 'the second start');
      // Snapshots sent after the refusal arrive after it.
      const tick = server.getRoomState(roomId)?.tick ?? 0;
      await until(host.session, (snapshot) => (snapshot.gameState?.tick ?? 0) > tick, 'later snapshots');

      expect(host.session.getSnapshot()).toMatchObject({ status: 'playing', error: '' });
    } finally {
      leaveAll([host, guest]);
      await server.close();
    }
  });

  it('lets a tab that takes the seat over mid-match play on', async () => {
    const server = await startQuietServer({ tickIntervalMs: 5 });
    const first = tabOn(server.port);
    const guest = tabOn(server.port);
    const copy = tabOn(server.port);
    try {
      const roomId = await openRoom(first.session);
      await joinRoom(guest.session, roomId);
      await readyAndStart(first.session, guest.session);
      await waitForLiveRound(server, roomId);
      // The first tab plays a while; the server acknowledges its inputs.
      for (let step = 0; step < 20; step += 1) {
        first.session.input('up');
        first.session.input(null);
      }
      await until(first.session, (snapshot) => snapshot.ack === 39, 'the first tab\'s inputs');

      first.storage.forEach((value, key) => copy.storage.setItem(key, value));
      copy.session.resumeStored(roomId);
      await until(copy.session, (snapshot) => !!snapshot.gameState, 'the copy to take the seat');
      await until(first.session, (snapshot) => snapshot.status === 'closed', 'the first tab to stop');
      // The copy's own first input, numbered from zero like any new tab's.
      copy.session.input(undefined, 'bomb');

      await waitFor(
        () => !!server.getRoomState(roomId)?.bombs.some((bomb) => bomb.ownerId === 'player1'),
        1000,
        'the copy\'s bomb'
      );
    } finally {
      leaveAll([first, guest, copy]);
      await server.close();
    }
  });

  it('lets a duplicated tab keep the seat instead of trading it back and forth', async () => {
    const server = await startQuietServer();
    const first = tabOn(server.port);
    const copy = tabOn(server.port);
    try {
      const roomId = await openRoom(first.session);
      // Duplicating a tab copies its sessionStorage, seat token included.
      first.storage.forEach((value, key) => copy.storage.setItem(key, value));
      copy.session.resumeStored(roomId);
      await until(copy.session, (snapshot) => snapshot.status === 'lobby', 'the copy to take the seat');
      await until(first.session, (snapshot) => snapshot.status === 'closed', 'the first tab to stop');
      // Old clients took the seat back every 500 ms or so.
      await wait(1200);

      expect(problemOf(first.session)?.title).toBe('This room is open in another tab');
      expect(first.session.getSnapshot()).toMatchObject({ roomId: '', token: '' });
      expect(first.wire.sockets).toHaveLength(1);
      expect(copy.session.getSnapshot()).toMatchObject({
        status: 'lobby', connected: true, roomId, seat: 0,
      });
      expect(server.metrics()).toMatchObject({ reconnects: 1, resumeFailures: { replaced: 1 } });
    } finally {
      leaveAll([first, copy]);
      await server.close();
    }
  });

  it('treats a bare 4001 close from an older server as final', async () => {
    // Older servers closed a replaced tab with 4001 and sent nothing first.
    const olderServer = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await once(olderServer, 'listening');
    const accepted: WebSocket[] = [];
    olderServer.on('connection', (socket) => {
      accepted.push(socket);
      socket.once('message', () => socket.send(JSON.stringify({
        type: 'welcome', roomId: 'ABC234', seat: 0, playerId: 'player1', token: 'a'.repeat(32),
      })));
    });
    const tab = tabOn((olderServer.address() as AddressInfo).port);
    try {
      tab.session.create('Host', 'naruto', 'arena', 'hiddenLeaf', 3);
      await until(tab.session, (snapshot) => snapshot.roomId === 'ABC234', 'the welcome');
      accepted[0].close(4001, 'Session replaced');
      await until(tab.session, (snapshot) => snapshot.status === 'closed', 'the tab to stop');
      await wait(800);

      expect(accepted).toHaveLength(1);
      expect(problemOf(tab.session)?.title).toBe('This room is open in another tab');
    } finally {
      leaveAll([tab]);
      olderServer.clients.forEach((socket) => socket.terminate());
      olderServer.close();
    }
  });

  it('names why a resume failed and closes the socket it asked on', async () => {
    const server = await startQuietServer();
    const otherBoot = await startQuietServer();
    const host = tabOn(server.port);
    const elsewhere = tabOn(otherBoot.port);
    const returning: Tab[] = [];
    const resumeTitle = async (roomId: string, token: string) => {
      const tab = tabOn(server.port);
      returning.push(tab);
      tab.storage.setItem(SEAT_KEY, JSON.stringify({ roomId, token }));
      tab.session.resumeStored(roomId);
      await until(tab.session, (snapshot) => snapshot.status === 'closed', 'the resume to fail');
      // The server keeps a seatless socket open; the client must let it go.
      await waitFor(() => server.metrics().sockets.seatless === 0, 1000, 'the failed socket to close');
      expect(tab.session.getSnapshot()).toMatchObject({ roomId: '', token: '' });
      expect(tab.storage.size).toBe(0);
      return problemOf(tab.session)?.title;
    };
    try {
      const roomId = await openRoom(host.session);
      const { token } = host.session.getSnapshot();

      // The room is live, but no seat holds this token.
      expect(await resumeTitle(roomId, `${token.slice(0, 8)}${'0'.repeat(24)}`))
        .toBe('Your seat was released');
      // Another boot issued this token: the server restarted since.
      await openRoom(elsewhere.session);
      expect(await resumeTitle(roomId, elsewhere.session.getSnapshot().token))
        .toBe('The server restarted for an update');
      // The room closed; the server still remembers why.
      host.session.leave();
      await waitFor(() => server.roomCount() === 0, 1000, 'the room to close');
      expect(await resumeTitle(roomId, token)).toBe('The host left the room');
    } finally {
      leaveAll([host, elsewhere, ...returning]);
      await Promise.all([server.close(), otherBoot.close()]);
    }
  });
});
