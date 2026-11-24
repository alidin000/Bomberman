// @vitest-environment node
import { getArenaMap } from '../content/arenaMaps';
import {
  MAX_CLIENT_MESSAGE_BYTES,
  ONLINE_CITY_MAPS,
  PROTOCOL_VERSION,
  isOnlineArenaMapId,
  SIMULATION_VERSION,
  parseClientMessage,
  parseServerMessage,
} from './protocol';

describe('online protocol', () => {
  it('accepts a versioned room request and trims no authority into it', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: 'Kakashi',
      characterId: 'naruto',
      roomMode: 'coop',
      stageId: 'hiddenSand',
      totalRounds: 1,
    }))).toEqual({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: 'Kakashi',
      characterId: 'naruto',
      roomMode: 'coop',
      stageId: 'hiddenSand',
      totalRounds: 1,
    });
  });

  it.each([
    '{',
    JSON.stringify({ type: 'create', name: 'A', characterId: 'naruto' }),
    JSON.stringify({
      type: 'create',
      protocol: 99,
      simulation: SIMULATION_VERSION,
      name: 'A',
      characterId: 'naruto',
    }),
    JSON.stringify({
      type: 'input', seq: 1, playerId: 'player2', action: { type: 'INIT' },
    }),
    JSON.stringify({
      type: 'input', seq: 1, playerId: 'player2', action: 'bomb',
    }),
    JSON.stringify({ type: 'input', seq: -1, action: 'bomb' }),
    // The village square's board and stall are solo-only: no online command.
    JSON.stringify({
      type: 'input', seq: 1, action: { type: 'ACCEPT_REQUEST', playerId: 'player1', requestId: 'x' },
    }),
    JSON.stringify({ type: 'input', seq: 1, action: 'purchase' }),
    JSON.stringify({ type: 'selection', characterId: 'not-a-character' }),
    JSON.stringify({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: 'A',
      characterId: 'naruto',
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      totalRounds: 2,
    }),
  ])('rejects untrusted client data: %s', (raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });

  it('lets an arena room name a village or a city, and nothing else', () => {
    const create = (extra: object) => JSON.stringify({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: 'Kakashi',
      characterId: 'naruto',
      roomMode: 'arena',
      stageId: 'hiddenLeaf',
      totalRounds: 3,
      ...extra,
    });
    expect(PROTOCOL_VERSION).toBe(4);
    expect(ONLINE_CITY_MAPS).toEqual(['rome', 'barcelona', 'budapest']);
    expect(parseClientMessage(create({ arenaMapId: 'rome' }))).toMatchObject({ arenaMapId: 'rome' });
    expect(parseClientMessage(create({ arenaMapId: 'hiddenMist' }))).toMatchObject({
      arenaMapId: 'hiddenMist',
    });
    expect(parseClientMessage(create({}))).not.toBeNull();
    // The playtest's control, unknown ids, and a co-op room naming a map.
    expect(parseClientMessage(create({ arenaMapId: 'romeControl' }))).toBeNull();
    expect(parseClientMessage(create({ arenaMapId: 'paris' }))).toBeNull();
    expect(parseClientMessage(create({ roomMode: 'coop', arenaMapId: 'rome' }))).toBeNull();
    // Every online city is a city in the catalog.
    ONLINE_CITY_MAPS.forEach((id) => expect(getArenaMap(id)?.family).toBe('city'));
    expect(isOnlineArenaMapId('hiddenLeaf')).toBe(true);
  });

  it('reads a lobby only with the map its room plays', () => {
    const lobby = (extra: object) => JSON.stringify({
      type: 'lobby',
      roomId: 'ABC234',
      stageId: 'hiddenLeaf',
      roomMode: 'arena',
      capacity: 4,
      totalRounds: 3,
      players: [],
      ...extra,
    });
    expect(parseServerMessage(lobby({ arenaMapId: 'barcelona' })))
      .toMatchObject({ arenaMapId: 'barcelona' });
    expect(parseServerMessage(lobby({}))).toBeNull();
  });

  it('rejects messages above the wire-size limit', () => {
    expect(parseClientMessage(JSON.stringify({
      type: 'leave', padding: 'x'.repeat(MAX_CLIENT_MESSAGE_BYTES),
    }))).toBeNull();
  });

  it('accepts snapshots only when they contain state data', () => {
    expect(parseServerMessage(JSON.stringify({
      type: 'snapshot', tick: 2, ack: 4, patch: { paused: false },
    }))).toEqual({
      type: 'snapshot', tick: 2, ack: 4, patch: { paused: false }
    });
    expect(parseServerMessage(JSON.stringify({
      type: 'snapshot', tick: 2, ack: 4,
    }))).toBeNull();
  });
});
