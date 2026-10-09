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
import {
  LastMissionReport,
  StoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from './progress';

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
}

/**
 * Pays a finished campaign mission, won or lost: the clear (first or
 * repeat rate), each cleared objective, and secrets never paid before, scaled
 * by difficulty. Settling the same attempt again changes nothing.
 */
export function settleCampaignMission(
  settlement: MissionSettlement
): { progress: StoryProgress; report: LastMissionReport } {
  const progress = loadStoryProgress();
  if (progress.lastMission?.key === settlement.key) {
    return { progress, report: progress.lastMission };
  }
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
    earnings,
  };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency + earnings.total,
    paidClears: settlement.success && firstClear
      ? [...progress.paidClears, settlement.stageId]
      : progress.paidClears,
    paidSecrets: [...progress.paidSecrets, ...newSecrets],
    lastMission: report,
  };
  saveStoryProgress(next);
  return { progress: next, report };
}
