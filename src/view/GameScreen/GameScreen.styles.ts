import styled from '@emotion/styled';
import {
  Button, Dialog, DialogContent, IconButton
} from '@mui/material';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';

type GridCellProps = {
  isWall: boolean;
};

export const CustomDialogContent = styled(DialogContent)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  maxWidth: 'none',
  height: 'auto',
  backgroundColor: '#d3d3d3'
});

export const StyledGameDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    width: '100%',
    height: '80%',
    maxWidth: '1000px',
    maxHeight: '130vh',
    overflow: 'auto',
    backgroundColor: '#d3d3d3',
    justifyContent: 'center',
  },
});

export const MapContainer = styled.div({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  height: 'auto',
  overflow: 'hidden'
});

export const MyGrid = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(15, 1fr)',
  gridAutoRows: '1fr',
  width: '100%',
  minHeight: '300px',
  overflow: 'hidden',
});

export const GridCell = styled.div<GridCellProps>(({ isWall }) => ({
  position: 'relative',
  backgroundColor: isWall ? 'transparent' : '#eee',
  aspectRatio: '1',
  overflow: 'hidden',
}));

export const StyledGameButton = styled(Button)({
  marginRight: '10px',
});

export const CharacterContainer = styled.div({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

export const StyledSettingsButton = styled(IconButton)({
  position: 'absolute',
  top: '20px',
  right: '20px',
  zIndex: 2000,
  color: 'red',
});

export const GameSceneContainer = styled.div({
  width: '100%',
  height: '100vh',
  position: 'relative',
});

export const TopControls = styled.div({
  position: 'absolute',
  top: '20px',
  right: '20px',
  zIndex: 20,
  display: 'flex',
  gap: '8px',
});

export const LoadingMessage = styled.div({
  color: '#fff',
  marginTop: '32px',
  textAlign: 'center',
  fontSize: '1.1rem',
});

export const GameBackground = styled(StyledBackground)({
  overflow: 'hidden',
});

export const ControlButton = styled(IconButton)({
  color: '#fff',
  backgroundColor: 'rgba(0,0,0,0.4)',
  '&:hover': {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});

export const PauseOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  zIndex: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(8, 8, 20, 0.35)',
  backdropFilter: 'blur(2px)',
  pointerEvents: 'none',
  color: '#fff',
  fontSize: '2rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

export const GameHint = styled.div({
  position: 'absolute',
  left: '50%',
  bottom: '24px',
  transform: 'translateX(-50%)',
  zIndex: 10,
  width: 'min(780px, 82vw)',
  padding: '10px 18px',
  borderRadius: '999px',
  background: 'rgba(9, 10, 24, 0.74)',
  border: '1px solid rgba(255,255,255,0.16)',
  boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
  color: '#f8fafc',
  fontSize: '0.92rem',
  fontWeight: 700,
  textAlign: 'center',
  pointerEvents: 'none',
});
