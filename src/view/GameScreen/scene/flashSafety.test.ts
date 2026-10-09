import { FUSE_URGENT_MS, bombPulseScale } from './bombFuse';
import { MAX_FLASH_HZ, PULSE_HZ, pulseRate } from './flashSafety';
import {
  phaseCue, roarAmount, sealPose, SEAL_DONE_MS,
} from './bossPresentation';
import { BOSS_INTRO_MS } from '../../../engine/constants';

// WCAG 2.3.1: nothing in the arena may flash more than three times in any
// one second. A flash is a rise and a fall, so a beat is one flash.

/** Most rises-and-falls of `value(seconds)` in any one-second window. */
function mostBeatsPerSecond(value: (at: number) => number, seconds = 3): number {
  const step = 1 / 1000;
  const peaks: number[] = [];
  let before = value(0);
  let now = value(step);
  for (let t = 2 * step; t <= seconds; t += step) {
    const after = value(t);
    if (now > before && now >= after) peaks.push(t - step);
    before = now;
    now = after;
  }
  let most = 0;
  peaks.forEach((start, index) => {
    const inWindow = peaks.slice(index).filter((peak) => peak < start + 1).length;
    most = Math.max(most, inWindow);
  });
  return most;
}

describe('flash safety', () => {
  it('beats an urgent bomb at most three times a second, steady under reduced motion', () => {
    const urgent = FUSE_URGENT_MS / 2;
    expect(mostBeatsPerSecond((t) => bombPulseScale(urgent, t, false)))
      .toBeLessThanOrEqual(MAX_FLASH_HZ);
    // Still a clear swell (it says "about to blow" by size).
    const sizes = Array.from(
      { length: 400 },
      (_, index) => bombPulseScale(urgent, index / 400, false)
    );
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeGreaterThan(0.2);
    const steady = new Set(Array.from(
      { length: 50 },
      (_, index) => bombPulseScale(urgent, index / 37, true)
    ));
    expect([...steady]).toEqual([1.15]);
  });

  it('keeps every periodic effect in the arena at or under three beats a second', () => {
    Object.entries(PULSE_HZ).forEach(([effect, hz]) => {
      expect({ effect, hz: hz <= MAX_FLASH_HZ }).toEqual({ effect, hz: true });
      const beats = mostBeatsPerSecond((t) => Math.sin(t * pulseRate(hz)));
      expect({ effect, beats: beats <= MAX_FLASH_HZ }).toEqual({ effect, beats: true });
    });
  });

  it('gives the boss cues one change each, never a flash', () => {
    [false, true].forEach((reducedMotion) => {
      // The roar: one swell over the whole intro.
      expect(mostBeatsPerSecond((t) => roarAmount(t * 1000, reducedMotion), BOSS_INTRO_MS / 1000))
        .toBeLessThanOrEqual(1);
      // The phase change: one colour ramp, up only.
      let last = -1;
      for (let ms = 0; ms < 1500; ms += 10) {
        const { enrage } = phaseCue(2, ms, reducedMotion);
        expect(enrage).toBeGreaterThanOrEqual(last);
        last = enrage;
      }
      // The seal: one fade, out only, done well inside the boss-seal hold.
      let faded = -1;
      for (let ms = 0; ms <= SEAL_DONE_MS; ms += 10) {
        const { dissolve } = sealPose(ms, reducedMotion);
        expect(dissolve).toBeGreaterThanOrEqual(faded);
        faded = dissolve;
      }
      expect(sealPose(SEAL_DONE_MS, reducedMotion).gone).toBe(true);
    });
  });
});
