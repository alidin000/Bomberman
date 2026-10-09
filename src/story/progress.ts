import {
  BossId,
  CampaignFlowStepId,
  CharacterId,
  STAGE_DEFINITIONS,
  StageId,
  getCampaignMission,
  getCampaignVillage,
  getNextCampaignStageId,
} from '../content';
import {
  CampaignLoadout,
  HubConsumableId,
  HubUpgradeId,
  MISSION_REWARDS,
  MissionEarnings,
  computeMissionEarnings,
  isFragmentSecret,
  normalizePack,
  normalizeUpgradeRanks,
} from '../content/hubShop';
import { DifficultyId, isDifficultyId } from '../engine/difficulty';

export type StoryUpgradeId =
  | 'extraClay'
  | 'blastTraining'
  | 'quickUltimate'
  | 'sandGuard';

/** What the last finished campaign mission paid, for the result and the hub. */
export interface LastMissionReport {
  // The finished attempt (seed and tick): a mission is never paid twice.
  key: string;
  stageId: StageId;
  difficulty: DifficultyId;
  success: boolean;
  earnings: MissionEarnings;
}

export const STORY_PROGRESS_VERSION = 4;

export interface StoryProgress {
  version: 4;
  completedBosses: BossId[];
  completedStages: StageId[];
  unlockedCharacters: CharacterId[];
  unlockedStages: StageId[];
  unlockedUpgrades: StoryUpgradeId[];
  selectedUpgrade: StoryUpgradeId;
  lastCharacter: CharacterId;
  lastStage: StageId;
  currentFlowStep: CampaignFlowStepId;
  objectiveProgress: Record<string, {
    current: number;
    target: number;
    status: string;
  }>;
  missionResults: Partial<Record<StageId, 'success' | 'failed'>>;
  fragments: Partial<Record<CharacterId, number>>;
  reputation: Partial<Record<StageId, number>>;
  discoveredSecrets: string[];
  rareScrolls: string[];
  storyCompleted: boolean;
  // v4: the village hub economy.
  currency: number;
  // Consumables packed for the next mission; spent when it deploys.
  pack: HubConsumableId[];
  upgradeRanks: Partial<Record<HubUpgradeId, number>>;
  // Clears and secrets already paid, so replays pay the repeat rate.
  paidClears: StageId[];
  paidSecrets: string[];
  lastMission: LastMissionReport | null;
}

export interface StoryUpgradeDefinition {
  id: StoryUpgradeId;
  name: string;
  description: string;
  effectLabel: string;
}

export const STORY_UPGRADES: StoryUpgradeDefinition[] = [
  {
    id: 'extraClay',
    name: 'Extra Clay Pack',
    description: 'Start each stage with one more bomb slot.',
    effectLabel: '+1 bomb capacity',
  },
  {
    id: 'blastTraining',
    name: 'Blast Control Training',
    description: 'Increase the starting blast range for boss stages.',
    effectLabel: '+1 blast range',
  },
  {
    id: 'quickUltimate',
    name: 'Chakra Focus Drill',
    description: 'Recharge ultimates faster during story runs.',
    effectLabel: 'Ultimate cooldown -25%',
  },
  {
    id: 'sandGuard',
    name: 'Sand Guard Charm',
    description: 'Carry a defensive charm earned from sand trial rewards.',
    effectLabel: 'Story reward slot',
  },
];

export const STORY_PROGRESS_KEY = 'shinobiArenaStoryProgress';

export const DEFAULT_STORY_PROGRESS: StoryProgress = {
  version: 4,
  completedBosses: [],
  completedStages: [],
  unlockedCharacters: ['deidara'],
  unlockedStages: ['hiddenLeaf'],
  unlockedUpgrades: ['extraClay', 'blastTraining', 'quickUltimate'],
  selectedUpgrade: 'extraClay',
  lastCharacter: 'deidara',
  lastStage: 'hiddenLeaf',
  currentFlowStep: 'exploration',
  objectiveProgress: {},
  missionResults: {},
  fragments: {},
  reputation: {},
  discoveredSecrets: [],
  rareScrolls: [],
  storyCompleted: false,
  currency: 0,
  pack: [],
  upgradeRanks: {},
  paidClears: [],
  paidSecrets: [],
  lastMission: null,
};

const STAGE_IDS = new Set<string>(STAGE_DEFINITIONS.map((stage) => stage.id));

function stageList(value: unknown): StageId[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((id): id is StageId => STAGE_IDS.has(id))))
    : [];
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string')))
    : [];
}

function wholeAmount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * A save from before the hub (v3 or older) starts with what its finished
 * villages and found secrets would have paid on Normal, so returning players
 * can use the shop at once. Those clears and secrets then count as paid.
 */
export function getHubBackPay(completedStages: StageId[], discoveredSecrets: string[]): number {
  const clears = completedStages.reduce((total, stageId) => (
    total
      + MISSION_REWARDS.firstClear
      + (getCampaignMission(stageId)?.objectives.length ?? 0) * MISSION_REWARDS.objective
  ), 0);
  const secrets = computeMissionEarnings({
    difficulty: 'normal',
    success: false,
    firstClear: false,
    objectivesCompleted: 0,
    newSecrets: discoveredSecrets.length,
    newFragments: discoveredSecrets.filter(isFragmentSecret).length,
  }).total;
  return clears + secrets;
}

function readLastMission(value: unknown): LastMissionReport | null {
  if (typeof value !== 'object' || value === null) return null;
  const report = value as Partial<LastMissionReport>;
  if (typeof report.key !== 'string' || !report.stageId || !STAGE_IDS.has(report.stageId)) {
    return null;
  }
  const earnings = report.earnings ?? {
    clear: 0, objectives: 0, secrets: 0, total: 0
  };
  return {
    key: report.key,
    stageId: report.stageId,
    difficulty: isDifficultyId(report.difficulty) ? report.difficulty : 'normal',
    success: report.success === true,
    earnings: {
      clear: wholeAmount(earnings.clear),
      objectives: wholeAmount(earnings.objectives),
      secrets: wholeAmount(earnings.secrets),
      total: wholeAmount(earnings.total),
    },
  };
}

function migrateHub(
  stored: Partial<StoryProgress>,
  base: Pick<StoryProgress, 'completedStages' | 'discoveredSecrets'>
): Pick<StoryProgress, 'currency' | 'pack' | 'upgradeRanks' | 'paidClears' | 'paidSecrets' | 'lastMission'> {
  const hubSave = typeof stored.version === 'number' && stored.version >= STORY_PROGRESS_VERSION;
  if (!hubSave) {
    const completed = stageList(base.completedStages);
    const secrets = stringList(base.discoveredSecrets);
    return {
      currency: getHubBackPay(completed, secrets),
      pack: [],
      upgradeRanks: {},
      paidClears: completed,
      paidSecrets: secrets,
      lastMission: null,
    };
  }
  const upgradeRanks = normalizeUpgradeRanks(stored.upgradeRanks);
  return {
    currency: wholeAmount(stored.currency),
    pack: normalizePack(stored.pack, upgradeRanks),
    upgradeRanks,
    paidClears: stageList(stored.paidClears),
    paidSecrets: stringList(stored.paidSecrets),
    lastMission: readLastMission(stored.lastMission),
  };
}

function migrateStoryProgress(stored: Partial<StoryProgress>): StoryProgress {
  const migrated: StoryProgress = {
    ...DEFAULT_STORY_PROGRESS,
    ...stored,
    version: 4,
    completedBosses: stored.completedBosses ?? DEFAULT_STORY_PROGRESS.completedBosses,
    completedStages: stored.completedStages ?? DEFAULT_STORY_PROGRESS.completedStages,
    unlockedCharacters: stored.unlockedCharacters
      ?? DEFAULT_STORY_PROGRESS.unlockedCharacters,
    unlockedStages: stored.unlockedStages ?? DEFAULT_STORY_PROGRESS.unlockedStages,
    unlockedUpgrades: stored.unlockedUpgrades ?? DEFAULT_STORY_PROGRESS.unlockedUpgrades,
    objectiveProgress: stored.objectiveProgress ?? {},
    missionResults: stored.missionResults ?? {},
    fragments: stored.fragments ?? {},
    reputation: stored.reputation ?? {},
    discoveredSecrets: stored.discoveredSecrets ?? [],
    rareScrolls: stored.rareScrolls ?? [],
    storyCompleted: stored.storyCompleted ?? false,
  };
  return {
    ...migrated,
    version: 4,
    ...migrateHub(stored, migrated),
  };
}

export function loadStoryProgress(): StoryProgress {
  const stored = localStorage.getItem(STORY_PROGRESS_KEY);
  if (!stored) return DEFAULT_STORY_PROGRESS;
  try {
    return migrateStoryProgress(JSON.parse(stored));
  } catch {
    return DEFAULT_STORY_PROGRESS;
  }
}

export function saveStoryProgress(progress: StoryProgress): void {
  localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify(progress));
}

export function selectStoryLoadout(
  characterId: CharacterId,
  stageId: StageId,
  upgradeId: StoryUpgradeId
): StoryProgress {
  const progress = loadStoryProgress();
  const next: StoryProgress = {
    ...progress,
    lastCharacter: characterId,
    lastStage: stageId,
    selectedUpgrade: upgradeId,
    currentFlowStep: 'exploration',
  };
  saveStoryProgress(next);
  return next;
}

export function completeBossReward(
  bossId: BossId,
  rewardCharacter?: CharacterId,
  rewardStage?: StageId
): StoryProgress {
  const progress = loadStoryProgress();
  const next: StoryProgress = {
    ...progress,
    completedBosses: Array.from(new Set([...progress.completedBosses, bossId])),
    unlockedCharacters: Array.from(new Set([
      ...progress.unlockedCharacters,
      ...(rewardCharacter ? [rewardCharacter] : []),
    ])),
    unlockedStages: Array.from(new Set([
      ...progress.unlockedStages,
      ...(rewardStage ? [rewardStage] : []),
    ])),
  };
  saveStoryProgress(next);
  return next;
}

export function completeCampaignStage(stageId: StageId, bossId: BossId): StoryProgress {
  const progress = loadStoryProgress();
  const campaignVillage = getCampaignVillage(stageId);
  const nextStageId = getNextCampaignStageId(stageId);
  const next: StoryProgress = {
    ...progress,
    completedBosses: Array.from(new Set([...progress.completedBosses, bossId])),
    completedStages: Array.from(new Set([...progress.completedStages, stageId])),
    missionResults: {
      ...progress.missionResults,
      [stageId]: 'success',
    },
    reputation: {
      ...progress.reputation,
      [stageId]: (progress.reputation[stageId] ?? 0) + 10,
    },
    unlockedCharacters: Array.from(new Set([
      ...progress.unlockedCharacters,
      ...(campaignVillage.rewardCharacter ? [campaignVillage.rewardCharacter] : []),
    ])),
    unlockedStages: Array.from(new Set([
      ...progress.unlockedStages,
      stageId,
      ...(nextStageId ? [nextStageId] : []),
    ])),
    unlockedUpgrades: Array.from(new Set([
      ...progress.unlockedUpgrades,
      ...(campaignVillage.rewardUpgrade ? [campaignVillage.rewardUpgrade] : []),
    ])),
    lastStage: nextStageId ?? stageId,
    currentFlowStep: nextStageId ? 'exploration' : 'reward',
    storyCompleted: !nextStageId,
  };
  saveStoryProgress(next);
  return next;
}

export function recordCampaignDiscoveries(
  stageId: StageId,
  characterId: CharacterId,
  secretIds: string[]
): StoryProgress {
  const progress = loadStoryProgress();
  const nextSecretIds = secretIds.filter((secretId) => (
    !progress.discoveredSecrets.includes(secretId)
  ));
  if (nextSecretIds.length === 0) return progress;

  const fragmentCount = nextSecretIds.filter((secretId) => (
    secretId.includes('archive-fragment')
  )).length;
  const rareScrolls = nextSecretIds.filter((secretId) => (
    secretId.includes('scroll-cache')
  ));
  const next: StoryProgress = {
    ...progress,
    discoveredSecrets: Array.from(new Set([
      ...progress.discoveredSecrets,
      ...nextSecretIds,
    ])),
    rareScrolls: Array.from(new Set([
      ...progress.rareScrolls,
      ...rareScrolls,
    ])),
    fragments: fragmentCount > 0
      ? {
        ...progress.fragments,
        [characterId]: (progress.fragments[characterId] ?? 0) + fragmentCount,
      }
      : progress.fragments,
    reputation: {
      ...progress.reputation,
      [stageId]: (progress.reputation[stageId] ?? 0) + nextSecretIds.length,
    },
  };
  saveStoryProgress(next);
  return next;
}

export function getStoryUpgrade(id: StoryUpgradeId): StoryUpgradeDefinition {
  return STORY_UPGRADES.find((upgrade) => upgrade.id === id) ?? STORY_UPGRADES[0];
}

/**
 * What a mission deploys with: the packed consumables (now spent, so the pack
 * is empty afterwards) and the permanent upgrade ranks.
 */
export function takeMissionLoadout(): { progress: StoryProgress; loadout: CampaignLoadout } {
  const progress = loadStoryProgress();
  const loadout: CampaignLoadout = {
    consumables: [...progress.pack],
    upgrades: { ...progress.upgradeRanks },
  };
  if (progress.pack.length === 0) return { progress, loadout };
  const next: StoryProgress = { ...progress, pack: [] };
  saveStoryProgress(next);
  return { progress: next, loadout };
}
