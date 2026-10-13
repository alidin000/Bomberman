import type { ReputationTierId } from '../content/villageSquare';
import type { StageId } from '../content/types';

// A village's reputation (StoryProgress.reputation) grows by 10 for each
// mission cleared there, 1 for each new secret found, and by the reward of
// each request completed. Standing is the sum over every village, so it grows
// through one playthrough. Its tier decides what every village square offers:
// another villager, more requests, stall stock and a cosmetic.
export interface ReputationTier {
  id: ReputationTierId;
  label: string;
  // Standing needed to reach this tier.
  from: number;
}

export const REPUTATION_TIERS: readonly ReputationTier[] = [
  { id: 'stranger', label: 'Stranger', from: 0 },
  { id: 'known', label: 'Known', from: 15 },
  { id: 'trusted', label: 'Trusted', from: 40 },
  { id: 'honored', label: 'Honored', from: 80 },
];

const TIER_ORDER: readonly ReputationTierId[] = REPUTATION_TIERS.map((tier) => tier.id);

/** Standing: the reputation of every village added up. */
export function totalReputation(reputation: Partial<Record<StageId, number>>): number {
  return Object.values(reputation).reduce<number>((sum, points) => sum + (points ?? 0), 0);
}

export function reputationTier(standing: number): ReputationTier {
  let reached = REPUTATION_TIERS[0];
  REPUTATION_TIERS.forEach((tier) => {
    if (standing >= tier.from) reached = tier;
  });
  return reached;
}

/** The tier after the one this standing reached, or null at the top. */
export function nextReputationTier(standing: number): ReputationTier | null {
  return REPUTATION_TIERS.find((tier) => standing < tier.from) ?? null;
}

/** True once `reached` is at least `needed` (stranger < known < trusted < honored). */
export function tierAtLeast(reached: ReputationTierId, needed: ReputationTierId): boolean {
  return TIER_ORDER.indexOf(reached) >= TIER_ORDER.indexOf(needed);
}
