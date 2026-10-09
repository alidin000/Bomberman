import styled from '@emotion/styled';

// The hub lives inside the house dialog frame (ConfigScreen's StyledDialog):
// that frame is the one framed panel on screen. Everything in it is quiet
// paper with hairlines, never a second ink frame or offset shadow.

export const HubHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 6px 12px;
  margin: 0 0 8px;
`;

export const HubStatusLine = styled.p`
  margin: 0;
  color: var(--ink-3);
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
`;

export const EmberBalance = styled.p`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 3px 10px;
  color: var(--anime-ink);
  background: color-mix(in srgb, var(--anime-mustard) 22%, var(--anime-paper-light));
  border: 1px solid var(--anime-mustard);
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 900;
`;

/** A small ink-edged diamond: the Ember mark, by shape as well as colour. */
export const EmberGlyph = styled.span`
  display: inline-block;
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  background: var(--anime-mustard);
  border: 2px solid var(--anime-ink);
  transform: rotate(45deg);
`;

export const HubReport = styled.p`
  margin: 0 0 8px;
  padding: 6px 0 6px 10px;
  color: var(--anime-ink);
  border-left: 4px solid var(--anime-mustard);
  font-size: 0.82rem;
  font-weight: 700;

  & strong {
    font-weight: 900;
  }
`;

export const HubBody = styled.div`
  margin-top: 10px;
`;

export const VillageIntro = styled.div`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  margin: 0 0 10px;

  & h3 {
    margin: 0 0 4px;
    color: var(--anime-ink);
    font-size: 1.2rem;
    font-weight: 900;
    line-height: 1.2;
  }

  & h3 small {
    display: block;
    color: var(--anime-teal-deep);
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  @media (max-width: 620px) {
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 10px;

    & h3 {
      font-size: 1rem;
    }
  }
`;

export const MissionGoals = styled.p`
  margin: 0 0 6px;
  color: var(--ink-3);
  font-size: 0.82rem;
  font-weight: 700;
`;

export const VillageArt = styled.div`
  height: 112px;
  overflow: hidden;
  border: 1px solid var(--ink-1);
  border-radius: var(--radius);

  @media (max-width: 620px) {
    height: 72px;
  }
`;

export const HubBlurb = styled.p`
  margin: 0 0 10px;
  color: var(--ink-3);
  font-size: 0.9rem;
  font-style: italic;
  line-height: 1.45;
`;

export const NpcGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
`;

export const NpcButton = styled.button<{ accent: string }>`
  display: grid;
  gap: 2px;
  min-height: 64px;
  padding: 8px 10px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid var(--ink-1);
  border-left: 5px solid ${(props) => props.accent};
  border-radius: var(--radius);
  text-align: left;
  font: inherit;
  cursor: pointer;

  & strong {
    font-size: 0.95rem;
    font-weight: 900;
  }

  & small {
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  & span {
    color: var(--ink-3);
    font-size: 0.82rem;
    line-height: 1.35;
  }

  &:hover {
    border-color: var(--anime-ink);
    border-left-color: ${(props) => props.accent};
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const Conversation = styled.div`
  display: grid;
  gap: 8px;
`;

export const Speaker = styled.h3`
  margin: 0;
  color: var(--anime-ink);
  font-size: 1rem;
  font-weight: 900;

  & small {
    margin-left: 8px;
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  &:focus {
    outline: none;
  }
`;

export const SpokenLine = styled.p<{ accent: string }>`
  margin: 0;
  padding: 4px 0 4px 12px;
  color: var(--anime-ink);
  border-left: 4px solid ${(props) => props.accent};
  font-size: 0.95rem;
  line-height: 1.5;
`;

export const AskedLine = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: 0.82rem;
  font-weight: 800;
`;

export const ChoiceList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;

  & .MuiButton-root {
    text-transform: none;
  }
`;

export const MerchantLine = styled.p`
  margin: 0 0 8px;
  color: var(--anime-ink);
  font-size: 0.88rem;
  line-height: 1.45;

  & strong {
    font-weight: 900;
  }
`;

export const ShopHeading = styled.h3`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 12px 0 4px;
  color: var(--anime-ink);
  font-size: 0.82rem;
  font-weight: 900;
  text-transform: uppercase;

  & span {
    color: var(--ink-2);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: none;
  }
`;

export const ShopList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const ShopRow = styled.li`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding: 7px 0;
  border-bottom: 1px solid var(--ink-1);

  & .MuiButton-root {
    min-width: 132px;
  }

  & .MuiButton-root[aria-disabled='true'] {
    color: var(--ink-2);
    border-style: dashed;
    border-color: var(--ink-2);
    cursor: default;
  }
`;

export const ItemText = styled.div`
  display: grid;
  gap: 1px;
  min-width: 0;

  & strong {
    font-size: 0.92rem;
    font-weight: 900;
  }

  & span {
    color: var(--ink-3);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  & small {
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 800;
  }
`;

// Filled per rank owned: fill and count, not colour, carry the rank.
export const RankPips = styled.span`
  display: inline-flex;
  gap: 4px;
  margin-left: 6px;
  vertical-align: middle;
`;

export const RankPip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>`
  width: 10px;
  height: 10px;
  border: 2px solid var(--anime-ink);
  border-radius: 50%;
  background: ${(props) => (props.filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)')};
`;

export const VillageChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 8px;
`;

export const VillageChip = styled.button`
  padding: 4px 9px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid var(--ink-1);
  border-radius: var(--radius);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 900;
  cursor: pointer;

  &[aria-pressed='true'] {
    color: var(--anime-paper-light);
    background: var(--action);
    border-color: var(--anime-ink);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const CodexList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

// Found entries have a solid accent edge; unknown ones a dashed hairline.
export const CodexEntry = styled.li<{ locked: boolean; accent: string }>`
  padding: 6px 10px;
  border-left: ${(props) => (props.locked
    ? '4px dashed var(--ink-2)'
    : `4px solid ${props.accent}`)};

  & h4 {
    margin: 0 0 2px;
    color: ${(props) => (props.locked ? 'var(--ink-2)' : 'var(--anime-ink)')};
    font-size: 0.9rem;
    font-weight: 900;
  }

  & small {
    display: block;
    color: var(--ink-2);
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  & p {
    margin: 2px 0 0;
    color: var(--anime-ink);
    font-size: 0.88rem;
    line-height: 1.45;
  }
`;

export const HubAnnouncer = styled.p`
  min-height: 1.2em;
  margin: 8px 0 0;
  color: var(--ink-3);
  font-size: 0.8rem;
  font-weight: 800;
`;

export const EarningsLine = styled.p`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 8px;
  margin: 10px 0 0;
  color: var(--anime-ink);
  font-size: 0.82rem;
  font-weight: 800;

  & strong {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.95rem;
    font-weight: 900;
  }
`;
