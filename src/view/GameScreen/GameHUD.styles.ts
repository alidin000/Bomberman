import styled from '@emotion/styled';
import { Box, LinearProgress, Paper } from '@mui/material';

const PANEL_SURFACE = 'linear-gradient(180deg, rgba(25, 20, 15, 0.97), rgba(7, 8, 12, 0.95))';
const PANEL_EDGE = 'rgba(244, 180, 74, 0.42)';
const PANEL_SHADOW = '0 18px 42px rgba(0, 0, 0, 0.42), inset 0 1px 0 rgba(255, 235, 184, 0.14)';

export const HudRoot = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  pointerEvents: 'none',
});

export const PlayerCards = styled(Box)({
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  pointerEvents: 'auto',
  maxWidth: 'min(760px, calc(100vw - 360px))',
});

export const HudRight = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 8,
  pointerEvents: 'auto',
});

type PlayerCardProps = {
  alive: boolean;
  color: string;
};

export const PlayerCardPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'alive' && prop !== 'color',
})<PlayerCardProps>(({ alive, color }) => ({
  padding: 10,
  minWidth: 210,
  maxWidth: 232,
  background: alive
    ? `linear-gradient(90deg, ${color}30, transparent 62%), ${PANEL_SURFACE}`
    : 'linear-gradient(180deg, rgba(19, 18, 18, 0.86), rgba(7, 8, 12, 0.82))',
  color: '#f8fafc',
  border: `1px solid ${alive ? color : PANEL_EDGE}`,
  borderRadius: 6,
  boxShadow: alive
    ? `0 16px 34px ${color}38, inset 0 1px 0 rgba(255, 235, 184, 0.18)`
    : '0 10px 24px rgba(0,0,0,0.28)',
  backdropFilter: 'blur(6px)',
  opacity: alive ? 1 : 0.6,
}));

export const PlayerHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 7,
});

export const PlayerAvatar = styled(Box)<{ color: string }>(({ color }) => ({
  width: 42,
  height: 42,
  borderRadius: '50%',
  background: `radial-gradient(circle at 35% 25%, #fff7d6, #f6c453 28%, ${color} 58%, #111827 100%)`,
  border: '2px solid rgba(255, 235, 184, 0.95)',
  boxShadow: `0 0 12px ${color}, 0 0 0 4px rgba(0, 0, 0, 0.28)`,
}));

export const PlayerStats = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 5,
  marginTop: 8,
});

export const StatPill = styled(Box)({
  padding: '5px 8px',
  borderRadius: 5,
  color: '#f8fafc',
  background: 'linear-gradient(180deg, rgba(255, 230, 176, 0.16), rgba(0, 0, 0, 0.26))',
  border: '1px solid rgba(255, 230, 176, 0.22)',
  fontSize: '0.78rem',
  fontWeight: 700,
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
  borderRadius: 7,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: '#f8fafc',
  background: `linear-gradient(135deg, ${color}7a, rgba(15, 23, 42, 0.9))`,
  border: `1px solid ${accent}aa`,
  boxShadow: `0 0 14px ${color}33, inset 0 1px 0 rgba(255,255,255,0.16)`,
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
    boxShadow: `0 0 8px ${accent}`,
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
  borderRadius: 6,
  color: '#f8fafc',
  background: `linear-gradient(90deg, ${color}46, rgba(10, 11, 15, 0.88))`,
  border: `1px solid ${color}99`,
  boxShadow: `0 0 16px ${color}22`,
  fontSize: '0.68rem',
  lineHeight: 1.18,
}));

export const PickupNoteTitle = styled('strong')({
  display: 'block',
  marginBottom: 2,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
});

export const AbilityPanel = styled(Box)<{ color: string }>(({ color }) => ({
  marginTop: 8,
  padding: 8,
  borderRadius: 5,
  background: `linear-gradient(135deg, ${color}30, rgba(20, 13, 7, 0.72))`,
  border: `1px solid ${color}99`,
  boxShadow: 'inset 0 1px 0 rgba(255, 235, 184, 0.1)',
}));

export const AbilityRow = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '48px 1fr',
  gap: 6,
  alignItems: 'center',
  color: '#f8fafc',
  fontSize: '0.76rem',
  '& strong': {
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
});

export const ObjectivePaper = styled(Paper)({
  padding: 11,
  width: 278,
  color: '#f8fafc',
  background: `linear-gradient(90deg, rgba(34, 197, 94, 0.2), transparent 68%), ${PANEL_SURFACE}`,
  border: '1px solid rgba(134, 239, 172, 0.44)',
  borderRadius: 6,
  boxShadow: PANEL_SHADOW,
  backdropFilter: 'blur(6px)',
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
  borderRadius: 6,
  background: 'linear-gradient(180deg, rgba(255, 230, 176, 0.12), rgba(0, 0, 0, 0.22))',
  border: '1px solid rgba(255, 230, 176, 0.18)',
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
    active: '#22c55e',
    complete: '#facc15',
    failed: '#ef4444',
    locked: '#94a3b8',
  };
  const color = colors[status] ?? colors.locked;
  return {
    minWidth: 64,
    padding: '3px 6px',
    borderRadius: 5,
    color: '#0f172a',
    background: color,
    boxShadow: `0 0 12px ${color}38`,
    fontSize: '0.62rem',
    fontWeight: 900,
    lineHeight: 1.1,
    textAlign: 'center',
    textTransform: 'uppercase',
  };
});

export const ObjectiveProgress = styled(LinearProgress)({
  height: 6,
  borderRadius: 3,
  backgroundColor: 'rgba(255, 230, 176, 0.16)',
  '& .MuiLinearProgress-bar': {
    background: 'linear-gradient(90deg, #22c55e, #facc15)',
  },
});

export const UltimateProgress = styled(LinearProgress)({
  marginTop: 8,
  height: 7,
  borderRadius: 4,
  backgroundColor: 'rgba(255, 230, 176, 0.14)',
  '& .MuiLinearProgress-bar': {
    background: 'linear-gradient(90deg, #f97316, #facc15)',
  },
});

export const MonsterPaper = styled(Paper)({
  padding: 11,
  minWidth: 238,
  background: `linear-gradient(90deg, rgba(249, 115, 22, 0.22), transparent 65%), ${PANEL_SURFACE}`,
  color: '#f8fafc',
  border: `1px solid ${PANEL_EDGE}`,
  borderRadius: 6,
  boxShadow: PANEL_SHADOW,
  backdropFilter: 'blur(6px)',
});

export const BossPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'min(520px, calc(100vw - 610px))',
  minWidth: 340,
  padding: '10px 13px',
  background: `linear-gradient(90deg, ${color}38, transparent 66%), ${PANEL_SURFACE}`,
  color: '#f8fafc',
  border: `1px solid ${color}cc`,
  borderRadius: 6,
  boxShadow: `0 16px 40px ${color}32, inset 0 1px 0 rgba(255, 235, 184, 0.14)`,
  backdropFilter: 'blur(6px)',
  textAlign: 'center',
  '@media (max-width: 1100px)': {
    position: 'static',
    transform: 'none',
    width: '100%',
    minWidth: 250,
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
  borderRadius: 5,
  color: '#fff',
  background: `linear-gradient(135deg, ${color}66, rgba(15, 12, 8, 0.9))`,
  border: `1px solid ${color}99`,
  boxShadow: `0 0 12px ${color}22`,
  fontSize: '0.72rem',
  fontWeight: 800,
  lineHeight: 1.1,
}));
