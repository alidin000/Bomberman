import React from 'react';
import styled from '@emotion/styled';
import { space, textStyles } from '../../../theme/tokens';
import type { TrackedRequest } from './villageCopy';

// The board requests taken this mission, in the mission panel under the
// objectives: "Lost Tea Tins 1/3", after a mustard square. Each row ends in
// its count or the word "Done" or "Failed", and a failed one is struck
// through: never colour alone.

const Row = styled.div`
  display: grid;
  gap: ${space[25]}px;
  margin-top: ${space[75]}px;
  padding: ${space[50]}px ${space[75]}px;
  color: var(--anime-ink);
  background: var(--anime-paper);
  border: 1px solid rgba(33, 29, 26, 0.3);

  & h3 {
    ${textStyles.caption3}
    display: flex;
    align-items: center;
    gap: ${space[75]}px;
    margin: 0;
    text-transform: uppercase;
  }

  & h3::before {
    content: '';
    width: 8px;
    height: 8px;
    background: var(--anime-mustard);
    border: 1px solid var(--anime-ink);
  }

  & ul {
    display: grid;
    gap: ${space[25]}px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  & li {
    display: flex;
    align-items: baseline;
    gap: ${space[75]}px;
    min-width: 0;
    ${textStyles.caption4}
  }

  & li span {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  & li b {
    flex: 0 0 auto;
    font-weight: ${textStyles.caption3.fontWeight};
    font-variant-numeric: tabular-nums;
  }

  & li[data-status='failed'] {
    color: var(--ink-2);
    text-decoration: line-through;
  }
`;

export const RequestLine = ({ requests }: { requests: readonly TrackedRequest[] }) => (
  <Row aria-label="village requests">
    <h3>Requests</h3>
    <ul>
      {requests.map((request) => (
        <li key={request.id} data-status={request.status}>
          <span>{request.title}</span>
          <b>{request.short}</b>
        </li>
      ))}
    </ul>
  </Row>
);

/**
 * The phones' one-line mission strip has room for one short count: the
 * first request still in progress, "Req 1/3", or how many are done.
 */
export function requestChipText(requests: readonly TrackedRequest[]): string | null {
  const open = requests.find((request) => request.status === 'accepted');
  if (open) return `Req ${open.short}`;
  const done = requests.filter((request) => request.status === 'complete').length;
  return done > 0 ? `Req ${done} done` : null;
}
