import { HudDevice, NO_HUD_DEVICE } from '../../../input/touchLayout';
import { ScreenInsets, hudInsets } from './cameraFraming';

/**
 * Width of the paper frame around the arena (GameScreen.styles: the scene
 * container is inset by this much on every side). The frame used to be an
 * 8 px ring drawn over the canvas; the canvas now sits inside it instead.
 */
export const ARENA_FRAME_PX = 8;

/**
 * hudInsets() measures the HUD on the viewport, but the camera frames the
 * canvas, which is ARENA_FRAME_PX smaller on every side. Picks the HUD layout
 * from the viewport size (the HUD's media queries do too) and converts its
 * bands to fractions of the canvas, so players stay where they were on
 * screen, clear of the HUD.
 */
export function canvasHudInsets(
  hudScale: number,
  canvasWidth: number,
  canvasHeight: number,
  framePx: number = ARENA_FRAME_PX,
  device: HudDevice = NO_HUD_DEVICE
): ScreenInsets {
  const viewWidth = canvasWidth + 2 * framePx;
  const viewHeight = canvasHeight + 2 * framePx;
  const view = hudInsets(hudScale, viewWidth, viewHeight, device);
  const toCanvas = (fraction: number, viewPx: number, canvasPx: number) => (
    Math.max(0, (fraction * viewPx - framePx) / Math.max(canvasPx, 1))
  );
  return {
    top: toCanvas(view.top, viewHeight, canvasHeight),
    bottom: toCanvas(view.bottom, viewHeight, canvasHeight),
    side: toCanvas(view.side, viewWidth, canvasWidth),
  };
}
