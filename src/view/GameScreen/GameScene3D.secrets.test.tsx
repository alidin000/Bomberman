import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import type * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { loadCampaignMapRows, parseMapRows } from '../../engine/mapLoader';
import { cellKey } from '../../engine/fogOfWar';
import { GameEngineState } from '../../engine/types';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';

beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

// The Hidden Leaf campaign with the whole map in sight.
function leafInSight(): GameEngineState {
  const state = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto'],
    map: parseMapRows(loadCampaignMapRows('hiddenLeaf')),
    seed: 4,
  });
  const cells = state.map.flatMap((row, y) => row.map((_, x) => cellKey(x, y))).sort();
  return {
    ...state,
    roundStartTicksRemaining: 0,
    fogOfWar: { ...state.fogOfWar, visible: cells, explored: cells },
  };
}

function withoutFeatures(state: GameEngineState): GameEngineState {
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      hiddenAreas: [],
      bossArena: { ...state.campaign!.bossArena, gates: [] },
    },
  };
}

async function settle(ms = 30) {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, ms); }); });
}

// Instanced tile layers with something to draw.
function drawnInstancedLayers(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((object) => {
    const mesh = object as THREE.InstancedMesh;
    if (mesh.isInstancedMesh && mesh.visible && mesh.count > 0) count += 1;
  });
  return count;
}

describe('secret doors and arena gates in the scene', () => {
  it('draws cracked walls, false walls and shut gates with the wall shader program', async () => {
    const plain = withoutFeatures(leafInSight());
    const view = render(
      <GameScene3D state={plain} preferences={DEFAULT_GAME_PREFERENCES} />
    );
    await settle(120);
    await settle();
    const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
    const root = _roots.get(canvas)!;
    const { gl } = root.store.getState();
    const run = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });
    run(100);
    const programs = gl.info.programs?.length ?? 0;
    const layers = drawnInstancedLayers(root.store.getState().scene);
    expect(programs).toBeGreaterThan(0);

    view.rerender(<GameScene3D state={leafInSight()} preferences={DEFAULT_GAME_PREFERENCES} />);
    await settle();
    run(100);

    // Three more instanced draws (cracked wall, passage, gate), no new shader.
    expect(drawnInstancedLayers(root.store.getState().scene)).toBe(layers + 3);
    expect(gl.info.programs?.length ?? 0).toBe(programs);
    view.unmount();
  });
});
