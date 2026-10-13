// The anime cast at scene level (scene/cast): fighters, enemies, gate guards
// and the square's canon people are drawn as their cast figures, one merged
// body and one ink line each, shared per look, and every look they can take
// mid-match is compiled before play.
import React from 'react';
import { vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { gameReducer } from '../../engine/reducer';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { cellKey } from '../../engine/fogOfWar';
import { toWorld } from './scene/sceneSpace';
import { GameEngineState, MonsterState } from '../../engine/types';
import type { VillageInteractable } from '../../content/villageSquare';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';
import { castFigureMesh, enemyFigureMesh } from './scene/cast/castGeometry';
import { guardFigureMesh } from './scene/MonsterFigure';

// The Leaf square's first villager is a canon cast member (a4 moves every
// square to SQUARE_CAST); the second keeps an invented id.
vi.mock('../../content/campaignLayouts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content/campaignLayouts')>();
  const leaf = actual.CAMPAIGN_STAGE_LAYOUTS.hiddenLeaf;
  return {
    ...actual,
    CAMPAIGN_STAGE_LAYOUTS: {
      ...actual.CAMPAIGN_STAGE_LAYOUTS,
      hiddenLeaf: {
        ...leaf,
        square: {
          ...leaf.square,
          interactables: leaf.square.interactables.map((item: VillageInteractable) => (
            item.id === 'villager-a' ? { ...item, villagerId: 'kakashi' } : item
          )),
        },
      },
    },
  };
});

beforeAll(() => installFakeWebGL());

const campaignMap = parseMapRows(Array.from({ length: 50 }, (_, y) => (
  Array.from({ length: 50 }, (__, x) => (x === 0 || y === 0 || x === 49 || y === 49 ? 'W' : ' '))
)));

function allVisible(state: GameEngineState): GameEngineState {
  const visible = state.map.flatMap((row, y) => row.map((_, x) => cellKey(x, y)));
  return {
    ...state,
    fogOfWar: {
      visible, explored: visible, sensedEnemies: [], sensedWalls: [],
    },
  };
}

function versus(): GameEngineState {
  const state = createInitialState({
    mode: 'local',
    numPlayers: 3,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'itachi', 'naruto'],
    map: parseMapRows(defaultMap),
  });
  return { ...state, roundStartTicksRemaining: 0, tick: 40 };
}

function monster(
  id: string,
  x: number,
  y: number,
  extra: Partial<MonsterState> = {}
): MonsterState {
  return {
    id, name: id, x, y, kind: 'fork', moveCooldown: 99999, archetype: 'anbu', ...extra,
  };
}

function leafMission(): GameEngineState {
  const initial = createInitialState({
    mode: 'solo',
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: ['gaara'],
    map: campaignMap,
    seed: 7,
    difficulty: 'normal',
    village: { reputationTier: 'known', embers: 0, offeredRequestIds: [] },
  });
  const gate = initial.campaign?.objectives.find((objective) => objective.kind === 'miniBoss');
  if (!gate) throw new Error('no mini-boss gate');
  const guardId = gate.miniBossGuardId ?? `${gate.id}-guard`;
  return allVisible({
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [
      monster('patrol-1', 20, 20),
      monster('patrol-2', 24, 20),
      monster('clone-1', 28, 20, { clone: true }),
      monster(guardId, 32, 20, { archetype: 'anbu' }),
    ],
  });
}

async function mount(state: GameEngineState) {
  const ui = (next: GameEngineState) => (
    <GameScene3D state={next} preferences={DEFAULT_GAME_PREFERENCES} liveState={() => next} />
  );
  const view = render(ui(state));
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  const root = () => _roots.get(canvas)!.store.getState();
  let time = 0;
  const frame = () => { time += 16; act(() => { advance(time); }); };
  frame();
  const find = (test: (object: THREE.Object3D) => boolean): THREE.Mesh[] => {
    const found: THREE.Mesh[] = [];
    root().scene.traverse((object) => { if (test(object)) found.push(object as THREE.Mesh); });
    return found;
  };
  return {
    frame,
    find,
    programs: () => root().gl.info.programs?.length ?? 0,
    rerender: async (next: GameEngineState) => {
      view.rerender(ui(next));
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
      frame();
    },
    unmount: () => view.unmount(),
  };
}

const isToon = (mesh: THREE.Mesh) => !!(mesh.material as THREE.MeshToonMaterial).isMeshToonMaterial;

function underPlayer(view: Awaited<ReturnType<typeof mount>>, id: string): THREE.Mesh[] {
  const ring = view.find((object) => object.userData.playerRing === id)[0];
  const meshes: THREE.Mesh[] = [];
  (ring.parent as THREE.Object3D).traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });
  return meshes;
}

describe('the anime cast in the scene', () => {
  it('draws each fighter as its cast figure: one painted body and one ink line, shared per character', async () => {
    const view = await mount(versus());
    view.frame();
    const bodies = ['player1', 'player2', 'player3'].map((id) => {
      const meshes = underPlayer(view, id);
      // The whole figure is one toon draw (the parts are merged), not a mesh per part.
      const toon = meshes.filter(isToon);
      expect({ id, toon: toon.length }).toEqual({ id, toon: 1 });
      expect(meshes.filter((mesh) => mesh.userData.fighterInk === id)).toHaveLength(1);
      const material = toon[0].material as THREE.MeshToonMaterial;
      expect(material.vertexColors).toBe(true);
      expect(material.map).toBeTruthy();
      return toon[0];
    });
    expect(bodies[0].geometry).toBe(castFigureMesh('naruto').body);
    expect(bodies[1].geometry).toBe(castFigureMesh('itachi').body);
    // A mirror match shares the first fighter's buffers.
    expect(bodies[2].geometry).toBe(bodies[0].geometry);
    view.unmount();
  });

  it('draws enemies from the cast, a pack sharing one look, and the gate guard as its stage\'s mini-boss', async () => {
    const state = leafMission();
    const view = await mount(state);
    view.frame();
    // The cast body drawn in the entity group standing on that monster's cell.
    const bodyOf = (id: string) => {
      const at = state.monsters.find((entry) => entry.id === id)!;
      const [wx, , wz] = toWorld(at.x, at.y);
      return view.find((object) => object.userData.castFigure !== undefined).find((mesh) => {
        let node: THREE.Object3D = mesh;
        while (node.parent && node.parent.type !== 'Scene') node = node.parent;
        return Math.abs(node.position.x - wx) < 1e-3 && Math.abs(node.position.z - wz) < 1e-3;
      })!;
    };
    const patrolA = bodyOf('patrol-1');
    const patrolB = bodyOf('patrol-2');
    expect(patrolA.userData.castFigure).toBe('anbu');
    expect(patrolA.geometry).toBe(enemyFigureMesh('anbu').body);
    expect(patrolB.geometry).toBe(patrolA.geometry);
    const guardId = state.monsters[3].id;
    const guard = bodyOf(guardId);
    expect(guard.userData.castFigure).toBe('iruka');
    expect(guard.geometry).toBe(guardFigureMesh('hiddenLeaf').body);
    // A water clone is the patrol look, see-through, without its ink line.
    const clone = bodyOf('clone-1');
    expect(clone.userData.castFigure).toBe('anbu');
    expect((clone.material as THREE.Material).transparent).toBe(true);
    const cloneInk = clone.parent?.children.find((child) => child.userData.castInk);
    expect(cloneInk?.visible).toBe(false);
    view.unmount();
  });

  it('draws Naruto\'s shadow clones as his cast figure, smaller and glowing', async () => {
    const start = versus();
    const state = allVisible(gameReducer(start, { type: 'DROP_BOMB', playerId: start.players[0].id })!);
    expect(state.bombs[0]?.kind).toBe('shadowClone');
    const view = await mount(state);
    view.frame();
    const naruto = castFigureMesh('naruto').body;
    const bodies = view.find((object) => (object as THREE.Mesh).geometry === naruto);
    // Two Narutos in this match (P1 and P3) plus P1's clone.
    expect(bodies).toHaveLength(3);
    const glowing = bodies.filter((mesh) => (
      ((mesh.material as THREE.MeshToonMaterial).emissiveIntensity ?? 0) > 0
    ));
    expect(glowing).toHaveLength(1);
    const height = (mesh: THREE.Mesh) => {
      mesh.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(mesh);
      return box.max.y - box.min.y;
    };
    const player = bodies.find((mesh) => !glowing.includes(mesh))!;
    expect(height(glowing[0])).toBeLessThan(height(player));
    expect(height(glowing[0])).toBeGreaterThan(height(player) * 0.6);
    view.unmount();
  });

  it('draws the square\'s canon people as their cast figures', async () => {
    const view = await mount(leafMission());
    view.frame();
    const villagers = view.find((object) => object.userData.villageProp === 'villager');
    const kakashi = villagers.find((mesh) => mesh.userData.interactable === 'villager-a');
    const sakura = villagers.find((mesh) => mesh.userData.interactable === 'villager-b');
    expect(kakashi?.userData.castFigure).toBe('kakashi');
    expect(kakashi?.geometry).toBe(castFigureMesh('kakashi').body);
    expect(((kakashi?.material) as THREE.MeshToonMaterial).map).toBeTruthy();
    expect(sakura?.userData.castFigure).toBe('sakura');
    expect(sakura?.geometry).toBe(castFigureMesh('sakura').body);
    // Kakashi's hair stays under the prompt that floats over villagers (1.42).
    kakashi!.updateWorldMatrix(true, false);
    const top = new THREE.Box3().setFromObject(kakashi!).max.y;
    expect(top).toBeLessThan(1.42);
    view.unmount();
  });

  it('compiles every cast look before play: Ghost, a water clone and a guard add no program', async () => {
    const state = leafMission();
    const solo = { ...state, monsters: state.monsters.slice(0, 1) };
    const view = await mount(solo);
    view.frame();
    view.frame();
    const programs = view.programs();
    expect(programs).toBeGreaterThan(0);
    await view.rerender({
      ...state,
      timedPowerUps: {
        ...state.timedPowerUps,
        player1: [{ power: 'Ghost', ticksRemaining: 5000, flashTicksRemaining: 0 }],
      },
    });
    view.frame();
    expect(view.find((object) => object.userData.castFigure === 'iruka')).toHaveLength(1);
    expect(view.programs()).toBe(programs);
    view.unmount();
  });
});
