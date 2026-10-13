// The hub's village cards: how far each village has rebuilt, the scarf the
// shinobi wears, and the story scenes to replay.
import React from 'react';
import { Button } from '@mui/material';
import { CAMPAIGN_VILLAGES, StageId } from '../../content';
import type { RepairStage, ScarfId } from '../../content/villageSquare';
import { SCARF_LOOKS } from '../../content/scarves';
import type { StoryProgress } from '../../story/progress';
import { scarfOptions } from '../../story/villageRewards';
import { villageRepairStage } from '../../story/villageVisit';
import {
  HubPanel,
  RebuildList,
  RebuildPips,
  ScarfButton,
  ScarfGrid,
  ScarfSwatch,
  StoryButtons,
} from './HubSecrets.styles';

export const REPAIR_LABELS: Record<RepairStage, string> = {
  0: 'Damaged',
  1: 'Rebuilt',
  2: 'Thriving',
  3: 'Festival',
};

// What the next stage takes (repairStageFor: 10, 20, 30 reputation).
const REPAIR_NEXT: Record<RepairStage, string | null> = {
  0: 'Clear its mission to start rebuilding.',
  1: 'Help here more (requests, secrets, replays) to reach 20 reputation: Thriving.',
  2: 'Reach 30 reputation here for the Festival.',
  3: null,
};

function shortName(name: string): string {
  return name.replace(/ Village$/, '');
}

export interface RebuildCardProps {
  progress: StoryProgress;
  stageId: StageId;
}

export const RebuildCard = ({ progress, stageId }: RebuildCardProps) => {
  const stage = villageRepairStage(stageId, progress);
  const reputation = progress.reputation[stageId] ?? 0;
  const next = REPAIR_NEXT[stage];
  const reached = CAMPAIGN_VILLAGES.filter((village) => (
    progress.unlockedStages.includes(village.stageId)
  ));
  return (
    <HubPanel aria-labelledby="hub-rebuild-heading">
      <h4 id="hub-rebuild-heading">
        {`Rebuilding · ${REPAIR_LABELS[stage]}`}
        <RebuildPips role="img" aria-label={`stage ${stage} of 3`}>
          {[1, 2, 3].map((step) => <i key={step} data-on={stage >= step} />)}
        </RebuildPips>
      </h4>
      <p>{`${reputation} reputation here. ${next ?? 'The village is celebrating. Lanterns and stalls everywhere.'}`}</p>
      <RebuildList aria-label="every village's rebuild">
        {reached.map((village) => (
          <li key={village.stageId}>
            {`${shortName(village.villageName)}: ${REPAIR_LABELS[villageRepairStage(village.stageId, progress)]}`}
          </li>
        ))}
      </RebuildList>
    </HubPanel>
  );
};

function scarfName(id: ScarfId | null): string {
  return id ? SCARF_LOOKS[id].name : 'No scarf';
}

export interface ScarfPickerProps {
  progress: StoryProgress;
  onChoose: (scarf: ScarfId | null) => void;
  // A locked scarf says what earns it.
  onLocked: (message: string) => void;
}

export const ScarfPicker = ({ progress, onChoose, onLocked }: ScarfPickerProps) => {
  const options = scarfOptions(progress);
  const worn = options
    .find((option) => option.unlocked && option.id === progress.scarf)?.id ?? null;
  return (
    <HubPanel aria-labelledby="hub-scarf-heading">
      <h4 id="hub-scarf-heading">{`Scarf · ${scarfName(worn)}`}</h4>
      <p>
        Worn in every mission. Honored standing gives the ember scarf; each village gives its
        own for its three secrets.
      </p>
      <ScarfGrid role="group" aria-label="scarf" data-roving-group>
        {options.map((option) => {
          const name = scarfName(option.id);
          const villageName = option.id && option.id !== 'ember'
            ? shortName(CAMPAIGN_VILLAGES.find((village) => village.stageId === option.id)?.villageName ?? '')
            : null;
          return (
            <ScarfButton
              key={option.id ?? 'none'}
              type="button"
              aria-pressed={worn === option.id}
              aria-disabled={option.unlocked ? undefined : 'true'}
              aria-label={option.unlocked ? name : `${name}, locked: ${option.needs}`}
              onClick={() => {
                if (!option.unlocked) {
                  onLocked(`${name}: ${option.needs}${villageName ? ` in ${villageName}` : ''}.`);
                  return;
                }
                onChoose(option.id);
              }}
            >
              <ScarfSwatch colors={option.id ? SCARF_LOOKS[option.id].colors : null} aria-hidden="true" />
              {option.id ? name.replace(/ scarf$/, '') : name}
              {!option.unlocked && ' · locked'}
            </ScarfButton>
          );
        })}
      </ScarfGrid>
    </HubPanel>
  );
};

export interface StoryReplayProps {
  cleared: boolean;
  onReplay: (part: 'before' | 'after') => void;
}

export const StoryReplay = ({ cleared, onReplay }: StoryReplayProps) => (
  <HubPanel aria-labelledby="hub-story-heading">
    <h4 id="hub-story-heading">Story</h4>
    <StoryButtons role="group" aria-label="story scenes" data-roving-group>
      <Button variant="outlined" size="small" onClick={() => onReplay('before')}>Replay: before the mission</Button>
      {cleared && (
        <Button variant="outlined" size="small" onClick={() => onReplay('after')}>Replay: after the victory</Button>
      )}
    </StoryButtons>
  </HubPanel>
);
