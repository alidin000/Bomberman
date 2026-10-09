// Test-only: lets the real WebGLRenderer, r3f and the scene run in jsdom.
// Same approach as GameScene3D.scene.test.tsx: every GL call is a no-op that
// reports success, so tests can read the scene graph a frame was drawn from.

// three.js takes the WebGL 2 path only for a context of this constructor name.
const FakeWebGL2 = function WebGL2RenderingContext() { return undefined; };

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

export const FAKE_VIEW = { width: 1366, height: 768 };

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

/** Call from beforeAll: WebGL 2, element size and ResizeObserver stubs. */
export function installFakeWebGL(): void {
  Object.assign(globalThis, { WebGL2RenderingContext: FakeWebGL2 });
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (this: HTMLCanvasElement, kind: string) => unknown;
  };
  proto.getContext = function getContext(this: HTMLCanvasElement, kind: string) {
    return kind === 'webgl2' || kind === 'webgl' ? createFakeWebGL2(this) : null;
  };
  Element.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: FAKE_VIEW.width,
    bottom: FAKE_VIEW.height,
    ...FAKE_VIEW,
    toJSON: () => ({}),
  });
  window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
