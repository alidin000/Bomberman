import React from 'react';
import { formatEmbers, getHubConsumable, normalizePack } from '../../content/hubShop';
import type { CampaignLoadout, MissionEarnings } from '../../content/hubShop';
import { EarningsLine, EmberGlyph } from './HubScreen.styles';

/** "Clear 50 · Objectives 18 · Secrets 20": only the parts that paid. */
export function earningsBreakdown(earnings: MissionEarnings): string {
  return [
    earnings.clear > 0 ? `Clear ${earnings.clear}` : '',
    earnings.objectives > 0 ? `Objectives ${earnings.objectives}` : '',
    earnings.secrets > 0 ? `Secrets ${earnings.secrets}` : '',
  ].filter(Boolean).join(' · ');
}

/** The mission's pay on the result dialog, and the hub items it used up. */
export const MissionEarningsLine = (
  { earnings, loadout }: { earnings: MissionEarnings; loadout: CampaignLoadout | undefined }
) => {
  const breakdown = earningsBreakdown(earnings);
  const used = normalizePack(loadout?.consumables, loadout?.upgrades)
    .map((id) => getHubConsumable(id).name);
  return (
    <>
      <EarningsLine>
        <strong>
          <EmberGlyph aria-hidden="true" />
          {`+${formatEmbers(earnings.total)}`}
        </strong>
        <span>{breakdown || 'Objectives and secrets pay, even on a failed mission.'}</span>
      </EarningsLine>
      {used.length > 0 && (
        // A retry starts without them: the pack was for this attempt.
        <EarningsLine>{`Used up: ${used.join(', ')}`}</EarningsLine>
      )}
    </>
  );
};
