import styled from '@emotion/styled';
import { Box, LinearProgress } from '@mui/material';

const PANEL_SURFACE = 'rgba(255, 248, 231, 0.94)';
const PANEL_EDGE = 'var(--anime-ink)';
const PANEL_SHADOW = '3px 3px 0 rgba(33, 29, 26, 0.88)';

// Text floor: nothing in the HUD is smaller than 12 px (0.75rem) at 100%
// HUD, and the numbers players read mid-fight are at least 1.1rem. The
// HUD zoom (hudZoom in scene/cameraFraming) also grows with the viewport.
const LABEL = '0.75rem';
const NUMBER = '1.1rem';

// Layout contract: players in local versus can only be drawn inside the
// middle band of the screen. The camera centres their bounding box and the
// shared-screen limit keeps them within 12x8 cells, which projects to 34%-65%
// of the height at every aspect ratio (and 27%-73% of the width at 4:3). So
// every panel lives in the top band (above 34%) or, on short screens, the
// bottom band (below 65%), never at mid-height. Positions are in HUD units:
// HudRoot is zoomed, so `%` is the zoomed viewport and the unzoomed top
// controls (about 276 x 76 px at the top right) are cleared with
// `px / var(--hud-zoom)`.
const CONTROLS_CLEARANCE = '290px / var(--hud-zoom, 1)';
const BELOW_CONTROLS = 'max(78px, 84px / var(--hud-zoom, 1))';
const PHONE = '@media (max-width: 640px)';
const SHORT = '@media (max-height: 560px) and (min-width: 641px)';

export const HudRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hudZoom',
})<{ hudZoom: number }>(({ hudZoom }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
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
  top: 12,
  // Centred, but slides left before it would reach the top controls.
  left: `max(12px, min(50% - 180px, 100% - 360px - ${CONTROLS_CLEARANCE}))`,
  zIndex: 3,
  width: `min(360px, 100% - 24px - ${CONTROLS_CLEARANCE})`,
  minHeight: 54,
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.7fr) minmax(0, 1.05fr)',
  gap: 1,
  padding: 3,
  border: '2px solid var(--anime-ink)',
  background: 'var(--anime-mustard)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  pointerEvents: 'none',
  // Phones: the strip is the clock cell alone (GameHUD renders only that),
  // sized to its text so the clock is never cut off.
  [PHONE]: {
    left: 12,
    width: 'auto',
    gridTemplateColumns: 'auto',
  },
});

export const MissionStatus = styled(Box)({
  minWidth: 0,
  display: 'grid',
  alignContent: 'center',
  gap: 2,
  padding: '6px 10px 6px 12px',
  background: 'var(--anime-ink)',
  '& strong': {
    color: 'var(--anime-mustard)',
    fontSize: LABEL,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& > span': {
    overflow: 'hidden',
    color: 'var(--anime-paper-light)',
    fontSize: '0.92rem',
    fontWeight: 900,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const MissionNode = styled(Box)({
  minWidth: 0,
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: 1,
  padding: '5px 6px',
  background: 'var(--anime-paper-light)',
  textAlign: 'center',
  '& span': {
    color: 'rgba(33,29,26,0.82)',
    fontSize: LABEL,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& strong': {
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    fontSize: NUMBER,
    fontWeight: 900,
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
    color: urgent ? 'var(--anime-paper-light)' : 'rgba(33,29,26,0.82)',
  },
  '& strong': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    color: urgent ? 'var(--anime-paper-light)' : 'var(--anime-ink)',
    fontSize: '1.3rem',
    lineHeight: 1.05,
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
    padding: '4px 3px',
    '& span': {
      fontSize: `calc(${LABEL} / max(1, var(--hud-zoom, 1)))`,
    },
    '& strong': {
      maxWidth: 'none',
      overflow: 'visible',
      fontSize: `calc(${NUMBER} / max(1, var(--hud-zoom, 1)))`,
      textOverflow: 'clip',
    },
  },
}));

// Last 5 s of the clock and sudden death itself: the status and threats
// cells give way to one banner, striped at its edge so it reads as a
// warning by shape as well as colour. Static: no animation or flash.
export const SuddenDeathCell = styled(Box)({
  gridColumn: '1 / 3',
  minWidth: 0,
  display: 'grid',
  alignContent: 'center',
  gap: 1,
  padding: '5px 10px 5px 22px',
  color: 'var(--anime-paper-light)',
  background: 'repeating-linear-gradient(135deg, var(--anime-ink) 0 5px, var(--anime-vermilion) 5px 10px) left / 12px 100% no-repeat, var(--anime-vermilion)',
  '& span': {
    fontSize: LABEL,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& strong': {
    overflow: 'hidden',
    fontSize: '1.05rem',
    fontWeight: 900,
    lineHeight: 1.1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

// One line along the bottom edge (phones, and campaign on short screens):
// hudInsets keeps the players above it.
const BOTTOM_LINE = {
  position: 'absolute' as const,
  bottom: 12,
  zIndex: 3,
  boxSizing: 'border-box' as const,
  minHeight: 40,
  pointerEvents: 'none' as const,
  [PHONE]: {
    left: 12,
    right: 12,
  },
  [SHORT]: {
    right: 12,
    width: 'min(380px, 100% - 260px)',
  },
};

export const PhoneSuddenDeathBanner = styled(Box)({
  ...BOTTOM_LINE,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '6px 10px 6px 24px',
  color: 'var(--anime-paper-light)',
  background: 'repeating-linear-gradient(135deg, var(--anime-ink) 0 5px, var(--anime-vermilion) 5px 10px) left / 14px 100% no-repeat, var(--anime-vermilion)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '3px 3px 0 var(--anime-ink)',
  '& strong': {
    fontSize: '1rem',
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },
  '& span': {
    fontSize: LABEL,
    fontWeight: 900,
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
});

export const MissionLine = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'boss',
})<{ boss: boolean }>(({ boss }) => ({
  ...BOTTOM_LINE,
  display: 'grid',
  gap: 4,
  padding: '6px 9px 7px',
  color: 'var(--anime-ink)',
  background: PANEL_SURFACE,
  border: '2px solid var(--anime-ink)',
  borderLeft: `6px solid ${boss ? 'var(--anime-vermilion)' : 'var(--anime-olive)'}`,
  boxShadow: PANEL_SHADOW,
  '& > div': {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    minWidth: 0,
  },
  '& strong': {
    flex: '1 1 auto',
    minWidth: 0,
    overflow: 'hidden',
    fontSize: '0.86rem',
    fontWeight: 900,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '& span': {
    flex: '0 0 auto',
    fontSize: '0.92rem',
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
  },
  '& em': {
    flex: '0 0 auto',
    color: '#8f2f26',
    fontSize: LABEL,
    fontStyle: 'normal',
    fontWeight: 900,
  },
}));

export const MissionLineProgress = styled(LinearProgress, {
  shouldForwardProp: (prop) => prop !== 'boss',
})<{ boss: boolean }>(({ boss }) => ({
  height: 5,
  borderRadius: 0,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: boss ? 'var(--anime-vermilion)' : 'var(--anime-teal)',
  },
}));

// Local Arena mirrors the keyboard and the spawns: P1 top-left, P2 top-right
// (under the top controls), P3 between them; each card sets its `order`.
// The campaign's lone card stays top-left.
export const PlayerCards = styled(Box)({
  position: 'absolute',
  top: BELOW_CONTROLS,
  left: 12,
  right: 12,
  zIndex: 2,
  display: 'flex',
  flexWrap: 'nowrap',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 8,
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
    gap: 6,
  },
  // Short landscape screens have no room above the players: use the bottom
  // edge instead (the players' band ends at 65% of the height).
  [SHORT]: {
    top: 'auto',
    bottom: 12,
  },
});

export const PlayerCardPaper = styled('section', {
  shouldForwardProp: (prop) => !['alive', 'slotColor', 'cardOrder'].includes(String(prop)),
})<{ alive: boolean; slotColor: string; cardOrder: number }>(({ alive, slotColor, cardOrder }) => ({
  position: 'relative',
  boxSizing: 'border-box',
  order: cardOrder,
  flex: '0 1 248px',
  minWidth: 0,
  width: 248,
  padding: '6px 8px 7px 7px',
  background: alive ? PANEL_SURFACE : 'rgba(226, 216, 194, 0.94)',
  color: 'var(--anime-ink)',
  border: `2px solid ${PANEL_EDGE}`,
  borderTop: `4px solid ${slotColor}`,
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  '@media (max-width: 900px)': {
    flexBasis: 206,
    width: 206,
  },
  [PHONE]: {
    width: 'auto',
    minWidth: 0,
    padding: '5px 6px 6px',
  },
}));

export const PlayerHeader = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '24px 36px minmax(0, 1fr)',
  alignItems: 'center',
  gap: 6,
  '@media (max-width: 900px)': {
    gridTemplateColumns: '24px minmax(0, 1fr)',
  },
  // Phones: badge and name share the first line, the numbers get the full
  // card width below (PlayerIdentity's children join this grid).
  [PHONE]: {
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    gap: '3px 5px',
    '& > :last-child': { display: 'contents' },
    '& > :last-child > :not(strong)': { gridColumn: '1 / -1' },
  },
});

// "P1" on the slot colour: the label carries the identity, the colour backs
// it up, so two players on the same shinobi still read apart.
export const SlotBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'slotColor' && prop !== 'textColor',
})<{ slotColor: string; textColor: string }>(({ slotColor, textColor }) => ({
  alignSelf: 'stretch',
  minHeight: 36,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 1,
  color: textColor,
  background: slotColor,
  border: '2px solid var(--anime-ink)',
  fontSize: '0.8rem',
  fontWeight: 900,
  lineHeight: 1,
  [PHONE]: {
    minHeight: 0,
    padding: '2px 4px',
    fontSize: LABEL,
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
  borderRadius: 2,
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
  gap: 3,
  '& > strong': {
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    fontSize: '0.92rem',
    fontWeight: 900,
    lineHeight: 1.1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  [PHONE]: {
    '& > strong': { fontSize: '0.82rem' },
  },
});

// Win pips and the CPU badge share one line under the name (two on a
// crowded phone at a large HUD size, rather than cutting the badge off).
export const CardMeta = styled(Box)({
  minWidth: 0,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '3px 6px',
  minHeight: 16,
});

// One pip per win the match needs, filled per round won: shape and fill,
// not colour, carry the score.
export const WinPips = styled('span')({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  flex: '0 0 auto',
});

export const Pip = styled('span', {
  shouldForwardProp: (prop) => prop !== 'filled',
})<{ filled: boolean }>(({ filled }) => ({
  width: 12,
  height: 12,
  flex: '0 0 auto',
  boxSizing: 'border-box',
  borderRadius: '50%',
  border: '2px solid var(--anime-ink)',
  background: filled ? 'var(--anime-ink)' : 'var(--anime-paper-light)',
}));

// Square-cornered ink chip, apart from the round pips.
export const CpuBadge = styled('span')({
  flex: '0 0 auto',
  maxWidth: '100%',
  minWidth: 0,
  overflow: 'hidden',
  padding: '1px 5px',
  color: 'var(--anime-paper-light)',
  background: 'var(--anime-ink)',
  fontSize: LABEL,
  fontWeight: 900,
  lineHeight: 1.2,
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

// Phones: bombs and blast on one line, the ultimate bar on the next, so a
// card is the same height with two or three players.
export const PlayerStats = styled(Box)({
  display: 'flex',
  alignItems: 'stretch',
  gap: 4,
  [PHONE]: {
    flexWrap: 'wrap',
    rowGap: 3,
  },
});

// Glyph + digit; the cell's role="img" label carries the words.
export const StatCell = styled(Box)({
  flex: '0 0 auto',
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '1px 5px',
  borderRadius: 1,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.4)',
  '& svg': {
    width: 15,
    height: 15,
    flex: '0 0 auto',
  },
  '& strong': {
    fontSize: NUMBER,
    fontWeight: 900,
    fontVariantNumeric: 'tabular-nums',
    lineHeight: 1.05,
  },
  [PHONE]: {
    gap: 1,
    padding: '0 2px',
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
  gap: 4,
  padding: '2px 5px',
  borderRadius: 1,
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
    padding: '1px 4px',
    '& svg': { width: 12, height: 12 },
  },
}));

export const UltimateProgress = styled(LinearProgress)({
  height: 6,
  borderRadius: 0,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-vermilion)',
    // MUI eases every value change over 0.4 s; a charging ultimate changes
    // a few times a second, so the bar was animating almost all match.
    transition: 'none',
  },
});

export const OutNote = styled(Box)({
  display: 'grid',
  gap: 2,
  color: '#8f2f26',
  fontSize: LABEL,
  fontWeight: 800,
  lineHeight: 1.2,
  '& strong': {
    width: 'fit-content',
    padding: '1px 6px',
    borderRadius: 1,
    color: 'var(--anime-paper-light)',
    background: 'var(--anime-vermilion)',
    border: '1px solid var(--anime-ink)',
    fontSize: LABEL,
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& span': {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  },
});

export const PowerChips = styled(Box)({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginTop: 5,
  [PHONE]: {
    display: 'none',
  },
});

export const PowerBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'accent',
})<{ color: string; accent: string }>(({ color, accent }) => ({
  minHeight: 18,
  maxWidth: '100%',
  padding: '2px 6px',
  borderRadius: 2,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 20%, var(--anime-paper-light))`,
  border: `1px solid ${accent}`,
  fontSize: LABEL,
  fontWeight: 800,
  lineHeight: 1.1,
  '&::before': {
    content: '""',
    width: 6,
    height: 6,
    flex: '0 0 auto',
    borderRadius: '50%',
    background: accent,
    border: '1px solid var(--anime-ink)',
  },
}));

// The newest pickup and what it does, two lines at most, for its 3.6 s.
export const PickupNote = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  marginTop: 5,
  padding: '3px 6px',
  borderRadius: 2,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  fontSize: LABEL,
  lineHeight: 1.2,
  '& strong': {
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
  right: 12,
  zIndex: 2,
  // Never past the middle, where the campaign camera keeps its lone player
  // (a 768 px tablet at 125% HUD would otherwise cover it).
  width: 'min(300px, 50% - 80px)',
  maxHeight: 'calc(100% - 96px / var(--hud-zoom, 1))',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'auto',
});

export const ObjectivePaper = styled('section')({
  position: 'relative',
  boxSizing: 'border-box',
  minHeight: 0,
  overflow: 'hidden',
  padding: '8px 9px 9px',
  color: 'var(--anime-ink)',
  background: PANEL_SURFACE,
  border: '2px solid var(--anime-ink)',
  borderTop: '4px solid var(--anime-olive)',
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  '& h2': {
    margin: 0,
    fontSize: '0.8rem',
    fontWeight: 900,
    lineHeight: 1.2,
    textTransform: 'uppercase',
  },
});

export const CampaignMessage = styled.p({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
  margin: '3px 0 0',
  color: 'var(--anime-line)',
  fontSize: LABEL,
  lineHeight: 1.3,
});

export const CampaignEventBanner = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 3,
  marginTop: 6,
  padding: '4px 6px',
  borderRadius: 2,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  fontSize: LABEL,
  lineHeight: 1.25,
}));

export const ObjectiveList = styled.ul({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 4,
  margin: '6px 0 0',
  padding: 0,
  listStyle: 'none',
});

export const ObjectiveItem = styled('li', {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: string }>(({ status }) => ({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: 3,
  padding: status === 'active' ? '5px 6px' : '3px 6px',
  borderRadius: 1,
  background: status === 'active' ? 'var(--anime-paper)' : 'transparent',
  border: '1px solid rgba(33,29,26,0.3)',
  '& > span': {
    color: 'var(--anime-line)',
    fontSize: LABEL,
    lineHeight: 1.2,
  },
}));

export const ObjectiveMeta = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 6,
  '& strong': {
    minWidth: 0,
    overflow: 'hidden',
    fontSize: '0.8rem',
    fontWeight: 900,
    lineHeight: 1.2,
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
    flex: '0 0 auto',
    minWidth: 48,
    padding: '2px 5px',
    borderRadius: 1,
    color: status === 'active' || status === 'failed'
      ? 'var(--anime-paper-light)'
      : 'var(--anime-ink)',
    background: color,
    fontSize: LABEL,
    fontWeight: 900,
    lineHeight: 1.1,
    textAlign: 'center',
    textTransform: 'uppercase',
  };
});

export const ObjectiveProgress = styled(LinearProgress)({
  height: 6,
  borderRadius: 0,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-teal)',
  },
});

export const IntelLine = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '2px 10px',
  marginTop: 6,
  color: 'rgba(33,29,26,0.82)',
  fontSize: LABEL,
  fontWeight: 800,
  textTransform: 'uppercase',
  '& strong': {
    color: '#8f2f26',
    fontSize: '0.86rem',
    fontVariantNumeric: 'tabular-nums',
  },
});

export const PatrolLine = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 6,
});

export const MonsterBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '2px 6px',
  borderRadius: 1,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 18%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  fontSize: LABEL,
  fontWeight: 800,
  lineHeight: 1.2,
}));

export const BossPaper = styled('section', {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  boxSizing: 'border-box',
  flex: '0 0 auto',
  display: 'grid',
  gap: 4,
  padding: '7px 9px 8px',
  background: PANEL_SURFACE,
  color: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
  borderTop: `5px solid ${color}`,
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  '& > div': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '0 8px',
    '& strong': {
      fontSize: '0.86rem',
      fontWeight: 900,
      fontVariantNumeric: 'tabular-nums',
    },
    '& strong:last-of-type': {
      marginLeft: 'auto',
    },
    '& span': {
      color: 'var(--anime-line)',
      fontSize: LABEL,
    },
  },
  '& > span': {
    color: '#8f2f26',
    fontSize: LABEL,
    fontWeight: 800,
  },
}));

export const BossProgress = styled(LinearProgress)({
  height: 8,
  borderRadius: 0,
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-vermilion)',
  },
});
