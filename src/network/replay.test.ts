import { exportReplay, importReplay, replayActions } from './replay';
import { parseMapRows } from '../engine/mapLoader';
import { defaultMap } from '../constants/contants';

describe('replay', () => {
  it('replays a sequence of actions deterministically', () => {
    const config = {
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
    };

    const state = replayActions(
      { type: 'INIT', config },
      [
        { tick: 1, action: { type: 'MOVE', playerId: 'player1', direction: 'right' } },
        { tick: 2, action: { type: 'TICK', deltaMs: 50 } },
      ]
    );

    expect(state).not.toBeNull();
    expect(state!.tick).toBe(1);
  });

  it('imports valid replay recordings', () => {
    const raw = exportReplay({
      version: 1,
      initialState: null,
      frames: [
        { tick: 1, action: { type: 'PAUSE' } },
        { tick: 2, action: { type: 'RESUME' } },
      ],
    });

    expect(importReplay(raw).frames).toHaveLength(2);
  });

  it('rejects malformed replay recordings', () => {
    expect(() => importReplay('{"version":2,"frames":[]}')).toThrow(/Invalid replay/);
    expect(() => importReplay(JSON.stringify({
      version: 1,
      initialState: null,
      frames: [{ tick: 1, action: { type: 'MOVE', playerId: 'player1' } }],
    }))).toThrow(/Invalid replay/);
  });
});
