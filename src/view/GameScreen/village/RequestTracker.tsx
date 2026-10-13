import React from 'react';
import styled from '@emotion/styled';
import type { TrackedRequest } from './villageCopy';

// The board requests taken this mission, in the mission panel under the
// objectives: "Lost Tea Tins 1/3". Done ones get a solid edge and the word
// "Done", failed ones a dashed edge and "Failed": never colour alone.

const Row = styled.div`
  display: grid;
  gap: 2px;
  margin-top: 6px;
  padding: 4px 6px;
  color: var(--anime-ink);
  background: var(--anime-paper);
  border: 1px solid rgba(33, 29, 26, 0.3);
  border-left: 4px solid var(--anime-mustard);

  & h3 {
    margin: 0;
    font-size: 0.68rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  & ul {
    display: grid;
    gap: 1px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  & li {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    font-size: 0.78rem;
    font-weight: 800;
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
