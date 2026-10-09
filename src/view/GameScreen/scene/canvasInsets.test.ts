import { hudInsets } from './cameraFraming';
import { ARENA_FRAME_PX, canvasHudInsets } from './canvasInsets';

// Screen pixels from the top of the viewport where the camera keeps players.
const viewportTopPx = (insets: { top: number }, canvasHeight: number) => (
  insets.top * canvasHeight + ARENA_FRAME_PX
);

describe('canvasHudInsets', () => {
  it('keeps players at the same screen height now that the canvas sits inside the frame', () => {
    const viewport = { width: 1366, height: 768 };
    const canvas = {
      width: viewport.width - 2 * ARENA_FRAME_PX,
      height: viewport.height - 2 * ARENA_FRAME_PX,
    };
    const onCanvas = canvasHudInsets(100, canvas.width, canvas.height);
    const onViewport = hudInsets(100, viewport.width, viewport.height);
    expect(viewportTopPx(onCanvas, canvas.height)).toBeCloseTo(onViewport.top * viewport.height, 6);
  });

  it('picks the HUD layout the CSS picks, from the viewport size', () => {
    // A 650 px viewport is the wide "row" HUD; its 634 px canvas alone would
    // read as a phone and reserve the phone's taller top band.
    const canvas = { width: 650 - 2 * ARENA_FRAME_PX, height: 700 - 2 * ARENA_FRAME_PX };
    const onCanvas = canvasHudInsets(100, canvas.width, canvas.height);
    const rowTopPx = hudInsets(100, 650, 700).top * 700;
    expect(viewportTopPx(onCanvas, canvas.height)).toBeCloseTo(rowTopPx, 6);
    expect(hudInsets(100, canvas.width, canvas.height).top * canvas.height)
      .not.toBeCloseTo(rowTopPx - ARENA_FRAME_PX, 0);
  });
});
