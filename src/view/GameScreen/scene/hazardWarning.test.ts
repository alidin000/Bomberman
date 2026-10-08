import { hazardIsActive } from '../../../engine/bosses';
import { BossHazard } from '../../../engine/types';
import { hazardWarningRemainingMs, isEnemyAbilityHazard } from './hazardWarning';

function hazard(ticksRemaining: number, extra: Partial<BossHazard> = {}): BossHazard {
  return {
    id: 'hazard-1',
    kind: 'lavaBurst',
    x: 3,
    y: 3,
    ticksRemaining,
    warningTicks: 1680,
    color: '#ef4444',
    damage: 1,
    ...extra,
  };
}

describe('hazardWarningRemainingMs', () => {
  it.each([
    ['boss split window', {}],
    ['explicit lethal window', { activeMs: 800, warningTicks: 850 }],
  ])('runs out exactly when the engine makes the hazard lethal (%s)', (_, extra) => {
    for (let ticks = 2400; ticks > 0; ticks -= 50) {
      const sample = hazard(ticks, extra);
      expect(hazardWarningRemainingMs(sample) > 0).toBe(!hazardIsActive(sample));
    }
  });

  it('tells enemy ability hazards apart from boss strikes', () => {
    expect(isEnemyAbilityHazard(hazard(900, { id: 'monster-hazard-4' }))).toBe(true);
    expect(isEnemyAbilityHazard(hazard(900))).toBe(false);
  });
});
