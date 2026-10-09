import {
  StageId,
  getCampaignVillage,
  getNextCampaignStageId,
} from '../../content';
import { getDifficulty } from '../../engine/difficulty';
import type { GameEngineState } from '../../engine/types';
import type { MissionSettlement } from '../../story/hubEconomy';

export function hubPath(stageId: StageId): string {
  return `/hub/${stageId}`;
}

/** The campaign mission this finished match settles, or null if it is not one. */
export function getMissionSettlement(state: GameEngineState): MissionSettlement | null {
  const { campaign, config } = state;
  if (config.mode !== 'solo' || state.phase !== 'game_over' || !campaign || !config.stageId) {
    return null;
  }
  return {
    // One attempt: its seed and the tick it ended on.
    key: `${config.stageId}:${state.rngSeed}:${state.tick}`,
    stageId: config.stageId,
    difficulty: getDifficulty(campaign.difficulty ?? config.difficulty).id,
    success: campaign.missionResult === 'success',
    objectivesCompleted: campaign.objectives
      .filter((objective) => objective.status === 'complete').length,
    secretIds: campaign.discoveredSecrets,
  };
}

/**
 * Where "back to the village" leads after a mission: on to the next village
 * after a win, else back to the one just played.
 */
export function getHubReturn(state: GameEngineState): { stageId: StageId; label: string } | null {
  const settlement = getMissionSettlement(state);
  if (!settlement) return null;
  const next = settlement.success ? getNextCampaignStageId(settlement.stageId) : null;
  const stageId = next ?? settlement.stageId;
  const { villageName } = getCampaignVillage(stageId);
  return {
    stageId,
    label: next ? `Continue to ${villageName}` : `Back to ${villageName}`,
  };
}
