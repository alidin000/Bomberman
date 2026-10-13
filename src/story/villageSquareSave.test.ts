import {
  DEFAULT_STORY_PROGRESS,
  STORY_PROGRESS_KEY,
  StoryProgress,
  loadStoryProgress,
  saveStoryProgress,
} from './progress';
import { recordStallSpend, settleCampaignMission } from './hubEconomy';
import {
  buildVillageVisit,
  getOfferedRequests,
  getVillageStanding,
  normalizeVillageVisit,
} from './villageVisit';

function storeProgress(changes: Partial<StoryProgress>): void {
  saveStoryProgress({ ...loadStoryProgress(), ...changes });
}

const leafRun = {
  key: 'hiddenLeaf:7:1200',
  stageId: 'hiddenLeaf' as const,
  difficulty: 'normal' as const,
  objectivesCompleted: 0,
  secretIds: [],
};

describe('village square save', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('moves a v4 save to v5 without paying the hub back pay a second time', () => {
    localStorage.setItem(STORY_PROGRESS_KEY, JSON.stringify({
      ...DEFAULT_STORY_PROGRESS,
      version: 4,
      completedStages: ['hiddenLeaf'],
      paidClears: ['hiddenLeaf'],
      currency: 37,
    }));
    const progress = loadStoryProgress();
    expect(progress.version).toBe(5);
    // A v4 save already has the hub economy: its balance stays as it was.
    expect(progress.currency).toBe(37);
    expect(progress.completedRequests).toEqual([]);
    expect(progress.stallSpend).toBeNull();
  });

  it('pays finished requests, Embers and village reputation, only when the mission is won', () => {
    storeProgress({ currency: 5, reputation: { hiddenLeaf: 3 } });
    const lost = settleCampaignMission({
      ...leafRun, key: 'hiddenLeaf:7:500', success: false, completedRequestIds: ['leaf-tea-tins'],
    });
    expect(lost.report.requests).toBeUndefined();
    expect(lost.progress.completedRequests).toEqual([]);
    expect(lost.progress.reputation.hiddenLeaf).toBe(3);

    const won = settleCampaignMission({
      ...leafRun,
      success: true,
      // A request of another village cannot be paid by this mission.
      completedRequestIds: ['leaf-tea-tins', 'sand-well-buckets'],
    });
    expect(won.report.requests).toEqual([{ id: 'leaf-tea-tins', embers: 10, reputation: 2 }]);
    // First clear 50, plus the tea tins' 10.
    expect(won.report.earnings).toMatchObject({ clear: 50, requests: 10, total: 60 });
    expect(won.progress.currency).toBe(lost.progress.currency + 60);
    expect(won.progress.reputation.hiddenLeaf).toBe(5);
    expect(won.progress.completedRequests).toEqual(['leaf-tea-tins']);
    // Finished requests are never offered (or paid) again.
    expect(getOfferedRequests('hiddenLeaf', won.progress).map((item) => item.id))
      .not.toContain('leaf-tea-tins');
    const again = settleCampaignMission({
      ...leafRun, key: 'hiddenLeaf:9:800', success: true, completedRequestIds: ['leaf-tea-tins'],
    });
    expect(again.report.requests).toBeUndefined();
  });

  it('saves the stall spend as it happens, once per attempt, whatever the result', () => {
    storeProgress({ currency: 100 });
    expect(recordStallSpend({ key: 'hiddenLeaf:7', amount: 25 }).currency).toBe(75);
    // The same total seen again (another publish, a remount) is not paid twice.
    expect(recordStallSpend({ key: 'hiddenLeaf:7', amount: 25 }).currency).toBe(75);
    // A second purchase in the same attempt pays only the difference.
    expect(recordStallSpend({ key: 'hiddenLeaf:7', amount: 40 }).currency).toBe(60);
    // It is in storage straight away: a reload keeps the deduction.
    expect(loadStoryProgress().currency).toBe(60);
    // A failed mission keeps it spent, and settling does not take it twice.
    const lost = settleCampaignMission({
      ...leafRun, success: false, stallSpend: { key: 'hiddenLeaf:7', amount: 40 },
    });
    expect(lost.progress.currency).toBe(60 + lost.report.earnings.total);
    // A restart is a new attempt with its own spend.
    expect(recordStallSpend({ key: 'hiddenLeaf:8', amount: 15 }).currency)
      .toBe(lost.progress.currency - 15);
  });

  it('settling catches up stall spend the save missed', () => {
    storeProgress({ currency: 50 });
    const { progress, report } = settleCampaignMission({
      ...leafRun, success: false, stallSpend: { key: 'hiddenLeaf:7', amount: 15 },
    });
    expect(progress.currency).toBe(50 - 15 + report.earnings.total);
  });

  it('offers the board by standing, and builds the visit from the save', () => {
    const fresh = loadStoryProgress();
    expect(getOfferedRequests('hiddenLeaf', fresh).map((item) => item.id)).toEqual(['leaf-tea-tins']);
    // Standing adds up every village: 10 + 5 reaches Known.
    const known = { ...fresh, reputation: { hiddenLeaf: 10, hiddenSand: 5 }, currency: 44 };
    expect(getVillageStanding(known)).toMatchObject({ standing: 15, next: { id: 'trusted' } });
    expect(buildVillageVisit('hiddenLeaf', known)).toEqual({
      reputationTier: 'known',
      embers: 44,
      offeredRequestIds: ['leaf-tea-tins', 'leaf-old-logs'],
    });
    const trusted = { ...known, reputation: { hiddenLeaf: 40 }, completedRequests: ['leaf-tea-tins'] };
    expect(buildVillageVisit('hiddenLeaf', trusted).offeredRequestIds)
      .toEqual(['leaf-old-logs', 'leaf-clean-run']);
  });

  it('reads a stored visit back as untrusted data', () => {
    expect(normalizeVillageVisit({
      reputationTier: 'legend',
      embers: -4.5,
      offeredRequestIds: ['leaf-tea-tins', 'sand-cache', 7, 'leaf-tea-tins'],
    }, 'hiddenLeaf')).toEqual({
      reputationTier: 'stranger', embers: 0, offeredRequestIds: ['leaf-tea-tins'],
    });
    expect(normalizeVillageVisit(null, 'hiddenLeaf')).toBeUndefined();
  });
});
