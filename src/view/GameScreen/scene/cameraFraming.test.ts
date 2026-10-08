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
  hudLayout,
  maxFramingFor,
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
  const maxFraming = maxFramingFor(aspect, insets);
  const scale = framingScaleFor(halfWidth, halfDepth, aspect, insets, maxFraming);
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

  it('keeps the desktop framing exactly as it was', () => {
    // [width, height, HUD %, halfWidth, halfDepth, scale, shift] from e28e51c.
    const pinned: [number, number, number, number, number, number, number][] = [
      [1366, 768, 100, 9, 6, 1.2917, -0.8644],
      [1366, 768, 125, 6, 4, 1.0825, -1.5095],
      [1366, 768, 125, 9, 6, 1.4306, -1.7637],
      [1920, 1080, 100, 9, 6, 1.2189, -0.3927],
      [2560, 1080, 100, 9, 6, 1.2189, -0.3927],
      [1280, 800, 80, 9, 6, 1.2397, -0.2417],
      [1366, 768, 100, 30, 30, 1.8, -21.6159],
    ];
    pinned.forEach(([width, height, hud, halfWidth, halfDepth, scale, shift]) => {
      const insets = hudInsets(hud, width, height);
      const maxFraming = maxFramingFor(width / height, insets);
      expect(maxFraming).toBe(MAX_FRAMING);
      const framing = framingScaleFor(halfWidth, halfDepth, width / height, insets, maxFraming);
      expect(framing).toBeCloseTo(scale, 3);
      expect(groupShift(framing, halfWidth, halfDepth, insets)).toBeCloseTo(shift, 3);
    });
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

// HUD rectangles measured in Chromium on e28e51c at 100% HUD with three
// players (left, top, right, bottom in CSS px): the match strip, the top
// controls, and the union of the P1-P3 cards. Two-player cards sit inside
// the same union.
type Rect = [number, number, number, number];
type Cell = { x: number; y: number };
const MEASURED_HUD: Record<string, Rect[]> = {
  '390x844': [[12, 12, 88, 66], [114, 18, 372, 76], [12, 84, 378, 183]],
  '360x780': [[12, 12, 58, 66], [84, 18, 342, 76], [12, 84, 348, 183]],
  '844x390': [[194, 12, 554, 66], [568, 18, 826, 76], [12, 309, 646, 378]],
  '768x1024': [[118, 12, 478, 66], [492, 18, 750, 76], [12, 84, 646, 153]],
  '1024x768': [[332, 12, 692, 66], [748, 18, 1006, 76], [12, 84, 772, 153]],
  '1100x700': [[370, 12, 730, 66], [824, 18, 1082, 76], [12, 84, 772, 153]],
  '1366x768': [[503, 12, 863, 66], [1090, 18, 1348, 76], [12, 84, 772, 153]],
};

const SPREADS: [string, Cell[]][] = [
  ['two players at spawn', [{ x: 1, y: 1 }, { x: 13, y: 8 }]],
  ['three players at spawn', [{ x: 1, y: 1 }, { x: 13, y: 8 }, { x: 1, y: 8 }]],
  ['three players 12x8 apart', [{ x: 1, y: 1 }, { x: 13, y: 9 }, { x: 1, y: 9 }]],
  ['two players escaping 18x12 apart', [{ x: 1, y: 1 }, { x: 19, y: 13 }]],
  ['three players escaping 18x12 apart', [{ x: 1, y: 1 }, { x: 19, y: 13 }, { x: 1, y: 13 }]],
];

// A character's on-screen box in CSS px: its cell's width, from its "P1" tag
// (1.75 up) down to the front edge of its cell.
function spriteBox(camera: THREE.Camera, view: [number, number], cell: Cell): Rect {
  const points = [
    toScreen(camera, cell.x - 0.5, FRAME_MARGIN.head, cell.y),
    toScreen(camera, cell.x + 0.5, FRAME_MARGIN.head, cell.y),
    toScreen(camera, cell.x - 0.5, 0, cell.y + 0.5),
    toScreen(camera, cell.x + 0.5, 0, cell.y + 0.5),
  ];
  return [
    Math.min(...points.map((p) => p.x)) * view[0],
    Math.min(...points.map((p) => p.y)) * view[1],
    Math.max(...points.map((p) => p.x)) * view[0],
    Math.max(...points.map((p) => p.y)) * view[1],
  ];
}

function pxPerCell(camera: THREE.Camera, view: [number, number], cell: Cell): number {
  const left = toScreen(camera, cell.x - 0.5, 0, cell.y).x;
  return (toScreen(camera, cell.x + 0.5, 0, cell.y).x - left) * view[0];
}

const overlaps = (a: Rect, b: Rect) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

describe('camera framing on compact layouts', () => {
  const cases = Object.keys(MEASURED_HUD).flatMap((name) => SPREADS.map(
    ([label, players]) => [name, label, players] as [string, string, Cell[]]
  ));
  it.each(cases)('at %s keeps %s on screen and clear of the measured HUD', (name, _label, players) => {
    const view = name.split('x').map(Number) as [number, number];
    const { camera } = frame(players, view);
    players.forEach((cell) => {
      const box = spriteBox(camera, view, cell);
      expect(box[0]).toBeGreaterThanOrEqual(0);
      expect(box[1]).toBeGreaterThanOrEqual(0);
      expect(box[2]).toBeLessThanOrEqual(view[0]);
      expect(box[3]).toBeLessThanOrEqual(view[1]);
      MEASURED_HUD[name].forEach((rect) => expect(overlaps(box, rect)).toBe(false));
    });
  });

  it('puts every inset band over the HUD it stands for at 80-125% HUD', () => {
    // [view, HUD %, band bottom (strip, controls or top cards), bottom cards' top or null].
    const measured: [[number, number], number, number, number | null][] = [
      [[390, 844], 80, 162, null], [[390, 844], 100, 183, null], [[390, 844], 125, 218, null],
      [[360, 780], 100, 183, null],
      [[844, 390], 80, 76, 326], [[844, 390], 100, 76, 309], [[844, 390], 125, 83, 290],
      [[1366, 768], 100, 153, null], [[1366, 768], 125, 183, null],
      [[1024, 768], 100, 153, null], [[1024, 768], 125, 183, null], [[1100, 700], 100, 153, null],
    ];
    measured.forEach(([[width, height], hud, topBandPx, cardsTopPx]) => {
      const insets = hudInsets(hud, width, height);
      expect(insets.top * height).toBeGreaterThanOrEqual(topBandPx);
      if (cardsTopPx !== null) expect((1 - insets.bottom) * height).toBeLessThanOrEqual(cardsTopPx);
    });
    // GameHUD.styles breakpoints: max-width 640px; max-height 560px with min-width 641px.
    expect([hudLayout(640, 900), hudLayout(641, 560), hudLayout(641, 561), hudLayout(1366, 768)])
      .toEqual(['phone', 'short', 'row', 'row']);
  });

  it('zooms a portrait phone out only as far as the players need', () => {
    const view: [number, number] = [390, 844];
    const aspect = view[0] / view[1];
    const spawn = [{ x: 1, y: 1 }, { x: 13, y: 8 }];
    const escape = [{ x: 1, y: 1 }, { x: 19, y: 13 }];
    const atSpawn = frame(spawn, view);
    const escaping = frame(escape, view);
    // Before: the 1.8 cap, which drew P2 at spawn past the right edge.
    expect(atSpawn.scale).toBeGreaterThan(MAX_FRAMING);
    const smallest = (cells: Cell[], camera: THREE.Camera) => Math.min(
      ...cells.map((cell) => pxPerCell(camera, view, cell))
    );
    expect(smallest(spawn, atSpawn.camera)).toBeGreaterThan(21);
    expect(smallest(escape, escaping.camera)).toBeGreaterThan(15);
    // 3% closer and P2's side margin is cut off: the zoom is as close as fits.
    const nearer = atSpawn.scale * 0.97;
    const closer = cameraFor(nearer, 7, 4.5 + groupShift(nearer, 6, 3.5, atSpawn.insets), aspect);
    const margin = toScreen(closer, 13 + FRAME_MARGIN.side, 0, 8 + FRAME_MARGIN.bottom);
    expect(margin.x).toBeGreaterThan(1 - atSpawn.insets.side);
  });

  it('fits short landscape screens between the top strip and the bottom cards', () => {
    const view: [number, number] = [844, 390];
    const players = [{ x: 1, y: 1 }, { x: 13, y: 8 }];
    const { scale, insets, camera } = frame(players, view);
    // The group is lifted off the bottom cards and fills the gap: its margin
    // edges sit on both bands (the old rule drew it at 15-17 px a cell).
    expect(groupShift(scale, 6, 3.5, insets)).toBeGreaterThan(0);
    const top = toScreen(camera, 1, FRAME_MARGIN.head, 1 - FRAME_MARGIN.top).y;
    const bottom = toScreen(camera, 13, 0, 8 + FRAME_MARGIN.bottom).y;
    expect(top).toBeCloseTo(insets.top, 2);
    expect(bottom).toBeCloseTo(1 - insets.bottom, 2);
    expect(Math.min(...players.map((cell) => pxPerCell(camera, view, cell)))).toBeGreaterThan(20);
  });

  it('keeps a lone player centred with 5.5 cells in view either side on a phone', () => {
    [[390, 844], [360, 780], [768, 1024], [844, 390]].forEach(([width, height]) => {
      const view: [number, number] = [width, height];
      const { camera, insets, scale } = frame([{ x: 10, y: 10 }], view);
      expect(groupShift(scale, 0, 0, insets)).toBe(0);
      expect(toScreen(camera, 10, 0, 10).x).toBeCloseTo(0.5, 5);
      const leftEdge = toScreen(camera, 10 - 5.5, 0, 10 + FRAME_MARGIN.bottom);
      expect(leftEdge.x).toBeGreaterThanOrEqual(insets.side - 0.002);
    });
  });
});
