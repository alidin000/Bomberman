import styled from '@emotion/styled';
import { Dialog, Typography } from '@mui/material';
import { PRESSED, textStyles, transition } from '../../theme/tokens';

type PlayerControlsRowProps = {
  numOfPlayers: string;
};

const panelCut = 'none';
const chipCut = 'none';

export const StyledDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(18, 13, 11, 0.82)',
  },
  // The house dialog frame (shared with Settings): an unrolled scroll, its
  // wooden rod across the top (the footer carries the bottom one), an ink
  // keyline and a hard orange offset. The footer sits below the scrolling
  // content, never on it.
  '& .MuiDialog-paper': {
    width: '980px',
    maxWidth: 'calc(100vw - 16px)',
    minHeight: 'min(760px, calc(100dvh - 16px))',
    maxHeight: 'calc(100dvh - 16px)',
    margin: 8,
    padding: '24px 24px 0',
    overflow: 'hidden',
    borderRadius: 'var(--radius)',
    clipPath: panelCut,
    color: 'var(--anime-ink)',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'var(--scroll-rod), var(--scroll-paper)',
    backgroundSize: '100% 11px, 100% 100%, auto, 100% 100%',
    backgroundRepeat: 'no-repeat, no-repeat, repeat, no-repeat',
    border: '3px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-frame)',
  },
  // The title (Heading 5): display type on a ragged brush stroke of ink.
  '& .MuiDialogTitle-root': {
    ...textStyles.heading5,
    position: 'relative',
    isolation: 'isolate',
    width: 'fit-content',
    minWidth: 280,
    margin: '0 auto 8px',
    padding: '4px 48px',
    color: 'var(--anime-paper-light)',
    background: 'transparent',
    letterSpacing: '0.07em',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadow: '2px 2px 0 var(--accent)',
    '&::before': {
      content: "''",
      position: 'absolute',
      inset: 0,
      zIndex: -1,
      background: 'var(--anime-ink)',
      WebkitMaskImage: 'var(--brush-swash)',
      maskImage: 'var(--brush-swash)',
      WebkitMaskSize: '100% 100%',
      maskSize: '100% 100%',
    },
    // Focused by script when a step opens, so screen readers announce it.
    // It is not a control, so it shows no focus ring.
    '&:focus': {
      outline: 'none',
    },
  },
  '& .MuiDialogContent-root': {
    padding: '0 4px 16px',
    overflowX: 'hidden',
    borderTop: 0,
    scrollPaddingBottom: 16,
  },
  '& .MuiStepper-root': {
    margin: '0 auto 12px',
    padding: '2px 12px',
    maxWidth: 640,
    clipPath: chipCut,
    background: 'transparent',
    border: 0,
  },
  // Step names are Caption 3 in capitals; "Optional" under them is Caption 5.
  '& .MuiStepLabel-label': {
    ...textStyles.caption3,
    color: 'var(--ink-3)',
    textTransform: 'uppercase',
    transition: transition([], ['color']),
  },
  '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': {
    color: 'var(--anime-ink)',
  },
  '& .MuiStepIcon-root': {
    color: 'var(--ink-2)',
    transition: transition([], ['color']),
  },
  '& .MuiStepLabel-labelContainer .MuiTypography-caption': {
    ...textStyles.caption5,
    display: 'block',
    color: 'var(--ink-2)',
  },
  '& .MuiStepIcon-text': {
    fill: 'var(--anime-paper-light)',
    fontWeight: 600,
  },
  '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
    color: 'var(--action)',
  },
  // Ink digits on the orange step (7.2:1).
  '& .MuiStepIcon-root.Mui-active .MuiStepIcon-text, & .MuiStepIcon-root.Mui-completed .MuiStepIcon-text': {
    fill: 'var(--on-action)',
  },
  '& .MuiTypography-colorTextSecondary': {
    color: 'var(--ink-2)',
  },
  // Labels come from the theme: Button-md, and Button-lg on the large
  // footer actions.
  '& .MuiButton-root': {
    borderRadius: 'var(--radius)',
    clipPath: chipCut,
  },
  // The one primary call-to-action look: ninja orange with ink type, an
  // ink keyline and a hard ink offset.
  '& .MuiButton-contained, & .MuiButton-contained.Mui-focusVisible': {
    background: 'var(--action)',
    color: 'var(--on-action)',
    border: '2px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-2)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--action-deep)',
    boxShadow: 'var(--shadow-2)',
  },
  '& .MuiButton-contained.Mui-disabled': {
    color: 'var(--ink-2)',
    background: 'rgba(33,29,26,0.12)',
    borderColor: 'var(--ink-1)',
    boxShadow: 'none',
  },
  '& .MuiButton-text': {
    color: 'var(--anime-ink)',
    borderColor: 'transparent',
  },
  '& .MuiButton-text:hover': {
    background: 'rgba(245,130,31,0.14)',
  },
  '& .MuiButtonBase-root.Mui-focusVisible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
  // The chakra ring is the focus mark; MUI's pulsing focus ripple would be a second one.
  '& .MuiTouchRipple-ripplePulsate': {
    display: 'none',
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--accent)',
    background: 'rgba(245,130,31,0.14)',
  },
  '& .MuiStepButton-root': {
    padding: '4px 8px',
    margin: '-4px -8px',
  },
  // Segmented choices (mode, difficulty, rounds): Button-md labels, a press
  // that sinks a pixel, and the chosen one filled orange with an ink
  // underline, so the choice does not rest on colour alone.
  '& .MuiToggleButton-root': {
    ...textStyles.buttonMd,
    minWidth: 58,
    padding: 12,
    color: 'var(--anime-ink)',
    borderColor: 'var(--ink-1)',
    background: 'rgba(255,255,255,0.42)',
    clipPath: chipCut,
    transition: transition(['transform'], ['background-color', 'color', 'box-shadow']),
    '&:active': PRESSED,
  },
  '& .MuiToggleButton-sizeSmall': {
    padding: 8,
  },
  '& .MuiToggleButton-root:hover': {
    background: 'rgba(245,130,31,0.14)',
  },
  '& .MuiToggleButton-root.Mui-selected': {
    color: 'var(--on-action)',
    background: 'var(--action)',
    boxShadow: 'inset 0 -3px 0 var(--anime-ink)',
  },
  '& .MuiToggleButton-root.Mui-selected:hover': {
    background: 'var(--action-deep)',
  },
  '& .MuiToggleButton-root.Mui-disabled': {
    color: 'rgba(33,29,26,0.6)',
    background: 'rgba(255,255,255,0.2)',
  },
  '& .MuiToggleButton-root.Mui-focusVisible': {
    zIndex: 1,
  },
  '@media (max-width: 680px)': {
    '& .MuiDialog-paper': {
      padding: '16px 12px 0',
    },
    // Keep the footer actions on one row on phones: Button-md labels and
    // the main buttons' 8 by 12 px padding.
    '& .MuiButton-sizeLarge': {
      ...textStyles.buttonMd,
      minWidth: 0,
      padding: '8px 12px',
    },
    '& .MuiDialogTitle-root': {
      minWidth: 0,
      padding: '4px 32px',
      fontSize: 'var(--text-xl)',
      lineHeight: 'var(--leading-xl)',
    },
  },
  // Narrow phones: drop the play icon so the three footer actions share one row.
  '@media (max-width: 420px)': {
    '& .MuiButton-startIcon': {
      display: 'none',
    },
  },
  // Landscape phones: a small title and a slim footer leave room for the setup.
  '@media (max-height: 560px)': {
    '& .MuiDialog-paper': {
      padding: '16px 12px 0',
    },
    '& .MuiDialogTitle-root': {
      margin: '0 auto 2px',
      padding: '2px 24px',
      fontSize: 'var(--text-sm)',
      lineHeight: 'var(--leading-sm)',
      minWidth: 0,
    },
    '& .MuiStepper-root': {
      marginBottom: 2,
      padding: '0 8px',
    },
    '& .MuiStepLabel-labelContainer .MuiTypography-caption': {
      display: 'none',
    },
    '& .MuiButton-sizeLarge': {
      ...textStyles.buttonMd,
      minWidth: 0,
      padding: '8px 12px',
    },
  },
});

export const StepContent = styled.div`
  margin-top: 12px;
  margin-bottom: 0;

  @media (max-height: 560px) {
    margin-top: 4px;
  }
`;

/** The deck footer: Back/Main Menu, Next and the one primary action. */
export const DeckFooter = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 -24px;
  /* The bottom padding keeps the actions clear of the rod. */
  padding: 12px 24px 24px;
  /*
   * The scroll's bottom rod runs under the footer. The ink rule on top is
   * the divider between the scrolling setup and the actions; the frame
   * draws the other three sides.
   */
  background: var(--scroll-rod) bottom / 100% 11px no-repeat, var(--anime-paper-light);
  border-top: 2px solid var(--anime-ink);

  @media (max-width: 680px) {
    margin: 0 -12px;
    padding: 8px 12px 24px;
  }

  @media (max-height: 560px) {
    margin: 0 -12px;
    padding: 4px 12px 12px;
    background-size: 100% 8px, auto;
  }
`;

/**
 * Back on the left, the primary action in the centre (straight below the
 * setup, so the arrow keys reach it), and Next on the right.
 */
export const FooterActions = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  width: 100%;

  & > :first-of-type {
    justify-self: end;
  }

  & > :last-of-type {
    justify-self: start;
  }

  & .MuiButton-root {
    white-space: nowrap;
  }

  @media (max-width: 680px) {
    gap: 8px;
  }

  /* Phones: the three actions sit side by side at their own widths. */
  @media (max-width: 560px) {
    display: flex;
    justify-content: center;
  }
`;

/** One line on how to drive the menu from the keyboard. */
export const FooterHint = styled.p`
  ${textStyles.caption3}
  margin: 0;
  color: var(--ink-2);

  @media (max-width: 560px), (max-height: 560px) {
    display: none;
  }
`;

/** A mode's name over its one line of detail (Caption 3). */
export const ModeToggleText = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;

  & small {
    ${textStyles.caption3}
    letter-spacing: 0;
    text-transform: none;
    opacity: 0.9;
  }
`;

export const PlayerControlsRow = styled.div<PlayerControlsRowProps>`
  display: grid;
  grid-template-columns: minmax(120px, 0.28fr) minmax(160px, 0.34fr) minmax(280px, 1fr);
  align-items: center;
  gap: 16px;
  margin-bottom: ${(props) => (props.numOfPlayers === '2' ? '16px' : '12px')};
  margin-top: ${(props) => (props.numOfPlayers === '2' ? '12px' : '8px')};
  padding: 12px 4px 0;
  clip-path: ${panelCut};

  /* A rule between one player's keys and the next. */
  & + & {
    border-top: 2px solid var(--ink-1);
  }

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  @media (max-height: 560px) {
    margin: 4px 0;
    padding-top: 4px;
  }
`;

export const ControlsLabel = styled(Typography)`
  ${textStyles.title3}
  min-width: 0;
  color: var(--anime-ink);
  text-transform: uppercase;
`;

export const KeyConfigInput = styled.input`
  ${textStyles.title2}
  width: 46px;
  height: 46px;
  margin: 4px;
  padding: 0;
  text-align: center;
  border-radius: var(--radius-sm);
  border: 2px solid var(--anime-ink);
  background: var(--anime-paper-light);
  color: var(--anime-ink);
  cursor: pointer;
  caret-color: transparent;
  box-shadow: 2px 2px 0 var(--anime-mustard);
  transition: ${transition(['transform'], ['background-color', 'border-color', 'box-shadow'])};

  &:hover {
    background: var(--anime-paper);
  }

  &:active {
    ${PRESSED}
  }

  &:focus {
    outline: var(--focus-ring);
    outline-offset: 2px;
    border-color: var(--anime-ink);
  }
  &[data-error='true'] {
    border-color: var(--danger);
    border-style: dashed;
    box-shadow: 2px 2px 0 var(--danger);
  }

  @media (max-height: 560px) {
    width: 40px;
    height: 40px;
    margin: 2px;
  }
`;

export const MovementKeysGrid = styled.div`
  display: grid;
  grid-template-areas:
    '. up .'
    'left down right';
  justify-items: center;
  align-items: end;
`;

export const MovementKeyCell = styled.label<{ area: string }>`
  ${textStyles.caption3}
  grid-area: ${(props) => props.area};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: rgba(33, 29, 26, 0.72);
  text-transform: uppercase;
`;

export const KeyHint = styled.p`
  ${textStyles.caption1}
  margin: 4px 0 8px;
  color: var(--ink-3);
  text-align: center;
`;

/** One line that recaps the battle plan: "Stage Hidden Leaf · P1 Deidara · …". */
export const SummaryStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 16px;
  margin: 0 0 8px;
`;

/** One fact of the plan, led by a small square in its colour. */
export const SummaryItem = styled.div<{ accent: string }>`
  display: flex;
  align-items: baseline;
  gap: 8px;
  clip-path: ${chipCut};

  &::before {
    content: '';
    flex: none;
    align-self: center;
    width: 10px;
    height: 10px;
    background: ${(props) => props.accent};
    border: 1px solid var(--anime-ink);
  }

  & span {
    ${textStyles.caption3}
    color: var(--ink-2);
    text-transform: uppercase;
  }

  & strong {
    ${textStyles.body4}
    color: var(--anime-ink);
  }
`;

export const ActionKeysGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(64px, 1fr));
  gap: 8px;
  margin-left: 0;

  @media (max-width: 760px) {
    grid-template-columns: repeat(2, minmax(64px, 1fr));
  }
`;

export const ActionKeyCell = styled.label`
  ${textStyles.caption3}
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  color: rgba(33, 29, 26, 0.72);
  text-transform: uppercase;
`;

export const ActionKeyName = styled.span`
  max-width: 74px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/**
 * The one framed panel on the mission step: picture, title and goals, with
 * the village's mark watermarked at the right (`mark`: a CSS image).
 */
export const MissionBriefing = styled('div', {
  shouldForwardProp: (prop) => prop !== 'accent' && prop !== 'mark',
})<{ accent: string; mark?: string | null }>`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 16px;
  margin: 12px 0 4px;
  padding: 12px;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  background: ${(props) => (props.mark ? `${props.mark} right 12px center / 120px 120px no-repeat, ` : '')}
    color-mix(in srgb, ${(props) => props.accent} 8%, var(--anime-paper));
  box-shadow: 4px 4px 0 var(--anime-orange);

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

// Square: it sits 12 px inside the briefing's 2 px corner.
export const MissionBriefingPreview = styled.div`
  height: 124px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  border-radius: 0;
  background: var(--anime-paper-light);

  @media (max-width: 620px) {
    height: 96px;
  }
`;

// The village line is the theme's overline (Caption 3); the mission title is Heading 4.
export const MissionBriefingDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;

  & .MuiTypography-overline {
    color: var(--anime-teal-deep);
  }

  & .MuiTypography-h5 {
    ${textStyles.heading4}
    letter-spacing: 0.05em;
  }
`;

export const MissionObjectiveList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
`;

/** A goal, led by a small square in the village's colour. */
export const MissionObjectiveItem = styled.li<{ accent: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  clip-path: ${chipCut};

  &::before {
    content: '';
    flex: none;
    width: 10px;
    height: 10px;
    background: ${(props) => props.accent};
    border: 1px solid var(--anime-ink);
  }

  & strong {
    ${textStyles.body4}
    display: block;
    margin-bottom: 0;
    color: var(--anime-ink);
  }
`;

export const MissionActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
`;

export const CampaignRoute = styled.div`
  display: grid;
  /* One row of seven villages in the 980px deck; 92 px or wider on phones. */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 4px;

  @media (max-width: 760px) {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
`;

// Each village card carries its mark, faint in the corner (`markImage`: a CSS
// image). The chosen card has an ink keyline, a hard ink offset and the check
// badge; a locked one is dashed and dimmed, with a lock in its status chip.
export const CampaignRouteCard = styled('button', {
  shouldForwardProp: (prop) => !['active', 'completed', 'locked', 'accent', 'markImage'].includes(String(prop)),
})<{
  active: boolean;
  completed: boolean;
  locked: boolean;
  accent: string;
  markImage?: string | null;
}>`
  position: relative;
  min-height: 56px;
  padding: 8px;
  clip-path: ${panelCut};
  border: ${(props) => (props.active ? '2px solid var(--anime-ink)' : '2px solid var(--ink-1)')};
  border-style: ${(props) => (props.locked ? 'dashed' : 'solid')};
  border-radius: var(--radius);
  background: ${(props) => {
    if (props.locked) return '#e4dccb';
    if (props.completed) return `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`;
    return 'var(--anime-paper-light)';
  }};
  background-image: ${(props) => props.markImage ?? 'none'};
  background-repeat: no-repeat;
  background-position: right 4px bottom 4px;
  background-size: 30px 30px;
  color: ${(props) => (props.locked ? 'var(--ink-2)' : 'var(--anime-ink)')};
  text-align: left;
  cursor: ${(props) => (props.locked ? 'not-allowed' : 'pointer')};
  box-shadow: ${(props) => (props.active ? 'var(--shadow-2)' : 'none')};
  transition: ${transition(['transform'], ['border-color', 'box-shadow'])};

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--anime-ink);
  }

  &:active:not(:disabled) {
    ${PRESSED}
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

// Square: it sits 8 px inside the card's 2 px corner.
export const RouteStatusBadge = styled.span<{ accent: string }>`
  ${textStyles.caption3}
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 8px;
  clip-path: ${chipCut};
  color: var(--anime-ink);
  background: color-mix(in srgb, ${(props) => props.accent} 18%, var(--anime-paper-light));
  border: 1px solid ${(props) => props.accent};
  border-radius: 0;
  margin-right: 16px;
  text-transform: uppercase;

  & svg {
    margin-right: 4px;
    font-size: var(--text-xs);
  }
`;

// Square: it sits 4 px inside the card's 2 px corner.
export const CharacterPortrait = styled.div`
  height: 140px;
  margin: -4px -4px 8px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 0;
  border-radius: 0;
  background: var(--anime-paper-light);

  &.compact {
    height: 92px;
  }
`;

export const CharacterPortraitImage = styled('div', {
  shouldForwardProp: (prop) => !['image', 'backgroundPosition'].includes(String(prop)),
})<{
  image: string;
  backgroundPosition: string;
}>`
  width: 100%;
  height: 100%;
  background-image: url(${(props) => props.image});
  background-size: 600% auto;
  background-position: ${(props) => props.backgroundPosition};
  background-repeat: no-repeat;
`;

// The cast keeps Typography's component prop, so a section title can be an h3.
// The display face at 18/28: smaller than any named Heading, set from the vars.
export const SectionTitle = styled(Typography)`
  position: relative;
  z-index: 0;
  width: fit-content;
  margin: 16px auto 8px;
  padding: 0;
  color: var(--anime-ink);
  background: transparent;
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 400;
  line-height: var(--leading-lg);
  letter-spacing: 0.07em;
  text-transform: uppercase;
  text-align: left;

  /* An orange brush stroke behind the lower half of the words. */
  &::after {
    content: '';
    position: absolute;
    z-index: -1;
    left: -8px;
    right: -8px;
    bottom: 4px;
    height: 0.55em;
    background: var(--anime-orange);
    -webkit-mask-image: var(--brush-swash);
    mask-image: var(--brush-swash);
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    opacity: 0.85;
  }

  @media (max-height: 560px) {
    margin: 8px auto 4px;
  }
` as typeof Typography;

export const SelectionGrid = styled.div`
  display: grid;
  /* Upgrades: as many 118 px or wider columns as fit. */
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 12px;

  &.compact {
    grid-template-columns: repeat(6, minmax(92px, 1fr));
  }

  @media (max-width: 760px) {
    &.compact {
      grid-template-columns: repeat(3, minmax(92px, 1fr));
    }
  }
`;

/**
 * A pick in a grid (a shinobi or an upgrade). The chosen card is tinted in
 * its colour (`accent`, also the square before its name) with an ink
 * keyline, a hard ink offset and the check badge; a locked card is dashed,
 * greyed and says what unlocks it.
 */
export const SelectionCard = styled.button<{ selected: boolean; accent: string }>`
  --card-accent: ${(props) => props.accent};
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  min-height: 88px;
  padding: 8px;
  clip-path: ${panelCut};
  border: 2px solid ${(props) => (props.selected ? 'var(--anime-ink)' : 'var(--ink-1)')};
  border-radius: var(--radius);
  background: ${(props) => (
    props.selected
      ? `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`
      : 'rgba(255,255,255,0.56)'
  )};
  color: var(--anime-ink);
  cursor: pointer;
  text-align: left;
  transition: ${transition(['transform'], ['border-color', 'box-shadow'])};
  box-shadow: ${(props) => (props.selected ? 'var(--shadow-2)' : 'none')};

  &:disabled {
    --card-accent: rgba(33, 29, 26, 0.32);
    cursor: not-allowed;
    background: #e4dccb;
    border-style: dashed;
    border-color: rgba(33, 29, 26, 0.32);
    box-shadow: none;
  }

  &:disabled .card-art {
    filter: grayscale(1) opacity(0.55);
  }

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: var(--anime-ink);
  }

  &:active:not(:disabled) {
    ${PRESSED}
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** A card's name (Title 4 as subtitle2), led by a small square in the card's colour. */
export const CardName = styled(Typography)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 16px;

  &::before {
    content: '';
    flex: none;
    width: 10px;
    height: 10px;
    background: var(--card-accent, var(--action));
    border: 1px solid var(--anime-ink);
  }
` as typeof Typography;

export const StagePreviewImage = styled('div', {
  shouldForwardProp: (prop) => !['image', 'backgroundPosition', 'standalone'].includes(String(prop)),
})<{
  image: string;
  backgroundPosition: string;
  standalone?: boolean;
}>`
  width: 100%;
  height: 100%;
  background-image: url(${(props) => props.image});
  background-size: ${(props) => (props.standalone ? 'cover' : '300% auto')};
  background-position: ${(props) => props.backgroundPosition};
  background-repeat: no-repeat;
  filter: saturate(0.76) contrast(1.08);
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

export const CardMeta = styled(Typography)`
  display: block;
  margin-top: 2px;
  color: rgba(33, 29, 26, 0.72);
`;

/**
 * Corner tag on the selected card, so selection does not rely on colour.
 * Square: it sits 4 px inside the card's 2 px corner. Names and status chips
 * keep 16 px clear on the right so the tag never covers them.
 */
export const SelectedMark = styled.span`
  ${textStyles.caption3}
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  padding: 2px 4px;
  color: var(--anime-paper-light);
  background: var(--anime-ink);
  border-radius: 0;
`;

export const LockBadge = styled.span`
  ${textStyles.caption3}
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding-top: 4px;
  color: var(--anime-ink);
  text-transform: uppercase;

  & svg {
    font-size: var(--text-sm);
  }

  & small {
    ${textStyles.caption4}
    width: 100%;
    color: rgba(33, 29, 26, 0.72);
    text-transform: none;
  }
`;

/* ---- Local Arena: one row of slot cards ---------------------------------- */

/** Two or three seats plus the "+ Add shinobi" seat, in one row. */
export const SlotRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 12px;

  @media (max-height: 560px) {
    margin-top: 6px;
    gap: 10px;
  }

  @media (max-width: 560px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

/**
 * A seat: slot nameplate, portrait, shinobi picker, Human/CPU chip and keys.
 * No frame of its own: the nameplate and portrait carry the shape.
 */
export const SlotCard = styled.div`
  display: grid;
  grid-template-areas:
    'plate'
    'portrait'
    'picker'
    'controller'
    'keys';
  justify-items: center;
  gap: 6px;
  min-width: 0;

  /* Phones and short screens: portrait beside the controls, not above them. */
  @media (max-width: 560px), (max-height: 560px) {
    grid-template-columns: auto minmax(0, 1fr);
    grid-template-areas:
      'plate plate'
      'portrait picker'
      'portrait controller'
      'portrait keys';
    justify-items: start;
    align-items: center;
    column-gap: 10px;
    row-gap: 4px;
  }
`;

export const SlotPlate = styled.div<{ slotColor: string; textColor: string }>`
  grid-area: plate;
  justify-self: stretch;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 28px;
  padding: 0 4px 0 10px;
  color: ${(props) => props.textColor};
  background: ${(props) => props.slotColor};
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 900;
`;

/** The x that removes the third seat. */
export const SlotRemoveButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 22px;
  padding: 0;
  color: var(--anime-paper-light);
  background: var(--anime-ink);
  border: 0;
  border-radius: var(--radius);
  cursor: pointer;

  & svg {
    font-size: 1rem;
  }

  &:focus-visible {
    outline: 3px solid var(--anime-ink);
    outline-offset: 2px;
  }
`;

/** Fixed-size bust cut from the roster board; the picker cycles it. */
export const SlotPortrait = styled('div', {
  shouldForwardProp: (prop) => !['image', 'backgroundPosition'].includes(String(prop)),
})<{ image: string; backgroundPosition: string }>`
  grid-area: portrait;
  width: 104px;
  height: 84px;
  background-color: var(--anime-night);
  background-image: url(${(props) => props.image});
  /* Six busts across the board: each one is the box width. */
  background-size: 600% auto;
  background-position: ${(props) => props.backgroundPosition};
  background-repeat: no-repeat;
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);

  @media (max-width: 560px), (max-height: 560px) {
    width: 72px;
    height: 58px;
  }
`;

export const SlotPicker = styled.div`
  grid-area: picker;
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const SlotPickerButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--anime-ink);
  background: var(--anime-paper-light);
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  cursor: pointer;

  &:hover {
    background: var(--anime-paper);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const SlotName = styled.span`
  min-width: 82px;
  color: var(--anime-ink);
  font-size: 1rem;
  font-weight: 900;
  text-align: center;
`;

/**
 * Human or CPU at a level. A CPU chip is filled ink with a robot mark, so it
 * does not rely on colour to read differently from a human chip.
 */
export const ControllerChip = styled.button<{ cpu: boolean }>`
  grid-area: controller;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 3px 12px;
  color: ${(props) => (props.cpu ? 'var(--anime-paper-light)' : 'var(--anime-ink)')};
  background: ${(props) => (props.cpu ? 'var(--anime-ink)' : 'var(--anime-paper-light)')};
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  font-size: 0.82rem;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;

  & svg {
    font-size: 1.05rem;
  }

  &:disabled {
    cursor: not-allowed;
    border-style: dashed;
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

/** That seat's keys in one short line; a clash turns it into a warning. */
export const SlotKeys = styled.p<{ clash?: boolean }>`
  grid-area: keys;
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: ${(props) => (props.clash ? 'var(--anime-vermilion-deep)' : 'var(--ink-2)')};
  font-size: 0.8rem;
  font-weight: 800;
  text-align: center;

  & svg {
    font-size: 0.95rem;
  }
`;

/** The empty seat: a dashed outline that adds a third shinobi. */
export const AddSlotButton = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 200px;
  padding: 12px;
  color: var(--anime-ink);
  background: transparent;
  border: 2px dashed var(--ink-2);
  border-radius: var(--radius);
  font-size: 0.9rem;
  font-weight: 900;
  text-transform: uppercase;
  cursor: pointer;

  & svg {
    font-size: 2rem;
  }

  &:hover {
    border-color: var(--anime-ink);
    background: rgba(33, 29, 26, 0.04);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (max-width: 560px), (max-height: 560px) {
    flex-direction: row;
    min-height: 44px;

    & svg {
      font-size: 1.3rem;
    }
  }
`;

/* ---- Local Arena: stage strip and rounds --------------------------------- */

export const StageStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;

  @media (max-width: 760px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

export const StageThumb = styled.button<{ chosen: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 4px 2px 6px;
  color: var(--anime-ink);
  background: ${(props) => (props.chosen ? 'var(--anime-paper)' : 'transparent')};
  border: 2px solid ${(props) => (props.chosen ? 'var(--anime-ink)' : 'transparent')};
  border-radius: var(--radius);
  cursor: pointer;

  & > span:last-of-type {
    font-size: 0.75rem;
    font-weight: 800;
    line-height: 1.15;
    text-align: center;
  }

  &:hover {
    border-color: var(--ink-1);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }
`;

export const StageThumbArt = styled.span`
  display: block;
  width: 100%;
  max-width: 72px;
  aspect-ratio: 1;
  overflow: hidden;
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);

  @media (max-height: 560px) {
    max-width: 52px;
  }
`;

/** The selected stage's rule, said once under the strip. */
export const StageCaption = styled.p`
  margin: 6px 0 0;
  color: var(--ink-3);
  font-size: 0.82rem;
  text-align: center;

  & strong {
    color: var(--anime-ink);
  }
`;

export const RoundsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;

  & > span {
    color: var(--anime-ink);
    font-size: 0.82rem;
    font-weight: 900;
    text-transform: uppercase;
  }
`;
