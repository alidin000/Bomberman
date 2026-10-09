import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { gameReducer } from '../../engine/reducer';
import { parseMapRows } from '../../engine/mapLoader';
import { GameEngineState } from '../../engine/types';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';
import { createWarmupMaterials } from './scene/ShaderWarmup';
import { toWorld } from './scene/sceneSpace';
import { WAVE_MARK_HALO_MATERIAL, WAVE_MARK_INK_MATERIAL } from './scene/waveTelegraph';

const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34 ? 'W'.repeat(35) : `W${' '.repeat(33)}W`
).split('')));

beforeAll(() => installFakeWebGL());

function defenseStarted(): GameEngineState {
  const initial = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto'],
    map: openStage,
    seed: 7,
    difficulty: 'normal',
  });
  let state: GameEngineState = {
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [],
    campaign: { ...initial.campaign!, spawnPoints: [] },
  };
  const rescue = state.campaign!.objectives.find((objective) => objective.kind === 'rescue')!;
  rescue.targets!.forEach((target) => {
    state = gameReducer({
      ...state,
      players: state.players.map((player) => ({ ...player, x: target.x - 0.8, y: target.y })),
    }, { type: 'MOVE', playerId: 'player1', direction: 'right' })!;
  });
  return { ...state, players: state.players.map((player) => ({ ...player, x: 2, y: 32 })) };
}

function ticks(state: GameEngineState, count: number): GameEngineState {
  let next = state;
  for (let index = 0; index < count; index += 1) {
    next = gameReducer(next, { type: 'TICK', deltaMs: 50 })!;
  }
  return next;
}

async function renderScene(state: GameEngineState) {
  let live = state;
  const view = render(
    <GameScene3D state={state} preferences={DEFAULT_GAME_PREFERENCES} liveState={() => live} />
  );
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  let time = 0;
  const find = <T extends THREE.Object3D>(test: (object: THREE.Object3D) => boolean): T[] => {
    const found: T[] = [];
    _roots.get(canvas)!.store.getState().scene.traverse((object) => {
      if (test(object)) found.push(object as T);
    });
    return found;
  };
  return {
    frame: () => { time += 16; act(() => { advance(time); }); },
    show: (next: GameEngineState) => {
      live = next;
      view.rerender(
        <GameScene3D state={next} preferences={DEFAULT_GAME_PREFERENCES} liveState={() => live} />
      );
    },
    marks: (layer: 'ink' | 'halo') => find<THREE.InstancedMesh>((object) => (
      object.userData.waveMark === layer
    ))[0],
    unmount: () => view.unmount(),
  };
}

function instance(mesh: THREE.InstancedMesh, index: number) {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  matrix.decompose(position, new THREE.Quaternion(), scale);
  return { position, scale };
}

describe('defense wave marks in the scene', () => {
  it('brackets the next wave\'s spawn points, closing on them as it arrives', async () => {
    const start = defenseStarted();
    const waves = start.campaign!.waves!;
    const view = await renderScene(start);
    view.frame();
    // Nothing is marked before the telegraph.
    expect(view.marks('ink').count).toBe(0);
    expect(view.marks('ink').visible).toBe(false);

    const marked = ticks(start, (waves.dueAtMs - waves.telegraphMs) / 50);
    view.show(marked);
    view.frame();
    const entries = waves.waves[0].entryIds
      .map((id) => waves.entries.find((entry) => entry.id === id)!);
    ['ink', 'halo'].forEach((layer) => {
      const mesh = view.marks(layer as 'ink' | 'halo');
      expect(mesh.count).toBe(entries.length);
      expect(mesh.visible).toBe(true);
      entries.forEach((entry, index) => {
        const [x, , z] = toWorld(entry.x, entry.y);
        expect(instance(mesh, index).position.x).toBeCloseTo(x);
        expect(instance(mesh, index).position.z).toBeCloseTo(z);
      });
    });
    const wide = instance(view.marks('ink'), 0).scale.x;
    expect(wide).toBeGreaterThan(1.5);

    // Half way: narrower. Read from the live state each frame, no re-render.
    const halfway = ticks(marked, waves.telegraphMs / 100);
    view.show(halfway);
    view.frame();
    const half = instance(view.marks('ink'), 0).scale.x;
    expect(half).toBeLessThan(wide);
    expect(half).toBeGreaterThan(1);

    // Arrived: the enemies stand there and the marks are gone.
    const arrived = ticks(halfway, waves.telegraphMs / 100);
    expect(arrived.campaign!.waves!.opened).toBe(1);
    view.show(arrived);
    view.frame();
    expect(view.marks('ink').count).toBe(0);
    expect(view.marks('halo').visible).toBe(false);
    view.unmount();
  });

  it('draws with the transparent instanced variant the warmup compiles', () => {
    const warmed = createWarmupMaterials().filter((material) => (
      material.userData.warmInstanced
    )) as THREE.MeshBasicMaterial[];
    expect(warmed).toHaveLength(1);
    [WAVE_MARK_HALO_MATERIAL, WAVE_MARK_INK_MATERIAL].forEach((material) => {
      expect(material.type).toBe(warmed[0].type);
      expect(material.transparent).toBe(warmed[0].transparent);
      expect(material.depthWrite).toBe(warmed[0].depthWrite);
      expect(material.vertexColors).toBe(warmed[0].vertexColors);
      expect(material.map).toBe(warmed[0].map);
      expect(material.side).toBe(warmed[0].side);
      expect(material.fog).toBe(warmed[0].fog);
    });
  });
});
