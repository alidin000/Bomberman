import { Direction } from '../engine/types';

// The floating 4-way pad. The first touch sets an origin; the thumb's offset
// from it picks one of four directions. Neither an analog stick (Bomberman
// Touch "havering near the corner of a block") nor four arrow buttons (Touch
// 2 moving "too much in any direction under the slightest of input").

/** Thumb travel (CSS px) before the pad picks a direction. */
export const TOUCH_DEAD_ZONE_PX = 10;
/** Once moving, the thumb has to come this close to the origin to stop. */
export const TOUCH_STOP_RADIUS_PX = 5;
/**
 * The other axis must be this much larger before the pad switches axis, so
 * a sloppy diagonal near 45 degrees keeps the current direction (the switch
 * happens near 51 degrees).
 */
export const TOUCH_AXIS_SWITCH_RATIO = 1.25;
/**
 * Past this distance the origin follows the thumb, so a reversal needs only
 * a short move back instead of the whole way across the pad.
 */
export const TOUCH_FOLLOW_RADIUS_PX = 56;

function isHorizontal(direction: Direction | null): boolean {
  return direction === 'left' || direction === 'right';
}

/**
 * The direction for a thumb offset (dx, dy) from the origin, given the one
 * held now. Along the same axis it flips at once; across axes it needs the
 * other axis to be TOUCH_AXIS_SWITCH_RATIO times larger.
 */
export function resolveTouchDirection(
  dx: number,
  dy: number,
  current: Direction | null
): Direction {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  let horizontal: boolean;
  if (current === null) horizontal = ax >= ay;
  else if (isHorizontal(current)) horizontal = ay <= ax * TOUCH_AXIS_SWITCH_RATIO;
  else horizontal = ax > ay * TOUCH_AXIS_SWITCH_RATIO;
  if (horizontal) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/**
 * One thumb on the pad. Plain numbers and no allocation per move, so the
 * overlay can run it from every pointermove.
 */
export class TouchPad {
  originX = 0;

  originY = 0;

  /** Where the thumb is now, relative to the origin (for the knob). */
  offsetX = 0;

  offsetY = 0;

  direction: Direction | null = null;

  start(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.offsetX = 0;
    this.offsetY = 0;
    this.direction = null;
  }

  /** The direction for the thumb at (x, y); drags the origin along past the follow radius. */
  move(x: number, y: number): Direction | null {
    let dx = x - this.originX;
    let dy = y - this.originY;
    const distance = Math.hypot(dx, dy);
    if (distance > TOUCH_FOLLOW_RADIUS_PX) {
      const pull = (distance - TOUCH_FOLLOW_RADIUS_PX) / distance;
      this.originX += dx * pull;
      this.originY += dy * pull;
      dx -= dx * pull;
      dy -= dy * pull;
    }
    this.offsetX = dx;
    this.offsetY = dy;
    const stopRadius = this.direction === null ? TOUCH_DEAD_ZONE_PX : TOUCH_STOP_RADIUS_PX;
    this.direction = distance < stopRadius ? null : resolveTouchDirection(dx, dy, this.direction);
    return this.direction;
  }

  end(): void {
    this.direction = null;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}
