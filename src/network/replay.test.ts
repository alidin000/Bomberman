import { replayActions } from './replay';
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
});
