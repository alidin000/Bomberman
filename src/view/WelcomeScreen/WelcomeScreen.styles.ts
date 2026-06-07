import styled from '@emotion/styled';
import { Box, Paper, Typography } from '@mui/material';

export const WelcomeContainer = styled(Box)({
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #17120e 0%, #2a2118 42%, #12151a 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
});

export const HeroSection = styled(Box)({
  width: 'min(1320px, 94vw)',
  display: 'grid',
  gridTemplateColumns: 'minmax(280px, 0.55fr) minmax(560px, 1.45fr)',
  gap: 22,
  alignItems: 'center',
  marginBottom: 24,
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
  },
});

export const HeroCopy = styled(Box)({
  color: '#f8fafc',
  padding: '18px 0',
});

export const HeroBadge = styled(Box)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '7px 12px',
  marginBottom: 16,
  borderRadius: 6,
  color: '#ffe6b0',
  background: 'linear-gradient(90deg, rgba(15, 15, 18, 0.98), rgba(57, 35, 16, 0.92))',
  border: '1px solid rgba(245, 158, 11, 0.5)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
});

export const HeroSubtitle = styled(Typography)({
  maxWidth: 520,
  color: 'rgba(248, 250, 252, 0.78)',
});

export const BoardFrame = styled(Box)({
  position: 'relative',
  padding: 8,
  borderRadius: 8,
  background: 'linear-gradient(145deg, rgba(16, 17, 20, 0.98), rgba(40, 33, 25, 0.98))',
  border: '1px solid rgba(255,255,255,0.18)',
  boxShadow: '0 26px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.1)',
});

export const BoardTitleStrip = styled(Box)({
  position: 'absolute',
  top: -16,
  left: '50%',
  transform: 'translateX(-50%) rotate(-1deg)',
  zIndex: 2,
  width: 'min(420px, 68%)',
  padding: '7px 18px',
  color: '#fff7ed',
  background: 'linear-gradient(90deg, transparent 0%, #15110d 12%, #17120f 88%, transparent 100%)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textShadow: '0 2px 0 #000',
});

export const BoardSurface = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1.25fr 0.78fr',
  gap: 10,
  padding: 12,
  maxHeight: 620,
  overflowY: 'auto',
  borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.72)',
  background: 'linear-gradient(180deg, rgba(37,32,26,0.96), rgba(13,14,16,0.98))',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)',
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
    maxHeight: 'none',
  },
});

export const BoardSection = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 9,
  borderRadius: 6,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.24))',
  border: '1px solid rgba(255,255,255,0.11)',
}));

export const BoardSectionTitle = styled(Box)({
  width: 'fit-content',
  margin: '0 auto 9px',
  padding: '4px 24px 5px',
  color: '#fff7ed',
  background: 'linear-gradient(90deg, transparent, #111 15%, #17120f 85%, transparent)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.78rem',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textShadow: '0 2px 0 #000',
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 1100px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

export const CharacterCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'accent',
})<{ accent: string }>(({ accent }) => ({
  minHeight: 202,
  padding: 7,
  borderRadius: 6,
  border: `1px solid ${accent}99`,
  background: `linear-gradient(180deg, ${accent}24, rgba(4,5,7,0.94))`,
  boxShadow: '0 10px 22px rgba(0,0,0,0.34)',
}));

export const CharacterArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'position',
})<{ image: string; position: string }>(({ image, position }) => ({
  height: 92,
  marginBottom: 7,
  borderRadius: 5,
  backgroundImage: `url(${image})`,
  backgroundSize: '600% 280%',
  backgroundPosition: position,
  backgroundRepeat: 'no-repeat',
  border: '1px solid rgba(255,255,255,0.12)',
}));

export const CharacterName = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  color,
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  lineHeight: 1.05,
  textShadow: '0 2px 0 #000',
}));

export const AbilityStack = styled(Box)({
  display: 'grid',
  gap: 5,
  marginTop: 7,
});

export const AbilityTag = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '5px 6px',
  borderRadius: 5,
  color: '#f8fafc',
  background: `linear-gradient(90deg, ${color}30, rgba(0,0,0,0.28))`,
  border: '1px solid rgba(255,255,255,0.09)',
  fontSize: '0.67rem',
  fontWeight: 800,
  lineHeight: 1.12,
}));

export const CharacterNote = styled(Box)({
  marginTop: 7,
  color: 'rgba(248,250,252,0.68)',
  fontSize: '0.65rem',
  fontWeight: 700,
  lineHeight: 1.22,
});

export const BossGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
});

export const BossCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: 'grid',
  gridTemplateColumns: '34px 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 58,
  padding: 7,
  borderRadius: 6,
  color: '#f8fafc',
  background: `linear-gradient(90deg, ${color}38, rgba(0,0,0,0.34))`,
  border: `1px solid ${color}88`,
  '& strong': {
    display: 'block',
    color: '#fff7ed',
    textTransform: 'uppercase',
    fontSize: '0.76rem',
  },
}));

export const BossEmblem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  borderRadius: '50%',
  color: '#111827',
  background: `radial-gradient(circle at 35% 25%, #fff7, ${color} 58%, #050507 100%)`,
  border: '1px solid rgba(255,255,255,0.24)',
  fontWeight: 900,
}));

export const BossMeta = styled(Box)({
  color: 'rgba(248,250,252,0.68)',
  fontSize: '0.66rem',
  fontWeight: 700,
  lineHeight: 1.15,
});

export const StageGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 1100px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

export const StageCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  overflow: 'hidden',
  borderRadius: 6,
  border: `1px solid ${color}99`,
  background: 'rgba(0,0,0,0.34)',
}));

export const StageArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'position',
})<{ image: string; position: string }>(({ image, position }) => ({
  height: 66,
  backgroundImage: `url(${image})`,
  backgroundSize: '300% 200%',
  backgroundPosition: position,
  backgroundRepeat: 'no-repeat',
}));

export const StageLabel = styled(Box)({
  padding: '6px 4px',
  color: '#f8fafc',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  fontWeight: 900,
  lineHeight: 1.1,
});

export const PowerGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 7,
});

export const PowerTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  minHeight: 42,
  display: 'flex',
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 6,
  color: '#f8fafc',
  background: `linear-gradient(90deg, ${color}33, rgba(0,0,0,0.32))`,
  border: `1px solid ${color}88`,
  fontSize: '0.76rem',
  fontWeight: 900,
  lineHeight: 1.1,
}));

export const MonsterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
});

export const MonsterTile = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  display: 'grid',
  gridTemplateColumns: '38px 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 54,
  padding: 7,
  borderRadius: 6,
  color: '#f8fafc',
  background: `linear-gradient(90deg, ${color}34, rgba(0,0,0,0.32))`,
  border: `1px solid ${color}88`,
  fontSize: '0.72rem',
  fontWeight: 900,
  lineHeight: 1.1,
}));

export const MonsterIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'beast' && prop !== 'color',
})<{ beast: string; color: string }>(({ beast, color }) => ({
  position: 'relative',
  width: 36,
  height: 34,
  borderRadius: beast === 'flame' ? '50% 50% 46% 46%' : '44% 44% 50% 50%',
  background: `radial-gradient(circle at 35% 25%, #fff7, ${color} 52%, #050507 100%)`,
  boxShadow: `0 0 18px ${color}66`,
  '&::before': {
    content: "''",
    position: 'absolute',
    left: beast === 'horn' ? -5 : 7,
    top: beast === 'horn' ? -6 : -3,
    width: beast === 'horn' ? 13 : 8,
    height: beast === 'horn' ? 16 : 18,
    borderRadius: beast === 'horn' ? '50% 50% 0 0' : '50%',
    background: beast === 'sand' ? '#d6a45d' : '#f8fafc',
    transform: beast === 'horn' ? 'rotate(-24deg)' : 'rotate(18deg)',
  },
  '&::after': {
    content: "''",
    position: 'absolute',
    right: beast === 'horn' ? -5 : 5,
    top: beast === 'horn' ? -6 : 5,
    width: beast === 'horn' ? 13 : 18,
    height: beast === 'horn' ? 16 : 7,
    borderRadius: '50%',
    background: beast === 'flame' ? '#bfdbfe' : color,
    transform: beast === 'horn' ? 'rotate(24deg)' : 'rotate(-25deg)',
  },
}));

export const ShowcaseArt = styled.img({
  width: '100%',
  maxHeight: 560,
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 6,
  border: '1px solid rgba(0,0,0,0.72)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
  display: 'block',
});

export const ActionPanel = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  width: 'min(1320px, 94vw)',
});

export const ActionCard = styled(Paper)({
  width: '100%',
  padding: 18,
  borderRadius: 8,
  background: 'linear-gradient(145deg, rgba(18,18,20,0.96), rgba(43,31,22,0.95))',
  border: '1px solid rgba(245, 158, 11, 0.32)',
  boxShadow: '0 18px 52px rgba(0,0,0,0.42)',
});

export const ActionButtons = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
});

export const PanelText = styled(Typography)({
  color: 'rgba(248, 250, 252, 0.68)',
  marginBottom: 12,
});

export const FeatureGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 12,
  '@media (max-width: 760px)': {
    gridTemplateColumns: '1fr',
  },
});

export const FeatureCard = styled(Box)({
  padding: 14,
  minHeight: 76,
  borderRadius: 6,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.26))',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#f8fafc',
  fontSize: '0.88rem',
  '& strong': {
    display: 'block',
    marginBottom: 4,
    color: '#ffd166',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
});

/** Shared export used by the game screen background wrapper. */
export const StyledBackground = styled(Box)({
  minHeight: '100vh',
  background: 'linear-gradient(180deg, #14110f 0%, #261a14 48%, #11151b 100%)',
  position: 'relative',
});
