import styled from '@emotion/styled';
import { Box, Paper, Typography } from '@mui/material';

export const WelcomeContainer = styled(Box)({
  minHeight: '100vh',
  background: 'radial-gradient(circle at 18% 18%, rgba(255,138,0,0.26), transparent 28%), radial-gradient(circle at 82% 20%, rgba(96,165,250,0.18), transparent 26%), linear-gradient(135deg, #120b0a 0%, #2a1512 48%, #14091f 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
});

export const HeroSection = styled(Box)({
  width: 'min(1120px, 94vw)',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 0.9fr) minmax(360px, 1.1fr)',
  gap: 28,
  alignItems: 'center',
  marginBottom: 24,
  '@media (max-width: 900px)': {
    gridTemplateColumns: '1fr',
  },
});

export const HeroCopy = styled(Box)({
  color: '#f8fafc',
});

export const HeroBadge = styled(Box)({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 12px',
  marginBottom: 16,
  borderRadius: 999,
  color: '#fed7aa',
  background: 'rgba(255, 138, 0, 0.12)',
  border: '1px solid rgba(255, 138, 0, 0.32)',
  fontSize: '0.78rem',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
});

export const HeroSubtitle = styled(Typography)({
  maxWidth: 620,
  color: 'rgba(248, 250, 252, 0.78)',
});

export const ShowcaseArt = styled.img({
  width: '100%',
  maxHeight: 430,
  objectFit: 'cover',
  objectPosition: 'center',
  borderRadius: 24,
  border: '1px solid rgba(255,255,255,0.16)',
  boxShadow: '0 26px 80px rgba(0,0,0,0.48), 0 0 34px rgba(255,138,0,0.16)',
});

export const ActionPanel = styled(Box)({
  display: 'flex',
  justifyContent: 'center',
  width: 'min(1120px, 94vw)',
});

export const ActionCard = styled(Paper)({
  width: '100%',
  padding: 24,
  background: 'linear-gradient(145deg, rgba(38,23,18,0.96), rgba(28,18,40,0.95))',
  border: '1px solid rgba(255, 138, 0, 0.28)',
  boxShadow: '0 22px 70px rgba(0,0,0,0.42), 0 0 30px rgba(255,138,0,0.14)',
});

export const ActionButtons = styled(Box)({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
});

export const PanelText = styled(Typography)({
  color: 'rgba(248, 250, 252, 0.7)',
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
  borderRadius: 16,
  background: 'rgba(255, 255, 255, 0.07)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  color: '#f8fafc',
  '& strong': {
    display: 'block',
    marginBottom: 4,
  },
});

/** Shared export used by the game screen background wrapper. */
export const StyledBackground = styled(Box)({
  minHeight: '100vh',
  background: 'radial-gradient(circle at 50% 0%, rgba(255,138,0,0.16), transparent 30%), linear-gradient(180deg, #120b0a 0%, #24100f 48%, #12091f 100%)',
  position: 'relative',
});
