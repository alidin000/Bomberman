import { vi } from 'vitest';
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { createBossForConfig, createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { BOSS_INTRO_MS } from '../../engine/constants';
import { BossHazard, GameEngineState } from '../../engine/types';
import { cellKey } from '../../engine/fogOfWar';
import { BOSS_DEFINITIONS } from '../../content/bosses';
import { BossId } from '../../content/types';
import { getBossFigureMaterials } from './scene/BossFigure';
import { SEAL_DONE_MS } from './scene/bossPresentation';
import { installFakeWebGL } from './scene/fakeWebGL.testutil';
import { toWorld } from './scene/sceneSpace';

// The boss at scene level: its creature model, what it must never hide, and
// its entrance, phase change and seal, all drawn from frame time or the live
// state without writing the engine.

beforeAll(() => {
  installFakeWebGL();
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
});

afterAll(() => {
  vi.useRealTimers();
});

const width = 35;
const openStage = parseMapRows(Array.from({ length: 35 }, (_, y) => (
  y === 0 || y === 34
    ? 'W'.repeat(width)
    : `W${' '.repeat(width - 2)}W`
).split('')));

const BOSS_AT = { x: 17, y: 17 };
const allCells = Array.from({ length: 35 }, (_, y) => (
  Array.from({ length: 35 }, (__, x) => cellKey(x, y))
)).flat();

/** A campaign arena: one ninja at `player`, the boss at the centre, every cell in view. */
function arena(
  player: { x: number; y: number },
  bossId: BossId = 'shukaku',
  extra: Partial<GameEngineState> = {}
): GameEngineState {
  const config = {
    mode: 'solo' as const,
    numPlayers: 1,
    totalRounds: 1,
    selectedMap: 'hiddenSand',
    stageId: 'hiddenSand' as const,
    selectedCharacters: ['gaara' as const],
    map: openStage,
    seed: 3,
  };
  const state = createInitialState(config);
  const boss = createBossForConfig({ ...config, map: state.map })!;
  const definition = BOSS_DEFINITIONS.find((item) => item.id === bossId)!;
  return {
    ...state,
    roundStartTicksRemaining: 0,
    tick: 40,
    monsters: [],
    players: state.players.map((item) => ({ ...item, ...player })),
    boss: {
      ...boss,
      ...BOSS_AT,
      id: bossId,
      name: definition.name,
      tails: definition.tails,
      attackCooldown: 1e9,
      moveCooldown: 1e9,
    },
    fogOfWar: { ...state.fogOfWar, visible: allCells, explored: allCells },
    ...extra,
  };
}

async function settle() {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 30); }); });
}

type SceneProps = {
  preferences?: GamePreferences;
  liveState?: () => GameEngineState | null;
  idle?: boolean;
};

const scene3d = (state: GameEngineState, props: SceneProps = {}) => (
  <GameScene3D
    state={state}
    preferences={props.preferences ?? DEFAULT_GAME_PREFERENCES}
    liveState={props.liveState}
    idle={props.idle ?? false}
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
    scene: () => root().scene,
    camera: () => root().camera,
    run: (ms: number) => act(() => { vi.advanceTimersByTime(ms); }),
    rerender: async (next: GameEngineState, nextProps: SceneProps = props) => {
      view.rerender(scene3d(next, nextProps));
      await settle();
    },
    unmount: () => view.unmount(),
  };
}

/** The boss's base meshes (body, trim, core) and its instanced tails, as drawn. */
function bossParts(scene: THREE.Scene, bossId: BossId) {
  const materials = getBossFigureMaterials(bossId);
  const ours = new Set<THREE.Material>([
    materials.body, materials.trim, materials.core,
    materials.seeThrough.body, materials.seeThrough.trim, materials.seeThrough.core,
  ]);
  const meshes: THREE.Mesh[] = [];
  let tails: THREE.InstancedMesh | null = null;
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.userData.bossTails === bossId) tails = mesh as THREE.InstancedMesh;
    else if (ours.has(mesh.material as THREE.Material)) meshes.push(mesh);
  });
  const body = meshes.find((mesh) => (
    mesh.material === materials.body || mesh.material === materials.seeThrough.body
  ));
  return { meshes, tails: tails as THREE.InstancedMesh | null, body };
}

function drawn(object: THREE.Object3D | undefined | null): boolean {
  let node: THREE.Object3D | null | undefined = object;
  while (node) {
    if (!node.visible) return false;
    node = node.parent;
  }
  return !!object;
}

function hazard(x: number, y: number): BossHazard {
  return {
    id: `h-${x}-${y}`, kind: 'sandSpikes', x, y, ticksRemaining: 2000, warningTicks: 1600, color: '#f59e0b', damage: 1,
  };
}

describe('GameScene3D boss', () => {
  it('draws each boss as its own creature, with one tail per tail it has', async () => {
    // One at a time: each needs its own scene.
    const counts = await BOSS_DEFINITIONS.reduce<Promise<Record<string, number>>>(
      async (done, boss) => {
        const found = await done;
        const view = await mount(arena({ x: 17, y: 20 }, boss.id));
        view.run(50);
        const { meshes, tails } = bossParts(view.scene(), boss.id);
        expect(meshes.length).toBeGreaterThanOrEqual(3);
        view.unmount();
        return { ...found, [boss.id]: tails?.count ?? 0 };
      },
      Promise.resolve({})
    );
    expect(counts).toEqual(
      Object.fromEntries(BOSS_DEFINITIONS.map((boss) => [boss.id, boss.tails]))
    );
  });

  it('turns see-through while it would hide a ninja or a telegraph behind it', async () => {
    const view = await mount(arena({ x: 17, y: 15 }));
    view.run(400);
    let { body } = bossParts(view.scene(), 'shukaku');
    const behind = body!.material as THREE.MeshStandardMaterial;
    expect(behind.transparent).toBe(true);
    expect(behind.opacity).toBeLessThan(0.5);

    // The ninja walks round to the front: solid again.
    await view.rerender(arena({ x: 17, y: 20 }));
    view.run(400);
    ({ body } = bossParts(view.scene(), 'shukaku'));
    expect((body!.material as THREE.MeshStandardMaterial).transparent).toBe(false);

    // A boss strike telegraphed on the cell behind it shows through as well.
    await view.rerender(arena({ x: 17, y: 20 }, 'shukaku', { hazards: [hazard(17, 15)] }));
    view.run(400);
    ({ body } = bossParts(view.scene(), 'shukaku'));
    expect((body!.material as THREE.MeshStandardMaterial).transparent).toBe(true);
    view.unmount();
  });

  it('keeps drawing a sealed boss while it collapses and dissolves, then lets it go', async () => {
    const live = arena({ x: 17, y: 20 });
    const sealed: GameEngineState = {
      ...live,
      boss: { ...live.boss!, health: 0 },
      phase: 'game_over',
      paused: true,
    };
    // GameScreen keeps the scene drawing through the hold (idle false).
    const view = await mount(sealed, { idle: false });
    view.run(32);
    let { body } = bossParts(view.scene(), 'shukaku');
    expect(drawn(body)).toBe(true);
    const startY = new THREE.Vector3();
    body!.getWorldPosition(startY);

    view.run(SEAL_DONE_MS / 2);
    ({ body } = bossParts(view.scene(), 'shukaku'));
    const middle = new THREE.Vector3();
    body!.getWorldPosition(middle);
    const material = body!.material as THREE.MeshStandardMaterial;
    expect(drawn(body)).toBe(true);
    // Sinking and fading, not gone.
    expect(middle.y).toBeLessThan(startY.y - 0.1);
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeGreaterThan(0.05);
    expect(material.opacity).toBeLessThan(0.95);

    view.run(SEAL_DONE_MS / 2 + 200);
    ({ body } = bossParts(view.scene(), 'shukaku'));
    expect(drawn(body)).toBe(false);
    view.unmount();
  });

  it('dissolves in place under reduced motion: no sinking, no toppling', async () => {
    const live = arena({ x: 17, y: 20 });
    const sealed: GameEngineState = {
      ...live, boss: { ...live.boss!, health: 0 }, phase: 'game_over', paused: true,
    };
    const preferences = { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true };
    const view = await mount(sealed, { idle: false, preferences });
    view.run(32);
    let { body } = bossParts(view.scene(), 'shukaku');
    const start = new THREE.Vector3();
    body!.getWorldPosition(start);
    view.run(SEAL_DONE_MS / 2);
    ({ body } = bossParts(view.scene(), 'shukaku'));
    const middle = new THREE.Vector3();
    body!.getWorldPosition(middle);
    expect(middle.y).toBeCloseTo(start.y, 5);
    expect((body!.material as THREE.MeshStandardMaterial).opacity).toBeLessThan(0.95);
    view.unmount();
  });

  it('marks a phase change with a hit-stop beat and one colour ramp, never a flash', async () => {
    const phaseOne = arena({ x: 17, y: 20 });
    const view = await mount(phaseOne);
    view.run(300);
    const materials = getBossFigureMaterials('shukaku');
    const base = materials.body.emissiveIntensity;
    const { tails } = bossParts(view.scene(), 'shukaku');
    const tailAt = () => {
      const matrix = new THREE.Matrix4();
      tails!.getMatrixAt(0, matrix);
      return matrix.elements.slice();
    };

    await view.rerender({ ...phaseOne, boss: { ...phaseOne.boss!, phase: 2 } });
    view.run(16);
    const heldTail = tailAt();
    const glow: number[] = [];
    for (let elapsed = 0; elapsed < 900; elapsed += 50) {
      view.run(50);
      glow.push(materials.body.emissiveIntensity);
      // The hit-stop beat: the tails hold still for its first 150 ms.
      if (elapsed < 100) expect(tailAt()).toEqual(heldTail);
    }
    expect(glow[0]).toBeCloseTo(base, 5);
    expect(glow[glow.length - 1]).toBeGreaterThan(base + 0.2);
    // One rise, never back down: a colour shift, not a flash.
    glow.slice(1).forEach((value, index) => {
      expect(value).toBeGreaterThanOrEqual(glow[index] - 1e-9);
    });
    expect(tailAt()).not.toEqual(heldTail);
    view.unmount();
  });

  it('cuts to a far boss, pushes in, and cuts back as the arena unfreezes', async () => {
    // The ninja stands far off in the fog; the boss appears at the centre.
    const fogged = arena({ x: 5, y: 25 }, 'kurama', {
      fogOfWar: {
        visible: [cellKey(5, 25)], explored: [], sensedEnemies: [], sensedWalls: [],
      },
    });
    let remaining = BOSS_INTRO_MS;
    const intro = { ...fogged, bossIntroMsRemaining: remaining };
    const live = () => ({ ...intro, bossIntroMsRemaining: remaining });
    const view = await mount(intro, { liveState: live });
    const [bossX] = toWorld(BOSS_AT.x, BOSS_AT.y);
    const [ninjaX] = toWorld(5, 25);
    const aimX = () => view.camera().position.x;
    const step = (ms: number) => {
      for (let done = 0; done < ms; done += 50) {
        remaining = Math.max(0, remaining - 50);
        view.run(50);
      }
    };
    view.run(16);
    // A cut, not a sweep across the board.
    expect(Math.abs(aimX() - bossX)).toBeLessThan(0.05);
    // Shown through the fog while it enters.
    expect(drawn(bossParts(view.scene(), 'kurama').body)).toBe(true);
    const arrived = view.camera().position.y;

    step(1300);
    expect(Math.abs(aimX() - bossX)).toBeLessThan(0.05);
    // Pushing in, closer than any play framing (13.2 high at the closest).
    expect(view.camera().position.y).toBeLessThan(arrived - 0.5);
    expect(view.camera().position.y).toBeLessThan(13.2 * 0.95);

    step(BOSS_INTRO_MS - 1300);
    await view.rerender({ ...fogged, bossIntroMsRemaining: 0 }, { liveState: live });
    view.run(16);
    // Straight back on the ninja as play resumes.
    expect(Math.abs(aimX() - ninjaX)).toBeLessThan(0.05);
    view.run(800);
    expect(view.camera().position.y).toBeGreaterThan(13.2 * 0.98);
    // Back in the fog once the arena is live.
    expect(drawn(bossParts(view.scene(), 'kurama').body)).toBe(false);
    view.unmount();
  });

  it('glides to a nearby boss and back', async () => {
    const near = arena({ x: 17, y: 19 }, 'isobu');
    let remaining = 0;
    const intro = { ...near, bossIntroMsRemaining: BOSS_INTRO_MS };
    const liveState = () => ({ ...intro, bossIntroMsRemaining: remaining });
    // Settled on the ninja before the arena opens.
    const view = await mount(near, { liveState });
    view.run(1500);
    const zOf = () => view.camera().position.z;
    const step = (ms: number) => {
      for (let done = 0; done < ms; done += 50) {
        remaining = Math.max(0, remaining - 50);
        view.run(50);
      }
    };
    remaining = BOSS_INTRO_MS;
    await view.rerender(intro, { liveState });
    const start = zOf();
    step(150);
    const early = zOf();
    step(1000);
    const onBoss = zOf();
    // It moves toward the boss (up the board) over several frames, not at once.
    expect(early).toBeLessThan(start);
    expect(onBoss).toBeLessThan(early - 0.3);
    view.unmount();
  });

  it('cuts to the boss and holds the framing under reduced motion', async () => {
    const fogged = arena({ x: 5, y: 25 }, 'kurama');
    let remaining = BOSS_INTRO_MS;
    const intro = { ...fogged, bossIntroMsRemaining: remaining };
    const preferences = { ...DEFAULT_GAME_PREFERENCES, reducedMotion: true };
    const liveState = () => ({ ...intro, bossIntroMsRemaining: remaining });
    const view = await mount(intro, { preferences, liveState });
    view.run(16);
    const [bossX] = toWorld(BOSS_AT.x, BOSS_AT.y);
    // No glide: already on the boss.
    expect(Math.abs(view.camera().position.x - bossX)).toBeLessThan(0.01);
    const height = view.camera().position.y;
    remaining -= 1000;
    view.run(1000);
    // No push-in either.
    expect(view.camera().position.y).toBeCloseTo(height, 5);
    view.unmount();
  });
});
