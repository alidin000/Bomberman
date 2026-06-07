import styled from '@emotion/styled';
import { Dialog, Typography, ToggleButton } from '@mui/material';

type PlayerControlsRowProps = {
  numOfPlayers: string;
};

export const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    width: '1180px',
    maxWidth: '95vw',
    minHeight: '760px',
    maxHeight: '92vh',
    padding: '20px 22px 0',
    borderRadius: 8,
    overflow: 'hidden',
    background: 'linear-gradient(145deg, rgba(15, 15, 16, 0.98), rgba(43, 34, 25, 0.97))',
    color: '#f8fafc',
    border: '1px solid rgba(255,255,255,0.16)',
    boxShadow: '0 26px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.1)',
  },
  '& .MuiDialogTitle-root': {
    padding: '0 0 14px',
    color: '#fff7ed',
    fontWeight: 900,
    letterSpacing: '0.06em',
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadow: '0 2px 0 #000',
  },
  '& .MuiDialogContent-root': {
    padding: '0 4px 18px',
    overflowX: 'hidden',
  },
  '& .MuiStepper-root': {
    margin: '0 auto 12px',
    padding: '10px 12px',
    maxWidth: 720,
    borderRadius: 6,
    background: 'linear-gradient(90deg, rgba(0,0,0,0.34), rgba(255,255,255,0.07), rgba(0,0,0,0.34))',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  '& .MuiStepLabel-label': {
    color: 'rgba(248,250,252,0.62)',
    fontWeight: 800,
    textTransform: 'uppercase',
    fontSize: '0.72rem',
  },
  '& .MuiStepLabel-label.Mui-active, & .MuiStepLabel-label.Mui-completed': {
    color: '#ffd166',
  },
  '& .MuiStepIcon-root': {
    color: 'rgba(255,255,255,0.18)',
  },
  '& .MuiStepIcon-root.Mui-active, & .MuiStepIcon-root.Mui-completed': {
    color: '#f59e0b',
  },
  '& .MuiTypography-colorTextSecondary': {
    color: 'rgba(248,250,252,0.64)',
  },
  '& .MuiButton-contained': {
    borderRadius: 6,
    background: 'linear-gradient(180deg, #f5a524, #ad4f12)',
    color: '#111827',
    fontWeight: 900,
    boxShadow: '0 10px 24px rgba(0,0,0,0.34)',
  },
  '& .MuiButton-contained:hover': {
    background: 'linear-gradient(180deg, #ffd166, #c25a13)',
  },
  '& .MuiToggleButton-root': {
    color: '#f8fafc',
    borderColor: 'rgba(255,255,255,0.18)',
    background: 'rgba(0,0,0,0.24)',
    fontWeight: 800,
  },
  '& .MuiToggleButton-root.Mui-selected': {
    color: '#111827',
    background: '#ffd166',
  },
});

export const StepContent = styled.div`
  margin-top: 16px;
  margin-bottom: 0;
  padding-bottom: 96px;
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
  background: linear-gradient(180deg, rgba(28, 22, 18, 0), rgba(28, 22, 18, 0.96) 42%);
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 24px 0;
`;

export const PlayerControlsRow = styled.div<PlayerControlsRowProps>`
  display: flex;
  align-items: center;
  justify-content: start;
  margin-bottom: ${(props) => (props.numOfPlayers === '2' ? '32px' : '18px')};
  margin-top: ${(props) => (props.numOfPlayers === '2' ? '24px' : '14px')};
  padding: 14px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

export const ControlsLabel = styled(Typography)`
  margin-right: 20px;
  font-size: 18px;
  font-weight: 600;
  min-width: 140px;
`;

export const KeyGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 40px;
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
  border-radius: 6px;
  border: 2px solid rgba(245, 158, 11, 0.5);
  background: linear-gradient(180deg, rgba(255,255,255,0.1), rgba(0,0,0,0.28));
  color: #f5f6fa;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12);
  &:focus {
    outline: none;
    border-color: #ffd166;
    box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.24);
  }
`;

export const ExtraKeys = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  margin-left: 25px;
`;

export const MapToggleButton = styled(ToggleButton)`
  width: 140px;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  border-radius: 12px !important;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(108, 92, 231, 0.3);
  }

  & img {
    width: 100%;
    height: auto;
    margin-bottom: 8px;
    border-radius: 8px;
  }

  &.Mui-selected, &.Mui-selected:hover {
    background-color: rgba(108, 92, 231, 0.2);
    border-color: #6c5ce7;
    transform: translateY(-4px);
  }
`;

export const ConfigIntro = styled.div`
  margin-bottom: 18px;
  padding: 16px 18px;
  border-radius: 8px;
  background: linear-gradient(90deg, rgba(0,0,0,0.28), rgba(255,255,255,0.06), rgba(0,0,0,0.28));
  border: 1px solid rgba(255,255,255,0.1);
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
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34);
`;

export const CharacterPortrait = styled.div`
  height: 174px;
  margin: -6px -6px 10px;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(0, 0, 0, 0.38);
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
  padding: 5px 34px 6px;
  color: #fff7ed;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  text-shadow: 0 2px 0 #000;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    transform: rotate(-1deg);
    background: linear-gradient(90deg, transparent 0%, #111 12%, #17120f 88%, transparent 100%);
  }
`;

export const SelectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(164px, 1fr));
  gap: 10px;
`;

export const SelectionCard = styled.button<{ selected: boolean; accent: string }>`
  min-height: 128px;
  padding: 10px;
  border: 1px solid ${(props) => (props.selected ? props.accent : 'rgba(255, 255, 255, 0.14)')};
  border-radius: 8px;
  background: ${(props) => (
    props.selected
      ? `linear-gradient(180deg, ${props.accent}4f, rgba(9, 10, 12, 0.96))`
      : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(8, 9, 11, 0.92))'
  )};
  color: #f8fafc;
  cursor: pointer;
  text-align: left;
  transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease;
  box-shadow: ${(props) => (
    props.selected
      ? `0 0 0 2px ${props.accent}55, 0 16px 36px rgba(0,0,0,0.38)`
      : '0 10px 26px rgba(0,0,0,0.28)'
  )};

  &:disabled {
    cursor: not-allowed;
    filter: grayscale(0.78) brightness(0.62);
  }

  &:hover {
    transform: translateY(-3px);
    border-color: ${(props) => props.accent};
    box-shadow: 0 18px 38px rgba(0, 0, 0, 0.42);
  }
`;

export const StagePreview = styled.div`
  height: 128px;
  margin: -6px -6px 10px;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.32);
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
  filter: saturate(1.1) contrast(1.08);
`;

export const AbilityLine = styled.div<{ color: string }>`
  margin-top: 8px;
  padding: 6px 8px;
  border-left: 3px solid ${(props) => props.color};
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.26);
  color: rgba(248, 250, 252, 0.78);
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
  border-radius: 6px;
  background: linear-gradient(90deg, ${(props) => props.color}33, rgba(0, 0, 0, 0.22));
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 0.72rem;
`;

export const LoadoutKey = styled.span`
  color: rgba(248, 250, 252, 0.68);
  font-weight: 800;
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
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(255,255,255,0.48), ${(props) => props.color} 42%, #050507 100%);
  border: 1px solid rgba(255,255,255,0.24);
  box-shadow: 0 0 18px ${(props) => props.color}70;
`;

export const CardMeta = styled(Typography)`
  color: rgba(248, 250, 252, 0.72);
`;

export const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;
