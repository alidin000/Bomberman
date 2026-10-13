import React from 'react';
import styled from '@emotion/styled';
import { LinearProgress } from '@mui/material';
import type { StageId } from '../../content/types';
import { STANDING_TIER_PERKS, getSquareVillager } from '../../content/hubVillages';
import { REPUTATION_TIERS, tierAtLeast } from '../../story/reputation';
import type { StoryProgress } from '../../story/progress';
import { getLockedRequests, getOfferedRequests, getVillageStanding } from '../../story/villageVisit';
import { rewardText } from '../GameScreen/village/villageCopy';

// Quiet paper with hairlines inside the hub frame, like the rest of the hub.
const Card = styled.section`
  display: grid;
  gap: 6px;
  margin: 0 0 10px;
  padding: 8px 10px;
  border: 1px solid var(--ink-1);
  border-radius: var(--radius);

  & h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 2px 10px;
    margin: 0;
    color: var(--anime-ink);
    font-size: 0.82rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  & h3 span {
    color: var(--ink-2);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: none;
  }

  & .MuiLinearProgress-root {
    height: 6px;
    background-color: rgba(33, 29, 26, 0.16);
  }

  & .MuiLinearProgress-bar {
    background: var(--anime-teal);
  }
`;

const TierList = styled.ol`
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;

  & li {
    display: grid;
    grid-template-columns: 7.5em minmax(0, 1fr);
    gap: 8px;
    padding-left: 8px;
    color: var(--ink-3);
    border-left: 4px dashed var(--ink-1);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  & li strong {
    color: var(--anime-ink);
    font-weight: 900;
  }

  & li[data-reached='true'] {
    color: var(--anime-ink);
    border-left-style: solid;
    border-left-color: var(--anime-teal);
  }

  & li[aria-current='true'] {
    background: var(--anime-paper);
  }

  @media (max-width: 620px) {
    & li {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
  }
`;

const BoardList = styled.ul`
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;

  & li {
    display: grid;
    gap: 1px;
    padding-left: 8px;
    border-left: 4px solid var(--anime-mustard);
    font-size: 0.82rem;
  }

  & li strong {
    font-weight: 900;
  }

  & li small {
    color: var(--ink-3);
    font-size: 0.74rem;
    font-weight: 800;
  }
`;

const Quiet = styled.p`
  margin: 0;
  color: var(--ink-3);
  font-size: 0.8rem;
  font-weight: 700;
`;

/** Standing over every village: its tier, the way to the next, what each brings. */
export const StandingCard = ({ progress }: { progress: StoryProgress }) => {
  const {
    standing, tier, next, toNext,
  } = getVillageStanding(progress);
  return (
    <Card aria-labelledby="hub-standing-heading">
      <h3 id="hub-standing-heading">
        {`Standing · ${tier.label}`}
        <span>
          {next
            ? `${standing} of ${next.from} to ${next.label}`
            : `${standing} · the highest standing`}
        </span>
      </h3>
      <LinearProgress
        variant="determinate"
        value={Math.round(toNext * 100)}
        aria-label={next ? `Standing toward ${next.label}` : 'Standing'}
      />
      <TierList aria-label="what standing brings">
        {REPUTATION_TIERS.map((item) => {
          const reached = tierAtLeast(tier.id, item.id);
          return (
            <li
              key={item.id}
              data-reached={reached}
              aria-current={item.id === tier.id ? 'true' : undefined}
            >
              <strong>{`${item.label}${reached ? ' ✓' : ` · ${item.from}`}`}</strong>
              <span>{STANDING_TIER_PERKS[item.id]}</span>
            </li>
          );
        })}
      </TierList>
      <Quiet>Clearing missions, finding secrets and finishing board requests raise it.</Quiet>
    </Card>
  );
};

function giverName(stageId: StageId, giverId: string): string {
  return getSquareVillager(stageId, giverId)?.name ?? giverId;
}

/** What the next mission's square board will offer, before deploying. */
type BoardPreviewProps = { stageId: StageId; progress: StoryProgress };

export const BoardPreview = ({ stageId, progress }: BoardPreviewProps) => {
  const offered = getOfferedRequests(stageId, progress);
  const locked = getLockedRequests(stageId, progress);
  const nextLocked = locked[0];
  return (
    <Card aria-labelledby="hub-board-heading">
      <h3 id="hub-board-heading">
        On the square&apos;s board
        <span>Take them at the board when the mission starts</span>
      </h3>
      {offered.length > 0 ? (
        <BoardList aria-label="requests on the board">
          {offered.map((request) => (
            <li key={request.id}>
              <strong>{request.title}</strong>
              <span>{request.description}</span>
              <small>
                {`${giverName(stageId, request.giverId)} · ${rewardText(request)}`}
              </small>
            </li>
          ))}
        </BoardList>
      ) : (
        <Quiet>Every request this village can offer you now is done.</Quiet>
      )}
      {nextLocked && (
        <Quiet>
          {`${locked.length} more ${locked.length === 1 ? 'request' : 'requests'} from ${
            REPUTATION_TIERS.find((item) => item.id === nextLocked.minTier)?.label ?? 'a higher standing'
          }.`}
        </Quiet>
      )}
    </Card>
  );
};
