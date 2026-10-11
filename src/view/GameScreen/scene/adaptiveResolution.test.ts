import { describe, expect, it } from 'vitest';
import {
  LOW_END_RESOLUTION_PROFILE,
  STANDARD_RESOLUTION_PROFILE,
  initialCanvasDpr,
  nextAdaptiveDpr,
  reconcileAdaptiveDpr,
} from './adaptiveResolution';

describe('initialCanvasDpr', () => {
  it.each([
    [360, 800, 3, 2],
    [390, 844, 3, 2],
    [430, 932, 3, 2],
    [844, 390, 3, 2],
  ])('uses a crisp DPR on a %ix%i phone', (width, height, deviceDpr, expected) => {
    expect(initialCanvasDpr({
      width, height, deviceDpr, lowEnd: false,
    })).toBe(expected);
  });

  it('caps low-end phones more conservatively', () => {
    expect(initialCanvasDpr({
      width: 390, height: 844, deviceDpr: 3, lowEnd: true,
    })).toBe(1.5);
  });

  it.each([
    [768, 1024, 2, false, STANDARD_RESOLUTION_PROFILE.pixelBudget],
    [1440, 900, 2, false, STANDARD_RESOLUTION_PROFILE.pixelBudget],
    [768, 1024, 2, true, LOW_END_RESOLUTION_PROFILE.pixelBudget],
  ])('keeps %ix%i within its backing-pixel budget', (width, height, deviceDpr, lowEnd, budget) => {
    const dpr = initialCanvasDpr({
      width, height, deviceDpr, lowEnd,
    });
    expect(width * height * dpr * dpr).toBeLessThanOrEqual(budget);
  });

  it('never upscales beyond the physical device ratio', () => {
    expect(initialCanvasDpr({
      width: 390, height: 844, deviceDpr: 1.25, lowEnd: false,
    })).toBe(1.25);
  });
});

describe('nextAdaptiveDpr', () => {
  it('lowers quality after one sustained slow window', () => {
    expect(nextAdaptiveDpr({ dpr: 2, fastWindows: 1 }, 24, 2)).toEqual({
      dpr: 1.75,
      fastWindows: 0,
    });
  });

  it('requires two fast windows before raising quality', () => {
    const first = nextAdaptiveDpr({ dpr: 1.5, fastWindows: 0 }, 17, 2);
    expect(first).toEqual({ dpr: 1.5, fastWindows: 1 });
    expect(nextAdaptiveDpr(first, 17, 2)).toEqual({ dpr: 1.75, fastWindows: 0 });
  });

  it('holds quality in the hysteresis band and respects both bounds', () => {
    expect(nextAdaptiveDpr({ dpr: 1.5, fastWindows: 1 }, 20, 2)).toEqual({
      dpr: 1.5,
      fastWindows: 0,
    });
    expect(nextAdaptiveDpr({ dpr: 1, fastWindows: 0 }, 30, 2).dpr).toBe(1);
    expect(nextAdaptiveDpr({ dpr: 2, fastWindows: 2 }, 16, 2).dpr).toBe(2);
  });
});

describe('reconcileAdaptiveDpr', () => {
  it('keeps learned quality when canvas children remount', () => {
    const runtime = { targetDpr: 2, dpr: 1.5, fastWindows: 1 };
    expect(reconcileAdaptiveDpr(runtime, 2)).toBe(runtime);
  });

  it('starts from the new target after the viewport changes', () => {
    expect(reconcileAdaptiveDpr(
      { targetDpr: 2, dpr: 1.5, fastWindows: 1 },
      1.6
    )).toEqual({ targetDpr: 1.6, dpr: 1.6, fastWindows: 0 });
  });
});
