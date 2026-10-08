import {
  REPLAY_VERSION, ReplayFrame, exportReplay, importReplay, replayActions,
} from './replay';
import { GameAction } from '../engine/actions';
import { parseMapRows } from '../engine/mapLoader';
import { defaultMap } from '../constants/contants';

describe('replay', () => {
  it('replays a seeded match to the identical state', () => {
    const config = {
      numPlayers: 2,
      totalRounds: 1,
      selectedMap: 'map1',
      map: parseMapRows(defaultMap),
      seed: 424242,
    };
    const frames: ReplayFrame[] = [
      { tick: 0, action: { type: 'TICK', deltaMs: 3000 } },
      { tick: 1, action: { type: 'DROP_BOMB', playerId: 'player1' } },
      ...Array.from({ length: 80 }, (_, index) => ({
        tick: index + 2,
        action: { type: 'TICK', deltaMs: 50 } as GameAction,
      })),
    ];

    const first = replayActions({ type: 'INIT', config }, frames);
    const second = replayActions({ type: 'INIT', config }, frames);

    // Guard against a vacuous pass: the bomb must actually have gone off.
    expect(first!.tick).toBeGreaterThan(0);
    expect(first!.bombs).toEqual([]);
    expect(first!.rngSeed).not.toBe(config.seed);
    expect(second).toEqual(first);
  });

  it('imports valid replay recordings', () => {
    const raw = exportReplay({
      version: REPLAY_VERSION,
      initialState: null,
      frames: [
        { tick: 1, action: { type: 'PAUSE' } },
        { tick: 2, action: { type: 'RESUME' } },
      ],
    });

    expect(importReplay(raw).frames).toHaveLength(2);
  });

  it('rejects malformed replay recordings', () => {
    expect(() => importReplay(JSON.stringify({
      version: 1,
      initialState: null,
      frames: [],
    }))).toThrow(/Invalid replay/);
    expect(() => importReplay(JSON.stringify({
      version: REPLAY_VERSION,
      initialState: null,
      frames: [{ tick: 1, action: { type: 'MOVE', playerId: 'player1' } }],
    }))).toThrow(/Invalid replay/);
  });
});
