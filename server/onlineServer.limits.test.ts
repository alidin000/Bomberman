// @vitest-environment node
import WebSocket from 'ws';
import { IPV6_SITE_FACTOR, ONLINE_SERVER_LIMITS, startOnlineServer } from './onlineServer';
import {
  Client, closeAll, connect, createMessage, firstOf, joinMessage, resumeMessage, send,
  startTwoPlayerMatch, wait, waitFor, welcomeOf,
} from './testUtils';

// Every socket in these tests comes from 127.0.0.1, so in the default
// 'socket' mode they all count against one address.
describe('room server admission limits', () => {
  it('caps the rooms one address keeps open, not the creates it sends', async () => {
    const server = await startOnlineServer({
      port: 0, maxRoomsPerIp: 2, createBurst: 10, createCooldownMs: 0,
    });
    const clients: Client[] = [];
    try {
      const answers: string[] = [];
      for (let index = 0; index < 5; index += 1) {
        // Sequential, so the first two creates are the ones that win.
        // eslint-disable-next-line no-await-in-loop
        const client = await connect(server.port);
        clients.push(client);
        send(client, createMessage(`Host ${index}`));
        // eslint-disable-next-line no-await-in-loop
        const answer = await firstOf(client, ['welcome', 'error']);
        answers.push(answer.type === 'error' ? answer.code : answer.type);
      }
      expect(answers).toEqual([
        'welcome', 'welcome', 'too-many-rooms', 'too-many-rooms', 'too-many-rooms',
      ]);

      // Closing a room gives its slot back to the address.
      send(clients[0], { type: 'leave' });
      await waitFor(() => server.roomCount() === 1);
      const late = await connect(server.port);
      clients.push(late);
      send(late, createMessage('Late'));
      await welcomeOf(late);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('lets one address open its whole room cap at once by default', async () => {
    const { maxRoomsPerIp } = ONLINE_SERVER_LIMITS;
    const server = await startOnlineServer({ port: 0, now: () => 4_000_000 });
    const clients: Client[] = [];
    try {
      // A class behind one router: every group presses Create together.
      const hosts = await Promise.all(
        Array.from({ length: maxRoomsPerIp + 1 }, () => connect(server.port))
      );
      clients.push(...hosts);
      hosts.forEach((host, index) => send(host, createMessage(`Host ${index}`)));
      const answers = await Promise.all(hosts.map(async (host) => {
        const answer = await firstOf(host, ['welcome', 'error']);
        return answer.type === 'error' ? answer.code : answer.type;
      }));
      expect(answers.filter((answer) => answer === 'welcome')).toHaveLength(maxRoomsPerIp);
      expect(answers.filter((answer) => answer !== 'welcome')).toEqual(['too-many-rooms']);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('refills the create bucket over time and enforces a cooldown between creates', async () => {
    let clock = 1_000_000;
    const server = await startOnlineServer({
      port: 0,
      createBurst: 2,
      createRefillMs: 10_000,
      createCooldownMs: 1000,
      now: () => clock,
    });
    const clients: Client[] = [];
    const tryCreate = async () => {
      const client = await connect(server.port);
      clients.push(client);
      send(client, createMessage('Host'));
      const answer = await firstOf(client, ['welcome', 'error']);
      return answer.type === 'error' ? answer.code : answer.type;
    };
    try {
      expect(await tryCreate()).toBe('welcome');
      // Inside the cooldown, even with a token left.
      expect(await tryCreate()).toBe('rate-limited');
      clock += 1000;
      expect(await tryCreate()).toBe('welcome');
      clock += 1000;
      // Two creates spent the burst of two; refill is one per 10 s.
      expect(await tryCreate()).toBe('rate-limited');
      clock += 10_000;
      expect(await tryCreate()).toBe('welcome');
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('turns away a socket over the server-wide cap with server-busy and 1013', async () => {
    const server = await startOnlineServer({ port: 0, maxSockets: 3 });
    const clients: Client[] = [];
    try {
      clients.push(...await Promise.all([0, 1, 2].map(() => connect(server.port))));
      const fourth = await connect(server.port);
      clients.push(fourth);
      expect(await fourth.next('error')).toEqual({ type: 'error', code: 'server-busy' });
      expect(await fourth.closed).toBe(1013);

      // A closed socket frees its place.
      clients[0].socket.close();
      await clients[0].closed;
      await waitFor(() => server.metrics().sockets.seatless === 2);
      const fifth = await connect(server.port);
      clients.push(fifth);
      send(fifth, createMessage('Fifth'));
      await welcomeOf(fifth);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('turns away a socket over the per-address cap with too-many-connections and 1008', async () => {
    const server = await startOnlineServer({ port: 0, maxSocketsPerIp: 2 });
    const clients: Client[] = [];
    try {
      clients.push(...await Promise.all([0, 1].map(() => connect(server.port))));
      const third = await connect(server.port);
      clients.push(third);
      expect(await third.next('error')).toEqual({ type: 'error', code: 'too-many-connections' });
      expect(await third.closed).toBe(1008);
      expect(server.metrics().sockets.seatless).toBe(2);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  describe('client address', () => {
    // One socket per address makes the key visible: a second socket from
    // the same key is turned away.
    const open = async (
      port: number,
      clients: Client[],
      forwardedFor?: string
    ): Promise<'admitted' | string> => {
      const client = await connect(port, forwardedFor === undefined
        ? {}
        : { headers: { 'X-Forwarded-For': forwardedFor } });
      clients.push(client);
      const outcome = await Promise.race([
        client.next('error', 300).then((error) => (error.type === 'error' ? error.code : 'error')),
        wait(150).then(() => 'admitted'),
      ]).catch(() => 'admitted');
      return outcome;
    };

    it('ignores X-Forwarded-For in socket mode', async () => {
      const server = await startOnlineServer({ port: 0, maxSocketsPerIp: 1 });
      const clients: Client[] = [];
      try {
        expect(await open(server.port, clients, '198.51.100.1')).toBe('admitted');
        expect(await open(server.port, clients, '198.51.100.2')).toBe('too-many-connections');
      } finally {
        closeAll(clients);
        await server.close();
      }
    });

    it('keys xff-right:1 by the entry the proxy appended', async () => {
      const server = await startOnlineServer({
        port: 0, maxSocketsPerIp: 1, clientIpSource: 'xff-right:1',
      });
      const clients: Client[] = [];
      try {
        expect(await open(server.port, clients, '1.1.1.1, 203.0.113.7')).toBe('admitted');
        expect(await open(server.port, clients, '2.2.2.2, 203.0.113.7'))
          .toBe('too-many-connections');
        expect(await open(server.port, clients, '2.2.2.2, 203.0.113.8')).toBe('admitted');
      } finally {
        closeAll(clients);
        await server.close();
      }
    });

    it('reads past an xff-left entry that is not an address before using the socket', async () => {
      const server = await startOnlineServer({
        port: 0, maxSocketsPerIp: 1, clientIpSource: 'xff-left',
      });
      const clients: Client[] = [];
      try {
        // A proxy that hides who it serves writes 'unknown' first.
        expect(await open(server.port, clients, 'unknown, 203.0.113.5')).toBe('admitted');
        expect(await open(server.port, clients, '203.0.113.5')).toBe('too-many-connections');
        // Some proxies add the port.
        expect(await open(server.port, clients, '203.0.113.6:51234, 198.51.100.1')).toBe('admitted');
        expect(await open(server.port, clients, '203.0.113.6')).toBe('too-many-connections');
        // Nothing usable: the socket address.
        expect(await open(server.port, clients, 'unknown')).toBe('admitted');
        expect(await open(server.port, clients)).toBe('too-many-connections');
        // IPv6 counts by its /64, so one household is one key.
        expect(await open(server.port, clients, '2001:db8:1:2::1')).toBe('admitted');
        expect(await open(server.port, clients, '[2001:db8:1:2:ffff::9]:443'))
          .toBe('too-many-connections');
      } finally {
        closeAll(clients);
        await server.close();
      }
    });

    // A home or a free tunnel can hold a whole /48: 65,536 /64s.
    const inSite = (subnet: number, host = 1) => `2001:db8:aa:${subnet.toString(16)}::${host}`;

    it('caps the sockets of an IPv6 /48 at a multiple of one address\'s', async () => {
      const server = await startOnlineServer({
        port: 0, maxSocketsPerIp: 1, clientIpSource: 'xff-left',
      });
      const clients: Client[] = [];
      try {
        for (let subnet = 0; subnet < IPV6_SITE_FACTOR; subnet += 1) {
          // eslint-disable-next-line no-await-in-loop
          expect(await open(server.port, clients, inSite(subnet))).toBe('admitted');
        }
        expect(await open(server.port, clients, inSite(IPV6_SITE_FACTOR)))
          .toBe('too-many-connections');
        expect(await open(server.port, clients, '2001:db8:ab::1')).toBe('admitted');
        expect(server.metrics().rejects).toEqual({ 'max-sockets-per-site': 1 });
      } finally {
        closeAll(clients);
        await server.close();
      }
    });

    it('caps the rooms and failed joins of an IPv6 /48 at a multiple of one address\'s', async () => {
      const server = await startOnlineServer({
        port: 0,
        maxRoomsPerIp: 1,
        joinFailBurst: 1,
        joinFailRefillMs: 3_600_000,
        clientIpSource: 'xff-left',
        now: () => 2_000_000,
      });
      const clients: Client[] = [];
      const ask = async (address: string, message: object) => {
        const client = await connect(server.port, { headers: { 'X-Forwarded-For': address } });
        clients.push(client);
        send(client, message);
        const answer = await firstOf(client, ['welcome', 'error']);
        return answer.type === 'error' ? answer.code : answer.type;
      };
      try {
        const creates: string[] = [];
        const guesses: string[] = [];
        for (let subnet = 0; subnet <= IPV6_SITE_FACTOR; subnet += 1) {
          // eslint-disable-next-line no-await-in-loop
          creates.push(await ask(inSite(subnet), createMessage(`Host ${subnet}`)));
          // eslint-disable-next-line no-await-in-loop
          guesses.push(await ask(inSite(subnet, 2), joinMessage('ZZZZZZ', 'Guess')));
        }
        const expected = (allowed: string, refused: string) => [
          ...Array(IPV6_SITE_FACTOR).fill(allowed), refused,
        ];
        expect(creates).toEqual(expected('welcome', 'too-many-rooms'));
        expect(guesses).toEqual(expected('room-not-found', 'rate-limited'));
        // Another /48 has its own allowance.
        expect(await ask('2001:db8:ab::1', createMessage('Elsewhere'))).toBe('welcome');
      } finally {
        closeAll(clients);
        await server.close();
      }
    });
  });

  it('closes a guesser after its failed joins and keeps the address limited', async () => {
    let clock = 5_000_000;
    const server = await startOnlineServer({
      port: 0, joinFailBurst: 3, joinFailRefillMs: 60_000, now: () => clock,
    });
    const clients: Client[] = [];
    try {
      const guesser = await connect(server.port);
      clients.push(guesser);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        send(guesser, joinMessage('ZZZZZZ', 'Guess'));
        // Answers arrive in order; each must be read before the next join.
        // eslint-disable-next-line no-await-in-loop
        expect(await guesser.next('error')).toEqual({ type: 'error', code: 'room-not-found' });
      }
      send(guesser, joinMessage('ZZZZZY', 'Guess'));
      expect(await guesser.next('error')).toEqual({ type: 'error', code: 'rate-limited' });
      expect(await guesser.closed).toBe(1008);

      // A fresh socket from the same address starts with the empty bucket.
      const again = await connect(server.port);
      clients.push(again);
      send(again, joinMessage('ZZZZZX', 'Guess'));
      expect(await again.next('error')).toEqual({ type: 'error', code: 'rate-limited' });
      expect(await again.closed).toBe(1008);

      clock += 60_000;
      const later = await connect(server.port);
      clients.push(later);
      send(later, joinMessage('ZZZZZW', 'Guess'));
      expect(await later.next('error')).toEqual({ type: 'error', code: 'room-not-found' });
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('answers a full or started room without spending the failed-join budget', async () => {
    const server = await startOnlineServer({
      port: 0,
      joinFailBurst: 2,
      joinFailRefillMs: 3_600_000,
      createCooldownMs: 0,
      now: () => 8_000_000,
    });
    const clients: Client[] = [];
    // Every socket here shares 127.0.0.1, like a class behind one router.
    const open = async () => {
      const client = await connect(server.port);
      clients.push(client);
      return client;
    };
    const joinAnswer = async (roomId: string) => {
      const client = await open();
      send(client, joinMessage(roomId, 'Late'));
      const answer = await firstOf(client, ['welcome', 'error']);
      return answer.type === 'error' ? answer.code : answer.type;
    };
    try {
      const fullHost = await open();
      send(fullHost, createMessage('Full'));
      const full = await welcomeOf(fullHost);
      for (let guest = 1; guest < 4; guest += 1) {
        // eslint-disable-next-line no-await-in-loop
        expect(await joinAnswer(full.roomId)).toBe('welcome');
      }
      const { host: started } = await startTwoPlayerMatch(await open(), await open());

      // A right code is no guess, however often the room turns it away.
      const refusals: string[] = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        refusals.push(await joinAnswer(full.roomId), await joinAnswer(started.roomId));
      }
      expect(refusals).toEqual(Array(3).fill(['room-full', 'match-started']).flat());

      const openHost = await open();
      send(openHost, createMessage('Open'));
      expect(await joinAnswer((await welcomeOf(openHost)).roomId)).toBe('welcome');
      expect(server.metrics().rateLimits).toEqual({});
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('still lets a seat holder resume after its address spent the failed-join bucket', async () => {
    const server = await startOnlineServer({
      port: 0, joinFailBurst: 1, joinFailRefillMs: 3_600_000, now: () => 7_000_000,
    });
    const clients: Client[] = [];
    try {
      const [host, guesser] = await Promise.all([0, 1].map(() => connect(server.port)));
      clients.push(host, guesser);
      send(host, createMessage('Host'));
      const room = await welcomeOf(host);
      // Someone else behind the same address guesses codes.
      send(guesser, joinMessage('ZZZZZZ', 'Guess'));
      expect(await guesser.next('error')).toEqual({ type: 'error', code: 'room-not-found' });
      send(guesser, joinMessage('ZZZZZY', 'Guess'));
      expect(await guesser.next('error')).toEqual({ type: 'error', code: 'rate-limited' });

      host.socket.close();
      await host.closed;
      const back = await connect(server.port);
      clients.push(back);
      send(back, resumeMessage(room.roomId, room.token));
      expect((await welcomeOf(back)).seat).toBe(0);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('closes a socket that never takes a seat with 4002, and only that socket', async () => {
    const server = await startOnlineServer({ port: 0, unseatedTimeoutMs: 80 });
    const clients: Client[] = [];
    try {
      const [idle, failed, seated] = await Promise.all(
        [0, 1, 2].map(() => connect(server.port))
      );
      clients.push(idle, failed, seated);
      send(seated, createMessage('Seated'));
      await welcomeOf(seated);
      send(failed, joinMessage('ZZZZZZ', 'Lost'));
      expect(await failed.next('error')).toEqual({ type: 'error', code: 'room-not-found' });

      expect(await idle.closed).toBe(4002);
      expect(await failed.closed).toBe(4002);
      await wait(100);
      expect(seated.socket.readyState).toBe(WebSocket.OPEN);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('answers a socket over the per-address connect rate with rate-limited and 1008', async () => {
    let clock = 9_000_000;
    const server = await startOnlineServer({
      port: 0, connectBurst: 2, connectRefillMs: 1000, now: () => clock,
    });
    const clients: Client[] = [];
    try {
      clients.push(await connect(server.port), await connect(server.port));
      // Upgraded and told why, so the browser can say more than "unreachable".
      const third = await connect(server.port);
      clients.push(third);
      expect(await third.next('error')).toEqual({ type: 'error', code: 'rate-limited' });
      expect(await third.closed).toBe(1008);
      expect(server.metrics().rateLimits).toEqual({ connect: 1 });

      clock += 1000;
      const fourth = await connect(server.port);
      clients.push(fourth);
      send(fourth, createMessage('Fourth'));
      await welcomeOf(fourth);
    } finally {
      closeAll(clients);
      await server.close();
    }
  });

  it('matches origins by their normalised form and allows localhost only without a list', async () => {
    const listed = await startOnlineServer({
      port: 0, allowedOrigins: ['https://game.example/'],
    });
    const open = await startOnlineServer({ port: 0 });
    const clients: Client[] = [];
    try {
      // The configured value has a trailing slash; browsers send none.
      clients.push(await connect(listed.port, { origin: 'https://game.example' }));
      await expect(connect(listed.port, { origin: 'http://localhost:5173' }))
        .rejects.toThrow('403');
      await expect(connect(listed.port, { origin: 'https://evil.example' }))
        .rejects.toThrow('403');

      clients.push(await connect(open.port, { origin: 'http://localhost:5173' }));
      await expect(connect(open.port, { origin: 'https://evil.example' }))
        .rejects.toThrow('403');
    } finally {
      closeAll(clients);
      await Promise.all([listed.close(), open.close()]);
    }
  });
});
