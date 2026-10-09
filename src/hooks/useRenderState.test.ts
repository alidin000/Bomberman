/* eslint-disable no-param-reassign */
import { renderHook } from '@testing-library/react-hooks';
import { parseMapRows } from '../engine/mapLoader';
import { GameConfig, GameEngineState } from '../engine/types';
import { gameReducer } from '../engine/reducer';
import { advanceEngineFrame, applyEngineAction, createEngineLoop } from './engineLoop';
import { createMotionStore, playerMotionId } from './motionStore';
import { differsOnlyInPlayerMotion, shareRenderState, useRenderState } from './useRenderState';

const openArena = parseMapRows([
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

const config: GameConfig = {
  numPlayers: 2,
  totalRounds: 1,
  selectedMap: 'map1',
  map: openArena,
  selectedCharacters: ['sasuke', 'naruto'],
  seed: 1,
};

const FRAME_MS = 1000 / 60;

function startedLoop() {
  const loop = createEngineLoop();
  applyEngineAction(loop, { type: 'INIT', config });
  for (let t = 0; t < 3200; t += FRAME_MS) advanceEngineFrame(loop, FRAME_MS);
  return loop;
}

// The rendered state may only trail the simulation in what the scene draws
// from the motion store: player x, y and facing.
function expectSameExceptMotion(rendered: GameEngineState, latest: GameEngineState) {
  const { players: renderedPlayers, ...renderedRest } = rendered;
  const { players: latestPlayers, ...latestRest } = latest;
  expect(Object.keys(renderedRest)).toEqual(Object.keys(latestRest));
  Object.keys(latestRest).forEach((key) => {
    expect(renderedRest[key as keyof typeof renderedRest]).toBe(
      latestRest[key as keyof typeof latestRest]
    );
  });
  const withoutMotion = (player: GameEngineState['players'][0]) => ({
    ...player, x: 0, y: 0, facing: undefined,
  });
  latestPlayers.forEach((player, index) => {
    const renderedPlayer = renderedPlayers[index];
    expect(withoutMotion(renderedPlayer)).toEqual(withoutMotion(player));
    // At most one 50 ms tick of held movement behind (18 ms fastest repeat).
    expect(Math.abs(renderedPlayer.x - player.x) + Math.abs(renderedPlayer.y - player.y))
      .toBeLessThanOrEqual(0.3 + 1e-9);
  });
}

function runFrames(loop: ReturnType<typeof createEngineLoop>, frames: number) {
  const hook = renderHook(({ state }) => useRenderState(state), {
    initialProps: { state: loop.state },
  });
  const rendered = new Set<GameEngineState | null>([hook.result.current]);
  let published = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const before = loop.state;
    advanceEngineFrame(loop, FRAME_MS);
    if (loop.state !== before) {
      published += 1;
      hook.rerender({ state: loop.state });
    }
    expectSameExceptMotion(hook.result.current!, loop.state!);
    rendered.add(hook.result.current);
  }
  return { rendered: rendered.size - 1, published };
}

describe('useRenderState', () => {
  it('renders held movement for both players at the tick rate, not every frame', () => {
    const loop = startedLoop();
    const [p1, p2] = loop.state!.players;
    applyEngineAction(loop, { type: 'MOVE', playerId: p1.id, direction: 'right' });
    applyEngineAction(loop, { type: 'MOVE', playerId: p2.id, direction: 'left' });
    loop.activeMovement[p1.id] = { accumulatorMs: 0, direction: 'right', key: 'd' };
    // Keys pressed half a step apart, as two people do.
    loop.activeMovement[p2.id] = { accumulatorMs: 14, direction: 'left', key: 'ArrowLeft' };

    const { rendered, published } = runFrames(loop, 120);

    // Two seconds at 60 fps: almost every frame changes the simulation, but
    // only the 40 engine ticks change anything the HUD or scene draws from state.
    expect(published).toBeGreaterThanOrEqual(100);
    expect(rendered).toBeGreaterThanOrEqual(40);
    expect(rendered).toBeLessThanOrEqual(41);
    expect(loop.state!.players[0].x).toBeGreaterThan(p1.x + 3);
  });

  it('renders a movement step that collects a power-up in the same frame', () => {
    const loop = startedLoop();
    const player = loop.state!.players[0];
    const map = loop.state!.map.map((row) => [...row]);
    map[player.y][player.x + 2] = 'AddBomb';
    loop.state = { ...loop.state!, map };
    loop.activeMovement[player.id] = { accumulatorMs: 0, direction: 'right', key: 'd' };

    // expectSameExceptMotion runs every frame, so the pickup frame must render.
    runFrames(loop, 40);
    expect(loop.state!.map[player.y][player.x + 2]).toBe('Empty');
    expect(loop.state!.players[0].maxBombs).toBe(player.maxBombs + 1);
  });

  it('treats only x, y and facing of players as movement', () => {
    const loop = startedLoop();
    const state = loop.state!;
    const moved = {
      ...state,
      players: state.players.map((p, i) => (i === 0 ? { ...p, x: p.x + 0.1, facing: 'right' as const } : p)),
    };
    expect(differsOnlyInPlayerMotion(state, moved)).toBe(true);
    expect(differsOnlyInPlayerMotion(state, {
      ...moved,
      players: moved.players.map((p, i) => (i === 0 ? { ...p, alive: false } : p)),
    })).toBe(false);
    expect(differsOnlyInPlayerMotion(state, { ...moved, tick: state.tick + 1 })).toBe(false);
    expect(differsOnlyInPlayerMotion(state, { ...state })).toBe(true);
    expect(differsOnlyInPlayerMotion(null, state)).toBe(false);
  });
});

describe('scene and HUD shared states', () => {
  const tick = (state: GameEngineState) => (
    gameReducer(state, { type: 'TICK', deltaMs: 50 }) as GameEngineState
  );

  // A live round with a burning bomb, ultimates recharging and players that
  // have moved (so the motion store draws them).
  function liveRound() {
    const loop = startedLoop();
    const [p1] = loop.state!.players;
    applyEngineAction(loop, { type: 'MOVE', playerId: p1.id, direction: 'right' });
    applyEngineAction(loop, { type: 'DROP_BOMB', playerId: p1.id });
    for (let t = 0; t < 200; t += FRAME_MS) advanceEngineFrame(loop, FRAME_MS);
    // No monsters: their steps are real scene changes.
    loop.state = { ...loop.state!, monsters: [] };
    return loop;
  }

  it('keeps the scene state across ticks that only move clocks', () => {
    const loop = liveRound();
    const share = shareRenderState.scene(loop.motion);
    const before = loop.state!;
    let shared = before;
    let state = before;
    for (let i = 0; i < 10; i += 1) {
      state = tick(state);
      shared = share(shared, state);
    }
    expect(state.tick).toBe(before.tick + 10);
    expect(state.bombs[0].ticksRemaining).toBeLessThan(before.bombs[0].ticksRemaining);
    expect(shared).toBe(before);
  });

  it('rebuilds only the changed parts when the scene does change', () => {
    const loop = liveRound();
    const share = shareRenderState.scene(loop.motion);
    const before = loop.state!;
    const ticked = tick(before);
    const turned = {
      ...ticked,
      players: ticked.players.map((p, i) => (i === 1 ? { ...p, facing: 'up' as const } : p)),
    };
    const shared = share(before, turned);
    expect(shared).not.toBe(before);
    expect(shared.players[1].facing).toBe('up');
    // Player 1 changed only its recharge timer: the same object, so its mesh skips.
    expect(shared.players[0]).toBe(before.players[0]);
    expect(shared.bombs).toBe(before.bombs);
    expect(shared.map).toBe(before.map);
    // Fields it rebuilt are current.
    expect(shared.tick).toBe(turned.tick);
  });

  it('re-renders the scene when an ultimate becomes ready, not for each percent', () => {
    const loop = liveRound();
    const share = shareRenderState.scene(loop.motion);
    const before = loop.state!;
    const withCharge = (charge: number) => ({
      ...before,
      players: before.players.map((p, i) => (i === 0 ? { ...p, ultimateCharge: charge } : p)),
    });
    const at40 = share(before, withCharge(40));
    expect(share(at40, withCharge(41))).toBe(at40);
    expect(share(at40, withCharge(100))).not.toBe(at40);
  });

  it('draws a player from state again once the motion store forgets it', () => {
    const motion = createMotionStore();
    const loop = liveRound();
    const share = shareRenderState.scene(motion);
    const before = loop.state!;
    const moved = {
      ...before,
      players: before.players.map((p, i) => (i === 0 ? { ...p, x: p.x + 1 } : p)),
    };
    // No track (a new round cleared them): x is drawn directly, so it matters.
    expect(share(before, moved)).not.toBe(before);
    motion.tracks.set(playerMotionId(before.players[0].id), {
      fromX: 0, fromY: 0, toX: 0, toY: 0, startMs: 0, durationMs: 0, easing: 'linear',
    });
    expect(share(before, moved)).toBe(before);
  });

  it('keeps the HUD state until a printed value changes', () => {
    const loop = liveRound();
    const before = { ...loop.state!, roundElapsedMs: 10000 };
    const later = (ms: number, charge?: number) => ({
      ...before,
      tick: before.tick + ms / 50,
      roundElapsedMs: before.roundElapsedMs + ms,
      players: before.players.map((p) => ({
        ...p, x: p.x + 0.1, ultimateCharge: charge ?? p.ultimateCharge,
      })),
    });
    // 80 s left for the next 950 ms; positions are not on the HUD.
    expect(shareRenderState.hud(before, later(950))).toBe(before);
    expect(shareRenderState.hud(before, later(1050))).not.toBe(before);
    expect(shareRenderState.hud(before, later(50, before.players[0].ultimateCharge + 1)))
      .not.toBe(before);
  });
});
