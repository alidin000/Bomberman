import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';
import { createInitialState, ROUND_START_COUNTDOWN_MS } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { GameEngineState } from '../../engine/types';
import { arenaMapRows } from '../../content/arenaMaps';
import { CITY_LOOKS } from '../../content/stageLooks';
import { CAMERA_HEIGHT, MAX_FRAMING } from './scene/cameraFraming';
import { LANDMARK_MATERIAL } from './scene/landmarkGeometry';
import { OVERVIEW_END_MS } from './scene/roundOverview';

// A city arena on the real scene in jsdom (every GL call a no-op): its mask,
// its look, and the round-start overview's camera.

// A river is drawn into Budapest's mask here, on its own wall cells, so the
// water layer is exercised whatever the committed content holds.
const river = vi.hoisted(() => ({ rows: null as string[] | null }));
vi.mock('../../content/arenaMaps', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content/arenaMaps')>();
  return {
    ...actual,
    arenaMapMask: (id: Parameters<typeof actual.arenaMapMask>[0]) => (
      id === 'budapest' && river.rows ? river.rows : actual.arenaMapMask(id)
    ),
  };
});

beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

const budapestGrid = arenaMapRows('budapest');
river.rows = budapestGrid.map((row, y) => row.map((cell, x) => {
  if (x === 0 || y === 0 || x === row.length - 1 || y === budapestGrid.length - 1) return 'e';
  if (cell === 'W') return x >= 7 && x <= 11 ? 'w' : 'b';
  return (x + y) % 3 === 0 ? 'r' : '.';
}).join(''));
const waterCells = budapestGrid.flatMap((row, y) => row
  .map((cell, x) => ({ cell, x, y }))
  .filter(({ cell, x, y: cy }) => cell === 'W' && river.rows![cy][x] === 'w'));

function cityState(selectedMap: 'rome' | 'budapest' | 'hiddenLeaf', extra: Partial<GameEngineState> = {}) {
  return {
    ...createInitialState({
      mode: 'local',
      numPlayers: 2,
      totalRounds: 3,
      selectedMap,
      // An older setup's stage: the route's map decides the look anyway.
      stageId: 'hiddenSand',
      selectedCharacters: ['naruto', 'sasuke'],
      map: parseMapRows(arenaMapRows(selectedMap)),
    }),
    ...extra,
  };
}

async function settle() {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
}

type SceneProps = {
  preferences?: GamePreferences;
  liveState?: () => GameEngineState | null;
  overviewSkipped?: boolean;
};

const scene3d = (state: GameEngineState, props: SceneProps = {}) => (
  <GameScene3D
    state={state}
    preferences={props.preferences ?? DEFAULT_GAME_PREFERENCES}
    liveState={props.liveState}
    overviewSkipped={props.overviewSkipped}
    idle={false}
  />
);

async function mount(state: GameEngineState, props: SceneProps = {}) {
  const view = render(scene3d(state, props));
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  await settle();
  const root = () => {
    const found = _roots.get(canvas);
    if (!found) throw new Error('scene not mounted');
    return found.store.getState();
  };
  return {
    root,
    camera: () => root().camera,
    run: (ms: number) => act(() => { vi.advanceTimersByTime(ms); }),
    rerender: async (next: GameEngineState, nextProps: SceneProps = props) => {
      view.rerender(scene3d(next, nextProps));
      await settle();
    },
    unmount: () => view.unmount(),
  };
}

function tileLayer(scene: THREE.Scene, layer: string): THREE.InstancedMesh | null {
  let found: THREE.InstancedMesh | null = null;
  scene.traverse((object) => {
    if (object.userData.tileLayer === layer) found = object as THREE.InstancedMesh;
  });
  return found;
}

describe('GameScene3D city arenas', () => {
  it('draws the river flat on its wall cells, on the ground\'s own shader program', async () => {
    const state = cityState('budapest', { roundStartTicksRemaining: 0 });
    const view = await mount(state);
    view.run(50);
    const { scene, gl } = view.root();
    const water = tileLayer(scene, 'waterVisible');
    const ground = tileLayer(scene, 'groundVisible');
    expect(water).not.toBeNull();
    expect(water!.count).toBe(waterCells.length);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const drawn = new Set<string>();
    for (let index = 0; index < water!.count; index += 1) {
      water!.getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      drawn.add(`${Math.round(position.x + 7)},${Math.round(position.z + 4.5)}`);
    }
    expect(drawn).toEqual(new Set(waterCells.map(({ x, y }) => `${x},${y}`)));
    // No program of its own: water renders with the ground's.
    const program = (mesh: THREE.Mesh) => gl.properties.get(mesh.material).currentProgram;
    expect(program(water!)).toBeDefined();
    expect(program(water!)).toBe(program(ground!));
    view.unmount();
  });

  it('always draws the map\'s colours and water, and its skyline only with scenery on', async () => {
    const state = cityState('budapest', { roundStartTicksRemaining: 0 });
    const landmarks = (scene: THREE.Scene) => {
      const found: THREE.Object3D[] = [];
      scene.traverse((object) => {
        if ((object as THREE.Mesh).material === LANDMARK_MATERIAL) found.push(object);
      });
      return found;
    };
    const plain = await mount(state, {
      preferences: { ...DEFAULT_GAME_PREFERENCES, scenery: false },
    });
    plain.run(50);
    expect(landmarks(plain.root().scene)).toHaveLength(0);
    expect(tileLayer(plain.root().scene, 'waterVisible')?.count).toBe(waterCells.length);
    plain.unmount();

    const dressed = await mount(state, {
      preferences: { ...DEFAULT_GAME_PREFERENCES, scenery: true },
    });
    dressed.run(50);
    // The famous place is one merged draw, among at most six.
    const drawn = landmarks(dressed.root().scene);
    expect(drawn.length).toBeGreaterThan(1);
    expect(drawn.length).toBeLessThanOrEqual(6);
    dressed.unmount();
  });

  it('keeps the water layer off village arenas altogether', async () => {
    const view = await mount(cityState('hiddenLeaf', { roundStartTicksRemaining: 0 }));
    view.run(50);
    expect(tileLayer(view.root().scene, 'waterVisible')).toBeNull();
    view.unmount();
  });

  it('draws the city\'s buildings on the walls\' own program, their detail only with scenery on', async () => {
    const state = cityState('budapest', { roundStartTicksRemaining: 0 });
    const dressed = await mount(state, {
      preferences: { ...DEFAULT_GAME_PREFERENCES, scenery: true },
    });
    dressed.run(50);
    const { scene, gl } = dressed.root();
    const mass = tileLayer(scene, 'cityBuildingMass');
    const detail = tileLayer(scene, 'cityBuildingDetail');
    const crates = tileLayer(scene, 'crateVisible');
    expect(mass?.visible).toBe(true);
    expect(detail?.visible).toBe(true);
    // Every building and border wall is part of a block: no cube is left
    // for them (the mocked mask has no other walls than water).
    expect(tileLayer(scene, 'wallVisible')?.count ?? 0).toBe(0);
    // Walls and crates share one program; the buildings must reuse it.
    const program = (mesh: THREE.Mesh) => gl.properties.get(mesh.material).currentProgram;
    expect(program(mass!)).toBeDefined();
    expect(program(mass!)).toBe(program(crates!));
    expect(program(detail!)).toBe(program(crates!));
    dressed.unmount();

    const plain = await mount(state, {
      preferences: { ...DEFAULT_GAME_PREFERENCES, scenery: false },
    });
    plain.run(50);
    expect(tileLayer(plain.root().scene, 'cityBuildingMass')?.visible).toBe(true);
    expect(tileLayer(plain.root().scene, 'cityBuildingDetail')?.visible).toBe(false);
    plain.unmount();
  });

  it('keeps today\'s walls for a playtest tab, and builds a village arena as its village', async () => {
    sessionStorage.setItem('shinobiCityPlaytest', '1');
    try {
      const playtest = await mount(cityState('budapest', { roundStartTicksRemaining: 0 }));
      playtest.run(50);
      expect(tileLayer(playtest.root().scene, 'cityBuildingMass')).toBeNull();
      expect(tileLayer(playtest.root().scene, 'wallVisible')?.count).toBeGreaterThan(0);
      playtest.unmount();
    } finally {
      sessionStorage.removeItem('shinobiCityPlaytest');
    }
    const village = await mount(cityState('hiddenLeaf', { roundStartTicksRemaining: 0 }));
    village.run(50);
    const { scene, gl } = village.root();
    const program = (mesh: THREE.Mesh) => gl.properties.get(mesh.material).currentProgram;
    const mass = tileLayer(scene, 'cityBuildingMass');
    expect(mass).not.toBeNull();
    // Every Leaf wall is forest, a house, a hut or a stone: no cube is left.
    expect(tileLayer(scene, 'wallVisible')?.count ?? 0).toBe(0);
    // Its houses and crates share one program, as a city's do.
    expect(program(mass!)).toBe(program(tileLayer(scene, 'crateVisible')!));
    village.unmount();
  });

  it('compiles the figures\' shadow program in the countdown, though none starts in the key light\'s shadow', async () => {
    // A city has no versus monsters, so no figure starts under the key
    // light's shadow camera; the first to walk in used to link a program
    // mid-round (the shadow pass's depth program for the cast atlas).
    const start = cityState('rome');
    const view = await mount(start);
    view.run(200);
    const { gl } = view.root();
    const programs = () => gl.info.programs?.length ?? 0;
    const atGo = programs();
    expect(atGo).toBeGreaterThan(0);
    // P1 walks to the middle of the old 15x10 arena, where the shadow falls.
    await view.rerender({
      ...start,
      roundStartTicksRemaining: 0,
      players: start.players.map((player, index) => (
        index === 0 ? { ...player, x: 7, y: 4 } : player
      )),
    });
    view.run(200);
    expect(programs()).toBe(atGo);
    view.unmount();
  });

  it('dresses a city route in the city\'s look, whatever stage the setup names', async () => {
    const view = await mount(cityState('rome', { roundStartTicksRemaining: 0 }));
    view.run(50);
    const hemispheres: string[] = [];
    view.root().scene.traverse((object) => {
      const light = object as THREE.HemisphereLight;
      if (light.isHemisphereLight) hemispheres.push(`#${light.color.getHexString()}`);
    });
    expect(hemispheres).toEqual([CITY_LOOKS.rome.hemisphere.sky]);
    view.unmount();
  });
});

describe('GameScene3D round-start overview', () => {
  const playHeight = CAMERA_HEIGHT * MAX_FRAMING;

  async function countdown(selectedMap: 'rome' | 'hiddenLeaf', props: SceneProps = {}, round = 1) {
    let remaining = ROUND_START_COUNTDOWN_MS;
    const state = cityState(selectedMap, { round });
    const liveState = () => ({ ...state, roundStartTicksRemaining: remaining });
    const view = await mount(state, { ...props, liveState });
    const step = (ms: number) => {
      for (let done = 0; done < ms; done += 50) {
        remaining = Math.max(0, remaining - 50);
        view.run(50);
      }
    };
    return { view, step, height: () => view.camera().position.y };
  }

  it('cuts to the whole board, pushes in, and cuts back to the players a second before GO', async () => {
    const { view, step, height } = await countdown('rome');
    view.run(16);
    // Straight to a view far above any play framing: no sweep across the board.
    const opening = height();
    expect(opening).toBeGreaterThan(playHeight);
    step(1500);
    expect(height()).toBeLessThan(opening - 0.3);
    expect(height()).toBeGreaterThan(playHeight);
    // The last second of the countdown is on the players, in one cut.
    step(ROUND_START_COUNTDOWN_MS - OVERVIEW_END_MS - 1500 + 50);
    expect(height()).toBeLessThan(playHeight);
    view.unmount();
  });

  it('holds still and cuts under reduced motion', async () => {
    const preferences = { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true };
    const { view, step, height } = await countdown('rome', { preferences });
    view.run(16);
    const opening = height();
    expect(opening).toBeGreaterThan(playHeight);
    step(1500);
    expect(height()).toBeCloseTo(opening, 5);
    step(ROUND_START_COUNTDOWN_MS - OVERVIEW_END_MS - 1500 + 50);
    expect(height()).toBeLessThan(playHeight);
    view.unmount();
  });

  it('stays on the players once skipped, in later rounds, and on village arenas', async () => {
    const skipped = await countdown('rome', { overviewSkipped: true });
    skipped.view.run(16);
    expect(skipped.height()).toBeLessThan(playHeight);
    skipped.view.unmount();

    const second = await countdown('rome', {}, 2);
    second.view.run(16);
    expect(second.height()).toBeLessThan(playHeight);
    second.view.unmount();

    const village = await countdown('hiddenLeaf');
    village.view.run(16);
    expect(village.height()).toBeLessThan(playHeight);
    village.view.unmount();
  });

  it('cuts back as soon as the overview is skipped mid-way', async () => {
    const { view, step, height } = await countdown('rome');
    view.run(16);
    step(500);
    expect(height()).toBeGreaterThan(playHeight);
    const state = cityState('rome');
    await view.rerender(state, {
      overviewSkipped: true,
      liveState: () => ({ ...state, roundStartTicksRemaining: 2400 }),
    });
    view.run(16);
    expect(height()).toBeLessThan(playHeight);
    view.unmount();
  });
});
