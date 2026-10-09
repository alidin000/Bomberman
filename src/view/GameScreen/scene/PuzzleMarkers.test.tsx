import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import type * as THREE from 'three';
import { GameScene3D } from '../GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from '../gamePreferences';
import { GameEngineState, CampaignPuzzleElementState } from '../../../engine/types';
import { cellKey } from '../../../engine/fogOfWar';
import { getCampaignPuzzle } from '../../../content/campaignMissions';
import { STAGE_DEFINITIONS } from '../../../content';
import {
  campaignState, puzzleObjective, reachPuzzle,
} from '../../../engine/campaignPuzzles.testutil';
import { installFakeWebGL } from './fakeWebGL.testutil';

beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

async function settle() {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
}

async function mount(ui: React.ReactElement) {
  const view = render(ui);
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  await settle();
  const root = _roots.get(canvas);
  if (!root) throw new Error('scene not mounted');
  const { gl } = root.store.getState();
  return {
    rerender: async (next: React.ReactElement) => { view.rerender(next); await settle(); },
    scene: () => root.store.getState().scene as THREE.Scene,
    programs: () => gl.info.programs?.length ?? 0,
    run: (ms: number) => act(() => { vi.advanceTimersByTime(ms); }),
    unmount: () => view.unmount(),
  };
}

const scene3d = (
  state: GameEngineState,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES
) => (
  <GameScene3D state={state} preferences={preferences} liveState={() => state} />
);

function withFog(state: GameEngineState, visible: string[], explored: string[]): GameEngineState {
  return {
    ...state,
    fogOfWar: {
      visible, explored: [...visible, ...explored], sensedEnemies: [], sensedWalls: [],
    },
  };
}

// Story's hints on, but its reveal-all off, so fog decides what is drawn.
function withPieces(
  state: GameEngineState,
  elements: CampaignPuzzleElementState[]
): GameEngineState {
  const objective = puzzleObjective(state);
  const tuning = { ...objective.puzzle!.tuning, revealAll: false, showNext: true };
  const puzzle = { ...objective.puzzle!, elements, tuning };
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      objectives: state.campaign!.objectives.map((item) => (
        item === objective ? { ...item, puzzle } : item
      )),
    },
  };
}

const drawn = (view: { scene: () => THREE.Scene }, id: string) => (
  !!view.scene().getObjectByName(`puzzle-${id}`)
);

describe('route puzzle pieces in the scene', () => {
  it('draws explored pieces under fog, hides unexplored ones, and shows all on Story', async () => {
    const [first, second, third] = getCampaignPuzzle('hiddenCloud').elements;
    const normal = withFog(
      reachPuzzle(campaignState('hiddenCloud', 'normal')),
      [cellKey(first.x, first.y)],
      [cellKey(second.x, second.y)]
    );
    const view = await mount(scene3d(normal));
    view.run(100);
    expect(drawn(view, first.id)).toBe(true);
    // Remembered: the order can be read back after walking away.
    expect(drawn(view, second.id)).toBe(true);
    expect(drawn(view, third.id)).toBe(false);
    view.unmount();

    const story = withFog(reachPuzzle(campaignState('hiddenCloud', 'story')), [], []);
    const storyView = await mount(scene3d(story));
    storyView.run(100);
    expect(drawn(storyView, third.id)).toBe(true);
    storyView.unmount();
  });

  it('mounts every piece look mid-match without compiling a shader program', async () => {
    // Every role from every village in done and undone looks, set out in
    // view of the camera (three.js compiles only what it draws).
    const base = reachPuzzle(campaignState('akatsukiHideout', 'story'));
    const all = STAGE_DEFINITIONS.flatMap((stage) => getCampaignPuzzle(stage.id).elements)
      .map((item, index) => ({
        ...item,
        id: `${item.id}-${index}`,
        x: base.players[0].x - 3 + (index % 7),
        y: base.players[0].y - 2 + Math.floor(index / 7),
        on: index % 2 === 0,
        untilTick: index % 4 === 0 ? base.tick + 100 : undefined,
        pressed: index % 3 === 0,
        carriedBy: item.role === 'keystone' && index % 2 === 1 ? 'player1' : undefined,
      }));
    const board = withPieces(base, all);
    // The player's own view of the arena is up first, as in a match; the
    // pieces are all out of it.
    const { visible, explored } = base.fogOfWar;
    const cells = all.map((item) => cellKey(item.x, item.y));
    const away = (keys: string[]) => keys.filter((key) => !cells.includes(key));
    const view = await mount(scene3d(withFog(board, away(visible), away(explored))));
    view.run(500);
    expect(drawn(view, all[0].id)).toBe(false);
    const programs = view.programs();
    expect(programs).toBeGreaterThan(0);

    await view.rerender(scene3d(withFog(
      board,
      [...visible, ...cells.filter((_, index) => index % 2 === 0)],
      [...explored, ...cells]
    )));
    view.run(500);
    all.forEach((item) => expect({ id: item.id, drawn: drawn(view, item.id) })
      .toEqual({ id: item.id, drawn: true }));
    expect(view.programs()).toBe(programs);

    // High contrast retones the pieces with uniforms only.
    await view.rerender(scene3d(withFog(board, [...visible, ...cells], explored), {
      ...DEFAULT_GAME_PREFERENCES, highContrast: true, reducedMotion: true,
    }));
    view.run(300);
    expect(view.programs()).toBe(programs);
    view.unmount();
  });
});
