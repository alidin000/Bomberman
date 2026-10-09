// Stage, enemy and boss looks at scene level: what a stage changes around the
// grid and what it must never change (light count, playable cells, shadows),
// and that enemies and bosses read apart by shape.
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { BossState, GameEngineState, MonsterState } from '../../engine/types';
import { cellKey } from '../../engine/fogOfWar';
import { StageId } from '../../content/types';
import { toWorld } from './scene/sceneSpace';

// three.js takes the WebGL 2 path only for a context of this constructor name.
const FakeWebGL2 = function WebGL2RenderingContext() { return undefined; };

// jsdom has no WebGL. Every GL call is a no-op that reports success, so the
// real WebGLRenderer, r3f and the scene run end to end and the test can read
// the scene graph a frame was drawn from.
function createFakeWebGL2(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const ids = new Map<string, number>();
  const constant = (name: string) => {
    if (!ids.has(name)) ids.set(name, ids.size + 1);
    return ids.get(name) as number;
  };
  const getParameter = (parameter: number) => {
    if (parameter === constant('VERSION')) return 'WebGL 2.0';
    if (parameter === constant('SHADING_LANGUAGE_VERSION')) return 'WebGL GLSL ES 3.00';
    if (parameter === constant('VIEWPORT') || parameter === constant('SCISSOR_BOX')) {
      return new Int32Array([0, 0, canvas.width, canvas.height]);
    }
    return 16;
  };
  const counts = new Set([constant('ACTIVE_UNIFORMS'), constant('ACTIVE_ATTRIBUTES')]);
  const methods: Record<string, unknown> = {
    canvas,
    drawingBufferWidth: canvas.width,
    drawingBufferHeight: canvas.height,
    constructor: FakeWebGL2,
    getParameter,
    getSupportedExtensions: () => [],
    getContextAttributes: () => ({
      alpha: true, antialias: false, depth: true, stencil: false,
    }),
    getShaderPrecisionFormat: () => ({ precision: 23, rangeMin: 127, rangeMax: 127 }),
    getProgramParameter: (_: unknown, parameter: number) => (counts.has(parameter) ? 0 : true),
    getShaderParameter: () => true,
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getShaderSource: () => '',
    getError: () => 0,
    isContextLost: () => false,
    checkFramebufferStatus: () => constant('FRAMEBUFFER_COMPLETE'),
  };
  const context = new Proxy(Object.create(FakeWebGL2.prototype), {
    get(_, property) {
      if (typeof property !== 'string') return undefined;
      if (property in methods) return methods[property];
      if (/^[A-Z0-9_]+$/.test(property)) return constant(property);
      if (property === 'then') return undefined;
      return () => ({});
    },
  }) as WebGL2RenderingContext;
  // Extensions answer like the context: constants and no-op methods.
  methods.getExtension = () => context;
  return context;
}

const VIEW = { width: 1366, height: 768 };

// Reports the stubbed size at once, so r3f measures the canvas and mounts.
function ResizeObserverStub(callback: ResizeObserverCallback) {
  const observer = {
    observe: (target: Element) => {
      callback([{ target } as ResizeObserverEntry], observer as unknown as ResizeObserver);
    },
    unobserve: () => undefined,
    disconnect: () => undefined,
  };
  return observer;
}

beforeAll(() => {
  Object.assign(globalThis, { WebGL2RenderingContext: FakeWebGL2 });
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (this: HTMLCanvasElement, kind: string) => unknown;
  };
  proto.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    // No 2D canvas either: label sprites draw nothing, which they allow.
    return kind === 'webgl2' || kind === 'webgl' ? createFakeWebGL2(this) : null;
  };
  Element.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: VIEW.width,
    bottom: VIEW.height,
    ...VIEW,
    toJSON: () => ({}),
  });
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
});

function versusState(stageId: StageId): GameEngineState {
  return createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'naruto'],
    map: parseMapRows(defaultMap),
    stageId,
  });
}

async function renderScene(
  state: GameEngineState
): Promise<{
  scene: () => THREE.Scene;
  camera: () => THREE.Camera;
  frame: (ms: number) => void;
}> {
  const view = render(<GameScene3D state={state} preferences={DEFAULT_GAME_PREFERENCES} />);
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  // r3f mounts once its (debounced) size measurement lands.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  let time = 0;
  return {
    scene: () => {
      const root = _roots.get(canvas);
      if (!root) throw new Error('scene not mounted');
      return root.store.getState().scene;
    },
    camera: () => {
      const root = _roots.get(canvas);
      if (!root) throw new Error('scene not mounted');
      return root.store.getState().camera;
    },
    frame: (ms: number) => {
      time += ms;
      act(() => { advance(time); });
    },
  };
}

function lightSignature(scene: THREE.Scene) {
  const lights = {
    ambient: [] as string[], hemi: [] as string[], directional: [] as string[], point: 0,
  };
  scene.traverse((object) => {
    // Duck-typed: the scene's three.js may be a different module instance.
    const light = object as THREE.Light & Partial<THREE.HemisphereLight> & Record<string, unknown>;
    if (light.isAmbientLight) lights.ambient.push(light.color.getHexString());
    if (light.isHemisphereLight && light.groundColor) {
      lights.hemi.push(`${light.color.getHexString()}/${light.groundColor.getHexString()}`);
    }
    if (light.isDirectionalLight) {
      expect(light.castShadow).toBe(true);
      lights.directional.push(light.color.getHexString());
    }
    if (light.isPointLight) lights.point += 1;
  });
  return lights;
}

// The floor slab's footprint in world space (Floor draws width + 1.1).
function boardRect(state: GameEngineState) {
  const width = Math.max(...state.map.map((row) => row.length));
  const height = state.map.length;
  const [minX, , minZ] = toWorld(-0.55, -0.55);
  const [maxX, , maxZ] = toWorld(width - 0.45, height - 0.45);
  return {
    minX, maxX, minZ, maxZ, width, height,
  };
}

// Instanced meshes every instance of which stands outside the board.
function marginMeshes(scene: THREE.Scene, state: GameEngineState): THREE.InstancedMesh[] {
  const board = boardRect(state);
  const found: THREE.InstancedMesh[] = [];
  const matrix = new THREE.Matrix4();
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const mesh = object as THREE.InstancedMesh;
    if (!mesh.isInstancedMesh || mesh.count === 0) return;
    mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox as THREE.Box3;
    const outside = Array.from({ length: mesh.count }, (_, index) => {
      mesh.getMatrixAt(index, matrix);
      const box = local.clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
      return box.max.x < board.minX || box.min.x > board.maxX || box.max.z < board.minZ;
    });
    if (outside.every(Boolean)) found.push(mesh);
  });
  return found;
}

// Renders one scene per item, one after another (each needs its own mount).
async function inTurn<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  return items.reduce<Promise<R[]>>(
    async (done, item) => [...await done, await run(item)],
    Promise.resolve([])
  );
}

describe('GameScene3D stage looks', () => {
  it('lights each stage in its own colours on the same three scene lights', async () => {
    const stages: StageId[] = ['hiddenLeaf', 'akatsukiHideout'];
    const signatures = await inTurn(stages, async (stageId) => {
      const { scene, frame } = await renderScene(versusState(stageId));
      frame(16);
      const lights = lightSignature(scene());
      // Same light rig as before: one of each, plus the fixed point-light pool.
      expect([lights.ambient.length, lights.hemi.length, lights.directional.length, lights.point])
        .toEqual([1, 1, 1, 5]);
      return JSON.stringify(lights);
    });
    expect(signatures[0]).not.toBe(signatures[1]);
  });

  it('has its fog from the first frame and never fogs a playable cell', async () => {
    const state = versusState('hiddenMist');
    const { scene, camera, frame } = await renderScene(state);
    frame(16);
    const fog = scene().fog as THREE.Fog | null;
    // A linear Fog (not FogExp2), so later stages only move its two distances.
    expect((fog as { isFog?: boolean } | null)?.isFog).toBe(true);
    expect(fog?.near).toBeDefined();
    frame(16);
    frame(400);
    const board = boardRect(state);
    const view = camera();
    view.updateMatrixWorld(true);
    const depths: number[] = [];
    [board.minX, board.maxX].forEach((x) => [board.minZ, board.maxZ].forEach((z) => (
      [0, 2.5].forEach((y) => {
        depths.push(-new THREE.Vector3(x, y, z).applyMatrix4(view.matrixWorldInverse).z);
      })
    )));
    expect(Math.max(...depths)).toBeLessThan((fog as THREE.Fog).near);
    // ...yet it does fade the skyline a few cells past the far edge.
    const past = -new THREE.Vector3(0, 0, board.minZ - 8).applyMatrix4(view.matrixWorldInverse).z;
    expect(past).toBeGreaterThan((fog as THREE.Fog).near);
  });

  it('stands landmarks only on the far and side margins, without shadows', async () => {
    const state = versusState('hiddenSand');
    const { scene, frame } = await renderScene(state);
    frame(16);
    const landmarks = marginMeshes(scene(), state);
    expect(landmarks.length).toBeGreaterThan(0);
    expect(landmarks.length).toBeLessThanOrEqual(6);
    const board = boardRect(state);
    const matrix = new THREE.Matrix4();
    landmarks.forEach((mesh) => {
      expect(mesh.castShadow).toBe(false);
      for (let index = 0; index < mesh.count; index += 1) {
        mesh.getMatrixAt(index, matrix);
        const box = (mesh.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(matrix);
        // Nothing in front of the board's near edge, where it would cover the near rows.
        expect(box.max.z).toBeLessThan(board.maxZ);
      }
    });
  });
});

function allVisible(state: GameEngineState): GameEngineState {
  const visible = state.map.flatMap((row, y) => row.map((_, x) => cellKey(x, y)));
  return {
    ...state,
    fogOfWar: {
      visible, explored: visible, sensedEnemies: [], sensedWalls: [],
    },
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

const shapeOf = (mesh: THREE.Mesh) => (
  `${mesh.geometry.type}:${mesh.geometry.getAttribute('position').count}`
);
const FLOOR_MARKS = ['TorusGeometry', 'RingGeometry', 'CircleGeometry'];

describe('GameScene3D enemy and boss silhouettes', () => {
  it('draws enemies of one movement kind apart by archetype', async () => {
    const base = versusState('hiddenLeaf');
    const archetypes = ['anbu', 'cloudNinja', 'blackZetsu'] as const;
    const monsters: MonsterState[] = archetypes.map((archetype, index) => ({
      id: `fork-${archetype}`,
      name: archetype,
      x: 2 + index * 2,
      y: 3,
      kind: 'fork',
      moveCooldown: 99999,
      archetype,
    }));
    const state = allVisible({ ...base, monsters });
    const { scene, frame } = await renderScene(state);
    frame(16);
    frame(16);
    const silhouettes = monsters.map((monster) => (
      meshesUnder(entityGroup(scene(), monster.x, monster.y)).map(shapeOf).sort().join(',')
    ));
    expect(new Set(silhouettes).size).toBe(archetypes.length);
  });

  it('gives each boss its own base body, not one shared body', async () => {
    const bosses = ['shukaku', 'isobu', 'kurama'] as const;
    const bodies = await inTurn(bosses, async (id) => {
      const boss: BossState = {
        id,
        name: id,
        x: 4,
        y: 3,
        health: 10,
        maxHealth: 10,
        phase: 1,
        attackCooldown: 99999,
        moveCooldown: 99999,
        currentAbility: '',
        color: '#ffffff',
        tails: 9,
      };
      const state = allVisible({ ...versusState('hiddenLeaf'), monsters: [], boss });
      const { scene, frame } = await renderScene(state);
      frame(16);
      // The largest solid mesh of the boss, floor rings aside: its base body.
      const solids = meshesUnder(entityGroup(scene(), boss.x, boss.y))
        .filter((mesh) => !FLOOR_MARKS.includes(mesh.geometry.type));
      solids.forEach((mesh) => mesh.geometry.computeBoundingSphere());
      const body = solids.reduce((largest, mesh) => (
        (mesh.geometry.boundingSphere?.radius ?? 0) > (largest.geometry.boundingSphere?.radius ?? 0)
          ? mesh
          : largest
      ));
      return shapeOf(body);
    });
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});
