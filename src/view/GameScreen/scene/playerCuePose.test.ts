import { CUE_DURATION_MS, PlayerCue, PlayerCueKind } from '../../../hooks/cueStore';
import {
  HIT_HOLD_MS,
  PLANT_ATTACK_MS,
  PLANT_HOLD_MS,
  PlayerPose,
  createPlayerPose,
  samplePlayerCuePose,
} from './playerCuePose';

function cue(kind: PlayerCueKind): PlayerCue {
  return { kind, startMs: 1000, seq: 1 };
}

function poseAt(kind: PlayerCueKind, ageMs: number, reduced = false, alive = kind !== 'death') {
  return { ...samplePlayerCuePose(cue(kind), 1000 + ageMs, alive, reduced, createPlayerPose()) };
}

// How far a pose is from standing still, in one number.
function displacement(pose: PlayerPose): number {
  return Math.abs(pose.lean) + Math.abs(pose.spin) + Math.abs(1 - pose.scaleY)
    + Math.abs(1 - pose.scaleXZ) + Math.abs(pose.lift);
}

const AT_REST = {
  lean: 0, spin: 0, scaleY: 1, scaleXZ: 1, lift: 0, hidden: false,
};

describe('player cue poses', () => {
  it('leans into a plant within 50 ms and settles by 220 ms', () => {
    const peak = displacement(poseAt('plant', PLANT_ATTACK_MS));
    expect(displacement(poseAt('plant', 16))).toBeGreaterThan(peak * 0.4);
    expect(poseAt('plant', PLANT_ATTACK_MS).lean).toBeGreaterThan(0.2);
    // Held through the plant window, not beyond 160 ms.
    expect(displacement(poseAt('plant', PLANT_HOLD_MS))).toBeCloseTo(peak, 5);
    expect(displacement(poseAt('plant', 160))).toBeLessThan(peak);
    expect(CUE_DURATION_MS.plant).toBeLessThanOrEqual(220);
    expect(poseAt('plant', CUE_DURATION_MS.plant)).toEqual(AT_REST);
  });

  it('lands a hit inside 60-100 ms, leaning back, and settles by 220 ms', () => {
    const early = poseAt('hit', 30);
    const held = poseAt('hit', HIT_HOLD_MS);
    expect(early.lean).toBeLessThan(-0.3);
    expect(held).toEqual(early);
    expect(HIT_HOLD_MS).toBeGreaterThanOrEqual(60);
    expect(HIT_HOLD_MS).toBeLessThanOrEqual(100);
    expect(poseAt('hit', 220)).toEqual(AT_REST);
  });

  it('turns once on an ultimate and ends facing the same way', () => {
    const mid = poseAt('ultimate', 150);
    expect(mid.spin).toBeGreaterThan(Math.PI / 2);
    expect(mid.lift).toBeGreaterThan(0);
    const end = poseAt('ultimate', CUE_DURATION_MS.ultimate - 1);
    expect(end.spin).toBeCloseTo(Math.PI * 2, 1);
    expect(poseAt('ultimate', CUE_DURATION_MS.ultimate)).toEqual(AT_REST);
  });

  it('holds a fallen fighter in a death pose, then hides it', () => {
    const falling = poseAt('death', 200);
    expect(falling.hidden).toBe(false);
    expect(falling.scaleY).toBeLessThan(0.8);
    expect(falling.spin).toBeGreaterThan(0);
    expect(poseAt('death', CUE_DURATION_MS.death).hidden).toBe(true);
    // A fall the store never saw is hidden at once, as before.
    expect(samplePlayerCuePose(null, 0, false, false, createPlayerPose()).hidden).toBe(true);
  });

  it.each(['plant', 'hit', 'ultimate', 'death'] as PlayerCueKind[])(
    'keeps a visible, still %s pose with reduced motion',
    (kind) => {
      const first = poseAt(kind, 0, true);
      const later = poseAt(kind, 90, true);
      // Visible: it is not the rest pose. Still: it does not change or spin.
      expect(displacement(first)).toBeGreaterThan(0.05);
      expect(later).toEqual(first);
      expect(first.spin).toBe(0);
      expect(first.hidden).toBe(false);
    }
  );
});
