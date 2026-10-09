// @vitest-environment node
import {
  MAX_CLIENT_MESSAGE_BYTES,
  PROTOCOL_VERSION,
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
    }))).toEqual({
      type: 'create',
      protocol: PROTOCOL_VERSION,
      simulation: SIMULATION_VERSION,
      name: 'Kakashi',
      characterId: 'naruto',
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
    JSON.stringify({ type: 'selection', characterId: 'not-a-character' }),
  ])('rejects untrusted client data: %s', (raw) => {
    expect(parseClientMessage(raw)).toBeNull();
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
