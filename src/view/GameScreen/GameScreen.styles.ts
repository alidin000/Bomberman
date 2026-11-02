import styled from '@emotion/styled';
import {
  Button, Dialog, IconButton
} from '@mui/material';
import { StyledBackground } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  PRESSED, radius, space, textStyles, transition,
} from '../../theme/tokens';
import { ARENA_FRAME_PX } from './scene/canvasInsets';

const PHONE = '@media (max-width: 640px)';

type GridCellProps = {
  isWall: boolean;
};

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

// The arena sits inside the paper frame (ARENA_FRAME_PX on every side), so
// no DOM layer covers the canvas; the camera converts the HUD's viewport
// bands to the smaller canvas (scene/canvasInsets.ts).
export const GameSceneContainer = styled.div({
  position: 'absolute',
  inset: ARENA_FRAME_PX,
});

// 16 px in from the corner and 62 px tall (44 px touch buttons: 70 px), so
// the HUD's clearance under it (84 px, scene/cameraFraming) still holds.
export const TopControls = styled.div({
  position: 'absolute',
  top: `calc(${space[200]}px + env(safe-area-inset-top, 0px))`,
  right: `calc(${space[200]}px + env(safe-area-inset-right, 0px))`,
  zIndex: 20,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: 258,
  gap: space[75],
  padding: space[75],
  background: 'rgba(255,248,231,0.94)',
  border: '2px solid var(--anime-ink)',
  borderRadius: radius.sm,
  boxShadow: '4px 4px 0 var(--anime-ink)',
});

// A status line on the paper background (StyledBackground), so ink, not
// paper-light: the online screen's "Joining online match..." and its errors.
export const LoadingMessage = styled.div({
  ...textStyles.body2,
  color: 'var(--anime-ink)',
  marginTop: space[400],
  textAlign: 'center',
});

// The match's own layout in skeleton blocks while the engine starts (the
// match bar, the top controls, two player cards and the arena), so nothing
// jumps when the first state lands. On the night colour the match uses.
export const LoadingScreen = styled.div({
  position: 'relative',
  minHeight: '100dvh',
  overflow: 'hidden',
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-night)',
  boxShadow: `inset 0 0 0 ${ARENA_FRAME_PX}px rgba(239,227,196,0.4)`,
  '& > span': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: space[300],
    textAlign: 'center',
  },
  '& > .skeleton': {
    position: 'absolute',
  },
});

export const LoadingStrip = styled.div({
  top: space[100],
  // design-system: allow centres the 360 px plate clear of the 290 px HUD column
  left: 'max(12px, min(50% - 180px, 100% - 360px - 290px))',
  width: 'min(360px, 100% - 314px)',
  height: 62,
  [PHONE]: { left: space[100], width: 62 },
});

export const LoadingControls = styled.div({
  top: space[200],
  right: space[200],
  width: 212,
  height: 62,
});

// Where the HUD puts them: under the top controls (scene/cameraFraming's
// 84 px clearance), 80 px tall (100 px on phones).
export const LoadingCard = styled('div', {
  shouldForwardProp: (prop) => prop !== 'side',
// design-system: allow 84 px is the controls' clearance in scene/cameraFraming
})<{ side: 'left' | 'right' }>(({ side }) => ({
  top: 84,
  [side]: space[100],
  width: 'min(248px, 50% - 16px)',
  height: 80,
  [PHONE]: { height: 100 },
}));

// Under the cards, with a 12 px gap.
export const LoadingArena = styled.div({
  // design-system: allow stacks below the controls and the 100 px plate
  top: `calc(84px + 100px + ${space[100]}px)`,
  bottom: space[700],
  left: '50%',
  aspectRatio: '1 / 1',
  maxWidth: 'calc(100% - 48px)',
  transform: 'translateX(-50%)',
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

// The chakra ring for an icon button's keyboard focus (index.css adds the
// aura), and the house press.
const ICON_BUTTON_STATES = {
  transition: transition(['transform'], ['background-color', 'color', 'border-color']),
  '&:active': PRESSED,
  '&.Mui-focusVisible': {
    outline: 'var(--focus-ring)',
    outlineOffset: 2,
  },
  '&.Mui-disabled': {
    color: 'var(--ink-2)',
    background: 'var(--anime-paper)',
    borderStyle: 'dashed',
  },
};

// Square inside the bar (its radius less the 8 px gap is under 2 px).
// Orange is the house action: ink on it, never vermilion (danger only).
export const ControlButton = styled(IconButton)({
  width: 42,
  height: 42,
  color: 'var(--anime-ink)',
  border: '1px solid var(--anime-ink)',
  borderRadius: radius.none,
  background: 'var(--anime-paper-light)',
  ...ICON_BUTTON_STATES,
  '&:hover': {
    color: 'var(--on-action)',
    borderColor: 'var(--anime-ink)',
    background: 'var(--action)',
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
  padding: space[300],
  // A tall card (three players on a phone) scrolls instead of being cut off
  // above the viewport; on phones it also starts below the top controls.
  overflowY: 'auto',
  // A flat ink scrim over the frozen arena, with static hard-edged speed
  // lines toward the card.
  background: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,248,231,0) 0deg 2.6deg, '
    + 'rgba(255,248,231,0.07) 2.6deg 3.3deg), rgba(18,13,11,0.74)',
  pointerEvents: 'auto',
  color: 'var(--anime-ink)',
  [PHONE]: {
    padding: space[200],
    paddingTop: space[900],
  },
});

export const PauseMenuCard = styled.div({
  position: 'relative',
  margin: 'auto',
  width: 'min(620px, 92vw)',
  display: 'grid',
  gap: space[200],
  // The rod (11 px) plus 21 px of paper above the title.
  padding: `${space[400]}px ${space[300]}px ${space[300]}px`,
  borderRadius: radius.sm,
  backgroundColor: 'var(--anime-paper-light)',
  backgroundImage: 'var(--scroll-paper)',
  border: '3px solid var(--anime-ink)',
  boxShadow: '8px 8px 0 var(--anime-orange)',
  // The scroll's wooden rod across the top.
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 11,
    background: 'var(--scroll-rod)',
  },
  [PHONE]: {
    padding: `${space[400]}px ${space[200]}px ${space[200]}px`,
  },
});

export const PauseMenuTitle = styled.div({
  display: 'grid',
  gap: space[50],
  '& strong': {
    ...textStyles.heading4,
    color: 'var(--anime-ink)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    textShadow: '2px 2px 0 var(--anime-orange)',
  },
  '& span': {
    ...textStyles.caption1,
    color: 'var(--ink-2)',
  },
});

export const PauseMenuActions = styled.div({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: space[75],
  '@media (max-width: 520px)': {
    gridTemplateColumns: '1fr',
  },
});

export const PauseMenuButton = styled(Button)({
  ...textStyles.buttonMd,
  minHeight: 44,
  borderRadius: radius.sm,
});

export const ControlsGuide = styled.aside({
  position: 'absolute',
  left: `calc(${space[200]}px + env(safe-area-inset-left, 0px))`,
  bottom: `calc(${space[200]}px + env(safe-area-inset-bottom, 0px))`,
  zIndex: 16,
  // Over the touch controls (18), which take no presses while it is up.
  'html[data-touch="on"] &': {
    zIndex: 19,
  },
  width: 'min(390px, calc(100vw - 32px))',
  display: 'grid',
  gap: space[100],
  padding: space[100],
  borderRadius: radius.sm,
  color: 'var(--anime-ink)',
  background: 'rgba(255,248,231,0.95)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '4px 4px 0 var(--anime-orange)',
});

export const ControlsGuideHeader = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: space[100],
  '& strong': {
    ...textStyles.buttonMd,
    color: 'var(--anime-teal)',
  },
});

export const ControlsDismissButton = styled(IconButton)({
  width: 32,
  height: 32,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  ...ICON_BUTTON_STATES,
  '&:hover': {
    background: 'var(--anime-mustard)',
  },
});

// Players as rows, actions as columns, so each player reads one line. Each
// row is boxed all round (top and bottom on every cell, the sides on its
// first and last cell).
export const ControlTable = styled.table({
  ...textStyles.caption3,
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: `0 ${space[50]}px`,
  '& th, & td': {
    padding: `${space[50]}px ${space[50]}px`,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  },
  '& thead th': {
    padding: `0 ${space[50]}px`,
    color: 'var(--ink-3)',
    fontWeight: textStyles.caption3.fontWeight,
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
    // design-system: allow with the first and last cells' sides, a row draws one full border
    borderBlock: '1px solid rgba(33,29,26,0.3)',
  },
  '& tbody th': {
    fontWeight: textStyles.caption3.fontWeight,
    // design-system: allow one side of a row's full border
    borderLeft: '1px solid rgba(33,29,26,0.3)',
    '& span:last-of-type': {
      display: 'inline-block',
      maxWidth: 110,
      overflow: 'hidden',
      marginLeft: space[75],
      textOverflow: 'ellipsis',
      verticalAlign: 'middle',
    },
  },
  '& tbody td:last-of-type': {
    // design-system: allow one side of a row's full border
    borderRight: '1px solid rgba(33,29,26,0.3)',
  },
  '& kbd': {
    display: 'inline-block',
    minWidth: 22,
    padding: `${space[25]}px ${space[50]}px`,
    color: 'var(--anime-ink)',
    background: 'var(--anime-mustard)',
    border: '1px solid var(--anime-ink)',
    textAlign: 'center',
    fontFamily: 'inherit',
    fontWeight: textStyles.caption3.fontWeight,
  },
  '@media (max-width: 520px)': {
    '& th, & td': { padding: `${space[25]}px ${space[25]}px` },
    '& tbody th span:last-of-type': { display: 'none' },
    '& kbd': { minWidth: 18, padding: `0 ${space[25]}px` },
  },
});

export const ControlSlot = styled('span', {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'textColor',
})<{ slotColor: string; textColor: string }>(({ slotColor, textColor }) => ({
  ...textStyles.caption3,
  display: 'inline-block',
  flex: '0 0 auto',
  minWidth: 24,
  verticalAlign: 'middle',
  padding: `${space[25]}px ${space[50]}px`,
  color: textColor,
  background: slotColor,
  border: '1px solid var(--anime-ink)',
  textAlign: 'center',
}));

export const PlayerKits = styled.ul({
  display: 'grid',
  gap: space[50],
  margin: 0,
  padding: 0,
  listStyle: 'none',
  '& li': {
    ...textStyles.caption5,
    display: 'flex',
    alignItems: 'flex-start',
    gap: space[75],
    color: 'var(--ink-3)',
  },
  '& li > span:last-of-type': {
    display: 'grid',
  },
  '& strong': {
    ...textStyles.caption3,
    color: 'var(--anime-ink)',
  },
});

export const FeedbackCaption = styled.div({
  ...textStyles.body4,
  position: 'absolute',
  left: '50%',
  bottom: space[300],
  zIndex: 15,
  transform: 'translateX(-50%)',
  minWidth: 180,
  padding: `${space[100]}px ${space[200]}px`,
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
    border: '2px solid var(--anime-mustard)',
    transform: 'skewX(-16deg)',
  },
  // Sentence case, 40 characters or fewer (useGameFeedback): one line on
  // most screens, two at most on a 360 px phone. MatchBeatOverlay keeps its
  // plates above this box (CAPTION_BOTTOM_PX, CAPTION_HEIGHT_PX).
  width: 'max-content',
  maxWidth: 'calc(100vw - 40px)',
  textAlign: 'center',
  pointerEvents: 'none',
  // Short landscape screens put the player cards on the bottom edge (12 px
  // up, 80 px tall), and phones keep a one-line mission or sudden-death
  // strip there.
  '@media (max-height: 560px) and (min-width: 641px)': {
    bottom: `calc(${space[100]}px + 80px + ${space[100]}px)`,
    // The cards moved up beside the match bar; the controls hold the corners.
    'html[data-touch="on"] &': {
      bottom: `calc(${space[300]}px + env(safe-area-inset-bottom, 0px))`,
      maxWidth: 'calc(100vw - 40px - 2 * var(--touch-side, 0px))',
    },
  },
  [PHONE]: {
    bottom: space[700],
    // Above the touch band and the one-line strip on it.
    'html[data-touch="on"] &': {
      bottom: `calc(${space[700]}px + var(--touch-bottom, 0px) + env(safe-area-inset-bottom, 0px))`,
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
