import styled from '@emotion/styled';

// The Secrets tracker, the village cards (rebuild, scarf, story) and the
// portrait layouts. Quiet paper with hairlines, like the rest of the hub.

export const SecretList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const SecretItem = styled.li<{ found: boolean; accent: string }>`
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  color: var(--anime-ink);
  background: ${(props) => (props.found ? 'var(--anime-paper-light)' : 'var(--anime-paper)')};
  border: 2px solid ${(props) => (props.found ? 'var(--anime-ink)' : 'var(--ink-1)')};
  border-left: 6px solid ${(props) => (props.found ? props.accent : 'var(--ink-2)')};
  border-radius: var(--radius);

  & h4 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 900;
  }
`;

export const SecretHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 10px;

  & small {
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }
`;

// Found or not, by shape and word as well as colour.
export const SecretStatus = styled.span<{ found: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  color: ${(props) => (props.found ? 'var(--anime-paper-light)' : 'var(--anime-ink)')};
  background: ${(props) => (props.found ? 'var(--anime-teal)' : 'transparent')};
  border: 2px solid ${(props) => (props.found ? 'var(--anime-teal)' : 'var(--ink-2)')};
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
`;

export const SecretFacts = styled.dl`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 10px;
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.35;

  & dt {
    color: var(--ink-2);
    font-weight: 900;
  }

  & dd {
    margin: 0;
  }
`;

export const StoryPage = styled.div`
  margin-top: 2px;
  padding: 6px 8px;
  background: var(--anime-paper);
  border-left: 3px solid var(--anime-ink);
  font-size: 0.84rem;
  line-height: 1.4;

  & strong {
    display: block;
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  & p {
    margin: 2px 0 0;
    font-style: italic;
  }
`;

export const SetReward = styled.div<{ ready: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin: 0 0 10px;
  padding: 8px 10px;
  color: var(--anime-ink);
  background: ${(props) => (props.ready ? 'var(--anime-paper-light)' : 'var(--anime-paper)')};
  border: 2px ${(props) => (props.ready ? 'solid' : 'dashed')} var(--anime-ink);
  border-radius: var(--radius);
  font-size: 0.86rem;

  & strong {
    display: block;
    font-size: 0.8rem;
    font-weight: 900;
    text-transform: uppercase;
  }
`;

export const CardBody = styled.span`
  display: grid !important;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 2px 10px;

  align-content: start;

  & > svg {
    grid-row: span 3;
    width: 60px;
    height: 70px;
    background: var(--anime-paper);
    border: 2px solid var(--anime-ink);
    border-radius: 50% 50% 4px 4px;
  }

  & > strong,
  & > small,
  & > span {
    grid-column: 2;
  }
`;

export const TalkHead = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;

  & > svg {
    flex: 0 0 auto;
    width: 76px;
    height: 89px;
    background: var(--anime-paper);
    border: 2px solid var(--anime-ink);
    border-radius: 50% 50% 4px 4px;
  }

  @media (max-width: 560px) {
    & > svg {
      width: 60px;
      height: 70px;
    }
  }
`;

export const HubPanel = styled.section`
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
  padding: 8px 10px;
  background: var(--anime-paper-light);
  border: 2px solid var(--ink-1);
  border-radius: var(--radius);

  & h4 {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  & p {
    margin: 0;
    color: var(--ink-3);
    font-size: 0.84rem;
    line-height: 1.35;
  }
`;

export const RebuildPips = styled.span`
  display: inline-flex;
  gap: 3px;
  margin-left: 8px;
  vertical-align: middle;

  & i {
    width: 18px;
    height: 8px;
    border: 2px solid var(--anime-ink);
    transform: skewX(-18deg);
  }

  & i[data-on="true"] {
    background: var(--anime-vermilion);
  }
`;

export const RebuildList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-3);
  font-size: 0.78rem;
  font-weight: 800;
`;

export const ScarfGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

export const ScarfButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 4px 10px;
  color: var(--anime-ink);
  background: var(--anime-paper);
  border: 2px solid var(--ink-2);
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 800;
  cursor: pointer;

  &[aria-pressed="true"] {
    background: var(--anime-paper-light);
    border-color: var(--anime-ink);
    box-shadow: var(--shadow-1);
  }

  &[aria-pressed="true"]::after {
    content: "✓";
    font-weight: 900;
  }

  &[aria-disabled="true"] {
    color: var(--ink-2);
    border-style: dashed;
    cursor: default;
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const ScarfSwatch = styled.span<{ colors: readonly [string, string] | null }>`
  width: 22px;
  height: 12px;
  border: 2px solid var(--anime-ink);
  background: ${(props) => (props.colors
    ? `repeating-linear-gradient(-45deg, ${props.colors[0]} 0 5px, ${props.colors[1]} 5px 7px)`
    : 'transparent')};
`;

export const StoryButtons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;
