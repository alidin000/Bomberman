import { DEFAULT_DIFFICULTY, DifficultyId, isDifficultyId } from '../../engine/difficulty';

export const CAMPAIGN_DIFFICULTY_KEY = 'campaignDifficulty';

// Storage can be missing or blocked (private mode): fall back to Normal.
export function loadCampaignDifficulty(): DifficultyId {
  try {
    const stored = localStorage.getItem(CAMPAIGN_DIFFICULTY_KEY);
    return isDifficultyId(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

export function saveCampaignDifficulty(difficulty: DifficultyId): void {
  try {
    localStorage.setItem(CAMPAIGN_DIFFICULTY_KEY, difficulty);
  } catch {
    // The choice still applies to this session's next mission.
  }
}
