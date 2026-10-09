import {
  TOUCH_DEAD_ZONE_PX, TOUCH_FOLLOW_RADIUS_PX, TouchPad, resolveTouchDirection,
} from './touchPad';

describe('the floating touch pad', () => {
  it('ignores a resting thumb inside the dead zone', () => {
    const pad = new TouchPad();
    pad.start(100, 100);
    expect(pad.move(100 + TOUCH_DEAD_ZONE_PX - 1, 100)).toBeNull();
    expect(pad.move(100, 100 - 6)).toBeNull();
    expect(pad.move(100 + TOUCH_DEAD_ZONE_PX + 1, 100)).toBe('right');
  });

  it('gives one of four directions by the dominant axis', () => {
    expect(resolveTouchDirection(-20, 5, null)).toBe('left');
    expect(resolveTouchDirection(3, -20, null)).toBe('up');
    expect(resolveTouchDirection(4, 30, null)).toBe('down');
  });

  it('keeps the held direction through a sloppy diagonal, and switches past 51 degrees', () => {
    // 45 to 51 degrees off a held right: still right (a d-pad that fires
    // "contrary to what you intended" under slight input was the Touch 2 flaw).
    expect(resolveTouchDirection(20, 22, 'right')).toBe('right');
    expect(resolveTouchDirection(20, 24.9, 'right')).toBe('right');
    expect(resolveTouchDirection(20, 25.1, 'right')).toBe('down');
    // The same offsets from a held down stay down.
    expect(resolveTouchDirection(22, 20, 'down')).toBe('down');
    expect(resolveTouchDirection(25.1, 20, 'down')).toBe('right');
  });

  it('reverses along the same axis at once', () => {
    const pad = new TouchPad();
    pad.start(100, 100);
    expect(pad.move(130, 100)).toBe('right');
    expect(pad.move(80, 104)).toBe('left');
  });

  it('drags its origin along, so a reversal after a long slide is a short move', () => {
    const pad = new TouchPad();
    pad.start(100, 100);
    expect(pad.move(300, 100)).toBe('right');
    // The origin trails the thumb by the follow radius, not 200 px.
    expect(pad.originX).toBeCloseTo(300 - TOUCH_FOLLOW_RADIUS_PX, 6);
    expect(pad.move(300 - TOUCH_FOLLOW_RADIUS_PX - 12, 100)).toBe('left');
  });

  it('stops when the thumb comes back to the origin, and on release', () => {
    const pad = new TouchPad();
    pad.start(100, 100);
    expect(pad.move(120, 100)).toBe('right');
    // Within the dead zone but outside the stop radius: still walking.
    expect(pad.move(107, 100)).toBe('right');
    expect(pad.move(102, 100)).toBeNull();
    pad.move(130, 100);
    pad.end();
    expect(pad.direction).toBeNull();
  });
});
