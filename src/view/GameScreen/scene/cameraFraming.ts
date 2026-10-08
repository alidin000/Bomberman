// Shared-screen framing. The camera hangs `scale` times (0, 13.2, 9.6) above
// and behind the point it looks at. The old rule zoomed out by a fixed cells-
// per-scale guess, which at 16:9 left the players' box filling under a third
// of the screen (two players at spawn: ~32 px per cell on a 1366x768 laptop).
// This fits the box the players actually span into the part of the screen
// the HUD leaves free, using the camera's real projection.

export const CAMERA_HEIGHT = 13.2;
export const CAMERA_BACK = 9.6;
export const CAMERA_FOV_DEG = 48;
export const MIN_FRAMING = 1;
export const MAX_FRAMING = 1.8;

const DISTANCE = Math.hypot(CAMERA_HEIGHT, CAMERA_BACK);
const DOWN = CAMERA_HEIGHT / DISTANCE;
const BACK = CAMERA_BACK / DISTANCE;
const TAN_HALF_FOV = Math.tan((CAMERA_FOV_DEG * Math.PI) / 360);

/**
 * Cells kept in view past the outermost players, so the next cell's danger
 * is on screen, and the height above its cell that must clear the HUD: a
 * character with its "P1" tag on top.
 */
export const FRAME_MARGIN = {
  side: 1.5, top: 1, bottom: 1.5, head: 1.75,
};

/**
 * The HUD-safe fit assumes the desktop HUD: cards in one row along the top.
 * Narrower (<= 1260 px, GameHUD.styles) or short screens stack the cards and
 * panels over the middle and bottom of the view, so they keep the legacy
 * framing instead.
 */
export function usesHudSafeFraming(width: number, height: number): boolean {
  return width > 1260 && height >= 600;
}

/** The original fixed rule, kept for compact HUD layouts. */
export function legacyFramingScale(spreadX: number, spreadY: number, aspect: number): number {
  const aspectPenalty = Math.max(1, 1.25 / aspect);
  const scale = Math.max(1, (spreadX + 3) / 9, (spreadY + 3) / 6) * aspectPenalty;
  return Math.min(MAX_FRAMING, Math.max(MIN_FRAMING, scale));
}

/** Screen fractions the players must stay out of: the HUD cards sit on top. */
export type ScreenInsets = { top: number; bottom: number; side: number };

/**
 * Bottom of the desktop HUD's card row in CSS px at 100% HUD scale: 153 px
 * measured at 1280-1920 px wide (GameHUD.styles: match bar, then one row of
 * compact cards), plus a little air. The HUD zoom scales it.
 */
export function hudInsets(hudScale: number, width: number, height: number): ScreenInsets {
  const cardsBottomPx = 162 * (hudScale / 100);
  return {
    top: Math.min(0.45, Math.max(0.18, cardsBottomPx / Math.max(height, 1))),
    bottom: 0.03,
    side: 0.03,
  };
}

/** Screen y (0 top, 1 bottom) of a point `dz` cells toward the camera, `h` up from the aim. */
export function screenY(scale: number, dz: number, h: number): number {
  const up = BACK * h - DOWN * dz;
  const depth = DISTANCE * scale - DOWN * h - BACK * dz;
  return 0.5 * (1 - up / (depth * TAN_HALF_FOV));
}

/** Screen x (0 left, 1 right) of a point `dx` cells right and `dz` toward the camera. */
export function screenX(scale: number, dx: number, dz: number, h: number, aspect: number): number {
  const depth = DISTANCE * scale - DOWN * h - BACK * dz;
  return 0.5 * (1 + dx / (depth * TAN_HALF_FOV * aspect));
}

/**
 * How far (cells, negative = up the map) to move the aim point off the box
 * centre so the box's top edge clears the HUD. Zero when it already does:
 * a lone player stays centred.
 */
export function groupShift(
  scale: number,
  halfWidth: number,
  halfDepth: number,
  insets: ScreenInsets
): number {
  const topDz = -halfDepth - FRAME_MARGIN.top;
  if (screenY(scale, topDz, FRAME_MARGIN.head) >= insets.top) return 0;
  // screenY grows with dz, so bisect the shift that puts the top edge on the inset.
  let low = -halfDepth - 12;
  let high = 0;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (screenY(scale, topDz - mid, FRAME_MARGIN.head) < insets.top) high = mid;
    else low = mid;
  }
  return low;
}

function groupFits(
  scale: number,
  halfWidth: number,
  halfDepth: number,
  aspect: number,
  insets: ScreenInsets
): boolean {
  const shift = groupShift(scale, halfWidth, halfDepth, insets);
  const topDz = -halfDepth - FRAME_MARGIN.top - shift;
  const bottomDz = halfDepth + FRAME_MARGIN.bottom - shift;
  const side = halfWidth + FRAME_MARGIN.side;
  // Rows nearer the camera spread wider, so the bottom corners bound the width.
  return screenY(scale, topDz, FRAME_MARGIN.head) >= insets.top - 1e-4
    && screenY(scale, bottomDz, 0) <= 1 - insets.bottom
    && screenX(scale, -side, bottomDz, 0, aspect) >= insets.side
    && screenX(scale, -side, topDz, FRAME_MARGIN.head, aspect) >= insets.side;
}

/**
 * The smallest camera scale in [MIN_FRAMING, MAX_FRAMING] that fits a box of
 * players `halfWidth` x `halfDepth` cells (from its centre) into the screen
 * outside the HUD insets. MAX_FRAMING when nothing in range fits.
 */
export function framingScaleFor(
  halfWidth: number,
  halfDepth: number,
  aspect: number,
  insets: ScreenInsets
): number {
  if (groupFits(MIN_FRAMING, halfWidth, halfDepth, aspect, insets)) return MIN_FRAMING;
  if (!groupFits(MAX_FRAMING, halfWidth, halfDepth, aspect, insets)) return MAX_FRAMING;
  let low = MIN_FRAMING;
  let high = MAX_FRAMING;
  for (let step = 0; step < 16; step += 1) {
    const mid = (low + high) / 2;
    if (groupFits(mid, halfWidth, halfDepth, aspect, insets)) high = mid;
    else low = mid;
  }
  return high;
}
