import {
  STORY_PROGRESS_KEY,
  StoryProgress,
  loadStoryProgress,
  saveStoryProgress,
  takeMissionLoadout,
} from './progress';
import {
  buyHubConsumable,
  buyHubUpgrade,
  settleCampaignMission,
  unpackHubConsumable,
} from './hubEconomy';

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

function stored(): StoryProgress {
  return JSON.parse(localStorage.getItem(STORY_PROGRESS_KEY) as string);
}

const leafWin = {
  key: 'hiddenLeaf:101:900',
  stageId: 'hiddenLeaf' as const,
  difficulty: 'normal' as const,
  success: true,
  objectivesCompleted: 3,
  secretIds: ['hiddenLeaf-scroll-cache', 'hiddenLeaf-archive-fragment'],
};

describe('village hub save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('pays a migrated save the repeat rate for clears and secrets it already had', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      version: 3,
      completedStages: ['hiddenLeaf'],
      unlockedStages: ['hiddenLeaf', 'hiddenSand'],
      discoveredSecrets: ['hiddenLeaf-scroll-cache', 'hiddenLeaf-archive-fragment'],
    }));
    const before = loadStoryProgress().currency;
    const { report, progress } = settleCampaignMission(leafWin);
    expect(report.earnings).toEqual({
      clear: 15, objectives: 18, secrets: 0, total: 33,
    });
    expect(progress.currency).toBe(before + 33);
  });

  it('pays a mission once, by clear, objectives and new secrets, scaled by difficulty', () => {
    const first = settleCampaignMission(leafWin);
    // 50 clear + 3 x 6 objectives + scroll 10 + fragment 20.
    expect(first.report.earnings).toEqual({
      clear: 50, objectives: 18, secrets: 30, total: 98,
    });
    expect(first.progress.currency).toBe(98);
    // The same finished attempt (a remount, a second effect run) pays nothing more.
    expect(settleCampaignMission(leafWin).progress.currency).toBe(98);

    // A replay on Hard pays the repeat clear, and the same secrets nothing.
    const replay = settleCampaignMission({ ...leafWin, key: 'replay', difficulty: 'hard' });
    expect(replay.report.earnings).toEqual({
      clear: 19, objectives: 23, secrets: 0, total: 42,
    });

    // A failed attempt still pays its objectives, and a new secret; Story pays less.
    const failed = settleCampaignMission({
      key: 'sand-fail',
      stageId: 'hiddenSand',
      difficulty: 'story',
      success: false,
      objectivesCompleted: 1,
      secretIds: ['hiddenSand-zetsu-burrow'],
    });
    expect(failed.report.earnings).toEqual({
      clear: 0, objectives: 5, secrets: 8, total: 13,
    });
    expect(failed.progress.paidClears).toEqual(['hiddenLeaf']);
    expect(stored().currency).toBe(98 + 42 + 13);
    expect(stored().lastMission?.stageId).toBe('hiddenSand');
  });

  it('buys a consumable into the pack and blocks a purchase without the Embers', () => {
    storeProgress({ currency: 30 });

    const bought = buyHubConsumable('paperWard');
    expect(bought.ok).toBe(true);
    expect(bought.progress.currency).toBe(15);
    expect(stored().pack).toEqual(['paperWard']);

    // 15 Embers left, and the pack (one slot) is full.
    expect(buyHubConsumable('lodestone')).toMatchObject({ ok: false, blocked: 'packFull' });
    // Unpacking before the mission refunds in full, so a choice can be swapped.
    expect(unpackHubConsumable('paperWard').progress).toMatchObject({ currency: 30, pack: [] });
    expect(buyHubConsumable('blastPowder').progress).toMatchObject({ currency: 5, pack: ['blastPowder'] });
    storeProgress({ pack: [], currency: 10 });
    const short = buyHubConsumable('secondWind');
    expect(short).toMatchObject({ ok: false, blocked: 'funds' });
    expect(stored().currency).toBe(10);
    expect(stored().pack).toEqual([]);
    expect(buyHubUpgrade('satchelStrap')).toMatchObject({ ok: false, blocked: 'funds' });
    expect(stored().upgradeRanks).toEqual({});
  });

  it('keeps an upgrade across reloads and missions, up to its cap', () => {
    storeProgress({ currency: 250 });

    expect(buyHubUpgrade('satchelStrap').ok).toBe(true);
    expect(buyHubUpgrade('satchelStrap').ok).toBe(true);
    expect(buyHubUpgrade('satchelStrap')).toMatchObject({ ok: false, blocked: 'maxed' });
    expect(loadStoryProgress().currency).toBe(250 - 70 - 130);
    expect(loadStoryProgress().upgradeRanks).toEqual({ satchelStrap: 2 });

    // Three slots now: a mission takes the pack and leaves the upgrade.
    storeProgress({ currency: 100 });
    expect(buyHubConsumable('paperWard').ok).toBe(true);
    expect(buyHubConsumable('lodestone').ok).toBe(true);
    const { loadout, progress } = takeMissionLoadout();
    expect(loadout).toEqual({
      consumables: ['paperWard', 'lodestone'],
      upgrades: { satchelStrap: 2 },
    });
    expect(progress.pack).toEqual([]);
    expect(loadStoryProgress().pack).toEqual([]);
    expect(takeMissionLoadout().loadout).toEqual({
      consumables: [],
      upgrades: { satchelStrap: 2 },
    });
  });
});
