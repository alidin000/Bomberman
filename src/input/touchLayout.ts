// Where the touch controls sit, in CSS px inside the safe area (the overlay
// box is inset by env(safe-area-inset-*)). One source for the overlay and
// for the camera (scene/cameraFraming hudInsets), so players are framed
// clear of exactly what is drawn.
//
// Portrait: a band along the bottom edge, the pad bottom-left and the bomb
// cluster bottom-right. Landscape: the same two clusters in the bottom
// corners, which the camera treats as side columns. Sizes follow XAG 107 and
// Apple's HIG: the bomb is 96 px (about 15 mm on a phone) at the medium size,
// every target is 60 px or more, and targets keep 12 px or more apart.

export type TouchSize = 'small' | 'medium' | 'large';
export type TouchOrientation = 'portrait' | 'landscape';
export type TouchButtonId = 'bomb' | 'ultimate' | 'detonate' | 'cover';

/** Bomb button diameter per size preset. */
export const TOUCH_BOMB_PX: Record<TouchSize, number> = { small: 80, medium: 96, large: 112 };

// Everything at the medium size; the others scale it by bomb / 96.
const BOMB = 96;
const ULTIMATE = 72;
const SMALL = 64;
const RING = 132;
const KNOB = 56;
// Centre distances from the bomb (bomb/2 + button/2 + a 12 px gap), and the
// angle each sits at: ultimate to the inside, detonate above, cover between.
const ULTIMATE_REACH = 96;
const DETONATE_REACH = 92;
const COVER_REACH = 112;
const COVER_DIAGONAL = COVER_REACH * Math.SQRT1_2;
// Gap from the safe-area edges to the bomb and the pad ring.
const EDGE: Record<TouchOrientation, { x: number; y: number }> = {
  portrait: { x: 16, y: 16 },
  landscape: { x: 24, y: 20 },
};
const PAD_LIFT = 8;
// The pad's touch zone reaches a little past what is drawn.
const ZONE_REACH = 32;
// Space kept between the pad (ring and zone) and the bomb cluster.
const CLUSTER_GAP = 12;
// A narrow portrait phone draws the ring at rest smaller, down to this,
// rather than under the ultimate. The pad itself works the same at any size.
const MIN_RING = 80;

export function touchScale(size: TouchSize): number {
  return TOUCH_BOMB_PX[size] / BOMB;
}

export function touchOrientation(width: number, height: number): TouchOrientation {
  return width > height ? 'landscape' : 'portrait';
}

/**
 * Screen space the controls take, in CSS px from the safe-area edges, for
 * the camera's HUD bands. Portrait: a bottom band. Landscape: a column on
 * each side (the clusters sit in the bottom corners, and the players' band
 * runs down into them). Detonate and cover count even while hidden, so the
 * camera does not jump when a pickup brings them in.
 */
export type TouchBands = { bottom: number; side: number };

/**
 * How far up from the bottom safe edge the controls reach: the bomb
 * cluster's top (detonate's) or the pad ring's, whichever is higher.
 */
export function touchClusterHeight(size: TouchSize, orientation: TouchOrientation): number {
  const s = touchScale(size);
  const edge = EDGE[orientation];
  const lift = orientation === 'portrait' ? PAD_LIFT : 0;
  return Math.ceil(Math.max(
    edge.y + (BOMB / 2 + DETONATE_REACH + SMALL / 2) * s,
    edge.y + lift + RING * s
  ));
}

export function touchBands(size: TouchSize, orientation: TouchOrientation): TouchBands {
  if (orientation === 'portrait') {
    return { bottom: touchClusterHeight(size, orientation), side: 0 };
  }
  const s = touchScale(size);
  const edge = EDGE[orientation];
  // The cluster's inner edge is ultimate's.
  const clusterWidth = edge.x + (BOMB / 2 + ULTIMATE_REACH + ULTIMATE / 2) * s;
  const padWidth = edge.x + RING * s;
  return { bottom: 0, side: Math.ceil(Math.max(clusterWidth, padWidth)) };
}

/** The safe-area insets (env(safe-area-inset-*)), in CSS px. */
export type SafeArea = { top: number; right: number; bottom: number; left: number };
export const NO_SAFE_AREA: SafeArea = {
  top: 0, right: 0, bottom: 0, left: 0,
};

/**
 * What the screen adds to the HUD's bands: the touch controls at their size
 * preset (null while they are hidden) and the safe-area insets.
 */
export type HudDevice = { touch: TouchSize | null; safe: SafeArea };
export const NO_HUD_DEVICE: HudDevice = { touch: null, safe: NO_SAFE_AREA };

/** A round control: centre and diameter, in px inside the safe area. */
export type TouchCircle = { x: number; y: number; size: number };

export type TouchLayout = {
  orientation: TouchOrientation;
  /** Where a thumb may land to start the pad. */
  zone: { left: number; top: number; width: number; height: number };
  /** The pad at rest: centre, ring and knob diameters. */
  pad: { x: number; y: number; ring: number; knob: number };
  buttons: Record<TouchButtonId, TouchCircle>;
  bands: TouchBands;
};

/**
 * The controls for a `width` x `height` safe area. Left-handed mirrors the
 * whole layout: the pad on the right, the bomb cluster on the left.
 */
export function touchLayout(
  width: number,
  height: number,
  size: TouchSize,
  leftHanded = false
): TouchLayout {
  const orientation = touchOrientation(width, height);
  const s = touchScale(size);
  const edge = EDGE[orientation];
  const bands = touchBands(size, orientation);
  const bomb = BOMB * s;
  // From the cluster's inner edge (ultimate's) to the screen edge, plus a gap.
  const clusterInner = edge.x + (BOMB / 2 + ULTIMATE_REACH + ULTIMATE / 2) * s + CLUSTER_GAP;
  const lift = orientation === 'portrait' ? PAD_LIFT : 0;
  const padRoom = width - clusterInner - edge.x - lift;
  const ring = orientation === 'portrait'
    ? Math.max(MIN_RING, Math.min(RING * s, padRoom))
    : RING * s;
  // Laid out right-handed, then mirrored.
  const flip = (x: number) => (leftHanded ? width - x : x);
  const bombX = width - edge.x - bomb / 2;
  const bombY = height - edge.y - bomb / 2;
  const buttons: Record<TouchButtonId, TouchCircle> = {
    bomb: { x: flip(bombX), y: bombY, size: bomb },
    ultimate: { x: flip(bombX - ULTIMATE_REACH * s), y: bombY, size: ULTIMATE * s },
    detonate: { x: flip(bombX), y: bombY - DETONATE_REACH * s, size: SMALL * s },
    cover: {
      x: flip(bombX - COVER_DIAGONAL * s),
      y: bombY - COVER_DIAGONAL * s,
      size: SMALL * s,
    },
  };
  const padX = edge.x + lift + ring / 2;
  const padY = height - edge.y - lift - ring / 2;
  // The zone stops short of the bomb cluster's inner edge.
  const zoneWidth = orientation === 'portrait'
    ? Math.max(MIN_RING, Math.min(width / 2, width - clusterInner))
    : Math.min(width / 2, bands.side + ZONE_REACH * 2);
  const zoneTop = orientation === 'portrait'
    ? Math.max(0, height - bands.bottom - ZONE_REACH)
    : Math.round(height * 0.3);
  return {
    orientation,
    zone: {
      left: leftHanded ? width - zoneWidth : 0,
      top: zoneTop,
      width: zoneWidth,
      height: height - zoneTop,
    },
    pad: {
      x: flip(padX), y: padY, ring, knob: Math.min(KNOB * s, ring * (KNOB / RING)),
    },
    buttons,
    bands,
  };
}
