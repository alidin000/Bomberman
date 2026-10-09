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

// No full-screen scanline layer here: a `mix-blend-mode` overlay above the
// WebGL canvas forces the compositor to redraw an extra offscreen pass every
// frame, and at 0.035 x 0.25 alpha it only changed pixels by 1-2/255.
export const GameBackground = styled(StyledBackground)({
  overflow: 'hidden',
  background: 'var(--anime-night)',
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

// Above TopControls (20): the menu is modal, and the bar under its scrim is
// inert while it is up.
export const PauseOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  zIndex: 21,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  // A tall card (three players on a phone) scrolls instead of being cut off
  // above the viewport; on phones it also starts below the top controls.
  overflowY: 'auto',
  background: 'rgba(33,29,26,0.72)',
  pointerEvents: 'auto',
  color: 'var(--anime-ink)',
  '@media (max-width: 640px)': {
    paddingTop: 88,
  },
});

export const PauseMenuCard = styled.div({
  position: 'relative',
  margin: 'auto',
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

// Players as rows, actions as columns, so each player reads one line.
export const ControlTable = styled.table({
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: '0 4px',
  fontSize: '0.74rem',
  fontWeight: 800,
  '& th, & td': {
    padding: '4px 5px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  '& thead th': {
    padding: '0 5px',
    color: 'rgba(33,29,26,0.78)',
    fontSize: '0.6rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& thead th:first-of-type, & tbody th': {
    textAlign: 'left',
  },
  '& abbr': {
    textDecoration: 'none',
  },
  '& tbody th, & tbody td': {
    background: 'var(--anime-paper)',
    borderTop: '1px solid rgba(33,29,26,0.3)',
    borderBottom: '1px solid rgba(33,29,26,0.3)',
  },
  '& tbody th': {
    borderLeft: '1px solid rgba(33,29,26,0.3)',
    '& span:last-of-type': {
      display: 'inline-block',
      maxWidth: 110,
      overflow: 'hidden',
      marginLeft: 6,
      textOverflow: 'ellipsis',
      verticalAlign: 'middle',
    },
  },
  '& tbody td:last-of-type': {
    borderRight: '1px solid rgba(33,29,26,0.3)',
  },
  '& kbd': {
    display: 'inline-block',
    minWidth: 22,
    padding: '2px 5px',
    borderRadius: 1,
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
    border: '1px solid var(--anime-ink)',
    textAlign: 'center',
    fontFamily: 'inherit',
    fontWeight: 900,
  },
  '@media (max-width: 520px)': {
    fontSize: '0.68rem',
    '& th, & td': { padding: '3px 2px' },
    '& tbody th span:last-of-type': { display: 'none' },
    '& kbd': { minWidth: 18, padding: '1px 3px' },
  },
});

export const ControlSlot = styled('span', {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'textColor',
})<{ slotColor: string; textColor: string }>(({ slotColor, textColor }) => ({
  display: 'inline-block',
  flex: '0 0 auto',
  minWidth: 24,
  verticalAlign: 'middle',
  padding: '2px 4px',
  borderRadius: 1,
  color: textColor,
  background: slotColor,
  border: '1px solid var(--anime-ink)',
  fontSize: '0.68rem',
  fontWeight: 900,
  textAlign: 'center',
}));

export const PlayerKits = styled.ul({
  display: 'grid',
  gap: 5,
  margin: 0,
  padding: 0,
  listStyle: 'none',
  '& li': {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    color: 'rgba(33,29,26,0.82)',
    fontSize: '0.72rem',
    fontWeight: 700,
    lineHeight: 1.35,
  },
  '& li > span:last-of-type': {
    display: 'grid',
  },
  '& strong': {
    color: 'var(--anime-ink)',
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

// A static plate: a CSS pop animation here re-ran style recalc on every
// frame of the beat in the production A/B (about 30 extra recalcs per round
// start), so "GO!" just appears for its 700 ms and goes.
export const GoOverlay = styled.div({
  position: 'absolute',
  inset: 0,
  zIndex: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  color: 'var(--anime-ink)',
  '& strong': {
    minWidth: 180,
    minHeight: 134,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
    borderRadius: 2,
    background: 'var(--anime-mustard)',
    border: '3px solid var(--anime-ink)',
    boxShadow: '8px 8px 0 var(--anime-teal)',
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
  padding: '10px 18px',
  color: 'var(--anime-paper-light)',
  // The slanted plate is a skewed pseudo-element rather than a clip-path:
  // a non-rectangular clip on a layer above the canvas needs a mask render
  // pass on every frame the caption is visible.
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    zIndex: -1,
    background: 'var(--anime-ink)',
    borderTop: '2px solid var(--anime-mustard)',
    borderBottom: '2px solid var(--anime-mustard)',
    transform: 'skewX(-16deg)',
  },
  fontSize: '0.82rem',
  fontWeight: 900,
  textAlign: 'center',
  textTransform: 'uppercase',
  pointerEvents: 'none',
  // Short landscape screens put the player cards on the bottom edge.
  '@media (max-height: 560px) and (min-width: 641px)': {
    bottom: 104,
  },
});

// Screen readers only announce changes to a live region that already exists,
// so the caption text is mirrored into one that stays mounted.
export const CaptionLiveRegion = styled.div({
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
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
