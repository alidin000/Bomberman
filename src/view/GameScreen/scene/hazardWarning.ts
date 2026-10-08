import { BossHazard } from '../../../engine/types';

/**
 * Milliseconds of warning left before a hazard turns lethal, 0 once it is.
 * Mirrors the engine's hazardIsActive window (bosses.ts); the test pins the
 * two together so a rule change there cannot silently desync the telegraph.
 */
export function hazardWarningRemainingMs(hazard: BossHazard): number {
  const activeWindowMs = hazard.activeMs
    ?? Math.max(300, Math.round(hazard.warningTicks * (3 / 7)));
  return Math.max(0, hazard.ticksRemaining - activeWindowMs);
}

/** Enemy abilities already get their own target-cell warning. */
export function isEnemyAbilityHazard(hazard: BossHazard): boolean {
  return hazard.id.startsWith('monster-hazard-');
}
