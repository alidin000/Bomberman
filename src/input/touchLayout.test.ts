import {
  TOUCH_BOMB_PX, TouchCircle, TouchSize, touchBands, touchLayout,
} from './touchLayout';

const VIEWS: [number, number][] = [
  [390, 844], [360, 780], [844, 390], [667, 375], [768, 1024], [1024, 768],
];
const SIZES: TouchSize[] = ['small', 'medium', 'large'];

function circles(width: number, height: number, size: TouchSize, leftHanded = false) {
  const layout = touchLayout(width, height, size, leftHanded);
  const ring: TouchCircle = { x: layout.pad.x, y: layout.pad.y, size: layout.pad.ring };
  return [...Object.values(layout.buttons), ring];
}

describe('touch control layout', () => {
  it.each(SIZES)('keeps every %s control at least 44 px, apart, and on screen', (size) => {
    // A 320 px phone fits the small and medium sizes.
    const views: [number, number][] = size === 'large' ? VIEWS : [...VIEWS, [320, 568]];
    views.forEach(([width, height]) => {
      [false, true].forEach((leftHanded) => {
        const all = circles(width, height, size, leftHanded);
        all.forEach((circle, index) => {
          expect(circle.size).toBeGreaterThanOrEqual(44);
          expect(circle.x - circle.size / 2).toBeGreaterThanOrEqual(0);
          expect(circle.x + circle.size / 2).toBeLessThanOrEqual(width);
          expect(circle.y + circle.size / 2).toBeLessThanOrEqual(height);
          // Inactive space between targets (XAG 107): 8 px or more.
          all.slice(index + 1).forEach((other) => {
            const gap = Math.hypot(circle.x - other.x, circle.y - other.y)
              - circle.size / 2 - other.size / 2;
            expect(gap).toBeGreaterThanOrEqual(8);
          });
        });
      });
    });
  });

  it('makes the bomb the biggest target, 96 px at the medium size', () => {
    const { buttons } = touchLayout(390, 844, 'medium');
    expect(buttons.bomb.size).toBe(96);
    expect(Math.max(...Object.values(buttons).map((button) => button.size))).toBe(96);
    expect(touchLayout(390, 844, 'large').buttons.bomb.size).toBe(TOUCH_BOMB_PX.large);
  });

  it('keeps every control inside the bands the camera keeps players out of', () => {
    VIEWS.forEach(([width, height]) => {
      SIZES.forEach((size) => {
        const layout = touchLayout(width, height, size);
        const bands = touchBands(size, layout.orientation);
        circles(width, height, size).forEach((circle) => {
          if (layout.orientation === 'portrait') {
            expect(circle.y - circle.size / 2).toBeGreaterThanOrEqual(height - bands.bottom - 0.5);
          } else {
            const fromEdge = Math.min(
              circle.x - circle.size / 2,
              width - circle.x - circle.size / 2
            );
            expect(fromEdge + circle.size).toBeLessThanOrEqual(bands.side + 0.5);
          }
        });
      });
    });
  });

  it('mirrors the whole layout for left-handed players', () => {
    const right = touchLayout(390, 844, 'medium');
    const left = touchLayout(390, 844, 'medium', true);
    expect(left.buttons.bomb.x).toBeCloseTo(390 - right.buttons.bomb.x, 6);
    expect(left.pad.x).toBeCloseTo(390 - right.pad.x, 6);
    expect(left.zone.left + left.zone.width).toBeCloseTo(390, 6);
    // The pad zone never reaches the bomb cluster.
    const zoneEdge = right.zone.left + right.zone.width;
    const clusterEdge = right.buttons.ultimate.x - right.buttons.ultimate.size / 2;
    expect(zoneEdge).toBeLessThan(clusterEdge);
  });
});
