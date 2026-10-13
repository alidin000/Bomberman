// The village hub economy over the saved progress: buying and unpacking in
// the shop, and paying out a finished campaign mission. Only the hub and the
// match screen use it, so it stays out of the first-load bundle.
import {
  HubConsumableId,
  HubUpgradeId,
  clampUpgradeRank,
  computeMissionEarnings,
  getHubConsumable,
  getHubUpgrade,
  getPackSlots,
  getUpgradeCap,
  isFragmentSecret,
} from '../content/hubShop';
import type { StageId } from '../content';
import type { DifficultyId } from '../engine/difficulty';
import { VILLAGE_REQUESTS, getVillageRequest } from '../content/villageRequests';
import {
  LastMissionReport,
  MissionRequestReward,
  StallSpendRecord,
  StoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from './progress';

// Which village asks each board request.
const VILLAGE_REQUEST_STAGE = new Map<string, StageId>(
  (Object.keys(VILLAGE_REQUESTS) as StageId[]).flatMap((stageId) => (
    VILLAGE_REQUESTS[stageId].map((request) => [request.id, stageId] as [string, StageId])
  ))
);

export type PurchaseBlock = 'funds' | 'packFull' | 'packed' | 'maxed';

export interface PurchaseResult {
  ok: boolean;
  /** Why the purchase did not happen. */
  blocked?: PurchaseBlock;
  progress: StoryProgress;
}

/** Why a consumable cannot be bought right now, or null if it can. */
export function getConsumableBlock(
  progress: StoryProgress,
  id: HubConsumableId
): PurchaseBlock | null {
  if (progress.pack.includes(id)) return 'packed';
  if (progress.pack.length >= getPackSlots(progress.upgradeRanks)) return 'packFull';
  if (progress.currency < getHubConsumable(id).price) return 'funds';
  return null;
}

/** The price of an upgrade's next rank, or null once it is at its cap. */
export function getNextUpgradePrice(progress: StoryProgress, id: HubUpgradeId): number | null {
  const rank = clampUpgradeRank(id, progress.upgradeRanks[id]);
  return rank >= getUpgradeCap(id) ? null : getHubUpgrade(id).prices[rank];
}

export function getUpgradeBlock(progress: StoryProgress, id: HubUpgradeId): PurchaseBlock | null {
  const price = getNextUpgradePrice(progress, id);
  if (price === null) return 'maxed';
  if (progress.currency < price) return 'funds';
  return null;
}

/** Packs one consumable for the next mission, if it is affordable and fits. */
export function buyHubConsumable(id: HubConsumableId): PurchaseResult {
  const progress = loadStoryProgress();
  const blocked = getConsumableBlock(progress, id);
  if (blocked) return { ok: false, blocked, progress };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency - getHubConsumable(id).price,
    pack: [...progress.pack, id],
  };
  saveStoryProgress(next);
  return { ok: true, progress: next };
}

/** Takes a packed consumable back out before the mission, for a full refund. */
export function unpackHubConsumable(id: HubConsumableId): PurchaseResult {
  const progress = loadStoryProgress();
  if (!progress.pack.includes(id)) return { ok: false, progress };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency + getHubConsumable(id).price,
    pack: progress.pack.filter((item) => item !== id),
  };
  saveStoryProgress(next);
  return { ok: true, progress: next };
}

/** Buys the next rank of a permanent upgrade, if it is affordable and below its cap. */
export function buyHubUpgrade(id: HubUpgradeId): PurchaseResult {
  const progress = loadStoryProgress();
  const blocked = getUpgradeBlock(progress, id);
  const price = getNextUpgradePrice(progress, id);
  if (blocked || price === null) return { ok: false, blocked: blocked ?? 'maxed', progress };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency - price,
    upgradeRanks: {
      ...progress.upgradeRanks,
      [id]: clampUpgradeRank(id, progress.upgradeRanks[id]) + 1,
    },
  };
  saveStoryProgress(next);
  return { ok: true, progress: next };
}

export interface MissionSettlement {
  // The finished attempt; the same key is never paid twice.
  key: string;
  stageId: StageId;
  difficulty: DifficultyId;
  success: boolean;
  objectivesCompleted: number;
  // Every secret found during the mission.
  secretIds: string[];
  // Board requests the mission finished; they pay only on success.
  completedRequestIds?: string[];
  // What the village square's stall took this attempt (already saved as it
  // happened; settling catches up anything the save missed).
  stallSpend?: StallSpendRecord;
}

/**
 * The stall's spend for one attempt, saved the moment the match shows it:
 * only the part not saved before for this attempt leaves the balance, so
 * saving the same total twice changes nothing. A reload keeps the deduction.
 */
export function applyStallSpend(progress: StoryProgress, spend: StallSpendRecord): StoryProgress {
  const amount = Math.max(0, Math.floor(spend.amount));
  const before = progress.stallSpend?.key === spend.key ? progress.stallSpend.amount : 0;
  if (amount <= before) return progress;
  return {
    ...progress,
    currency: Math.max(0, progress.currency - (amount - before)),
    stallSpend: { key: spend.key, amount },
  };
}

export function recordStallSpend(spend: StallSpendRecord): StoryProgress {
  const progress = loadStoryProgress();
  const next = applyStallSpend(progress, spend);
  if (next !== progress) saveStoryProgress(next);
  return next;
}

/** This village's finished requests not paid before, with their rewards. */
function newRequestRewards(
  progress: StoryProgress,
  stageId: StageId,
  requestIds: readonly string[]
): MissionRequestReward[] {
  return Array.from(new Set(requestIds)).flatMap((id) => {
    const request = getVillageRequest(id);
    if (!request || progress.completedRequests.includes(id)) return [];
    if (VILLAGE_REQUEST_STAGE.get(id) !== stageId) return [];
    return [{ id, embers: request.reward.embers, reputation: request.reward.reputation }];
  });
}

/**
 * Pays a finished campaign mission, won or lost: the clear (first or
 * repeat rate), each cleared objective, and secrets never paid before, scaled
 * by difficulty. Settling the same attempt again changes nothing.
 */
export function settleCampaignMission(
  settlement: MissionSettlement
): { progress: StoryProgress; report: LastMissionReport } {
  const stored = loadStoryProgress();
  if (stored.lastMission?.key === settlement.key) {
    return { progress: stored, report: stored.lastMission };
  }
  const progress = settlement.stallSpend ? applyStallSpend(stored, settlement.stallSpend) : stored;
  // Requests pay their Embers and village reputation on a won mission only.
  const requests = settlement.success
    ? newRequestRewards(progress, settlement.stageId, settlement.completedRequestIds ?? [])
    : [];
  const requestEmbers = requests.reduce((sum, item) => sum + item.embers, 0);
  const requestReputation = requests.reduce((sum, item) => sum + item.reputation, 0);
  const newSecrets = Array.from(new Set(settlement.secretIds))
    .filter((secretId) => !progress.paidSecrets.includes(secretId));
  const firstClear = !progress.paidClears.includes(settlement.stageId);
  const earnings = computeMissionEarnings({
    difficulty: settlement.difficulty,
    success: settlement.success,
    firstClear,
    objectivesCompleted: settlement.objectivesCompleted,
    newSecrets: newSecrets.length,
    newFragments: newSecrets.filter(isFragmentSecret).length,
  });
  const report: LastMissionReport = {
    key: settlement.key,
    stageId: settlement.stageId,
    difficulty: settlement.difficulty,
    success: settlement.success,
    earnings: requestEmbers > 0
      ? { ...earnings, requests: requestEmbers, total: earnings.total + requestEmbers }
      : earnings,
    ...(requests.length ? { requests } : {}),
  };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency + report.earnings.total,
    completedRequests: requests.length
      ? [...progress.completedRequests, ...requests.map((item) => item.id)]
      : progress.completedRequests,
    reputation: requestReputation > 0
      ? {
        ...progress.reputation,
        [settlement.stageId]: (progress.reputation[settlement.stageId] ?? 0) + requestReputation,
      }
      : progress.reputation,
    paidClears: settlement.success && firstClear
      ? [...progress.paidClears, settlement.stageId]
      : progress.paidClears,
    paidSecrets: [...progress.paidSecrets, ...newSecrets],
    lastMission: report,
  };
  saveStoryProgress(next);
  return { progress: next, report };
}
