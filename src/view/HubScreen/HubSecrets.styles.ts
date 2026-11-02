import styled from '@emotion/styled';
import { PRESSED, textStyles, transition } from '../../theme/tokens';
import { SECTION_HEADING, accentLine } from './HubScreen.styles';

// The Secrets tracker, the village cards (rebuild, scarf, story) and the
// portrait layouts. Quiet paper with hairlines, like the rest of the hub,
// and square inside the hub's 2 px frame.

export const SecretList = styled.ul`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

// Found: a keyline in the village's colour on light paper. Not found: a
// hairline on plain paper (the status badge says which in words).
export const SecretItem = styled.li<{ found: boolean; accent: string }>`
  display: grid;
  gap: 4px;
  padding: 8px 12px;
  color: var(--anime-ink);
  background: ${(props) => (props.found ? 'var(--anime-paper-light)' : 'var(--anime-paper)')};
  border: 2px solid ${(props) => (props.found ? accentLine(props.accent) : 'var(--ink-1)')};

  & h4 {
    ${textStyles.title3}
    margin: 0;
  }
`;

export const SecretHead = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 2px 12px;

  & small {
    ${textStyles.caption3}
    color: var(--ink-2);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

// Found or not, by shape and word as well as colour.
export const SecretStatus = styled.span<{ found: boolean }>`
  ${textStyles.caption3}
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  color: ${(props) => (props.found ? 'var(--anime-paper-light)' : 'var(--anime-ink)')};
  background: ${(props) => (props.found ? 'var(--anime-teal)' : 'transparent')};
  border: 2px solid ${(props) => (props.found ? 'var(--anime-teal)' : 'var(--ink-2)')};
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

export const SecretFacts = styled.dl`
  ${textStyles.body6}
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 2px 12px;
  margin: 0;

  & dt {
    color: var(--ink-2);
    font-weight: 600;
  }

  & dd {
    margin: 0;
  }
`;

// A found secret's story page, led by a brush 巻 (scroll) seal. The seal is
// decoration, so its alt text is empty.
export const StoryPage = styled.div`
  ${textStyles.body6}
  margin-top: 2px;
  padding: 8px 12px;
  background: var(--anime-paper);
  border: 1px solid var(--ink-1);

  & strong {
    ${textStyles.caption3}
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  & strong::before {
    content: "巻" / "";
    display: inline-grid;
    place-items: center;
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    color: var(--anime-paper-light);
    background: var(--anime-ink);
    font-family: var(--font-brush);
    font-size: var(--text-sm);
    line-height: var(--leading-sm);
    font-weight: 400;
  }

  & p {
    margin: 4px 0 0;
  }
`;

export const SetReward = styled.div<{ ready: boolean }>`
  ${textStyles.body6}
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin: 0 0 12px;
  padding: 8px 12px;
  color: var(--anime-ink);
  background: ${(props) => (props.ready ? 'var(--anime-paper-light)' : 'var(--anime-paper)')};
  border: 2px ${(props) => (props.ready ? 'solid' : 'dashed')} var(--anime-ink);

  & strong {
    ${textStyles.caption3}
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
`;

// The arched portrait frame: round on top, square at the foot.
const PORTRAIT_FRAME = {
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  borderRadius: '9999px 9999px 0 0',
} as const;

export const CardBody = styled.span`
  display: grid !important;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 2px 12px;

  align-content: start;

  & > svg {
    ${PORTRAIT_FRAME}
    grid-row: span 3;
    width: 60px;
    height: 70px;
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
    ${PORTRAIT_FRAME}
    flex: 0 0 auto;
    width: 76px;
    height: 89px;
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
  gap: 8px;
  margin: 12px 0 0;
  padding: 8px 12px;
  background: var(--anime-paper-light);
  border: 2px solid var(--ink-1);

  & h4 {
    ${SECTION_HEADING}
    margin: 0;
  }

  & p {
    ${textStyles.body6}
    margin: 0;
    color: var(--ink-3);
  }
`;

/**
 * A panel with nothing in it yet: a short title, one line, and an action
 * when one makes sense, on dashed paper so it reads as "still to come".
 */
export const EmptyNote = styled.div`
  display: grid;
  justify-items: start;
  gap: 4px;
  padding: 12px 16px;
  color: var(--anime-ink);
  background: var(--anime-paper);
  border: 2px dashed var(--ink-2);

  & strong {
    ${SECTION_HEADING}
  }

  & p {
    ${textStyles.body6}
    margin: 0;
    color: var(--ink-3);
  }
`;

// The Secrets tab's note before anything is found, above the village chips.
export const SecretsEmptyNote = styled(EmptyNote)`
  margin: 0 0 8px;
`;

export const RebuildPips = styled.span`
  display: inline-flex;
  gap: 4px;
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
  ${textStyles.caption3}
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-3);
`;

export const ScarfGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

export const ScarfButton = styled.button`
  ${textStyles.buttonSm}
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 4px 12px;
  color: var(--anime-ink);
  background: var(--anime-paper);
  border: 2px solid var(--ink-2);
  border-radius: 0;
  cursor: pointer;
  transition: ${transition(['transform'], ['background-color', 'border-color', 'box-shadow', 'color'])};

  &:hover {
    background: color-mix(in srgb, var(--anime-orange) 16%, var(--anime-paper-light));
    border-color: var(--anime-ink);
  }

  &:active {
    transform: ${PRESSED.transform};
  }

  &[aria-pressed="true"] {
    background: var(--anime-paper-light);
    border-color: var(--anime-ink);
    box-shadow: var(--shadow-1);
  }

  &[aria-pressed="true"]:hover {
    background: color-mix(in srgb, var(--anime-orange) 10%, var(--anime-paper-light));
  }

  &[aria-pressed="true"]::after {
    content: "✓";
  }

  /* Locked: dashed and faded, and it stays still under the pointer. */
  &[aria-disabled="true"] {
    color: var(--ink-2);
    background: var(--anime-paper);
    border-color: var(--ink-2);
    border-style: dashed;
    cursor: default;
    transform: none;
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
  gap: 8px;
`;
