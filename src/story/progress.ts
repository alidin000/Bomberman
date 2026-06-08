import {
  BossId,
  CampaignFlowStepId,
  CharacterId,
  StageId,
  getCampaignVillage,
  getNextCampaignStageId,
} from '../content';

export type StoryUpgradeId =
  | 'extraClay'
  | 'blastTraining'
  | 'quickUltimate'
  | 'sandGuard';

export interface StoryProgress {
  version: 2;
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
  storyCompleted: boolean;
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
  version: 2,
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
  storyCompleted: false,
};

function migrateStoryProgress(stored: Partial<StoryProgress>): StoryProgress {
  return {
    ...DEFAULT_STORY_PROGRESS,
    ...stored,
    version: 2,
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
    storyCompleted: stored.storyCompleted ?? false,
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

export function getStoryUpgrade(id: StoryUpgradeId): StoryUpgradeDefinition {
  return STORY_UPGRADES.find((upgrade) => upgrade.id === id) ?? STORY_UPGRADES[0];
}
