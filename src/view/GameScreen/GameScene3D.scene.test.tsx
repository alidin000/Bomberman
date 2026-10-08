import React from 'react';
import { act, render } from '@testing-library/react';
import { _roots, advance } from '@react-three/fiber';
import type * as THREE from 'three';
import { GameScene3D } from './GameScene3D';
import { DEFAULT_GAME_PREFERENCES } from './gamePreferences';
import { createInitialState } from '../../engine/initialState';
import { parseMapRows } from '../../engine/mapLoader';
import { defaultMap } from '../../constants/contants';
import { GameEngineState } from '../../engine/types';

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

function versusState(): GameEngineState {
  return createInitialState({
    numPlayers: 2,
    totalRounds: 1,
    selectedMap: 'map1',
    selectedCharacters: ['naruto', 'naruto'],
    map: parseMapRows(defaultMap),
  });
}

async function renderScene(
  state: GameEngineState
): Promise<{ scene: () => THREE.Scene; frame: (ms: number) => void }> {
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
    frame: (ms: number) => {
      time += ms;
      act(() => { advance(time); });
    },
  };
}

// The colour a fragment of instance `index` is shaded with, as the GPU sees
// it: a `vertexColors` material multiplies by the geometry's colour attribute,
// and a missing attribute reads WebGL's default vertex value (0, 0, 0, 1).
function shadedInstanceColor(mesh: THREE.InstancedMesh, index: number): number[] {
  const material = mesh.material as THREE.MeshBasicMaterial;
  const base = [material.color.r, material.color.g, material.color.b];
  const readsMissingColor = material.vertexColors && !mesh.geometry.getAttribute('color');
  const vertex = readsMissingColor ? [0, 0, 0] : [1, 1, 1];
  const instance = mesh.instanceColor
    ? [0, 1, 2].map((channel) => mesh.instanceColor!.array[index * 3 + channel])
    : [1, 1, 1];
  return base.map((value, channel) => value * vertex[channel] * instance[channel]);
}

describe('GameScene3D explosions', () => {
  it('draws live flames in their style colour, not black', async () => {
    const state = versusState();
    const burning: GameEngineState = {
      ...state,
      explosions: [
        {
          x: 2, y: 1, ticksRemaining: 400, kind: 'standard'
        },
        {
          x: 3, y: 1, ticksRemaining: 400, kind: 'standard'
        },
      ],
    };
    const { scene, frame } = await renderScene(burning);
    frame(16);
    frame(16);

    const flameLayers: THREE.InstancedMesh[] = [];
    scene().traverse((object) => {
      const mesh = object as THREE.InstancedMesh;
      if (mesh.isInstancedMesh && mesh.count === burning.explosions.length && mesh.instanceColor) {
        flameLayers.push(mesh);
      }
    });
    expect(flameLayers.length).toBeGreaterThan(0);
    flameLayers.forEach((mesh) => {
      const [r, g, b] = shadedInstanceColor(mesh, 0);
      expect(Math.max(r, g, b)).toBeGreaterThan(0.2);
    });
  });
});
