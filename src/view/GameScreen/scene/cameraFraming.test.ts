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
  hudZoom,
  maxFramingFor,
} from './cameraFraming';
import {
  HudDevice, NO_HUD_DEVICE, NO_SAFE_AREA, TouchSize, touchLayout,
} from '../../../input/touchLayout';

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
function frame(
  players: { x: number; y: number }[],
  view: [number, number],
  hudScale = 100,
  device: HudDevice = NO_HUD_DEVICE
) {
  const aspect = view[0] / view[1];
  const xs = players.map((p) => p.x);
  const ys = players.map((p) => p.y);
  const halfWidth = players.length > 1 ? (Math.max(...xs) - Math.min(...xs)) / 2 : 0;
  const halfDepth = players.length > 1 ? (Math.max(...ys) - Math.min(...ys)) / 2 : 0;
  const insets = hudInsets(hudScale, view[0], view[1], device);
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

  it('stays within 1% of the closest zoom when the compact HUD leaves room for the players', () => {
    // The cards' win-pip line costs two players at spawn 0.5% of zoom.
    const { scale } = frame([{ x: 1, y: 1 }, { x: 13, y: 8 }], LAPTOP_VIEW);
    expect(scale).toBeLessThan(MIN_FRAMING * 1.01);
    expect(framingScaleFor(6, 4, LAPTOP, LAPTOP_INSETS)).toBeLessThan(MIN_FRAMING * 1.01);
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

  it('keeps the desktop framing pinned to the measured HUD', () => {
    // [width, height, HUD %, halfWidth, halfDepth, scale, shift] for the HUD
    // with win pips and the viewport zoom. Against main 54df3d4 the cards
    // grew from 69 to 80 px and scale with the screen, so 1366x768 frames
    // the 18x12 spread 2.5% further out (1.2917) and 1920x1080 6.4% (1.2189).
    const pinned: [number, number, number, number, number, number, number][] = [
      [1366, 768, 100, 9, 6, 1.3242, -1.0746],
      [1366, 768, 125, 6, 4, 1.0906, -1.5621],
      [1366, 768, 125, 9, 6, 1.4417, -1.8357],
      [1920, 1080, 100, 9, 6, 1.2969, -0.8978],
      [2560, 1080, 100, 9, 6, 1.2971, -0.8994],
      [1280, 800, 80, 9, 6, 1.2535, -0.6167],
      [1366, 768, 100, 30, 30, 1.8, -22.2005],
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

// HUD rectangles measured in Chromium (k2work/hud.cjs) at 100% HUD with
// three players, best of 5 and two CPU slots (left, top, right, bottom in
// CSS px): the match bar, the top controls, the union of the P1-P3 cards,
// and on phones the one-line bottom strip (campaign objective or the
// sudden-death banner). Two-player cards sit inside the same union.
type Rect = [number, number, number, number];
type Cell = { x: number; y: number };
const MEASURED_HUD: Record<string, Rect[]> = {
  '390x844': [[12, 12, 76, 66], [114, 18, 372, 76], [12, 84, 378, 183], [12, 789, 378, 832]],
  '360x780': [[12, 12, 76, 66], [84, 18, 342, 76], [12, 84, 348, 183], [12, 725, 348, 768]],
  '844x390': [[194, 12, 554, 69], [568, 18, 826, 76], [12, 298, 832, 378]],
  '768x1024': [[118, 12, 478, 69], [492, 18, 750, 76], [12, 84, 756, 164]],
  '1366x768': [[503, 12, 863, 69], [1090, 18, 1348, 76], [12, 84, 1354, 164]],
  '1920x1080': [[707, 17, 1213, 95], [1644, 18, 1902, 76], [17, 110, 1903, 220]],
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

describe('HUD zoom', () => {
  it('grows the HUD with the screen from the 1366x768 reference, capped at 1.5x', () => {
    expect(hudZoom(100, 1366, 768)).toBe(1);
    expect(hudZoom(100, 1920, 1080)).toBeCloseTo(1920 / 1366, 4);
    expect(hudZoom(100, 3840, 2160)).toBe(1.5);
    // The tighter side decides, and small screens never shrink below 100%.
    expect(hudZoom(100, 2560, 1080)).toBeCloseTo(1080 / 768, 4);
    expect(hudZoom(100, 390, 844)).toBe(1);
    // The HUD Size setting multiplies it.
    expect(hudZoom(125, 1920, 1080)).toBeCloseTo(1.25 * (1920 / 1366), 4);
  });
});

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
    // [view, HUD %, band bottom (strip, controls or top cards), bottom band's
    // top (short: cards; phone: the one-line strip) or null]. Worst case of
    // two and three players, measured in Chromium (k2work/meas).
    const measured: [[number, number], number, number, number | null][] = [
      [[390, 844], 80, 162, 801], [[390, 844], 100, 183, 789], [[390, 844], 125, 266, 777],
      [[360, 780], 80, 162, 737], [[360, 780], 100, 183, 725], [[360, 780], 125, 266, 713],
      [[844, 390], 80, 76, 317], [[844, 390], 100, 76, 298], [[844, 390], 125, 86, 276],
      [[768, 1024], 80, 148, null], [[768, 1024], 100, 164, null], [[768, 1024], 125, 197, null],
      [[1366, 768], 80, 148, null], [[1366, 768], 100, 164, null], [[1366, 768], 125, 197, null],
      [[1920, 1080], 80, 177, null], [[1920, 1080], 100, 220, null], [[1920, 1080], 125, 276, null],
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

// The HUD with the touch controls up, measured in Chromium with touch
// emulation (p6work/meas.cjs) at 100% HUD: the match bar, the top controls,
// the union of the cards (three players, P2/P3 CPU, best of 5), the
// campaign's mission line, then the bomb, ultimate and pad ring as drawn at
// the medium size. Portrait phones keep the cards on top and lift the line
// onto the controls; short landscape screens stand the cards in the side
// columns (P1 and P3 left, P2 right) and the line under P1's card.
const MEASURED_TOUCH_HUD: Record<string, Rect[]> = {
  '390x844': [
    [12, 12, 76, 66], [156, 18, 372, 78], [12, 84, 378, 183], [12, 601, 378, 644],
    [278, 732, 374, 828], [194, 744, 266, 816], [24, 688, 156, 820],
  ],
  '360x780': [
    [12, 12, 76, 66], [126, 18, 342, 78], [12, 84, 348, 183], [12, 537, 348, 580],
    [248, 668, 344, 764], [164, 680, 236, 752], [24, 624, 156, 756],
  ],
  '844x390': [
    [194, 12, 554, 69], [610, 18, 826, 78], [12, 84, 218, 252], [626, 84, 832, 164],
    [12, 172, 218, 215], [724, 274, 820, 370], [640, 286, 712, 358], [24, 238, 156, 370],
  ],
  '932x430': [
    [282, 12, 642, 69], [698, 18, 914, 78], [12, 84, 260, 252], [672, 84, 920, 164],
    [12, 172, 218, 215], [812, 314, 908, 410], [728, 326, 800, 398], [24, 278, 156, 410],
  ],
  '768x1024': [
    [118, 12, 478, 69], [534, 18, 750, 78], [12, 84, 756, 164],
    [656, 912, 752, 1008], [572, 924, 644, 996], [24, 868, 156, 1000],
  ],
  '1024x768': [
    [332, 12, 692, 69], [790, 18, 1006, 78], [12, 84, 1012, 164],
    [904, 652, 1000, 748], [820, 664, 892, 736], [24, 616, 156, 748],
  ],
};

// Every control the layout can draw at `size`, detonate and cover included
// (they come and go with pickups), and the pad ring at rest, as squares.
function touchRects(view: [number, number], size: TouchSize, leftHanded = false): Rect[] {
  const layout = touchLayout(view[0], view[1], size, leftHanded);
  return [...Object.values(layout.buttons), {
    x: layout.pad.x, y: layout.pad.y, size: layout.pad.ring,
  }].map((circle) => [
    circle.x - circle.size / 2,
    circle.y - circle.size / 2,
    circle.x + circle.size / 2,
    circle.y + circle.size / 2,
  ]);
}

// Deep boxes as well: on a portrait phone a column of players is what
// reaches down into the bottom band.
const TOUCH_SPREADS: [string, Cell[]][] = [
  ...SPREADS,
  ['two players 8 deep', [{ x: 7, y: 1 }, { x: 7, y: 9 }]],
  ['two players escaping 12 deep', [{ x: 7, y: 1 }, { x: 8, y: 13 }]],
  ['three players in an L, 12x8', [{ x: 1, y: 1 }, { x: 1, y: 9 }, { x: 13, y: 9 }]],
];

describe('camera framing with the touch controls up', () => {
  const sizes: TouchSize[] = ['small', 'medium', 'large'];
  type TouchCase = [string, TouchSize, string, Cell[]];
  const cases = Object.keys(MEASURED_TOUCH_HUD).flatMap((name) => sizes.flatMap(
    (size) => TOUCH_SPREADS.map(([label, players]): TouchCase => [name, size, label, players])
  ));
  const title = 'at %s with %s controls keeps %s clear of them and the HUD';
  it.each(cases)(title, (name, size, _label, players) => {
    const view = name.split('x').map(Number) as [number, number];
    const device: HudDevice = { touch: size, safe: NO_SAFE_AREA };
    [false, true].forEach((leftHanded) => {
      const { camera } = frame(players, view, 100, device);
      const covered = [...MEASURED_TOUCH_HUD[name], ...touchRects(view, size, leftHanded)];
      players.forEach((cell) => {
        const box = spriteBox(camera, view, cell);
        expect(box[0]).toBeGreaterThanOrEqual(0);
        expect(box[1]).toBeGreaterThanOrEqual(0);
        expect(box[2]).toBeLessThanOrEqual(view[0]);
        expect(box[3]).toBeLessThanOrEqual(view[1]);
        covered.forEach((rect) => expect(overlaps(box, rect)).toBe(false));
      });
    });
  });

  // The same at 125% HUD, where the cards grow and wrap.
  const large: Record<string, Rect[]> = {
    '390x844': [
      [15, 15, 81, 83], [156, 18, 372, 78], [15, 98, 375, 266], [15, 589, 375, 641],
      [278, 732, 374, 828], [194, 744, 266, 816], [24, 688, 156, 820],
    ],
    '844x390': [
      [104, 15, 554, 86], [610, 18, 826, 78], [15, 98, 273, 306], [572, 98, 829, 197],
      [15, 208, 273, 260], [724, 274, 820, 370], [640, 286, 712, 358], [24, 238, 156, 370],
    ],
  };
  const largeCases = Object.keys(large).flatMap((name) => TOUCH_SPREADS.map(
    ([label, players]) => [name, label, players] as [string, string, Cell[]]
  ));
  const largeTitle = 'at %s with a 125 percent HUD keeps %s clear of the controls and the HUD';
  it.each(largeCases)(largeTitle, (name, _label, players) => {
    const view = name.split('x').map(Number) as [number, number];
    const { camera } = frame(players, view, 125, { touch: 'medium', safe: NO_SAFE_AREA });
    players.forEach((cell) => {
      const box = spriteBox(camera, view, cell);
      [...large[name], ...touchRects(view, 'medium')].forEach((rect) => {
        expect(overlaps(box, rect)).toBe(false);
      });
    });
  });

  it('draws the controls exactly where the camera keeps players out', () => {
    // The medium layout is what Chromium drew (MEASURED_TOUCH_HUD); a band
    // that ended above the controls would let a player under them.
    [[390, 844], [844, 390]].forEach(([width, height]) => {
      const measured = MEASURED_TOUCH_HUD[`${width}x${height}`].slice(-3);
      const drawn = touchRects([width, height], 'medium');
      [drawn[0], drawn[1], drawn[4]].forEach((rect, index) => {
        rect.forEach((edge, side) => expect(edge).toBeCloseTo(measured[index][side], 0));
      });
    });
  });

  it('gives a lone campaign player the band between the cards and the controls', () => {
    const view: [number, number] = [390, 844];
    const device: HudDevice = { touch: 'medium', safe: NO_SAFE_AREA };
    const insets = hudInsets(100, 390, 844, device);
    // Above the lifted mission line (601 px), below the cards (183 px).
    expect((1 - insets.bottom) * 844).toBeLessThanOrEqual(601);
    expect(insets.top * 844).toBeGreaterThanOrEqual(183);
    const { camera } = frame([{ x: 10, y: 10 }], view, 100, device);
    expect(toScreen(camera, 10, 0, 10).x).toBeCloseTo(0.5, 5);
    expect(pxPerCell(camera, view, { x: 10, y: 10 })).toBeGreaterThan(24);
  });

  it('adds the notch and the home indicator to the bands', () => {
    const safe = {
      top: 47, right: 0, bottom: 34, left: 0,
    };
    const plain = hudInsets(100, 390, 844, { touch: 'medium', safe: NO_SAFE_AREA });
    const notched = hudInsets(100, 390, 844, { touch: 'medium', safe });
    expect((notched.top - plain.top) * 844).toBeCloseTo(47, 3);
    expect((notched.bottom - plain.bottom) * 844).toBeCloseTo(34, 3);
    // Landscape: the notch side widens both side bands.
    const wide = hudInsets(100, 844, 390, {
      touch: 'medium',
      safe: {
        top: 0, right: 47, bottom: 21, left: 47,
      },
    });
    const flat = hudInsets(100, 844, 390, { touch: 'medium', safe: NO_SAFE_AREA });
    expect((wide.side - flat.side) * 844).toBeCloseTo(47, 3);
    // Without touch controls or a notch the bands are as measured before.
    expect(hudInsets(100, 390, 844, NO_HUD_DEVICE)).toEqual(hudInsets(100, 390, 844));
  });
});
