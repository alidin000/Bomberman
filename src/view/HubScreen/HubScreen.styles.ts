import styled from '@emotion/styled';
import { PRESSED, textStyles, transition } from '../../theme/tokens';

// The hub lives inside the house dialog frame (ConfigScreen's StyledDialog):
// that frame is the one framed panel on screen. Everything in it is quiet
// paper with hairlines, never a second ink frame. The frame's corners are
// 2 px, so the shapes nested inside it are square.

/** A section header inside the hub: Heading 7, tracked like a button label. */
export const SECTION_HEADING = {
  ...textStyles.heading7,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
} as const;

/** A village's colour as a keyline that shows on paper: deepened with ink. */
export const accentLine = (accent: string) => `color-mix(in srgb, ${accent} 60%, var(--anime-ink))`;

export const HubHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin: 0 0 8px;
`;

export const HubStatusLine = styled.p`
  ${textStyles.caption3}
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--ink-3);
  text-transform: uppercase;
`;

export const EmberBalance = styled.p`
  ${textStyles.body4}
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 4px 12px;
  color: var(--anime-ink);
  background: color-mix(in srgb, var(--anime-mustard) 22%, var(--anime-paper-light));
  border: 1px solid var(--anime-mustard);
  border-radius: 0;
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

// The last mission's pay: a mustard callout led by the Ember mark. Plain
// inline text, so a long breakdown wraps mid-line on a phone.
export const HubReport = styled.p`
  ${textStyles.body5}
  margin: 0 0 8px;
  padding: 8px 12px;
  color: var(--anime-ink);
  background: color-mix(in srgb, var(--anime-mustard) 14%, var(--anime-paper-light));
  border: 1px solid var(--anime-mustard);

  & > span[aria-hidden] {
    margin-right: 8px;
    vertical-align: 1px;
  }

  & strong {
    font-weight: 600;
  }
`;

export const HubBody = styled.div`
  margin-top: 12px;
`;

export const VillageIntro = styled.div`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  margin: 0 0 12px;

  & h3 {
    ${textStyles.heading5}
    margin: 0 0 4px;
    color: var(--anime-ink);
  }

  & h3 small {
    ${textStyles.caption3}
    display: block;
    color: var(--anime-teal-deep);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  @media (max-width: 620px) {
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;

    & h3 {
      font-size: var(--text-xl);
      line-height: var(--leading-xl);
    }
  }
`;

export const MissionGoals = styled.p`
  ${textStyles.body5}
  margin: 0 0 8px;
  color: var(--ink-3);
`;

// The found count closing the Village tab, set off from the panel above.
export const SecretsCount = styled(MissionGoals)`
  margin: 12px 0 0;
`;

export const VillageArt = styled.div`
  height: 112px;
  overflow: hidden;
  border: 2px solid var(--anime-ink);
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--anime-orange);

  @media (max-width: 620px) {
    height: 72px;
  }
`;

export const HubBlurb = styled.p`
  ${textStyles.body6}
  margin: 0 0 12px;
  color: var(--ink-3);
`;

export const NpcGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
`;

// A villager: a card keyed in the village's colour all round. Hover lifts
// it onto an orange offset; a press sets it back down.
export const NpcButton = styled.button<{ accent: string }>`
  display: grid;
  gap: 2px;
  min-height: 64px;
  padding: 8px 12px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid ${(props) => accentLine(props.accent)};
  border-radius: 0;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: ${transition(['transform'], ['background-color', 'border-color', 'box-shadow'])};

  & strong {
    font-family: var(--font-display);
    font-size: var(--text-lg);
    line-height: var(--leading-lg);
    font-weight: 400;
    letter-spacing: 0.05em;
  }

  & small {
    ${textStyles.caption3}
    color: var(--ink-2);
    text-transform: uppercase;
  }

  & span {
    ${textStyles.body6}
    color: var(--ink-3);
  }

  &:hover {
    background: color-mix(in srgb, var(--anime-orange) 8%, var(--anime-paper-light));
    border-color: var(--anime-ink);
    box-shadow: 3px 3px 0 var(--anime-orange);
    transform: translateY(-1px);
  }

  &:active {
    box-shadow: none;
    transform: ${PRESSED.transform};
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
  ${textStyles.heading5}
  margin: 0;
  color: var(--anime-ink);

  & small {
    ${textStyles.caption3}
    margin-left: 8px;
    color: var(--ink-2);
    letter-spacing: 0;
    text-transform: uppercase;
  }

  &:focus {
    outline: none;
  }
`;

// What the villager says: a paper speech panel keyed in the village's colour.
export const SpokenLine = styled.p<{ accent: string }>`
  ${textStyles.body3}
  margin: 0;
  padding: 8px 12px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid ${(props) => accentLine(props.accent)};
`;

export const AskedLine = styled.p`
  ${textStyles.body4}
  margin: 0;
  color: var(--ink-2);
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
  ${textStyles.body6}
  margin: 0 0 8px;
  color: var(--anime-ink);

  & strong {
    font-weight: 600;
  }
`;

export const ShopHeading = styled.h3`
  ${SECTION_HEADING}
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
  margin: 12px 0 4px;
  color: var(--anime-ink);

  & span {
    ${textStyles.caption3}
    color: var(--ink-2);
    letter-spacing: 0;
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
  padding: 8px 0;
  /* design-system: allow a divider between shop rows */
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
  gap: 2px;
  min-width: 0;

  & strong {
    ${textStyles.title3}
  }

  & span {
    ${textStyles.body6}
    color: var(--ink-3);
  }

  & small {
    ${textStyles.caption3}
    color: var(--ink-2);
  }
`;

// Filled per rank owned: fill and count, not colour, carry the rank.
export const RankPips = styled.span`
  display: inline-flex;
  gap: 4px;
  margin-left: 8px;
  vertical-align: middle;
`;

export const RankPip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>`
  width: 10px;
  height: 10px;
  border: 2px solid var(--anime-ink);
  border-radius: 9999px;
  background: ${(props) => (props.filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)')};
`;

export const VillageChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 8px;
`;

export const VillageChip = styled.button`
  ${textStyles.buttonSm}
  min-height: 36px;
  padding: 4px 8px;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid var(--ink-1);
  border-radius: 0;
  cursor: pointer;
  transition: ${transition(['transform'], ['background-color', 'border-color', 'color'])};

  &:hover {
    background: color-mix(in srgb, var(--anime-orange) 16%, var(--anime-paper-light));
    border-color: var(--anime-ink);
  }

  &:active {
    transform: ${PRESSED.transform};
  }

  &[aria-pressed='true'] {
    color: var(--on-action);
    background: var(--action);
    border-color: var(--anime-ink);
  }

  &[aria-pressed='true']:hover {
    background: var(--action-deep);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const HubAnnouncer = styled.p`
  ${textStyles.body4}
  min-height: var(--leading-sm);
  margin: 8px 0 0;
  color: var(--ink-3);
`;

export const EarningsLine = styled.p`
  ${textStyles.body4}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 8px;
  margin: 12px 0 0;
  color: var(--anime-ink);

  & strong {
    ${textStyles.body1}
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
`;
