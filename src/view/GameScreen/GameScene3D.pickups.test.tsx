// Pickups, campaign objectives and mini-boss guards at scene level: each
// reads apart by shape, shares its model, stays inside a small draw budget,
// shows a structure's HP as damage, holds still under reduced motion, and
// never compiles a shader once the round is live.
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import {
  CampaignObjectiveState, GameEngineState, MonsterState,
} from '../../engine/types';
import { cellKey } from '../../engine/fogOfWar';
import { Power, powerUpOptions } from '../../model/gameItem';
import { StageId } from '../../content/types';
import { toWorld } from './scene/sceneSpace';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';

beforeAll(() => {
  installFakeWebGL();
});

// A walled 15x11 floor with nothing on it.
function openMap() {
  return parseMapRows(Array.from({ length: 11 }, (_, y) => (
    Array.from({ length: 15 }, (__, x) => (
      x === 0 || y === 0 || x === 14 || y === 10 ? 'W' : ' '
    ))
  )));
}

function allVisible(state: GameEngineState): GameEngineState {
  const visible = state.map.flatMap((row, y) => row.map((_, x) => cellKey(x, y)));
  return {
    ...state,
    fogOfWar: {
      visible, explored: visible, sensedEnemies: [], sensedWalls: [],
    },
  };
}

function liveVersus(): GameEngineState {
  const state = createInitialState({
    mode: 'local',
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'sasuke'],
    map: openMap(),
  });
  return allVisible({
    ...state, monsters: [], roundStartTicksRemaining: 0, tick: 40,
  });
}

function withPickups(state: GameEngineState, pickups: { x: number; y: number; power: Power }[]) {
  const map = state.map.map((row) => [...row]);
  pickups.forEach(({ x, y, power }) => { map[y][x] = power; });
  return { ...state, map };
}

// The 15 types on a 5x3 grid of cells, two apart.
const PICKUP_CELLS = powerUpOptions.map((power, index) => ({
  power, x: 2 + (index % 5) * 2, y: 2 + Math.floor(index / 5) * 3,
}));

function liveCampaign(stageId: StageId = 'hiddenLeaf'): GameEngineState {
  const state = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: stageId,
    stageId,
    selectedCharacters: ['naruto'],
    map: openMap(),
  });
  return allVisible({
    ...state,
    monsters: [],
    players: state.players.map((player) => ({ ...player, x: 7, y: 8 })),
    roundStartTicksRemaining: 0,
    tick: 40,
  });
}

type ObjectiveSetup = {
  rescued?: boolean;
  structureHp?: number;
  structureStatus?: CampaignObjectiveState['status'];
  gateStatus?: CampaignObjectiveState['status'];
  arenaOpen?: boolean;
};

// Rescue target at (2,3), structure at (5,3), mini-boss gate at (8,3), arena at (11,3).
function withObjectives(state: GameEngineState, setup: ObjectiveSetup = {}): GameEngineState {
  const campaign = state.campaign as NonNullable<GameEngineState['campaign']>;
  // By kind, not position: the chain also holds the route puzzle.
  const byKind = (kind: CampaignObjectiveState['kind']) => {
    const found = campaign.objectives.find((objective) => objective.kind === kind);
    if (!found) throw new Error(`no ${kind} objective`);
    return found;
  };
  const rescue = byKind('rescue');
  const defense = byKind('defense');
  const miniBoss = byKind('miniBoss');
  const placed: Record<string, CampaignObjectiveState> = {
    [rescue.id]: {
      ...rescue,
      status: 'active',
      targets: [{
        id: 'villager', label: 'Villager', x: 2, y: 3, rescued: !!setup.rescued,
      }],
    },
    [defense.id]: {
      ...defense,
      status: setup.structureStatus ?? 'active',
      structureHp: setup.structureHp ?? 100,
      structureMaxHp: 100,
      x: 5,
      y: 3,
    },
    [miniBoss.id]: {
      ...miniBoss,
      status: setup.gateStatus ?? 'active',
      x: 8,
      y: 3,
    },
  };
  return {
    ...state,
    campaign: {
      ...campaign,
      objectives: campaign.objectives.map((objective) => placed[objective.id] ?? objective),
      bossArena: {
        ...campaign.bossArena, x: 11, y: 3, unlocked: !!setup.arenaOpen
      },
    },
  };
}

async function mount(
  state: GameEngineState,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES
) {
  const scene3d = (next: GameEngineState, prefs: GamePreferences) => (
    <GameScene3D state={next} preferences={prefs} />
  );
  const view = render(scene3d(state, preferences));
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  // r3f mounts once its (debounced) size measurement lands.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  const root = () => {
    const found = _roots.get(canvas);
    if (!found) throw new Error('scene not mounted');
    return found.store.getState();
  };
  let time = 0;
  const frame = (ms = 16) => {
    time += ms;
    act(() => { advance(time); });
  };
  return {
    scene: () => root().scene,
    gl: () => root().gl,
    programs: () => root().gl.info.programs?.length ?? 0,
    frame,
    rerender: async (next: GameEngineState, prefs: GamePreferences = preferences) => {
      view.rerender(scene3d(next, prefs));
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
      frame();
    },
    unmount: () => view.unmount(),
  };
}

// The group drawn for an entity: a direct child of the scene standing on its cell.
function entityGroup(scene: THREE.Scene, x: number, y: number): THREE.Object3D {
  const [wx, , wz] = toWorld(x, y);
  const group = scene.children.find((child) => (
    child.type === 'Group'
    && Math.abs(child.position.x - wx) < 1e-6
    && Math.abs(child.position.z - wz) < 1e-6
  ));
  if (!group) throw new Error(`nothing drawn at ${x},${y}`);
  return group;
}

function meshesUnder(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });
  return meshes;
}

const FLOOR_MARKS = ['TorusGeometry', 'RingGeometry', 'CircleGeometry'];

// The biggest solid part (floor rings and ink lines aside): what reads first.
function mainBody(root: THREE.Object3D): THREE.Mesh {
  const solids = meshesUnder(root).filter((mesh) => (
    !FLOOR_MARKS.includes(mesh.geometry.type)
    && (mesh.material as THREE.Material).side !== THREE.BackSide
  ));
  solids.forEach((mesh) => mesh.geometry.computeBoundingSphere());
  return solids.reduce((largest, mesh) => (
    (mesh.geometry.boundingSphere?.radius ?? 0) > (largest.geometry.boundingSphere?.radius ?? 0)
      ? mesh
      : largest
  ));
}

const shapeOf = (mesh: THREE.Mesh) => (
  `${mesh.geometry.type}:${mesh.geometry.getAttribute('position').count}`
);

function outlineOf(mesh: THREE.Mesh): string {
  mesh.geometry.computeBoundingBox();
  const size = (mesh.geometry.boundingBox as THREE.Box3).getSize(new THREE.Vector3());
  return `${shapeOf(mesh)}:${size.toArray().map((value) => value.toFixed(2)).join('x')}`;
}

function poseOf(root: THREE.Object3D): string {
  root.updateMatrixWorld(true);
  return meshesUnder(root)
    .map((mesh) => mesh.matrixWorld.elements.map((v) => v.toFixed(4)).join(','))
    .join('|');
}

describe('GameScene3D pickups', () => {
  it('draws every pickup type with its own outline, not a shared card with a small mark', async () => {
    const view = await mount(withPickups(liveVersus(), PICKUP_CELLS));
    view.frame();
    const outlines = PICKUP_CELLS.map(({ x, y }) => (
      outlineOf(mainBody(entityGroup(view.scene(), x, y)))
    ));
    expect(new Set(outlines).size).toBe(powerUpOptions.length);
    view.unmount();
  });

  it('shares one model between pickups of a type and stays inside a small draw budget', async () => {
    const empty = liveVersus();
    const view = await mount(empty);
    view.frame();
    view.frame();
    const base = { ...view.gl().info.render };
    await view.rerender(withPickups(empty, PICKUP_CELLS));
    view.frame();
    const { calls, triangles } = view.gl().info.render;
    // Floor ring, inked body, ink line and the body's shadow: four at most.
    expect((calls - base.calls) / PICKUP_CELLS.length).toBeLessThanOrEqual(4);
    expect((triangles - base.triangles) / PICKUP_CELLS.length).toBeLessThan(800);

    await view.rerender(withPickups(empty, [
      { x: 2, y: 2, power: 'AddBomb' }, { x: 6, y: 2, power: 'AddBomb' },
    ]));
    const first = meshesUnder(entityGroup(view.scene(), 2, 2));
    const second = meshesUnder(entityGroup(view.scene(), 6, 2));
    expect(second.map((mesh) => mesh.geometry)).toEqual(first.map((mesh) => mesh.geometry));
    second.forEach((mesh, index) => {
      expect(mesh.geometry).toBe(first[index].geometry);
      expect(mesh.material).toBe(first[index].material);
    });
    view.unmount();
  });

  it('bobs pickups gently, and holds them still under reduced motion', async () => {
    const state = withPickups(liveVersus(), PICKUP_CELLS);
    const moving = await mount(state);
    moving.frame();
    const before = poseOf(entityGroup(moving.scene(), 2, 2));
    moving.frame(700);
    expect(poseOf(entityGroup(moving.scene(), 2, 2))).not.toBe(before);
    moving.unmount();

    const still = await mount(state, { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true });
    still.frame();
    const poses = PICKUP_CELLS.map(({ x, y }) => poseOf(entityGroup(still.scene(), x, y)));
    still.frame(700);
    still.frame(900);
    expect(PICKUP_CELLS.map(({ x, y }) => poseOf(entityGroup(still.scene(), x, y)))).toEqual(poses);
    still.unmount();
  });
});

describe('GameScene3D campaign objectives', () => {
  it('draws rescue targets, the defended structure, the mini-boss gate and the arena gate as four models', async () => {
    const view = await mount(withObjectives(liveCampaign()));
    view.frame();
    const shapes = [[2, 3], [5, 3], [8, 3], [11, 3]].map(([x, y]) => (
      shapeOf(mainBody(entityGroup(view.scene(), x, y)))
    ));
    expect(new Set(shapes).size).toBe(4);
    view.unmount();
  });

  it('shows the structure cracking, burning and falling as its HP drops', async () => {
    const campaign = liveCampaign();
    const view = await mount(withObjectives(campaign));
    view.frame();
    const programs = view.programs();
    const structure = () => shapeOf(mainBody(entityGroup(view.scene(), 5, 3)));
    const steps: string[] = [structure()];
    await view.rerender(withObjectives(campaign, { structureHp: 95 }));
    // A scratch is not a hit worth a new look.
    expect(structure()).toBe(steps[0]);
    await view.rerender(withObjectives(campaign, { structureHp: 50 }));
    steps.push(structure());
    await view.rerender(withObjectives(campaign, { structureHp: 30 }));
    steps.push(structure());
    await view.rerender(withObjectives(campaign, { structureHp: 0, structureStatus: 'failed' }));
    steps.push(structure());
    expect(new Set(steps).size).toBe(4);
    // Back to full (a restart): the whole structure again.
    await view.rerender(withObjectives(campaign, { structureHp: 100 }));
    expect(structure()).toBe(steps[0]);
    expect(view.programs()).toBe(programs);
    view.unmount();
  });

  it('opens the gate and the arena seal by shape when their objectives complete', async () => {
    const campaign = liveCampaign();
    const view = await mount(withObjectives(campaign));
    view.frame();
    const gate = () => shapeOf(mainBody(entityGroup(view.scene(), 8, 3)));
    const arena = () => shapeOf(mainBody(entityGroup(view.scene(), 11, 3)));
    const rescue = () => shapeOf(mainBody(entityGroup(view.scene(), 2, 3)));
    const sealed = [gate(), arena(), rescue()];
    await view.rerender(withObjectives(campaign, {
      gateStatus: 'complete', arenaOpen: true, rescued: true,
    }));
    expect(gate()).not.toBe(sealed[0]);
    expect(arena()).not.toBe(sealed[1]);
    expect(rescue()).not.toBe(sealed[2]);
    view.unmount();
  });

  it('holds every objective still under reduced motion', async () => {
    const state = withObjectives(liveCampaign(), { arenaOpen: true });
    const cells = [[2, 3], [5, 3], [8, 3], [11, 3]];
    const moving = await mount(state);
    moving.frame();
    const rescueBefore = poseOf(entityGroup(moving.scene(), 2, 3));
    moving.frame(700);
    expect(poseOf(entityGroup(moving.scene(), 2, 3))).not.toBe(rescueBefore);
    moving.unmount();

    const still = await mount(state, { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true });
    still.frame();
    const poses = cells.map(([x, y]) => poseOf(entityGroup(still.scene(), x, y)));
    still.frame(700);
    still.frame(1300);
    expect(cells.map(([x, y]) => poseOf(entityGroup(still.scene(), x, y)))).toEqual(poses);
    still.unmount();
  });
});

function monster(id: string, x: number, y: number, archetype: MonsterState['archetype']): MonsterState {
  return {
    id, name: id, x, y, kind: 'fork', moveCooldown: 99999, archetype, elite: true,
  };
}

function withGuard(state: GameEngineState, guardArchetype: MonsterState['archetype']): GameEngineState {
  const withGate = withObjectives(state);
  const campaign = withGate.campaign as NonNullable<GameEngineState['campaign']>;
  const gate = campaign.objectives.find((objective) => objective.kind === 'miniBoss');
  if (!gate) throw new Error('no mini-boss gate');
  const guardId = gate.miniBossGuardId ?? `${gate.id}-guard`;
  return {
    ...withGate,
    monsters: [monster(guardId, 4, 6, guardArchetype), monster('patrol', 9, 6, guardArchetype)],
    campaign: {
      ...campaign,
      objectives: campaign.objectives.map((objective) => (
        objective.id === gate.id
          ? { ...objective, miniBossGuardId: guardId, miniBossSpawned: true }
          : objective
      )),
    },
  };
}

const silhouetteOf = (root: THREE.Object3D) => meshesUnder(root).map(shapeOf).sort().join(',');

describe('GameScene3D mini-boss guards', () => {
  it('sets a gate guard apart from an elite patrol of its archetype, and stage from stage', async () => {
    const leaf = await mount(withGuard(liveCampaign('hiddenLeaf'), 'anbu'));
    leaf.frame();
    const leafGuard = silhouetteOf(entityGroup(leaf.scene(), 4, 6));
    const patrol = silhouetteOf(entityGroup(leaf.scene(), 9, 6));
    expect(leafGuard).not.toBe(patrol);
    leaf.unmount();

    // Hidden Stone's guard is an ANBU too, yet it is not the Hidden Leaf guard.
    const stone = await mount(withGuard(liveCampaign('hiddenStone'), 'anbu'));
    stone.frame();
    expect(silhouetteOf(entityGroup(stone.scene(), 9, 6))).toBe(patrol);
    expect(silhouetteOf(entityGroup(stone.scene(), 4, 6))).not.toBe(leafGuard);
    stone.unmount();
  });
});

describe('GameScene3D pickup and objective looks are compiled before play', () => {
  it('shows every pickup, objective state and guard without a new program', async () => {
    const campaign = liveCampaign();
    // The round goes live with no pickup or objective in view.
    const hidden = campaign.campaign as NonNullable<GameEngineState['campaign']>;
    const view = await mount({
      ...campaign,
      campaign: {
        ...hidden,
        objectives: hidden.objectives.map((objective) => ({
          ...objective, targets: [], x: undefined, y: undefined,
        })),
        bossArena: { ...hidden.bossArena, x: 40, y: 40 },
      },
    });
    view.frame();
    view.frame();
    const programs = view.programs();
    expect(programs).toBeGreaterThan(0);
    const everything = (setup: ObjectiveSetup) => withPickups(
      withGuard({ ...withObjectives(campaign, setup) }, 'anbu'),
      PICKUP_CELLS.filter(({ y }) => y !== 3 && y !== 6)
    );
    await view.rerender(withObjectives(withGuard(campaign, 'anbu')));
    await view.rerender(everything({}));
    await view.rerender(everything({ structureHp: 60, rescued: true, gateStatus: 'locked' }));
    await view.rerender(everything({ structureHp: 30, structureStatus: 'complete', arenaOpen: true }));
    await view.rerender(everything({ structureHp: 0, structureStatus: 'failed', gateStatus: 'complete' }));
    await view.rerender(everything({}), { ...DEFAULT_GAME_PREFERENCES, highContrast: true });
    expect(view.programs()).toBe(programs);
    view.unmount();
  });
});
