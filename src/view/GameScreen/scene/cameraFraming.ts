// Shared-screen framing. The camera hangs `scale` times (0, 13.2, 9.6) above
// and behind the point it looks at. The old rule zoomed out by a fixed cells-
// per-scale guess, which at 16:9 left the players' box filling under a third
// of the screen (two players at spawn: ~32 px per cell on a 1366x768 laptop).
// This fits the box the players actually span into the part of the screen
// the HUD leaves free, using the camera's real projection. Every HUD layout
// uses it: compact screens (<= 1260 px wide or under 600 px tall) used to
// keep the old rule, which on a 390x844 phone framed two players at spawn
// off both side edges.

import {
  SHARED_SCREEN_ESCAPE_SCALE,
  SHARED_SCREEN_MAX_DELTA_X,
  SHARED_SCREEN_MAX_DELTA_Y,
} from '../../../engine/players';
import {
  HudDevice, NO_HUD_DEVICE, touchBands, touchOrientation,
} from '../../../input/touchLayout';

export const CAMERA_HEIGHT = 13.2;
export const CAMERA_BACK = 9.6;
export const CAMERA_FOV_DEG = 48;
export const MIN_FRAMING = 1;
/** Zoom-out cap wherever the widest spread fits inside it (desktops, landscape). */
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
 * Hard cap for narrow screens (maxFramingFor). Phones need up to 3.7 for the
 * widest spread; this only binds below a 0.41 aspect (narrower than 9:22).
 */
export const FAR_FRAMING = 4;

/**
 * Half the widest spread the engine allows: players.ts keeps players within
 * 12x8 cells, stretched 1.5x while one is escaping danger (18x12).
 */
export const WIDEST_SPREAD = {
  halfWidth: (SHARED_SCREEN_MAX_DELTA_X * SHARED_SCREEN_ESCAPE_SCALE) / 2,
  halfDepth: (SHARED_SCREEN_MAX_DELTA_Y * SHARED_SCREEN_ESCAPE_SCALE) / 2,
};

/**
 * Narrowest box the camera frames, in cells from its centre. With the side
 * margin a lone player keeps 5.5 cells in view either side, which is what
 * the old cap showed on a portrait phone. Wide screens fit it at the closest
 * zoom, so it only matters on narrow ones.
 */
export const MIN_HALF_WIDTH = 4;

/**
 * Where GameHUD.styles puts the HUD. `row`: cards in a row under the top
 * controls. `phone` (max-width: 640px): mini cards in one row at the top.
 * `short` (max-height: 560px, min-width: 641px): cards on the bottom edge.
 */
export type HudLayout = 'row' | 'phone' | 'short';

export function hudLayout(width: number, height: number): HudLayout {
  if (width <= 640) return 'phone';
  if (height <= 560 && width >= 641) return 'short';
  return 'row';
}

/**
 * The HUD's CSS zoom: the HUD Size setting times a viewport factor, so the
 * HUD that reads at 100% on a 1366x768 laptop grows on bigger screens
 * instead of shrinking to a corner (1.41x at 1920x1080, capped at 1.5x).
 * The factor follows the tighter of width and height, so a wide but short
 * window does not give the HUD more of its height.
 */
export const HUD_REFERENCE_VIEW = { width: 1366, height: 768 };
export const MAX_VIEWPORT_HUD_ZOOM = 1.5;

export function hudZoom(hudScale: number, width: number, height: number): number {
  const fit = Math.min(width / HUD_REFERENCE_VIEW.width, height / HUD_REFERENCE_VIEW.height);
  return (hudScale / 100) * Math.min(MAX_VIEWPORT_HUD_ZOOM, Math.max(1, fit));
}

/** Screen fractions the players must stay out of: the HUD bands. */
export type ScreenInsets = { top: number; bottom: number; side: number };

/**
 * The HUD bands as screen fractions, from the rectangles measured in
 * Chromium at 80, 100 and 125% HUD (z = hudZoom, which also carries the
 * viewport factor). Card heights are in HUD px, so they scale with z:
 * - row: cards from max(78z, 84) px (below the unzoomed top controls), 80z
 *   tall with win pips: 84-164 px at 1366x768, 110-220 px at 1920x1080.
 * - phone: mini cards from the same top, 99z tall; a CPU badge or the
 *   numbers wrap at a HUD size over 100%, up to 134z with three players.
 *   The bottom edge keeps a 43z one-line strip (the campaign objective, or
 *   the sudden-death banner) 12z above the edge.
 * - short: match bar (12z + 57z) and controls (18-76 px) on top; cards 80z
 *   tall, 12z from the bottom: 298-378 px on an 844x390 screen.
 *
 * With touch controls up (`device.touch`, input/touchLayout) the bands make
 * room for them as well:
 * - portrait: a bottom band as tall as the controls; on phones the one-line
 *   strip moves up onto it (GameHUD.styles), so it stacks on top.
 * - landscape: the controls fill both bottom corners, so the side bands
 *   take their width. Short screens move the cards up beside the match bar,
 *   P1 (and P3, or the mission line) over the pad and P2 over the bomb
 *   cluster, so the side bands take the wider of a card and the controls,
 *   and the top band shrinks to the match bar.
 * The safe-area insets (notches, the home indicator) add to every band:
 * the HUD and the controls are inset by them.
 */
const ROW_CARD_PX = 80;
const PHONE_CARD_PX = 99;
const PHONE_WRAPPED_CARD_PX = 134;
const PHONE_LINE_PX = 43;
const SHORT_STRIP_PX = 69;
const EDGE_PX = 12;
const AIR_PX = 8;

/** Player card width at 100% HUD (GameHUD.styles PlayerCardPaper): narrower up to 900 px. */
const CARD_WIDTH_PX = 248;
const NARROW_CARD_WIDTH_PX = 206;
/** The furthest a band may reach into the screen with touch controls up. */
const TOUCH_BAND_CAP = 0.45;

function belowControls(zoom: number): number {
  return Math.max(78 * zoom, 84);
}

export function hudInsets(
  hudScale: number,
  width: number,
  height: number,
  device: HudDevice = NO_HUD_DEVICE
): ScreenInsets {
  const zoom = hudZoom(hudScale, width, height);
  const h = Math.max(height, 1);
  const w = Math.max(width, 1);
  const layout = hudLayout(width, height);
  const { safe } = device;
  const touch = device.touch ? touchBands(device.touch, touchOrientation(width, height)) : null;
  // The notch side: the HUD is inset by the wider of the two.
  const safeSidePx = Math.max(safe.left, safe.right);
  // Touch side bands (landscape): the controls plus air, from the safe edge.
  const touchSidePx = touch && touch.side > 0 ? touch.side + AIR_PX : 0;
  const side = Math.min(TOUCH_BAND_CAP, Math.max(0.03, (safeSidePx + touchSidePx) / w));
  if (layout === 'phone') {
    // Cards wrap only above 100%; interpolate to the measured 125% worst case.
    const cardPx = PHONE_CARD_PX
      + Math.max(0, Math.min(1, (zoom - 1) / 0.25)) * (PHONE_WRAPPED_CARD_PX - PHONE_CARD_PX);
    const cardsBottomPx = safe.top + belowControls(zoom) + cardPx * zoom + AIR_PX;
    // The one-line strip sits on top of a touch bottom band.
    const linePx = safe.bottom + (touch?.bottom ?? 0) + (EDGE_PX + PHONE_LINE_PX) * zoom + AIR_PX;
    return {
      top: Math.min(0.45, cardsBottomPx / h),
      bottom: Math.min(touch ? TOUCH_BAND_CAP : 0.2, linePx / h),
      side,
    };
  }
  if (layout === 'short') {
    const topPx = safe.top + Math.max(SHORT_STRIP_PX * zoom, 76) + AIR_PX;
    if (touch) {
      // The cards stand in the side columns, over the controls.
      const cardPx = (width <= 900 ? NARROW_CARD_WIDTH_PX : CARD_WIDTH_PX) * zoom;
      const columnPx = safeSidePx + Math.max(EDGE_PX + cardPx, touch.side) + AIR_PX;
      return {
        top: Math.min(0.3, topPx / h),
        bottom: Math.max(0.03, (safe.bottom + EDGE_PX) / h),
        side: Math.min(TOUCH_BAND_CAP, columnPx / w),
      };
    }
    const cardsTopPx = safe.bottom + (EDGE_PX + ROW_CARD_PX) * zoom + AIR_PX;
    return { top: Math.min(0.3, topPx / h), bottom: Math.min(0.3, cardsTopPx / h), side };
  }
  const cardsBottomPx = safe.top + belowControls(zoom) + ROW_CARD_PX * zoom + AIR_PX;
  const touchBottomPx = touch && touch.bottom > 0 ? touch.bottom + AIR_PX : 0;
  return {
    top: Math.min(0.45, Math.max(0.18, cardsBottomPx / h)),
    bottom: Math.min(TOUCH_BAND_CAP, Math.max(0.03, (safe.bottom + touchBottomPx) / h)),
    side,
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
 * centre so the box clears the HUD bands. Zero when it already does: a lone
 * player stays centred. Under the top band it moves the box down; under a
 * bottom band only (short screens) it moves the box up, never past the top.
 */
export function groupShift(
  scale: number,
  halfWidth: number,
  halfDepth: number,
  insets: ScreenInsets
): number {
  const topDz = -halfDepth - FRAME_MARGIN.top;
  const bottomDz = halfDepth + FRAME_MARGIN.bottom;
  if (screenY(scale, topDz, FRAME_MARGIN.head) < insets.top) {
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
  if (screenY(scale, bottomDz, 0) <= 1 - insets.bottom) return 0;
  // The shift that lifts the bottom edge onto the bottom inset...
  let low = 0;
  let high = bottomDz;
  for (let step = 0; step < 24; step += 1) {
    const mid = (low + high) / 2;
    if (screenY(scale, bottomDz - mid, 0) > 1 - insets.bottom) low = mid;
    else high = mid;
  }
  const lift = high;
  if (screenY(scale, topDz - lift, FRAME_MARGIN.head) >= insets.top) return lift;
  // ...or as far as the top edge allows, when the box is taller than the gap.
  low = 0;
  high = lift;
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
  const side = Math.max(halfWidth, MIN_HALF_WIDTH) + FRAME_MARGIN.side;
  // Rows nearer the camera spread wider, so the bottom corners bound the width.
  return screenY(scale, topDz, FRAME_MARGIN.head) >= insets.top - 1e-4
    && screenY(scale, bottomDz, 0) <= 1 - insets.bottom
    && screenX(scale, -side, bottomDz, 0, aspect) >= insets.side
    && screenX(scale, -side, topDz, FRAME_MARGIN.head, aspect) >= insets.side;
}

/**
 * The smallest camera scale in [MIN_FRAMING, maxFraming] that fits a box of
 * players `halfWidth` x `halfDepth` cells (from its centre) into the screen
 * outside the HUD insets. `maxFraming` when nothing in range fits.
 */
export function framingScaleFor(
  halfWidth: number,
  halfDepth: number,
  aspect: number,
  insets: ScreenInsets,
  maxFraming = MAX_FRAMING
): number {
  if (groupFits(MIN_FRAMING, halfWidth, halfDepth, aspect, insets)) return MIN_FRAMING;
  if (!groupFits(maxFraming, halfWidth, halfDepth, aspect, insets)) return maxFraming;
  let low = MIN_FRAMING;
  let high = maxFraming;
  for (let step = 0; step < 16; step += 1) {
    const mid = (low + high) / 2;
    if (groupFits(mid, halfWidth, halfDepth, aspect, insets)) high = mid;
    else low = mid;
  }
  return high;
}

/**
 * How far this screen may zoom out: far enough for the widest spread the
 * engine allows, so nobody is ever framed off screen, and never less than
 * the desktop cap. A portrait phone needs about twice the desktop's reach.
 */
export function maxFramingFor(aspect: number, insets: ScreenInsets): number {
  const widest = framingScaleFor(
    WIDEST_SPREAD.halfWidth,
    WIDEST_SPREAD.halfDepth,
    aspect,
    insets,
    FAR_FRAMING
  );
  return Math.max(MAX_FRAMING, widest);
}
