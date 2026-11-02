import styled from '@emotion/styled';
import { Box, LinearProgress } from '@mui/material';
import {
  radius, space, textStyles, transition,
} from '../../theme/tokens';

const PANEL_SURFACE = 'rgba(255, 248, 231, 0.94)';
const PANEL_EDGE = 'var(--anime-ink)';
const PANEL_SHADOW = '3px 3px 0 rgba(23, 18, 15, 0.9)';
// Two slanted orange slashes at a card's right edge, like a manga panel.
const CARD_SLASHES = 'linear-gradient(105deg, transparent 0 80%, rgba(245,130,31,0.22) 80% 82%, '
  + 'transparent 82% 85%, rgba(245,130,31,0.22) 85% 86%, transparent 86%)';

// The HUD's text is the named text styles (theme/tokens), with each size
// and line height written out in rem instead of var(--text-*): the HUD's
// tests read the declared size, and jsdom does not resolve var().
const REM: Record<string, string> = {
  'text-xs': '0.75rem',
  'leading-xs': '1rem',
  'text-sm': '0.875rem',
  'leading-sm': '1.25rem',
  'text-base': '1rem',
  'leading-base': '1.5rem',
  'text-lg': '1.125rem',
  'leading-lg': '1.75rem',
  'text-xl': '1.25rem',
  'leading-xl': '1.75rem',
};
type TextStyle = { fontSize: string; lineHeight: string | number };
const literal = (value: string | number) => (
  typeof value === 'string' ? value.replace(/^var\(--([\w-]+)\)$/, (match, name) => REM[name] ?? match) : value
);
function hudText<T extends TextStyle>(style: T): Omit<T, keyof TextStyle> & TextStyle {
  return { ...style, fontSize: literal(style.fontSize), lineHeight: literal(style.lineHeight) };
}
type Step = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
// Numerals and names in the display face (one weight) at a scale step. Line
// height 1 (inside the step's own) keeps each panel the height hudInsets
// expects; the strip's cells take the step's paired line height.
const hudDisplay = (step: Step, lineHeight: string | number = 1) => ({
  fontFamily: 'var(--font-display)',
  fontSize: REM[`text-${step}`],
  fontWeight: 400,
  lineHeight,
  letterSpacing: '0.04em',
});
const CAPTION = hudText(textStyles.caption3);

// A small ink-edged diamond before a label: the colour marks the panel
// (boss, objective, request) in place of a one-sided accent stripe.
const marker = (color: string) => ({
  content: '""',
  flex: '0 0 auto',
  alignSelf: 'center',
  width: 8,
  height: 8,
  margin: `0 ${space[50]}px 0 ${space[25]}px`,
  background: color,
  border: '1px solid var(--anime-ink)',
  transform: 'rotate(45deg)',
});

// A warning sign before the sudden-death text: ink and vermilion hazard
// stripes in a square, so the banner reads as a warning by shape as well
// as colour.
const HAZARD_SIGN = {
  content: '""',
  flex: '0 0 auto',
  width: 16,
  height: 16,
  background: 'repeating-linear-gradient(135deg, var(--anime-ink) 0 4px, var(--anime-mustard) 4px 8px)',
  border: '1px solid var(--anime-paper-light)',
};

// MUI eases a determinate bar's transform linearly: the house curve instead.
const BAR_MOTION = { transition: transition(['transform']) };

// Layout contract: players in local versus can only be drawn inside the
// middle band of the screen. The camera centres their bounding box and the
// shared-screen limit keeps them within 12x8 cells, which projects to 34%-65%
// of the height at every aspect ratio (and 27%-73% of the width at 4:3). So
// every panel lives in the top band (above 34%) or, on short screens, the
// bottom band (below 65%), never at mid-height. Positions are in HUD units:
// HudRoot is zoomed, so `%` is the zoomed viewport and the unzoomed top
// controls (about 276 x 76 px at the top right) are cleared with
// `px / var(--hud-zoom)`. The clearances are scene/cameraFraming's own
// (belowControls, ROW_CARD_PX), so the two stay in step.
const CONTROLS_CLEARANCE = '290px / var(--hud-zoom, 1)';
const BELOW_CONTROLS = 'max(78px, 84px / var(--hud-zoom, 1))';
/** A row player card's height (hudInsets ROW_CARD_PX). */
const CARD_PX = 80;
const PHONE = '@media (max-width: 640px)';
const SHORT = '@media (max-height: 560px) and (min-width: 641px)';
// Touch controls are up (input/touchMode): --touch-bottom is their band in
// portrait, --touch-side their columns in landscape, --touch-corner their
// height (screen px, from the safe-area edges). hudInsets mirrors these.
const TOUCH = 'html[data-touch="on"] &';
const IN_HUD_PX = (variable: string) => `var(${variable}, 0px) / var(--hud-zoom, 1)`;

export const HudRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hudZoom',
})<{ hudZoom: number }>(({ hudZoom }) => ({
  position: 'absolute',
  // Inside the safe area (viewport-fit=cover). The zoom scales these too.
  top: 'calc(env(safe-area-inset-top, 0px) / var(--hud-zoom, 1))',
  left: 'calc(env(safe-area-inset-left, 0px) / var(--hud-zoom, 1))',
  right: 'calc(env(safe-area-inset-right, 0px) / var(--hud-zoom, 1))',
  bottom: 'calc(env(safe-area-inset-bottom, 0px) / var(--hud-zoom, 1))',
  zIndex: 10,
  pointerEvents: 'none',
  zoom: hudZoom,
  '--hud-zoom': String(hudZoom),
  '& .visually-hidden': {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
  },
  // No full-screen vignette: nothing but the panels is drawn over the canvas.
}));

export const MissionStrip = styled(Box)({
  position: 'absolute',
  top: space[100],
  // Centred, but slides left before it would reach the top controls.
  left: `max(12px, min(50% - 180px, 100% - 360px - ${CONTROLS_CLEARANCE}))`,
  zIndex: 3,
  width: `min(360px, 100% - 24px - ${CONTROLS_CLEARANCE})`,
  minHeight: 54,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.7fr) minmax(0, 1.05fr)',
  gap: space[25],
  padding: space[25],
  border: '2px solid var(--anime-ink)',
  background: 'var(--anime-orange)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  pointerEvents: 'none',
  // Phones: the strip is the clock cell alone (GameHUD renders only that),
  // sized to its text so the clock is never cut off.
  [PHONE]: {
    left: space[100],
    width: 'auto',
    gridTemplateColumns: 'auto',
  },
});

export const MissionStatus = styled(Box)({
  minWidth: 0,
  display: 'grid',
  alignContent: 'center',
  gap: space[25],
  padding: `${space[50]}px ${space[100]}px`,
  background: 'var(--anime-ink)',
  '& strong': {
    ...CAPTION,
    color: 'var(--anime-orange)',
    textTransform: 'uppercase',
  },
  '& > span': {
    ...hudDisplay('base', REM['leading-base']),
    overflow: 'hidden',
    color: 'var(--anime-paper-light)',
    letterSpacing: '0.05em',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const MissionNode = styled(Box)({
  minWidth: 0,
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: space[25],
  padding: `${space[50]}px ${space[75]}px`,
  background: 'var(--anime-paper-light)',
  textAlign: 'center',
  '& span': {
    ...CAPTION,
    color: 'var(--ink-3)',
    textTransform: 'uppercase',
  },
  '& strong': {
    ...hudDisplay('lg', REM['leading-lg']),
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    fontVariantNumeric: 'tabular-nums',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

// The round clock is the biggest number on screen. In its last 15 s it turns
// into a solid vermilion plate with light text (5.1:1); the old pale pink
// digits on paper were 1.8:1, least readable exactly when they mattered.
export const ClockNode = styled(MissionNode, {
  shouldForwardProp: (prop) => prop !== 'urgent',
})<{ urgent: boolean }>(({ urgent }) => ({
  background: urgent ? 'var(--anime-vermilion)' : 'var(--anime-paper-light)',
  '& span': {
    color: urgent ? 'var(--anime-paper-light)' : 'var(--ink-3)',
  },
  '& strong': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space[50],
    color: urgent ? 'var(--anime-paper-light)' : 'var(--anime-ink)',
    fontSize: REM['text-xl'],
    lineHeight: REM['leading-xl'],
  },
  '& svg': {
    width: 18,
    height: 18,
    flex: '0 0 auto',
  },
  // Never an ellipsis: the cell is as wide as "0:00" plus its caption. A
  // HUD size over 100% does not grow it, so it still clears the top
  // controls on a 360 px phone.
  [PHONE]: {
    minWidth: 'calc(54px / max(1, var(--hud-zoom, 1)))',
    padding: `${space[50]}px ${space[50]}px`,
    '& span': {
      fontSize: `calc(${REM['text-xs']} / max(1, var(--hud-zoom, 1)))`,
      lineHeight: `calc(${REM['leading-xs']} / max(1, var(--hud-zoom, 1)))`,
    },
    '& strong': {
      maxWidth: 'none',
      overflow: 'visible',
      fontSize: `calc(${REM['text-lg']} / max(1, var(--hud-zoom, 1)))`,
      lineHeight: `calc(${REM['leading-lg']} / max(1, var(--hud-zoom, 1)))`,
      textOverflow: 'clip',
    },
  },
}));

// Last 5 s of the clock and sudden death itself: the status and threats
// cells give way to one banner, led by a striped hazard sign so it reads as
// a warning by shape as well as colour. Static: no animation or flash.
export const SuddenDeathCell = styled(Box)({
  gridColumn: '1 / 3',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: space[75],
  padding: `${space[50]}px ${space[100]}px`,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-vermilion)',
  '&::before': HAZARD_SIGN,
  '& > div': {
    minWidth: 0,
    display: 'grid',
    gap: space[25],
  },
  '& span': {
    ...CAPTION,
    textTransform: 'uppercase',
  },
  '& strong': {
    ...hudDisplay('lg', REM['leading-lg']),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

// One line along the bottom edge (phones, and campaign on short screens):
// hudInsets keeps the players above it.
const BOTTOM_LINE = {
  position: 'absolute' as const,
  bottom: space[100],
  zIndex: 3,
  boxSizing: 'border-box' as const,
  minHeight: 40,
  pointerEvents: 'none' as const,
  [PHONE]: {
    left: space[100],
    right: space[100],
    // On top of the touch band, between the touch columns.
    [TOUCH]: {
      bottom: `calc(12px + ${IN_HUD_PX('--touch-bottom')})`,
      left: `calc(12px + ${IN_HUD_PX('--touch-side')})`,
      right: `calc(12px + ${IN_HUD_PX('--touch-side')})`,
    },
  },
  [SHORT]: {
    right: space[100],
    width: 'min(380px, 100% - 260px)',
    // Under P1's card in the left column (PlayerCards), clear of the controls.
    [TOUCH]: {
      top: `calc(${BELOW_CONTROLS} + ${CARD_PX}px + 8px)`,
      bottom: 'auto',
      left: space[100],
      right: 'auto',
      width: 206,
    },
  },
};

export const PhoneSuddenDeathBanner = styled(Box)({
  ...BOTTOM_LINE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: space[75],
  padding: `${space[50]}px ${space[100]}px`,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-vermilion)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  '&::before': HAZARD_SIGN,
  '& strong': {
    ...hudDisplay('base', REM['leading-base']),
    whiteSpace: 'nowrap',
  },
  '& span': {
    ...CAPTION,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
});

export const MissionLine = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'boss',
})<{ boss: boolean }>(({ boss }) => ({
  ...BOTTOM_LINE,
  display: 'grid',
  gap: space[50],
  padding: `${space[50]}px ${space[75]}px`,
  color: 'var(--anime-ink)',
  background: PANEL_SURFACE,
  border: `2px solid ${PANEL_EDGE}`,
  boxShadow: PANEL_SHADOW,
  '& > div': {
    display: 'flex',
    alignItems: 'baseline',
    gap: space[75],
    minWidth: 0,
    '&::before': marker(boss ? 'var(--anime-vermilion)' : 'var(--anime-olive)'),
  },
  '& strong': {
    ...hudText(textStyles.title4),
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& span': {
    ...hudText(textStyles.body4),
    flex: '0 0 auto',
    fontVariantNumeric: 'tabular-nums',
  },
  '& em': {
    ...CAPTION,
    flex: '0 0 auto',
    color: '#8f2f26',
    fontStyle: 'normal',
  },
}));

export const MissionLineProgress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'boss',
})<{ boss: boolean }>(({ boss }) => ({
  height: 5,
  borderRadius: radius.none,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    ...BAR_MOTION,
    background: boss ? 'var(--anime-vermilion)' : 'var(--anime-teal)',
  },
}));

// Versus mirrors the spawns: P1/P3 on the left and P4/P2 on the right;
// each card sets its `order`.
// The campaign's lone card stays top-left.
export const PlayerCards = styled(Box)({
  position: 'absolute',
  top: BELOW_CONTROLS,
  left: space[100],
  right: space[100],
  zIndex: 2,
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: space[75],
  pointerEvents: 'none',
  '& > *': {
    pointerEvents: 'auto',
  },
  // Phones: one row of mini cards under the top controls, never stacked
  // full-width panels over the arena.
  [PHONE]: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridAutoColumns: 'minmax(0, 1fr)',
    gap: space[75],
    '&:has(> :nth-child(4))': {
      gridAutoFlow: 'row',
      gridAutoColumns: 'auto',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    },
  },
  // Short landscape screens have no room above the players: use the bottom
  // edge instead (the players' band ends at 65% of the height).
  [SHORT]: {
    top: 'auto',
    bottom: space[100],
    // With touch controls in the bottom corners the cards stand above them:
    // P1/P3 on the left, P2/P4 on the right under the top
    // controls, and the middle stays open for the players.
    [TOUCH]: {
      top: BELOW_CONTROLS,
      bottom: 'auto',
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr) auto',
      gap: space[75],
      '& > :nth-of-type(2)': { gridColumn: 3, gridRow: 1 },
      '& > :nth-of-type(3)': { gridColumn: 1, gridRow: 2 },
      '& > :nth-of-type(4)': { gridColumn: 3, gridRow: 2 },
    },
  },
});

// An ink keyline all round; the slot colour is on the "P1" badge inside.
export const PlayerCardPaper = styled('section', {
  shouldForwardProp: (prop) => !['alive', 'cardOrder'].includes(String(prop)),
})<{ alive: boolean; cardOrder: number }>(({ alive, cardOrder }) => ({
  position: 'relative',
  boxSizing: 'border-box',
  order: cardOrder,
  flex: '0 1 248px',
  minWidth: 0,
  width: 248,
  padding: space[75],
  background: alive ? `${CARD_SLASHES}, ${PANEL_SURFACE}` : 'rgba(226, 216, 194, 0.94)',
  color: 'var(--anime-ink)',
  border: `2px solid ${PANEL_EDGE}`,
  borderRadius: radius.sm,
  boxShadow: PANEL_SHADOW,
  '@media (max-width: 900px)': {
    flexBasis: 206,
    width: 206,
  },
  [PHONE]: {
    width: 'auto',
    minWidth: 0,
  },
}));

// Badge, portrait, then the name and the match score beside them; the
// numbers take the card's full width on the line below (PlayerStats).
export const PlayerHeader = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '24px 36px minmax(0, 1fr)',
  alignItems: 'center',
  gap: space[75],
  '@media (max-width: 900px)': {
    gridTemplateColumns: '24px minmax(0, 1fr)',
  },
  // Phones: badge and name share the first line, the match score gets the
  // full card width below (PlayerIdentity's children join this grid).
  [PHONE]: {
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: `${space[25]}px ${space[50]}px`,
    '& > :last-child': { display: 'contents' },
    '& > :last-child > :not(strong)': { gridColumn: '1 / -1' },
  },
});

// "P1" on the slot colour: the label carries the identity, the colour backs
// it up, so two players on the same shinobi still read apart.
export const SlotBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'textColor',
})<{ slotColor: string; textColor: string }>(({ slotColor, textColor }) => ({
  ...hudDisplay('sm'),
  alignSelf: 'stretch',
  minHeight: 36,
  display: 'grid',
  placeItems: 'center',
  color: textColor,
  background: slotColor,
  border: '2px solid var(--anime-ink)',
  [PHONE]: {
    minHeight: 0,
    padding: `${space[25]}px ${space[50]}px`,
    fontSize: REM['text-xs'],
  },
}));

export const PlayerAvatar = styled(Box, {
  shouldForwardProp: (prop) => !['image', 'imagePosition'].includes(String(prop)),
})<{ image: string; imagePosition: string }>(({
  image,
  imagePosition,
}) => ({
  width: 36,
  height: 36,
  backgroundImage: `url(${image})`,
  backgroundSize: '600% 280%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  border: '2px solid var(--anime-ink)',
  '@media (max-width: 900px)': {
    display: 'none',
  },
}));

export const PlayerIdentity = styled(Box)({
  minWidth: 0,
  display: 'grid',
  gap: space[25],
  '& > strong': {
    ...hudDisplay('base'),
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    letterSpacing: '0.05em',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  [PHONE]: {
    '& > strong': { fontSize: REM['text-sm'] },
  },
});

// Win pips and the CPU badge share one line under the name (two on a
// crowded phone at a large HUD size, rather than cutting the badge off).
export const CardMeta = styled(Box)({
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: `${space[25]}px ${space[75]}px`,
  minHeight: 16,
});

// One pip per win the match needs, filled per round won: shape and fill,
// not colour, carry the score.
export const WinPips = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[50],
  flex: '0 0 auto',
});

export const Pip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>(({ filled }) => ({
  width: 12,
  height: 12,
  flex: '0 0 auto',
  boxSizing: 'border-box',
  borderRadius: radius.full,
  border: '2px solid var(--anime-ink)',
  background: filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)',
}));

// Square-cornered ink chip, apart from the round pips.
export const CpuBadge = styled('span')({
  ...CAPTION,
  flex: '0 0 auto',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  padding: `0 ${space[50]}px`,
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// The card's full width under the header, so health, bombs, blast and the
// ultimate bar fit side by side. Phones: health, bombs and blast on one
// line, the ultimate bar on the next, so a card is the same height with
// two or three players.
export const PlayerStats = styled(Box)({
  display: 'flex',
  alignItems: 'stretch',
  gap: space[50],
  marginTop: space[50],
  [PHONE]: {
    flexWrap: 'wrap',
    rowGap: space[25],
    marginTop: space[25],
  },
});

// Glyph + digit; the cell's role="img" label carries the words.
export const StatCell = styled(Box)({
  flex: '0 0 auto',
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[25],
  padding: `0 ${space[50]}px`,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.4)',
  '& svg': {
    width: 15,
    height: 15,
    flex: '0 0 auto',
  },
  '& strong': {
    ...hudDisplay('lg'),
    letterSpacing: '0.03em',
    fontVariantNumeric: 'tabular-nums',
  },
  [PHONE]: {
    padding: `0 ${space[25]}px`,
    '& svg': { width: 12, height: 12 },
  },
});

// ★ and a bar. Ready: the star fills and the bar is full and outlined.
export const UltimateCell = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'ready',
})<{ ready: boolean }>(({ ready }) => ({
  flex: '1 1 44px',
  minWidth: 40,
  display: 'flex',
  alignItems: 'center',
  gap: space[50],
  padding: `0 ${space[50]}px`,
  color: 'var(--anime-ink)',
  background: ready ? 'var(--anime-mustard)' : 'var(--anime-paper)',
  border: `1px solid ${ready ? 'var(--anime-ink)' : 'rgba(33,29,26,0.4)'}`,
  '& svg': {
    width: 15,
    height: 15,
    flex: '0 0 auto',
  },
  '& .MuiLinearProgress-root': {
    flex: '1 1 auto',
    height: ready ? 8 : 6,
    outline: ready ? '2px solid var(--anime-ink)' : 'none',
  },
  [PHONE]: {
    flexBasis: '100%',
    '& svg': { width: 12, height: 12 },
  },
}));

export const UltimateProgress = styled(LinearProgress)({
  height: 6,
  borderRadius: radius.none,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-vermilion)',
    // MUI eases every value change over 0.4 s; a charging ultimate changes
    // a few times a second, so the bar was animating almost all match.
    transition: 'none',
  },
});

// "OUT" and how, on the line the numbers had.
export const OutNote = styled(Box)({
  display: 'flex',
  alignItems: 'baseline',
  gap: `${space[25]}px ${space[75]}px`,
  marginTop: space[50],
  color: '#8f2f26',
  '& strong': {
    ...CAPTION,
    flex: '0 0 auto',
    padding: `0 ${space[50]}px`,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-vermilion)',
    border: '1px solid var(--anime-ink)',
    textTransform: 'uppercase',
  },
  '& span': {
    ...hudText(textStyles.caption4),
    display: '-webkit-box',
    minWidth: 0,
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  },
  [PHONE]: {
    flexWrap: 'wrap',
    marginTop: space[25],
  },
});

export const PowerChips = styled(Box)({
  display: 'flex',
  gap: space[50],
  flexWrap: 'wrap',
  marginTop: space[50],
  [PHONE]: {
    display: 'none',
  },
});

export const PowerBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'accent',
})<{ color: string; accent: string }>(({ color, accent }) => ({
  ...CAPTION,
  minHeight: 18,
  maxWidth: '100%',
  padding: `0 ${space[50]}px`,
  display: 'inline-flex',
  alignItems: 'center',
  gap: space[50],
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 20%, var(--anime-paper-light))`,
  border: `1px solid ${accent}`,
  '&::before': {
    content: '""',
    width: 6,
    height: 6,
    flex: '0 0 auto',
    borderRadius: radius.full,
    background: accent,
    border: '1px solid var(--anime-ink)',
  },
}));

// The newest pickup and what it does, two lines at most, for its 3.6 s.
export const PickupNote = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  ...hudText(textStyles.caption5),
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  marginTop: space[50],
  padding: `${space[25]}px ${space[50]}px`,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  '& strong': {
    fontWeight: textStyles.caption3.fontWeight,
    textTransform: 'uppercase',
  },
  [PHONE]: {
    display: 'none',
  },
}));

// Solo: boss and mission panels share one column under the top controls, so
// nothing sits over the middle of the screen where the player is drawn.
export const HudRight = styled(Box)({
  position: 'absolute',
  top: 'calc(84px / var(--hud-zoom, 1))',
  right: space[100],
  zIndex: 2,
  // Never past the middle, where the campaign camera keeps its lone player
  // (a 768 px tablet at 125% HUD would otherwise cover it).
  width: 'min(300px, 50% - 80px)',
  maxHeight: 'calc(100% - 96px / var(--hud-zoom, 1))',
  // Stops above the touch bomb cluster.
  [TOUCH]: {
    maxHeight: `calc(100% - 104px / var(--hud-zoom, 1) - ${IN_HUD_PX('--touch-corner')})`,
  },
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: space[75],
  pointerEvents: 'auto',
});

export const ObjectivePaper = styled('section')({
  position: 'relative',
  boxSizing: 'border-box',
  minHeight: 0,
  overflow: 'hidden',
  padding: `${space[75]}px ${space[100]}px ${space[100]}px`,
  color: 'var(--anime-ink)',
  background: PANEL_SURFACE,
  border: `2px solid ${PANEL_EDGE}`,
  borderRadius: radius.sm,
  boxShadow: PANEL_SHADOW,
  '& h2': {
    ...hudDisplay('base', REM['leading-base']),
    display: 'flex',
    alignItems: 'center',
    gap: space[75],
    margin: 0,
    '&::before': marker('var(--anime-olive)'),
  },
});

export const CampaignMessage = styled.p({
  ...hudText(textStyles.body6),
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  margin: `${space[50]}px 0 0`,
  color: 'var(--anime-line)',
});

export const CampaignEventBanner = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  ...hudText(textStyles.body6),
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  marginTop: space[75],
  padding: `${space[50]}px ${space[75]}px`,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  '& strong': {
    fontWeight: textStyles.body4.fontWeight,
  },
}));

export const ObjectiveList = styled.ul({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space[50],
  margin: `${space[75]}px 0 0`,
  padding: 0,
  listStyle: 'none',
});

export const ObjectiveItem = styled('li', {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: string }>(({ status }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: space[25],
  padding: status === 'active'
    ? `${space[50]}px ${space[75]}px`
    : `${space[25]}px ${space[75]}px`,
  background: status === 'active' ? 'var(--anime-paper)' : 'transparent',
  border: '1px solid rgba(33,29,26,0.3)',
  '& > span': {
    ...hudText(textStyles.caption5),
    color: 'var(--anime-line)',
  },
}));

export const ObjectiveMeta = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: space[75],
  '& strong': {
    ...hudText(textStyles.title4),
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const ObjectiveStatusBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: string }>(({ status }) => {
  const colors: Record<string, string> = {
    active: '#667158',
    complete: '#d4a33f',
    failed: '#bd3f32',
    locked: '#789aa3',
  };
  const color = colors[status] ?? colors.locked;
  return {
    ...CAPTION,
    flex: '0 0 auto',
    minWidth: 48,
    padding: `${space[25]}px ${space[50]}px`,
    color: status === 'active' || status === 'failed'
      ? 'var(--anime-paper-light)'
      : 'var(--anime-ink)',
    background: color,
    textAlign: 'center',
    textTransform: 'uppercase',
  };
});

export const ObjectiveProgress = styled(LinearProgress)({
  height: 6,
  borderRadius: radius.none,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    ...BAR_MOTION,
    background: 'var(--anime-teal)',
  },
});

export const IntelLine = styled(Box)({
  ...CAPTION,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  gap: `${space[25]}px ${space[100]}px`,
  marginTop: space[75],
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  '& strong': {
    ...hudText(textStyles.body4),
    color: '#8f2f26',
    fontVariantNumeric: 'tabular-nums',
  },
});

export const PatrolLine = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[50],
  marginTop: space[75],
});

export const MonsterBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  ...CAPTION,
  padding: `${space[25]}px ${space[50]}px`,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 18%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
}));

export const BossPaper = styled('section', {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  boxSizing: 'border-box',
  flex: '0 0 auto',
  display: 'grid',
  gap: space[50],
  padding: `${space[75]}px ${space[100]}px`,
  background: PANEL_SURFACE,
  color: 'var(--anime-ink)',
  border: `2px solid ${PANEL_EDGE}`,
  borderRadius: radius.sm,
  boxShadow: PANEL_SHADOW,
  '& > div': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: `0 ${space[75]}px`,
    '&::before': marker(color),
    '& strong': {
      ...hudText(textStyles.body4),
      fontVariantNumeric: 'tabular-nums',
    },
    '& strong:last-of-type': {
      marginLeft: 'auto',
    },
    '& span': {
      ...hudText(textStyles.caption5),
      color: 'var(--anime-line)',
    },
  },
  '& > span': {
    ...CAPTION,
    color: '#8f2f26',
  },
}));

export const BossProgress = styled(LinearProgress)({
  height: 8,
  borderRadius: radius.none,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    ...BAR_MOTION,
    background: 'var(--anime-vermilion)',
  },
});
