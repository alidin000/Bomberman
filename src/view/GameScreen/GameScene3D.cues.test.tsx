/* eslint-disable comma-dangle, no-param-reassign */
import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES, GamePreferences } from './gamePreferences';
import { playerSlotColor } from './playerSlots';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { BossHazard, GameConfig, GameEngineState } from '../../engine/types';
import { CharacterId } from '../../content/types';
import { MotionStore, createMotionStore } from '../../hooks/motionStore';
import { toWorld } from './scene/sceneSpace';
import {
  CUE_DURATION_MS, CueStore, PICKUP_CUE_MS, recordBodyCue
} from '../../hooks/cueStore';

// three.js takes the WebGL 2 path only for a context of this constructor name.
const FakeWebGL2 = function WebGL2RenderingContext() { return undefined; };

// jsdom has no WebGL: every GL call is a no-op that reports success, so the
// real renderer and scene run end to end (as in GameScene3D.scene.test).
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
  methods.getExtension = () => context;
  return context;
}

type DrawnCanvas = HTMLCanvasElement & { drawnText?: string[] };

// A 2D context that draws nothing but remembers the text put on its canvas,
// so a test can read what a label sprite says.
function createRecording2D(canvas: DrawnCanvas): CanvasRenderingContext2D {
  canvas.drawnText = [];
  const state: Record<string | symbol, unknown> = {};
  return new Proxy(state, {
    get(target, property) {
      if (property === 'fillText') {
        return (text: string) => { canvas.drawnText?.push(text); };
      }
      if (property === 'measureText') return (text: string) => ({ width: text.length * 20 });
      if (property in target) return target[property];
      return () => undefined;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

const VIEW = { width: 1366, height: 768 };

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
    if (kind === '2d') return createRecording2D(this);
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

function versusState(characters: CharacterId[], extra: Partial<GameConfig> = {}): GameEngineState {
  return createInitialState({
    mode: 'local',
    numPlayers: characters.length,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: characters,
    map: parseMapRows(defaultMap),
    ...extra,
  });
}

async function renderScene(
  state: GameEngineState,
  motion: MotionStore | null = null,
  preferences: GamePreferences = DEFAULT_GAME_PREFERENCES,
) {
  const view = render(<GameScene3D state={state} preferences={preferences} motion={motion} />);
  const canvas = view.container.querySelector('canvas') as HTMLCanvasElement;
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 120); }); });
  let time = 0;
  const scene = () => {
    const root = _roots.get(canvas);
    if (!root) throw new Error('scene not mounted');
    return root.store.getState().scene;
  };
  return {
    scene,
    frame: (ms = 16) => {
      time += ms;
      act(() => { advance(time); });
    },
    find: <T extends THREE.Object3D>(test: (object: THREE.Object3D) => boolean): T[] => {
      const found: T[] = [];
      scene().traverse((object) => { if (test(object)) found.push(object as T); });
      return found;
    },
    unmount: () => view.unmount(),
  };
}

function drawnText(sprite: THREE.Sprite): string[] {
  const image = sprite.material.map?.image as DrawnCanvas | undefined;
  return image?.drawnText ?? [];
}

function isFloorRing(object: THREE.Object3D): boolean {
  const geometry = (object as THREE.Mesh).geometry as THREE.TorusGeometry | undefined;
  return geometry?.type === 'TorusGeometry'
    && geometry.parameters.radius === 0.42
    && geometry.parameters.tube === 0.022;
}

function hue(color: THREE.Color): number {
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  return hsl.h * 360;
}

function cuesOf(motion: MotionStore): CueStore {
  return motion.cues as CueStore;
}

describe('player identity in Local Arena', () => {
  it('rings each fighter in its slot colour, so Deidara vs Naruto is not two oranges', async () => {
    const view = await renderScene(versusState(['deidara', 'naruto']));
    view.frame();
    const rings = view.find<THREE.Mesh>(isFloorRing)
      .map((ring) => (ring.material as THREE.MeshStandardMaterial).color);
    expect(rings).toHaveLength(2);
    expect(`#${rings[0].getHexString()}`).toBe(playerSlotColor(0).toLowerCase());
    expect(`#${rings[1].getHexString()}`).toBe(playerSlotColor(1).toLowerCase());
    const gap = Math.abs(hue(rings[0]) - hue(rings[1]));
    expect(Math.min(gap, 360 - gap)).toBeGreaterThan(60);
    view.unmount();
  });

  it('labels a CPU slot "P2 · CPU" over its head and a human "P1"', async () => {
    const view = await renderScene(versusState(['deidara', 'naruto'], {
      controllers: ['human', 'cpu-normal'],
    }));
    view.frame();
    const tags = view.find<THREE.Sprite>((object) => (
      (object as THREE.Sprite).isSprite && object.renderOrder === 10
    )).map(drawnText);
    expect(tags).toEqual([['P1'], ['P2 · CPU']]);
    view.unmount();
  });
});

describe('player cues in the scene', () => {
  it('keeps a fallen fighter for its death pose, then hides it and marks the cell', async () => {
    const state = versusState(['sasuke', 'naruto']);
    const dead: GameEngineState = {
      ...state,
      players: state.players.map((player, index) => (
        index === 1 ? { ...player, alive: false } : player
      )),
    };
    const motion = createMotionStore();
    recordBodyCue(cuesOf(motion), 'player2', 'death', 0);
    const view = await renderScene(dead, motion);
    // The ring sits in the body group that the pose hides.
    const body = () => view.find((object) => object.userData.playerRing === 'player2')[0]?.parent;
    const opaque = () => {
      const materials: THREE.Material[] = [];
      body()!.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.Material | undefined;
        if (material && !material.transparent) materials.push(material);
      });
      return materials;
    };
    cuesOf(motion).clockMs = 120;
    view.frame();
    expect(body()).toBeDefined();
    expect(body()!.visible).toBe(true);
    const solid = opaque();
    expect(solid.length).toBeGreaterThan(5);
    const [marker] = view.find<THREE.Sprite>((object) => object.userData.koMarker === 'player2');
    expect(drawnText(marker)).toEqual(['P2 KO']);
    const [wx, , wz] = toWorld(Math.round(dead.players[1].x), Math.round(dead.players[1].y));
    expect([marker.position.x, marker.position.z]).toEqual([wx, wz]);

    cuesOf(motion).clockMs = CUE_DURATION_MS.death + 20;
    view.frame();
    expect(body()!.visible).toBe(false);
    // Hidden, not faded: the same materials are still opaque.
    expect(opaque()).toEqual(solid);
    expect(view.find((object) => object.userData.koMarker === 'player2')).toHaveLength(1);
    view.unmount();
  });

  it('raises a "+Bomb" label from the ninja who took it, then drops it', async () => {
    const state = versusState(['sasuke', 'naruto']);
    const motion = createMotionStore();
    const cues = cuesOf(motion);
    cues.pickups.set('player1', { power: 'AddBomb', startMs: 0, seq: 1 });
    const view = await renderScene(state, motion);
    const label = () => view.find<THREE.Sprite>((object) => object.userData.pickupLabel === 'player1')[0];
    cues.clockMs = 40;
    view.frame();
    expect(label().visible).toBe(true);
    expect(drawnText(label())).toEqual(['+Bomb']);
    const low = label().position.y;
    cues.clockMs = 400;
    view.frame();
    expect(label().position.y).toBeGreaterThan(low);
    cues.clockMs = PICKUP_CUE_MS + 10;
    view.frame();
    expect(label().visible).toBe(false);
    // The other ninja shows nothing.
    expect(view.find<THREE.Sprite>((object) => object.userData.pickupLabel === 'player2')[0].visible)
      .toBe(false);
    view.unmount();
  });
});

describe('hazard telegraphs in the scene', () => {
  function bossHazard(extra: Partial<BossHazard>): BossHazard {
    return {
      id: `hazard-${extra.x}-${extra.y}`,
      kind: 'lavaBurst',
      x: 3,
      y: 3,
      ticksRemaining: 2400,
      warningTicks: 1680,
      color: '#ef4444',
      damage: 1,
      ...extra,
    };
  }

  it('draws each family\'s floor shape: outlines while warned, fills once lethal', async () => {
    const state = versusState(['sasuke', 'naruto']);
    const hazards: BossHazard[] = [
      // Warning: lava (ring), shockwave (cross).
      bossHazard({ kind: 'lavaBurst', x: 3, y: 3 }),
      bossHazard({ kind: 'chakraShockwave', x: 5, y: 3 }),
      // Lethal now: a three-cell water cannon lane (line), an air strike (diamond).
      ...[2, 3, 4].map((x) => bossHazard({
        kind: 'waterCannon', x, y: 5, ticksRemaining: 600
      })),
      bossHazard({
        kind: 'airStrike', x: 7, y: 7, ticksRemaining: 300
      }),
    ];
    const view = await renderScene({ ...state, hazards });
    view.frame();
    const layers = new Map<string, number>();
    view.find<THREE.InstancedMesh>((object) => !!object.userData.telegraph).forEach((mesh) => {
      layers.set(`${mesh.userData.telegraph}:${mesh.userData.layer}`, mesh.count);
    });
    expect(Object.fromEntries(layers)).toEqual({
      'line:edge': 3,
      'line:fill': 3,
      'cross:edge': 1,
      'cross:fill': 0,
      'ring:edge': 1,
      'ring:fill': 0,
      'diamond:edge': 1,
      'diamond:fill': 1,
    });
    view.unmount();
  });
});
