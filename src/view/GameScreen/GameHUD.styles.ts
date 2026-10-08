import styled from '@emotion/styled';
import { Box, LinearProgress, Paper } from '@mui/material';

const PANEL_SURFACE = 'rgba(255, 248, 231, 0.94)';
const PANEL_EDGE = 'var(--anime-ink)';
const PANEL_SHADOW = '4px 4px 0 rgba(33, 29, 26, 0.88)';

export const HudRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hudScale',
})<{ hudScale: number }>(({ hudScale }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10,
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  pointerEvents: 'none',
  zoom: hudScale / 100,
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'linear-gradient(180deg, rgba(33,29,26,0.28), transparent 18%, transparent 82%, rgba(33,29,26,0.18))',
    opacity: 0.7,
  },
}));

export const PlayerCards = styled(Box)({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  pointerEvents: 'auto',
  maxWidth: 'min(760px, calc(100vw - 360px))',
  position: 'relative',
  zIndex: 2,
  marginTop: 64,
  '@media (max-width: 1260px)': {
    marginTop: 230,
  },
  '@media (max-width: 640px)': {
    marginTop: 150,
    maxWidth: 'calc(100vw - 24px)',
  },
});

export const HudRight = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  pointerEvents: 'auto',
  position: 'relative',
  zIndex: 2,
  marginTop: 62,
  '@media (max-width: 1260px)': {
    marginTop: 230,
  },
  '@media (max-width: 640px)': {
    marginTop: 150,
  },
});

export const MissionStrip = styled(Box)({
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 3,
  width: 'min(520px, calc(100vw - 680px))',
  minWidth: 360,
  minHeight: 58,
  display: 'grid',
  gridTemplateColumns: '1.35fr repeat(3, minmax(0, 0.75fr))',
  gap: 1,
  padding: 4,
  border: '2px solid var(--anime-ink)',
  background: 'var(--anime-mustard)',
  boxShadow: '4px 4px 0 var(--anime-ink)',
  pointerEvents: 'none',
  '@media (max-width: 1260px)': {
    top: 86,
    width: 'min(540px, calc(100vw - 34px))',
  },
  '@media (max-width: 640px)': {
    display: 'none',
  },
});

export const MissionStatus = styled(Box)({
  minWidth: 0,
  display: 'grid',
  alignContent: 'center',
  gap: 2,
  padding: '8px 14px 8px 18px',
  background: 'var(--anime-ink)',
  '& strong': {
    color: 'var(--anime-mustard)',
    fontSize: '0.72rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& span': {
    overflow: 'hidden',
    color: 'var(--anime-paper-light)',
    fontSize: '0.88rem',
    fontWeight: 900,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

export const MissionNode = styled(Box)({
  minWidth: 0,
  display: 'grid',
  placeItems: 'center',
  gap: 1,
  padding: '7px 8px',
  background: 'var(--anime-paper-light)',
  textAlign: 'center',
  '& span': {
    color: 'rgba(33,29,26,0.82)',
    fontSize: '0.62rem',
    fontWeight: 900,
    textTransform: 'uppercase',
  },
  '& strong': {
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'var(--anime-ink)',
    fontSize: '0.84rem',
    fontWeight: 900,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

type PlayerCardProps = {
  alive: boolean;
  color: string;
};

export const PlayerCardPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'alive' && prop !== 'color',
})<PlayerCardProps>(({ alive, color }) => ({
  position: 'relative',
  isolation: 'isolate',
  padding: '10px 10px 9px 13px',
  minWidth: 220,
  maxWidth: 246,
  background: alive ? PANEL_SURFACE : 'rgba(210, 201, 181, 0.92)',
  color: 'var(--anime-ink)',
  border: `2px solid ${PANEL_EDGE}`,
  borderTop: `7px solid ${alive ? color : 'var(--anime-ink)'}`,
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  opacity: alive ? 1 : 0.6,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
    background: alive ? color : 'var(--anime-olive)',
    boxShadow: 'none',
    zIndex: -1,
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(rgba(33,29,26,0.12) 0.6px, transparent 0.6px)',
    backgroundSize: '5px 5px',
    opacity: alive ? 0.25 : 0.12,
    pointerEvents: 'none',
    zIndex: -1,
  },
}));

export const PlayerHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
});

export const PlayerAvatar = styled(Box, {
  shouldForwardProp: (prop) => !['color', 'image', 'imagePosition'].includes(String(prop)),
})<{ color: string; image: string; imagePosition: string }>(({
  color,
  image,
  imagePosition,
}) => ({
  width: 46,
  height: 46,
  flex: '0 0 auto',
  borderRadius: 2,
  backgroundImage: `url(${image})`,
  backgroundSize: '600% 280%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  border: '2px solid var(--anime-ink)',
  boxShadow: `3px 3px 0 ${color}`,
}));

export const PlayerStatusRibbon = styled(Box)<{ alive: boolean; color: string }>(({
  alive,
  color,
}) => ({
  width: 'fit-content',
  marginTop: 3,
  padding: '2px 7px',
  borderRadius: 1,
  color: alive ? 'var(--anime-ink)' : 'var(--anime-paper-light)',
  background: alive ? color : 'var(--anime-vermilion)',
  border: '1px solid var(--anime-ink)',
  fontSize: '0.62rem',
  fontWeight: 900,
  textTransform: 'uppercase',
}));

export const PlayerStats = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 5,
  marginTop: 8,
});

export const StatPill = styled(Box)({
  minHeight: 32,
  display: 'grid',
  placeItems: 'center',
  padding: '5px 7px',
  borderRadius: 1,
  color: 'var(--anime-ink)',
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.4)',
  fontSize: '0.74rem',
  fontWeight: 900,
  textAlign: 'center',
});

export const PowerChips = styled(Box)({
  display: 'flex',
  gap: 5,
  flexWrap: 'wrap',
  marginTop: 6,
});

export const PowerBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'accent',
})<{ color: string; accent: string }>(({ color, accent }) => ({
  minHeight: 24,
  maxWidth: '100%',
  padding: '4px 7px',
  borderRadius: 2,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 20%, var(--anime-paper-light))`,
  border: `1px solid ${accent}`,
  fontSize: '0.68rem',
  fontWeight: 800,
  lineHeight: 1.1,
  '&::before': {
    content: '""',
    width: 7,
    height: 7,
    flex: '0 0 auto',
    borderRadius: '50%',
    background: accent,
    border: '1px solid var(--anime-ink)',
  },
}));

export const PickupNotes = styled(Box)({
  display: 'grid',
  gap: 5,
  marginTop: 6,
});

export const PickupNote = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '6px 7px',
  borderRadius: 2,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  fontSize: '0.68rem',
  lineHeight: 1.18,
}));

export const PickupNoteTitle = styled('strong')({
  display: 'block',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: 0,
});

export const AbilityPanel = styled(Box)<{ color: string }>(({ color }) => ({
  marginTop: 8,
  padding: 8,
  borderRadius: 2,
  background: `color-mix(in srgb, ${color} 14%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  '@media (max-width: 1400px)': {
    display: 'none',
  },
}));

export const AbilityRow = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '48px 1fr',
  gap: 6,
  alignItems: 'center',
  color: 'var(--anime-ink)',
  fontSize: '0.76rem',
  '& strong': {
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

export const ObjectivePaper = styled(Paper)({
  position: 'relative',
  overflow: 'hidden',
  padding: 11,
  width: 286,
  color: 'var(--anime-ink)',
  background: PANEL_SURFACE,
  border: '2px solid var(--anime-ink)',
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'var(--anime-olive)',
  },
});

export const ObjectiveList = styled(Box)({
  display: 'grid',
  gap: 7,
  marginTop: 8,
});

export const ObjectiveItem = styled(Box)({
  display: 'grid',
  gap: 5,
  padding: 8,
  borderRadius: 1,
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.3)',
});

export const ObjectiveMeta = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
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
    minWidth: 64,
    padding: '3px 6px',
    borderRadius: 1,
    color: 'var(--anime-ink)',
    background: color,
    fontSize: '0.62rem',
    fontWeight: 900,
    lineHeight: 1.1,
    textAlign: 'center',
    textTransform: 'uppercase',
  };
});

export const ObjectiveProgress = styled(LinearProgress)({
  height: 7,
  borderRadius: 0,
  clipPath: 'polygon(0 0, calc(100% - 7px) 0, 100% 100%, 0 100%)',
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-teal)',
  },
});

export const CampaignEventBanner = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  marginTop: 8,
  padding: 8,
  borderRadius: 2,
  background: `color-mix(in srgb, ${color} 16%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
}));

export const IntelGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 6,
  marginTop: 8,
});

export const IntelPill = styled(Box)({
  minHeight: 34,
  padding: '5px 6px',
  borderRadius: 1,
  background: 'var(--anime-paper)',
  border: '1px solid rgba(33,29,26,0.3)',
  color: 'var(--anime-ink)',
  fontSize: '0.66rem',
  fontWeight: 800,
  lineHeight: 1.15,
  textAlign: 'center',
  '& strong': {
    display: 'block',
    color: '#8f2f26',
    fontSize: '0.78rem',
  },
});

export const UltimateProgress = styled(LinearProgress)({
  marginTop: 8,
  height: 8,
  borderRadius: 0,
  clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 100%, 0 100%)',
  backgroundColor: 'rgba(33, 29, 26, 0.2)',
  '& .MuiLinearProgress-bar': {
    background: 'var(--anime-vermilion)',
  },
});

export const MonsterPaper = styled(Paper)({
  position: 'relative',
  padding: 11,
  minWidth: 248,
  background: PANEL_SURFACE,
  color: 'var(--anime-ink)',
  border: `2px solid ${PANEL_EDGE}`,
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 3,
    background: 'var(--anime-vermilion)',
  },
});

export const BossPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  position: 'absolute',
  top: 78,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(520px, calc(100vw - 610px))',
  minWidth: 340,
  padding: '10px 13px',
  background: PANEL_SURFACE,
  color: 'var(--anime-ink)',
  border: '2px solid var(--anime-ink)',
  borderTop: `7px solid ${color}`,
  borderRadius: 2,
  boxShadow: PANEL_SHADOW,
  textAlign: 'center',
  '@media (max-width: 1260px)': {
    top: 150,
    width: 'min(520px, calc(100vw - 34px))',
    minWidth: 0,
  },
  '@media (max-width: 640px)': {
    top: 72,
  },
}));

export const MonsterChips = styled(Box)({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 8,
});

export const MonsterBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '5px 7px',
  borderRadius: 1,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 18%, var(--anime-paper-light))`,
  border: `1px solid ${color}`,
  fontSize: '0.72rem',
  fontWeight: 800,
  lineHeight: 1.1,
}));
