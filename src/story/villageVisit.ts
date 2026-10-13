// What the save hands a solo campaign mission about its village square
// (GameConfig.village): the standing tier, the Embers the stall may take and
// the requests on the board. Worked out before INIT, so the match replays the
// same way. Shared by the launch path, the hub's previews and the match screen.
import type { StageId } from '../content/types';
import type {
  CampaignRequestDefinition,
  ReputationTierId,
  VillageVisitConfig,
} from '../content/villageSquare';
import { VILLAGE_REQUESTS } from '../content/villageRequests';
import {
  ReputationTier,
  nextReputationTier,
  reputationTier,
  tierAtLeast,
  totalReputation,
} from './reputation';
import type { StoryProgress } from './progress';

const TIER_IDS = new Set<string>(['stranger', 'known', 'trusted', 'honored']);

export interface VillageStanding {
  standing: number;
  tier: ReputationTier;
  next: ReputationTier | null;
  // 0..1 of the way from this tier to the next (1 at the top).
  toNext: number;
}

export function getVillageStanding(
  progress: Pick<StoryProgress, 'reputation'>
): VillageStanding {
  const standing = totalReputation(progress.reputation);
  const tier = reputationTier(standing);
  const next = nextReputationTier(standing);
  const toNext = next ? (standing - tier.from) / (next.from - tier.from) : 1;
  return {
    standing, tier, next, toNext: Math.max(0, Math.min(1, toNext)),
  };
}

/**
 * The board this visit: the village's requests the standing has reached and
 * that were never finished, in board order.
 */
export function getOfferedRequests(
  stageId: StageId,
  progress: Pick<StoryProgress, 'reputation' | 'completedRequests'>
): CampaignRequestDefinition[] {
  const { tier } = getVillageStanding(progress);
  return (VILLAGE_REQUESTS[stageId] ?? []).filter((request) => (
    tierAtLeast(tier.id, request.minTier) && !progress.completedRequests.includes(request.id)
  ));
}

/** The requests standing has not reached yet, for "more at Known" hints. */
export function getLockedRequests(
  stageId: StageId,
  progress: Pick<StoryProgress, 'reputation' | 'completedRequests'>
): CampaignRequestDefinition[] {
  const { tier } = getVillageStanding(progress);
  return (VILLAGE_REQUESTS[stageId] ?? []).filter((request) => (
    !tierAtLeast(tier.id, request.minTier) && !progress.completedRequests.includes(request.id)
  ));
}

export function buildVillageVisit(stageId: StageId, progress: StoryProgress): VillageVisitConfig {
  return {
    reputationTier: getVillageStanding(progress).tier.id,
    embers: progress.currency,
    offeredRequestIds: getOfferedRequests(stageId, progress).map((request) => request.id),
  };
}

/**
 * A stored visit, read back for the match (stored setups are untrusted): a
 * known tier, whole Embers, and only this village's request ids.
 */
export function normalizeVillageVisit(
  value: unknown,
  stageId: StageId
): VillageVisitConfig | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const visit = value as Partial<VillageVisitConfig>;
  const ids = new Set((VILLAGE_REQUESTS[stageId] ?? []).map((request) => request.id));
  const offered = Array.isArray(visit.offeredRequestIds) ? visit.offeredRequestIds : [];
  return {
    reputationTier: typeof visit.reputationTier === 'string' && TIER_IDS.has(visit.reputationTier)
      ? visit.reputationTier as ReputationTierId
      : 'stranger',
    embers: typeof visit.embers === 'number' && Number.isFinite(visit.embers)
      ? Math.max(0, Math.floor(visit.embers))
      : 0,
    offeredRequestIds: Array.from(new Set(offered.filter((id): id is string => (
      typeof id === 'string' && ids.has(id)
    )))),
  };
}

/** One mission attempt at the stall: a restart is a new seed, so a new key. */
export function stallSpendKey(stageId: StageId, seed: number): string {
  return `${stageId}:${seed}`;
}
