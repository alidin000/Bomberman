// @vitest-environment node
import WebSocket from 'ws';
import { startOnlineServer } from './onlineServer';
import { arenaMapRows } from '../src/content/arenaMaps';
import {
  PROTOCOL_VERSION, SIMULATION_VERSION, ServerMessage,
} from '../src/network/protocol';

// Arena rooms on the city maps (protocol 4): the room names its map, the
// server loads the city's grid from the catalog, and the clients get it in
// `start`, as Local Arena plays it.

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
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    if (index >= 0) waiters.splice(index, 1)[0].resolve(message);
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
      return new Promise((resolve) => { waiters.push({ type, resolve }); });
    },
  };
}

const send = (client: Client, message: object) => client.socket.send(JSON.stringify(message));
const wait = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms); });

const create = (extra: object = {}) => ({
  type: 'create',
  protocol: PROTOCOL_VERSION,
  simulation: SIMULATION_VERSION,
  name: 'Host',
  characterId: 'naruto',
  roomMode: 'arena',
  stageId: 'hiddenLeaf',
  totalRounds: 3,
  ...extra,
});

describe('online city rooms', () => {
  it('plays a city: the lobby names it, and the match starts on its grid with no stage', async () => {
    const server = await startOnlineServer({ port: 0 });
    const host = await connect(server.port);
    const guest = await connect(server.port);
    try {
      send(host, create({ arenaMapId: 'budapest' }));
      const welcome = await host.next('welcome');
      if (welcome.type !== 'welcome') throw new Error('Missing welcome');
      const lobby = await host.next('lobby');
      expect(lobby.type === 'lobby' && lobby.arenaMapId).toBe('budapest');
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
      send(guest, { type: 'ready', ready: true });
      await wait(30);
      send(host, { type: 'start-match' });
      const started = await guest.next('start');
      if (started.type !== 'start') throw new Error('Missing start');
      expect(started.config).toMatchObject({
        mode: 'onlinePreview', selectedMap: 'budapest', numPlayers: 2, totalRounds: 3,
      });
      expect(started.config.stageId).toBeUndefined();
      const grid = arenaMapRows('budapest');
      expect(started.config.map).toHaveLength(grid.length);
      expect(started.config.map[0]).toHaveLength(grid[0].length);
      // A city has no versus monsters, online as in Local Arena.
      const snapshot = await host.next('snapshot');
      expect(snapshot.type === 'snapshot' && snapshot.state?.monsters).toEqual([]);
    } finally {
      host.socket.close();
      guest.socket.close();
      await server.close();
    }
  });

  it('keeps a village room on its village, and refuses maps it cannot play', async () => {
    const server = await startOnlineServer({ port: 0 });
    const village = await connect(server.port);
    try {
      send(village, create({ stageId: 'hiddenSand' }));
      await village.next('welcome');
      const lobby = await village.next('lobby');
      expect(lobby.type === 'lobby' && lobby.arenaMapId).toBe('hiddenSand');
      // The playtest's control, an unknown map, and a co-op room naming one:
      // each refused as a bad message, which closes its connection.
      const refusals = [
        create({ arenaMapId: 'romeControl' }),
        create({ arenaMapId: 'atlantis' }),
        create({ roomMode: 'coop', arenaMapId: 'rome' }),
      ];
      await refusals.reduce((before, message) => before.then(async () => {
        const refused = await connect(server.port);
        send(refused, message);
        await expect(refused.next('error')).resolves.toMatchObject({ type: 'error', code: 'bad-message' });
        refused.socket.close();
      }), Promise.resolve());
    } finally {
      village.socket.close();
      await server.close();
    }
  });
});
