import {
  DEFAULT_STORY_PROGRESS,
  STORY_PROGRESS_KEY,
  StoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from './progress';
import {
  chooseScarf, claimSecretSet, markSceneSeen, scarfOptions,
} from './villageRewards';
import { buildVillageVisit, normalizeVillageVisit } from './villageVisit';

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

const LEAF_SECRETS = ['hiddenLeaf-scroll-cache', 'hiddenLeaf-archive-fragment', 'hiddenLeaf-zetsu-burrow'];

describe('secrets, scarves and story in the save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moves a v5 save to v6: an Honored save keeps its ember scarf, cleared villages\' scenes count as seen', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...DEFAULT_STORY_PROGRESS,
      version: 5,
      completedStages: ['hiddenLeaf', 'hiddenSand'],
      reputation: { hiddenLeaf: 50, hiddenSand: 30 },
      discoveredSecrets: LEAF_SECRETS,
      claimedSecretSets: undefined,
      scarf: undefined,
      seenScenes: undefined,
    }));
    const progress = loadStoryProgress();
    expect(progress.version).toBe(6);
    expect(progress.scarf).toBe('ember');
    expect(progress.seenScenes).toEqual([
      'hiddenLeaf:before', 'hiddenLeaf:after', 'hiddenSand:before', 'hiddenSand:after',
    ]);
    // A set found before v6 is ready to claim, not paid already.
    expect(progress.claimedSecretSets).toEqual([]);
    expect(claimSecretSet('hiddenLeaf').ok).toBe(true);
  });

  it('reads stored v6 fields as untrusted data', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...DEFAULT_STORY_PROGRESS,
      claimedSecretSets: ['hiddenLeaf', 'atlantis', 4, 'hiddenLeaf'],
      scarf: 'cape',
      seenScenes: ['hiddenMist:before', 'hiddenMist:middle', 9],
    }));
    const progress = loadStoryProgress();
    expect(progress.claimedSecretSets).toEqual(['hiddenLeaf']);
    expect(progress.scarf).toBeNull();
    expect(progress.seenScenes).toEqual(['hiddenMist:before']);
    // A v5 save below Honored starts with no scarf.
    localStorage.setItem(
      STORY_PROGRESS_KEY,
      JSON.stringify({ ...DEFAULT_STORY_PROGRESS, version: 5 })
    );
    expect(loadStoryProgress().scarf).toBeNull();
  });

  it('pays a village\'s set reward once, only when all three of its secrets are found', () => {
    storeProgress({ currency: 12, discoveredSecrets: LEAF_SECRETS.slice(0, 2) });
    const early = claimSecretSet('hiddenLeaf');
    expect(early.ok).toBe(false);
    expect(early.progress.currency).toBe(12);

    storeProgress({ discoveredSecrets: LEAF_SECRETS });
    const claimed = claimSecretSet('hiddenLeaf');
    expect(claimed.ok).toBe(true);
    expect(claimed.progress.currency).toBe(42);
    expect(loadStoryProgress().claimedSecretSets).toEqual(['hiddenLeaf']);

    const again = claimSecretSet('hiddenLeaf');
    expect(again.ok).toBe(false);
    expect(loadStoryProgress().currency).toBe(42);
  });

  it('wears only unlocked scarves, and the mission config carries the scarf and the rebuild stage', () => {
    // Locked: no Honored standing, no set claimed.
    expect(chooseScarf('ember').scarf).toBeNull();
    expect(chooseScarf('hiddenLeaf').scarf).toBeNull();
    expect(scarfOptions(loadStoryProgress()).filter((option) => option.unlocked)
      .map((option) => option.id)).toEqual([null]);

    storeProgress({ discoveredSecrets: LEAF_SECRETS, reputation: { hiddenLeaf: 23 } });
    claimSecretSet('hiddenLeaf');
    expect(chooseScarf('hiddenLeaf').scarf).toBe('hiddenLeaf');
    expect(buildVillageVisit('hiddenSand', loadStoryProgress())).toMatchObject({
      // Sand has no reputation yet: damaged. The scarf is worn everywhere.
      repairStage: 0,
      scarf: 'hiddenLeaf',
    });
    expect(buildVillageVisit('hiddenLeaf', loadStoryProgress()).repairStage).toBe(2);

    storeProgress({ reputation: { hiddenLeaf: 80 } });
    expect(chooseScarf('ember').scarf).toBe('ember');
    expect(chooseScarf(null).scarf).toBeNull();
    expect(buildVillageVisit('hiddenLeaf', loadStoryProgress())).not.toHaveProperty('scarf');
  });

  it('keeps the render-only visit fields through a stored setup, and drops bad ones', () => {
    expect(normalizeVillageVisit({
      reputationTier: 'known', embers: 5, offeredRequestIds: [], repairStage: 3, scarf: 'hiddenMist',
    }, 'hiddenLeaf')).toEqual({
      reputationTier: 'known', embers: 5, offeredRequestIds: [], repairStage: 3, scarf: 'hiddenMist',
    });
    expect(normalizeVillageVisit({
      reputationTier: 'known', embers: 5, offeredRequestIds: [], repairStage: 7, scarf: 'cape',
    }, 'hiddenLeaf')).toEqual({ reputationTier: 'known', embers: 5, offeredRequestIds: [] });
  });

  it('marks a scene seen once', () => {
    markSceneSeen('hiddenLeaf:before');
    markSceneSeen('hiddenLeaf:before');
    expect(loadStoryProgress().seenScenes).toEqual(['hiddenLeaf:before']);
  });
});
