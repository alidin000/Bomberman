// Secrets, scarves and story over the saved progress: claiming a village's
// three-secret set, choosing the scarf the shinobi wears, and marking story
// scenes seen. Only the hub uses these, so they stay out of the first load.
import { CAMPAIGN_VILLAGES } from '../content/campaign';
import type { StageId } from '../content/types';
import type { ScarfId } from '../content/villageSquare';
import { SECRET_SET_REWARD, secretSetProgress } from '../content/villageSecrets';
import { StoryProgress, loadStoryProgress, saveStoryProgress } from './progress';
import { unlockedScarves } from './villageVisit';

export interface ScarfOption {
  id: ScarfId | null;
  unlocked: boolean;
  // How it is earned, while it is not.
  needs: string | null;
}

/** None, the ember scarf, then one per village in campaign order. */
export function scarfOptions(
  progress: Pick<StoryProgress, 'reputation' | 'claimedSecretSets'>
): ScarfOption[] {
  const unlocked = unlockedScarves(progress);
  return [
    { id: null, unlocked: true, needs: null },
    { id: 'ember', unlocked: unlocked.includes('ember'), needs: 'Reach Honored standing' },
    ...CAMPAIGN_VILLAGES.map((village) => ({
      id: village.stageId,
      unlocked: unlocked.includes(village.stageId),
      needs: 'Find and claim all three of its secrets',
    })),
  ];
}

export interface ClaimResult {
  ok: boolean;
  progress: StoryProgress;
}

/**
 * Pays a village's set reward once: its three secrets found, not yet
 * claimed. The Embers go to the purse and the village's scarf unlocks.
 */
export function claimSecretSet(stageId: StageId): ClaimResult {
  const progress = loadStoryProgress();
  const set = secretSetProgress(stageId, progress.discoveredSecrets, progress.claimedSecretSets);
  if (set.state !== 'ready') return { ok: false, progress };
  const next: StoryProgress = {
    ...progress,
    currency: progress.currency + SECRET_SET_REWARD.embers,
    claimedSecretSets: [...progress.claimedSecretSets, stageId],
  };
  saveStoryProgress(next);
  return { ok: true, progress: next };
}

/** Wears a scarf (null takes it off); a locked scarf changes nothing. */
export function chooseScarf(scarf: ScarfId | null): StoryProgress {
  const progress = loadStoryProgress();
  if (scarf !== null && !unlockedScarves(progress).includes(scarf)) return progress;
  if (progress.scarf === scarf) return progress;
  const next: StoryProgress = { ...progress, scarf };
  saveStoryProgress(next);
  return next;
}

export function markSceneSeen(sceneId: string): StoryProgress {
  const progress = loadStoryProgress();
  if (progress.seenScenes.includes(sceneId)) return progress;
  const next: StoryProgress = { ...progress, seenScenes: [...progress.seenScenes, sceneId] };
  saveStoryProgress(next);
  return next;
}
