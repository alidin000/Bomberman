import { BossId, CharacterId, StageId } from '../content';

export type StoryUpgradeId =
  | 'extraClay'
  | 'blastTraining'
  | 'quickUltimate'
  | 'sandGuard';

export interface StoryProgress {
  version: 1;
  completedBosses: BossId[];
  unlockedCharacters: CharacterId[];
  unlockedStages: StageId[];
  unlockedUpgrades: StoryUpgradeId[];
  selectedUpgrade: StoryUpgradeId;
  lastCharacter: CharacterId;
  lastStage: StageId;
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
  version: 1,
  completedBosses: [],
  unlockedCharacters: ['deidara', 'naruto', 'sasuke'],
  unlockedStages: ['hiddenSand', 'hiddenLeaf', 'hiddenMist'],
  unlockedUpgrades: ['extraClay', 'blastTraining', 'quickUltimate'],
  selectedUpgrade: 'extraClay',
  lastCharacter: 'deidara',
  lastStage: 'hiddenSand',
};

export function loadStoryProgress(): StoryProgress {
  const stored = localStorage.getItem(STORY_PROGRESS_KEY);
  if (!stored) return DEFAULT_STORY_PROGRESS;
  try {
    return {
      ...DEFAULT_STORY_PROGRESS,
      ...JSON.parse(stored),
    };
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
  const next = {
    ...progress,
    lastCharacter: characterId,
    lastStage: stageId,
    selectedUpgrade: upgradeId,
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
  const next = {
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

export function getStoryUpgrade(id: StoryUpgradeId): StoryUpgradeDefinition {
  return STORY_UPGRADES.find((upgrade) => upgrade.id === id) ?? STORY_UPGRADES[0];
}
