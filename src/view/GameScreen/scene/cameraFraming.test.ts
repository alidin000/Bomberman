import * as THREE from 'three';
import {
  CAMERA_BACK,
  CAMERA_FOV_DEG,
  CAMERA_HEIGHT,
  FRAME_MARGIN,
  MAX_FRAMING,
  MIN_FRAMING,
  framingScaleFor,
  groupShift,
  hudInsets,
  legacyFramingScale,
  usesHudSafeFraming,
} from './cameraFraming';

// Place a real three.js camera the way CameraRig does and project world
// points, so the framing maths is checked against the renderer's projection.
function cameraFor(scale: number, aimX: number, aimZ: number, aspect: number) {
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, aspect, 0.1, 1000);
  camera.position.set(aimX, CAMERA_HEIGHT * scale, aimZ + CAMERA_BACK * scale);
  camera.lookAt(aimX, 0, aimZ);
  camera.updateMatrixWorld();
  return camera;
}

function toScreen(camera: THREE.Camera, x: number, h: number, z: number) {
  const ndc = new THREE.Vector3(x, h, z).project(camera);
  return { x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 };
}

// Players' cells in world units (1 cell = 1 unit); returns where the camera
// aims and how far it zooms, exactly as CameraRig derives them.
function frame(players: { x: number; y: number }[], view: [number, number], hudScale = 100) {
  const aspect = view[0] / view[1];
  const xs = players.map((p) => p.x);
  const ys = players.map((p) => p.y);
  const halfWidth = players.length > 1 ? (Math.max(...xs) - Math.min(...xs)) / 2 : 0;
  const halfDepth = players.length > 1 ? (Math.max(...ys) - Math.min(...ys)) / 2 : 0;
  const insets = hudInsets(hudScale, view[0], view[1]);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets);
  const shift = groupShift(scale, halfWidth, halfDepth, insets);
  const aimX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const aimZ = (Math.max(...ys) + Math.min(...ys)) / 2 + shift;
  return {
    scale, insets, camera: cameraFor(scale, aimX, aimZ, aspect), xs, ys,
  };
}

const LAPTOP_VIEW: [number, number] = [1366, 768];
const LAPTOP = 1366 / 768;
const LAPTOP_INSETS = hudInsets(100, 1366, 768);

describe('shared-screen camera framing', () => {
  const views: [string, [number, number]][] = [
    ['1366x768', [1366, 768]],
    ['1920x1080', [1920, 1080]],
    ['1280x800', [1280, 800]],
    ['2560x1080 ultrawide', [2560, 1080]],
  ];
  it.each(views)('keeps the widest spread (12x8 cells) and margins clear of the HUD at %s', (_, view) => {
    const players = [{ x: 1, y: 1 }, { x: 13, y: 9 }, { x: 1, y: 9 }];
    const {
      camera, insets, xs, ys,
    } = frame(players, view);
    const left = Math.min(...xs) - FRAME_MARGIN.side;
    const right = Math.max(...xs) + FRAME_MARGIN.side;
    const top = Math.min(...ys) - FRAME_MARGIN.top;
    const bottom = Math.max(...ys) + FRAME_MARGIN.bottom;
    [
      toScreen(camera, left, FRAME_MARGIN.head, top),
      toScreen(camera, right, FRAME_MARGIN.head, top),
      toScreen(camera, left, 0, bottom),
      toScreen(camera, right, 0, bottom),
    ].forEach((point) => {
      expect(point.y).toBeGreaterThanOrEqual(insets.top - 0.002);
      expect(point.y).toBeLessThanOrEqual(1 - insets.bottom + 0.002);
      expect(point.x).toBeGreaterThanOrEqual(insets.side - 0.002);
      expect(point.x).toBeLessThanOrEqual(1 - insets.side + 0.002);
    });
  });

  it('uses the closest zoom when the compact HUD leaves room for the players', () => {
    const { scale } = frame([{ x: 1, y: 1 }, { x: 13, y: 8 }], LAPTOP_VIEW);
    expect(scale).toBe(MIN_FRAMING);
    expect(framingScaleFor(6, 4, LAPTOP, LAPTOP_INSETS)).toBe(MIN_FRAMING);
  });

  it('zooms in as far as the HUD-safe area allows, not further', () => {
    // At 125% HUD the widest spread (12 x 8 cells) is bound by the cards.
    const insets = hudInsets(125, 1366, 768);
    const scale = framingScaleFor(6, 4, LAPTOP, insets);
    expect(scale).toBeGreaterThan(MIN_FRAMING);
    // A slightly closer camera no longer fits the same players.
    const nearer = scale * 0.95;
    const closer = cameraFor(nearer, 7, 5 + groupShift(nearer, 6, 4, insets), LAPTOP);
    const left = 1 - FRAME_MARGIN.side;
    const topEdge = toScreen(closer, left, FRAME_MARGIN.head, 1 - FRAME_MARGIN.top);
    const bottomEdge = toScreen(closer, left, 0, 9 + FRAME_MARGIN.bottom);
    expect(topEdge.y < insets.top - 0.002 || bottomEdge.y > 1 - insets.bottom + 0.002).toBe(true);
  });

  it('draws two players at their spawns at least 1.4x larger than the old fixed framing', () => {
    // Old rule: max(1, (spread + 3) / 9, (spread + 3) / 6) for 12 x 7 cells.
    const oldScale = Math.max(1, (12 + 3) / 9, (7 + 3) / 6);
    const { scale } = frame([{ x: 1, y: 1 }, { x: 13, y: 8 }], LAPTOP_VIEW);
    expect(oldScale / scale).toBeGreaterThan(1.4);
  });

  it('uses the HUD-safe fit only for the desktop HUD row; compact layouts keep the old zoom', () => {
    expect(usesHudSafeFraming(1366, 768)).toBe(true);
    expect(usesHudSafeFraming(1920, 1080)).toBe(true);
    // <= 1260 px wide the cards drop to mid-screen; short screens stack panels.
    expect(usesHudSafeFraming(1260, 800)).toBe(false);
    expect(usesHudSafeFraming(844, 390)).toBe(false);
    expect(usesHudSafeFraming(390, 844)).toBe(false);
    expect(legacyFramingScale(12, 7, 1024 / 768)).toBeCloseTo((12 + 3) / 9, 5);
    expect(legacyFramingScale(0, 0, 390 / 844)).toBe(MAX_FRAMING);
  });

  it('leaves a lone player centred at the closest zoom', () => {
    const { scale } = frame([{ x: 5, y: 5 }], LAPTOP_VIEW);
    expect(scale).toBe(MIN_FRAMING);
    expect(groupShift(MIN_FRAMING, 0, 0, LAPTOP_INSETS)).toBe(0);
  });

  it('gives a larger HUD more room and caps the zoom-out', () => {
    const normal = framingScaleFor(6, 4, LAPTOP, LAPTOP_INSETS);
    expect(framingScaleFor(6, 4, LAPTOP, hudInsets(125, 1366, 768))).toBeGreaterThan(normal);
    expect(framingScaleFor(30, 30, LAPTOP, LAPTOP_INSETS)).toBe(MAX_FRAMING);
  });
});
