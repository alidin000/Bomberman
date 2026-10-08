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
  '& .MuiDialog-paper': {
    width: '980px',
    maxWidth: 'calc(100vw - 16px)',
    minHeight: 'min(760px, calc(100dvh - 16px))',
    maxHeight: 'calc(100dvh - 16px)',
    margin: 8,
    padding: '18px 20px 0',
    overflow: 'hidden',
    borderRadius: 8,
    clipPath: panelCut,
    color: 'var(--anime-ink)',
    backgroundColor: '#f5eee1',
    backgroundImage: 'none',
    border: '1px solid rgba(255,255,255,0.45)',
    boxShadow: '0 30px 90px rgba(17,31,36,0.3)',
  },
  '& .MuiDialogTitle-root': {
    position: 'relative',
    width: 'fit-content',
    minWidth: 320,
    margin: '0 auto 12px',
    padding: '8px 38px 9px',
    clipPath: bannerCut,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-teal)',
    fontWeight: 900,
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
    borderRadius: 8,
    boxShadow: '0 10px 24px rgba(17,31,36,0.16)',
  },
  '& .MuiDialogContent-root': {
    padding: '0 4px 18px',
    overflowX: 'hidden',
    borderTop: 0,
    // Focus moves scroll items into view; keep them above the sticky footer.
    scrollPaddingBottom: 110,
  },
  '& .MuiStepper-root': {
    margin: '0 auto 14px',
    padding: '9px 12px',
    maxWidth: 760,
    clipPath: chipCut,
    background: 'rgba(255,255,255,0.42)',
    border: 0,
    borderRadius: 8,
  },
  '& .MuiStepLabel-label': {
    color: 'rgba(33,29,26,0.8)',
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': {
    color: 'var(--anime-ink)',
  },
  '& .MuiStepIcon-root': {
    color: 'rgba(33,29,26,0.62)',
  },
  '& .MuiStepLabel-labelContainer .MuiTypography-caption': {
    display: 'block',
    color: 'rgba(33,29,26,0.72)',
    fontSize: '0.66rem',
    lineHeight: 1.1,
  },
  '& .MuiStepIcon-text': {
    fill: 'var(--anime-paper-light)',
    fontWeight: 900,
  },
  '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
    color: 'var(--anime-vermilion)',
  },
  '& .MuiTypography-colorTextSecondary': {
    color: 'rgba(33,29,26,0.66)',
  },
  '& .MuiButton-root': {
    borderRadius: 8,
    clipPath: chipCut,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  '& .MuiButton-contained': {
    background: 'var(--anime-vermilion)',
    color: 'var(--anime-paper-light)',
    border: 0,
    boxShadow: '0 8px 18px rgba(33,29,26,0.16)',
  },
  '& .MuiButton-contained:hover': {
    background: 'var(--anime-vermilion-deep)',
  },
  '& .MuiButton-contained.Mui-disabled': {
    color: 'rgba(33,29,26,0.6)',
    background: 'rgba(33,29,26,0.12)',
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
    outline: '3px solid var(--anime-ink)',
    outlineOffset: 2,
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'rgba(33,29,26,0.32)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-teal)',
    background: 'rgba(212,163,63,0.2)',
  },
  '& .MuiStepButton-root': {
    padding: '4px 8px',
    margin: '-4px -8px',
  },
  '& .MuiToggleButton-root': {
    minWidth: 58,
    color: 'var(--anime-ink)',
    borderColor: 'rgba(33,29,26,0.22)',
    background: 'rgba(255,255,255,0.42)',
    fontWeight: 900,
    clipPath: chipCut,
  },
  '& .MuiToggleButton-root.Mui-selected': {
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-teal)',
  },
  '& .MuiToggleButton-root.Mui-selected:hover': {
    background: '#2b5c58',
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
      padding: '14px 12px 0',
    },
    // Keep the footer actions on one row on phones.
    '& .MuiButton-sizeLarge': {
      minWidth: 0,
      padding: '8px 12px',
      fontSize: '0.86rem',
    },
    '& .MuiDialogTitle-root': {
      minWidth: 0,
      width: '100%',
      fontSize: '1rem',
    },
  },
});

export const StepContent = styled.div`
  margin-top: 14px;
  margin-bottom: 0;
  padding-bottom: 98px;
`;

export const CenteredButtonContainer = styled.div`
  position: sticky;
  bottom: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  width: 100%;
  margin-top: 22px;
  padding: 16px 0 18px;
  background: linear-gradient(180deg, transparent, #f5eee1 42%);

  @media (max-width: 680px) {
    gap: 8px;
  }
`;

/** Row of pre-match options; hidden while it has no options. */
export const SetupOptions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin: 14px 0 4px;

  &:empty {
    display: none;
  }
`;

export const SetupOption = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.38);
  border: 1px solid rgba(33, 29, 26, 0.16);
  border-radius: 8px;

  & .MuiTypography-h6 {
    font-size: 1rem;
    font-weight: 900;
    text-transform: uppercase;
  }
`;

export const ModeToggleText = styled.span`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  line-height: 1.15;

  & small {
    font-size: 0.68rem;
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
  margin-bottom: ${(props) => (props.numOfPlayers === '2' ? '28px' : '16px')};
  margin-top: ${(props) => (props.numOfPlayers === '2' ? '22px' : '14px')};
  padding: 14px;
  clip-path: ${panelCut};
  background: var(--anime-paper);
  border: 2px solid var(--anime-ink);

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
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
    outline: 2px solid var(--anime-ink);
    outline-offset: 2px;
    border-color: var(--anime-teal);
    box-shadow: 0 0 0 3px rgba(53, 111, 107, 0.24);
  }
  &[data-error='true'] {
    border-color: var(--anime-vermilion);
    box-shadow: 0 0 0 3px rgba(189, 63, 50, 0.24);
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
  margin: 6px 0 14px;
  color: rgba(33, 29, 26, 0.8);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-align: center;
  text-transform: uppercase;
`;

export const SummaryStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 18px;
`;

export const SummaryItem = styled.div<{ accent: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  clip-path: ${chipCut};
  background: color-mix(in srgb, ${(props) => props.accent} 12%, var(--anime-paper-light));
  border: 2px solid var(--anime-ink);
  font-size: 0.74rem;

  & span {
    color: rgba(33, 29, 26, 0.8);
    font-size: 0.62rem;
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

export const MissionBriefing = styled.div<{ accent: string }>`
  display: grid;
  grid-template-columns: minmax(220px, 0.82fr) minmax(320px, 1.18fr);
  gap: 14px;
  margin: 0 0 18px;
  padding: 14px;
  clip-path: ${panelCut};
  border: 0;
  border-radius: 8px;
  background: color-mix(in srgb, ${(props) => props.accent} 8%, #fffaf0);
  box-shadow: 0 14px 34px rgba(33, 29, 26, 0.1);

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

export const MissionBriefingPreview = styled.div`
  min-height: 238px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 0;
  border-radius: 7px;
  background: var(--anime-paper-light);

  @media (max-width: 780px) {
    min-height: 150px;
  }
`;

export const MissionBriefingDetails = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;

  & .MuiTypography-overline {
    color: var(--anime-teal);
    letter-spacing: 0;
  }
`;

export const MissionObjectiveList = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 12px;

  @media (max-width: 620px) {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
`;

export const MissionObjectiveItem = styled.div<{ accent: string }>`
  min-height: 36px;
  padding: 8px 10px;
  clip-path: ${chipCut};
  background: var(--anime-paper-light);
  border: 0;
  border-left: 4px solid ${(props) => props.accent};
  border-radius: 6px;

  & strong {
    display: block;
    margin-bottom: 0;
    color: var(--anime-ink);
    font-size: 0.82rem;
  }

  & span {
    color: rgba(33, 29, 26, 0.7);
    font-size: 0.72rem;
    font-weight: 900;
    text-transform: uppercase;
  }
`;

export const MissionActionRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 14px;
`;

export const CampaignRoute = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
  margin: 10px 0 16px;
`;

export const CampaignRouteCard = styled.button<{
  active: boolean;
  completed: boolean;
  locked: boolean;
  accent: string;
}>`
  position: relative;
  min-height: 82px;
  padding: 12px;
  clip-path: ${panelCut};
  border: ${(props) => (props.active ? '2px solid var(--anime-ink)' : '1px solid rgba(33, 29, 26, 0.14)')};
  border-style: ${(props) => (props.locked ? 'dashed' : 'solid')};
  border-radius: 8px;
  border-top: 4px solid ${(props) => (props.active ? props.accent : 'transparent')};
  background: ${(props) => {
    if (props.locked) return '#e4dccb';
    if (props.completed) return `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`;
    return 'var(--anime-paper-light)';
  }};
  color: ${(props) => (props.locked ? 'rgba(33, 29, 26, 0.72)' : 'var(--anime-ink)')};
  text-align: left;
  cursor: ${(props) => (props.locked ? 'not-allowed' : 'pointer')};
  box-shadow: ${(props) => (props.active ? '0 12px 24px rgba(33,29,26,0.14)' : 'none')};
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 24px rgba(33,29,26,0.14);
  }

  &:focus-visible {
    outline: 2px solid var(--anime-ink);
    outline-offset: 3px;
    box-shadow: inset 0 0 0 3px var(--anime-paper-light), 0 0 0 2px ${(props) => props.accent};
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
  border-radius: 999px;
  font-size: 0.62rem;
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
  margin: -6px -6px 10px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 0;
  border-radius: 6px;
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

export const SectionTitle = styled(Typography)`
  position: relative;
  z-index: 0;
  width: fit-content;
  margin: 20px auto 12px;
  padding: 0;
  color: var(--anime-ink);
  background: transparent;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
  text-align: left;
`;

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
  padding: 10px;
  clip-path: ${panelCut};
  border: 2px solid ${(props) => (props.selected ? 'var(--anime-ink)' : 'rgba(33, 29, 26, 0.12)')};
  border-radius: 8px;
  background: ${(props) => (
    props.selected
      ? `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`
      : 'rgba(255,255,255,0.56)'
  )};
  color: var(--anime-ink);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  box-shadow: ${(props) => (
    props.selected
      ? '0 12px 26px rgba(33,29,26,0.14)'
      : '0 5px 16px rgba(33,29,26,0.06)'
  )};

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
    transform: translateY(-3px);
    border-color: ${(props) => props.accent};
    box-shadow: 0 12px 26px rgba(33,29,26,0.14);
  }

  &:focus-visible {
    outline: 2px solid var(--anime-ink);
    outline-offset: 3px;
    box-shadow: inset 0 0 0 3px var(--anime-paper-light), 0 0 0 2px ${(props) => props.accent};
  }
`;

export const StagePreview = styled.div`
  height: 110px;
  margin: -6px -6px 10px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 0;
  border-radius: 6px;
  background: var(--anime-paper-light);
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
