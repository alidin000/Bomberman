import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from '../GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from '../gamePreferences';
import { createInitialState } from '../../../engine/initialState';
import { parseMapRows } from '../../../engine/mapLoader';
import { BombKind, BombState, GameEngineState } from '../../../engine/types';
import type { CampaignRequestState, ReputationTierId, ScarfId } from '../../../content/villageSquare';
import { installFakeWebGL } from './fakeWebGL.testutil';
import { toWorld } from './sceneSpace';
import { SCARF_COLORS } from './cast/castScarf';

// Scene contract for the village square (content/villageSquare.ts): what it
// draws at each tier, the prompt over the prop a local player can use (read
// from the live state, no re-render), the marks of accepted requests, the
// Honored scarf, and that none of it compiles a shader mid-mission. States
// are built by hand: the engine's square rules land separately.

beforeAll(() => installFakeWebGL());

// A 50x50 campaign board: border walls and the entrance district's pillars.
const campaignMap = parseMapRows(Array.from({ length: 50 }, (_, y) => (
  Array.from({ length: 50 }, (__, x) => {
    if (x === 0 || y === 0 || x === 49 || y === 49) return 'W';
    if (y === 4 && (x === 4 || x === 7)) return 'W';
    if ((x === 14 && y === 3) || (x === 13 && y === 2) || (x === 20 && y === 20)) return 'B';
    return ' ';
  })
)));

function mission({
  tier,
  players = 1,
  at = { x: 1, y: 1 },
  scarf,
}: {
  tier?: ReputationTierId;
  players?: number;
  at?: { x: number; y: number };
  scarf?: ScarfId;
} = {}): GameEngineState {
  const initial = createInitialState({
    mode: 'solo',
    numPlayers: players,
    totalRounds: 1,
    selectedMap: 'hiddenLeaf',
    stageId: 'hiddenLeaf',
    selectedCharacters: players > 1 ? ['naruto', 'sasuke'] : ['naruto'],
    map: campaignMap,
    seed: 7,
    difficulty: 'normal',
    village: tier ? {
      reputationTier: tier, embers: 40, offeredRequestIds: [], scarf,
    } : undefined,
  });
  return {
    ...initial,
    roundStartTicksRemaining: 0,
    monsters: [],
    players: initial.players.map((player, index) => (
      index === 0 ? { ...player, x: at.x, y: at.y } : { ...player, x: 5, y: 5 }
    )),
  };
}

function withRequests(
  state: GameEngineState,
  requests: CampaignRequestState[],
  fog: { visible: string[]; explored: string[] }
): GameEngineState {
  return {
    ...state,
    campaign: {
      ...state.campaign!,
      village: { requests, purchases: [], embersSpent: 0 },
    },
    fogOfWar: { ...state.fogOfWar, visible: fog.visible, explored: fog.explored },
  };
}

function versus(): GameEngineState {
  const state = createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'sasuke'],
    map: campaignMap,
  });
  return { ...state, roundStartTicksRemaining: 0 };
}

async function renderScene(state: GameEngineState, options: {
  localSeat?: number;
  preferences?: GamePreferences;
} = {}) {
  let live = state;
  const ui = (next: GameEngineState) => (
    <GameScene3D
      state={next}
      preferences={options.preferences ?? DEFAULT_GAME_PREFERENCES}
      liveState={() => live}
      localSeat={options.localSeat}
    />
  );
  const view = render(ui(state));
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
  const frame = () => { time += 16; act(() => { advance(time); }); };
  frame();
  return {
    frame,
    find,
    /** Changes what the engine reports this frame, without a React render. */
    setLive: (next: GameEngineState) => { live = next; },
    show: async (next: GameEngineState) => {
      live = next;
      view.rerender(ui(next));
      await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
    },
    programs: () => root.store.getState().gl.info.programs?.length ?? 0,
    unmount: () => view.unmount(),
  };
}

type View = Awaited<ReturnType<typeof renderScene>>;

const villagers = (view: View) => view.find<THREE.Mesh>((object) => (
  object.userData.villageProp === 'villager'
)).map((mesh) => mesh.userData.interactable as string).sort();

const prompts = (view: View) => view.find<THREE.Sprite>((object) => (
  !!object.userData.villagePrompt
));

const visiblePrompts = (view: View) => prompts(view).filter((sprite) => sprite.visible);

function expectAt(object: THREE.Object3D, x: number, y: number) {
  const [wx, , wz] = toWorld(x, y);
  expect(object.position.x).toBeCloseTo(wx);
  expect(object.position.z).toBeCloseTo(wz);
}

function instances(mesh: THREE.InstancedMesh): { x: number; z: number }[] {
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  return Array.from({ length: mesh.visible ? mesh.count : 0 }, (_, index) => {
    mesh.getMatrixAt(index, matrix);
    position.setFromMatrixPosition(matrix);
    return { x: position.x, z: position.z };
  });
}

const mark = (view: View, kind: string) => view.find<THREE.InstancedMesh>((object) => (
  object.userData.villageMark === kind
))[0];

const cellsOf = (list: { x: number; z: number }[]) => list
  .map(({ x, z }) => `${Math.round(x + 7)},${Math.round(z + 4.5)}`)
  .sort();

describe('village square scene', () => {
  it('stands the square in every campaign mission, with the wanderer only from Known', async () => {
    const stranger = await renderScene(mission());
    // Missing tier is a stranger's visit (co-op and online rooms).
    expect(villagers(stranger)).toEqual(['villager-a', 'villager-b']);
    expect(stranger.find((object) => object.userData.villageProp === 'paving')).toHaveLength(1);
    expect(stranger.find((object) => object.userData.villageProp === 'fixed')).toHaveLength(1);
    const villagerA = stranger.find((object) => object.userData.interactable === 'villager-a')[0];
    expectAt(villagerA.parent!, 4, 1);
    stranger.unmount();

    const known = await renderScene(mission({ tier: 'known' }));
    expect(villagers(known)).toEqual(['villager-a', 'villager-b', 'villager-wanderer']);
    known.unmount();

    const arena = await renderScene(versus());
    expect(arena.find((object) => !!object.userData.villageSquare)).toHaveLength(0);
    arena.unmount();
  });

  it('floats a prompt over the prop the local player can use, from the live state', async () => {
    const start = mission({ tier: 'known', at: { x: 5, y: 5 } });
    const view = await renderScene(start);
    expect(visiblePrompts(view)).toHaveLength(0);

    // At 7,2 the board and the wanderer (8,1, from Known) are both in reach
    // (diagonals count); the board comes first in the list. No new scene
    // state: only what the engine reports this frame.
    view.setLive({ ...start, players: [{ ...start.players[0], x: 7, y: 2 }] });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(1);
    expectAt(visiblePrompts(view)[0], 6, 1);
    const boardChip = visiblePrompts(view)[0].material;

    // 9,2 reaches only the wanderer.
    view.setLive({ ...start, players: [{ ...start.players[0], x: 9, y: 2 }] });
    view.frame();
    expectAt(visiblePrompts(view)[0], 8, 1);
    expect(visiblePrompts(view)[0].material).not.toBe(boardChip);

    // Mid-step positions round to the cell the player is in.
    view.setLive({ ...start, players: [{ ...start.players[0], x: 2.4, y: 6.6 }] });
    view.frame();
    expectAt(visiblePrompts(view)[0], 2, 8);

    view.setLive({ ...start, players: [{ ...start.players[0], x: 5, y: 5 }] });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(0);

    // A knocked-out player, or a finished round, shows none.
    const fallen = {
      ...start.players[0], x: 7, y: 2, alive: false,
    };
    view.setLive({ ...start, players: [fallen] });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(0);
    view.setLive({ ...start, phase: 'round_end', players: [{ ...start.players[0], x: 7, y: 2 }] });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(0);
    view.unmount();
  });

  it('prompts only this browser\'s seat in an online room', async () => {
    const start = mission({ players: 2, at: { x: 7, y: 2 } });
    // Seat 1 (player2) plays here; player1 is the other browser.
    const view = await renderScene(start, { localSeat: 1 });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(0);

    view.setLive({
      ...start,
      players: [start.players[0], { ...start.players[1], x: 10, y: 5 }],
    });
    view.frame();
    expect(visiblePrompts(view)).toHaveLength(1);
    expectAt(visiblePrompts(view)[0], 10, 6);
    view.unmount();
  });

  it('marks accepted requests\' keepsakes and crates where the fog shows them', async () => {
    const requests: CampaignRequestState[] = [
      {
        id: 'leaf-tea-tins',
        status: 'accepted',
        progress: 1,
        target: 3,
        cells: [{ x: 12, y: 3 }, { x: 16, y: 3 }],
      },
      {
        id: 'leaf-old-logs',
        status: 'accepted',
        progress: 0,
        target: 4,
        cells: [{ x: 14, y: 3 }, { x: 13, y: 2 }, { x: 20, y: 20 }],
      },
      // Done: nothing of it is left to mark.
      {
        id: 'leaf-clean-run', status: 'complete', progress: 1, target: 1, cells: [{ x: 15, y: 5 }],
      },
    ];
    const plain = mission({ tier: 'trusted', at: { x: 11, y: 4 } });
    const view = await renderScene(plain);
    const warmed = view.programs();
    expect(view.find((object) => !!object.userData.villageMarks)).toHaveLength(0);

    // Accepted mid-mission at the board: the marks mount now.
    await view.show(withRequests(plain, requests, {
      visible: ['12,3', '14,3', '11,4'],
      explored: ['13,2', '16,2'],
    }));
    view.frame();
    // Keepsakes show on visible cells only, as power-ups do (16,3 is hidden).
    expect(cellsOf(instances(mark(view, 'keepsake')))).toEqual(['12,3']);
    expect(cellsOf(instances(mark(view, 'keepsakeInk')))).toEqual(['12,3']);
    expect(cellsOf(instances(mark(view, 'keepsakeRing')))).toEqual(['12,3']);
    // Chalk follows the crate: visible or explored, not hidden (20,20).
    expect(cellsOf(instances(mark(view, 'chalk')))).toEqual(['13,2', '14,3']);
    // None of it compiled a shader mid-mission.
    expect(view.programs()).toBe(warmed);

    // The engine took a keepsake and a crate broke: they leave the cells.
    await view.show(withRequests(plain, [
      { ...requests[0], cells: [{ x: 16, y: 3 }] },
      { ...requests[1], cells: [{ x: 13, y: 2 }, { x: 20, y: 20 }] },
    ], { visible: ['12,3', '14,3', '11,4'], explored: ['13,2'] }));
    view.frame();
    expect(instances(mark(view, 'keepsake'))).toHaveLength(0);
    expect(mark(view, 'keepsake').visible).toBe(false);
    expect(cellsOf(instances(mark(view, 'chalk')))).toEqual(['13,2']);
    view.unmount();
  });

  it('keeps keepsakes still under reduced motion', async () => {
    const state = withRequests(mission({ at: { x: 11, y: 4 } }), [{
      id: 'leaf-tea-tins', status: 'accepted', progress: 0, target: 3, cells: [{ x: 12, y: 3 }],
    }], { visible: ['12,3'], explored: [] });
    const height = async (reducedMotion: boolean) => {
      const view = await renderScene(state, {
        preferences: { ...DEFAULT_GAME_PREFERENCES, reducedMotion },
      });
      const matrix = new THREE.Matrix4();
      const samples: number[] = [];
      for (let sample = 0; sample < 6; sample += 1) {
        // The scene clock runs on real time.
        // eslint-disable-next-line no-await-in-loop
        await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 90); }); });
        view.frame();
        mark(view, 'keepsake').getMatrixAt(0, matrix);
        samples.push(new THREE.Vector3().setFromMatrixPosition(matrix).y);
      }
      view.unmount();
      return Math.max(...samples) - Math.min(...samples);
    };
    expect(await height(false)).toBeGreaterThan(0.01);
    expect(await height(true)).toBe(0);
  });

  it('turns villagers to face a player who comes close, then back', async () => {
    const start = mission({ at: { x: 5, y: 5 } });
    // Reduced motion: they turn at once instead of easing round.
    const view = await renderScene(start, {
      preferences: { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true },
    });
    const villagerA = () => view.find((object) => (
      object.userData.interactable === 'villager-a'
    ))[0].parent!;
    const villagerB = () => view.find((object) => (
      object.userData.interactable === 'villager-b'
    ))[0].parent!;
    // At rest they face into the square: north edge south, west edge east.
    expect(villagerA().rotation.y).toBeCloseTo(0);
    expect(villagerB().rotation.y).toBeCloseTo(Math.PI / 2);

    // A step south-east of villager-a: it looks at the player.
    view.setLive({ ...start, players: [{ ...start.players[0], x: 5, y: 2 }] });
    view.frame();
    expect(villagerA().rotation.y).toBeCloseTo(Math.atan2(1, 1));
    expect(villagerB().rotation.y).toBeCloseTo(Math.PI / 2);

    view.setLive(start);
    view.frame();
    expect(villagerA().rotation.y).toBeCloseTo(0);
    view.unmount();
  });

  it('bolds the request chalk in high contrast with a uniform, not a new program', async () => {
    const state = withRequests(mission({ at: { x: 11, y: 4 } }), [{
      id: 'leaf-old-logs', status: 'accepted', progress: 0, target: 4, cells: [{ x: 14, y: 3 }],
    }], { visible: ['14,3'], explored: [] });
    const opacity = async (highContrast: boolean) => {
      const view = await renderScene(state, {
        preferences: { ...DEFAULT_GAME_PREFERENCES, highContrast },
      });
      const chalk = mark(view, 'chalk');
      const material = chalk.material as THREE.MeshBasicMaterial;
      const value = { opacity: material.opacity, shown: chalk.count };
      view.unmount();
      return value;
    };
    const normal = await opacity(false);
    const bold = await opacity(true);
    expect(normal.shown).toBe(1);
    expect(bold.opacity).toBeGreaterThan(normal.opacity);
    expect(bold.opacity).toBe(1);
    // Unmounting restores the shared material for the next match.
    expect((await opacity(false)).opacity).toBe(normal.opacity);
  });

  it('keeps blast previews and Naruto\'s clones out of the square, as blasts stop at its edge', async () => {
    // A bomb in the east way out (11,4): its west ray would run into the square.
    const armed = (kind: BombKind, ticksRemaining: number): GameEngineState => {
      const start = mission({ at: { x: 13, y: 6 } });
      const bomb: BombState = {
        id: 'bomb-1',
        ownerId: 'player1',
        x: 11,
        y: 4,
        range: 3,
        ticksRemaining,
        manualDetonation: false,
        kind,
        ageMs: 2600,
      };
      const map = start.map.map((row) => [...row]);
      map[4][11] = { range: 3, coords: { x: 11, y: 4 }, ownerId: 'player1' };
      const visible: string[] = [];
      for (let y = 0; y <= 9; y += 1) {
        for (let x = 5; x <= 16; x += 1) visible.push(`${x},${y}`);
      }
      return {
        ...start, map, bombs: [bomb], fogOfWar: { ...start.fogOfWar, visible, explored: [] },
      };
    };
    const inSquare = (cell: string) => {
      const [x, y] = cell.split(',').map(Number);
      return x >= 1 && x <= 10 && y >= 1 && y <= 8;
    };

    const view = await renderScene(armed('standard', 40));
    view.frame();
    const edge = view.find<THREE.InstancedMesh>((object) => {
      const { geometry } = object as THREE.InstancedMesh;
      return (object as THREE.InstancedMesh).isInstancedMesh
        && geometry.type === 'RingGeometry'
        && (geometry as THREE.RingGeometry).parameters.innerRadius === 0.47;
    })[0];
    const previewed = cellsOf(instances(edge));
    expect(previewed).toContain('11,4');
    expect(previewed).toContain('14,4');
    expect(previewed.filter(inSquare)).toEqual([]);
    view.unmount();

    // A barrage about to blow: its clones stand round it, none in the square.
    const barrage = await renderScene(armed('shadowCloneBarrage', 4));
    barrage.frame();
    const clones = barrage.find((object) => (
      object.type === 'Group' && object.parent?.children.length !== undefined
      && object.children.some((child) => (
        (child as THREE.Mesh).geometry?.type === 'CapsuleGeometry'
        && ((child as THREE.Mesh).geometry as THREE.CapsuleGeometry).parameters.radius === 0.11
      ))
    )).map((group) => {
      const at = group.getWorldPosition(new THREE.Vector3());
      return `${Math.round(at.x + 7)},${Math.round(at.z + 4.5)}`;
    });
    expect(clones.length).toBeGreaterThan(0);
    expect(clones.filter(inSquare)).toEqual([]);
    barrage.unmount();
  });

  it('wears the scarf the player chose, in its own colours, on the first player only', async () => {
    // Who wears which scarf: the fighter whose pose group holds it (it
    // follows every pose), and the scarf's cloth colour as drawn.
    const scarves = async (state: GameEngineState) => {
      const view = await renderScene(state);
      const wearers = view.find((object) => !!object.userData.villageScarf).map((scarf) => {
        let node: THREE.Object3D | null = scarf;
        let wearer: string | null = null;
        while (node && !wearer) {
          const ink = node.children.find((child) => child.userData.fighterInk);
          if (ink) wearer = ink.userData.fighterInk as string;
          node = node.parent;
        }
        const id = scarf.userData.villageScarf as ScarfId;
        const colors = (scarf as THREE.Mesh).geometry.getAttribute('color');
        const cloth = new THREE.Color(SCARF_COLORS[id].cloth);
        let inCloth = false;
        for (let i = 0; i < colors.count && !inCloth; i += 1) {
          inCloth = Math.abs(colors.getX(i) - cloth.r) < 1e-4
            && Math.abs(colors.getY(i) - cloth.g) < 1e-4
            && Math.abs(colors.getZ(i) - cloth.b) < 1e-4;
        }
        return `${wearer}:${id}:${inCloth ? 'cloth' : 'unpainted'}`;
      });
      view.unmount();
      return wearers;
    };
    // Standing alone no longer dresses anyone: the scarf is the player's pick.
    expect(await scarves(mission({ tier: 'honored' }))).toEqual([]);
    expect(await scarves(mission())).toEqual([]);
    expect(await scarves(mission({ tier: 'honored', scarf: 'ember' }))).toEqual(['player1:ember:cloth']);
    expect(await scarves(mission({ tier: 'trusted', scarf: 'hiddenMist', players: 2 })))
      .toEqual(['player1:hiddenMist:cloth']);
    expect(SCARF_COLORS.hiddenMist.cloth).not.toBe(SCARF_COLORS.ember.cloth);
  });
});
