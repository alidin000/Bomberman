import styled from '@emotion/styled';
import { Dialog, Typography, ToggleButton } from '@mui/material';

type PlayerControlsRowProps = {
  numOfPlayers: string;
};

export const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    width: '980px',
    maxWidth: '95vw',
    minHeight: '720px',
    padding: '24px',
    background: 'linear-gradient(145deg, rgba(12, 10, 9, 0.97), rgba(22, 15, 28, 0.96))',
    color: '#f8fafc',
  },
});

export const StepContent = styled.div`
  margin-top: 20px;
  margin-bottom: 20px;
`;

export const CenteredButtonContainer = styled.div`
  position: absolute;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
  gap: 12px;
  width: 100%;
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
  margin-bottom: ${(props) => (props.numOfPlayers === '2' ? '48px' : '20px')};
  margin-top: ${(props) => (props.numOfPlayers === '2' ? '32px' : '16px')};
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
  width: 44px;
  height: 44px;
  margin: 3px;
  text-align: center;
  font-size: 18px;
  border-radius: 8px;
  border: 2px solid rgba(108, 92, 231, 0.5);
  background: rgba(30, 30, 60, 0.8);
  color: #f5f6fa;
  &:focus {
    outline: none;
    border-color: #6c5ce7;
    box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.3);
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
  margin-bottom: 20px;
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
  height: 168px;
  margin: -2px -2px 10px;
  overflow: hidden;
  border-radius: 14px;
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
  margin: 18px 0 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
`;

export const SelectionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
`;

export const SelectionCard = styled.button<{ selected: boolean; accent: string }>`
  min-height: 128px;
  padding: 12px;
  border: 1px solid ${(props) => (props.selected ? props.accent : 'rgba(255, 255, 255, 0.16)')};
  border-radius: 16px;
  background: ${(props) => (
    props.selected
      ? `linear-gradient(145deg, ${props.accent}55, rgba(10, 12, 22, 0.94))`
      : 'rgba(10, 12, 22, 0.78)'
  )};
  color: #f8fafc;
  cursor: pointer;
  text-align: left;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-2px);
    border-color: ${(props) => props.accent};
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.28);
  }
`;

export const StagePreview = styled.div`
  height: 118px;
  margin: -2px -2px 10px;
  overflow: hidden;
  border-radius: 12px;
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
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
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
  border-radius: 9px;
  background: linear-gradient(90deg, ${(props) => props.color}33, rgba(255, 255, 255, 0.06));
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
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: radial-gradient(circle at 35% 30%, #fff7, transparent 35%),
    ${(props) => props.color};
  box-shadow: 0 0 22px ${(props) => props.color}88;
`;

export const CardMeta = styled(Typography)`
  color: rgba(248, 250, 252, 0.72);
`;

export const ModeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
`;
