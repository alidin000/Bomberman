// The Secrets tracker (the hub's Secrets tab; the square's shrine shows the
// same list): per village its three secret rooms, roughly where, how to get
// in and what each gives, found or not, and the set reward for all three.
import React from 'react';
import { Button } from '@mui/material';
import {
  CAMPAIGN_VILLAGES, StageId, getCampaignVillage, getStageDefinition,
} from '../../content';
import { SCARF_LOOKS } from '../../content/scarves';
import {
  SECRET_SET_REWARD,
  getVillageSecrets,
  secretSetProgress,
  type SecretSetProgress,
  type VillageSecretKind,
} from '../../content/villageSecrets';
import { SECRETS_EXPLAINER } from '../../content/hubVillages';
import type { StoryProgress } from '../../story/progress';
import {
  MissionGoals, ShopHeading, VillageChip, VillageChips,
} from './HubScreen.styles';
import {
  SecretFacts,
  SecretHead,
  SecretItem,
  SecretList,
  SecretStatus,
  SetReward,
  StoryPage,
} from './HubSecrets.styles';

export const SECRET_KIND_LABELS: Record<VillageSecretKind, string> = {
  scroll: 'Scroll cache',
  fragment: 'Archive fragment',
  burrow: 'Zetsu burrow',
};

function shortName(name: string): string {
  return name.replace(/ Village$/, '');
}

/** What a village's set reward is, as one phrase. */
export function setRewardText(stageId: StageId): string {
  return `${SECRET_SET_REWARD.embers} Embers + the ${SCARF_LOOKS[stageId].name}`;
}

export function setStatusText(set: SecretSetProgress): string {
  if (set.state === 'claimed') return 'Claimed. Wear the scarf from the Village tab.';
  if (set.state === 'ready') return 'All three found. The reward is ready.';
  return `${set.found} of ${set.total} found. Find all three to claim it.`;
}

export interface SecretEntriesProps {
  stageId: StageId;
  discovered: readonly string[];
  accent: string;
  // The list's accessible name.
  label: string;
  // The shrine's short form: no kind row, and a found page's title only
  // (the hub's Secrets tab shows the page itself).
  // eslint-disable-next-line react/require-default-props
  compact?: boolean;
}

/** A village's three secrets: where, the way in, what it gives, found or not. */
export const SecretEntries = ({
  stageId, discovered, accent, label, compact = false,
}: SecretEntriesProps) => (
  <SecretList aria-label={label}>
    {getVillageSecrets(stageId).map((secret) => {
      const found = discovered.includes(secret.id);
      return (
        <SecretItem key={secret.id} found={found} accent={accent}>
          <SecretHead>
            <h4>{secret.name}</h4>
            <SecretStatus found={found}>{found ? '✓ Found' : '○ Not found'}</SecretStatus>
          </SecretHead>
          <SecretFacts>
            {!compact && <dt>Kind</dt>}
            {!compact && <dd>{SECRET_KIND_LABELS[secret.kind]}</dd>}
            <dt>Where</dt>
            <dd>{secret.where}</dd>
            <dt>Way in</dt>
            <dd>{secret.entry}</dd>
            <dt>Gives</dt>
            <dd>{secret.gives}</dd>
          </SecretFacts>
          {found && (
            <StoryPage>
              <strong>{`Story page: ${secret.page.title}`}</strong>
              {!compact && <p>{secret.page.text}</p>}
            </StoryPage>
          )}
        </SecretItem>
      );
    })}
  </SecretList>
);

export interface SecretsPanelProps {
  progress: StoryProgress;
  stageId: StageId;
  onSelect: (stageId: StageId) => void;
  onClaim: (stageId: StageId) => void;
}

export const SecretsPanel = ({
  progress, stageId, onSelect, onClaim,
}: SecretsPanelProps) => {
  const { discoveredSecrets, claimedSecretSets } = progress;
  const sets = CAMPAIGN_VILLAGES.map((village) => ({
    stageId: village.stageId,
    name: shortName(village.villageName),
    set: secretSetProgress(village.stageId, discoveredSecrets, claimedSecretSets),
  }));
  const found = sets.reduce((sum, item) => sum + item.set.found, 0);
  const total = sets.reduce((sum, item) => sum + item.set.total, 0);
  const claimed = sets.filter((item) => item.set.state === 'claimed').length;
  const village = getCampaignVillage(stageId);
  const set = secretSetProgress(stageId, discoveredSecrets, claimedSecretSets);
  return (
    <>
      <ShopHeading as="p">
        {`Secrets · ${found} of ${total} found`}
        <span>{`${claimed} of ${sets.length} sets claimed`}</span>
      </ShopHeading>
      <MissionGoals>
        {`${SECRETS_EXPLAINER} Crack their walls in a mission; this list and the square's shrine keep count.`}
      </MissionGoals>
      <VillageChips role="group" aria-label="secrets village" data-roving-group>
        {sets.map((item) => (
          <VillageChip
            key={item.stageId}
            type="button"
            aria-pressed={stageId === item.stageId}
            aria-label={`${item.name}: ${item.set.found} of ${item.set.total} found${item.set.state === 'claimed' ? ', set claimed' : ''}${item.set.state === 'ready' ? ', reward ready' : ''}`}
            onClick={() => onSelect(item.stageId)}
          >
            {`${item.name} ${item.set.found}/${item.set.total}${item.set.state === 'claimed' ? ' ✓' : ''}${item.set.state === 'ready' ? ' · claim' : ''}`}
          </VillageChip>
        ))}
      </VillageChips>
      <SetReward ready={set.state === 'ready'}>
        <div>
          <strong>{`${shortName(village.villageName)} set reward`}</strong>
          {`${setRewardText(stageId)}. ${setStatusText(set)}`}
        </div>
        {set.state === 'ready' && (
          <Button variant="contained" onClick={() => onClaim(stageId)}>
            {`Claim ${SECRET_SET_REWARD.embers} Embers + scarf`}
          </Button>
        )}
      </SetReward>
      <SecretEntries
        stageId={stageId}
        discovered={discoveredSecrets}
        accent={getStageDefinition(stageId).palette.accent}
        label={`${village.villageName} secrets`}
      />
    </>
  );
};
