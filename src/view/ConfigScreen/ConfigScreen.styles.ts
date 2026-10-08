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
    width: '1220px',
    maxWidth: '96vw',
    minHeight: 'min(760px, calc(100dvh - 64px))',
    maxHeight: '93dvh',
    padding: '18px 20px 0',
    overflow: 'hidden',
    borderRadius: 2,
    clipPath: panelCut,
    color: 'var(--anime-ink)',
    backgroundColor: 'var(--anime-paper-light)',
    backgroundImage: 'radial-gradient(rgba(33,29,26,0.1) 0.6px, transparent 0.6px)',
    backgroundSize: '5px 5px',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-teal)',
  },
  '& .MuiDialogTitle-root': {
    position: 'relative',
    width: 'fit-content',
    minWidth: 320,
    margin: '0 auto 12px',
    padding: '8px 38px 9px',
    clipPath: bannerCut,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-vermilion)',
    fontWeight: 900,
    letterSpacing: 0,
    textAlign: 'center',
    textTransform: 'uppercase',
    boxShadow: '4px 4px 0 var(--anime-ink)',
  },
  '& .MuiDialogContent-root': {
    padding: '0 4px 18px',
    overflowX: 'hidden',
    borderTop: '2px solid var(--anime-ink)',
  },
  '& .MuiStepper-root': {
    margin: '0 auto 14px',
    padding: '9px 12px',
    maxWidth: 760,
    clipPath: chipCut,
    background: 'var(--anime-paper)',
    border: '2px solid var(--anime-ink)',
  },
  '& .MuiStepLabel-label': {
    color: 'rgba(33,29,26,0.62)',
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': {
    color: 'var(--anime-ink)',
  },
  '& .MuiStepIcon-root': {
    color: 'rgba(33,29,26,0.2)',
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
    borderRadius: 2,
    clipPath: chipCut,
    fontWeight: 900,
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  '& .MuiButton-contained': {
    background: 'var(--anime-vermilion)',
    color: 'var(--anime-paper-light)',
    border: '2px solid var(--anime-ink)',
    boxShadow: '3px 3px 0 var(--anime-ink)',
  },
  '& .MuiButton-contained:hover': {
    background: '#d65343',
  },
  '& .MuiButton-outlined': {
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: 'var(--anime-ink)',
    background: 'rgba(212,163,63,0.2)',
  },
  '& .MuiStepButton-root': {
    padding: '4px 8px',
    margin: '-4px -8px',
  },
  '& .MuiToggleButton-root': {
    minWidth: 58,
    color: 'var(--anime-ink)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--anime-paper-light)',
    fontWeight: 900,
    clipPath: chipCut,
  },
  '& .MuiToggleButton-root.Mui-selected': {
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-teal)',
  },
  '@media (max-width: 680px)': {
    '& .MuiDialog-paper': {
      padding: '14px 12px 0',
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
  justify-content: center;
  gap: 12px;
  width: 100%;
  margin-top: 22px;
  padding: 16px 0 18px;
  background: linear-gradient(180deg, transparent, var(--anime-paper-light) 42%);
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
  background: var(--anime-paper);
  border: 2px solid var(--anime-ink);
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
  color: rgba(33, 29, 26, 0.6);
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
    color: rgba(33, 29, 26, 0.6);
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
  border: 2px solid var(--anime-ink);
  border-left: 8px solid ${(props) => props.accent};
  background: var(--anime-paper);
  box-shadow: 4px 4px 0 var(--anime-ink);

  @media (max-width: 780px) {
    grid-template-columns: 1fr;
  }
`;

export const MissionBriefingPreview = styled.div`
  min-height: 238px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  background: var(--anime-paper-light);
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
    grid-template-columns: 1fr;
  }
`;

export const MissionObjectiveItem = styled.div<{ accent: string }>`
  min-height: 64px;
  padding: 9px 10px;
  clip-path: ${chipCut};
  background: var(--anime-paper-light);
  border: 1px solid var(--anime-ink);
  border-left: 5px solid ${(props) => props.accent};

  & strong {
    display: block;
    margin-bottom: 4px;
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
  min-height: 116px;
  padding: 10px;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  border-top: 7px solid ${(props) => (props.active ? props.accent : 'var(--anime-ink)')};
  background: ${(props) => {
    if (props.locked) return '#d2c9b5';
    if (props.completed) return `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`;
    return 'var(--anime-paper-light)';
  }};
  color: var(--anime-ink);
  text-align: left;
  cursor: ${(props) => (props.locked ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.locked ? 0.54 : 1)};
  box-shadow: ${(props) => (props.active ? '4px 4px 0 var(--anime-ink)' : 'none')};
  transition: transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 4px 4px 0 var(--anime-ink);
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
  color: var(--anime-paper-light);
  background: ${(props) => props.accent};
  font-size: 0.62rem;
  font-weight: 900;
  text-transform: uppercase;
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
  height: 174px;
  margin: -6px -6px 10px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  background: var(--anime-paper-light);
`;

export const CharacterPortraitImage = styled.div<{
  image: string;
  backgroundPosition: string;
}>`
  width: 100%;
  height: 100%;
  background-image: url(${(props) => props.image});
  background-size: 600% 280%;
  background-position: ${(props) => props.backgroundPosition};
  background-repeat: no-repeat;
`;

export const SectionTitle = styled(Typography)`
  position: relative;
  z-index: 0;
  width: fit-content;
  margin: 20px auto 12px;
  padding: 6px 36px 7px;
  clip-path: ${bannerCut};
  color: var(--anime-paper-light);
  background: var(--anime-teal);
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
  text-align: center;
`;

export const SelectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(164px, 1fr));
  gap: 10px;
`;

export const SelectionCard = styled.button<{ selected: boolean; accent: string }>`
  position: relative;
  min-height: 132px;
  padding: 10px;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  background: ${(props) => (
    props.selected
      ? `color-mix(in srgb, ${props.accent} 18%, var(--anime-paper-light))`
      : 'var(--anime-paper-light)'
  )};
  color: var(--anime-ink);
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  box-shadow: ${(props) => (
    props.selected
      ? '4px 4px 0 var(--anime-ink)'
      : 'none'
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
    filter: grayscale(0.78) brightness(0.62);
  }

  &:hover:not(:disabled) {
    transform: translateY(-3px);
    border-color: ${(props) => props.accent};
    box-shadow: 4px 4px 0 var(--anime-ink);
  }

  &:focus-visible {
    outline: 2px solid var(--anime-ink);
    outline-offset: 3px;
    box-shadow: inset 0 0 0 3px var(--anime-paper-light), 0 0 0 2px ${(props) => props.accent};
  }
`;

export const StagePreview = styled.div`
  height: 128px;
  margin: -6px -6px 10px;
  overflow: hidden;
  clip-path: ${panelCut};
  border: 2px solid var(--anime-ink);
  background: var(--anime-paper-light);
`;

export const StagePreviewImage = styled.div<{
  image: string;
  backgroundPosition: string;
}>`
  width: 100%;
  height: 100%;
  background-image: url(${(props) => props.image});
  background-size: 300% 200%;
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
  color: rgba(33, 29, 26, 0.72);
`;

export const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;
