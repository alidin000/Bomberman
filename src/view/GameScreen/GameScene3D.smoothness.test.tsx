import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import type * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';
import { createMotionStore } from '../../hooks/motionStore';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';

// r3f's render loop runs on requestAnimationFrame; drive it by hand. One fake
// clock for the whole file: r3f keeps its loop state per module, and a frame
// still queued when a test ends must run in the next one, or the loop thinks
// it is running and never asks for another frame.
beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

function liveVersus(): GameEngineState {
  const state = createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'sasuke'],
    map: parseMapRows(defaultMap),
  });
  return { ...state, roundStartTicksRemaining: 0, tick: 40 };
}

// The scene's React root commits and runs effects on the scheduler (real
// timers); let it settle before driving frames.
async function settle() {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
}

type Mounted = {
  rerender: (ui: React.ReactElement) => Promise<void>;
  wrapper: HTMLElement;
  scene: () => THREE.Scene;
  renders: () => number;
  frameloop: () => string;
  programs: () => number;
  run: (ms: number) => void;
};

async function mount(ui: React.ReactElement): Promise<Mounted> {
  const view = render(ui);
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  // r3f mounts once its (debounced) size measurement lands.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  await settle();
  const root = _roots.get(canvas);
  if (!root) throw new Error('scene not mounted');
  const { gl } = root.store.getState();
  const draw = gl.render.bind(gl);
  let renders = 0;
  gl.render = (scene, camera) => {
    renders += 1;
    draw(scene, camera);
  };
  return {
    rerender: async (next) => {
      view.rerender(next);
      await settle();
    },
    wrapper: view.container.firstElementChild as HTMLElement,
    scene: () => root.store.getState().scene,
    renders: () => renders,
    frameloop: () => root.store.getState().frameloop,
    programs: () => gl.info.programs?.length ?? 0,
    run: (ms) => act(() => { vi.advanceTimersByTime(ms); }),
  };
}

function findMeshes(scene: THREE.Scene, test: (mesh: THREE.Mesh) => boolean): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && test(mesh)) found.push(mesh);
  });
  return found;
}

function planeWidth(mesh: THREE.Mesh): number | undefined {
  const geometry = mesh.geometry as THREE.PlaneGeometry;
  return geometry.type === 'PlaneGeometry' ? geometry.parameters.width : undefined;
}

const scene3d = (
  state: GameEngineState,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES,
  extra: Pick<React.ComponentProps<typeof GameScene3D>, 'liveState' | 'motion'> = {}
) => (
  <GameScene3D
    state={state}
    preferences={preferences}
    liveState={extra.liveState}
    motion={extra.motion}
  />
);

describe('GameScene3D frame loop', () => {
  it('draws nothing while paused, and draws again as soon as play resumes', async () => {
    const live = liveVersus();
    const view = await mount(scene3d({ ...live, paused: true }));
    view.run(300);
    const settled = view.renders();
    view.run(1000);
    expect(view.renders() - settled).toBe(0);
    expect(view.frameloop()).toBe('demand');

    await view.rerender(scene3d(live));
    view.run(500);
    expect(view.frameloop()).toBe('always');
    expect(view.renders() - settled).toBeGreaterThan(20);
  });

  it('stops drawing under the round result too', async () => {
    const view = await mount(scene3d({ ...liveVersus(), phase: 'round_end' }));
    view.run(300);
    const settled = view.renders();
    view.run(1000);
    expect(view.renders() - settled).toBe(0);
  });

  it('draws a change made under the pause menu once, then stops again', async () => {
    const paused = { ...liveVersus(), paused: true };
    const view = await mount(scene3d(paused));
    view.run(300);
    const settled = view.renders();
    await view.rerender(scene3d(paused, { ...DEFAULT_GAME_PREFERENCES, hudScale: 120 }));
    view.run(1000);
    const drawn = view.renders() - settled;
    expect(drawn).toBeGreaterThanOrEqual(1);
    expect(drawn).toBeLessThanOrEqual(3);
  });
});

describe('GameScene3D high contrast', () => {
  it('retones the arena with uniforms instead of filtering the canvas', async () => {
    const state = liveVersus();
    const view = await mount(scene3d(state));
    view.run(100);
    const floor = () => findMeshes(view.scene(), (mesh) => planeWidth(mesh) === 16.1)[0];
    const normalFloor = (floor().material as THREE.MeshStandardMaterial).color.getHex();
    const programs = view.programs();

    await view.rerender(scene3d(state, { ...DEFAULT_GAME_PREFERENCES, highContrast: true }));
    view.run(100);

    // No CSS filter: it costs a full-screen compositor pass every frame.
    expect(view.wrapper.style.filter === '' || view.wrapper.style.filter === 'none').toBe(true);
    expect((floor().material as THREE.MeshStandardMaterial).color.getHex()).not.toBe(normalFloor);
    // Colours are uniforms: switching compiles no shader program.
    expect(view.programs()).toBe(programs);
  });
});

describe('GameScene3D time-driven cues between renders', () => {
  it('turns a blast preview red from the live fuse without a re-render', async () => {
    const base = liveVersus();
    const player = base.players[0];
    const bomb = {
      id: 'b1',
      ownerId: player.id,
      x: player.x,
      y: player.y,
      range: 2,
      ticksRemaining: 2500,
      manualDetonation: false,
      kind: 'standard' as const,
    };
    const rendered = { ...base, bombs: [bomb] };
    // The engine has moved on: 500 ms left, inside the red "about to blow" tier.
    const live = { ...rendered, bombs: [{ ...bomb, ticksRemaining: 500 }] };
    const view = await mount(
      scene3d(rendered, DEFAULT_GAME_PREFERENCES, { liveState: () => live })
    );
    view.run(100);

    const fill = findMeshes(view.scene(), (mesh) => (
      (mesh as THREE.InstancedMesh).isInstancedMesh && planeWidth(mesh) === 0.84
    ))[0] as THREE.InstancedMesh;
    expect(fill).toBeDefined();
    expect(fill.count).toBeGreaterThan(0);
  });

  it('does not burn flames out in the first frame drawn after a long pause', async () => {
    const motion = createMotionStore();
    motion.simTimeMs = 5000;
    const burning: GameEngineState = {
      ...liveVersus(),
      paused: true,
      explosions: [{
        x: 2, y: 1, ticksRemaining: 400, kind: 'standard',
      }],
    };
    const view = await mount(scene3d(burning, DEFAULT_GAME_PREFERENCES, { motion }));
    view.run(2000);
    // A setting changed under the pause menu draws a frame two seconds after
    // the last one; the flame (lifetime 500 ms) must still be early in its life.
    const moved = { ...DEFAULT_GAME_PREFERENCES, hudScale: 120 };
    await view.rerender(scene3d(burning, moved, { motion }));
    view.run(50);
    const flame = findMeshes(view.scene(), (mesh) => (
      (mesh as THREE.InstancedMesh).isInstancedMesh
      && (mesh.geometry as THREE.SphereGeometry).type === 'SphereGeometry'
      && (mesh as THREE.InstancedMesh).count === 1
    ))[0] as THREE.InstancedMesh;
    expect(flame).toBeDefined();
    // The flame rises from y 0.45 to 0.53 over its life (ExplosionField).
    const height = flame.instanceMatrix.array[13];
    expect(height).toBeGreaterThan(0.45);
    expect(height).toBeLessThan(0.5);
  });
});
