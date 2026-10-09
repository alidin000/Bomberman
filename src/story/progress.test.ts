import {
  STORY_PROGRESS_KEY,
  completeCampaignStage,
  loadStoryProgress,
  recordCampaignDiscoveries,
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
    expect(progress.version).toBe(4);
    expect(progress.objectiveProgress).toEqual({});
    expect(progress.missionResults).toEqual({});
    expect(progress.fragments).toEqual({});
    expect(progress.reputation).toEqual({});
    expect(progress.discoveredSecrets).toEqual([]);
    expect(progress.rareScrolls).toEqual([]);
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
    expect(progress.version).toBe(4);
    expect(progress.objectiveProgress).toEqual({});
    expect(progress.missionResults).toEqual({});
    expect(progress.fragments).toEqual({});
    expect(progress.reputation).toEqual({});
    expect(progress.discoveredSecrets).toEqual([]);
    expect(progress.rareScrolls).toEqual([]);
    expect(progress.storyCompleted).toBe(false);
  });

  it('persists discovered scrolls and fragments only once', () => {
    let progress = recordCampaignDiscoveries('hiddenLeaf', 'naruto', [
      'hiddenLeaf-scroll-cache',
      'hiddenLeaf-archive-fragment',
    ]);

    expect(progress.discoveredSecrets).toEqual([
      'hiddenLeaf-scroll-cache',
      'hiddenLeaf-archive-fragment',
    ]);
    expect(progress.rareScrolls).toEqual(['hiddenLeaf-scroll-cache']);
    expect(progress.fragments.naruto).toBe(1);
    expect(progress.reputation.hiddenLeaf).toBe(2);

    progress = recordCampaignDiscoveries('hiddenLeaf', 'naruto', [
      'hiddenLeaf-scroll-cache',
      'hiddenLeaf-archive-fragment',
    ]);

    expect(progress.fragments.naruto).toBe(1);
    expect(progress.reputation.hiddenLeaf).toBe(2);
  });
});

describe('story progress v4 (village hub)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates a v3 save to v4 without losing progress, with back pay for what it earned', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: 3,
      completedBosses: ['kurama', 'shukaku'],
      completedStages: ['hiddenLeaf', 'hiddenSand'],
      unlockedCharacters: ['deidara', 'naruto', 'gaara'],
      unlockedStages: ['hiddenLeaf', 'hiddenSand', 'hiddenMist'],
      unlockedUpgrades: ['extraClay', 'blastTraining', 'quickUltimate'],
      selectedUpgrade: 'blastTraining',
      lastCharacter: 'gaara',
      lastStage: 'hiddenMist',
      currentFlowStep: 'exploration',
      objectiveProgress: {},
      missionResults: { hiddenLeaf: 'success', hiddenSand: 'success' },
      fragments: { naruto: 1 },
      reputation: { hiddenLeaf: 12, hiddenSand: 10 },
      discoveredSecrets: ['hiddenLeaf-scroll-cache', 'hiddenLeaf-archive-fragment'],
      rareScrolls: ['hiddenLeaf-scroll-cache'],
      storyCompleted: false,
    }));

    const progress = loadStoryProgress();

    expect(progress.version).toBe(4);
    // Everything the old save held is still there.
    expect(progress.completedStages).toEqual(['hiddenLeaf', 'hiddenSand']);
    expect(progress.unlockedCharacters).toEqual(['deidara', 'naruto', 'gaara']);
    expect(progress.lastStage).toBe('hiddenMist');
    expect(progress.lastCharacter).toBe('gaara');
    expect(progress.fragments).toEqual({ naruto: 1 });
    expect(progress.reputation.hiddenLeaf).toBe(12);
    expect(progress.rareScrolls).toEqual(['hiddenLeaf-scroll-cache']);
    // Two cleared villages (50 + 4 objectives x 6 each) and a scroll (10)
    // plus a fragment (20), at the Normal rate.
    expect(progress.currency).toBe(2 * 74 + 10 + 20);
    expect(progress.paidClears).toEqual(['hiddenLeaf', 'hiddenSand']);
    expect(progress.paidSecrets).toEqual(progress.discoveredSecrets);
    expect(progress.pack).toEqual([]);
    expect(progress.upgradeRanks).toEqual({});
  });

  it('starts a v1 save with no hub fields at zero and keeps a v4 save within its caps', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: 1,
      completedBosses: ['shukaku'],
      unlockedStages: ['hiddenSand'],
      lastStage: 'hiddenSand',
    }));
    expect(loadStoryProgress().currency).toBe(0);

    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...loadStoryProgress(),
      currency: -40,
      pack: ['paperWard', 'paperWard', 'mysteryBox', 'secondWind'],
      upgradeRanks: { satchelStrap: 7, lanternOil: 'lots', unknown: 2 },
    }));
    const progress = loadStoryProgress();
    expect(progress.currency).toBe(0);
    expect(progress.upgradeRanks).toEqual({ satchelStrap: 2 });
    // Three slots at Satchel Strap rank 2, one of each item.
    expect(progress.pack).toEqual(['paperWard', 'secondWind']);
  });
});
