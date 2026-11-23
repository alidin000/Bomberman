import {
  REPLAY_VERSION, ReplayFrame, exportReplay, importReplay, replayActions,
} from './replay';
import { GameAction } from '../engine/actions';
import { gameReducer } from '../engine/reducer';
import { TICK_MS } from '../engine/constants';
import { GameConfig, GameEngineState } from '../engine/types';
import { loadStageMapRows, parseMapRows } from '../engine/mapLoader';
import { defaultMap } from '../constants/contants';
import { getStageDefinition, StageId } from '../content';

// An online arena room, built the way the server's createConfig builds one.
function arenaRoom(stageId: StageId, seed: number): GameConfig {
  const stage = getStageDefinition(stageId);
  return {
    mode: 'onlinePreview',
    numPlayers: 2,
    totalRounds: 3,
    selectedMap: stage.mapId,
    stageId: stage.id,
    map: parseMapRows(loadStageMapRows(stage.mapId)),
    selectedCharacters: ['naruto', 'sasuke'],
    seed,
  };
}

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

  it('replays a match recorded while another room ran to the same state, ids included', () => {
    // Room A is recorded the way the server runs it: its ticks interleave
    // with room B's, and B starts between A's enemy casts.
    const init: GameAction = { type: 'INIT', config: arenaRoom('hiddenCloud', 4242) };
    const frames: ReplayFrame[] = [];
    let live = gameReducer(null, init) as GameEngineState;
    let other: GameEngineState | null = null;
    const record = (action: GameAction) => {
      frames.push({ tick: live.tick, action });
      live = gameReducer(live, action) as GameEngineState;
    };
    const otherDoes = (action: GameAction) => {
      other = gameReducer(other, action);
    };
    for (let step = 0; step < 200 && live.tick < 50; step += 1) {
      record({ type: 'TICK', deltaMs: TICK_MS });
      if (other) otherDoes({ type: 'TICK', deltaMs: TICK_MS });
      if (live.tick === 40 && !other) {
        otherDoes({ type: 'INIT', config: arenaRoom('hiddenLeaf', 777) });
        otherDoes({ type: 'TICK', deltaMs: 3000 });
        otherDoes({ type: 'DROP_BOMB', playerId: 'player1' });
        record({ type: 'DROP_BOMB', playerId: 'player1' });
      }
    }

    const replayed = replayActions(init, frames);

    // Guard against a vacuous pass: A minted a bomb and enemy hazards after
    // B started, and they are still live at the end.
    expect(other).not.toBeNull();
    expect(live.bombs).toHaveLength(1);
    expect(live.hazards.length).toBeGreaterThan(2);
    expect(replayed).toEqual(live);
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
