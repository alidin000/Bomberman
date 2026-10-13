// What the save hands a solo campaign mission about its village square
// (GameConfig.village): the standing tier, the Embers the stall may take, the
// requests on the board, and (render only) the village's rebuild stage and
// the scarf the player wears. Worked out before INIT, so the match replays the
// same way. Shared by the launch path, the hub's previews and the match screen.
import type { StageId } from '../content/types';
import { CAMPAIGN_VILLAGES } from '../content/campaign';
import {
  HONORED_COSMETIC_TIER,
  type CampaignRequestDefinition,
  type RepairStage,
  type ReputationTierId,
  type ScarfId,
  type VillageVisitConfig,
} from '../content/villageSquare';
import { VILLAGE_REQUESTS } from '../content/villageRequests';
import {
  ReputationTier,
  nextReputationTier,
  repairStageFor,
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

/** The scarves the save can wear: ember from Honored, each claimed village's. */
export function unlockedScarves(
  progress: Pick<StoryProgress, 'reputation' | 'claimedSecretSets'>
): ScarfId[] {
  const ember = tierAtLeast(getVillageStanding(progress).tier.id, HONORED_COSMETIC_TIER);
  return [
    ...(ember ? ['ember' as const] : []),
    ...CAMPAIGN_VILLAGES
      .map((village) => village.stageId)
      .filter((stageId) => progress.claimedSecretSets.includes(stageId)),
  ];
}

/** The scarf the next mission wears: the chosen one, while it is unlocked. */
export function wornScarf(
  progress: Pick<StoryProgress, 'reputation' | 'claimedSecretSets' | 'scarf'>
): ScarfId | undefined {
  return progress.scarf && unlockedScarves(progress).includes(progress.scarf)
    ? progress.scarf
    : undefined;
}

/** How far a village has rebuilt, from its own reputation. */
export function villageRepairStage(
  stageId: StageId,
  progress: Pick<StoryProgress, 'reputation'>
): RepairStage {
  return repairStageFor(progress.reputation[stageId] ?? 0);
}

export function buildVillageVisit(stageId: StageId, progress: StoryProgress): VillageVisitConfig {
  const scarf = wornScarf(progress);
  return {
    reputationTier: getVillageStanding(progress).tier.id,
    embers: progress.currency,
    offeredRequestIds: getOfferedRequests(stageId, progress).map((request) => request.id),
    repairStage: villageRepairStage(stageId, progress),
    ...(scarf ? { scarf } : {}),
  };
}

const STAGE_IDS = new Set<string>(CAMPAIGN_VILLAGES.map((village) => village.stageId));

function readRepairStage(value: unknown): RepairStage | undefined {
  return value === 0 || value === 1 || value === 2 || value === 3 ? value : undefined;
}

function readScarf(value: unknown): ScarfId | undefined {
  return value === 'ember' || (typeof value === 'string' && STAGE_IDS.has(value))
    ? value as ScarfId
    : undefined;
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
    ...(readRepairStage(visit.repairStage) !== undefined
      ? { repairStage: readRepairStage(visit.repairStage) }
      : {}),
    ...(readScarf(visit.scarf) ? { scarf: readScarf(visit.scarf) } : {}),
  };
}

/** One mission attempt at the stall: a restart is a new seed, so a new key. */
export function stallSpendKey(stageId: StageId, seed: number): string {
  return `${stageId}:${seed}`;
}
