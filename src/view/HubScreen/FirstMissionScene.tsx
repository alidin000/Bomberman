// A village's before-the-mission scene for the Mission Deck's Deploy Mission
// (the hub plays its own): loaded only when it plays, marked seen when it
// ends (finished or skipped), then the deck starts the match.
import React from 'react';
import { getCampaignVillage, getStageDefinition, type StageId } from '../../content';
import { getStoryScene, storySceneId } from '../../content/storyScenes';
import { markSceneSeen } from '../../story/villageRewards';
import { StoryScene } from './StoryScene';

export interface FirstMissionSceneProps {
  stageId: StageId;
  onDone: () => void;
}

const FirstMissionScene = ({ stageId, onDone }: FirstMissionSceneProps) => (
  <StoryScene
    scene={getStoryScene(stageId, 'before')}
    villageName={getCampaignVillage(stageId).villageName}
    accent={getStageDefinition(stageId).palette.accent}
    finishLabel="Start mission"
    onDone={() => {
      markSceneSeen(storySceneId(stageId, 'before'));
      onDone();
    }}
  />
);

export default FirstMissionScene;
