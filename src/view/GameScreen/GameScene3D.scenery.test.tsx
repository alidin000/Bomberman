import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import type * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { LANDMARK_MATERIAL } from './scene/landmarkGeometry';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';

// The Stage scenery setting, on the real scene in jsdom (every GL call a
// no-op): what it draws, and what switching it under the pause menu costs.

// r3f's render loop runs on requestAnimationFrame; one fake clock for the
// file (see GameScene3D.smoothness.test.tsx).
beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

const pausedVersus: GameEngineState = {
  ...createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'sasuke'],
    map: parseMapRows(defaultMap),
  }),
  roundStartTicksRemaining: 0,
  tick: 40,
  paused: true,
};

async function settle() {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
}

const sceneWith = (scenery: boolean) => (
  <GameScene3D state={pausedVersus} preferences={{ ...DEFAULT_GAME_PREFERENCES, scenery }} />
);

async function mount(scenery: boolean) {
  const view = render(sceneWith(scenery));
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  // r3f mounts once its (debounced) size measurement lands.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  await settle();
  const root = _roots.get(canvas);
  if (!root) throw new Error('scene not mounted');
  const { gl } = root.store.getState();
  const draw = gl.render.bind(gl);
  let frames = 0;
  gl.render = (scene, camera) => {
    frames += 1;
    draw(scene, camera);
  };
  return {
    rerender: async (next: boolean) => {
      view.rerender(sceneWith(next));
      await settle();
      act(() => { vi.advanceTimersByTime(300); });
    },
    run: (ms: number) => act(() => { vi.advanceTimersByTime(ms); }),
    frames: () => frames,
    programs: () => gl.info.programs?.length ?? 0,
    landmarks: () => {
      const found: THREE.Object3D[] = [];
      root.store.getState().scene.traverse((object) => {
        if ((object as THREE.Mesh).material === LANDMARK_MATERIAL) found.push(object);
      });
      return found;
    },
  };
}

describe('GameScene3D stage scenery', () => {
  it('draws no landmarks with scenery off, and switching it while paused compiles no program', async () => {
    const view = await mount(false);
    view.run(300);
    expect(view.landmarks()).toHaveLength(0);
    const programs = view.programs();
    expect(programs).toBeGreaterThan(0);

    const framesBefore = view.frames();
    await view.rerender(true);
    expect(view.landmarks().length).toBeGreaterThan(0);
    // The paused arena draws the change once (it renders on demand)...
    expect(view.frames()).toBeGreaterThan(framesBefore);
    // ...on shader programs it already had: the landmarks share the walls'.
    expect(view.programs()).toBe(programs);

    await view.rerender(false);
    expect(view.landmarks()).toHaveLength(0);
    expect(view.programs()).toBe(programs);
  });
});
