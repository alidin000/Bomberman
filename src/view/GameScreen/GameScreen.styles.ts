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
  backgroundColor: 'var(--anime-paper-light)'
});

export const StyledGameDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    width: '100%',
    height: '80%',
    maxWidth: '1000px',
    maxHeight: '130vh',
    overflow: 'auto',
    backgroundColor: 'var(--anime-paper-light)',
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
  backgroundColor: isWall ? 'transparent' : 'var(--anime-paper-light)',
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
  color: 'var(--anime-vermilion)',
});

export const GameSceneContainer = styled.div({
  width: '100%',
  height: '100dvh',
  position: 'relative',
});

export const TopControls = styled.div({
  position: 'absolute',
  top: 18,
  right: 18,
  zIndex: 20,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: 258,
  gap: 8,
  padding: 6,
  background: 'rgba(255,248,231,0.94)',
  border: '2px solid var(--anime-ink)',
  borderRadius: 2,
  boxShadow: '4px 4px 0 var(--anime-ink)',
});

export const LoadingMessage = styled.div({
  color: 'var(--anime-paper-light)',
  marginTop: '32px',
  textAlign: 'center',
  fontSize: '1.1rem',
});

export const GameBackground = styled(StyledBackground)({
  overflow: 'hidden',
  background: 'var(--anime-night)',
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    background: 'repeating-linear-gradient(0deg, rgba(255,248,231,0.035) 0 1px, transparent 1px 5px)',
    mixBlendMode: 'screen',
    opacity: 0.25,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    pointerEvents: 'none',
    boxShadow: 'inset 0 0 0 8px rgba(239,227,196,0.4)',
  },
});

export const ControlButton = styled(IconButton)({
  width: 42,
  height: 42,
  color: 'var(--anime-ink)',
  border: '1px solid var(--anime-ink)',
  borderRadius: 1,
  background: 'var(--anime-paper-light)',
  '&:hover': {
    color: 'var(--anime-paper-light)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--anime-vermilion)',
  },
});

export const PauseOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  zIndex: 18,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  background: 'rgba(33,29,26,0.72)',
  pointerEvents: 'auto',
  color: 'var(--anime-ink)',
});

export const PauseMenuCard = styled.div({
  position: 'relative',
  width: 'min(620px, 92vw)',
  display: 'grid',
  gap: 14,
  padding: 20,
  borderRadius: 2,
  background: 'var(--anime-paper-light)',
  border: '3px solid var(--anime-ink)',
  boxShadow: '8px 8px 0 var(--anime-vermilion)',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'var(--anime-teal)',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(rgba(33,29,26,0.12) 0.6px, transparent 0.6px)',
    backgroundSize: '5px 5px',
    opacity: 0.3,
  },
});

export const PauseMenuTitle = styled.div({
  display: 'grid',
  gap: 3,
  '& strong': {
    color: 'var(--anime-ink)',
    fontSize: '1.32rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& span': {
    color: 'rgba(33,29,26,0.72)',
    fontSize: '0.86rem',
    fontWeight: 700,
  },
});

export const PauseMenuActions = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 9,
  '@media (max-width: 520px)': {
    gridTemplateColumns: '1fr',
  },
});

export const PauseMenuButton = styled(Button)({
  minHeight: 42,
  borderRadius: 2,
  fontWeight: 900,
  textTransform: 'uppercase',
});

export const ControlsGuide = styled.aside({
  position: 'absolute',
  left: 16,
  bottom: 16,
  zIndex: 16,
  width: 'min(390px, calc(100vw - 32px))',
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 2,
  color: 'var(--anime-ink)',
  background: 'rgba(255,248,231,0.95)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '4px 4px 0 var(--anime-teal)',
});

export const ControlsGuideHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  '& strong': {
    color: 'var(--anime-teal)',
    fontSize: '0.84rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
});

export const ControlsDismissButton = styled(IconButton)({
  width: 30,
  height: 30,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  '&:hover': {
    background: 'var(--anime-mustard)',
  },
});

export const ControlRows = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
  '@media (max-width: 520px)': {
    gridTemplateColumns: '1fr',
  },
});

export const ControlRow = styled.div({
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '6px 8px',
  borderRadius: 1,
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.3)',
  fontSize: '0.75rem',
  fontWeight: 800,
  '& span': {
    color: 'rgba(33,29,26,0.72)',
  },
  '& kbd': {
    minWidth: 28,
    padding: '2px 6px',
    borderRadius: 1,
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
    border: '1px solid var(--anime-ink)',
    textAlign: 'center',
    fontFamily: 'inherit',
    fontWeight: 900,
  },
});

export const CountdownOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  zIndex: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  color: 'var(--anime-paper-light)',
  textShadow: '4px 4px 0 var(--anime-ink)',
  '& strong': {
    minWidth: 134,
    minHeight: 134,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    background: 'var(--anime-vermilion)',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-mustard)',
    fontSize: '4.1rem',
    fontWeight: 900,
  },
});

export const FeedbackCaption = styled.div({
  position: 'absolute',
  left: '50%',
  bottom: 28,
  zIndex: 15,
  transform: 'translateX(-50%)',
  minWidth: 180,
  padding: '8px 16px',
  clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  border: '2px solid var(--anime-mustard)',
  fontSize: '0.82rem',
  fontWeight: 900,
  textAlign: 'center',
  textTransform: 'uppercase',
  pointerEvents: 'none',
});

export const GameHint = styled.div({
  position: 'absolute',
  left: '50%',
  bottom: '24px',
  transform: 'translateX(-50%)',
  zIndex: 10,
  width: 'min(780px, 82vw)',
  padding: '10px 18px',
  borderRadius: 2,
  background: 'rgba(255,248,231,0.94)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '4px 4px 0 var(--anime-ink)',
  color: 'var(--anime-ink)',
  fontSize: '0.92rem',
  fontWeight: 700,
  textAlign: 'center',
  pointerEvents: 'none',
});
