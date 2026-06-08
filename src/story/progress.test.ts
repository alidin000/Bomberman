import {
  STORY_PROGRESS_KEY,
  completeCampaignStage,
  loadStoryProgress,
  selectStoryLoadout,
} from './progress';

describe('story progress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts campaign at Hidden Leaf with only the starter route unlocked', () => {
    const progress = loadStoryProgress();

    expect(progress.lastStage).toBe('hiddenLeaf');
    expect(progress.unlockedStages).toEqual(['hiddenLeaf']);
    expect(progress.unlockedCharacters).toEqual(['deidara']);
    expect(progress.version).toBe(2);
    expect(progress.objectiveProgress).toEqual({});
    expect(progress.missionResults).toEqual({});
    expect(progress.fragments).toEqual({});
    expect(progress.reputation).toEqual({});
    expect(progress.storyCompleted).toBe(false);
  });

  it('saves selected campaign loadout as the active exploration step', () => {
    const progress = selectStoryLoadout('naruto', 'hiddenLeaf', 'blastTraining');

    expect(progress.lastCharacter).toBe('naruto');
    expect(progress.lastStage).toBe('hiddenLeaf');
    expect(progress.selectedUpgrade).toBe('blastTraining');
    expect(progress.currentFlowStep).toBe('exploration');
  });

  it('unlocks route rewards and advances the resume village after boss victory', () => {
    const progress = completeCampaignStage('hiddenCloud', 'gyuki');

    expect(progress.completedBosses).toContain('gyuki');
    expect(progress.completedStages).toContain('hiddenCloud');
    expect(progress.unlockedCharacters).toContain('minato');
    expect(progress.unlockedStages).toContain('hiddenStone');
    expect(progress.missionResults.hiddenCloud).toBe('success');
    expect(progress.reputation.hiddenCloud).toBe(10);
    expect(progress.lastStage).toBe('hiddenStone');
    expect(progress.currentFlowStep).toBe('exploration');
  });

  it('marks the story complete after the Great Shinobi War reward step', () => {
    const progress = completeCampaignStage('greatShinobiWar', 'kurama');

    expect(progress.completedBosses).toContain('kurama');
    expect(progress.completedStages).toContain('greatShinobiWar');
    expect(progress.lastStage).toBe('greatShinobiWar');
    expect(progress.currentFlowStep).toBe('reward');
    expect(progress.storyCompleted).toBe(true);
  });

  it('keeps older local saves compatible with campaign route fields', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: 1,
      completedBosses: ['shukaku'],
      unlockedCharacters: ['deidara'],
      unlockedStages: ['hiddenSand'],
      unlockedUpgrades: ['extraClay'],
      selectedUpgrade: 'extraClay',
      lastCharacter: 'deidara',
      lastStage: 'hiddenSand',
    }));

    const progress = loadStoryProgress();

    expect(progress.completedStages).toEqual([]);
    expect(progress.currentFlowStep).toBe('exploration');
    expect(progress.completedBosses).toEqual(['shukaku']);
    expect(progress.version).toBe(2);
    expect(progress.objectiveProgress).toEqual({});
    expect(progress.missionResults).toEqual({});
    expect(progress.fragments).toEqual({});
    expect(progress.reputation).toEqual({});
    expect(progress.storyCompleted).toBe(false);
  });
});
