import { EXPLOSION_MS } from '../../../engine/constants';

/**
 * How old a flame cell is drawn this frame. The drawn age runs on frame time
 * so a blast animates smoothly between ticks. A second blast through a burning
 * cell resets the engine's timer (bombs.ts); when `ticksRemaining` goes up, the
 * drawn flame starts over from the engine's age instead of sitting on its
 * end-of-life frame (no pulse, no light) for the rest of its lethal time.
 */
export function nextFlameAgeMs(
  previousAgeMs: number | undefined,
  previousTicksRemaining: number | undefined,
  ticksRemaining: number,
  deltaMs: number
): number {
  if (previousTicksRemaining !== undefined && ticksRemaining > previousTicksRemaining) {
    return Math.max(0, EXPLOSION_MS - ticksRemaining);
  }
  return Math.min(EXPLOSION_MS, (previousAgeMs ?? 0) + deltaMs);
}
