import styled from '@emotion/styled';
import { Box, Paper, Typography } from '@mui/material';

const angularPanel = 'none';
const bannerCut = 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)';
const chipCut = 'none';

export const WelcomeContainer = styled(Box)({
  position: 'relative',
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  padding: 20,
  color: '#f8f3e8',
  backgroundColor: '#18292f',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    opacity: 0.2,
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 0.6px, transparent 0.6px)',
    backgroundSize: '7px 7px',
  },
  '&::after': {
    content: "''",
    position: 'absolute',
    inset: 10,
    pointerEvents: 'none',
    border: '1px solid rgba(255,248,231,0.22)',
    clipPath: angularPanel,
  },
  '& .MuiButton-root': {
    minHeight: 46,
    borderRadius: 8,
    clipPath: chipCut,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
  '& .MuiButton-contained': {
    color: '#fff8e7',
    background: '#bd3f32',
    border: '1px solid rgba(255,248,231,0.5)',
    boxShadow: '0 10px 28px rgba(18,24,28,0.22)',
  },
  '& .MuiButton-contained:hover': {
    background: '#d45d48',
    transform: 'translateY(-2px)',
  },
  '& .MuiButton-outlined': {
    color: '#fff8e7',
    borderColor: 'rgba(255,248,231,0.7)',
    background: 'rgba(24,41,47,0.68)',
    boxShadow: 'none',
  },
  '& .MuiButton-outlined:hover': {
    borderColor: '#fff8e7',
    background: 'rgba(255,248,231,0.14)',
  },
  '@media (max-width: 640px)': {
    justifyContent: 'flex-start',
    padding: 10,
  },
});

export const HeroSection = styled(Box)({
  position: 'relative',
  zIndex: 1,
  width: 'min(1120px, calc(100vw - 40px))',
  minHeight: 'min(760px, calc(100dvh - 40px))',
  overflow: 'hidden',
  borderRadius: 8,
  border: '1px solid rgba(255,248,231,0.32)',
  boxShadow: '0 30px 80px rgba(6,15,19,0.34)',
});

export const HeroScene = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image',
})<{ image: string }>(({ image }) => ({
  position: 'absolute',
  inset: 0,
  backgroundColor: '#bd6a70',
  backgroundImage: `url(${image})`,
  backgroundSize: '300% auto',
  backgroundPosition: '0% 0%',
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.8) contrast(0.95) brightness(0.88)',
  transform: 'scale(1.015)',
  '@media (max-width: 560px)': {
    backgroundSize: 'auto 200%',
  },
  '@media (max-width: 720px) and (min-width: 561px)': {
    '& h1': {
      fontSize: '3.4rem',
      lineHeight: 0.94,
    },
  },
  '&::after': {
    content: "''",
    position: 'absolute',
    inset: 0,
    background: 'rgba(20, 29, 32, 0.4)',
  },
}));

export const HeroCopy = styled(Box)({
  position: 'relative',
  minHeight: 'min(760px, calc(100dvh - 40px))',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  padding: 'clamp(28px, 7vh, 72px)',
  color: '#fff8e7',
  isolation: 'isolate',
  '& h1': {
    margin: 0,
    maxWidth: 540,
    color: '#fff8e7',
    fontSize: '4.4rem',
    lineHeight: 0.9,
    letterSpacing: 0,
    textTransform: 'uppercase',
    textShadow: '0 3px 18px rgba(8,16,20,0.52)',
    overflowWrap: 'anywhere',
  },
  '@media (max-width: 560px)': {
    minHeight: 'calc(100dvh - 40px)',
    padding: '28px 22px',
    '& h1': {
      fontSize: '2.35rem',
      lineHeight: 0.94,
    },
  },
  '@media (max-height: 600px)': {
    padding: 20,
    '& h1': {
      fontSize: '2.5rem',
      lineHeight: 0.94,
    },
  },
});

export const HeroBadge = styled(Box)({
  width: 'fit-content',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 18,
  padding: '8px 16px 8px 18px',
  color: '#fff8e7',
  background: 'rgba(24,41,47,0.62)',
  border: '1px solid rgba(255,248,231,0.48)',
  borderRadius: 999,
  fontSize: '0.78rem',
  fontWeight: 900,
  letterSpacing: 0,
  textTransform: 'uppercase',
  boxShadow: 'none',
});

export const HeroSubtitle = styled(Typography)({
  maxWidth: 520,
  marginTop: 16,
  color: 'rgba(255,248,231,0.86)',
  fontWeight: 800,
  lineHeight: 1.36,
});

export const HeroMeta = styled(Box)({
  marginTop: 10,
  color: 'rgba(255,248,231,0.84)',
  fontSize: '0.78rem',
  fontWeight: 800,
  textTransform: 'uppercase',
});

export const BoardFrame = styled(Box)({
  position: 'relative',
  padding: 8,
  clipPath: angularPanel,
  background: '#356f6b',
  border: '2px solid #211d1a',
  boxShadow: '6px 6px 0 #211d1a',
});

export const BoardTitleStrip = styled(Box)({
  position: 'absolute',
  top: -1,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 2,
  width: 'min(440px, 72%)',
  padding: '8px 20px',
  clipPath: bannerCut,
  color: '#fff8e7',
  background: '#bd3f32',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  letterSpacing: 0,
  boxShadow: '3px 3px 0 #211d1a',
});

export const BoardSurface = styled(Box)({
  display: 'grid',
  gridTemplateColumns: '1.26fr 0.74fr',
  gap: 10,
  maxHeight: 650,
  overflowY: 'auto',
  padding: '34px 12px 12px',
  clipPath: angularPanel,
  border: '2px solid #211d1a',
  backgroundColor: '#fff8e7',
  backgroundImage: 'radial-gradient(rgba(33,29,26,0.09) 0.7px, transparent 0.7px)',
  backgroundSize: '7px 7px',
  boxShadow: 'none',
  scrollbarColor: '#bd3f32 #efe3c4',
  '@media (max-width: 980px)': {
    gridTemplateColumns: '1fr',
    maxHeight: 'none',
  },
});

export const BoardSection = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'wide',
})<{ wide?: boolean }>(({ wide }) => ({
  position: 'relative',
  gridColumn: wide ? '1 / -1' : 'auto',
  padding: 9,
  clipPath: angularPanel,
  background: '#efe3c4',
  border: '1px solid rgba(33,29,26,0.55)',
  '&::before': {
    content: "''",
    position: 'absolute',
    inset: '0 auto auto 0',
    width: 42,
    height: 4,
    background: '#356f6b',
  },
}));

export const BoardSectionTitle = styled(Box)({
  width: 'fit-content',
  margin: '0 auto 9px',
  padding: '5px 26px 6px',
  clipPath: bannerCut,
  color: '#fff8e7',
  background: '#356f6b',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.76rem',
  fontWeight: 900,
  letterSpacing: 0,
});

export const CharacterGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 1180px)': {
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  },
  '@media (max-width: 520px)': {
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  },
});

export const CharacterCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'accent',
})<{ accent: string }>(({ accent }) => ({
  minHeight: 208,
  padding: 7,
  border: '2px solid var(--anime-ink)',
  background: `color-mix(in srgb, ${accent} 12%, var(--anime-paper-light))`,
  boxShadow: '3px 3px 0 var(--anime-ink)',
  transition: 'transform 0.16s ease, filter 0.16s ease',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '5px 5px 0 var(--anime-ink)',
  },
}));

export const CharacterArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'imagePosition',
})<{ image: string; imagePosition: string }>(({ image, imagePosition }) => ({
  height: 96,
  marginBottom: 7,
  borderBottom: '2px solid var(--anime-ink)',
  backgroundImage: `url(${image})`,
  backgroundSize: '600% 280%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.78) contrast(1.08)',
}));

export const CharacterName = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  color,
  textAlign: 'center',
  textTransform: 'uppercase',
  fontWeight: 900,
  lineHeight: 1.05,
  letterSpacing: 0,
  textShadow: 'none',
}));

export const AbilityStack = styled(Box)({
  display: 'grid',
  gap: 5,
  marginTop: 7,
});

export const AbilityTag = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  padding: '5px 7px',
  clipPath: chipCut,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 15%, var(--anime-paper-light))`,
  borderLeft: `4px solid ${color}`,
  fontSize: '0.67rem',
  fontWeight: 800,
  lineHeight: 1.12,
}));

export const CharacterNote = styled(Box)({
  marginTop: 7,
  color: 'rgba(33,29,26,0.7)',
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
  minHeight: 60,
  padding: 7,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 13%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  '& strong': {
    display: 'block',
    color: 'var(--anime-ink)',
    textTransform: 'uppercase',
    fontSize: '0.76rem',
    letterSpacing: 0,
  },
}));

export const BossEmblem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})<{ color: string }>(({ color }) => ({
  width: 34,
  height: 34,
  display: 'grid',
  placeItems: 'center',
  clipPath: 'polygon(50% 0, 96% 24%, 96% 76%, 50% 100%, 4% 76%, 4% 24%)',
  color: 'var(--anime-paper-light)',
  background: color,
  border: '2px solid var(--anime-ink)',
  fontWeight: 900,
}));

export const BossMeta = styled(Box)({
  color: 'rgba(33,29,26,0.68)',
  fontSize: '0.66rem',
  fontWeight: 700,
  lineHeight: 1.15,
});

export const StageGrid = styled(Box)({
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 8,
  '@media (max-width: 1180px)': {
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
  border: '2px solid var(--anime-ink)',
  background: 'var(--anime-paper-light)',
  boxShadow: `inset 0 -5px 0 ${color}`,
}));

export const StageArt = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'image' && prop !== 'imagePosition',
})<{ image: string; imagePosition: string }>(({ image, imagePosition }) => ({
  height: 70,
  backgroundImage: `url(${image})`,
  backgroundSize: '300% 200%',
  backgroundPosition: imagePosition,
  backgroundRepeat: 'no-repeat',
  filter: 'saturate(0.72) contrast(1.08)',
  borderBottom: '2px solid var(--anime-ink)',
}));

export const StageLabel = styled(Box)({
  padding: '6px 4px',
  color: 'var(--anime-ink)',
  textAlign: 'center',
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  fontWeight: 900,
  lineHeight: 1.1,
  letterSpacing: 0,
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
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 12%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
  borderLeft: `7px solid ${color}`,
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
  minHeight: 56,
  padding: 7,
  color: 'var(--anime-ink)',
  background: `color-mix(in srgb, ${color} 12%, var(--anime-paper-light))`,
  border: '2px solid var(--anime-ink)',
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
  clipPath: beast === 'flame'
    ? 'polygon(50% 0, 84% 26%, 100% 72%, 68% 100%, 30% 100%, 0 72%, 16% 28%)'
    : 'polygon(50% 0, 92% 24%, 92% 76%, 50% 100%, 8% 76%, 8% 24%)',
  background: color,
  border: '2px solid var(--anime-ink)',
  '&::before': {
    content: "''",
    position: 'absolute',
    left: beast === 'horn' ? -3 : 8,
    top: beast === 'horn' ? -2 : -3,
    width: beast === 'horn' ? 14 : 8,
    height: beast === 'horn' ? 14 : 18,
    clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
    background: beast === 'sand' ? '#d6a45d' : '#f8fafc',
    transform: beast === 'horn' ? 'rotate(-24deg)' : 'rotate(18deg)',
  },
  '&::after': {
    content: "''",
    position: 'absolute',
    right: beast === 'horn' ? -3 : 5,
    top: beast === 'horn' ? -2 : 8,
    width: beast === 'horn' ? 14 : 18,
    height: beast === 'horn' ? 14 : 7,
    clipPath: beast === 'horn' ? 'polygon(50% 0, 100% 100%, 0 100%)' : 'polygon(0 0, 100% 0, 72% 100%, 18% 100%)',
    background: beast === 'flame' ? '#bfdbfe' : color,
    transform: beast === 'horn' ? 'rotate(24deg)' : 'rotate(-25deg)',
  },
}));

export const ShowcaseArt = styled.img({
  width: '100%',
  maxHeight: 560,
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 2,
  border: '3px solid var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-teal)',
  filter: 'saturate(0.75) contrast(1.06)',
  display: 'block',
});

export const ActionPanel = styled(Box)({
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  justifyContent: 'center',
  width: 'min(1380px, 96vw)',
});

export const ActionCard = styled(Paper)({
  width: '100%',
  padding: 14,
  borderRadius: 2,
  background: 'var(--anime-paper-light)',
  border: '2px solid var(--anime-ink)',
  boxShadow: '6px 6px 0 var(--anime-vermilion)',
});

export const ActionButtons = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
});

export const PanelText = styled(Typography)({
  color: 'rgba(33,29,26,0.72)',
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
  borderRadius: 2,
  background: 'var(--anime-paper)',
  border: '2px solid var(--anime-ink)',
  color: 'var(--anime-ink)',
  fontSize: '0.88rem',
  '& strong': {
    display: 'block',
    marginBottom: 4,
    color: 'var(--anime-vermilion)',
    textTransform: 'uppercase',
    letterSpacing: 0,
  },
});

/** Shared export used by the game screen background wrapper. */
export const StyledBackground = styled(Box)({
  minHeight: '100dvh',
  position: 'relative',
  backgroundColor: 'var(--anime-paper)',
  backgroundImage: 'radial-gradient(rgba(33,29,26,0.12) 0.7px, transparent 0.7px)',
  backgroundSize: '5px 5px',
});
