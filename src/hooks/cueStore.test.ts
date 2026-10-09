/* eslint-disable no-param-reassign, comma-dangle */
import { readFileSync } from 'node:fs';
import { parseMapRows } from '../engine/mapLoader';
import { GameConfig, GameEngineState, PlayerSlotController } from '../engine/types';
import { CharacterId } from '../content/types';
import {
  EngineLoop,
  advanceEngineFrame,
  applyEngineAction,
  createEngineLoop,
} from './engineLoop';
import {
  CUE_DURATION_MS,
  CueStore,
  PICKUP_CUE_MS,
  PlayerCueKind,
  bodyCueAt,
  pickupCueAt,
} from './cueStore';

const FRAME_MS = 1000 / 60;

const OPEN = parseMapRows([
  'WWWWWWWWWWWWWWW',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'W             W',
  'WWWWWWWWWWWWWWW',
].map((row) => row.split('')));

function versus(characters: CharacterId[], extra: Partial<GameConfig> = {}): GameConfig {
  return {
    mode: 'local',
    numPlayers: characters.length,
    totalRounds: 3,
    selectedMap: 'cue-test',
    map: OPEN,
    selectedCharacters: characters,
    seed: 11,
    ...extra,
  };
}

function startLoop(config: GameConfig): EngineLoop {
  const loop = createEngineLoop();
  applyEngineAction(loop, { type: 'INIT', config });
  while (loop.state!.roundStartTicksRemaining > 0) advanceEngineFrame(loop, FRAME_MS);
  return loop;
}

function cues(loop: EngineLoop): CueStore {
  return loop.motion.cues as CueStore;
}

function frames(loop: EngineLoop, ms: number) {
  for (let t = 0; t < ms; t += FRAME_MS) advanceEngineFrame(loop, FRAME_MS);
}

function bodyKind(loop: EngineLoop, playerId: string): PlayerCueKind | null {
  return bodyCueAt(cues(loop), playerId, cues(loop).clockMs)?.kind ?? null;
}

// A flame on the player's cell: the next tick resolves it like any blast.
function burn(loop: EngineLoop, x: number, y: number) {
  loop.state = {
    ...loop.state!,
    explosions: [{
      x, y, ticksRemaining: 400, kind: 'standard', ownerId: 'player2',
    }],
  };
}

describe('player cue store', () => {
  it('records a plant on the press that drops the bomb and lets it run out', () => {
    const loop = startLoop(versus(['sasuke', 'naruto']));
    const pressedAt = cues(loop).clockMs;
    applyEngineAction(loop, { type: 'DROP_BOMB', playerId: 'player1' });

    // The very next frame already shows it: the cue starts at the press.
    advanceEngineFrame(loop, FRAME_MS);
    const cue = bodyCueAt(cues(loop), 'player1', cues(loop).clockMs);
    expect(cue).toMatchObject({ kind: 'plant', startMs: pressedAt });
    expect(bodyKind(loop, 'player2')).toBeNull();

    frames(loop, CUE_DURATION_MS.plant);
    expect(bodyKind(loop, 'player1')).toBeNull();
    // It never locked movement: the planter still walks off its bomb.
    const { x } = loop.state!.players[0];
    applyEngineAction(loop, { type: 'MOVE', playerId: 'player1', direction: 'right' });
    expect(loop.state!.players[0].x).toBeGreaterThan(x);
  });

  it('records the ultimate, and a pickup with its power, from the steps that caused them', () => {
    const loop = startLoop(versus(['sasuke', 'naruto']));
    applyEngineAction(loop, { type: 'USE_ULTIMATE', playerId: 'player1' });
    expect(bodyKind(loop, 'player1')).toBe('ultimate');

    const map = loop.state!.map.map((row) => [...row]);
    map[7][13] = 'BlastRangeUp';
    loop.state = { ...loop.state!, map };
    const range = loop.state!.players[1].bombRange;
    for (let step = 0; step < 20 && loop.state!.players[1].bombRange === range; step += 1) {
      applyEngineAction(loop, { type: 'MOVE', playerId: 'player2', direction: 'up' });
    }
    expect(loop.state!.players[1].bombRange).toBe(range + 1);
    const pickup = pickupCueAt(cues(loop), 'player2', cues(loop).clockMs);
    expect(pickup).toMatchObject({ power: 'BlastRangeUp' });
    frames(loop, PICKUP_CUE_MS + FRAME_MS);
    expect(pickupCueAt(cues(loop), 'player2', cues(loop).clockMs)).toBeNull();
  });

  it('tells a survived hit from a fall, and keeps the fall posed through the round result', () => {
    // Gaara's sand shield takes the first hit; Sasuke has no save.
    const loop = startLoop(versus(['sasuke', 'gaara']));
    const gaara = loop.state!.players[1];
    burn(loop, gaara.x, gaara.y);
    frames(loop, 60);
    expect(loop.state!.players[1]).toMatchObject({ alive: true, passiveState: 'Sand Shield Spent' });
    expect(bodyKind(loop, 'player2')).toBe('hit');
    frames(loop, CUE_DURATION_MS.hit);
    expect(bodyKind(loop, 'player2')).toBeNull();

    burn(loop, 1, 1);
    frames(loop, 60);
    expect(loop.state!.players[0].alive).toBe(false);
    expect(loop.state!.phase).toBe('round_end');
    expect(bodyKind(loop, 'player1')).toBe('death');

    // The round is over and the simulation clock has stopped, but the
    // presentation clock runs on, so the fall finishes on screen.
    const simAt = loop.motion.simTimeMs;
    const cueAt = cues(loop).clockMs;
    frames(loop, 500);
    expect(loop.motion.simTimeMs).toBe(simAt);
    expect(cues(loop).clockMs - cueAt).toBeGreaterThan(450);
    expect(bodyKind(loop, 'player1')).toBe('death');

    // The next round starts every fighter clean.
    applyEngineAction(loop, { type: 'DISMISS_DIALOG' });
    expect(bodyKind(loop, 'player1')).toBeNull();
  });

  it('freezes with a player pause', () => {
    const loop = startLoop(versus(['sasuke', 'naruto']));
    applyEngineAction(loop, { type: 'DROP_BOMB', playerId: 'player1' });
    applyEngineAction(loop, { type: 'PAUSE' });
    const at = cues(loop).clockMs;
    frames(loop, 1000);
    expect(cues(loop).clockMs).toBe(at);
    expect(bodyKind(loop, 'player1')).toBe('plant');
  });
});

describe('player cues are render-only', () => {
  function stageMap(mapId: string) {
    return parseMapRows(readFileSync(`public/maps/${mapId}.txt`, 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((row) => row.split('')));
  }

  // Three CPUs play a best-of-three to the end, dismissing each round result.
  function playMatch(withCues: boolean) {
    const controllers: PlayerSlotController[] = ['cpu-hard', 'cpu-normal', 'cpu-hard'];
    const loop = createEngineLoop();
    if (!withCues) loop.motion.cues = null;
    applyEngineAction(loop, {
      type: 'INIT',
      config: versus(['deidara', 'naruto', 'gaara'], {
        map: stageMap('hiddenLeaf'), selectedMap: 'hiddenLeaf', controllers, seed: 4242,
      }),
    });
    const seen = new Set<PlayerCueKind>();
    const trace: string[] = [];
    for (let frame = 0; frame < 60 * 150; frame += 1) {
      const state = loop.state as GameEngineState;
      if (state.phase === 'game_over') break;
      if (state.phase === 'round_end') applyEngineAction(loop, { type: 'DISMISS_DIALOG' });
      advanceEngineFrame(loop, FRAME_MS);
      loop.motion.cues?.body.forEach((cue) => seen.add(cue.kind));
      if (frame % 120 === 0) trace.push(JSON.stringify(loop.state!.players));
    }
    return { state: loop.state, seen, trace };
  }

  it('plays a CPU match to the same final state with the cue store on and off', () => {
    const on = playMatch(true);
    const off = playMatch(false);
    // The cues really ran: bombs were planted and ninjas fell.
    expect(on.seen.has('plant')).toBe(true);
    expect(on.seen.has('death')).toBe(true);
    expect(off.seen.size).toBe(0);
    expect(on.state!.round).toBeGreaterThan(1);
    expect(on.trace).toEqual(off.trace);
    expect(on.state).toEqual(off.state);
  });
});
