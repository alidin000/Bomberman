import styled from '@emotion/styled';
import {
  Button, Dialog, DialogContent, IconButton
} from '@mui/material';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import { ARENA_FRAME_PX } from './scene/canvasInsets';

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

// The arena sits inside the paper frame (ARENA_FRAME_PX on every side), so
// no DOM layer covers the canvas; the camera converts the HUD's viewport
// bands to the smaller canvas (scene/canvasInsets.ts).
export const GameSceneContainer = styled.div({
  position: 'absolute',
  inset: ARENA_FRAME_PX,
});

export const TopControls = styled.div({
  position: 'absolute',
  top: 'calc(18px + env(safe-area-inset-top, 0px))',
  right: 'calc(18px + env(safe-area-inset-right, 0px))',
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

// Sits on the paper background (StyledBackground), so ink, not paper-light.
export const LoadingMessage = styled.div({
  color: 'var(--anime-ink)',
  marginTop: '32px',
  textAlign: 'center',
  fontSize: '1.1rem',
});

// No full-screen layer over the canvas: a `mix-blend-mode` scanline overlay
// forced an extra offscreen pass every frame. The 8 px paper ring used to be
// drawn over the canvas edge too; it is now this element's own inset shadow,
// around the canvas, so nothing on the page overlaps the arena's edges.
export const GameBackground = styled(StyledBackground)({
  overflow: 'hidden',
  background: 'var(--anime-night)',
  boxShadow: `inset 0 0 0 ${ARENA_FRAME_PX}px rgba(239,227,196,0.4)`,
  // The game surface owns its touches: no pan, pinch or double-tap zoom, and
  // no pull-to-refresh or scroll chaining. The menus keep browser zoom; the
  // pause menu scrolls as its own container.
  touchAction: 'none',
  overscrollBehavior: 'none',
  // A held thumb selects no HUD text and opens no callout.
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTouchCallout: 'none',
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
  left: 'calc(16px + env(safe-area-inset-left, 0px))',
  bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
  zIndex: 16,
  // Over the touch controls (18), which take no presses while it is up.
  'html[data-touch="on"] &': {
    zIndex: 19,
  },
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
  // Sentence case, 40 characters or fewer (useGameFeedback): one line on
  // most screens, two at most on a 360 px phone.
  width: 'max-content',
  maxWidth: 'calc(100vw - 40px)',
  fontSize: '0.9rem',
  fontWeight: 900,
  textAlign: 'center',
  pointerEvents: 'none',
  // Short landscape screens put the player cards on the bottom edge, and
  // phones keep a one-line mission or sudden-death strip there.
  '@media (max-height: 560px) and (min-width: 641px)': {
    bottom: 104,
    // The cards moved up beside the match bar; the controls hold the corners.
    'html[data-touch="on"] &': {
      bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
      maxWidth: 'calc(100vw - 40px - 2 * var(--touch-side, 0px))',
    },
  },
  '@media (max-width: 640px)': {
    bottom: 66,
    // Above the touch band and the one-line strip on it.
    'html[data-touch="on"] &': {
      bottom: 'calc(66px + var(--touch-bottom, 0px) + env(safe-area-inset-bottom, 0px))',
    },
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
