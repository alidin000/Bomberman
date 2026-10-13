import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from '../../GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from '../../gamePreferences';
import { createInitialState } from '../../../../engine/initialState';
import { parseMapRows } from '../../../../engine/mapLoader';
import type { GameEngineState } from '../../../../engine/types';
import type { RepairStage } from '../../../../content/villageSquare';
import { installFakeWebGL } from '../fakeWebGL.testutil';
import { MAP_OFFSET_X, MAP_OFFSET_Z } from '../sceneSpace';

// The living square in a real scene: the dressing follows the visit's repair
// stage (missing draws 1), extras walk and yield from the live state without
// a React render, ambient motion stops under reduced motion, and none of it
// compiles a shader once the match runs.

beforeAll(() => installFakeWebGL());

const campaignMap = parseMapRows(Array.from({ length: 50 }, (_, y) => (
  Array.from({ length: 50 }, (__, x) => {
    if (x === 0 || y === 0 || x === 49 || y === 49) return 'W';
    if (y === 4 && (x === 4 || x === 7)) return 'W';
    return ' ';
  })
)));

function mission(repairStage?: RepairStage, at = { x: 1, y: 1 }): GameEngineState {
  const initial = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['naruto'],
    map: campaignMap,
    seed: 7,
    difficulty: 'normal',
    village: {
      reputationTier: 'stranger', embers: 0, offeredRequestIds: [], repairStage,
    },
  });
  return {
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: initial.players.map((player) => ({ ...player, x: at.x, y: at.y })),
  };
}

async function renderScene(
  state: GameEngineState,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES
) {
  let live = state;
  const view = render(
    <GameScene3D state={state} preferences={preferences} liveState={() => live} />
  );
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  const root = _roots.get(canvas)!;
  let time = 0;
  const find = <T extends THREE.Object3D>(test: (object: THREE.Object3D) => boolean): T[] => {
    const found: T[] = [];
    root.store.getState().scene.traverse((object) => {
      if (test(object)) found.push(object as T);
    });
    return found;
  };
  const frame = (ms = 16) => { time += ms; act(() => { advance(time); }); };
  frame();
  // The scene clock runs on real time: frames with real time between them.
  const play = async (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
      frame(30);
    }
  };
  return {
    find,
    frame,
    play,
    setLive: (next: GameEngineState) => { live = next; },
    programs: () => root.store.getState().gl.info.programs?.length ?? 0,
    unmount: () => view.unmount(),
  };
}

type View = Awaited<ReturnType<typeof renderScene>>;

const life = (view: View) => view.find((object) => !!object.userData.villageLife)[0];
const lanterns = (view: View) => view.find<THREE.InstancedMesh>((object) => (
  !!object.userData.villageLanterns
))[0];
const extras = (view: View) => view.find<THREE.Group>((object) => !!object.userData.villageExtra);
const cellOf = (object: THREE.Object3D) => ({
  x: object.position.x - MAP_OFFSET_X,
  y: object.position.z - MAP_OFFSET_Z,
});

function instanceSnapshot(mesh: THREE.InstancedMesh): number[] {
  return Array.from(mesh.instanceMatrix.array as Float32Array).slice(0, mesh.count * 16);
}

describe('the living square', () => {
  it('dresses the square for the visit\'s repair stage, and stage 1 when none is given', async () => {
    type Seen = { stage: number; lanterns: number; lit: boolean; extras: number };
    const seen: Record<string, Seen> = {};
    const stages = [0, 1, 2, 3, undefined] as const;
    for (let index = 0; index < stages.length; index += 1) {
      const repair = stages[index];
      // eslint-disable-next-line no-await-in-loop
      const view = await renderScene(mission(repair));
      const lamp = lanterns(view);
      seen[String(repair)] = {
        stage: life(view).userData.repairStage,
        lanterns: lamp ? lamp.count : 0,
        lit: !!lamp?.userData.lit,
        extras: extras(view).length,
      };
      view.unmount();
    }
    expect(seen[0]).toMatchObject({ stage: 0, lanterns: 0, extras: 1 });
    expect(seen[1]).toMatchObject({ stage: 1, lit: false, extras: 1 });
    expect(seen[2]).toMatchObject({ stage: 2, lit: true, extras: 2 });
    expect(seen[3].extras).toBe(3);
    expect(seen[3].lanterns).toBeGreaterThan(seen[2].lanterns);
    expect(seen.undefined).toEqual(seen[1]);
  });

  it('walks its extras from the live state, and they step aside for a player', async () => {
    const start = mission(2, { x: 9, y: 7 });
    const view = await renderScene(start);
    const walker = extras(view)[0];
    const from = cellOf(walker);
    await view.play(2500);
    const moved = cellOf(walker);
    expect(Math.hypot(moved.x - from.x, moved.y - from.y)).toBeGreaterThan(0.5);

    // A player walks up beside it: it gives way and keeps a cell clear.
    const beside = { x: Math.round(moved.x) + 1, y: Math.round(moved.y) };
    view.setLive({ ...start, players: [{ ...start.players[0], x: beside.x, y: beside.y }] });
    await view.play(700);
    const after = cellOf(walker);
    const gap = Math.max(Math.abs(after.x - beside.x), Math.abs(after.y - beside.y));
    expect(gap > 1.1 || !walker.visible).toBe(true);
    view.unmount();
  }, 15000);

  it('keeps lanterns, smoke and birds still under reduced motion', async () => {
    const motion = async (reducedMotion: boolean) => {
      const view = await renderScene(mission(3), { ...DEFAULT_GAME_PREFERENCES, reducedMotion });
      const layers = view.find<THREE.InstancedMesh>((object) => (
        !!object.userData.villageLanterns
        || !!object.userData.villageSmoke
        || !!object.userData.villageBirds
      ));
      expect(layers).toHaveLength(3);
      const before = layers.map(instanceSnapshot);
      await view.play(400);
      const changed = layers.filter((mesh, index) => (
        instanceSnapshot(mesh).some((value, at) => Math.abs(value - before[index][at]) > 1e-6)
      )).length;
      const walker = extras(view)[0];
      const from = cellOf(walker);
      await view.play(2000);
      const walked = Math.hypot(cellOf(walker).x - from.x, cellOf(walker).y - from.y);
      view.unmount();
      return { changed, walked };
    };
    const moving = await motion(false);
    expect(moving.changed).toBe(3);
    expect(moving.walked).toBeGreaterThan(0.3);
    expect(await motion(true)).toEqual({ changed: 0, walked: 0 });
  }, 20000);

  it('compiles no shader while the square lives', async () => {
    const view = await renderScene(mission(3));
    const warmed = view.programs();
    await view.play(600);
    expect(view.programs()).toBe(warmed);
    view.unmount();
  });
});
