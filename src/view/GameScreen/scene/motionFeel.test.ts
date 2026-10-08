import {
  FACING_HEADING,
  STRIDE_CELLS,
  advanceStride,
  cameraFollowRate,
  decayShake,
  turnToward,
} from './motionFeel';

function turnFor(ms: number, hz: number, from: number, to: number): number {
  let angle = from;
  for (let t = 0; t < ms; t += 1000 / hz) angle = turnToward(angle, to, 1 / hz);
  return angle;
}

function shakeTrace(hz: number, holdMs: number, totalMs: number): number[] {
  let level = 0;
  const trace: number[] = [];
  for (let t = 0; t < totalMs; t += 1000 / hz) {
    level = decayShake(level, t < holdMs ? 1 : 0, 1 / hz);
    trace.push(level);
  }
  return trace;
}

describe('motion feel', () => {
  it('finishes a quarter turn within 10 degrees in under 150 ms at any refresh rate', () => {
    [60, 120, 144].forEach((hz) => {
      const angle = turnFor(150, hz, FACING_HEADING.down, FACING_HEADING.right);
      expect(Math.abs(angle - FACING_HEADING.right)).toBeLessThan((10 * Math.PI) / 180);
    });
    const at60 = turnFor(100, 60, FACING_HEADING.down, FACING_HEADING.right);
    const at144 = turnFor(100, 144, FACING_HEADING.down, FACING_HEADING.right);
    expect(Math.abs(at60 - at144)).toBeLessThan((2 * Math.PI) / 180);
  });

  it('turns the short way across the back (left to up does not swing through down)', () => {
    let angle = FACING_HEADING.left;
    let farthestFromUp = 0;
    for (let i = 0; i < 30; i += 1) {
      angle = turnToward(angle, FACING_HEADING.up, 1 / 60);
      const offUp = Math.abs(Math.atan2(Math.sin(angle - Math.PI), Math.cos(angle - Math.PI)));
      farthestFromUp = Math.max(farthestFromUp, offUp);
    }
    expect(farthestFromUp).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    expect(Math.cos(angle - Math.PI)).toBeGreaterThan(0.99);
  });

  it('holds the shake for the impact and then fades it out within 400 ms instead of cutting it', () => {
    [60, 144].forEach((hz) => {
      const trace = shakeTrace(hz, 180, 800);
      const frame = 1000 / hz;
      const firstFaded = Math.ceil(180 / frame);
      expect(trace[firstFaded - 1]).toBe(1);
      // The first faded frame keeps most of the swing rather than dropping to 0.
      expect(trace[firstFaded]).toBeGreaterThan(0.75);
      expect(trace[Math.ceil(580 / frame)]).toBe(0);
    });
  });

  it('bobs once per stride of travel and ignores teleports', () => {
    let phase = 0;
    for (let i = 0; i < 10; i += 1) phase = advanceStride(phase, STRIDE_CELLS / 10);
    expect(phase).toBeCloseTo(Math.PI, 6);
    expect(advanceStride(phase, 3)).toBe(phase);
  });

  it('changes the camera follow rate gradually as the camera zooms out', () => {
    expect(cameraFollowRate(1)).toBe(5);
    expect(cameraFollowRate(1.8)).toBe(9);
    for (let framing = 1; framing < 1.2; framing += 0.005) {
      const step = Math.abs(cameraFollowRate(framing + 0.005) - cameraFollowRate(framing));
      expect(step).toBeLessThan(0.25);
    }
  });
});
