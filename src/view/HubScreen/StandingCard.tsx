import React from 'react';
import styled from '@emotion/styled';
import { LinearProgress } from '@mui/material';
import type { StageId } from '../../content/types';
import { STANDING_TIER_PERKS, getSquareVillager } from '../../content/hubVillages';
import { REPUTATION_TIERS, tierAtLeast } from '../../story/reputation';
import type { StoryProgress } from '../../story/progress';
import { getLockedRequests, getOfferedRequests, getVillageStanding } from '../../story/villageVisit';
import { rewardText } from '../GameScreen/village/villageCopy';
import { textStyles, transition } from '../../theme/tokens';
import { SECTION_HEADING } from './HubScreen.styles';
import { EmptyNote } from './HubSecrets.styles';

// Quiet paper with hairlines inside the hub frame, like the rest of the hub.
const Card = styled.section`
  display: grid;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--ink-1);

  & h3 {
    ${SECTION_HEADING}
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 2px 12px;
    margin: 0;
    color: var(--anime-ink);
  }

  & h3 span {
    ${textStyles.caption3}
    color: var(--ink-2);
    letter-spacing: 0;
    text-transform: none;
  }

  & .MuiLinearProgress-root {
    height: 6px;
    background-color: var(--ink-1);
  }

  /* MUI eases the bar linearly; the house curve moves it instead. */
  & .MuiLinearProgress-bar {
    background: var(--anime-teal);
    transition: ${transition(['transform'])};
  }
`;

// Each tier is led by a square: filled once reached, hollow until then.
const TierList = styled.ol`
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;

  & li {
    ${textStyles.body6}
    display: grid;
    grid-template-columns: 9em minmax(0, 1fr);
    gap: 8px;
    padding: 0 4px;
    color: var(--ink-3);
  }

  & li strong {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--anime-ink);
    font-weight: 600;
  }

  & li strong::before {
    content: "";
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    border: 2px solid var(--ink-2);
  }

  & li[data-reached='true'] {
    color: var(--anime-ink);
  }

  & li[data-reached='true'] strong::before {
    background: var(--anime-teal);
    border-color: var(--anime-teal);
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

// Each request is led by a mustard pin, like a note on the board.
const BoardList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;

  & li {
    ${textStyles.body6}
    display: grid;
    gap: 2px;
  }

  & li strong {
    ${textStyles.title3}
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  & li strong::before {
    content: "";
    flex: 0 0 auto;
    width: 10px;
    height: 10px;
    background: var(--anime-mustard);
    border: 2px solid var(--anime-ink);
  }

  & li small {
    ${textStyles.caption3}
    color: var(--ink-3);
  }
`;

const Quiet = styled.p`
  ${textStyles.body5}
  margin: 0;
  color: var(--ink-3);
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
        <EmptyNote>
          <strong>Board cleared</strong>
          <p>Every request this village can offer you now is done.</p>
        </EmptyNote>
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
