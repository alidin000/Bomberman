import styled from '@emotion/styled';
import { Dialog, Typography, ToggleButton } from '@mui/material';

type PlayerControlsRowProps = {
  numOfPlayers: string;
};

const panelCut = 'none';
const chipCut = 'none';
const bannerCut = 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)';

export const StyledDialog = styled(Dialog)({
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(33, 29, 26, 0.78)',
  },
  // The house dialog frame (shared with Settings): paper, ink keyline and a
  // hard teal offset. The footer sits below the scrolling content, never on it.
  '& .MuiDialog-paper': {
    width: '980px',
    maxWidth: 'calc(100vw - 16px)',
    minHeight: 'min(760px, calc(100dvh - 16px))',
    maxHeight: 'calc(100dvh - 16px)',
    margin: 8,
    padding: '16px 20px 0',
    overflow: 'hidden',
    borderRadius: 'var(--radius)',
    clipPath: panelCut,
    color: 'var(--anime-ink)',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'none',
    border: '3px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-frame)',
  },
  '& .MuiDialogTitle-root': {
    position: 'relative',
    width: 'fit-content',
    minWidth: 280,
    margin: '0 auto 8px',
    padding: '6px 34px 7px',
    clipPath: bannerCut,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-ink)',
    fontSize: '1.1rem',
    fontWeight: 900,
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
    // Focused by script when a step opens, so screen readers announce it.
    // It is not a control, so it shows no focus ring.
    '&:focus': {
      outline: 'none',
    },
  },
  '& .MuiDialogContent-root': {
    padding: '0 4px 14px',
    overflowX: 'hidden',
    borderTop: 0,
    scrollPaddingBottom: 14,
  },
  '& .MuiStepper-root': {
    margin: '0 auto 10px',
    padding: '2px 12px',
    maxWidth: 640,
    clipPath: chipCut,
    background: 'transparent',
    border: 0,
  },
  '& .MuiStepLabel-label': {
    color: 'var(--ink-3)',
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontSize: '0.75rem',
  },
  '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': {
    color: 'var(--anime-ink)',
  },
  '& .MuiStepIcon-root': {
    color: 'var(--ink-2)',
  },
  '& .MuiStepLabel-labelContainer .MuiTypography-caption': {
    display: 'block',
    color: 'var(--ink-2)',
    fontSize: '0.66rem',
    lineHeight: 1.1,
  },
  '& .MuiStepIcon-text': {
    fill: 'var(--anime-paper-light)',
    fontWeight: 900,
  },
  '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
    color: 'var(--action)',
  },
  '& .MuiTypography-colorTextSecondary': {
    color: 'var(--ink-2)',
  },
  '& .MuiButton-root': {
    borderRadius: 'var(--radius)',
    clipPath: chipCut,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  // The one primary call-to-action look: teal, ink keyline, hard shadow.
  '& .MuiButton-contained, & .MuiButton-contained.Mui-focusVisible': {
    background: 'var(--action)',
    color: 'var(--anime-paper-light)',
    border: '2px solid var(--anime-ink)',
    boxShadow: 'var(--shadow-1)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--action-deep)',
    boxShadow: 'var(--shadow-1)',
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
    background: 'rgba(33,29,26,0.08)',
  },
  '& .MuiButtonBase-root.Mui-focusVisible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
  // The teal ring is the focus mark; MUI's pulsing focus ripple would be a second one.
  '& .MuiTouchRipple-ripplePulsate': {
    display: 'none',
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--action)',
    background: 'rgba(53,111,107,0.1)',
  },
  '& .MuiStepButton-root': {
    padding: '4px 8px',
    margin: '-4px -8px',
  },
  '& .MuiToggleButton-root': {
    minWidth: 58,
    color: 'var(--anime-ink)',
    borderColor: 'var(--ink-1)',
    background: 'rgba(255,255,255,0.42)',
    fontWeight: 900,
    clipPath: chipCut,
  },
  '& .MuiToggleButton-root.Mui-selected': {
    color: 'var(--anime-paper-light)',
    background: 'var(--action)',
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
      padding: '12px 12px 0',
    },
    // Keep the footer actions on one row on phones.
    '& .MuiButton-sizeLarge': {
      minWidth: 0,
      padding: '8px 10px',
      fontSize: '0.8rem',
    },
    '& .MuiDialogTitle-root': {
      minWidth: 0,
      fontSize: '0.95rem',
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
      padding: '6px 14px 0',
    },
    '& .MuiDialogTitle-root': {
      margin: '0 auto 2px',
      padding: '2px 26px 3px',
      fontSize: '0.85rem',
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
      minWidth: 0,
      padding: '4px 14px',
      fontSize: '0.84rem',
    },
  },
});

export const StepContent = styled.div`
  margin-top: 12px;
  margin-bottom: 0;

  @media (max-height: 560px) {
    margin-top: 6px;
  }
`;

/** The deck footer: Back/Main Menu, Next and the one primary action. */
export const DeckFooter = styled.div`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 -20px;
  padding: 10px 20px 12px;
  background: var(--anime-paper-light);
  border-top: 2px solid var(--anime-ink);

  @media (max-width: 680px) {
    margin: 0 -12px;
    padding: 8px 12px 10px;
  }

  @media (max-height: 560px) {
    margin: 0 -14px;
    padding: 5px 14px 6px;
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
    gap: 6px;
  }

  /* Phones: the three actions sit side by side at their own widths. */
  @media (max-width: 560px) {
    display: flex;
    justify-content: center;
  }
`;

/** One line on how to drive the menu from the keyboard. */
export const FooterHint = styled.p`
  margin: 0;
  color: var(--ink-2);
  font-size: 0.75rem;
  font-weight: 700;

  @media (max-width: 560px), (max-height: 560px) {
    display: none;
  }
`;

export const ModeToggleText = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.15;

  & small {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: none;
    opacity: 0.9;
  }
`;

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 24px 0;
  padding: 12px 14px;
  clip-path: ${chipCut};
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid rgba(33, 29, 26, 0.16);
  border-radius: 8px;
`;

export const PlayerControlsRow = styled.div<PlayerControlsRowProps>`
  display: grid;
  grid-template-columns: minmax(120px, 0.28fr) minmax(160px, 0.34fr) minmax(280px, 1fr);
  align-items: center;
  gap: 16px;
  margin-bottom: ${(props) => (props.numOfPlayers === '2' ? '16px' : '10px')};
  margin-top: ${(props) => (props.numOfPlayers === '2' ? '12px' : '8px')};
  padding: 10px 4px 0;
  clip-path: ${panelCut};
  border-top: 2px solid var(--ink-1);

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
  font-size: 1rem;
  font-weight: 900;
  min-width: 0;
  color: var(--anime-ink);
  text-transform: uppercase;
`;

export const KeyGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 0;
`;

export const KeyRow = styled.div`
  display: flex;
`;

export const KeyConfigInput = styled.input`
  width: 46px;
  height: 46px;
  margin: 3px;
  text-align: center;
  font-size: 18px;
  font-weight: 900;
  border-radius: 2px;
  border: 2px solid var(--anime-ink);
  background: var(--anime-paper-light);
  color: var(--anime-ink);
  cursor: pointer;
  caret-color: transparent;
  box-shadow: 2px 2px 0 var(--anime-mustard);
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
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
  grid-area: ${(props) => props.area};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  color: rgba(33, 29, 26, 0.72);
  font-size: 0.64rem;
  font-weight: 900;
  text-transform: uppercase;
`;

export const KeyHint = styled.p`
  margin: 4px 0 8px;
  color: var(--ink-3);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
`;

/** One line that recaps the battle plan: "Stage Hidden Leaf · P1 Deidara · …". */
export const SummaryStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 14px;
  margin: 0 0 6px;
`;

export const SummaryItem = styled.div<{ accent: string }>`
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding-left: 8px;
  clip-path: ${chipCut};
  border-left: 4px solid ${(props) => props.accent};
  font-size: 0.82rem;

  & span {
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }

  & strong {
    color: var(--anime-ink);
    font-weight: 900;
  }
`;

export const ExtraKeys = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-left: 25px;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  color: rgba(33, 29, 26, 0.72);
  font-size: 0.64rem;
  font-weight: 900;
  text-transform: uppercase;
`;

export const ActionKeyName = styled.span`
  max-width: 74px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const MapToggleButton = styled(ToggleButton)`
  width: 140px;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-radius: 2px !important;
  clip-path: ${panelCut};

  &:hover {
    transform: translateY(-4px);
    box-shadow: 4px 4px 0 var(--anime-ink);
  }

  & img {
    width: 100%;
    height: auto;
    margin-bottom: 8px;
    border-radius: 0;
  }

  &.Mui-selected, &.Mui-selected:hover {
    background-color: rgba(53, 111, 107, 0.2);
    border-color: var(--anime-teal);
    transform: translateY(-4px);
  }
`;

export const ConfigIntro = styled.div`
  position: relative;
  margin-bottom: 18px;
  padding: 16px 18px 16px 22px;
  clip-path: ${panelCut};
  background: var(--anime-paper);
  border: 2px solid var(--anime-ink);

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 5px;
    background: var(--anime-teal);
  }
`;

/** The one framed panel on the mission step: picture, title and goals. */
export const MissionBriefing = styled.div<{ accent: string }>`
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 14px;
  margin: 12px 0 4px;
  padding: 10px;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  background: color-mix(in srgb, ${(props) => props.accent} 8%, var(--anime-paper));

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
    gap: 8px;
  }
`;

export const MissionBriefingPreview = styled.div`
  height: 124px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  border-radius: var(--radius);
  background: var(--anime-paper-light);

  @media (max-width: 620px) {
    height: 96px;
  }
`;

export const MissionBriefingDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;

  & .MuiTypography-overline {
    color: var(--anime-teal-deep);
    letter-spacing: 0;
    line-height: 1.6;
  }

  & .MuiTypography-h5 {
    font-size: 1.35rem;
    line-height: 1.2;
  }
`;

export const MissionObjectiveList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
`;

export const MissionObjectiveItem = styled.li<{ accent: string }>`
  padding-left: 8px;
  clip-path: ${chipCut};
  border-left: 4px solid ${(props) => props.accent};

  & strong {
    display: block;
    margin-bottom: 0;
    color: var(--anime-ink);
    font-size: 0.82rem;
  }
`;

export const MissionActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
`;

export const CampaignRoute = styled.div`
  display: grid;
  /* One row of seven villages in the 980px deck, four per row on phones. */
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  margin: 0 0 4px;

  @media (max-width: 760px) {
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  }
`;

export const CampaignRouteCard = styled.button<{
  active: boolean;
  completed: boolean;
  locked: boolean;
  accent: string;
}>`
  position: relative;
  min-height: 56px;
  padding: 6px 8px;
  clip-path: ${panelCut};
  border: ${(props) => (props.active ? '2px solid var(--anime-ink)' : '2px solid var(--ink-1)')};
  border-style: ${(props) => (props.locked ? 'dashed' : 'solid')};
  border-radius: var(--radius);
  border-top: 4px solid ${(props) => (props.active ? props.accent : 'transparent')};
  background: ${(props) => {
    if (props.locked) return '#e4dccb';
    if (props.completed) return `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`;
    return 'var(--anime-paper-light)';
  }};
  color: ${(props) => (props.locked ? 'var(--ink-2)' : 'var(--anime-ink)')};
  text-align: left;
  cursor: ${(props) => (props.locked ? 'not-allowed' : 'pointer')};
  box-shadow: ${(props) => (props.active ? 'var(--shadow-1)' : 'none')};
  transition: transform 0.16s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const RouteStatusBadge = styled.span<{ accent: string }>`
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 3px 7px;
  clip-path: ${chipCut};
  color: var(--anime-ink);
  background: color-mix(in srgb, ${(props) => props.accent} 18%, var(--anime-paper-light));
  border: 1px solid ${(props) => props.accent};
  border-radius: var(--radius);
  font-size: 0.68rem;
  font-weight: 900;
  text-transform: uppercase;

  & svg {
    margin-right: 3px;
    font-size: 0.8rem;
  }
`;

export const FlowStepStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 8px 0 16px;
`;

export const FlowStepPill = styled.span<{ active?: boolean }>`
  padding: 5px 8px;
  clip-path: ${chipCut};
  color: ${(props) => (props.active ? 'var(--anime-paper-light)' : 'var(--anime-ink)')};
  background: ${(props) => (props.active ? 'var(--anime-teal)' : 'var(--anime-paper)')};
  border: 1px solid var(--anime-ink);
  font-size: 0.68rem;
  font-weight: 900;
`;

export const ReferenceBoard = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 0.9fr) minmax(300px, 1.1fr);
  gap: 14px;
  margin: 16px 0 20px;
`;

export const ReferenceImage = styled.img`
  width: 100%;
  height: 180px;
  object-fit: cover;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  box-shadow: 4px 4px 0 var(--anime-mustard);
  filter: saturate(0.75) contrast(1.06);
`;

export const CharacterPortrait = styled.div`
  height: 140px;
  margin: -4px -4px 8px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 0;
  border-radius: var(--radius);
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
export const SectionTitle = styled(Typography)`
  position: relative;
  z-index: 0;
  width: fit-content;
  margin: 14px auto 6px;
  padding: 0;
  color: var(--anime-ink);
  background: transparent;
  font-size: 0.82rem;
  font-weight: 900;
  line-height: 1.4;
  letter-spacing: 0;
  text-transform: uppercase;
  text-align: left;

  @media (max-height: 560px) {
    margin: 8px auto 4px;
  }
` as typeof Typography;

export const SelectionGrid = styled.div`
  display: grid;
  /* 118px lets all seven stages share one row in the 980px deck. */
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

export const SelectionCard = styled.button<{ selected: boolean; accent: string }>`
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
  transition: transform 0.16s ease, border-color 0.16s ease;
  box-shadow: ${(props) => (props.selected ? 'var(--shadow-1)' : 'none')};

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    width: 4px;
    background: ${(props) => props.accent};
    opacity: ${(props) => (props.selected ? 1 : 0.46)};
  }

  &:disabled {
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

  &:focus-visible {
    outline: var(--focus-ring);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

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

export const AbilityLine = styled.div<{ color: string }>`
  margin-top: 8px;
  padding: 6px 8px;
  border-left: 3px solid ${(props) => props.color};
  clip-path: ${chipCut};
  background: var(--anime-paper-light);
  color: rgba(33, 29, 26, 0.78);
  font-size: 0.72rem;
`;

export const LoadoutGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin-top: 8px;
`;

export const LoadoutRow = styled.div<{ color: string }>`
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 8px;
  align-items: center;
  padding: 5px 7px;
  clip-path: ${chipCut};
  background: color-mix(in srgb, ${(props) => props.color} 12%, var(--anime-paper-light));
  border: 1px solid var(--anime-ink);
  font-size: 0.72rem;
`;

export const LoadoutKey = styled.span`
  color: rgba(33, 29, 26, 0.68);
  font-weight: 900;
  text-transform: uppercase;
`;

export const PowerLoadoutGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
  margin-top: 8px;
`;

export const PowerLoadoutItem = styled.div<{ color: string }>`
  min-height: 42px;
  padding: 6px 7px;
  clip-path: ${chipCut};
  background: color-mix(in srgb, ${(props) => props.color} 12%, var(--anime-paper-light));
  border: 1px solid var(--anime-ink);
  color: rgba(33, 29, 26, 0.74);
  font-size: 0.66rem;
  line-height: 1.22;
`;

export const PowerLoadoutName = styled.strong<{ color: string }>`
  display: block;
  margin-bottom: 2px;
  color: ${(props) => props.color};
  font-size: 0.68rem;
  text-transform: uppercase;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
`;

export const ColorOrb = styled.span<{ color: string }>`
  width: 32px;
  height: 32px;
  flex: 0 0 auto;
  clip-path: polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%);
  background: ${(props) => props.color};
  border: 2px solid var(--anime-ink);
`;

export const CardMeta = styled(Typography)`
  display: block;
  margin-top: 2px;
  color: rgba(33, 29, 26, 0.72);
`;

/** Corner tag on the selected card, so selection does not rely on colour. */
export const SelectedMark = styled.span`
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  padding: 2px 7px;
  color: var(--anime-paper-light);
  background: var(--anime-ink);
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 900;
  line-height: 1.3;
`;

export const LockBadge = styled.span`
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-top: auto;
  padding-top: 4px;
  color: var(--anime-ink);
  font-size: 0.7rem;
  font-weight: 900;
  text-transform: uppercase;

  & svg {
    font-size: 0.9rem;
  }

  & small {
    width: 100%;
    color: rgba(33, 29, 26, 0.72);
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: none;
  }
`;

export const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
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
