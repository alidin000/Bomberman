import { TICK_MS } from '../engine/constants';
import { MAX_ONLINE_GLIDE_MS, onlineGlideDuration } from './onlineInterpolation';

describe('online snapshot interpolation', () => {
  it('uses one simulation tick for steady snapshots', () => {
    expect(onlineGlideDuration(10, 11, TICK_MS)).toBe(TICK_MS);
  });

  it('covers ticks skipped by React batching', () => {
    expect(onlineGlideDuration(10, 12, TICK_MS)).toBe(TICK_MS * 2);
  });

  it('absorbs network jitter without creating an unbounded visual delay', () => {
    expect(onlineGlideDuration(10, 11, 90)).toBe(90);
    expect(onlineGlideDuration(10, 20, 500)).toBe(MAX_ONLINE_GLIDE_MS);
  });
});
