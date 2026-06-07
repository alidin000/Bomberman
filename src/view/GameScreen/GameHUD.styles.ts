import styled from '@emotion/styled';
import { Box, LinearProgress, Paper } from '@mui/material';

export const HudRoot = styled(Box)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  padding: 18,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  pointerEvents: 'none',
});

export const PlayerCards = styled(Box)({
  display: 'flex',
  gap: 10,
  flexWrap: 'wrap',
  pointerEvents: 'auto',
  maxWidth: 'calc(100vw - 380px)',
});

export const HudRight = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 10,
  pointerEvents: 'auto',
});

type PlayerCardProps = {
  alive: boolean;
  color: string;
};

export const PlayerCardPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'alive' && prop !== 'color',
})<PlayerCardProps>(({ alive, color }) => ({
  padding: 14,
  minWidth: 230,
  maxWidth: 252,
  background: alive
    ? `linear-gradient(135deg, rgba(12, 13, 28, 0.94), ${color}30)`
    : 'rgba(26,18,28,0.72)',
  color: '#f8fafc',
  border: `1px solid ${color}cc`,
  boxShadow: alive
    ? `0 16px 42px ${color}44, inset 0 1px 0 rgba(255,255,255,0.12)`
    : '0 10px 26px rgba(0,0,0,0.2)',
  backdropFilter: 'blur(8px)',
  opacity: alive ? 1 : 0.6,
}));

export const PlayerHeader = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
});

export const PlayerAvatar = styled(Box)<{ color: string }>(({ color }) => ({
  width: 48,
  height: 48,
  borderRadius: '50%',
  background: `radial-gradient(circle at 35% 25%, #fff7d6, #f6c453 28%, ${color} 58%, #111827 100%)`,
  border: '2px solid rgba(255,255,255,0.9)',
  boxShadow: `0 0 12px ${color}`,
}));

export const PlayerStats = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
  marginTop: 10,
});

export const StatPill = styled(Box)({
  padding: '6px 9px',
  borderRadius: 999,
  color: '#f8fafc',
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  fontSize: '0.78rem',
  fontWeight: 700,
});

export const PowerChips = styled(Box)({
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
  marginTop: 4,
  '& .MuiChip-root': {
    height: 22,
    fontSize: '0.7rem',
  },
});

export const AbilityPanel = styled(Box)<{ color: string }>(({ color }) => ({
  marginTop: 8,
  padding: 9,
  borderRadius: 12,
  background: `linear-gradient(135deg, ${color}2f, rgba(255, 255, 255, 0.08))`,
  border: `1px solid ${color}77`,
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

export const RoundPaper = styled(Paper)({
  padding: 14,
  minWidth: 190,
  color: '#f8fafc',
  background: 'linear-gradient(135deg, rgba(12, 13, 28, 0.94), rgba(79, 34, 18, 0.9))',
  border: '1px solid rgba(255,255,255,0.14)',
  backdropFilter: 'blur(8px)',
});

export const RoundProgress = styled(LinearProgress)({
  marginTop: 8,
  height: 6,
  borderRadius: 3,
});

export const UltimateProgress = styled(LinearProgress)({
  marginTop: 8,
  height: 7,
  borderRadius: 4,
});

export const MonsterPaper = styled(Paper)({
  padding: 14,
  minWidth: 250,
  background: 'linear-gradient(135deg, rgba(28, 16, 12, 0.94), rgba(62, 26, 82, 0.9))',
  color: '#f8fafc',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '0 10px 28px rgba(0,0,0,0.32)',
  backdropFilter: 'blur(8px)',
});

export const BossPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: 14,
  minWidth: 280,
  background: `linear-gradient(135deg, ${color}40, rgba(14, 9, 20, 0.95))`,
  color: '#f8fafc',
  border: `1px solid ${color}99`,
  boxShadow: `0 10px 32px ${color}33`,
  backdropFilter: 'blur(8px)',
}));

export const MonsterChips = styled(Box)({
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
  marginTop: 8,
  '& .MuiChip-root': {
    color: '#fff',
    borderColor: 'rgba(255,255,255,0.28)',
  },
});
